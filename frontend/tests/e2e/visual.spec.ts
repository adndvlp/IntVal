import { startDemo } from './analysis-helpers';
// Referencia deliberadamente separada por OS/proyecto: no mezclar fuentes de Linux/macOS.
import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';

test('referencia UI-1 del dashboard pendiente de revisión visual', async ({
  page,
  browser,
}, info) => {
  await page.goto('/app/?fuente=demo');
  await startDemo(page);
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
  await expect(page).toHaveScreenshot('ui1-dashboard-top.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.005,
  });
});

test('referencia UI-1 del formulario móvil pendiente de revisión visual', async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== 'mobile',
    'La referencia de formulario se toma una vez en móvil.',
  );
  await page.goto('/app/?fuente=demo');
  await startDemo(page);
  await expect(
    page.getByText('Análisis completado con observaciones', { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page
    .getByRole('form', { name: 'Construye tu análisis.' })
    .scrollIntoViewIfNeeded();
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
  await expect(page).toHaveScreenshot('ui1-controls.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.005,
  });
});
