import { areaSchema } from './area-schema';
import type { AreaDefinition } from './area-schema';

export const MAX_AREA_TEXT_LENGTH = 5 * 1024 * 1024;
export interface AreaIssue {
  readonly path: string;
  readonly message: string;
}
export type AreaParseResult =
  | { readonly ok: true; readonly area: AreaDefinition }
  | { readonly ok: false; readonly issues: readonly AreaIssue[] };

function validateReferences(area: AreaDefinition): AreaIssue[] {
  const issues: AreaIssue[] = [];
  const add = (path: string, message: string) => {
    issues.push({ path, message });
  };
  const unique = (items: readonly { id: string }[], path: string) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.id))
        add(`${path}[${index}].id`, `Duplicate ID: ${item.id}`);
      seen.add(item.id);
    });
    return seen;
  };
  const assets = unique(area.assets, '$.assets');
  const sectors = unique(area.sectors, '$.sectors');
  unique(area.connections, '$.connections');
  const assetReference = (value: string, path: string) => {
    if (!assets.has(value)) add(path, `Unknown asset: ${value}`);
  };
  const normalizedRotation = (values: readonly number[], path: string) => {
    if (Math.abs(Math.hypot(...values) - 1) > 0.0001)
      add(path, 'Rotation must be a unit quaternion [x, y, z, w]');
  };
  area.sectors.forEach((sector, sectorIndex) => {
    const path = `$.sectors[${sectorIndex}]`;
    for (let axis = 0; axis < 3; axis++) {
      if (sector.bounds.min[axis]! >= sector.bounds.max[axis]!)
        add(
          `${path}.bounds`,
          'Minimum must be less than maximum on every axis',
        );
    }
    const inBounds = (position: readonly number[], itemPath: string) => {
      if (
        position.some(
          (value, axis) =>
            value < sector.bounds.min[axis]! ||
            value > sector.bounds.max[axis]!,
        )
      )
        add(itemPath, 'Position must be within its sector bounds');
    };
    // IDs are unique across all entity collections within a sector.
    const entities = new Set<string>();
    for (const collection of ['instances', 'colliders', 'anchors'] as const) {
      sector[collection].forEach((item, index) => {
        const itemPath = `${path}.${collection}[${index}]`;
        if (entities.has(item.id))
          add(`${itemPath}.id`, `Duplicate entity ID: ${item.id}`);
        entities.add(item.id);
      });
    }
    sector.instances.forEach((instance, index) => {
      const itemPath = `${path}.instances[${index}]`;
      assetReference(instance.asset, `${itemPath}.asset`);
      normalizedRotation(
        instance.transform.rotation,
        `${itemPath}.transform.rotation`,
      );
      inBounds(instance.transform.position, `${itemPath}.transform.position`);
    });
    sector.colliders.forEach((collider, index) => {
      const itemPath = `${path}.colliders[${index}]`;
      normalizedRotation(collider.rotation, `${itemPath}.rotation`);
      inBounds(collider.position, `${itemPath}.position`);
      if (collider.shape.kind === 'mesh')
        assetReference(collider.shape.asset, `${itemPath}.shape.asset`);
    });
    sector.anchors.forEach((anchor, index) =>
      inBounds(anchor.position, `${path}.anchors[${index}].position`),
    );
  });
  area.connections.forEach((connection, index) => {
    for (const endpoint of ['from', 'to'] as const) {
      if (!sectors.has(connection[endpoint]))
        add(
          `$.connections[${index}].${endpoint}`,
          `Unknown sector: ${connection[endpoint]}`,
        );
    }
    if (connection.from === connection.to)
      add(
        `$.connections[${index}]`,
        'A connection must join two different sectors',
      );
  });
  return issues;
}

/** Decode unknown values with actionable paths. Invalid areas never become state. */
export function parseArea(value: unknown): AreaParseResult {
  const result = areaSchema.safeParse(value);
  if (!result.success)
    return {
      ok: false,
      issues: result.error.issues.map((issue) => ({
        path:
          '$' +
          issue.path
            .map((part) =>
              typeof part === 'number' ? `[${part}]` : `.${String(part)}`,
            )
            .join(''),
        message: issue.message,
      })),
    };
  const issues = validateReferences(result.data);
  return issues.length
    ? { ok: false, issues }
    : { ok: true, area: result.data };
}

export function parseAreaJson(text: string): AreaParseResult {
  if (text.length > MAX_AREA_TEXT_LENGTH)
    return {
      ok: false,
      issues: [
        { path: '$', message: 'Area document exceeds the text-size limit' },
      ],
    };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, issues: [{ path: '$', message: 'Invalid JSON' }] };
  }
  return parseArea(value);
}
