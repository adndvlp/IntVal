import { expect, type Locator, type Page } from '@playwright/test';

export async function choosePalette(page: Page, name: string) {
  const radio = page.getByRole('radio', { name, exact: true });
  await radio.locator('..').click();
  await expect(radio).toBeChecked();
}

export async function backdropPoint(page: Page, dialog: Locator) {
  const rect = await dialog.boundingBox();
  const viewport = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  }));
  if (!rect) throw new Error('El modal no tiene un rectángulo visible.');
  const middleY = Math.min(
    viewport.height - 1,
    Math.max(1, rect.y + rect.height / 2),
  );
  const middleX = Math.min(
    viewport.width - 1,
    Math.max(1, rect.x + rect.width / 2),
  );
  if (rect.x > 1) return { x: rect.x / 2, y: middleY };
  if (rect.x + rect.width < viewport.width - 1)
    return { x: (rect.x + rect.width + viewport.width) / 2, y: middleY };
  if (rect.y > 1) return { x: middleX, y: rect.y / 2 };
  if (rect.y + rect.height < viewport.height - 1)
    return { x: middleX, y: (rect.y + rect.height + viewport.height) / 2 };
  throw new Error('No hay área exterior del modal dentro del viewport.');
}

export async function readyForAnalysis(page: Page) {
  await expect(
    page.getByRole('button', { name: 'Ajustes de valoración' }),
  ).toBeEnabled();
}

export async function startDemo(page: Page) {
  await expect(
    page.getByRole('checkbox', { name: 'Seleccionar página' }),
  ).toBeEnabled();
  await page.getByRole('checkbox', { name: 'Seleccionar página' }).click();
  await page
    .getByRole('button', { name: 'Analizar selección', exact: true })
    .click();
}
