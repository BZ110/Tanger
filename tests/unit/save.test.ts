import { expect, test } from 'vitest';
import {
  decodeSave,
  LocalSave,
  SAVE_KEY,
} from '../../src/adapters/storage/local-save';

test('round-trips a versioned save and clears it', () => {
  const data = new Map<string, string>();
  const saves = new LocalSave({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  });
  const game = { seed: 74021, player: { x: -4.3, z: 27.5 } };
  expect(saves.save(game)).toEqual({ ok: true });
  expect(JSON.parse(data.get(SAVE_KEY)!).version).toBe(1);
  expect(saves.load()).toEqual(game);
  saves.clear();
  expect(saves.load()).toBeUndefined();
});

test.each([
  'not json',
  'null',
  '[]',
  '{}',
  '{"version":2,"game":{"seed":1,"player":{"x":0,"z":0}}}',
  '{"version":1,"game":{"seed":1,"player":{"x":"0","z":0}}}',
  '{"version":1,"game":{"seed":1,"player":{"x":1e999,"z":0}}}',
  '{"version":1,"game":{"seed":1,"player":{"x":1000001,"z":0}}}',
  '{"version":1,"game":{"seed":1.2,"player":{"x":0,"z":0}}}',
])('rejects malformed or incompatible save: %s', (value) => {
  expect(decodeSave(value)).toBeUndefined();
});

test('storage denial and quota errors remain recoverable', () => {
  const deny = () => {
    throw new Error('Denied');
  };
  const saves = new LocalSave({
    getItem: deny,
    setItem: deny,
    removeItem: deny,
  });
  expect(saves.load()).toBeUndefined();
  expect(saves.save({ seed: 1, player: { x: 0, z: 0 } }).ok).toBe(false);
  expect(saves.clear().ok).toBe(false);
});
