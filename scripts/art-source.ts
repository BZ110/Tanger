import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { characterSchema } from '../tools/art/character-schema';
import {
  animeShaderProfileSchema,
  assessGate,
  sourceWorkflowSchema,
  visualAssessmentSchema,
  visualCategories,
  visualStages,
  faceChecks,
} from '../tools/art/quality-schema';
import {
  checkedAssessment,
  digest,
  readWorkflow,
  appearanceDigest,
} from '../tools/art/quality-store';
import { existingProjectPath, projectPath } from '../tools/art/paths';
import { runBlender } from '../tools/art/blender-process';

const root = resolve('.');
const [command, file, argument, extra] = process.argv.slice(2);
const schemas = {
  'source-workflow': sourceWorkflowSchema,
  'visual-assessment': visualAssessmentSchema,
  'anime-shader-profile': animeShaderProfileSchema,
};
async function json(path: string) {
  return JSON.parse(
    await readFile(await existingProjectPath(root, path), 'utf8'),
  );
}
async function save(path: string, value: unknown) {
  const target = projectPath(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(value, null, 2) + '\n');
}
async function checkpoint(source: string, target: string) {
  await mkdir(dirname(projectPath(root, target)), { recursive: true });
  await copyFile(
    await existingProjectPath(root, source),
    projectPath(root, target),
    1,
  );
}

