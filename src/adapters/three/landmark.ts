import * as THREE from 'three';
import { terrainHeight } from '../../world/terrain';

export function createLandmark(seed: number): THREE.Group {
  const root = new THREE.Group();
  root.position.set(0, terrainHeight(0, -8, seed), -8);
  const stone = new THREE.MeshStandardMaterial({
    color: '#bdb49b',
    roughness: 1,
  });
  const cap = new THREE.MeshStandardMaterial({
    color: '#ddd0aa',
    roughness: 1,
  });
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.3, 1.2), stone);
    pillar.position.set(side * 2.5, 2.15, 0);
    pillar.rotation.z = side * 0.025;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 1.7), cap);
    base.position.set(side * 2.5, 0.22, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 1.5), cap);
    top.position.set(side * 2.5, 4.25, 0);
    root.add(pillar, base, top);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.65, 1.3), stone);
  lintel.position.y = 4.8;
  const emblem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.38),
    new THREE.MeshStandardMaterial({
      color: '#c98442',
      emissive: '#9d5c21',
      emissiveIntensity: 0.3,
      roughness: 0.5,
    }),
  );
  emblem.position.set(0, 4.8, 0.74);
  root.add(lintel, emblem);
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return root;
}
