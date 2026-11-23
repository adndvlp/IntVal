import { expect, test, type Page } from '@playwright/test';
import { auditPage } from './audit-helpers';
import { startDemo, readyForAnalysis } from './analysis-helpers';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test('demo real: tabla ordenable, detalle diferido y Excel completo del snapshot', async ({
  page,
}, info) => {
  const errors: string[] = [],
    posts: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/analyses'))
      posts.push(r.postData() ?? '');
  });
  await page.goto('/?fuente=demo');
  const acceptedResponse = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().endsWith('/analyses'),
  );
  await startDemo(page);
  await expect(
    page.getByText('Análisis completado con observaciones', { exact: true }),
  ).toBeVisible();
  const table = page.getByRole('table', { name: 'Resultados por empresa' });
  await expect(table.getByRole('columnheader')).toHaveCount(4);
  await expect(
    table.getByRole('link', { name: 'Industrial Aurora', exact: true }),
  ).toBeVisible();
  await expect(table).toContainText('Sin estimación');
  const alignment = await table.evaluate((t) =>
    [1, 2, 3].map((index) => {
      const heading = t.querySelectorAll('thead th')[index]!;
      const header = heading
        .querySelector('button > span')!
        .getBoundingClientRect();
      const cell = t.querySelectorAll('tbody tr')[0]!.children[index]!;
      const range = document.createRange();
      range.selectNodeContents(cell);
      const value = range.getBoundingClientRect();
      return Math.abs(
        header.left + header.width / 2 - value.left - value.width / 2,
      );
    }),
  );
  for (const offset of alignment) expect(offset).toBeLessThanOrEqual(1);

  await table.getByRole('button', { name: 'Precio', exact: true }).click();
  await expect(table.locator('th[aria-sort]')).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await page
    .getByRole('searchbox', { name: 'Buscar en resultados' })
    .fill('DEMO-MX.MX');
  await expect(table.getByRole('rowheader')).toHaveCount(1);
  await page.getByRole('button', { name: 'Ajustes de valoración' }).click();
  const settings = page.getByRole('dialog', { name: 'Ajustes de valoración' });
  await settings
    .getByLabel('Tasa de descuento (%)', { exact: true })
    .fill('15');
  await settings.getByRole('button', { name: 'Guardar' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  const download = await downloadPromise,
    file = info.outputPath('analisis-demo.xlsx');
  await download.saveAs(file);
  const python = fileURLToPath(
    new URL('../../../.venv/bin/python', import.meta.url),
  );
  const verify = fileURLToPath(
    new URL('../../scripts/verify-export.py', import.meta.url),
  );
  const accepted = await acceptedResponse;
  const id = (await accepted.json()).id as string;
  const endpoint = `${accepted.url()}/${encodeURIComponent(id)}`;
  const job = await (await page.request.get(endpoint)).json();
  const results = await (
    await page.request.get(`${endpoint}/results?after=0&limit=100`)
  ).json();
  expect(results.next_cursor).toBe(job.processed);
  const snapshotFile = info.outputPath('snapshot-demo.json');
  writeFileSync(snapshotFile, JSON.stringify({ job, rows: results.items }));
  expect(
    execFileSync(python, [verify, file, '--snapshot', snapshotFile], {
      encoding: 'utf8',
    }),
  ).toContain('conciliados');
  const priceCell = table.getByRole('cell').first();
  // Evita Apariencia y la columna fija antes de pulsar una cifra de la fila.
  await priceCell.evaluate((cell) =>
    cell.scrollIntoView({
      block: 'center',
      inline: 'end',
      behavior: 'instant',
    }),
  );
  await priceCell.click();
  const detail = page.getByRole('dialog', {
    name: 'Manufacturas Horizonte',
    exact: true,
  });
  await expect(detail.getByRole('heading', { name: 'Métodos' })).toBeVisible();
  const position = await detail.evaluate((dialog) => {
    const rect = dialog.getBoundingClientRect();
    return {
      horizontal: Math.abs(rect.left + rect.width / 2 - innerWidth / 2),
      vertical: Math.abs(rect.top + rect.height / 2 - innerHeight / 2),
    };
  });
  expect(position.horizontal).toBeLessThanOrEqual(1);
  expect(position.vertical).toBeLessThanOrEqual(1);
  await expect(
    detail.getByRole('heading', { name: 'Supuestos' }),
  ).toBeVisible();
  await expect(detail).toContainText('10.00 % / 10.00 %');
  const detailDownload = page.waitForEvent('download');
  await detail.getByRole('button', { name: 'Excel', exact: true }).click();
  const detailFile = info.outputPath('analisis-detalle.xlsx');
  await (await detailDownload).saveAs(detailFile);
  expect(
    execFileSync(python, [verify, detailFile, '--snapshot', snapshotFile], {
      encoding: 'utf8',
    }),
  ).toContain('conciliados');
  await detail.getByRole('tab', { name: 'Precio histórico' }).click();
  await expect(
    detail.locator('[data-chart=prices]').getByRole('application'),
  ).toBeVisible();
  await detail.getByLabel('Período del precio histórico').selectOption('5y');
  await detail.getByRole('tab', { name: 'Finanzas' }).click();
  await expect(detail.getByRole('figure')).toContainText('Millones de MXN');
  await detail.getByRole('tab', { name: 'Márgenes' }).click();
  await detail.getByText('Datos', { exact: true }).click();
  await expect(
    detail.getByRole('table', { name: 'Datos de márgenes · porcentajes' }),
  ).toContainText('+13%');
  await page.keyboard.press('Escape');
  await expect(detail).not.toBeVisible();
  await expect(
    table.getByRole('link', { name: 'Manufacturas Horizonte', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole('searchbox', { name: 'Buscar en resultados' }),
  ).toHaveValue('DEMO-MX.MX');
  await expect(table.locator('th[aria-sort]')).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await expect(page.locator('input[name=min_upside]')).toHaveCount(0);
  expect(posts).toHaveLength(1);
  expect(errors).toEqual([]);
  expect((await auditPage(page)).violations).toEqual([]);
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath('ui3-results.png'),
    fullPage: true,
  });
});

test('Mercado no analiza al abrir; selector y ajustes a 320 px y texto al 200 por ciento', async ({
  page,
}, info) => {
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  await page.goto('/app/?fuente=market');
  await readyForAnalysis(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await noOverflow(page);
  const summary = page.locator('.batch-summary');
  await summary.evaluate((element) => {
    window.scrollTo(0, scrollY + element.getBoundingClientRect().top + 80);
  });
  await expect
    .poll(async () => Math.abs((await summary.boundingBox())!.y))
    .toBeLessThanOrEqual(1);
  await expect(
    page.getByLabel('Seleccionar página', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('ui3-catalog-sticky.png'),
    fullPage: false,
  });
  await page.getByRole('button', { name: 'Ajustes de valoración' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajustes de valoración' });
  await expect(dialog.getByRole('spinbutton')).toHaveCount(9);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: info.outputPath('ui3-settings-zoom.png'),
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Cerrar ajustes' }).click();
  expect(posts).toEqual([]);
});
