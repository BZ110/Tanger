import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { characterSchema, createManifest } from '../tools/art/character-schema';
import { inspectGlb } from '../tools/art/inspect-glb';
import { existingProjectPath, projectPath } from '../tools/art/paths';

const root = resolve('.');
const [command, argument, option] = process.argv.slice(2);
const schemaPath = resolve('art/schemas/character.schema.json');
const schemaText =
  JSON.stringify(
    {
      ...z.toJSONSchema(characterSchema, {
        target: 'draft-2020-12',
        reused: 'ref',
      }),
      title: 'TANGER character manifest v1',
      description:
        'Structure only. art:validate checks exported GLB and review evidence.',
    },
    null,
    2,
  ) + '\n';

function blender(): string {
  const candidates = [
    process.env.TANGER_BLENDER,
    '.tools/blender/Blender.app/Contents/MacOS/Blender',
    '.tools/blender/blender-4.5.14-linux-x64/blender',
    '/Applications/Blender.app/Contents/MacOS/Blender',
    'blender',
  ].filter((value): value is string => !!value);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (result.status === 0) return candidate;
  }
  throw new Error(
    'Blender is unavailable. Run npm run art:setup, or set TANGER_BLENDER to its executable.',
  );
}

function runBlender(script: string, args: string[]) {
  const result = spawnSync(
    blender(),
    [
      '--background',
      '--factory-startup',
      '--python-exit-code',
      '1',
      '--python',
      `tools/art/blender/${script}.py`,
      '--',
      ...args,
    ],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Blender ${script} failed (${result.status ?? 'signal'}).`);
}

async function main() {
  if (command === 'doctor') {
    console.log(
      `Node ${process.version}; Three.js ${JSON.parse(await readFile('node_modules/three/package.json', 'utf8')).version}`,
    );
    const result = spawnSync(blender(), ['--version'], { encoding: 'utf8' });
    console.log(result.stdout.split('\n')[0]);
    console.log(
      'Blender scripting + glTF export; run art:smoke to verify the complete pipeline.',
    );
  } else if (command === 'schema' || command === 'check-schema') {
    if (command === 'schema') {
      await mkdir(dirname(schemaPath), { recursive: true });
      await writeFile(schemaPath, schemaText);
    } else if ((await readFile(schemaPath, 'utf8')) !== schemaText)
      throw new Error('Character schema is stale. Run npm run art:schema.');
  } else if (command === 'new' && argument) {
    const manifest = createManifest(argument);
    const directory = dirname(projectPath(root, manifest.brief));
    if (existsSync(directory))
      throw new Error(
        `Character ${argument} already exists. No files overwritten.`,
      );
    await mkdir(`${directory}/source`, { recursive: true });
    await writeFile(
      `${directory}/character.json`,
      JSON.stringify(manifest, null, 2) + '\n',
    );
    await writeFile(
      projectPath(root, manifest.brief),
      `# ${argument} character brief\n\nStatus: uncommissioned draft. No character design is approved yet.\n\n## Decisions before modeling\n\nRecord the intended age range, silhouette, proportions, personality, role, clothing layers, hair shape, palette, and original reference board here. Ask the owner only for decisions the current task does not authorize you to make.\n\n## Deliverables\n\nFollow art/PIPELINE.md and art/QUALITY.md. Model an original character with editable Blender source, painted textures, a deforming rig, expressions, and authored in-place animation. The manifest starts with editable defaults; bind it to the actual exported names.\n\n## Scope\n\nThis character is isolated from the tutorial until reviewed. Do not replace the legacy operator or add gameplay.\n`,
    );
    await writeFile(
      projectPath(root, manifest.review.notes),
      `# ${argument} visual review\n\nVerdict: pending.\n\nRecord actual evidence, camera/lighting conditions, deformation failures, changes, and remaining concerns. A validator result is not an artistic review.\n`,
    );
    console.log(
      `Created art/characters/${argument}/character.json (draft; no model generated).`,
    );
  } else if (command === 'smoke') {
    runBlender('fixture', []);
    const fixture = 'art/.build/fixture/character.json';
    await validate(fixture);
    runBlender('render_character', [fixture]);
    console.log(
      'Pipeline fixture passed. This is a technical test, not a character-quality example.',
    );
  } else if (
    ['validate', 'export', 'render', 'inspect'].includes(command ?? '') &&
    argument
  ) {
    const manifestPath = await existingProjectPath(root, argument);
    const manifest = characterSchema.parse(
      JSON.parse(await readFile(manifestPath, 'utf8')),
    );
    if (command === 'validate') await validate(argument);
    else {
      await existingProjectPath(root, manifest.source);
      runBlender(
        command === 'export'
          ? 'export_character'
          : command === 'render'
            ? 'render_character'
            : 'inspect_scene',
        [argument, ...(option ? [option] : [])],
      );
      if (command === 'export') await validate(argument);
    }
  } else
    throw new Error(
      'Usage: art:doctor | art:new -- <id> | art:validate/export/render/inspect -- <character.json> | art:smoke | art:schema',
    );
}

async function validate(file: string) {
  const manifest = characterSchema.parse(
    JSON.parse(await readFile(await existingProjectPath(root, file), 'utf8')),
  );
  await existingProjectPath(root, manifest.brief);
  if (manifest.stage === 'draft') {
    console.log(
      `${manifest.id}: draft manifest valid; no model or quality claim.`,
    );
    return;
  }
  await existingProjectPath(root, manifest.source);
  for (const item of manifest.provenance)
    for (const path of item.files) await existingProjectPath(root, path);
  const result = await inspectGlb(
    await readFile(await existingProjectPath(root, manifest.export)),
    manifest,
  );
  if (manifest.stage === 'review') {
    if (manifest.kind !== 'character')
      result.errors.push(
        'Technical fixtures cannot be character review deliveries.',
      );
    if (
      manifest.review.verdict !== 'accepted' ||
      !manifest.review.reviewer.trim() ||
      manifest.review.evidence.length < 6
    )
      result.errors.push(
        'Review delivery requires a named reviewer, accepted verdict, and at least six actual review images.',
      );
    for (const path of [...manifest.review.evidence, manifest.review.notes]) {
      const bytes = await readFile(await existingProjectPath(root, path));
      if (!bytes.length) result.errors.push(`Empty review evidence: ${path}`);
    }
  }
  result.ok = result.errors.length === 0;
  const directory = resolve(`art/.build/reports/${manifest.id}`);
  await mkdir(directory, { recursive: true });
  await writeFile(
    `${directory}/validation.json`,
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(
    `${manifest.id}: ${result.stats.triangles} triangles, ${result.stats.materials} materials, ${result.stats.joints} joints, ${result.stats.clips.length} clips, ${result.stats.expressions.length} morph names`,
  );
  for (const warning of result.warnings) console.warn(warning);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  console.log(
    `Technical validation passed; visual quality still requires inspection. Report: art/.build/reports/${manifest.id}/validation.json`,
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
