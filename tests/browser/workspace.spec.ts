import { expect, test } from '@playwright/test';

test('opens an empty viewport without reading or writing saves', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const deny = () => {
      throw new Error('Storage must not be accessed');
    };
    Storage.prototype.getItem = deny;
    Storage.prototype.setItem = deny;
    Storage.prototype.removeItem = deny;
  });
  await page.goto('/');
  const viewport = page.locator('canvas');
  await expect(viewport).toHaveAttribute('data-ready', 'true');
  await expect(viewport).toHaveAttribute('data-scene-objects', '0');
  await expect(page.getByText('No area loaded.')).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByText('The Amber Reach', { exact: false })).toHaveCount(
    0,
  );
  await page.keyboard.press('KeyW');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(viewport).toHaveAttribute('data-scene-objects', '0');
  await page.screenshot({ path: 'test-results/empty-workspace.png' });
  expect(errors).toEqual([]);
});

test('empty viewport resizes to mobile without loading an area', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toHaveAttribute(
    'data-scene-objects',
    '0',
  );
  expect(
    await page.locator('canvas').evaluate((canvas) => {
      const { width, height } = canvas.getBoundingClientRect();
      return width === innerWidth && height === innerHeight;
    }),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
