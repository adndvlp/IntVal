import { expect, test } from '@playwright/test';

test('navega con teclado y comprueba la API real desde el build estático', async ({
  page,
}, testInfo) => {
  const errores: string[] = [];
  page.on('pageerror', (error) => errores.push(error.message));
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Saltar al contenido' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.getByRole('link', { name: 'Aplicación', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Tu espacio de análisis.',
  );
  await expect(page.locator('nav [aria-current="page"]')).toHaveText(
    'Aplicación',
  );
  const meta = page.waitForResponse('http://127.0.0.1:8766/api/v1/meta');
  await page.getByRole('button', { name: 'Comprobar conexión' }).click();
  expect((await meta).status()).toBe(200);
  await expect(page.getByRole('status')).toContainText('Conexión disponible');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
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
  await expect(page.getByRole('heading', { level: 1 })).toContainText('precio');
  await page.getByRole('link', { name: 'Aplicación', exact: true }).click();
  // El selector de texto de Playwright omite NOSCRIPT. Un <p> real dentro
  // de ese elemento sólo existe cuando el navegador lo interpreta sin JS.
  const aviso = page.locator('noscript p');
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText(
    'Activa JavaScript para comprobar la conexión.',
    { useInnerText: true },
  );
  await context.close();
});
