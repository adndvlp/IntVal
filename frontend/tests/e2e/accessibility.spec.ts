import { test, expect } from '@playwright/test';
import { auditPage, navigationTab } from './audit-helpers';
import { startDemo } from './analysis-helpers';

test('estructura, contraste automático, validación y modales nativos con teclado', async ({
  page,
}, info) => {
  test.setTimeout(45000);
  for (const path of ['/', '/metodologia/', '/app/?fuente=market']) {
    await page.goto(path);
    if (path !== '/metodologia/')
      await expect(
        page.getByText('Servicio conectado', { exact: true }),
      ).toBeVisible();
    expect((await auditPage(page)).violations).toEqual([]);
    await page.keyboard.press(navigationTab(info));
    await expect(
      page.getByRole('link', { name: 'Saltar al contenido' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  }
  await page.getByRole('button', { name: 'Ajustes de valoración' }).click();
  const settings = page.getByRole('dialog', { name: 'Ajustes de valoración' });
  const rate = settings.getByLabel('Tasa de descuento (%)', { exact: true });
  await rate.fill('');
  await rate.press('Tab');
  await expect(rate).toHaveAttribute('aria-invalid', 'true');
  await expect(rate).toHaveAttribute(
    'aria-describedby',
    /setting-error-tasa_descuento/,
  );
  await rate.fill('10');
  await rate.press('Tab');
  await expect(rate).toHaveAttribute('aria-invalid', 'false');
  expect((await auditPage(page)).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(settings).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ajustes de valoración' }),
  ).toBeFocused();
  await page.goto('/?fuente=demo');
  await startDemo(page);
  const table = page.getByRole('table', { name: 'Resultados por empresa' });
  await table
    .getByRole('link', { name: 'Industrial Aurora', exact: true })
    .click();
  const detail = page.getByRole('dialog', {
    name: 'Industrial Aurora',
    exact: true,
  });
  const summary = detail.getByRole('tab', { name: 'Resumen' });
  await summary.focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    detail.getByRole('tab', { name: 'Precio histórico' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(detail.getByRole('figure')).toBeVisible();
  await page.keyboard.press('Home');
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  expect((await auditPage(page)).violations).toEqual([]);
  await page.mouse.click(1, 1);
  await expect(detail).not.toBeVisible();
  await expect(
    table.getByRole('link', { name: 'Industrial Aurora', exact: true }),
  ).toBeFocused();
});
