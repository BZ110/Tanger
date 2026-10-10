import { describe, expect, test } from 'vitest';
import { gameConfig } from '../../src/content/game-config';
import { FixedStep } from '../../src/core/fixed-step';
import { GameSimulation } from '../../src/game/simulation';
import { terrainHeight } from '../../src/world/terrain';

const forward = { moveX: 0, moveZ: -1, sprint: false, cameraYaw: 0 };

describe('movement and simulation clock', () => {
  test('30 Hz and 144 Hz render schedules produce equivalent 60 Hz movement', () => {
    const run = (fps: number) => {
      const simulation = new GameSimulation(gameConfig);
      const clock = new FixedStep();
      for (let frame = 0; frame < fps * 5; frame++)
        clock.advance(1 / fps, (dt) => simulation.update(forward, dt));
      return simulation.save();
    };
    expect(run(30).player.z).toBeCloseTo(run(144).player.z, 8);
    expect(run(30).player.z).toBeCloseTo(
      gameConfig.player.spawn.z - gameConfig.player.walkSpeed * 5,
      8,
    );
  });

  test('diagonal movement has the same speed and follows terrain', () => {
    const straight = new GameSimulation(gameConfig);
    const diagonal = new GameSimulation(gameConfig);
    straight.update(forward, 1);
    diagonal.update({ ...forward, moveX: 1 }, 1);
    expect(
      Math.hypot(diagonal.player.position.x, diagonal.player.position.z - 8),
    ).toBeCloseTo(4);
    expect(straight.player.position.z).toBe(4);
    const { x, y, z } = diagonal.player.position;
    expect(y).toBe(terrainHeight(x, z, gameConfig.world.seed));
  });

  test('camera orientation changes movement direction', () => {
    const simulation = new GameSimulation(gameConfig);
    simulation.update({ ...forward, cameraYaw: Math.PI / 2 }, 1);
    expect(simulation.player.position.x).toBeCloseTo(-4);
    expect(simulation.player.position.z).toBeCloseTo(8);
  });

  test('limits long frame catch-up and discards paused time', () => {
    const clock = new FixedStep();
    let elapsed = 0;
    const alpha = clock.advance(60, (dt) => {
      elapsed += dt;
    });
    expect(elapsed).toBeCloseTo(8 / 60);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
    clock.reset();
    expect(
      clock.advance(0, () => {
        throw new Error('Unexpected tick');
      }),
    ).toBe(0);
  });

  test('restores compatible saves and resets interpolation/state', () => {
    const simulation = new GameSimulation(gameConfig, {
      seed: gameConfig.world.seed,
      player: { x: -90, z: 130 },
    });
    expect(simulation.player.position.x).toBe(-90);
    expect(simulation.snapshot(0).player.position).toEqual(
      simulation.snapshot(1).player.position,
    );
    simulation.reset();
    expect(simulation.save().player).toEqual(gameConfig.player.spawn);
    expect(simulation.snapshot(0).player.position).toEqual(
      simulation.snapshot(1).player.position,
    );
    const incompatible = new GameSimulation(gameConfig, {
      seed: -1,
      player: { x: -90, z: 130 },
    });
    expect(incompatible.save().player).toEqual(gameConfig.player.spawn);
  });
});
