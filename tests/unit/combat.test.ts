import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseAreaJson } from '../../src/world/parse-area';
import { GameSimulation } from '../../src/game/simulation';
import type { PlayerCommand } from '../../src/game/simulation';
import { CollisionWorld } from '../../src/game/collision';
import { emptyDocument } from '../fixtures/area';

const idle: PlayerCommand = {
  moveX: 0,
  moveZ: 0,
  yaw: 0,
  attack: false,
  dash: false,
  sprint: false,
};
function simulation(): GameSimulation {
  const parsed = parseAreaJson(
    readFileSync('public/areas/tutorial.area.json', 'utf8'),
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return new GameSimulation(parsed.area);
}
function tick(game: GameSimulation, frames: number, command = idle): void {
  for (let i = 0; i < frames; i++) game.update(command, 1 / 60);
}
function combatReady(): GameSimulation {
  const game = simulation();
  for (let i = 0; i < 120 && game.snapshot().tutorial.step === 0; i++)
    tick(game, 1, { ...idle, moveZ: -1 });
  expect(game.snapshot().tutorial.step).toBe(1);
  for (let i = 0; i < 120 && game.position.z > -2; i++)
    tick(game, 1, { ...idle, moveZ: -1 });
  tick(game, 20);
  return game;
}

test('attacks miss at range, and each attack lands at most one hit', () => {
  const far = simulation();
  tick(far, 1, { ...idle, attack: true });
  tick(far, 90);
  expect(far.snapshot().target.hits).toBe(0);
  const near = combatReady();
  tick(near, 1, { ...idle, attack: true });
  tick(near, 90);
  expect(near.snapshot().target.hits).toBe(1);
  expect(near.snapshot().tutorial.progress).toBe(1);
});

test('hit stop freezes the attack pose, slows recovery, and returns to normal', () => {
  const game = combatReady();
  tick(game, 1, { ...idle, attack: true });
  for (let i = 0; i < 60 && game.snapshot().target.hits === 0; i++)
    tick(game, 1);
  const pose = game.snapshot().player.attackProgress;
  tick(game, 1);
  expect(game.snapshot().timeScale).toBe(0);
  expect(game.snapshot().player.attackProgress).toBe(pose);
  tick(game, 4);
  expect(game.snapshot().timeScale).toBeLessThan(1);
  tick(game, 60);
  expect(game.snapshot().timeScale).toBe(1);
});

test('dash input stays responsive during hit stop and obeys cooldown', () => {
  const game = combatReady();
  tick(game, 1, { ...idle, attack: true });
  for (let i = 0; i < 60 && game.snapshot().target.hits === 0; i++)
    tick(game, 1);
  const before = game.position.x;
  tick(game, 1, { ...idle, moveX: 1, dash: true });
  expect(game.position.x).toBeGreaterThan(before);
  const first = game.snapshot().dashReady;
  tick(game, 1, { ...idle, dash: true });
  expect(game.snapshot().dashReady).toBeGreaterThan(first);
  expect(
    game.takeEvents().filter((event) => event.kind === 'dash'),
  ).toHaveLength(1);
});

test('turning off slowdown preserves normal simulation timing', () => {
  const game = combatReady();
  game.setImpactSlowdown(false);
  tick(game, 1, { ...idle, attack: true });
  tick(game, 18);
  expect(game.snapshot().target.hits).toBe(1);
  expect(game.snapshot().timeScale).toBe(1);
});

test('all dry tutorial steps can be completed using movement, attacks, and a timed dash', () => {
  const game = combatReady();
  for (let i = 0; i < 3; i++) {
    tick(game, 1, { ...idle, attack: true });
    tick(game, 60);
  }
  expect(game.snapshot().tutorial.step).toBe(2);
  for (let i = 0; i < 3; i++) {
    tick(game, 1, { ...idle, dash: true });
    tick(game, 45);
  }
  expect(game.snapshot().tutorial.step).toBe(3);
  for (let i = 0; i < 300; i++) {
    const windup = game.snapshot().target.windup;
    tick(game, 1, { ...idle, dash: windup > 0 && windup < 0.2 });
    if (game.snapshot().tutorial.step === 4) break;
  }
  expect(game.snapshot().tutorial.step).toBe(4);
  tick(game, 20);
  for (let i = 0; i < 5; i++) {
    tick(game, 1, { ...idle, attack: true });
    tick(game, 60);
  }
  expect(game.snapshot().tutorial.step).toBe(5);
  game.reset();
  expect(game.snapshot().tutorial.step).toBe(0);
  expect(game.snapshot().target.hits).toBe(0);
  expect(game.snapshot().player.health).toBe(100);
});

test('a high-speed move cannot tunnel through a thin wall and slides along it', () => {
  const area = emptyDocument();
  area.sectors.push({
    id: 'wall-sector',
    bounds: { min: [-10, -1, -10], max: [10, 3, 10] },
    instances: [],
    anchors: [],
    colliders: [
      {
        id: 'thin-wall',
        position: [0, 1, 0],
        rotation: [0, 0, 0, 1],
        shape: { kind: 'box', halfExtents: [0.05, 1, 6] },
      },
    ],
  });
  const world = new CollisionWorld(area);
  const position = { x: -2, y: 0, z: 0 };
  world.move(position, 5, 3, 0.36);
  expect(position.x).toBeLessThanOrEqual(-0.41 + 0.00001);
  expect(position.z).toBeCloseTo(3);
});
