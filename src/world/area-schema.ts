import { z } from 'zod';

/** The single source for runtime validation, TypeScript types, and editor schema. */
const id = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const text = z.string().trim().min(1).max(512);
const coordinate = z.number().min(-1_000_000).max(1_000_000);
const positive = z.number().positive().max(1_000_000);
const vector = z.tuple([coordinate, coordinate, coordinate]);
const extents = z.tuple([positive, positive, positive]);
const quaternion = z.tuple([
  z.number().min(-1).max(1),
  z.number().min(-1).max(1),
  z.number().min(-1).max(1),
  z.number().min(-1).max(1),
]);

const transform = z.strictObject({
  position: vector,
  rotation: quaternion,
  scale: extents,
});

// Portable relative paths. No protocol, traversal, percent-encoding, or query.
const modelPath = z
  .string()
  .max(512)
  .regex(/^(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.glb$/);
const provenance = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('original'), creator: text }),
  z.strictObject({
    kind: z.literal('licensed'),
    creator: text,
    source: z.url({ protocol: /^https$/ }).max(2048),
    license: text,
  }),
]);

const colliderShape = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('box'), halfExtents: extents }),
  z.strictObject({ kind: z.literal('sphere'), radius: positive }),
  z.strictObject({
    kind: z.literal('capsule'),
    radius: positive,
    halfHeight: positive,
  }),
  z.strictObject({ kind: z.literal('mesh'), asset: id }),
]);

export const areaSchema = z.strictObject({
  $schema: z.string().max(512).optional(),
  format: z.literal('tanger.area'),
  version: z.literal(1),
  id,
  coordinates: z.strictObject({
    units: z.literal('meters'),
    up: z.literal('Y'),
    handedness: z.literal('right'),
  }),
  assets: z
    .array(z.strictObject({ id, path: modelPath, provenance }))
    .max(4096),
  sectors: z
    .array(
      z.strictObject({
        id,
        bounds: z.strictObject({ min: vector, max: vector }),
        instances: z
          .array(z.strictObject({ id, asset: id, transform }))
          .max(10000),
        colliders: z
          .array(
            z.strictObject({
              id,
              position: vector,
              rotation: quaternion,
              shape: colliderShape,
            }),
          )
          .max(10000),
        anchors: z.array(z.strictObject({ id, position: vector })).max(1024),
      }),
    )
    .max(256),
  // Arbitrary adjacency rather than a mandatory square terrain grid.
  connections: z.array(z.strictObject({ id, from: id, to: id })).max(4096),
});

export type AreaDefinition = z.infer<typeof areaSchema>;
export type AreaSector = AreaDefinition['sectors'][number];
