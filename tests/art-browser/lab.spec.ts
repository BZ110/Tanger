import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('lab loads a Blender skin, scrubs animation and edits expressions without errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/tools/art/lab/');
  await expect(
    page.getByRole('heading', { name: 'No model loaded' }),
  ).toBeVisible();
  await page
    .locator('#file')
    .setInputFiles(resolve('tests/fixtures/art-pipeline.glb'));
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#stats')).toContainText('36');
  await expect(page.locator('#clip option')).toHaveText([
    'Bind pose',
    'idle',
    'test-bend',
  ]);
  const bind = await page.locator('canvas').screenshot();
  await page.locator('#clip').selectOption('test-bend');
  await page.locator('#time').fill('0.5');
  await page.locator('#time').dispatchEvent('input');
  await expect(page.locator('#time-value')).toHaveText('0.50 s');
  const bent = await page.locator('canvas').screenshot();
  expect(bent.equals(bind)).toBe(false);
  await page.getByRole('slider', { name: 'Expression test-squash' }).fill('1');
  await page
    .getByRole('slider', { name: 'Expression test-squash' })
    .dispatchEvent('input');
  const morphed = await page.locator('canvas').screenshot();
  expect(morphed.equals(bent)).toBe(false);
  await page.locator('#shading').selectOption('toon');
  await page.locator('#skeleton').check();
  await page.locator('#wireframe').check();
  await page.locator('[data-view="quarter"]').click();
  await page.screenshot({ path: 'test-results/character-lab.png' });
  await page.locator('#shading').selectOption('original');
  await page.locator('#wireframe').uncheck();
  await page.locator('#skeleton').uncheck();
  await page.locator('#clip').selectOption('');
  await page.getByRole('button', { name: 'Reset expressions' }).click();
  await page.locator('[data-view="front"]').click();
  await expect(
    page.getByRole('slider', { name: 'Expression test-squash' }),
  ).toHaveValue('0');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Capture PNG' }).click();
  expect((await download).suggestedFilename()).toMatch(
    /art-pipeline-front-original-neutral\.png/,
  );
  await page
    .locator('#file')
    .setInputFiles(resolve('tests/fixtures/art-pipeline.glb'));
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  expect(errors).toEqual([]);
});

test('lab reports malformed files and recovers with a valid model', async ({
  page,
}) => {
  await page.goto('/tools/art/lab/');
  await page.locator('#file').setInputFiles({
    name: 'broken.glb',
    mimeType: 'model/gltf-binary',
    buffer: Buffer.from('broken'),
  });
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'error');
  await expect(page.locator('#status')).toContainText('Expected a complete');
  await page
    .locator('#file')
    .setInputFiles(resolve('tests/fixtures/art-pipeline.glb'));
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
});
