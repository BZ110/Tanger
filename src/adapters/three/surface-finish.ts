import {
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three';
import type { Object3D } from 'three';

/** Original deterministic surface detail. Owned by the model materials after use. */
export function applySurfaceFinish(root: Object3D): void {
  const finishes = new Map<string, CanvasTexture>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      if (
        !(material instanceof MeshStandardMaterial) ||
        !['metal', 'panel', 'concrete', 'dark'].includes(material.name) ||
        material.map
      )
        continue;
      let texture = finishes.get(material.name);
      if (!texture) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const context = canvas.getContext('2d');
        if (!context) continue;
        const image = context.createImageData(256, 256);
        let noiseState = 71231;
        for (let i = 0; i < image.data.length; i += 4) {
          noiseState = Math.imul(noiseState, 1664525) + 1013904223;
          const x = (i / 4) % 256,
            y = Math.floor(i / 4 / 256);
          const line = material.name === 'concrete' ? 0 : Math.sin(y * 2.4) * 5;
          const grain = 230 + ((noiseState >>> 24) / 255) * 25 + line;
          const scratch =
            material.name !== 'concrete' && y % 67 === 0 && x > 30 && x < 165
              ? -35
              : 0;
          image.data[i] =
            image.data[i + 1] =
            image.data[i + 2] =
              Math.min(255, grain + scratch);
          image.data[i + 3] = 255;
        }
        context.putImageData(image, 0, 0);
        texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = 4;
        finishes.set(material.name, texture);
      }
      material.map = texture;
      material.needsUpdate = true;
    }
  });
}
