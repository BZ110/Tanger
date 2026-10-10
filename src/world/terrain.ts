import type { Vec3 } from '../core/math';
import { randomAt } from '../core/math';

export interface TreeInstance {
  readonly position: Vec3;
  readonly scale: number;
  readonly variant: number;
}
export interface WorldChunk {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly size: number;
  readonly trees: readonly TreeInstance[];
}

export function terrainHeight(x: number, z: number, seed: number): number {
  const phase = (seed % 1000) / 1000;
  return (
    Math.sin(x * 0.045 + phase) * 2.1 +
    Math.cos(z * 0.055) * 1.8 +
    Math.sin((x + z) * 0.09) * 0.65
  );
}

export function generateChunk(
  x: number,
  z: number,
  size: number,
  seed: number,
): WorldChunk {
  const trees: TreeInstance[] = [];
  for (let index = 0; index < 12; index++) {
    const px = (x + randomAt(seed, x, z, index * 3)) * size;
    const pz = (z + randomAt(seed, x, z, index * 3 + 1)) * size;
    // Keep the landmark and its approach open.
    if (Math.hypot(px, pz) < 12) continue;
    trees.push({
      position: { x: px, y: terrainHeight(px, pz, seed), z: pz },
      scale: 0.8 + randomAt(seed, x, z, index * 3 + 2) * 0.8,
      variant: index % 3,
    });
  }
  return { id: `${x},${z}`, x, z, size, trees };
}
