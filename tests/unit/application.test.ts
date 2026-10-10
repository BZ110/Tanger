import { expect, test, vi } from 'vitest';
import { GameApp } from '../../src/application/game-app';
import type {
  InputPort,
  RendererPort,
  SavePort,
  HudPort,
} from '../../src/application/ports';
import { GameSimulation } from '../../src/game/simulation';
import { gameConfig } from '../../src/content/game-config';

function setup() {
  const simulation = new GameSimulation(gameConfig);
  const input: InputPort = {
    sample: () => ({ moveX: 0, moveZ: -1, sprint: false, cameraYaw: 0 }),
    clear: vi.fn(),
    dispose: vi.fn(),
  };
  const renderer: RendererPort = { render: vi.fn(), dispose: vi.fn() };
  const saves: SavePort = {
    load: () => undefined,
    save: vi.fn<SavePort['save']>(() => ({ ok: true })),
    clear: vi.fn<SavePort['clear']>(() => ({ ok: true })),
  };
  const hud: HudPort = { update: vi.fn(), notify: vi.fn(), dispose: vi.fn() };
  const app = new GameApp(simulation, input, renderer, saves, hud);
  return { app, simulation, input, renderer, saves, hud };
}

test('pausing and resuming do not catch up elapsed wall time', () => {
  const { app, simulation } = setup();
  app.frame(0);
  app.frame(1000 / 60);
  const before = simulation.save();
  app.setPaused(true);
  app.frame(100000);
  app.frame(200000);
  expect(simulation.save()).toEqual(before);
  app.setPaused(false);
  app.frame(300000);
  expect(simulation.save()).toEqual(before);
  app.frame(300000 + 1000 / 60);
  expect(simulation.save().player.z).toBeLessThan(before.player.z);
});

test('autosaving depends on simulated time and handles storage failure', () => {
  const { app, saves, hud } = setup();
  for (let frame = 0; frame <= 31 * 60; frame++) app.frame((frame * 1000) / 60);
  expect(saves.save).toHaveBeenCalledTimes(1);
  expect(hud.notify).not.toHaveBeenCalled();
  vi.mocked(saves.save).mockReturnValue({ ok: false, reason: 'Storage full' });
  app.save();
  expect(hud.notify).toHaveBeenCalledWith('Storage full');
});

test('disposal is idempotent and prevents further simulation/rendering', () => {
  const { app, simulation, input, renderer, hud } = setup();
  app.frame(0);
  const before = simulation.save();
  app.dispose();
  app.dispose();
  app.frame(1000);
  expect(simulation.save()).toEqual(before);
  expect(renderer.render).toHaveBeenCalledTimes(1);
  expect(input.dispose).toHaveBeenCalledTimes(1);
  expect(renderer.dispose).toHaveBeenCalledTimes(1);
  expect(hud.dispose).toHaveBeenCalledTimes(1);
});
