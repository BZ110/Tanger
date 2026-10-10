import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { GameSession } from '../../src/application/game-session';
import { GameSimulation } from '../../src/game/simulation';
import type {
  InputPort,
  ViewportPort,
  AudioPort,
} from '../../src/application/ports';
import { parseAreaJson } from '../../src/world/parse-area';

test('an input edge survives a render frame without a simulation tick, and pause discards elapsed wall time', () => {
  const area = parseAreaJson(
    readFileSync('public/areas/tutorial.area.json', 'utf8'),
  );
  if (!area.ok) throw new Error('Invalid tutorial');
  const game = new GameSimulation(area.area);
  let dash = true;
  const input: InputPort = {
    sample: () => {
      const command = {
        moveX: 1,
        moveZ: 0,
        yaw: 0,
        attack: false,
        dash,
        sprint: false,
      };
      dash = false;
      return command;
    },
    clear: vi.fn(),
    setEnabled: vi.fn(),
    dispose: vi.fn(),
  };
  const viewport: ViewportPort = {
    render: vi.fn(),
    effect: vi.fn(),
    applySettings: vi.fn(),
    dispose: vi.fn(),
  };
  const audio: AudioPort = {
    effect: vi.fn(),
    setVolume: vi.fn(),
    dispose: vi.fn(),
  };
  const session = new GameSession(game, input, viewport, audio);
  session.frame(0);
  session.frame(5);
  expect(game.position.x).toBe(0);
  session.frame(20);
  expect(game.position.x).toBeGreaterThan(0);
  expect(viewport.effect).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'dash' }),
  );
  const x = game.position.x;
  session.setPaused(true);
  session.frame(100000);
  expect(game.position.x).toBe(x);
  session.setPaused(false);
  session.frame(200000);
  expect(game.position.x).toBe(x);
});
