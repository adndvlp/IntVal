// Referencia deliberadamente separada por OS/proyecto: no mezclar fuentes de Linux/macOS.
import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';

test('baseline visual revisado del dashboard', async ({
  page,
  browser,
}, info) => {
  await page.goto('/app/?fuente=demo');
  await expect(
    page.getByText('Análisis completado con observaciones', { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => scrollTo(0, 0));
  await writeFile(
    info.outputPath('environment.json'),
    JSON.stringify(
      {
        browser: browser.version(),
        os: process.platform,
        release: os.release(),
        machine: os.arch(),
        viewport: page.viewportSize(),
      },
      null,
      2,
    ),
  );
  await expect(page).toHaveScreenshot('dashboard-top.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.005,
  });
});

test('baseline visual revisado del panel móvil', async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== 'mobile',
    'El panel modal sólo se muestra en viewport móvil.',
  );
  await page.goto('/app/?fuente=demo');
  await expect(
    page.getByText('Análisis completado con observaciones', { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page
    .getByRole('button', { name: 'Configurar análisis', exact: false })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await writeFile(
    info.outputPath('environment.json'),
    JSON.stringify(
      {
        browser: browser.version(),
        os: process.platform,
        release: os.release(),
        machine: os.arch(),
        viewport: page.viewportSize(),
      },
      null,
      2,
    ),
  );
  await expect(page).toHaveScreenshot('controls.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.005,
  });
});
