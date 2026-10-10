import type { InputPort } from '../../application/ports';
import type { PlayerCommand } from '../../game/simulation';

const movement = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
]);
export class BrowserInput implements InputPort {
  private readonly keys = new Set<string>();
  private readonly events = new AbortController();
  private enabled = false;
  private attack = false;
  private dash = false;
  private yaw = 0;
  private sensitivity = 1;
  private pointer: number | undefined;
  private lastX = 0;
  private touches = new Map<number, string>();

  constructor(canvas: HTMLCanvasElement, touchControls: HTMLElement) {
    const options = { signal: this.events.signal };
    window.addEventListener(
      'keydown',
      (event) => {
        if (
          !this.enabled ||
          (event.target instanceof HTMLElement &&
            ['INPUT', 'SELECT', 'BUTTON'].includes(event.target.tagName))
        )
          return;
        if (movement.has(event.code)) {
          event.preventDefault();
          this.keys.add(event.code);
        }
        if (!event.repeat && ['KeyJ', 'Space', 'KeyK'].includes(event.code)) {
          event.preventDefault();
          if (event.code === 'KeyJ') this.attack = true;
          else this.dash = true;
        }
      },
      options,
    );
    window.addEventListener(
      'keyup',
      (event) => this.keys.delete(event.code),
      options,
    );
    window.addEventListener('blur', () => this.clear(), options);
    canvas.addEventListener(
      'contextmenu',
      (event) => event.preventDefault(),
      options,
    );
    canvas.addEventListener(
      'pointerdown',
      (event) => {
        if (!this.enabled) return;
        canvas.focus();
        if (event.button === 0 && event.pointerType !== 'touch')
          this.attack = true;
        if (event.button === 2 || event.pointerType === 'touch') {
          this.pointer = event.pointerId;
          this.lastX = event.clientX;
          canvas.setPointerCapture(event.pointerId);
        }
      },
      options,
    );
    canvas.addEventListener(
      'pointermove',
      (event) => {
        if (this.pointer !== event.pointerId || !this.enabled) return;
        this.yaw -= (event.clientX - this.lastX) * 0.005 * this.sensitivity;
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
    touchControls.addEventListener(
      'pointerdown',
      (event) => {
        if (!this.enabled) return;
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
          '[data-input]',
        );
        const action = button?.dataset.input;
        if (!button || !action) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        canvas.focus();
        if (action === 'attack') this.attack = true;
        else if (action === 'dash') this.dash = true;
        else {
          this.keys.add(action);
          this.touches.set(event.pointerId, action);
        }
      },
      options,
    );
    const releaseTouch = (event: PointerEvent) => {
      const key = this.touches.get(event.pointerId);
      this.touches.delete(event.pointerId);
      if (key && ![...this.touches.values()].includes(key))
        this.keys.delete(key);
    };
    touchControls.addEventListener('pointerup', releaseTouch, options);
    touchControls.addEventListener('pointercancel', releaseTouch, options);
    touchControls.addEventListener('lostpointercapture', releaseTouch, options);
  }

  sample(): PlayerCommand {
    const pressed = (...codes: string[]) =>
      codes.some((code) => this.keys.has(code)) ? 1 : 0;
    const command = {
      moveX: pressed('KeyD', 'ArrowRight') - pressed('KeyA', 'ArrowLeft'),
      moveZ: pressed('KeyS', 'ArrowDown') - pressed('KeyW', 'ArrowUp'),
      yaw: this.yaw,
      attack: this.attack,
      dash: this.dash,
      sprint: Boolean(pressed('ShiftLeft', 'ShiftRight')),
    };
    this.attack = this.dash = false;
    return command;
  }
  setSensitivity(value: number): void {
    this.sensitivity = value;
  }
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }
  clear(): void {
    this.keys.clear();
    this.touches.clear();
    this.attack = this.dash = false;
    this.pointer = undefined;
  }
  resetCamera(): void {
    this.yaw = 0;
  }
  dispose(): void {
    this.events.abort();
    this.clear();
  }
}
