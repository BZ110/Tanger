import { generateChunk } from './terrain';
import type { WorldChunk } from './terrain';

export interface ChunkSettings {
  readonly chunkSize: number;
  readonly radius: number;
  readonly seed: number;
}

/** Simulation-owned residency; render adapters reconcile these stable IDs. */
export class ChunkStream {
  private readonly resident = new Map<string, WorldChunk>();
  private center = '';

  constructor(private readonly settings: ChunkSettings) {}

  update(x: number, z: number): void {
    const { chunkSize, radius, seed } = this.settings;
    const cx = Math.floor(x / chunkSize);
    const cz = Math.floor(z / chunkSize);
    const center = `${cx},${cz}`;
    if (center === this.center) return;
    this.center = center;
    const wanted = new Set<string>();
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const id = `${cx + dx},${cz + dz}`;
        wanted.add(id);
        if (!this.resident.has(id))
          this.resident.set(
            id,
            generateChunk(cx + dx, cz + dz, chunkSize, seed),
          );
      }
    }
    for (const id of this.resident.keys()) {
      if (!wanted.has(id)) this.resident.delete(id);
    }
  }

  get chunks(): ReadonlyMap<string, WorldChunk> {
    return this.resident;
  }
}
