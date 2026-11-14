import { test, expect } from '@playwright/test';

test('recupera parciales tras desconexión, recarga el mismo ID y explica su expiración', async ({
  page,
}) => {
  test.setTimeout(45000);
  let stage: 'partial' | 'offline' | 'complete' | 'expired' = 'partial';
  let posts = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/analyses')) posts++;
  });
  await page.route('**/api/v1/analyses/*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    if (stage === 'offline') return route.abort('failed');
    if (stage === 'expired')
      return route.fulfill({
        status: 410,
        json: {
          error: { code: 'ANALYSIS_EXPIRED', fields: [], retryable: false },
        },
      });
    const response = await route.fetch();
    if (stage === 'complete' || !response.ok())
      return route.fulfill({ response });
    const data = await response.json();
    if (data.processed > 0) {
      data.state = 'running';
      data.processed = 1;
      data.current_ticker = 'DEMO-MX.MX';
      data.counts = { OK: 1, 'DATOS INCOMPLETOS': 0, REVISAR: 0, ERROR: 0 };
    }
    return route.fulfill({ response, json: data });
  });
  await page.route('**/api/v1/analyses/*/results?*', async (route) => {
    const response = await route.fetch();
    if (stage !== 'partial' || !response.ok())
      return route.fulfill({ response });
    const data = await response.json();
    data.items = data.items.slice(0, 1);
    data.next_cursor = 1;
    data.processed = 1;
    data.done = false;
    return route.fulfill({ response, json: data });
  });
  await page.goto('/app/?fuente=demo');
  await expect(
    page.getByRole('button', { name: 'Ver detalle de DEMO-USA' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ver detalle de DEMO-MX.MX' }),
  ).toHaveCount(0);
  stage = 'offline';
  const reconnect = page.getByRole('button', {
    name: 'Reconectar al análisis',
  });
  await expect(reconnect).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole('button', { name: 'Ver detalle de DEMO-USA' }),
  ).toBeVisible();
  stage = 'complete';
  await reconnect.click();
  await expect(
    page.getByText('Análisis completado con observaciones', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ver detalle de DEMO-MX.MX' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ver detalle de DEMO-INCOMPLETA' }),
  ).toBeVisible();
  expect(posts).toBe(1);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Ver detalle de DEMO-MX.MX' }),
  ).toBeVisible();
  expect(posts).toBe(1);
  stage = 'expired';
  await page.reload();
  await expect(page.getByText(/El análisis expiró/)).toBeVisible();
  expect(posts).toBe(1);
  await expect(
    page.getByText('Enviando análisis…', { exact: true }),
  ).toHaveCount(0);
});

test('limpiar antes de recibir el POST ignora sus filas y cancela la aceptación tardía', async ({
  page,
}) => {
  let release!: () => void;
  let accepted = false;
  let posts = 0;
  let cancels = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/analyses', async (route) => {
    posts++;
    const response = await route.fetch();
    accepted = true;
    await gate;
    await route.fulfill({ response });
  });
  page.on('request', (r) => {
    if (r.url().endsWith('/cancel')) cancels++;
  });
  await page.goto('/app/?fuente=demo');
  await expect.poll(() => accepted).toBe(true);
  await page.getByRole('button', { name: 'Limpiar resultados' }).click();
  release();
  await expect.poll(() => cancels).toBe(1);
  await expect(page.getByText('Prepara tu próximo análisis.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ver detalle de DEMO-USA' }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Prepara tu próximo análisis.')).toBeVisible();
  expect(posts).toBe(1);
});
