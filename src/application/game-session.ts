import { FixedStep } from '../core/fixed-step';
import type { GameSimulation, GameSnapshot } from '../game/simulation';
import type { InputPort, ViewportPort, AudioPort } from './ports';
import type { GameSettings } from '../content/settings';

export class GameSession {
  private readonly clock = new FixedStep();
  private previousTime: number | undefined;
  private paused = false;
  private pendingAttack = false;
  private pendingDash = false;

  constructor(
    readonly simulation: GameSimulation,
    private readonly input: InputPort,
    private readonly viewport: ViewportPort,
    private readonly audio: AudioPort,
  ) {}

  frame(time: number): GameSnapshot {
    const realDt =
      this.previousTime === undefined
        ? 0
        : Math.max(0, (time - this.previousTime) / 1000);
    this.previousTime = time;
    const command = this.input.sample();
    this.pendingAttack ||= command.attack;
    this.pendingDash ||= command.dash;
    const alpha = this.paused
      ? 1
      : this.clock.advance(realDt, (dt) => {
          this.simulation.update(
            { ...command, attack: this.pendingAttack, dash: this.pendingDash },
            dt,
          );
          this.pendingAttack = this.pendingDash = false;
        });
    const snapshot = this.simulation.snapshot(alpha);
    for (const event of this.simulation.takeEvents()) {
      this.viewport.effect(event);
      this.audio.effect(event);
    }
    this.viewport.render(snapshot, command, Math.min(realDt, 0.1));
    return snapshot;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.previousTime = undefined;
    this.clock.reset();
    this.pendingAttack = this.pendingDash = false;
    this.input.setEnabled(!paused);
    this.input.clear();
  }
  applySettings(settings: GameSettings): void {
    this.viewport.applySettings(settings);
    this.audio.setVolume(settings.volume);
    this.simulation.setImpactSlowdown(settings.impactSlowdown);
  }
  restart(): void {
    this.simulation.reset();
    this.previousTime = undefined;
    this.clock.reset();
    this.pendingAttack = this.pendingDash = false;
    this.input.clear();
  }
}
