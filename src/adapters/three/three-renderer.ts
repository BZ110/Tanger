import * as THREE from 'three';
import type { RendererPort } from '../../application/ports';
import type { GameConfig } from '../../content/game-config';
import type { PlayerCommand } from '../../game/player';
import type { GameSnapshot } from '../../game/simulation';
import { terrainHeight } from '../../world/terrain';
import { TerrainView } from './terrain-view';
import { PlayerView } from './player-view';
import { createLandmark } from './landmark';

export class ThreeRenderer implements RendererPort {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 170);
  private readonly player = new PlayerView();
  private readonly terrain: TerrainView;
  private readonly resizeObserver: ResizeObserver;
  private readonly sunlight = new THREE.DirectionalLight('#fff1d0', 2.6);
  private readonly target = new THREE.Vector3();
  private readonly desiredCamera = new THREE.Vector3();
  private initialized = false;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly config: GameConfig,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene.background = new THREE.Color('#dfdfce');
    // Hide the residency boundary even when the camera is behind the player.
    const fogFar = Math.max(
      20,
      config.world.radius * config.world.chunkSize - 14,
    );
    this.scene.fog = new THREE.Fog('#dfdfce', fogFar * 0.6, fogFar);
    this.scene.add(new THREE.HemisphereLight('#eee8d8', '#656f4c', 2.3));
    this.sunlight.position.set(-20, 35, 12);
    this.sunlight.castShadow = true;
    this.sunlight.shadow.mapSize.set(1024, 1024);
    this.sunlight.shadow.camera.left = this.sunlight.shadow.camera.bottom = -26;
    this.sunlight.shadow.camera.right = this.sunlight.shadow.camera.top = 26;
    this.sunlight.shadow.camera.far = 100;
    this.sunlight.shadow.normalBias = 0.035;
    this.scene.add(
      this.sunlight,
      this.sunlight.target,
      this.player.root,
      createLandmark(config.world.seed),
    );
    this.terrain = new TerrainView(this.scene, config);
    this.resizeObserver = new ResizeObserver(() => this.resize(canvas));
    this.resizeObserver.observe(canvas);
    this.resize(canvas);
  }

  private resize(canvas: HTMLCanvasElement): void {
    const { width, height } = canvas.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(snapshot: GameSnapshot, command: PlayerCommand, dt: number): void {
    this.terrain.sync(snapshot.chunks);
    this.player.update(snapshot);
    const { x, y, z } = snapshot.player.position;
    const yaw = command.cameraYaw;
    this.target.set(x - Math.sin(yaw) * 2, y + 1.6, z - Math.cos(yaw) * 2);
    this.desiredCamera.set(
      x + Math.sin(yaw) * 13,
      y + 8.5,
      z + Math.cos(yaw) * 13,
    );
    this.desiredCamera.y = Math.max(
      this.desiredCamera.y,
      terrainHeight(
        this.desiredCamera.x,
        this.desiredCamera.z,
        this.config.world.seed,
      ) + 2,
    );
    if (!this.initialized) {
      this.camera.position.copy(this.desiredCamera);
      this.initialized = true;
    } else this.camera.position.lerp(this.desiredCamera, 1 - Math.exp(-8 * dt));
    this.camera.lookAt(this.target);
    this.sunlight.position.set(x - 20, y + 35, z + 12);
    this.sunlight.target.position.set(x, y, z);
    this.renderer.render(this.scene, this.camera);
    this.renderer.domElement.dataset.ready = 'true';
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.terrain.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material])
          materials.add(material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.sunlight.dispose();
    this.scene.clear();
    this.renderer.dispose();
  }
}
