import { FixedStep } from '../core/fixed-step';
import type { GameSimulation } from '../game/simulation';
import type { InputPort, RendererPort, SavePort, HudPort } from './ports';

/** Composition and lifecycle. No concrete adapter is imported here. */
export class GameApp {
  private readonly clock = new FixedStep();
  private lastTime: number | undefined;
  private paused = false;
  private autosaveSeconds = 0;
  private disposed = false;

  constructor(
    readonly simulation: GameSimulation,
    private readonly input: InputPort,
    private readonly renderer: RendererPort,
    private readonly saves: SavePort,
    private readonly hud: HudPort,
  ) {}

  frame(timeMs: number): void {
    if (this.disposed) return;
    const dt =
      this.lastTime === undefined
        ? 0
        : Math.max(0, (timeMs - this.lastTime) / 1000);
    this.lastTime = timeMs;
    const command = this.input.sample();
    const alpha = this.paused
      ? 1
      : this.clock.advance(dt, (step) => {
          this.simulation.update(command, step);
          this.autosaveSeconds += step;
        });
    const snapshot = this.simulation.snapshot(alpha);
    this.renderer.render(snapshot, command, Math.min(dt, 0.1));
    this.hud.update(snapshot, this.paused);
    if (this.autosaveSeconds >= 30) {
      this.save(false);
      this.autosaveSeconds = 0;
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.lastTime = undefined;
    this.clock.reset();
    this.input.clear();
  }

  togglePause(): void {
    this.setPaused(!this.paused);
  }

  save(announce = true): void {
    const result = this.saves.save(this.simulation.save());
    if (!result.ok) this.hud.notify(result.reason);
    else if (announce) this.hud.notify('Journey saved on this device.');
  }

  reset(): void {
    const result = this.saves.clear();
    this.simulation.reset();
    this.clock.reset();
    this.input.clear();
    this.autosaveSeconds = 0;
    this.hud.notify(result.ok ? 'Back at the beginning.' : result.reason);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.input.dispose();
    this.renderer.dispose();
    this.hud.dispose();
  }
}
