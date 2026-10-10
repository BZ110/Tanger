import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { CharacterManifest } from './character-schema';
import { assessGate } from './quality-schema';
import { checkedAssessment, digest, readWorkflow } from './quality-store';
import { existingProjectPath } from './paths';

export async function requireFinalExport(
  root: string,
  manifest: CharacterManifest,
) {
  if (manifest.kind === 'technical-fixture') return;
  if (!manifest.sourceWorkflow || !manifest.deliverySource)
    throw new Error(
      'Character export is blocked: migrate to separate artistic source and reviewed runtime delivery.',
    );
  const state = await readWorkflow(root, manifest.sourceWorkflow);
  if (
    state.source !== manifest.source ||
    state.deliverySource !== manifest.deliverySource
  )
    throw new Error(
      'Source/delivery manifest paths disagree with the workflow.',
    );
  if (!state.latestAssessment)
    throw new Error('Final export needs an actual visual assessment.');
  const assessment = await checkedAssessment(
    root,
    state,
    state.latestAssessment,
  );
  const errors = assessGate('export', state, assessment);
  if (errors.length) throw new Error(errors.join('\n'));
  const receipt = JSON.parse(
    await readFile(
      await existingProjectPath(
        root,
        `${dirname(state.deliverySource)}/receipt.json`,
      ),
      'utf8',
    ),
  ) as { sourceSha256: string; deliverySha256: string };
  if (
    receipt.sourceSha256 !== assessment.sourceSha256 ||
    receipt.deliverySha256 !==
      digest(
        await readFile(await existingProjectPath(root, state.deliverySource)),
      )
  )
    throw new Error(
      'Runtime delivery is stale or changed after derivation. Review/derive it again.',
    );
}
