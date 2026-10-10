import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { Mesh, Texture } from 'three';
import type { Object3D, BufferGeometry, Material } from 'three';
import type { AreaDefinition } from '../../world/area-schema';
import { applySurfaceFinish } from './surface-finish';

export class AssetLibrary {
  private readonly assets = new Map<string, Object3D>();
  private readonly loader = new GLTFLoader();
  constructor(private readonly base: URL) {}

  async load(
    area: AreaDefinition,
    signal: AbortSignal,
    progress: (value: number, label: string) => void,
  ): Promise<void> {
    for (let index = 0; index < area.assets.length; index++) {
      const asset = area.assets[index]!;
      if (!this.assets.has(asset.id)) {
        const url = new URL(asset.path, this.base);
        const response = await fetch(url, { signal });
        if (!response.ok)
          throw new Error(`Unable to load ${asset.id} (${response.status})`);
        const model = await this.loader.parseAsync(
          await response.arrayBuffer(),
          new URL('.', url).href,
        );
        applySurfaceFinish(model.scene);
        if (signal.aborted) {
          disposeObjects([model.scene]);
          throw new Error('Loading cancelled');
        }
        this.assets.set(asset.id, model.scene);
      }
      progress(
        (index + 1) / area.assets.length,
        `Loading ${asset.id.replaceAll('-', ' ')}…`,
      );
    }
  }

  instantiate(id: string): Object3D {
    const object = this.assets.get(id);
    if (!object) throw new Error(`Missing loaded model: ${id}`);
    return clone(object);
  }
  dispose(extra: Iterable<Object3D> = []): void {
    disposeObjects([...this.assets.values(), ...extra]);
    this.assets.clear();
  }
}

export function disposeObjects(objects: Iterable<Object3D>): void {
  const geometries = new Set<BufferGeometry>(),
    materials = new Set<Material>(),
    textures = new Set<Texture>();
  for (const root of objects)
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof Texture) textures.add(value);
      }
      if ('dispose' in object && typeof object.dispose === 'function')
        object.dispose();
    });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}
