import { expect, test } from 'vitest';
import { ChunkStream } from '../../src/world/chunk-stream';

test('residency stays bounded across travel and regenerates unloaded chunks identically', () => {
  const world = new ChunkStream({ chunkSize: 32, radius: 2, seed: 74021 });
  world.update(0, 0);
  const original = world.chunks.get('0,0');
  expect(world.chunks.size).toBe(25);
  for (let i = 0; i < 50; i++) {
    world.update(i * 32, -i * 32);
    expect(world.chunks.size).toBe(25);
  }
  expect(world.chunks.has('0,0')).toBe(false);
  world.update(0, 0);
  expect(world.chunks.get('0,0')).toEqual(original);
});

test('negative coordinates cross chunk boundaries correctly', () => {
  const world = new ChunkStream({ chunkSize: 32, radius: 0, seed: 74021 });
  world.update(-0.01, -32.01);
  expect([...world.chunks.keys()]).toEqual(['-1,-2']);
  world.update(-32, -32);
  expect([...world.chunks.keys()]).toEqual(['-1,-1']);
});
