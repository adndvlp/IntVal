import { expect, test } from '@playwright/test';
import { navigationTab } from './audit-helpers';
import { readyForAnalysis } from './analysis-helpers';

test('navega con teclado y conecta la API desde la entrada directa', async ({
  page,
}, testInfo) => {
  const errores: string[] = [];
  const posts: string[] = [];
  page.on('pageerror', (error) => errores.push(error.message));
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  const meta = page.waitForResponse('http://127.0.0.1:8766/api/v1/meta');
  await page.goto('/');
  await page.keyboard.press(navigationTab(testInfo));
  await expect(
    page.getByRole('link', { name: 'Saltar al contenido' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Elige las empresas',
  );
  await expect(page.locator('nav [aria-current="page"]')).toHaveText(
    'Analizar',
  );
  expect((await meta).status()).toBe(200);
  await readyForAnalysis(page);
  await expect(page.locator('.selection-count strong')).toHaveText('0');
  expect(posts).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errores).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('shell.png'),
    fullPage: true,
  });
});

test('conserva contenido y enlaces con JavaScript desactivado', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Elige las empresas',
  );
  await expect(page.locator('noscript p')).toContainText(
    'Activa JavaScript para analizar empresas',
    { useInnerText: true },
  );
  await page
    .locator('noscript')
    .getByRole('link', { name: 'Cómo se calcula' })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Cómo se calcula.',
  );
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(5);
  await expect(page.locator('main details')).toHaveCount(0);
  await context.close();
});
