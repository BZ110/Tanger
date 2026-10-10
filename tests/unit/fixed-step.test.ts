import { expect, test } from 'vitest';
import { FixedStep } from '../../src/core/fixed-step';

test('simulation timing remains independent of render frequency', () => {
  const run = (fps: number) => {
    const clock = new FixedStep();
    let elapsed = 0;
    for (let frame = 0; frame < fps * 5; frame++)
      clock.advance(1 / fps, (dt) => {
        elapsed += dt;
      });
    return elapsed;
  };
  expect(run(30)).toBeCloseTo(5, 8);
  expect(run(144)).toBeCloseTo(run(30), 8);
});

test('bounds long frame catch-up and resets accumulated time', () => {
  const clock = new FixedStep();
  let elapsed = 0;
  expect(
    clock.advance(60, (dt) => {
      elapsed += dt;
    }),
  ).toBeLessThan(1);
  expect(elapsed).toBeCloseTo(8 / 60);
  clock.reset();
  expect(
    clock.advance(0, () => {
      throw new Error('Unexpected tick');
    }),
  ).toBe(0);
});
