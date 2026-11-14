import { test, expect } from '@playwright/test';
import { auditPage, navigationTab } from './audit-helpers';

test('estructura, contraste automático, errores descritos y diálogo operable por teclado', async ({
  page,
}, testInfo) => {
  test.setTimeout(45000);
  for (const path of ['/', '/metodologia/', '/app/?fuente=market']) {
    await page.goto(path);
    if (path.includes('/app/'))
      await expect(
        page.getByText('Servicio conectado', { exact: true }),
      ).toBeVisible();
    const axe = await auditPage(page);
    expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
    await page.keyboard.press(navigationTab(testInfo));
    await expect(
      page.getByRole('link', { name: 'Saltar al contenido' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  }
  const compact = testInfo.project.name.endsWith('mobile');
  const open = page.getByRole('button', {
    name: 'Configurar análisis',
    exact: false,
  });
  if (compact) {
    await open.focus();
    await page.keyboard.press('Enter');
  }
  // Los nombres deben seguir coincidiendo con el título visible tras el ajuste
  // de interoperabilidad de referencias ARIA observado en Firefox 159/macOS.
  const form = page.getByRole('form', { name: 'Construye tu análisis.' });
  await expect(form.getByRole('heading', { level: 2 })).toHaveText(
    'Construye tu análisis.',
  );
  const input = page.getByLabel('Tasa de descuento accionista (%)');
  await input.fill('');
  await input.press('Tab');
  const reason = page.getByText('Introduce un valor entre 5 y 20.');
  await expect(reason).toBeVisible();
  await expect(input).toHaveAttribute(
    'aria-describedby',
    /tasa_descuento-error/,
  );
  await input.fill('10');
  await input.press('Tab');
  await expect(reason).toHaveCount(0);
  if (compact) {
    const dialog = page.getByRole('dialog', { name: 'Configurar análisis' });
    await dialog.getByRole('button', { name: 'Cerrar configuración' }).focus();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press(navigationTab(testInfo));
      // El navegador puede pasar por su chrome al cerrar un ciclo de tabulación.
      // Se permite ese paso nativo, pero nunca foco en un control del fondo.
      if (await page.evaluate(() => document.activeElement === document.body))
        await page.keyboard.press(navigationTab(testInfo));
      expect(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(open).toBeFocused();
  }
  await page.goto('/app/?fuente=demo');
  await expect(
    page.getByText('Análisis completado con observaciones', { exact: true }),
  ).toBeVisible();
  for (const name of [
    'Pon las cifras en perspectiva.',
    'Detrás de cada cifra.',
  ]) {
    const section = page.getByRole('region', { name, exact: true });
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(name);
  }
  const region = page.getByRole('region', {
    name: 'Comparación de empresas, desplazable horizontalmente',
  });
  await region.focus();
  await page.keyboard.press('ArrowRight');
  if (compact)
    await expect
      .poll(() => region.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
  const outline = await region.evaluate(
    (el) => getComputedStyle(el).outlineStyle,
  );
  expect(outline).not.toBe('none');
  await testInfo.attach('comparison-accessibility-tree', {
    body: await region.ariaSnapshot(),
    contentType: 'text/yaml',
  });
  const axe = await auditPage(page);
  expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
});
