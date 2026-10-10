import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { ViewportPort } from '../../application/ports';

/** Empty viewport. No terrain, models, lights, or test floor are created. */
export class ThreeRenderer implements ViewportPort {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera();
  private readonly resizeObserver: ResizeObserver;
  private readonly events = new AbortController();
  private contextLost = false;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new Color('#15171b');
    const options = { signal: this.events.signal };
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        this.contextLost = true;
        delete canvas.dataset.ready;
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
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  private resize(): void {
    if (this.disposed || this.contextLost) return;
    const { width, height } = this.canvas.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  render(): void {
    if (this.disposed || this.contextLost) return;
    this.renderer.render(this.scene, this.camera);
    this.canvas.dataset.ready = 'true';
    this.canvas.dataset.sceneObjects = String(this.scene.children.length);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.events.abort();
    this.resizeObserver.disconnect();
    this.scene.clear();
    this.renderer.dispose();
  }
}
