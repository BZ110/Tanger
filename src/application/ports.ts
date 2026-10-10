import type {
  GameSnapshot,
  PlayerCommand,
  CombatEvent,
} from '../game/simulation';
import type { GameSettings } from '../content/settings';

export interface InputPort {
  sample(): PlayerCommand;
  clear(): void;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}
export interface ViewportPort {
  render(snapshot: GameSnapshot, command: PlayerCommand, dt: number): void;
  applySettings(settings: GameSettings): void;
  effect(event: CombatEvent): void;
  dispose(): void;
}
export interface AudioPort {
  effect(event: CombatEvent): void;
  setVolume(volume: number): void;
  dispose(): void;
}

/** An area source supplies text; parsing remains a platform-independent concern. */
export interface AreaSourcePort {
  read(path: string, signal?: AbortSignal): Promise<string>;
}
