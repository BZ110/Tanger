import type { AreaDefinition } from '../../src/world/area-schema';

/** Synthetic parser input only. No model files or playable areas accompany it. */
export function emptyDocument(): AreaDefinition {
  return {
    format: 'tanger.area',
    version: 1,
    id: 'test-document',
    coordinates: { units: 'meters', up: 'Y', handedness: 'right' },
    assets: [],
    sectors: [],
    connections: [],
  };
}

export function documentWithReferences(): AreaDefinition {
  return {
    ...emptyDocument(),
    assets: [
      {
        id: 'test-asset',
        path: 'fixtures/test-model.glb',
        provenance: { kind: 'original', creator: 'Synthetic test fixture' },
      },
    ],
    sectors: [
      {
        id: 'sector-a',
        bounds: { min: [-10, -10, -10], max: [10, 10, 10] },
        instances: [
          {
            id: 'instance-a',
            asset: 'test-asset',
            transform: {
              position: [0, 0, 0],
              rotation: [0, 0, 0, 1],
              scale: [1, 1, 1],
            },
          },
        ],
        colliders: [
          {
            id: 'collider-a',
            position: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            shape: { kind: 'mesh', asset: 'test-asset' },
          },
        ],
        anchors: [{ id: 'anchor-a', position: [0, 0, 0] }],
      },
      {
        id: 'sector-b',
        bounds: { min: [10, -10, -10], max: [30, 10, 10] },
        instances: [],
        colliders: [],
        anchors: [],
      },
    ],
    connections: [{ id: 'connection-a', from: 'sector-a', to: 'sector-b' }],
  };
}
