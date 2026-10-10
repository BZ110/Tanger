import type { InputPort } from '../../application/ports';
import type { PlayerCommand } from '../../game/player';

const movementKeys = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
]);

export class BrowserInput implements InputPort {
  private readonly keys = new Set<string>();
  private readonly events = new AbortController();
  private yaw = 0;
  private pointer: number | undefined;
  private lastX = 0;

  constructor(canvas: HTMLCanvasElement, touchControls: HTMLElement) {
    const options = { signal: this.events.signal };
    window.addEventListener(
      'keydown',
      (event) => {
        if (document.activeElement !== canvas || !movementKeys.has(event.code))
          return;
        event.preventDefault();
        this.keys.add(event.code);
      },
      options,
    );
    window.addEventListener(
      'keyup',
      (event) => this.keys.delete(event.code),
      options,
    );
    window.addEventListener('blur', () => this.clear(), options);
    canvas.addEventListener('blur', () => this.clear(), options);
    canvas.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button !== 0 || this.pointer !== undefined) return;
        canvas.focus();
        this.pointer = event.pointerId;
        this.lastX = event.clientX;
        canvas.setPointerCapture(event.pointerId);
      },
      options,
    );
    canvas.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerId !== this.pointer) return;
        this.yaw -= (event.clientX - this.lastX) * 0.006;
        this.lastX = event.clientX;
      },
      options,
    );
    const release = () => {
      this.pointer = undefined;
    };
    canvas.addEventListener('pointerup', release, options);
    canvas.addEventListener('pointercancel', release, options);
    canvas.addEventListener('lostpointercapture', release, options);
    const touches = new Map<number, string>();
    touchControls.addEventListener(
      'pointerdown',
      (event) => {
        const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
          '[data-key]',
        );
        const key = target?.dataset.key;
        if (!target || !key) return;
        event.preventDefault();
        canvas.focus();
        target.setPointerCapture(event.pointerId);
        touches.set(event.pointerId, key);
        this.keys.add(key);
      },
      options,
    );
    const releaseTouch = (event: PointerEvent) => {
      const key = touches.get(event.pointerId);
      touches.delete(event.pointerId);
      if (key && ![...touches.values()].includes(key)) this.keys.delete(key);
    };
    touchControls.addEventListener('pointerup', releaseTouch, options);
    touchControls.addEventListener('pointercancel', releaseTouch, options);
    touchControls.addEventListener('lostpointercapture', releaseTouch, options);
  }

  sample(): PlayerCommand {
    const pressed = (...codes: string[]) =>
      codes.some((code) => this.keys.has(code)) ? 1 : 0;
    return {
      moveX: pressed('KeyD', 'ArrowRight') - pressed('KeyA', 'ArrowLeft'),
      moveZ: pressed('KeyS', 'ArrowDown') - pressed('KeyW', 'ArrowUp'),
      sprint: Boolean(pressed('ShiftLeft', 'ShiftRight')),
      cameraYaw: this.yaw,
    };
  }

  clear(): void {
    this.keys.clear();
    this.pointer = undefined;
  }
  dispose(): void {
    this.events.abort();
    this.clear();
  }
}
