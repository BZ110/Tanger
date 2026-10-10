import { z } from 'zod';

export const visualStages = [
  'silhouette',
  'face',
  'hair',
  'body',
  'clothing',
  'hands-footwear',
  'lookdev',
  'topology-textures',
  'deformation',
  'expressions',
  'animation',
  'delivery',
] as const;
export const visualCategories = [
  'overall',
  'silhouette',
  'face',
  'eyes',
  'profile',
  'hair',
  'anatomy',
  'clothing',
  'hands',
  'materials',
  'shader',
  'deformation',
] as const;
export const relativeAssetPath = z
  .string()
  .min(1)
  .refine(
    (s) =>
      !s.startsWith('/') &&
      !s.includes(':') &&
      !s.includes('\\') &&
      !s.split('/').includes('..'),
    'Expected project-relative asset path',
  );
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const color = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
  z.number().min(0).max(1),
]);
const unit = z.number().min(0).max(1);
const surface = z.strictObject({
  baseColor: color,
  shadowColor: color,
  shadowRamp: z.array(z.tuple([unit, unit])).min(2),
  shadowThreshold: unit,
  shadowSoftness: unit,
  specularStrength: unit,
  roughness: unit,
  rimStrength: unit,
  rimWidth: z.number().min(0.1).max(16).default(4),
  normalInfluence: unit.default(1),
  roughnessMask: relativeAssetPath.nullable().default(null),
  specularMask: relativeAssetPath.nullable().default(null),
});
export const animeShaderProfileSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  engine: z.literal('BLENDER_EEVEE_NEXT'),
  skin: surface.extend({
    faceShadowMask: relativeAssetPath.nullable(),
    specularMask: relativeAssetPath.nullable(),
    subsurface: unit,
  }),
  face: z.strictObject({
    mode: z.literal('directional-sdf'),
    basisObject: z.string().min(1),
    headBone: z.string(),
    maskChannels: z.literal('R-left-G-right'),
    thresholdBias: z.number().min(-1).max(1),
    softness: unit,
  }),
  hair: surface.extend({
    highlightColor: color,
    highlightMask: relativeAssetPath.nullable(),
    highlightDirection: z.tuple([
      z.number().min(-1).max(1),
      z.number().min(-1).max(1),
      z.number().min(-1).max(1),
    ]),
    anisotropy: unit,
  }),
  eyes: z.strictObject({
    scleraColor: color,
    irisBase: color,
    irisGradient: color,
    pupilColor: color,
    limbalColor: color,
    catchlightColor: color,
    corneaRoughness: unit,
    corneaIOR: z.number().min(1).max(2),
    irisDepth: z.number().min(0).max(0.05),
    parallax: unit,
  }),
  clothing: surface.extend({ fabricResponse: unit }),
  leather: surface,
  metal: surface.extend({ metallic: unit }),
  outline: z.strictObject({
    enabled: z.boolean(),
    width: z.number().min(0).max(0.02),
    color,
    depthSensitivity: unit,
    normalSensitivity: unit,
    objectExclusions: z.array(z.string()),
    materialExclusions: z.array(z.string()),
  }),
});

export const faceChecks = [
  'profileVolume',
  'eyeShape',
  'eyelidThickness',
  'earStructure',
  'cheekPlanes',
  'jawTransition',
  'chinBalance',
  'mouthIntegration',
  'noseStyle',
] as const;
const assessmentItem = z
  .strictObject({
    score: z.number().int().min(0).max(5),
    severity: z.enum(['PASS', 'NEEDS_WORK', 'BLOCKING', 'NOT_REVIEWED']),
    location: z.string().min(1),
    observedProblem: z.string().min(1),
    visualConsequence: z.string().min(1),
    recommendedAction: z.string().min(1),
    blocksNextStage: z.boolean(),
  })
  .refine(
    (x) => x.severity !== 'PASS' || (x.score >= 4 && !x.blocksNextStage),
    'PASS needs score >= 4 and no blocker',
  )
  .refine(
    (x) =>
      !['BLOCKING', 'NOT_REVIEWED'].includes(x.severity) || x.blocksNextStage,
    'Blocking/unreviewed categories must block their relevant gates',
  );
