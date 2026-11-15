import { expect, type Page } from '@playwright/test';

export async function startDemo(page: Page) {
  await expect(
    page.getByRole('checkbox', { name: 'Seleccionar página' }),
  ).toBeEnabled();
  await page.getByRole('checkbox', { name: 'Seleccionar página' }).click();
  await page
    .getByRole('button', { name: 'Analizar selección', exact: true })
    .click();
}
