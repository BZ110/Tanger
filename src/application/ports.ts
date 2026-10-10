import type { PlayerCommand } from '../game/player';
import type { GameSnapshot, SavedGame } from '../game/simulation';

export interface InputPort {
  sample(): PlayerCommand;
  clear(): void;
  dispose(): void;
}
export interface RendererPort {
  render(snapshot: GameSnapshot, command: PlayerCommand, dt: number): void;
  dispose(): void;
}
export type SaveResult = { ok: true } | { ok: false; reason: string };
export interface SavePort {
  load(): SavedGame | undefined;
  save(game: SavedGame): SaveResult;
  clear(): SaveResult;
}
export interface HudPort {
  update(snapshot: GameSnapshot, paused: boolean): void;
  notify(message: string): void;
  dispose(): void;
}
