import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { characterSchema } from '../tools/art/character-schema';
import { existingProjectPath } from '../tools/art/paths';

const manifestFile = process.argv[2];
if (!manifestFile)
  throw new Error(
    'Usage: npm run art:capture -- <character.json> (start art:lab first)',
  );
const root = resolve('.');
const manifest = characterSchema.parse(
  JSON.parse(
    await readFile(await existingProjectPath(root, manifestFile), 'utf8'),
  ),
);
await existingProjectPath(root, manifest.export);
const lab = new URL(
  process.env.TANGER_LAB_URL ?? 'http://127.0.0.1:5180/tools/art/lab/',
);
lab.searchParams.set(
  'asset',
  '/' + manifest.export.split('/').map(encodeURIComponent).join('/'),
);
const output = resolve(`art/.build/browser/${manifest.id}`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const records: {
  image: string;
  view: string;
  clip: string;
  time: string;
  shading: string;
  lighting: string;
}[] = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    deviceScaleFactor: 1,
  });
  await page.goto(lab.href);
  await page.locator('body[data-ready="true"]').waitFor({ timeout: 30000 });
  await page.screenshot({ path: `${output}/lab-overview.png` });
  async function capture(name: string) {
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    );
    await page
      .locator('#viewport')
      .screenshot({ path: `${output}/${name}.png` });
    records.push({
      image: `art/.build/browser/${manifest.id}/${name}.png`,
      view:
        (await page
          .locator('[data-view].selected')
          .getAttribute('data-view')) ?? '',
      clip: await page.locator('#clip').inputValue(),
      time: await page.locator('#time').inputValue(),
      shading: await page.locator('#shading').inputValue(),
      lighting: await page.locator('#lighting').inputValue(),
    });
  }
  for (const view of ['front', 'quarter', 'profile', 'back', 'face']) {
    await page.locator(`[data-view="${view}"]`).click();
    await capture(view);
  }
  for (const name of manifest.rig.expressions) {
    const slider = page.getByRole('slider', {
      name: `Expression ${name}`,
      exact: true,
    });
    for (const value of [0.5, 1]) {
      await slider.fill(String(value));
      await slider.dispatchEvent('input');
      await capture(
        `expression-${name.replace(/[^a-z0-9.-]/gi, '-')}-${value}`,
      );
    }
    await slider.fill('0');
    await slider.dispatchEvent('input');
  }
  await page.locator('[data-view="quarter"]').click();
  for (const [semantic, clip] of Object.entries(manifest.rig.clips)) {
    await page.locator('#clip').selectOption(clip);
    const duration = Number(await page.locator('#time').getAttribute('max'));
    for (const portion of [0.25, 0.5, 0.75]) {
      await page.locator('#time').fill((duration * portion).toFixed(3));
      await page.locator('#time').dispatchEvent('input');
      await capture(
        `pose-${semantic.replace(/[^a-z0-9.-]/gi, '-')}-${portion}`,
      );
    }
  }
  await page.locator('#clip').selectOption('');
  await page.locator('#shading').selectOption('toon');
  await capture('toon-quarter');
  await page.locator('#shading').selectOption('clay');
  await capture('clay-quarter');
  await page.locator('#wireframe').check();
  await capture('wireframe-quarter');
  await page.locator('#wireframe').uncheck();
  await page.locator('#shading').selectOption('original');
  await page.locator('#lighting').selectOption('night');
  await capture('night-quarter');
  await writeFile(
    `${output}/capture.json`,
    JSON.stringify(
      { id: manifest.id, renderer: 'Three.js character lab', images: records },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Captured ${records.length} browser evidence images to art/.build/browser/${manifest.id}/. Inspect them; capture is not approval.`,
  );
} finally {
  await browser.close();
}
