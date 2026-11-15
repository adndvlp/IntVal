import { expect, test } from '@playwright/test';
import { startDemo } from './analysis-helpers';

test('personaliza paleta y modo, conserva la preferencia y no vuelve a analizar', async ({
  page,
}) => {
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/?fuente=demo');
  await expect(page.locator('.selection-count strong')).toHaveText('0');
  expect(posts).toEqual([]);
  await startDemo(page);
  await expect(
    page.getByText('Análisis completado con observaciones', { exact: true }),
  ).toBeVisible();
  expect(posts).toHaveLength(1);
  await page.getByRole('button', { name: 'Modo oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-color-scheme',
    'dark',
  );
  const palette = page.locator('#palette-switcher');
  await palette.locator('summary').click();
  await page.getByRole('radio', { name: 'Bosque', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'forest');
  await page.getByRole('heading', { level: 1 }).click();
  await expect(palette).not.toHaveAttribute('open');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute(
    'data-color-scheme',
    'dark',
  );
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'forest');
  await expect(
    page.getByText('Análisis completado con observaciones', { exact: true }),
  ).toBeVisible();
  expect(posts).toHaveLength(1);
  await palette.locator('summary').click();
  await page.getByLabel('Color personalizado').fill('#9f3672');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'custom');
  await page.keyboard.press('Escape');
  await expect(palette).not.toHaveAttribute('open');
  await page.locator('.site-footer a').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Cómo se calcula.',
  );
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'custom');
  await expect(page.locator('html')).toHaveAttribute(
    'data-color-scheme',
    'dark',
  );
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(5);
  await expect(page.locator('main details')).toHaveCount(0);
  expect(posts).toHaveLength(1);
});

test('shell y explicación legibles en cuatro anchos, dos modos y texto al 200 por ciento', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const path of ['/', '/metodologia/']) {
      await page.goto(path);
      if (path === '/')
        await expect(
          page.getByText('Servicio conectado', { exact: true }),
        ).toBeVisible();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (
          info.project.name === 'desktop' &&
          colorScheme === 'light' &&
          [390, 1440].includes(width)
        ) {
          await page.screenshot({
            path: info.outputPath(
              `${path === '/' ? 'entry' : 'calculation'}-${width}.png`,
            ),
            fullPage: true,
          });
        }
      }
      await page.setViewportSize({ width: 320, height: 900 });
      await page.addStyleTag({ content: 'html { font-size: 200%; }' });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(
          `${path === '/' ? 'entry' : 'calculation'}-${colorScheme}-zoom.png`,
        ),
        fullPage: true,
      });
    }
  }
});
