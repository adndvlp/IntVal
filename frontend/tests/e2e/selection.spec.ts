import { expect, test } from '@playwright/test';

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
