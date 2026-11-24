import { expect, test } from '@playwright/test';

test('Mercado encuentra nombres de USA y México sin solicitar datos financieros', async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'intval.selection.v1:http://127.0.0.1:8766:market:universe-2026-11-12',
      JSON.stringify({ version: 1, selected: ['BIMBOA.MX'], extras: '' }),
    );
  });
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) apiRequests.push(request.url());
  });
  await page.route('**/api/v1/analyses', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 503,
      json: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Prueba' } },
      headers: { 'access-control-allow-origin': 'http://127.0.0.1:4321' },
    });
  });
  await page.goto('/app/?fuente=market');
  const rows = page.locator('.company-option');
  const search = page.getByRole('searchbox', { name: 'Buscar empresas' });
  await expect(rows).toHaveCount(25);
  await expect(page.locator('.selection-count')).toHaveText('1 seleccionada');
  const initialRequests = apiRequests.length;

  const apple = page.getByRole('checkbox', { name: /Apple Inc\. AAPL/ });
  await search.fill('Apple');
  await expect(apple).toBeVisible();
  await search.fill('AAPL');
  await expect(apple).toBeVisible();
  await search.press('Enter');
  await expect(apple).toBeChecked();

  const market = page.getByRole('combobox', {
    name: 'Mercado de las empresas',
  });
  await market.selectOption('USA');
  await search.fill('Bimbo');
  await expect(rows).toHaveCount(0);
  await market.selectOption('MX');
  await expect(
    page.getByRole('checkbox', { name: /Grupo Bimbo.*BIMBOA\.MX/ }),
  ).toBeChecked();
  await search.fill('america movil');
  await expect(
    page.getByRole('checkbox', { name: /América Móvil.*AMXB\.MX/ }),
  ).toBeVisible();

  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await search.fill('Impulsora del Desarrollo');
  const longName = page.getByRole('checkbox', { name: /IDEALB-1\.MX/ });
  await expect(longName).toBeVisible();
  expect(await rows.evaluate((row) => row.scrollWidth <= row.clientWidth)).toBe(
    true,
  );
  expect(apiRequests).toHaveLength(initialRequests);

  const submitted = page.waitForRequest(
    (request) =>
      request.method() === 'POST' && request.url().endsWith('/analyses'),
  );
  await page.getByRole('button', { name: 'Analizar selección' }).click();
  const payload = (await submitted).postDataJSON();
  expect(payload.source).toBe('market');
  expect(payload.tickers.sort()).toEqual(['AAPL', 'BIMBOA.MX']);
});

test('catálogo real: encuentra por nombre, selecciona con Enter y analiza sólo lo elegido', async ({
  page,
}) => {
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/analyses'))
      posts.push(r.postData() ?? '');
  });
  await page.goto('/?fuente=demo');
  const search = page.getByRole('searchbox', { name: 'Buscar empresas' });
  await expect(page.locator('.company-option')).toHaveCount(3);
  await search.fill('INDUSTRIAL AURORA');
  await expect(page.locator('.company-option')).toHaveCount(1);
  await search.press('Enter');
  await expect(page.getByRole('checkbox', { name: /DEMO-USA/ })).toBeChecked();
  expect(posts).toEqual([]);
  await page
    .getByRole('combobox', { name: 'Mercado de las empresas' })
    .selectOption('MX');
  await expect(page.locator('.company-option')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Seleccionadas', exact: true })
    .click();
  await expect(page.getByRole('checkbox', { name: /DEMO-USA/ })).toBeChecked();
  await page.getByRole('button', { name: 'Analizar selección' }).click();
  await expect(
    page.getByRole('status').getByText('Análisis completado', { exact: true }),
  ).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0]!).tickers).toEqual(['DEMO-USA']);
  await page.getByRole('button', { name: 'Editar selección' }).click();
  await page.getByRole('button', { name: 'Limpiar selección' }).click();
  await expect(search).toBeFocused();
  await page.getByRole('link', { name: 'Resultados', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Excel', exact: true }),
  ).toBeEnabled();
});

test('1203 filas de prueba: página/global, límite visible, reflow y selección persistente', async ({
  page,
}, info) => {
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  // Sólo el catálogo es sintético; el límite procede de meta real. No prueba capacidad del servidor.
  await page.route('**/api/v1/catalog?*', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({
      response,
      json: {
        ...data,
        total: 1203,
        items: Array.from({ length: 1203 }, (_, i) => ({
          ticker: `S${String(i).padStart(4, '0')}`,
          market: i % 2 ? 'MX' : 'USA',
          name: `Empresa sintética ${i}`,
          currency: i % 2 ? 'MXN' : 'USD',
        })),
      },
    });
  });
  await page.goto('/?fuente=demo');
  await expect(page.locator('.company-option')).toHaveCount(25);
  const master = page.getByRole('checkbox', { name: 'Seleccionar página' });
  await page.getByRole('checkbox', { name: /S0000/ }).check();
  await expect(master).toBeChecked({ indeterminate: true });
  await master.check();
  await page
    .getByRole('button', { name: 'Seleccionar 1,203 empresas' })
    .click();
  await expect(page.locator('.selection-count')).toContainText('1,203');
  await page.getByRole('button', { name: 'Última página' }).click();
  await expect(page.locator('.company-option')).toHaveCount(3);
  await page.getByRole('button', { name: 'Analizar selección' }).click();
  await expect(page.getByRole('alert')).toContainText('650 empresas');
  expect(posts).toEqual([]);
  await page.reload();
  await expect(page.locator('.selection-count')).toContainText('1,203');
  await expect(page.locator('.company-option')).toHaveCount(3);
  await page
    .getByRole('button', { name: 'Seleccionadas', exact: true })
    .click();
  await page.getByRole('button', { name: 'Limpiar selección' }).click();
  await expect(
    page.getByRole('searchbox', { name: 'Buscar empresas' }),
  ).toBeFocused();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('ui2-selection-zoom.png'),
    fullPage: true,
  });
  expect(posts).toEqual([]);
});
