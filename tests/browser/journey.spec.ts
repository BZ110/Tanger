import { expect, test } from '@playwright/test';

test('renders, moves, saves, pauses, reloads, and resets a journey', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-chunks]')).toHaveText('25');
  await page.screenshot({ path: 'test-results/tanger-desktop.png' });
  await canvas.focus();
  await page.keyboard.down('KeyW');
  await expect
    .poll(async () =>
      Number(
        (await page.locator('[data-coordinates]').innerText()).split('/')[1],
      ),
    )
    .toBeLessThan(6);
  await page.keyboard.up('KeyW');
  await page.getByRole('button', { name: 'Save journey' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Journey saved on this device.',
  );
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('tanger.save')!).game.player,
  );
  expect(saved.z).toBeLessThan(6);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByText('Journey paused.')).toBeVisible();
  const pausedPosition = await page.locator('[data-coordinates]').innerText();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyW');
  await expect(page.locator('[data-coordinates]')).toHaveText(pausedPosition);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByText('Journey paused.')).toBeHidden();
  await page.reload();
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-coordinates]')).toHaveText(
    `0 / ${Math.round(saved.z)}`,
  );
  await page.getByRole('button', { name: 'Return to start' }).click();
  await expect(page.locator('[data-coordinates]')).toHaveText('0 / 8');
  expect(
    await page.evaluate(() => localStorage.getItem('tanger.save')),
  ).toBeNull();
  expect(errors).toEqual([]);
});

test('mobile layout exposes touch controls without page overflow', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-ready', 'true');
  const forward = page.getByRole('button', { name: 'Move forward' });
  await expect(forward).toBeVisible();
  const bounds = await forward.boundingBox();
  if (!bounds) throw new Error('Missing movement button');
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await expect
    .poll(async () =>
      Number(
        (await page.locator('[data-coordinates]').innerText()).split('/')[1],
      ),
    )
    .toBeLessThan(7);
  await page.mouse.up();
  await page.screenshot({ path: 'test-results/tanger-mobile.png' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
