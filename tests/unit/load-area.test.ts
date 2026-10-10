import { expect, test, vi } from 'vitest';
import { loadArea } from '../../src/application/load-area';
import { emptyDocument } from '../fixtures/area';

test('loads and validates a supplied document without activating content', async () => {
  const document = emptyDocument();
  const read = vi.fn(async () => JSON.stringify(document));
  expect(await loadArea({ read }, 'test.area.json')).toEqual({
    ok: true,
    area: document,
  });
  expect(read).toHaveBeenCalledWith('test.area.json', undefined);
  expect(
    await loadArea({ read: async () => '{}' }, 'invalid.area.json'),
  ).toMatchObject({ ok: false });
});

test('handles unavailable sources and cancellation', async () => {
  expect(
    await loadArea(
      {
        read: async () => {
          throw new Error('Missing');
        },
      },
      'missing.area.json',
    ),
  ).toMatchObject({ ok: false });
  const controller = new AbortController();
  controller.abort();
  const read = vi.fn(async () => JSON.stringify(emptyDocument()));
  const result = await loadArea({ read }, 'test.area.json', controller.signal);
  expect(result).toEqual({
    ok: false,
    issues: [{ path: '$', message: 'Area loading cancelled' }],
  });
  expect(read).not.toHaveBeenCalled();
});

test('a source completing after cancellation does not return an area', async () => {
  const controller = new AbortController();
  expect(
    await loadArea(
      {
        read: async () => {
          controller.abort();
          return JSON.stringify(emptyDocument());
        },
      },
      'test.area.json',
      controller.signal,
    ),
  ).toMatchObject({ ok: false });
});
