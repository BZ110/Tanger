import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import {
  characterSchema,
  createManifest,
} from '../../tools/art/character-schema';
import { decodeGlb } from '../../tools/art/glb';
import { inspectGlb } from '../../tools/art/inspect-glb';
import { existingProjectPath, projectPath } from '../../tools/art/paths';

async function fixture() {
  const bytes = await readFile('tests/fixtures/art-pipeline.glb');
  const manifest = characterSchema.parse(
    JSON.parse(await readFile('tests/fixtures/art-character.json', 'utf8')),
  );
  return { bytes, manifest };
}

test('a new character is an explicit draft without art approval', () => {
  const manifest = createManifest('first-character');
  expect(manifest.stage).toBe('draft');
  expect(manifest.review.verdict).toBe('pending');
  expect(manifest.source).toBe(
    'art/characters/first-character/source/first-character.blend',
  );
  expect(() => createManifest('../outside')).toThrow();
});

test('manifest rejects unknown fields, escaped paths and uncredited licensed input', () => {
  const manifest = createManifest('test-character');
  expect(
    characterSchema.safeParse({ ...manifest, mystery: true }).success,
  ).toBe(false);
  expect(
    characterSchema.safeParse({ ...manifest, source: '../outside.blend' })
      .success,
  ).toBe(false);
  expect(
    characterSchema.safeParse({
      ...manifest,
      provenance: [{ ...manifest.provenance[0], kind: 'licensed' }],
    }).success,
  ).toBe(false);
  expect(
    characterSchema.safeParse({
      ...manifest,
      rig: { ...manifest.rig, expressions: ['blink', 'blink'] },
    }).success,
  ).toBe(false);
  expect(
    characterSchema.safeParse({
      ...manifest,
      review: { ...manifest.review, evidence: ['notes.txt'] },
    }).success,
  ).toBe(false);
  expect(
    characterSchema.safeParse({
      ...manifest,
      review: { ...manifest.review, evidence: ['front.png', 'front.png'] },
    }).success,
  ).toBe(false);
});

test('actual Blender export preserves skin, named morph and both animation clips', async () => {
  const { bytes, manifest } = await fixture();
  const result = await inspectGlb(bytes, manifest);
  expect(result.ok, result.errors.join('\n')).toBe(true);
  expect(result.stats).toMatchObject({
    skins: 1,
    joints: 2,
    triangles: 36,
    textureEdge: 64,
    clips: ['idle', 'test-bend'],
    expressions: ['test-squash'],
  });
});

test('a valid file cannot satisfy a missing declared rig or exceeded delivery budget', async () => {
  const { bytes, manifest } = await fixture();
  manifest.rig.requiredJoints.push('missing-hand');
  manifest.rig.clips.attack = 'missing-attack';
  manifest.rig.expressions.push('missing-blink');
  manifest.deliveryBudgets.triangles = 20;
  const result = await inspectGlb(bytes, manifest);
  expect(result.ok).toBe(false);
  expect(result.errors.join('\n')).toMatch(/missing-hand/);
  expect(result.errors.join('\n')).toMatch(/missing-attack/);
  expect(result.errors.join('\n')).toMatch(/missing-blink/);
  expect(result.errors.join('\n')).toMatch(/triangles/);
});

test('GLB decoding rejects truncated and forged lengths before import', async () => {
  const { bytes } = await fixture();
  expect(() => decodeGlb(bytes.subarray(0, bytes.length - 4))).toThrow();
  const corrupt = new Uint8Array(bytes);
  new DataView(corrupt.buffer).setUint32(12, 0xffffffff, true);
  expect(() => decodeGlb(corrupt)).toThrow();
  expect(() => decodeGlb(new Uint8Array(8))).toThrow();
});

test('project asset reads cannot escape through a relative path', async () => {
  expect(() => projectPath(resolve('.'), '../escape.glb')).toThrow();
  expect(
    await existingProjectPath(resolve('.'), 'tests/fixtures/art-pipeline.glb'),
  ).toBe(resolve('tests/fixtures/art-pipeline.glb'));
});
