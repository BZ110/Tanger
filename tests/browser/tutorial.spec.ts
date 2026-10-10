import { expect, test } from '@playwright/test';

test('title, settings, controls, loading, gameplay, pause, and restart work without storage', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const deny = () => {
      throw new Error('Persistence must not be accessed');
    };
    Storage.prototype.getItem = deny;
    Storage.prototype.setItem = deny;
    Storage.prototype.removeItem = deny;
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'TANGER', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/title-screen.png' });
  await page.getByRole('button', { name: 'SETTINGS' }).click();
  await page.getByLabel('Graphics quality').selectOption('low');
  await page.getByLabel('Camera shake', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'CONTROLS' }).click();
  await expect(page.getByText('LEFT CLICK / J')).toBeVisible();
  await page.getByRole('button', { name: /^Back/ }).click();
  // Title/layout snapshots stay full size; gameplay CI uses a cheaper viewport.
  await page.setViewportSize({ width: 800, height: 600 });
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'playing', {
    timeout: 30000,
  });
  await expect(page.locator('canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByText('Movement', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/tutorial-spawn.png' });
  await page.keyboard.down('KeyW');
  await expect(page.locator('#app')).toHaveAttribute(
    'data-tutorial-step',
    '1',
    { timeout: 10000 },
  );
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyW');
  await expect
    .poll(
      async () =>
        Number(await page.locator('#app').getAttribute('data-player-z')),
      { timeout: 15000 },
    )
    .toBeLessThan(-2);
  await page.keyboard.up('KeyW');
  for (let hit = 1; hit <= 3; hit++) {
    await page.keyboard.press('KeyJ');
    await expect
      .poll(async () =>
        Number(await page.locator('#app').getAttribute('data-hits')),
      )
      .toBeGreaterThanOrEqual(hit);
    await expect
      .poll(
        async () =>
          Number(
            await page.locator('#app').getAttribute('data-attack-progress'),
          ),
        { timeout: 15000 },
      )
      .toBeLessThan(0);
  }
  await expect(page.locator('#app')).toHaveAttribute('data-tutorial-step', '2');
  await page.screenshot({ path: 'test-results/tutorial-combat.png' });
  for (let dash = 0; dash < 3; dash++) {
    await page.keyboard.press('Space');
    await expect
      .poll(
        async () =>
          Number(await page.locator('#app').getAttribute('data-dash-ready')),
        { timeout: 15000 },
      )
      .toBeLessThan(0.9);
    await expect
      .poll(
        async () =>
          Number(await page.locator('#app').getAttribute('data-dash-ready')),
        { timeout: 15000 },
      )
      .toBeGreaterThanOrEqual(0.99);
  }
  await expect(page.locator('#app')).toHaveAttribute('data-tutorial-step', '3');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Pause menu' })).toBeVisible();
  const position = await page.locator('#app').getAttribute('data-player-z');
  await page.keyboard.press('KeyW');
  await expect(page.locator('#app')).toHaveAttribute(
    'data-player-z',
    position!,
  );
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Graphics quality')).toHaveValue('low');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Restart tutorial' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-tutorial-step', '0');
  await expect
    .poll(async () =>
      Number(await page.locator('#app').getAttribute('data-player-z')),
    )
    .toBeCloseTo(6, 1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Return to title' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'title');
  expect(errors).toEqual([]);
});

test('loading can be cancelled and network failures can be retried', async ({
  page,
}) => {
  let hold: (() => void) | undefined;
  await page.route('**/areas/tutorial.area.json', async (route) => {
    await new Promise<void>((resolve) => {
      hold = resolve;
    });
    await route.abort();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'loading');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  hold?.();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'title');
  await page.unroute('**/areas/tutorial.area.json');
  await page.route('**/areas/tutorial.area.json', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/areas/tutorial.area.json');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'playing', {
    timeout: 30000,
  });
  await page.screenshot({ path: 'test-results/tutorial-default.png' });
});

test('title and settings fit a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'PLAY', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/title-mobile.png' });
  await page.getByRole('button', { name: 'SETTINGS' }).click();
  await expect(page.getByRole('button', { name: 'Done' })).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
