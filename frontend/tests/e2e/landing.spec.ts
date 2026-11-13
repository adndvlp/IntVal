import { expect, test } from '@playwright/test';

test('landing legible en cuatro anchos y navegación a metodología y demo', async ({
  page,
}, testInfo) => {
  const api: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) api.push(request.url());
  });
  await page.goto('/');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'perspectiva',
    );
    await expect(
      page
        .getByRole('table')
        .getByRole('cell', { name: '116.19', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (testInfo.project.name === 'desktop' && [390, 1440].includes(width)) {
      await page.screenshot({
        path: testInfo.outputPath('landing-' + width + '.png'),
        fullPage: true,
      });
      if (width === 1440)
        await page
          .locator('.hero')
          .screenshot({ path: testInfo.outputPath('social.png') });
    }
  }
  expect(api).toEqual([]);
  const contrastes = await page.evaluate(() => {
    const rgba = (text: string) => (text.match(/[\d.]+/g) ?? []).map(Number);
    const luminancia = (rgb: number[]) =>
      rgb.slice(0, 3).reduce((sum, channel, i) => {
        const valor = channel / 255;
        return (
          sum +
          (valor <= 0.04045
            ? valor / 12.92
            : ((valor + 0.055) / 1.055) ** 2.4) *
            ([0.2126, 0.7152, 0.0722][i] ?? 0)
        );
      }, 0);
    return [
      '.hero-description',
      '.button--primary',
      '.button--secondary',
      '.sheet-caution',
      '.sheet-ticker',
      '.sheet-difference strong',
      '.preview-note',
      '.project-section p:not(.eyebrow)',
    ].map((selector) => {
      const node = document.querySelector(selector)!;
      let parent: Element | null = node;
      let background: number[] = [255, 255, 255];
      while (parent) {
        const color = rgba(getComputedStyle(parent).backgroundColor);
        if ((color[3] ?? 1) > 0) {
          background = color;
          break;
        }
        parent = parent.parentElement;
      }
      const fg = luminancia(rgba(getComputedStyle(node).color));
      const bg = luminancia(background);
      return {
        selector,
        ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05),
      };
    });
  });
  for (const contraste of contrastes)
    expect(contraste.ratio, contraste.selector).toBeGreaterThanOrEqual(4.5);
  await testInfo.attach('contrastes', {
    body: JSON.stringify(contrastes, null, 2),
    contentType: 'application/json',
  });
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Metodología', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Entender el cálculo',
  );
  await expect(
    page.getByRole('rowheader', { name: 'NOPAT', exact: true }),
  ).toBeVisible();
  if (testInfo.project.name === 'desktop')
    await page.screenshot({
      path: testInfo.outputPath('metodologia.png'),
      fullPage: true,
    });
  await page.getByRole('link', { name: 'Explorar la demo' }).first().click();
  await expect(page).toHaveURL(/\/app\/\?fuente=demo$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Tu espacio de análisis',
  );
});

test('contenido usable sin movimiento y con texto al 200 por ciento', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  await page.addStyleTag({
    content: 'html { font-size: 200%; } p { line-height: 1.5; }',
  });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const lineasFcl = await page
    .getByRole('rowheader', { name: 'FCL', exact: true })
    .locator('span')
    .first()
    .evaluate((element) => {
      const rango = document.createRange();
      rango.selectNodeContents(element);
      return Array.from(rango.getClientRects()).filter((rect) => rect.width > 0)
        .length;
    });
  expect(lineasFcl, 'La etiqueta FCL debe leerse en una línea').toBe(1);
  await page.locator('[data-demo-figure]').screenshot({
    path: testInfo.outputPath('figure-zoom.png'),
  });
  const comparacion = page.getByRole('region', {
    name: 'Comparación por acción, desplazable horizontalmente',
  });
  await comparacion.focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => comparacion.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  await page.locator('[data-demo-figure]').screenshot({
    path: testInfo.outputPath('figure-zoom-values.png'),
  });
  const layout = await page.evaluate(() => ({
    viewportWidth: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    overflow: Array.from(document.querySelectorAll('body *'))
      .filter(
        (element) => element.getBoundingClientRect().right > innerWidth + 1,
      )
      .map((element) => ({
        element: element.tagName.toLowerCase(),
        class: element.getAttribute('class'),
        right: element.getBoundingClientRect().right,
      })),
  }));
  await page.screenshot({
    path: testInfo.outputPath('landing-zoom.png'),
    fullPage: true,
  });
  expect(
    layout.documentWidth,
    JSON.stringify(layout.overflow),
  ).toBeLessThanOrEqual(layout.viewportWidth);
  await page.getByRole('link', { name: 'Analizar empresas' }).click();
  await expect(page).toHaveURL(/fuente=market$/);
});
