import type { HudPort } from '../../application/ports';
import type { GameSnapshot } from '../../game/simulation';

export interface HudActions {
  save(): void;
  reset(): void;
  pause(): void;
}

function requireElement<T extends Element>(
  root: HTMLElement,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}

export class BrowserHud implements HudPort {
  readonly canvas: HTMLCanvasElement;
  readonly touchControls: HTMLElement;
  private readonly coordinates: HTMLElement;
  private readonly chunkCount: HTMLElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly pauseOverlay: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly compass: HTMLElement;
  private readonly events = new AbortController();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastCoordinates = '';
  private lastPaused: boolean | undefined;

  constructor(
    private readonly root: HTMLElement,
    actions: HudActions,
  ) {
    root.innerHTML = `
      <canvas class="world" tabindex="0" aria-label="Tanger game world. Use WASD or arrow keys to move, Shift to run, and drag to orbit the camera."></canvas>
      <div class="vignette" aria-hidden="true"></div>
      <header class="masthead">
        <div class="brand"><span class="brand-mark" aria-hidden="true">✧</span><div><h1>TANGER</h1><p>A WORLD WAITING TO BE WANDERED</p></div></div>
        <div class="chapter"><span class="status-dot"></span> EARLY WORLD <span class="chapter-number">/ 001</span></div>
      </header>
      <aside class="location"><span class="eyebrow">THE FIRST STEPS</span><h2>The Amber<br>Reach<span>.</span></h2><p>Past the old gate, the world opens.<br>Take your time. Find your own way.</p><div class="location-rule"></div><span class="location-tag">◇ &nbsp; UNCHARTED COUNTRY</span></aside>
      <div class="compass" aria-label="Camera compass"><span>W</span><span class="compass-north">N</span><span>E</span><i></i></div>
      <div class="pause-overlay" hidden><span class="eyebrow">TAKE A BREATH</span><h2>Journey paused.</h2><p>Press Escape or Resume to continue.</p></div>
      <nav class="actions" aria-label="Journey actions"><button type="button" data-action="save"><span aria-hidden="true">↓</span> Save journey</button><button type="button" data-action="pause"><span aria-hidden="true">Ⅱ</span> Pause</button><button type="button" data-action="reset" title="Return to the starting point and clear this device’s save">Return to start</button></nav>
      <div class="touch-controls" aria-label="Touch movement controls"><button type="button" data-key="KeyW" aria-label="Move forward">↑</button><div><button type="button" data-key="KeyA" aria-label="Move left">←</button><button type="button" data-key="KeyS" aria-label="Move backward">↓</button><button type="button" data-key="KeyD" aria-label="Move right">→</button></div></div>
      <footer class="travel-bar"><div class="traveler"><span class="traveler-icon" aria-hidden="true">⟡</span><div><span class="eyebrow">THE WANDERER</span><strong>Your journey begins here</strong></div></div><div class="controls"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span><span><kbd>SHIFT</kbd> Run</span><span><span class="mouse-icon" aria-hidden="true"></span> Drag to look</span><span><kbd>ESC</kbd> Pause</span></div><div class="world-meta"><span data-coordinates>0 / 8</span><small><span data-chunks>25</span> REGIONS NEARBY</small></div></footer>
      <div class="toast" role="status" aria-live="polite" hidden></div>
    `;
    this.canvas = requireElement(root, 'canvas');
    this.touchControls = requireElement(root, '.touch-controls');
    this.coordinates = requireElement(root, '[data-coordinates]');
    this.chunkCount = requireElement(root, '[data-chunks]');
    this.pauseButton = requireElement(root, '[data-action="pause"]');
    this.pauseOverlay = requireElement(root, '.pause-overlay');
    this.toast = requireElement(root, '.toast');
    this.compass = requireElement(root, '.compass');
    const options = { signal: this.events.signal };
    requireElement(root, '[data-action="save"]').addEventListener(
      'click',
      () => {
        actions.save();
        this.canvas.focus();
      },
      options,
    );
    requireElement(root, '[data-action="reset"]').addEventListener(
      'click',
      () => {
        actions.reset();
        this.canvas.focus();
      },
      options,
    );
    this.pauseButton.addEventListener(
      'click',
      () => {
        actions.pause();
        this.canvas.focus();
      },
      options,
    );
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.code === 'Escape' && !event.repeat) {
          actions.pause();
          this.canvas.focus();
        }
      },
      options,
    );
  }

  update(snapshot: GameSnapshot, paused: boolean): void {
    const position = snapshot.player.position;
    const coordinates = `${Math.round(position.x)} / ${Math.round(position.z)}`;
    if (coordinates !== this.lastCoordinates) {
      this.coordinates.textContent = coordinates;
      this.lastCoordinates = coordinates;
    }
    this.chunkCount.textContent = String(snapshot.chunks.size);
    if (this.lastPaused !== paused) {
      this.pauseOverlay.hidden = !paused;
      this.pauseButton.innerHTML = paused
        ? '<span aria-hidden="true">▷</span> Resume'
        : '<span aria-hidden="true">Ⅱ</span> Pause';
      this.lastPaused = paused;
    }
  }

  setCompass(yaw: number): void {
    this.compass.style.setProperty('--bearing', `${yaw}rad`);
  }

  notify(message: string): void {
    clearTimeout(this.timer);
    this.toast.textContent = message;
    this.toast.hidden = false;
    this.timer = setTimeout(() => {
      this.toast.hidden = true;
    }, 4000);
  }

  dispose(): void {
    this.events.abort();
    clearTimeout(this.timer);
    this.root.replaceChildren();
  }
}
