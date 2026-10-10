import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { existingProjectPath } from './paths';
import { sourceWorkflowSchema, visualAssessmentSchema } from './quality-schema';
import type { SourceWorkflow, VisualAssessment } from './quality-schema';

export function digest(bytes: Uint8Array | string) {
  return createHash('sha256').update(bytes).digest('hex');
}
export async function appearanceDigest(root: string, state: SourceWorkflow) {
  const textureRoot = join(dirname(state.source), 'textures').replaceAll(
    '\\',
    '/',
  );
  const files = [
    state.shaderProfile,
    ...(
      await readdir(await existingProjectPath(root, textureRoot), {
        withFileTypes: true,
      })
    )
      .filter((item) => item.isFile())
      .map((item) => `${textureRoot}/${item.name}`)
      .sort(),
  ];
  const values = await Promise.all(
    files.map(
      async (file) =>
        `${file}:${digest(await readFile(await existingProjectPath(root, file)))}`,
    ),
  );
  return digest(values.join('\n'));
}
export async function readWorkflow(root: string, file: string) {
  return sourceWorkflowSchema.parse(
    JSON.parse(await readFile(await existingProjectPath(root, file), 'utf8')),
  );
}
export async function checkedAssessment(
  root: string,
  state: SourceWorkflow,
  file: string,
  current = true,
): Promise<VisualAssessment> {
  const assessment = visualAssessmentSchema.parse(
    JSON.parse(await readFile(await existingProjectPath(root, file), 'utf8')),
  );
  if (assessment.character !== state.character)
    throw new Error('Assessment belongs to another character.');
  if (
    current &&
    digest(await readFile(await existingProjectPath(root, state.source))) !==
      assessment.sourceSha256
  )
    throw new Error(
      'Source changed after render/review. Render and inspect a new iteration.',
    );
  if (
    current &&
    assessment.appearanceSha256 !== (await appearanceDigest(root, state))
  )
    throw new Error(
      'Shader/paint evidence is stale or missing its appearance signature. Render and inspect again.',
    );
  for (const evidence of assessment.evidence) {
    const bytes = await readFile(
      await existingProjectPath(root, evidence.path),
    );
    if (
      bytes.length < 24 ||
      bytes.readUInt32BE(0) !== 0x89504e47 ||
      digest(bytes) !== evidence.sha256
    )
      throw new Error(
        `Missing, replaced, or invalid PNG evidence: ${evidence.path}`,
      );
  }
  for (const receipt of state.accepted) {
    if (
      digest(
        await readFile(await existingProjectPath(root, receipt.assessment)),
      ) !== receipt.assessmentSha256
    )
      throw new Error(`Accepted assessment changed: ${receipt.stage}`);
    if (
      digest(
        await readFile(await existingProjectPath(root, receipt.checkpoint)),
      ) !== receipt.sourceSha256
    )
      throw new Error(`Accepted checkpoint changed: ${receipt.stage}`);
  }
  return assessment;
}
