import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { ViewportPort } from '../../application/ports';
import type {
  GameSnapshot,
  PlayerCommand,
  CombatEvent,
} from '../../game/simulation';
import type { GameSettings } from '../../content/settings';
import { defaultSettings } from '../../content/settings';
import type { AreaDefinition } from '../../world/area-schema';
import { AssetLibrary } from './asset-library';
import { OperatorView } from './operator-view';
import { EffectsView } from './effects-view';

export class ThreeRenderer implements ViewportPort {
  private readonly renderer: T.WebGLRenderer;
  private readonly scene = new T.Scene();
  private readonly camera = new T.PerspectiveCamera(52, 1, 0.1, 80);
  private readonly assets: AssetLibrary;
  private readonly resizeObserver: ResizeObserver;
  private readonly events = new AbortController();
  private readonly world = new T.Group();
  private readonly effects = new EffectsView();
  private readonly light = new T.DirectionalLight('#d4e5ff', 2.3);
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly environment: T.WebGLRenderTarget;
  private operator: OperatorView | undefined;
  private target: T.Object3D | undefined;
  private targetMaterials: {
    material: T.MeshStandardMaterial;
    color: T.Color;
    emissive: T.Color;
    intensity: number;
  }[] = [];
  private settings = { ...defaultSettings };
  private cameraReady = false;
  private shake = 0;
  private disposed = false;
  private contextLost = false;
  private readonly desired = new T.Vector3();
  private readonly look = new T.Vector3();
  private cameraBounds = {
    minX: -Infinity,
    maxX: Infinity,
    minZ: -Infinity,
    maxZ: Infinity,
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    base: URL,
    onContextLost: () => void,
  ) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.scene.background = new T.Color('#0c121c');
    this.scene.fog = new T.Fog('#121b2a', 22, 55);
    const generator = new T.PMREMGenerator(this.renderer);
    const environmentScene = new RoomEnvironment();
    this.environment = generator.fromScene(environmentScene, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.45;
    environmentScene.dispose();
    generator.dispose();
    this.assets = new AssetLibrary(base);
    this.scene.add(new T.HemisphereLight('#b9d6ee', '#1c1720', 0.7));
    this.light.position.set(2, 8, 8);
    this.light.castShadow = true;
    this.light.shadow.camera.left = this.light.shadow.camera.bottom = -16;
    this.light.shadow.camera.right = this.light.shadow.camera.top = 16;
    this.light.shadow.camera.far = 40;
    this.light.shadow.normalBias = 0.025;
    this.scene.add(
      this.light,
      this.light.target,
      this.world,
      this.effects.root,
    );
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new T.Vector2(1, 1), 0.25, 0.45, 1.1);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    const options = { signal: this.events.signal };
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        this.contextLost = true;
        delete canvas.dataset.ready;
        onContextLost();
      },
      options,
    );
    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        this.contextLost = false;
        this.resize();
      },
      options,
    );
    this.applySettings(this.settings);
  }

  async load(
    area: AreaDefinition,
    signal: AbortSignal,
    progress: (value: number, label: string) => void,
  ): Promise<void> {
    await this.assets.load(area, signal, progress);
    if (signal.aborted) throw new Error('Loading cancelled');
    if (!this.operator) {
      if (!area.sectors.length)
        throw new Error('The tutorial needs at least one sector');
      const minX = Math.min(
        ...area.sectors.map((sector) => sector.bounds.min[0]),
      );
      const maxX = Math.max(
        ...area.sectors.map((sector) => sector.bounds.max[0]),
      );
      const minZ = Math.min(
        ...area.sectors.map((sector) => sector.bounds.min[2]),
      );
      const maxZ = Math.max(
        ...area.sectors.map((sector) => sector.bounds.max[2]),
      );
      this.cameraBounds = {
        minX: minX + 1.7,
        maxX: maxX - 1.7,
        minZ: minZ + 1.8,
        maxZ: maxZ - 1.8,
      };
      const centerX = (minX + maxX) / 2,
        centerZ = (minZ + maxZ) / 2;
      for (const [x, z, color] of [
        [minX * 0.67, centerZ - 7, '#ea533f'],
        [maxX * 0.67, centerZ + 4, '#58bbdd'],
        [centerX, minZ * 0.67, '#ea533f'],
      ] as const) {
        const light = new T.PointLight(color, 25, 18, 2);
        light.position.set(x, 3, z);
        this.scene.add(light);
      }
      for (const sector of area.sectors)
        for (const instance of sector.instances) {
          const object = this.assets.instantiate(instance.asset);
          object.position.fromArray(instance.transform.position);
          object.quaternion.fromArray(instance.transform.rotation);
          object.scale.fromArray(instance.transform.scale);
          this.world.add(object);
        }
      this.operator = new OperatorView(this.assets.instantiate('operator'));
      this.world.add(this.operator.root);
      this.target = this.assets.instantiate('training-unit');
      this.world.add(this.target);
      this.target.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;
        const source = Array.isArray(object.material)
          ? object.material
          : [object.material];
        const materials = source.map((material) => material.clone());
        object.material = Array.isArray(object.material)
          ? materials
          : materials[0]!;
        for (const material of materials)
          if (material instanceof T.MeshStandardMaterial)
            this.targetMaterials.push({
              material,
              color: material.color.clone(),
              emissive: material.emissive.clone(),
              intensity: material.emissiveIntensity,
            });
      });
      this.world.traverse((object) => {
        if (object instanceof T.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
    }
    this.cameraReady = false;
    progress(1, 'Preparing scene…');
    // compileAsync needs a useful initial camera before Play becomes active.
    this.camera.position.set(0, 5, 12);
    this.camera.lookAt(0, 1, 0);
    await this.renderer.compileAsync(this.scene, this.camera);
  }

  private resize(): void {
    if (this.disposed || this.contextLost) return;
    const { width, height } = this.canvas.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  applySettings(settings: GameSettings): void {
    const qualityChanged = this.settings.quality !== settings.quality;
    this.settings = { ...settings };
    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        settings.quality === 'high'
          ? 2
          : settings.quality === 'medium'
            ? 1.25
            : 1,
      ),
    );
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.renderer.shadowMap.enabled = settings.quality !== 'low';
    this.light.shadow.mapSize.setScalar(
      settings.quality === 'high' ? 2048 : 1024,
    );
    if (qualityChanged && this.light.shadow.map) {
      this.light.shadow.map.dispose();
      this.light.shadow.map = null;
      this.light.shadow.needsUpdate = true;
    }
    this.bloom.enabled = settings.quality !== 'low';
    this.resize();
  }
  effect(event: CombatEvent): void {
    if (event.kind === 'hit') {
      this.effects.hit();
      this.shake = 0.15;
    }
    if (event.kind === 'damage') this.shake = 0.22;
  }
  render(snapshot: GameSnapshot, command: PlayerCommand, dt: number): void {
    if (this.disposed || this.contextLost || !this.operator || !this.target)
      return;
    this.operator.update(snapshot);
    this.effects.update(snapshot, dt);
    this.target.position.set(
      snapshot.target.position.x,
      snapshot.target.position.y,
      snapshot.target.position.z,
    );
    this.target.rotation.y = Math.atan2(
      snapshot.player.position.x - snapshot.target.position.x,
      snapshot.player.position.z - snapshot.target.position.z,
    );
    for (const entry of this.targetMaterials) {
      entry.material.color
        .copy(entry.color)
        .lerp(new T.Color('#fff0d5'), snapshot.target.flash * 0.8);
      entry.material.emissive.copy(entry.emissive);
      entry.material.emissiveIntensity = entry.intensity;
      if (snapshot.target.windup > 0) {
        entry.material.emissive.set('#ed3e2e');
        entry.material.emissiveIntensity = (1 - snapshot.target.windup) * 0.7;
      }
    }
    const { x, y, z } = snapshot.player.position;
    this.desired.set(
      x + Math.sin(command.yaw) * 6.3,
      y + 4.2,
      z + Math.cos(command.yaw) * 6.3,
    );
    // Keep the orbit camera inside the authored room walls.
    this.desired.x = Math.max(
      this.cameraBounds.minX,
      Math.min(this.cameraBounds.maxX, this.desired.x),
    );
    this.desired.z = Math.max(
      this.cameraBounds.minZ,
      Math.min(this.cameraBounds.maxZ, this.desired.z),
    );
    if (!this.cameraReady) {
      this.camera.position.copy(this.desired);
      this.cameraReady = true;
    } else this.camera.position.lerp(this.desired, 1 - Math.exp(-10 * dt));
    this.look.set(
      x - Math.sin(command.yaw) * 1.2,
      y + 1.2,
      z - Math.cos(command.yaw) * 1.2,
    );
    this.shake = Math.max(0, this.shake - dt);
    if (this.settings.cameraShake) {
      this.look.x += Math.sin(snapshot.elapsed * 92) * this.shake * 0.18;
      this.look.y += Math.cos(snapshot.elapsed * 79) * this.shake * 0.15;
    }
    this.camera.lookAt(this.look);
    this.composer.render(dt);
    this.canvas.dataset.ready = 'true';
  }
  resetCamera(): void {
    this.cameraReady = false;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.events.abort();
    this.resizeObserver.disconnect();
    this.assets.dispose([this.world, this.effects.root]);
    this.environment.dispose();
    for (const pass of this.composer.passes) pass.dispose();
    this.composer.dispose();
    this.light.dispose();
    this.scene.clear();
    this.renderer.dispose();
  }
}
