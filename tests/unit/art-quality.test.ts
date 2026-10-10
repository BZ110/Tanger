import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assessGate,
  sourceWorkflowSchema,
  visualAssessmentSchema,
  visualCategories,
  visualStages,
} from '../../tools/art/quality-schema';
import {
  appearanceDigest,
  checkedAssessment,
  digest,
} from '../../tools/art/quality-store';
import { artistRequestSchema } from '../../scripts/art-artist';

const sha = 'a'.repeat(64);
function workflow() {
  return sourceWorkflowSchema.parse({
    schemaVersion: 1,
    character: 'fixture',
    representation: 'artistic-source',
    source: 'source/fixture.blend',
    collection: 'SOURCE',
    shaderProfile: 'source/profile.json',
    deliverySource: 'delivery/fixture.blend',
    deliveryCollection: 'RUNTIME',
    reviewRoot: 'review/iterations',
    checkpointRoot: 'source/checkpoints',
    accepted: [],
    latestAssessment: null,
    references: [],
    framing: {
      height: 1.8,
      headCenter: [0, 0, 1.6],
      headSpan: 0.4,
      details: Object.fromEntries(
        ['eyes', 'hair', 'hands', 'footwear', 'clothing'].map((key) => [
          key,
          { center: [0, 0, 1], span: 0.2 },
        ]),
      ),
    },
  });
}
function assessment() {
  return visualAssessmentSchema.parse({
    schemaVersion: 1,
    character: 'fixture',
    stage: 'face',
    iteration: 'fixture-review',
    reviewer: 'technical-test',
    sourceSha256: sha,
    appearanceSha256: sha,
    evidence: ['front', 'profile', 'quarter'].map((view) => ({
      path: `review/${view}.png`,
      view,
      sha256: sha,
    })),
    categories: Object.fromEntries(
      visualCategories.map((key) => [
        key,
        {
          score: 4,
          severity: 'PASS',
          location: key,
          observedProblem: 'Technical test only',
          visualConsequence: 'Not an art approval',
          recommendedAction: 'Inspect real images',
          blocksNextStage: false,
        },
      ]),
    ),
    topThree: ['face', 'eyes', 'profile'].map((category, i) => ({
      rank: i + 1,
      category,
      location: category,
      problem: 'Technical test',
      consequence: 'No artistic verdict',
      correction: 'Inspect source',
    })),
    comparison: {
      previousIteration: null,
      improved: 'baseline',
      observations: 'Technical test only',
    },
  });
}
const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('source quality gates', () => {
  it('cannot skip visual stages or authorize export from a positive face assessment', () => {
    const state = workflow(),
      review = assessment();
    expect(assessGate('advance', state, review).join(' ')).toContain(
      'cannot be skipped',
    );
    expect(assessGate('export', state, review).join(' ')).toContain(
      '12 accepted',
    );
    expect(assessGate('rig', state, review).join(' ')).toContain('topology');
    expect(assessGate('detail-hair', state, review).join(' ')).toContain(
      'hair forms',
    );
    expect(assessGate('made-up-approval', state, review).join(' ')).toContain(
      'Unknown',
    );
  });
  it('requires profile/eye evidence and passes, even with contiguous earlier stages', () => {
    const state = workflow(),
      review = assessment();
    state.accepted = [
      {
        stage: visualStages[0],
        assessment: 'review/old.json',
        assessmentSha256: sha,
        checkpoint: 'source/old.blend',
        sourceSha256: sha,
      },
    ];
    review.categories.profile = {
      ...review.categories.profile,
      severity: 'BLOCKING',
      score: 2,
      blocksNextStage: true,
    };
    expect(assessGate('advance', state, review)).toContain(
      'profile: BLOCKING blocks advance.',
    );
    expect(assessGate('advance', state, review).join(' ')).toContain(
      'portrait-side',
    );
    expect(assessGate('advance', state, review).join(' ')).toContain(
      'Face blocker earStructure',
    );
  });
  it('does not allow unreviewed evidence to pass or dishonest scores to parse', () => {
    const review = assessment();
    review.categories.eyes = {
      ...review.categories.eyes,
      severity: 'NOT_REVIEWED',
      score: 0,
      blocksNextStage: true,
    };
    expect(assessGate('presentation', workflow(), review).join(' ')).toContain(
      'eyes: NOT_REVIEWED',
    );
    review.categories.face.score = 2;
    expect(visualAssessmentSchema.safeParse(review).success).toBe(false);
    expect(
      artistRequestSchema.safeParse({
        role: 'artist',
        action: 'artist.edit',
        python: 'arbitrary code',
      }).success,
    ).toBe(false);
  });
  it('detects changed mesh, paint, shader and evidence instead of reusing a stale review', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tanger-review-'));
    temporary.push(root);
    const state = workflow(),
      review = assessment();
    await mkdir(join(root, 'source/textures'), { recursive: true });
    await mkdir(join(root, 'review'));
    await writeFile(join(root, state.source), 'source fixture');
    await writeFile(join(root, state.shaderProfile), '{}');
    await writeFile(
      join(root, 'source/textures/mask.png'),
      'editable source mask',
    );
    review.sourceSha256 = digest(await readFile(join(root, state.source)));
    review.appearanceSha256 = await appearanceDigest(root, state);
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
      'base64',
    );
    for (const evidence of review.evidence) {
      await writeFile(join(root, evidence.path), png);
      evidence.sha256 = digest(png);
    }
    await writeFile(
      join(root, 'review/assessment.json'),
      JSON.stringify(review),
    );
    await expect(
      checkedAssessment(root, state, 'review/assessment.json'),
    ).resolves.toMatchObject({ reviewer: 'technical-test' });
    await writeFile(join(root, state.source), 'changed geometry');
    await expect(
      checkedAssessment(root, state, 'review/assessment.json'),
    ).rejects.toThrow('Source changed');
    await writeFile(join(root, state.source), 'source fixture');
    await writeFile(join(root, 'source/textures/mask.png'), 'changed paint');
    await expect(
      checkedAssessment(root, state, 'review/assessment.json'),
    ).rejects.toThrow('Shader/paint');
    await writeFile(
      join(root, 'source/textures/mask.png'),
      'editable source mask',
    );
    await writeFile(join(root, state.shaderProfile), '{"changed":true}');
    await expect(
      checkedAssessment(root, state, 'review/assessment.json'),
    ).rejects.toThrow('Shader/paint');
    await writeFile(join(root, state.shaderProfile), '{}');
    await writeFile(join(root, review.evidence[0]!.path), 'replaced picture');
    await expect(
      checkedAssessment(root, state, 'review/assessment.json'),
    ).rejects.toThrow('PNG evidence');
  });
});
