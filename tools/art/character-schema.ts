import { z } from 'zod';

const identifier = z.string().regex(/^[a-z][a-z0-9-]{1,63}$/);
const localPath = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith('/') &&
      !value.includes('\\') &&
      !value.split('/').includes('..') &&
      !value.includes(':'),
    'Use a project-relative path without traversal or a URL',
  );
const names = z
  .array(z.string().min(1))
  .refine(
    (values) => new Set(values).size === values.length,
    'Names must be unique',
  );
const provenance = z
  .strictObject({
    id: identifier,
    kind: z.enum(['original', 'licensed']),
    description: z.string().min(1),
    creator: z.string().min(1),
    source: z.string().url().optional(),
    license: z.string().min(1),
    files: z.array(localPath).min(1),
  })
  .refine(
    (value) => value.kind === 'original' || !!value.source,
    'Licensed inputs require a source URL',
  );

export const characterSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: identifier,
  kind: z.enum(['character', 'technical-fixture']),
  stage: z.enum(['draft', 'model', 'rigged', 'review']),
  brief: localPath,
  source: localPath.refine(
    (value) => value.endsWith('.blend'),
    'Source must be .blend',
  ),
  export: localPath.refine(
    (value) => value.endsWith('.glb'),
    'Export must be .glb',
  ),
  exportCollection: z.string().min(1),
  coordinates: z.literal('gltf-meters-y-up'),
  heightMeters: z.number().positive(),
  shading: z.enum(['anime-toon', 'painted-pbr']),
  materialRoles: z.record(z.string().min(1), z.string().min(1)),
  rig: z.strictObject({
    requiredJoints: names,
    clips: z.record(z.string().min(1), z.string().min(1)),
    expressions: names,
    rootMotion: z.literal('in-place'),
  }),
  deliveryBudgets: z.strictObject({
    triangles: z.number().int().positive(),
    materials: z.number().int().positive(),
    joints: z.number().int().positive(),
    textureEdge: z.number().int().positive(),
    fileMiB: z.number().positive(),
  }),
  provenance: z.array(provenance).min(1),
  review: z.strictObject({
    evidence: z
      .array(
        localPath.refine(
          (value) => /\.(png|jpe?g)$/i.test(value),
          'Review evidence must be a PNG or JPEG image',
        ),
      )
      .refine(
        (values) => new Set(values).size === values.length,
        'Review evidence paths must be unique',
      ),
    notes: localPath,
    verdict: z.enum(['pending', 'revise', 'accepted']),
    reviewer: z.string(),
  }),
});

export type CharacterManifest = z.infer<typeof characterSchema>;

export function createManifest(id: string): CharacterManifest {
  identifier.parse(id);
  const directory = `art/characters/${id}`;
  return characterSchema.parse({
    schemaVersion: 1,
    id,
    kind: 'character',
    stage: 'draft',
    brief: `${directory}/brief.md`,
    source: `${directory}/source/${id}.blend`,
    export: `${directory}/exports/${id}.glb`,
    exportCollection: 'EXPORT',
    coordinates: 'gltf-meters-y-up',
    heightMeters: 1.75,
    shading: 'anime-toon',
    materialRoles: {
      skin: 'Skin',
      eyes: 'Eyes',
      hair: 'Hair',
      clothing: 'Clothing',
    },
    rig: {
      requiredJoints: [
        'pelvis',
        'spine',
        'chest',
        'neck',
        'head',
        'upper_arm.L',
        'forearm.L',
        'hand.L',
        'upper_arm.R',
        'forearm.R',
        'hand.R',
        'thigh.L',
        'shin.L',
        'foot.L',
        'thigh.R',
        'shin.R',
        'foot.R',
      ],
      clips: {
        idle: 'idle',
        walk: 'walk',
        run: 'run',
        dash: 'dash',
        attack: 'attack-01',
        hit: 'hit',
      },
      expressions: ['blink.L', 'blink.R', 'jawOpen', 'smile'],
      rootMotion: 'in-place',
    },
    deliveryBudgets: {
      triangles: 120000,
      materials: 12,
      joints: 160,
      textureEdge: 4096,
      fileMiB: 80,
    },
    provenance: [
      {
        id: 'authored-character',
        kind: 'original',
        description:
          'Original character geometry, textures, rig, and animation created for TANGER.',
        creator: 'BZ110 / TANGER',
        license:
          'Project-owned original work; distribution terms to be set by the owner.',
        files: [`${directory}/source/${id}.blend`],
      },
    ],
    review: {
      evidence: [],
      notes: `${directory}/review.md`,
      verdict: 'pending',
      reviewer: '',
    },
  });
}
