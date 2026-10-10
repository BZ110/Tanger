import { expect, test } from 'vitest';
import type { AreaDefinition } from '../../src/world/area-schema';
import {
  MAX_AREA_TEXT_LENGTH,
  parseArea,
  parseAreaJson,
} from '../../src/world/parse-area';
import { documentWithReferences, emptyDocument } from '../fixtures/area';

test('accepts an empty document without inventing content', () => {
  const document = emptyDocument();
  expect(parseAreaJson(JSON.stringify(document))).toEqual({
    ok: true,
    area: document,
  });
});

test('parses authored model references and arbitrary sector topology', () => {
  const document = documentWithReferences();
  const result = parseAreaJson(JSON.stringify(document));
  expect(result).toEqual({ ok: true, area: document });
  if (result.ok) expect(result.area).not.toBe(document);
});

test.each([
  null,
  [],
  {},
  { ...emptyDocument(), version: 2 },
  {
    ...emptyDocument(),
    coordinates: { units: 'feet', up: 'Z', handedness: 'left' },
  },
  { ...emptyDocument(), unknownField: true },
])('rejects malformed, unsupported, or unknown fields: %j', (value) => {
  expect(parseArea(value).ok).toBe(false);
});

test('reports JSON syntax and size errors without throwing', () => {
  expect(parseAreaJson('{')).toEqual({
    ok: false,
    issues: [{ path: '$', message: 'Invalid JSON' }],
  });
  expect(parseAreaJson(' '.repeat(MAX_AREA_TEXT_LENGTH + 1)).ok).toBe(false);
});

type InvalidCase = [string, (area: AreaDefinition) => void, string];
const invalidCases: InvalidCase[] = [
  [
    'duplicate asset IDs',
    (area) => {
      area.assets.push(area.assets[0]!);
    },
    '$.assets[1].id',
  ],
  [
    'duplicate sector IDs',
    (area) => {
      area.sectors.push(area.sectors[0]!);
    },
    '$.sectors[2].id',
  ],
  [
    'duplicate entity IDs across collections',
    (area) => {
      area.sectors[0]!.anchors[0]!.id = 'instance-a';
    },
    '$.sectors[0].anchors[0].id',
  ],
  [
    'missing visual asset',
    (area) => {
      area.sectors[0]!.instances[0]!.asset = 'missing';
    },
    '$.sectors[0].instances[0].asset',
  ],
  [
    'missing collider asset',
    (area) => {
      area.sectors[0]!.colliders[0]!.shape = { kind: 'mesh', asset: 'missing' };
    },
    '$.sectors[0].colliders[0].shape.asset',
  ],
  [
    'missing sector connection',
    (area) => {
      area.connections[0]!.to = 'missing';
    },
    '$.connections[0].to',
  ],
  [
    'self connection',
    (area) => {
      area.connections[0]!.to = 'sector-a';
    },
    '$.connections[0]',
  ],
  [
    'duplicate connection IDs',
    (area) => {
      area.connections.push(area.connections[0]!);
    },
    '$.connections[1].id',
  ],
  [
    'inverted bounds',
    (area) => {
      area.sectors[0]!.bounds.min[0] = 11;
    },
    '$.sectors[0].bounds',
  ],
  [
    'collapsed bounds',
    (area) => {
      area.sectors[0]!.bounds.min[0] = 10;
    },
    '$.sectors[0].bounds',
  ],
  [
    'out-of-bounds instance',
    (area) => {
      area.sectors[0]!.instances[0]!.transform.position[0] = 11;
    },
    '$.sectors[0].instances[0].transform.position',
  ],
  [
    'out-of-bounds collider',
    (area) => {
      area.sectors[0]!.colliders[0]!.position[1] = 11;
    },
    '$.sectors[0].colliders[0].position',
  ],
  [
    'out-of-bounds anchor',
    (area) => {
      area.sectors[0]!.anchors[0]!.position[2] = 11;
    },
    '$.sectors[0].anchors[0].position',
  ],
  [
    'zero quaternion',
    (area) => {
      area.sectors[0]!.instances[0]!.transform.rotation = [0, 0, 0, 0];
    },
    '$.sectors[0].instances[0].transform.rotation',
  ],
  [
    'non-unit collider quaternion',
    (area) => {
      area.sectors[0]!.colliders[0]!.rotation = [1, 1, 0, 0];
    },
    '$.sectors[0].colliders[0].rotation',
  ],
  [
    'NaN coordinate',
    (area) => {
      area.sectors[0]!.anchors[0]!.position[0] = NaN;
    },
    '$.sectors[0].anchors[0].position[0]',
  ],
  [
    'infinite coordinate',
    (area) => {
      area.sectors[0]!.anchors[0]!.position[0] = Infinity;
    },
    '$.sectors[0].anchors[0].position[0]',
  ],
  [
    'zero scale',
    (area) => {
      area.sectors[0]!.instances[0]!.transform.scale[0] = 0;
    },
    '$.sectors[0].instances[0].transform.scale[0]',
  ],
  [
    'negative collider dimensions',
    (area) => {
      area.sectors[0]!.colliders[0]!.shape = { kind: 'sphere', radius: -1 };
    },
    '$.sectors[0].colliders[0].shape.radius',
  ],
];
test.each(invalidCases)(
  'rejects %s with an actionable path',
  (_label, mutate, expectedPath) => {
    const area = documentWithReferences();
    mutate(area);
    const result = parseArea(area);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues.some((issue) => issue.path === expectedPath)).toBe(
        true,
      );
  },
);

test.each([
  '../model.glb',
  'nested/../model.glb',
  '/model.glb',
  'https://example.com/model.glb',
  '%2e%2e/model.glb',
  'model.glb?token=secret',
  'model.gltf',
  'folder\\model.glb',
])('rejects unsafe or unsupported asset path %s', (path) => {
  const area = documentWithReferences();
  area.assets[0]!.path = path;
  expect(parseArea(area).ok).toBe(false);
});

test('licensed asset metadata requires creator, source, and license', () => {
  const area = documentWithReferences();
  area.assets[0]!.provenance = {
    kind: 'licensed',
    creator: 'Fixture author',
    source: 'https://example.com/fixture',
    license: 'Test license',
  };
  expect(parseArea(area).ok).toBe(true);
  expect(
    parseArea({
      ...area,
      assets: [
        {
          ...area.assets[0],
          provenance: { kind: 'licensed', creator: 'Fixture author' },
        },
      ],
    }).ok,
  ).toBe(false);
});