export const visualAssessmentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  character: z.string().min(1),
  stage: z.enum(visualStages),
  iteration: z.string().regex(/^[a-z0-9-]+$/),
  reviewer: z.string().min(1),
  sourceSha256: sha,
  appearanceSha256: sha.optional(),
  faceChecks: z
    .record(z.enum(faceChecks), z.enum(['PASS', 'BLOCKING', 'NOT_REVIEWED']))
    .optional(),
  evidence: z
    .array(
      z.strictObject({
        path: relativeAssetPath,
        sha256: sha,
        view: z.string().min(1),
      }),
    )
    .min(3),
  categories: z.record(z.enum(visualCategories), assessmentItem),
  topThree: z
    .array(
      z.strictObject({
        rank: z.number().int().min(1).max(3),
        category: z.enum(visualCategories),
        location: z.string().min(1),
        problem: z.string().min(1),
        consequence: z.string().min(1),
        correction: z.string().min(1),
      }),
    )
    .length(3),
  comparison: z.strictObject({
    previousIteration: z.string().nullable(),
    improved: z.enum(['yes', 'no', 'mixed', 'baseline']),
    observations: z.string().min(1),
  }),
});

export const sourceWorkflowSchema = z.strictObject({
  schemaVersion: z.literal(1),
  character: z.string().min(1),
  representation: z.literal('artistic-source'),
  source: relativeAssetPath,
  collection: z.string().min(1),
  shaderProfile: relativeAssetPath,
  deliverySource: relativeAssetPath,
  deliveryCollection: z.string().min(1),
  reviewRoot: relativeAssetPath,
  checkpointRoot: relativeAssetPath,
  accepted: z.array(
    z.strictObject({
      stage: z.enum(visualStages),
      assessment: relativeAssetPath,
      assessmentSha256: sha,
      checkpoint: relativeAssetPath,
      sourceSha256: sha,
    }),
  ),
  latestAssessment: relativeAssetPath.nullable(),
  references: z.array(
    z.strictObject({
      role: z.enum([
        'face',
        'hair',
        'outfit',
        'color',
        'concept',
        'turnaround',
      ]),
      path: relativeAssetPath,
      provenance: z.string().min(1),
    }),
  ),
  framing: z.strictObject({
    height: z.number().positive(),
    headCenter: z.tuple([z.number(), z.number(), z.number()]),
    headSpan: z.number().positive(),
    details: z.record(
      z.enum(['eyes', 'hair', 'hands', 'footwear', 'clothing']),
      z.strictObject({
        center: z.tuple([z.number(), z.number(), z.number()]),
        span: z.number().positive(),
      }),
    ),
  }),
});
export type VisualAssessment = z.infer<typeof visualAssessmentSchema>;
export type SourceWorkflow = z.infer<typeof sourceWorkflowSchema>;

const stageRequirements: Record<
  (typeof visualStages)[number],
  readonly (typeof visualCategories)[number][]
> = {
  silhouette: ['silhouette'],
  face: ['silhouette', 'face', 'eyes', 'profile'],
  hair: ['face', 'eyes', 'profile', 'hair'],
  body: ['silhouette', 'face', 'anatomy'],
  clothing: ['silhouette', 'face', 'anatomy', 'clothing'],
  'hands-footwear': ['silhouette', 'anatomy', 'hands', 'clothing'],
  lookdev: [
    'overall',
    'silhouette',
    'face',
    'eyes',
    'profile',
    'hair',
    'anatomy',
    'clothing',
    'hands',
    'materials',
    'shader',
  ],
  'topology-textures': ['overall', 'face', 'eyes', 'materials', 'shader'],
  deformation: ['face', 'eyes', 'anatomy', 'hands', 'deformation'],
  expressions: ['face', 'eyes', 'deformation'],
  animation: ['deformation'],
  delivery: visualCategories,
};

