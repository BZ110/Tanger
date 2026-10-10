import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { decodeGlb } from '../glb';
import './style.css';

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing ${id}`);
  return value as T;
}
const viewport = element<HTMLDivElement>('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
viewport.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000);
camera.position.set(0, 1, 5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.9, 0);
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room).texture;
scene.environment = environment;
room.dispose();
pmrem.dispose();
const hemisphere = new THREE.HemisphereLight(0xc9d5e3, 0x384047, 1.5);
const key = new THREE.DirectionalLight(0xffe8d6, 3.2);
const fill = new THREE.DirectionalLight(0xbad3ee, 1.2);
const rim = new THREE.DirectionalLight(0xdfedff, 2.5);
fill.position.set(-3, 2, 2);
rim.position.set(2, 3, -3);
scene.add(hemisphere, key, fill, rim);
const grid = new THREE.GridHelper(10, 40, 0x50616d, 0x34424e);
grid.material.transparent = true;
grid.material.opacity = 0.3;
scene.add(grid);
const gradient = new THREE.DataTexture(
  new Uint8Array([60, 125, 190, 255]),
  4,
  1,
  THREE.RedFormat,
);
gradient.magFilter = gradient.minFilter = THREE.NearestFilter;
gradient.needsUpdate = true;
const loader = new GLTFLoader();
let model: THREE.Group | undefined;
let mixer: THREE.AnimationMixer | undefined;
let action: THREE.AnimationAction | undefined;
let clips: THREE.AnimationClip[] = [];
let skeleton: THREE.SkeletonHelper | undefined;
let bounds = new THREE.Box3(
  new THREE.Vector3(-0.5, 0, -0.5),
  new THREE.Vector3(0.5, 1.8, 0.5),
);
let playing = false;
let generation = 0;
let view = 'front';
let assetName = 'character';
const authored = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
const overrides: THREE.Material[] = [];
const morphBindings = new Map<string, { mesh: THREE.Mesh; index: number }[]>();
const shading = element<HTMLSelectElement>('shading');
const lighting = element<HTMLSelectElement>('lighting');
const wireframe = element<HTMLInputElement>('wireframe');
const clip = element<HTMLSelectElement>('clip');
const time = element<HTMLInputElement>('time');
const speed = element<HTMLSelectElement>('speed');

function status(message: string) {
  element('status').textContent = message;
}
function disposeModel(group: THREE.Group) {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const geometries = new Set<THREE.BufferGeometry>();
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      geometries.add(obj.geometry);
      for (const material of [obj.material].flat()) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  materials.forEach((item) => item.dispose());
  textures.forEach((item) => item.dispose());
  geometries.forEach((item) => item.dispose());
}
function clearModel() {
  if (model) {
    mixer?.stopAllAction();
    mixer?.uncacheRoot(model);
    for (const [mesh, material] of authored) mesh.material = material;
    scene.remove(model);
    disposeModel(model);
  }
  skeleton?.removeFromParent();
  skeleton?.dispose();
  overrides.splice(0).forEach((material) => material.dispose());
  authored.clear();
  morphBindings.clear();
  model = undefined;
  mixer = undefined;
  action = undefined;
  skeleton = undefined;
}

function setMaterials() {
  overrides.splice(0).forEach((material) => material.dispose());
  for (const [mesh, original] of authored) {
    const materials = [original].flat().map((source) => {
      const standard = source as THREE.MeshStandardMaterial;
      if (shading.value === 'original') {
        if ('wireframe' in source)
          (source as THREE.MeshStandardMaterial).wireframe = wireframe.checked;
        return source;
      }
      const parameters = {
        color:
          shading.value === 'clay'
            ? 0xc2c6cd
            : (standard.color ?? new THREE.Color(0xffffff)),
        side: source.side,
        wireframe: wireframe.checked,
      };
      const material =
        shading.value === 'clay'
          ? new THREE.MeshStandardMaterial({ ...parameters, roughness: 0.75 })
          : new THREE.MeshToonMaterial({
              ...parameters,
              map: standard.map ?? null,
              gradientMap: gradient,
              transparent: source.transparent,
              opacity: source.opacity,
              alphaTest: source.alphaTest,
            });
      overrides.push(material);
      return material;
    });
    mesh.material = Array.isArray(original) ? materials : materials[0]!;
  }
  renderer.toneMapping =
    shading.value === 'toon'
      ? THREE.NoToneMapping
      : THREE.ACESFilmicToneMapping;
}

function setLighting() {
  const angle =
    (Number(element<HTMLInputElement>('light-angle').value) * Math.PI) / 180;
  key.position.set(Math.sin(angle) * 4, 3, Math.cos(angle) * 4);
  element('light-value').textContent =
    `${Math.round((angle * 180) / Math.PI)}°`;
  const night = lighting.value === 'night';
  key.color.set(
    night ? 0xff7196 : lighting.value === 'daylight' ? 0xfff5e2 : 0xffe8d6,
  );
  fill.color.set(night ? 0x39d9ed : 0xbad3ee);
  hemisphere.intensity = night ? 0.45 : 1.5;
  scene.environmentIntensity = night ? 0.15 : 0.55;
  element('stage-mode').textContent =
    lighting.options[lighting.selectedIndex]!.text.toUpperCase();
}

function setView(next: string) {
  view = next;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const face = next === 'face';
  const head = model?.getObjectByName('head');
  if (face && head) head.getWorldPosition(center);
  else if (face) center.y = bounds.min.y + size.y * 0.91;
  const angle =
    next === 'quarter'
      ? Math.PI / 4
      : next === 'profile'
        ? Math.PI / 2
        : next === 'back'
          ? Math.PI
          : 0;
  const distance = face
    ? size.y * 0.72
    : (Math.max(size.y, size.x / camera.aspect) /
        (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) *
      1.35;
  controls.target.copy(center);
  camera.position
    .copy(center)
    .add(
      new THREE.Vector3(
        Math.sin(angle) * distance,
        0,
        Math.cos(angle) * distance,
      ),
    );
  camera.lookAt(center);
  controls.update();
  document
    .querySelectorAll<HTMLButtonElement>('[data-view]')
    .forEach((button) =>
      button.classList.toggle('selected', button.dataset.view === next),
    );
}

function setPlaying(value: boolean) {
  playing = value;
  element('play').textContent = value ? 'Ⅱ Pause' : '▶ Play';
}
function selectClip() {
  mixer?.stopAllAction();
  action = undefined;
  const selected = clips.find((item) => item.name === clip.value);
  if (selected && mixer) {
    action = mixer.clipAction(selected);
    action.play();
    time.max = String(selected.duration);
  } else {
    model?.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh) obj.pose();
    });
    time.max = '1';
  }
  time.value = '0';
  mixer?.update(0);
  setPlaying(false);
}
function scrub() {
  setPlaying(false);
  if (action && mixer) {
    action.time = Number(time.value);
    mixer.update(0);
  }
  element('time-value').textContent = `${Number(time.value).toFixed(2)} s`;
}

async function load(bytes: ArrayBuffer, name: string) {
  const current = ++generation;
  status('Loading model…');
  document.body.dataset.ready = 'false';
  try {
    const { document: doc } = decodeGlb(new Uint8Array(bytes));
    if (
      [...(doc.buffers ?? []), ...(doc.images ?? [])].some((item) => item.uri)
    )
      throw new Error('Use a self-contained GLB with embedded resources.');
    if (
      (doc.extensionsRequired ?? []).some((value) =>
        [
          'KHR_draco_mesh_compression',
          'EXT_meshopt_compression',
          'KHR_texture_basisu',
        ].includes(value),
      )
    )
      throw new Error(
        'This preview needs an uncompressed GLB (decoder setup is a separate runtime step).',
      );
    const gltf = await loader.parseAsync(bytes, '');
    if (current !== generation) {
      disposeModel(gltf.scene);
      return;
    }
    clearModel();
    model = gltf.scene;
    clips = gltf.animations;
    assetName = name.replace(/\.glb$/i, '');
    scene.add(model);
    model.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(model);
    if (bounds.isEmpty())
      throw new Error('Model contains no visible geometry.');
    grid.position.y = bounds.min.y - 0.003;
    const size = bounds.getSize(new THREE.Vector3()).y;
    grid.scale.setScalar(Math.max(size, 0.1));
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      authored.set(object, object.material);
      for (const [name, index] of Object.entries(
        object.morphTargetDictionary ?? {},
      )) {
        const bindings = morphBindings.get(name) ?? [];
        bindings.push({ mesh: object, index });
        morphBindings.set(name, bindings);
      }
    });
    mixer = new THREE.AnimationMixer(model);
    skeleton = new THREE.SkeletonHelper(model);
    skeleton.visible = element<HTMLInputElement>('skeleton').checked;
    scene.add(skeleton);
    clip.replaceChildren(
      new Option('Bind pose', ''),
      ...clips.map((item) => new Option(item.name, item.name)),
    );
    element('morphs').replaceChildren();
    for (const [name, bindings] of morphBindings) {
      const label = document.createElement('label');
      label.textContent = name;
      const value = document.createElement('output');
      value.textContent = '0.00';
      label.append(value);
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '1';
      slider.step = '0.01';
      slider.value = '0';
      slider.setAttribute('aria-label', `Expression ${name}`);
      slider.addEventListener('input', () => {
        for (const binding of bindings)
          if (binding.mesh.morphTargetInfluences)
            binding.mesh.morphTargetInfluences[binding.index] = Number(
              slider.value,
            );
        value.textContent = Number(slider.value).toFixed(2);
      });
      element('morphs').append(label, slider);
    }
    if (!morphBindings.size)
      element('morphs').textContent = 'No exported morph targets.';
    const triangles = (doc.meshes ?? []).reduce(
      (total, mesh) =>
        total +
        mesh.primitives.reduce(
          (sum, primitive) =>
            sum +
            (doc.accessors?.[
              primitive.indices ?? primitive.attributes.POSITION ?? -1
            ]?.count ?? 0) /
              3,
          0,
        ),
      0,
    );
    const values = [
      triangles.toLocaleString(),
      String(doc.materials?.length ?? 0),
      String(new Set((doc.skins ?? []).flatMap((skin) => skin.joints)).size),
      String(clips.length),
    ];
    element('stats')
      .querySelectorAll('dd')
      .forEach((item, i) => {
        item.textContent = values[i]!;
      });
    element('asset-name').textContent = assetName;
    element('material-list').textContent =
      `MATERIALS / ${(doc.materials ?? []).map((item) => item.name ?? 'unnamed').join(', ')}`;
    element('empty').style.display = 'none';
    setMaterials();
    setView(view);
    selectClip();
    status(
      `${name} · ${(bytes.byteLength / 1048576).toFixed(2)} MiB · local preview`,
    );
    document.body.dataset.ready = 'true';
  } catch (error) {
    if (current === generation) {
      status(error instanceof Error ? error.message : 'Unable to load model');
      document.body.dataset.ready = 'error';
    }
  }
}

const file = element<HTMLInputElement>('file');
element('open-file').onclick = element('empty-open').onclick = () =>
  file.click();
file.onchange = async () => {
  const selected = file.files?.[0];
  if (selected) await load(await selected.arrayBuffer(), selected.name);
  file.value = '';
};
document.addEventListener('dragover', (event) => {
  event.preventDefault();
  document.body.dataset.drag = 'true';
});
document.addEventListener('dragleave', (event) => {
  if (!event.relatedTarget) delete document.body.dataset.drag;
});
document.addEventListener('drop', async (event) => {
  event.preventDefault();
  delete document.body.dataset.drag;
  const selected = event.dataTransfer?.files[0];
  if (selected) await load(await selected.arrayBuffer(), selected.name);
});
document
  .querySelectorAll<HTMLButtonElement>('[data-view]')
  .forEach((button) => {
    button.onclick = () => setView(button.dataset.view!);
  });
shading.onchange = wireframe.onchange = setMaterials;
lighting.onchange = element<HTMLInputElement>('light-angle').oninput =
  setLighting;
element<HTMLInputElement>('skeleton').onchange = () => {
  if (skeleton)
    skeleton.visible = element<HTMLInputElement>('skeleton').checked;
};
clip.onchange = selectClip;
time.oninput = scrub;
element('play').onclick = () => {
  if (action) setPlaying(!playing);
};
element('reset-morphs').onclick = () => {
  element('morphs')
    .querySelectorAll('input')
    .forEach((slider) => {
      slider.value = '0';
      slider.dispatchEvent(new Event('input'));
    });
};
element('capture').onclick = () => {
  renderer.render(scene, camera);
  const link = document.createElement('a');
  link.download = `${assetName}-${view}-${shading.value}-${lighting.value}.png`;
  link.href = renderer.domElement.toDataURL('image/png');
  link.click();
};
function resize() {
  const { width, height } = viewport.getBoundingClientRect();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
const observer = new ResizeObserver(resize);
observer.observe(viewport);
setLighting();
resize();
setView('front');
let previous = performance.now();
renderer.setAnimationLoop((now) => {
  const delta = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  if (playing && action && mixer) {
    mixer.update(delta * Number(speed.value));
    time.value = String(action.time);
    element('time-value').textContent = `${action.time.toFixed(2)} s`;
  }
  controls.update();
  renderer.render(scene, camera);
});
const asset = new URLSearchParams(location.search).get('asset');
if (asset) {
  const url = new URL(asset, location.origin);
  if (url.origin !== location.origin || !url.pathname.endsWith('.glb'))
    status('Asset URLs must be same-origin .glb files.');
  else {
    try {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Asset request failed (${response.status})`);
      await load(
        await response.arrayBuffer(),
        decodeURIComponent(url.pathname.split('/').pop()!),
      );
    } catch (error) {
      status(error instanceof Error ? error.message : 'Asset request failed');
      document.body.dataset.ready = 'error';
    }
  }
}
window.addEventListener('pagehide', () => {
  ++generation;
  renderer.setAnimationLoop(null);
  observer.disconnect();
  controls.dispose();
  clearModel();
  environment.dispose();
  gradient.dispose();
  grid.geometry.dispose();
  grid.material.dispose();
  renderer.dispose();
});
