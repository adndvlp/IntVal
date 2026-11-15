import { expect, type Page } from '@playwright/test';

export async function startDemo(page: Page) {
  await expect(
    page.getByRole('button', { name: 'Seleccionar todo el mercado' }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Seleccionar todo el mercado' })
    .click();
  await page
    .getByRole('button', { name: 'Analizar empresas', exact: true })
    .click();
}