export function assessGate(
  action: string,
  state: SourceWorkflow,
  assessment?: VisualAssessment,
): string[] {
  const errors: string[] = [];
  const order = state.accepted.map((x) => x.stage);
  if (order.some((stage, i) => stage !== visualStages[i]))
    errors.push('Accepted stages must be contiguous, unique, and in order.');
  let required: readonly (typeof visualCategories)[number][] = [];
  if (action === 'advance') {
    const next = visualStages[order.length];
    if (!next || assessment?.stage !== next)
      errors.push(`Next stage is ${next ?? 'none'}; stages cannot be skipped.`);
    if (next) required = stageRequirements[next];
  } else if (action === 'rig') {
    required = ['face', 'eyes', 'profile', 'anatomy', 'hands'];
    if (!order.includes('topology-textures'))
      errors.push(
        'Rigging requires accepted source lookdev and topology/textures.',
      );
  } else if (action === 'expressions') {
    required = ['face', 'eyes', 'deformation'];
    if (!order.includes('deformation'))
      errors.push('Expressions require accepted deformation.');
  } else if (action === 'detail-clothing') {
    required = ['silhouette', 'anatomy', 'clothing'];
    if (!order.includes('clothing'))
      errors.push('Clothing detail requires accepted garment forms.');
  } else if (action === 'detail-hair') {
    required = ['silhouette', 'hair'];
    if (!order.includes('hair'))
      errors.push('Hair detail requires accepted hair forms.');
  } else if (action === 'delivery') {
    required = stageRequirements.lookdev;
    if (!order.includes('lookdev'))
      errors.push('Runtime derivation requires accepted source lookdev.');
  } else if (action === 'export') {
    required = visualCategories;
    if (!order.includes('delivery'))
      errors.push('Final export requires all 12 accepted visual stages.');
  } else if (action === 'presentation')
    required = [
      'overall',
      'face',
      'eyes',
      'profile',
      'hair',
      'materials',
      'shader',
    ];
  else if (action !== 'primary-edit')
    errors.push(`Unknown gated action: ${action}`);
  for (const category of required) {
    const item = assessment?.categories[category];
    if (
      !item ||
      item.severity !== 'PASS' ||
      item.score < 4 ||
      item.blocksNextStage
    )
      errors.push(
        `${category}: ${item?.severity ?? 'NOT_REVIEWED'} blocks ${action}.`,
      );
  }
  if (action === 'advance' && assessment) {
    const sets: Partial<Record<(typeof visualStages)[number], string[]>> = {
      silhouette: [
        'full-front',
        'full-quarter-left',
        'full-quarter-right',
        'full-side',
        'full-back',
      ],
      face: [
        'portrait-front',
        'portrait-quarter-left',
        'portrait-quarter-right',
        'portrait-side',
        'portrait-above',
        'portrait-below',
        'detail-eyes',
      ],
      hair: ['detail-hair', 'portrait-front', 'portrait-side'],
      body: ['full-front', 'full-side', 'full-back'],
      clothing: ['full-front', 'full-side', 'detail-clothing'],
      'hands-footwear': ['detail-hands', 'detail-footwear'],
      lookdev: [
        'light-front',
        'light-quarter',
        'light-side',
        'light-opposite',
        'light-neutral',
        'light-dramatic',
      ],
      deformation: [
        'deformation-arms-raised',
        'deformation-arms-forward',
        'deformation-elbow-bent',
        'deformation-wrist-rotated',
        'deformation-torso-twist',
        'deformation-hip-flexion',
        'deformation-knee-bend',
        'deformation-crouch',
      ],
    };
    if (assessment.stage === 'face')
      for (const check of faceChecks) {
        if (assessment.faceChecks?.[check] !== 'PASS')
          errors.push(
            `Face blocker ${check}: ${assessment.faceChecks?.[check] ?? 'NOT_REVIEWED'}.`,
          );
      }
    const views = new Set(assessment.evidence.map((item) => item.view));
    for (const view of sets[assessment.stage] ?? [])
      if (!views.has(view))
        errors.push(
          `Missing required ${assessment.stage} evidence view: ${view}`,
        );
  }
  if (assessment && new Set(assessment.topThree.map((x) => x.rank)).size !== 3)
    errors.push('Top three problems need distinct ranks 1, 2, 3.');
  return errors;
}
