import * as THREE from 'three';
import type { GameConfig } from '../../content/game-config';
import { terrainHeight } from '../../world/terrain';
import type { WorldChunk } from '../../world/terrain';

interface ChunkView {
  group: THREE.Group;
  ground: THREE.BufferGeometry;
  instances: THREE.InstancedMesh[];
}

/** Owns all chunk GPU resources; residency is decided by the simulation. */
export class TerrainView {
  private readonly views = new Map<string, ChunkView>();
  private readonly groundMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
  });
  private readonly trunkGeometry = new THREE.CylinderGeometry(0.14, 0.22, 2, 5);
  private readonly crownGeometry = new THREE.IcosahedronGeometry(1.3, 0);
  private readonly trunkMaterial = new THREE.MeshStandardMaterial({
    color: '#685342',
    roughness: 1,
  });
  private readonly crownMaterial = new THREE.MeshStandardMaterial({
    roughness: 1,
  });
  private readonly dummy = new THREE.Object3D();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly config: GameConfig,
  ) {}

  sync(chunks: ReadonlyMap<string, WorldChunk>): void {
    for (const [id, view] of this.views) {
      if (!chunks.has(id)) {
        this.release(view);
        this.views.delete(id);
      }
    }
    for (const [id, chunk] of chunks) {
      if (!this.views.has(id)) this.views.set(id, this.build(chunk));
    }
  }

  private build(chunk: WorldChunk): ChunkView {
    const group = new THREE.Group();
    const ground = new THREE.PlaneGeometry(
      chunk.size,
      chunk.size,
      this.config.world.segments,
      this.config.world.segments,
    );
    ground.rotateX(-Math.PI / 2);
    const positions = ground.getAttribute('position');
    const colors = new Float32Array(positions.count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) + (chunk.x + 0.5) * chunk.size;
      const z = positions.getZ(i) + (chunk.z + 0.5) * chunk.size;
      const y = terrainHeight(x, z, this.config.world.seed);
      positions.setXYZ(i, x, y, z);
      const path =
        Math.abs(x - Math.sin(z * 0.055) * 3) < 1.7 && Math.abs(z) < 55;
      color.set(path ? '#c5b590' : '#95a471');
      if (!path)
        color.lerp(
          new THREE.Color('#b4b37e'),
          (Math.sin(x * 0.13 + z * 0.08) + 1) * 0.22,
        );
      color.toArray(colors, i * 3);
    }
    ground.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    ground.computeVertexNormals();
    const surface = new THREE.Mesh(ground, this.groundMaterial);
    surface.receiveShadow = true;
    group.add(surface);
    const trunks = new THREE.InstancedMesh(
      this.trunkGeometry,
      this.trunkMaterial,
      chunk.trees.length,
    );
    const crowns = new THREE.InstancedMesh(
      this.crownGeometry,
      this.crownMaterial,
      chunk.trees.length,
    );
    const leafColors = ['#708568', '#9da46c', '#b57b4c'];
    chunk.trees.forEach((tree, index) => {
      const { x, y, z } = tree.position;
      this.dummy.position.set(x, y + tree.scale, z);
      this.dummy.scale.setScalar(tree.scale);
      this.dummy.updateMatrix();
      trunks.setMatrixAt(index, this.dummy.matrix);
      this.dummy.position.set(x, y + tree.scale * 2.65, z);
      this.dummy.scale.set(tree.scale * 1.15, tree.scale * 1.35, tree.scale);
      this.dummy.updateMatrix();
      crowns.setMatrixAt(index, this.dummy.matrix);
      crowns.setColorAt(
        index,
        color.set(leafColors[tree.variant] ?? leafColors[0]!),
      );
    });
    trunks.castShadow = crowns.castShadow = true;
    group.add(trunks, crowns);
    this.scene.add(group);
    return { group, ground, instances: [trunks, crowns] };
  }

  private release(view: ChunkView): void {
    this.scene.remove(view.group);
    view.ground.dispose();
    for (const mesh of view.instances) mesh.dispose();
  }

  dispose(): void {
    for (const view of this.views.values()) this.release(view);
    this.views.clear();
    this.trunkGeometry.dispose();
    this.crownGeometry.dispose();
    this.groundMaterial.dispose();
    this.trunkMaterial.dispose();
    this.crownMaterial.dispose();
  }
}
