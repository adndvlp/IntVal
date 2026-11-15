import { startDemo } from './analysis-helpers';
// Referencia deliberadamente separada por OS/proyecto: no mezclar fuentes de Linux/macOS.
import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';

test('referencia UI-3 del dashboard pendiente de revisión visual', async ({
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
  await expect(page).toHaveScreenshot('ui3-results.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.005,
  });
});

test('referencia UI-3 del ajustes móviles pendiente de revisión visual', async ({
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
  await page.getByRole('button', { name: 'Ajustes de valoración' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Ajustes de valoración' }),
  ).toBeVisible();
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
  await expect(page).toHaveScreenshot('ui3-settings.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.005,
  });
});