async function main() {
  if (command === 'schema' || command === 'check-schema') {
    for (const [name, schema] of Object.entries(schemas)) {
      const target = `art/schemas/${name}.schema.json`;
      const text =
        JSON.stringify(
          {
            ...z.toJSONSchema(schema, {
              target: 'draft-2020-12',
              reused: 'ref',
            }),
            title: `TANGER ${name} v1`,
          },
          null,
          2,
        ) + '\n';
      if (command === 'schema') {
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, text);
      } else if ((await readFile(target, 'utf8')) !== text)
        throw new Error(`Stale schema: ${target}`);
    }
    return;
  }
  if (!file)
    throw new Error(
      'Provide a character manifest (migrate) or source-workflow.json. See art/START_HERE.md.',
    );
  if (command === 'migrate') {
    const manifest = characterSchema.parse(await json(file));
    if (manifest.kind !== 'character')
      throw new Error('Technical fixtures do not acquire artistic approvals.');
    const directory = dirname(file);
    const workflowPath = `${directory}/source-workflow.json`;
    const profilePath = `${directory}/source/anime-shader-profile.json`;
    const framing = {
      height: manifest.heightMeters,
      headCenter: [0, 0, manifest.heightMeters * 0.89],
      headSpan: manifest.heightMeters * 0.27,
      details: {
        eyes: { center: [0, -0.09, manifest.heightMeters * 0.855], span: 0.2 },
        hair: { center: [0, 0, manifest.heightMeters * 0.95], span: 0.36 },
        hands: { center: [0.41, -0.01, 0.88], span: 0.22 },
        footwear: { center: [0, -0.04, 0.12], span: 0.4 },
        clothing: { center: [0, -0.04, 1.17], span: 0.65 },
      },
    };
    const state = sourceWorkflowSchema.parse({
      schemaVersion: 1,
      character: manifest.id,
      representation: 'artistic-source',
      source: manifest.source,
      collection: 'SOURCE',
      shaderProfile: profilePath,
      deliverySource: `${directory}/delivery/${manifest.id}-runtime.blend`,
      deliveryCollection: 'RUNTIME',
      reviewRoot: `${directory}/review/iterations`,
      checkpointRoot: `${directory}/source/checkpoints`,
      accepted: [],
      latestAssessment: null,
      references: [],
      framing,
    });
    await writeFile(
      projectPath(root, workflowPath),
      JSON.stringify(state, null, 2) + '\n',
      { flag: 'wx' },
    );
    const profile = animeShaderProfileSchema.parse(
      await json('art/profiles/anime-source.json'),
    );
    profile.id = `${manifest.id}-source`;
    profile.skin.faceShadowMask = `${directory}/source/textures/face-shadow.png`;
    await save(profilePath, profile);
    manifest.sourceWorkflow = workflowPath;
    manifest.deliverySource = state.deliverySource;
    manifest.stage = 'draft';
    manifest.shading = 'anime-toon';
    manifest.exportCollection = 'RUNTIME';
    await save(file, manifest);
    console.log(
      `Migrated ${manifest.id}. Existing rig/export is not visually approved. Initialize SOURCE with art:source:prepare, then audit it.`,
    );
    return;
  }
  const state = await readWorkflow(root, file);
  if (command === 'prepare') {
    await checkpoint(
      state.source,
      `${state.checkpointRoot}/${state.character}-pre-migration.blend`,
    );
    runBlender('source_prepare', [file]);
  } else if (command === 'validate') {
    animeShaderProfileSchema.parse(await json(state.shaderProfile));
    await existingProjectPath(root, state.source);
    for (const reference of state.references)
      await existingProjectPath(root, reference.path);
    if (state.latestAssessment)
      await checkedAssessment(root, state, state.latestAssessment);
    console.log(
      'Source contract valid. No runtime budgets applied; no visual approval inferred.',
    );
  } else if (command === 'render' && argument) {
    if (!/^[a-z0-9-]+$/.test(argument))
      throw new Error('Iteration uses lowercase letters, digits and hyphens.');
    const output = `${state.reviewRoot}/${argument}`;
    await mkdir(projectPath(root, state.reviewRoot), { recursive: true });
    await mkdir(projectPath(root, output)); // Immutable evidence: never overwrite an iteration.
    const sourceSha256 = digest(
      await readFile(await existingProjectPath(root, state.source)),
    );
    const appearanceSha256 = await appearanceDigest(root, state);
    runBlender('review_render', [file, output, extra ?? 'standard']);
    const batch = (await json(`${output}/capture.json`)) as {
      images: { path: string; view: string }[];
    };
    const evidence = await Promise.all(
      batch.images.map(async (image) => ({
        path: image.path,
        view: image.view,
        sha256: digest(
          await readFile(await existingProjectPath(root, image.path)),
        ),
      })),
    );
    await save(`${output}/render-receipt.json`, {
      schemaVersion: 1,
      sourceSha256,
      appearanceSha256,
      evidence,
      stage: visualStages[state.accepted.length] ?? 'delivery',
    });
    const template = {
      schemaVersion: 1,
      character: state.character,
      stage: visualStages[state.accepted.length] ?? 'delivery',
      iteration: argument,
      reviewer: 'unreviewed',
      sourceSha256,
      appearanceSha256,
      evidence,
      faceChecks: Object.fromEntries(
        faceChecks.map((key) => [key, 'NOT_REVIEWED']),
      ),
      categories: Object.fromEntries(
        visualCategories.map((category) => [
          category,
          {
            score: 0,
            severity: 'NOT_REVIEWED',
            location: category,
            observedProblem: 'Not visually inspected.',
            visualConsequence: 'Quality is unknown.',
            recommendedAction:
              'Inspect rendered evidence and classify honestly.',
            blocksNextStage: true,
          },
        ]),
      ),
      topThree: ['silhouette', 'face', 'eyes'].map((category, i) => ({
        rank: i + 1,
        category,
        location: 'Unreviewed',
        problem: 'Requires visual inspection.',
        consequence: 'Cannot advance without critique.',
        correction:
          'Inspect and replace this entry with a concrete ranked correction.',
      })),
      comparison: {
        previousIteration: null,
        improved: 'baseline',
        observations: 'No comparison recorded yet.',
      },
    };
    await save(
      `${output}/assessment.json`,
      visualAssessmentSchema.parse(template),
    );
    console.log(
      `Rendered ${output}. Inspect images and edit assessment.json; nothing was approved.`,
    );
  } else if (command === 'assess' && argument) {
    const assessment = await checkedAssessment(root, state, argument);
    if (
      assessment.reviewer === 'unreviewed' ||
      assessment.topThree.some((x) => x.location === 'Unreviewed')
    )
      throw new Error(
        'Replace the unreviewed critique template with an actual image inspection.',
      );
    state.latestAssessment = argument;
    await save(file, state);
    console.log(
      `Recorded ${assessment.iteration}; next stage: ${visualStages[state.accepted.length] ?? 'complete'}.`,
    );
  } else if (command === 'advance') {
    if (!state.latestAssessment)
      throw new Error(
        'No visual assessment. Render, inspect, critique, and assess first.',
      );
    const assessment = await checkedAssessment(
      root,
      state,
      state.latestAssessment,
    );
    const errors = assessGate('advance', state, assessment);
    if (errors.length) throw new Error(errors.join('\n'));
    const target = `${state.checkpointRoot}/${String(state.accepted.length + 1).padStart(2, '0')}-${assessment.stage}.blend`;
    await checkpoint(state.source, target);
    state.accepted.push({
      stage: assessment.stage,
      assessment: state.latestAssessment,
      assessmentSha256: digest(
        await readFile(projectPath(root, state.latestAssessment)),
      ),
      checkpoint: target,
      sourceSha256: assessment.sourceSha256,
    });
    await save(file, state);
    console.log(
      `Accepted ${assessment.stage}; checkpoint preserved. Next: ${visualStages[state.accepted.length] ?? 'complete'}.`,
    );
  } else if (command === 'gate' && argument) {
    const assessment = state.latestAssessment
      ? await checkedAssessment(root, state, state.latestAssessment)
      : undefined;
    const errors = assessGate(argument, state, assessment);
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`${argument}: gate passed.`);
  } else if (command === 'edit') {
    throw new Error(
      'The script-driven subsystem edit entry point is retired. Use art:artist:serve and guarded artist.edit operations; see art/ARTIST_MODE.md.',
    );
  } else if (command === 'derive') {
    const assessment = state.latestAssessment
      ? await checkedAssessment(root, state, state.latestAssessment)
      : undefined;
    const errors = assessGate('delivery', state, assessment);
    if (errors.length) throw new Error(errors.join('\n'));
    throw new Error(
      'Runtime derivation is deferred until its rig/morph/material transfer pipeline is implemented and reviewed. This milestone is Artist Mode.',
    );
  } else if (command === 'compare' && argument && extra) {
    runBlender('review_compare', [file, argument, extra]);
  } else
    throw new Error(
      'Source commands: migrate, prepare, validate, render <iteration> [standard|portrait|lookdev|deformation|presentation], assess <assessment>, advance, gate <action>, edit <recipe>, derive, compare <before> <after>.',
    );
}
try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
