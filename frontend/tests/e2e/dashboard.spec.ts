import { expect, test, type Page } from '@playwright/test';
import { auditPage } from './audit-helpers';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

async function openControls(page: Page) {
  const button = page.getByRole('button', {
    name: 'Configurar análisis',
    exact: false,
  });
  if ((page.viewportSize()?.width ?? 1280) < 1120) {
    await expect(button).toBeVisible();
    await button.click();
  }
}
async function closeControls(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Configurar análisis' });
  if (await dialog.isVisible())
    await dialog.getByRole('button', { name: 'Cerrar configuración' }).click();
}

async function expectNoOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    overflow: Array.from(document.querySelectorAll('body *'))
      .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
      .map((e) => ({
        tag: e.tagName,
        class: e.getAttribute('class'),
        right: e.getBoundingClientRect().right,
      })),
  }));
  expect(layout.width, JSON.stringify(layout.overflow)).toBeLessThanOrEqual(
    layout.viewport,
  );
}

test('demo real: compara, filtra, consulta cuatro gráficas y descarga el snapshot completo', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const creations: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/api/v1/analyses'))
      creations.push(r.postData() ?? '');
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Explorar la demo' }).first().click();
  await expect(
    page.getByText('Análisis completado con observaciones', { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole('button', { name: 'Ver detalle de DEMO-USA' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ver detalle de DEMO-MX.MX' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ver detalle de DEMO-INCOMPLETA' }),
  ).toBeVisible();
  expect(creations).toHaveLength(1);
  await expect(
    page.getByRole('group', { name: 'Resultados por estado' }),
  ).toContainText('Datos incompletos: 1');
  await expect(page.locator('.kpi-grid')).toContainText('+10.38%');
  await page.getByLabel('Filtrar por upside mínimo').check();
  await expect(
    page.getByRole('button', { name: 'Ver detalle de DEMO-INCOMPLETA' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ver detalle de DEMO-MX.MX' }),
  ).toHaveCount(0);
  await page.getByLabel('Mercado del resultado').selectOption('MX');
  await expect(
    page.getByText('No hay empresas que coincidan con estos filtros.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Descargar Excel completo' }),
  ).toBeEnabled();
  await openControls(page);
  await page.getByLabel('Tasa de descuento accionista (%)').fill('15');
  await closeControls(page);
  await expect(page.getByText(/Hay cambios sin aplicar/)).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar Excel completo' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('demo_valoraciones_USA_MX.xlsx');
  const file = testInfo.outputPath('analisis-demo.xlsx');
  await download.saveAs(file);
  const python = fileURLToPath(
    new URL('../../../.venv/bin/python', import.meta.url),
  );
  const verify = fileURLToPath(
    new URL('../../scripts/verify-export.py', import.meta.url),
  );
  expect(execFileSync(python, [verify, file], { encoding: 'utf8' })).toContain(
    'conciliados',
  );
  expect(creations).toHaveLength(1);
  await page.getByLabel('Filtrar por upside mínimo').uncheck();
  await page.getByRole('button', { name: 'Ver detalle de DEMO-MX.MX' }).click();
  await expect(page.getByLabel('Empresa del detalle')).toHaveValue(
    'DEMO-MX.MX',
  );
  await page
    .getByRole('button', { name: 'Precio histórico', exact: true })
    .click();
  await expect(
    page.locator('[data-chart="prices"] svg.recharts-surface'),
  ).toBeVisible({ timeout: 15000 });
  await page.getByLabel('Período del precio histórico').selectOption('5y');
  await expect(page.locator('[data-chart="prices"]')).toBeVisible();
  await page
    .getByRole('button', { name: 'Estados financieros', exact: true })
    .click();
  await expect(page.getByText('Millones de MXN', { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Márgenes', exact: true }).click();
  await expect(
    page.locator('[data-chart="margins"]').getByRole('application'),
  ).toBeVisible();
  await page.getByText('Ver datos de la gráfica', { exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Datos de márgenes · porcentajes' }),
  ).toContainText('+13%');
  await page.getByRole('button', { name: 'Comparación', exact: true }).click();
  await page.getByLabel('Mercado del resultado').selectOption('all');
  await openControls(page);
  await page.getByLabel('Tasa de descuento accionista (%)').fill('10');
  await closeControls(page);
  const audit = await auditPage(page);
  expect(audit.violations).toEqual([]);
  await expectNoOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('dashboard.png'),
    fullPage: true,
  });
  if (testInfo.project.name === 'mobile') {
    await openControls(page);
    await expect(
      page.getByRole('dialog', { name: 'Configurar análisis' }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('dashboard-controls.png'),
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: 'Configurar análisis', exact: false }),
    ).toBeFocused();
  }
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Limpiar resultados' }).click();
  await expect(page.getByText('Prepara tu próximo análisis.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Descargar Excel completo' }),
  ).toHaveCount(0);
  expect(creations).toHaveLength(1);
});

test('Mercado no analiza al abrir; reflow a 320 px y texto al 200 por ciento', async ({
  page,
}, testInfo) => {
  const creations: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/api/v1/analyses'))
      creations.push(r.url());
  });
  await page.goto('/app/?fuente=market');
  await expect(
    page.getByText('Servicio conectado', { exact: true }),
  ).toBeVisible();
  expect(creations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('dashboard-zoom-before.png'),
    fullPage: true,
  });
  await expectNoOverflow(page);
  // No basta con evitar overflow si una palabra se parte letra por letra.
  for (const selector of ['.workbench-heading h1', '.analysis-empty h3']) {
    expect(
      await page.locator(selector).evaluate((element) => {
        const node = element.firstChild!;
        const word = 'análisis.';
        const start = node.textContent!.indexOf(word);
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + word.length);
        return range.getClientRects().length;
      }),
    ).toBe(1);
  }
  await openControls(page);
  await expect(
    page.getByLabel('Tasa de descuento accionista (%)'),
  ).toBeVisible();
  expect(
    await page
      .getByRole('dialog')
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.getByRole('button', { name: 'Cerrar configuración' }).click();
  await page.screenshot({
    path: testInfo.outputPath('dashboard-zoom.png'),
    fullPage: true,
  });
  expect(creations).toEqual([]);
});
