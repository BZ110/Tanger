import type { SavePort, SaveResult } from '../../application/ports';
import type { SavedGame } from '../../game/simulation';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
interface SaveEnvelope {
  version: 1;
  game: SavedGame;
}
export const SAVE_KEY = 'tanger.save';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Treat saves as untrusted data; future versions get explicit migrations here. */
export function decodeSave(serialized: string): SavedGame | undefined {
  try {
    const value: unknown = JSON.parse(serialized);
    if (!isRecord(value) || value.version !== 1 || !isRecord(value.game))
      return;
    const game = value.game;
    if (!Number.isSafeInteger(game.seed) || !isRecord(game.player)) return;
    const { x, z } = game.player;
    if (
      typeof x !== 'number' ||
      typeof z !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(z)
    )
      return;
    // Limit corrupted coordinates before they reach GPU transforms/chunk IDs.
    if (Math.abs(x) > 1_000_000 || Math.abs(z) > 1_000_000) return;
    return { seed: game.seed as number, player: { x, z } };
  } catch {
    return;
  }
}

export class LocalSave implements SavePort {
  constructor(private readonly storage: KeyValueStorage) {}

  load(): SavedGame | undefined {
    try {
      const value = this.storage.getItem(SAVE_KEY);
      return value ? decodeSave(value) : undefined;
    } catch {
      return;
    }
  }

  save(game: SavedGame): SaveResult {
    try {
      const envelope: SaveEnvelope = { version: 1, game };
      this.storage.setItem(SAVE_KEY, JSON.stringify(envelope));
      return { ok: true };
    } catch {
      return {
        ok: false,
        reason: 'Saving is unavailable in this browser session.',
      };
    }
  }

  clear(): SaveResult {
    try {
      this.storage.removeItem(SAVE_KEY);
      return { ok: true };
    } catch {
      return {
        ok: false,
        reason: 'Could not remove the previous save from this device.',
      };
    }
  }
}
