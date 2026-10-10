import { mkdir, writeFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Exporter buffer support in Node; this build uses no external images/models. */
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob: Blob): void {
    void blob.arrayBuffer().then((value) => {
      this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`;
      this.onloadend?.();
    });
  }
}
Object.assign(globalThis, { FileReader: NodeFileReader });

const materials = {
  concrete: new T.MeshStandardMaterial({ color: '#303845', roughness: 0.95 }),
  metal: new T.MeshStandardMaterial({
    color: '#19202a',
    metalness: 0.65,
    roughness: 0.45,
  }),
  silver: new T.MeshStandardMaterial({
    color: '#87909b',
    metalness: 0.8,
    roughness: 0.32,
  }),
  panel: new T.MeshStandardMaterial({
    color: '#3b4655',
    metalness: 0.4,
    roughness: 0.68,
  }),
  dark: new T.MeshStandardMaterial({
    color: '#0c121a',
    metalness: 0.35,
    roughness: 0.5,
  }),
  red: new T.MeshStandardMaterial({
    color: '#f05745',
    emissive: '#ff3825',
    emissiveIntensity: 0.6,
    roughness: 0.4,
  }),
  cyan: new T.MeshStandardMaterial({
    color: '#7ddae0',
    emissive: '#38bed8',
    emissiveIntensity: 0.8,
    roughness: 0.4,
  }),
  yellow: new T.MeshStandardMaterial({
    color: '#d1bd4f',
    metalness: 0.3,
    roughness: 0.6,
  }),
};
for (const [name, material] of Object.entries(materials)) material.name = name;
function mesh(
  parent: T.Object3D,
  geometry: T.BufferGeometry,
  material: T.Material,
  position: number[] = [0, 0, 0],
  name = '',
): T.Mesh {
  const object = new T.Mesh(geometry, material);
  object.position.set(position[0]!, position[1]!, position[2]!);
  object.name = name;
  parent.add(object);
  return object;
}
const geometryCache = new Map<string, T.BufferGeometry>();
function cached(key: string, create: () => T.BufferGeometry): T.BufferGeometry {
  let geometry = geometryCache.get(key);
  if (!geometry) {
    geometry = create();
    geometryCache.set(key, geometry);
  }
  return geometry;
}
function box(
  parent: T.Object3D,
  size: number[],
  position: number[],
  material: T.Material,
  radius = 0.06,
  name = '',
): T.Mesh {
  const bevel = Math.min(radius, Math.min(...size) / 3);
  return mesh(
    parent,
    cached(
      `box:${size.join(',')}:${bevel}`,
      () => new RoundedBoxGeometry(size[0]!, size[1]!, size[2]!, 2, bevel),
    ),
    material,
    position,
    name,
  );
}
function sphere(
  parent: T.Object3D,
  size: number[],
  position: number[],
  material: T.Material,
  name = '',
): T.Mesh {
  const object = mesh(
    parent,
    cached('sphere', () => new T.SphereGeometry(1, 28, 20)),
    material,
    position,
    name,
  );
  object.scale.set(size[0]!, size[1]!, size[2]!);
  return object;
}
function capsule(
  parent: T.Object3D,
  radius: number,
  length: number,
  position: number[],
  material: T.Material,
): T.Mesh {
  return mesh(
    parent,
    cached(
      `capsule:${radius}:${length}`,
      () => new T.CapsuleGeometry(radius, length, 8, 20),
    ),
    material,
    position,
  );
}

function facility(): T.Group {
  const root = new T.Group();
  root.name = 'training_facility';
  box(root, [22, 0.4, 28], [0, -0.2, 0], materials.metal);
  for (let x = -10; x <= 10; x += 2)
    for (let z = -12; z <= 12; z += 2) {
      box(
        root,
        [1.97, 0.025, 1.97],
        [x, 0.01, z],
        (x / 2 + z / 2) % 3 === 0 ? materials.concrete : materials.panel,
        0.01,
      );
    }
  for (const x of [-11, 11]) {
    box(root, [0.6, 7, 28], [x, 3.5, 0], materials.concrete);
    box(root, [0.12, 0.08, 25], [x * 0.96, 0.06, 0], materials.cyan, 0.02);
    for (let z = -10; z <= 10; z += 5) {
      box(root, [0.8, 6.7, 0.8], [x * 0.94, 3.35, z], materials.dark);
      box(root, [0.14, 3.5, 0.12], [x * 0.9, 2.6, z], materials.red, 0.025);
      box(root, [0.25, 0.8, 3.4], [x * 0.96, 2, z + 2.4], materials.metal);
      for (let i = 0; i < 7; i++)
        box(
          root,
          [0.27, 0.04, 0.3],
          [x * 0.94, 1.72 + i * 0.085, z + 2.4],
          materials.silver,
          0.01,
        );
    }
    const pipe = mesh(
      root,
      new T.CylinderGeometry(0.15, 0.15, 26, 24),
      materials.silver,
      [x * 0.9, 5.6, 0],
    );
    pipe.rotation.x = Math.PI / 2;
  }
  for (const z of [-14, 14]) {
    box(root, [22, 7, 0.6], [0, 3.5, z], materials.concrete);
    box(root, [5.4, 4.8, 0.3], [0, 2.4, z * 0.97], materials.dark);
    for (const x of [-2.6, 2.6])
      box(root, [0.07, 4.4, 0.08], [x, 2.3, z * 0.96], materials.cyan, 0.015);
    box(root, [5.2, 0.08, 0.08], [0, 4.5, z * 0.96], materials.red, 0.015);
    for (const x of [-7.6, 7.6]) {
      box(root, [3, 2.6, 0.28], [x, 2.3, z * 0.96], materials.metal);
      box(root, [2.5, 1.45, 0.05], [x, 2.6, z * 0.945], materials.dark);
      for (let i = 0; i < 5; i++)
        box(
          root,
          [1.6 - i * 0.15, 0.025, 0.055],
          [x - 0.2, 3 - i * 0.18, z * 0.94],
          materials.cyan,
          0.005,
        );
    }
  }
  for (const z of [-10, 0, 10]) {
    box(root, [22, 0.5, 0.7], [0, 6.6, z], materials.metal);
    for (const x of [-5, 5])
      box(root, [3.5, 0.08, 0.25], [x, 6.25, z], materials.cyan, 0.02);
  }
  // Simple authored props, kept at the room edges and paired with manifest colliders.
  for (const [x, z] of [
    [-7, 3],
    [7, -7],
  ]) {
    box(root, [2, 1.6, 2], [x!, 0.8, z!], materials.metal);
    box(root, [1.6, 0.08, 1.7], [x!, 1.65, z!], materials.silver);
    for (const side of [-1, 1])
      box(
        root,
        [0.08, 1.4, 2.05],
        [x! + side * 0.65, 0.8, z!],
        materials.yellow,
        0.01,
      );
  }
  // Paint stripes are geometry inside the exported art asset, not gameplay constructors.
  for (let z = -10; z <= 10; z += 2)
    for (const x of [-5, 5])
      box(root, [0.05, 0.018, 0.8], [x, 0.035, z], materials.yellow, 0.003);
  return root;
}

function character(): T.Group {
  const root = new T.Group();
  root.name = 'operator';
  const coat = new T.MeshStandardMaterial({
    color: '#555f6e',
    roughness: 0.6,
    metalness: 0.15,
  });
  const trim = new T.MeshStandardMaterial({
    color: '#d35c42',
    roughness: 0.45,
  });
  const fabric = new T.MeshStandardMaterial({
    color: '#18202c',
    roughness: 0.95,
  });
  const skin = new T.MeshStandardMaterial({ color: '#b98f78', roughness: 0.7 });
  const hair = new T.MeshStandardMaterial({ color: '#171b24', roughness: 0.8 });
  const white = new T.MeshStandardMaterial({
    color: '#e5ecee',
    roughness: 0.4,
  });
  const eye = new T.MeshStandardMaterial({ color: '#152c34', roughness: 0.3 });
  const pelvis = new T.Group();
  pelvis.name = 'pelvis';
  pelvis.position.y = 0.89;
  root.add(pelvis);
  sphere(pelvis, [0.22, 0.17, 0.15], [0, 0, 0], fabric);
  box(pelvis, [0.45, 0.07, 0.3], [0, 0.09, 0], materials.dark, 0.025);
  box(pelvis, [0.08, 0.06, 0.015], [0, 0.09, 0.16], materials.silver, 0.01);
  const torso = new T.Group();
  torso.name = 'torso';
  torso.position.y = 0.15;
  pelvis.add(torso);
  sphere(torso, [0.26, 0.34, 0.16], [0, 0.2, 0], coat);
  box(torso, [0.22, 0.42, 0.05], [0, 0.2, 0.15], fabric, 0.03);
  for (const side of [-1, 1]) {
    box(
      torso,
      [0.075, 0.37, 0.04],
      [side * 0.17, 0.24, 0.16],
      trim,
      0.02,
    ).rotation.z = side * 0.16;
    box(
      torso,
      [0.085, 0.11, 0.035],
      [side * 0.14, 0.17, -0.16],
      materials.silver,
      0.01,
    );
  }
  box(torso, [0.34, 0.18, 0.05], [0, 0.29, -0.18], materials.dark, 0.03);
  box(torso, [0.18, 0.025, 0.055], [0, 0.29, -0.21], materials.cyan, 0.005);
  capsule(torso, 0.075, 0.08, [0, 0.56, 0], skin);
  const head = new T.Group();
  head.name = 'head';
  head.position.set(0, 0.71, 0);
  torso.add(head);
  sphere(head, [0.155, 0.2, 0.155], [0, 0, 0], skin);
  sphere(head, [0.115, 0.085, 0.12], [0, -0.115, 0.03], skin);
  sphere(head, [0.158, 0.12, 0.16], [0, 0.135, -0.01], hair);
  for (let i = 0; i < 7; i++) {
    const strand = sphere(
      head,
      [0.047, 0.11, 0.03],
      [-0.115 + i * 0.035, 0.09, 0.13],
      hair,
    );
    strand.rotation.z = -0.3;
  }
  for (const side of [-1, 1]) {
    sphere(head, [0.03, 0.05, 0.035], [side * 0.16, -0.025, 0], skin);
    sphere(head, [0.043, 0.016, 0.018], [side * 0.062, 0.006, 0.14], white);
    sphere(head, [0.015, 0.015, 0.009], [side * 0.064, 0.006, 0.157], eye);
    box(
      head,
      [0.07, 0.013, 0.02],
      [side * 0.064, 0.044, 0.145],
      hair,
      0.006,
    ).rotation.z = side * 0.1;
  }
  sphere(head, [0.023, 0.037, 0.025], [0, -0.038, 0.157], skin);
  box(head, [0.055, 0.009, 0.012], [0, -0.095, 0.143], trim, 0.004);
  for (const side of [-1, 1]) {
    const arm = new T.Group();
    arm.name = side === -1 ? 'arm_left' : 'arm_right';
    arm.position.set(side * 0.31, 0.43, 0);
    torso.add(arm);
    capsule(arm, 0.092, 0.19, [0, -0.14, 0], coat);
    sphere(arm, [0.095, 0.06, 0.09], [0, -0.29, 0], materials.dark);
    const forearm = new T.Group();
    forearm.name = side === -1 ? 'forearm_left' : 'forearm_right';
    forearm.position.y = -0.29;
    arm.add(forearm);
    capsule(forearm, 0.073, 0.18, [0, -0.14, 0], fabric);
    box(
      forearm,
      [0.09, 0.19, 0.08],
      [0, -0.14, 0.055],
      materials.silver,
      0.028,
    );
    box(forearm, [0.04, 0.07, 0.085], [0, -0.1, 0.078], materials.cyan, 0.01);
    sphere(forearm, [0.072, 0.085, 0.05], [0, -0.31, 0.015], materials.dark);
    const leg = new T.Group();
    leg.name = side === -1 ? 'leg_left' : 'leg_right';
    leg.position.set(side * 0.13, -0.05, 0);
    pelvis.add(leg);
    capsule(leg, 0.105, 0.25, [0, -0.16, 0], fabric);
    box(leg, [0.11, 0.18, 0.065], [0, -0.23, 0.095], coat, 0.03);
    const shin = new T.Group();
    shin.name = side === -1 ? 'shin_left' : 'shin_right';
    shin.position.y = -0.38;
    leg.add(shin);
    capsule(shin, 0.075, 0.21, [0, -0.13, 0], fabric);
    box(shin, [0.13, 0.25, 0.095], [0, -0.13, 0.045], materials.dark, 0.04);
    box(shin, [0.035, 0.18, 0.1], [side * 0.055, -0.13, 0.05], trim, 0.012);
    box(shin, [0.17, 0.13, 0.3], [0, -0.32, 0.075], materials.dark, 0.05);
    box(shin, [0.18, 0.035, 0.31], [0, -0.38, 0.075], materials.silver, 0.013);
  }
  return root;
}

function target(): T.Group {
  const root = new T.Group();
  root.name = 'training_unit';
  mesh(
    root,
    new T.CylinderGeometry(0.7, 0.8, 0.15, 48),
    materials.metal,
    [0, 0.075, 0],
  );
  mesh(
    root,
    new T.CylinderGeometry(0.12, 0.22, 0.8, 32),
    materials.silver,
    [0, 0.5, 0],
  );
  sphere(root, [0.58, 0.72, 0.3], [0, 1.35, 0], materials.panel);
  box(root, [0.62, 0.72, 0.12], [0, 1.4, 0.29], materials.dark, 0.12);
  mesh(
    root,
    new T.TorusGeometry(0.23, 0.026, 12, 48),
    materials.red,
    [0, 1.4, 0.365],
  );
  sphere(root, [0.085, 0.085, 0.025], [0, 1.4, 0.375], materials.cyan);
  for (const side of [-1, 1]) {
    box(root, [0.25, 0.7, 0.22], [side * 0.53, 1.3, 0], materials.metal, 0.1);
    box(
      root,
      [0.12, 0.4, 0.24],
      [side * 0.53, 1.3, 0.08],
      materials.silver,
      0.04,
    );
  }
  return root;
}

function instanceRepeatedMeshes(root: T.Group): void {
  root.updateMatrixWorld(true);
  const groups = new Map<string, T.Mesh[]>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return;
    const key = `${object.geometry.uuid}:${object.material.uuid}`;
    const group = groups.get(key) ?? [];
    group.push(object);
    groups.set(key, group);
  });
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const first = group[0]!;
    const batch = new T.InstancedMesh(
      first.geometry,
      first.material,
      group.length,
    );
    batch.name = 'authored_instances';
    group.forEach((object, index) => {
      batch.setMatrixAt(index, object.matrixWorld);
      object.removeFromParent();
    });
    root.add(batch);
  }
}

await mkdir('public/assets/models', { recursive: true });
const exporter = new GLTFExporter();
const room = facility();
instanceRepeatedMeshes(room);
for (const [name, object] of [
  ['training-room', room],
  ['operator', character()],
  ['training-unit', target()],
] as const) {
  const result = await exporter.parseAsync(object, {
    binary: true,
    trs: true,
    copyright:
      'Original TANGER project asset. Authored by the project asset-generation script.',
  });
  if (!(result instanceof ArrayBuffer)) throw new Error('Expected binary GLB');
  await writeFile(`public/assets/models/${name}.glb`, Buffer.from(result));
  console.log(
    `Built ${name}.glb (${Math.round(result.byteLength / 1024)} KiB)`,
  );
}
