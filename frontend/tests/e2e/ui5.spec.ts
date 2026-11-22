import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { startDemo, choosePalette, backdropPoint } from './analysis-helpers';
import { auditPage } from './audit-helpers';

const widths = [320, 375, 768, 1024, 1440];
const palettes = ['Océano', 'Bosque', 'Lavanda', 'Ámbar', 'Rosa', 'Grafito'];
const desktopMatrix = (info: TestInfo) => !info.project.name.endsWith('mobile');
async function mode(page: Page, value: 'light' | 'dark') {
  if ((await page.locator('html').getAttribute('data-color-scheme')) !== value)
    await page.getByRole('button', { name: 'Modo oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-color-scheme',
    value,
  );
}
async function capture(page: Page, info: TestInfo, name: string) {
  if (info.project.name !== 'desktop') return;
  await page.screenshot({
    path: info.outputPath(`ui5-${name}.png`),
    fullPage: (await page.locator('dialog[open]').count()) === 0,
    animations: 'disabled',
  });
}
async function geometry(page: Page, name: string) {
  return page.evaluate((name) => {
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    const region = document.querySelector<HTMLElement>('.result-scroll');
    const row = region?.querySelector('tbody th');
    const dialogRect = dialog?.getBoundingClientRect();
    const contentRight =
      dialog && dialogRect
        ? dialogRect.left +
          dialog.clientLeft +
          dialog.clientWidth -
          parseFloat(getComputedStyle(dialog).paddingRight)
        : 0;
    const overflowing =
      dialog && dialogRect
        ? [...dialog.querySelectorAll<HTMLElement>('*')]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              for (
                let parent: Element | null = el;
                parent && parent !== dialog;
                parent = parent.parentElement
              ) {
                if (getComputedStyle(parent).position === 'fixed') return false;
              }
              return (
                r.width > 0 &&
                r.right > contentRight + 1 &&
                !el.closest('.detail-tabs')
              );
            })
            .slice(0, 8)
            .map((el) => ({
              tag: el.tagName,
              className: el.className,
              text: el.textContent?.trim().slice(0, 100),
              width: el.getBoundingClientRect().width,
              whiteSpace: getComputedStyle(el).whiteSpace,
            }))
        : [];
    return {
      name,
      width: innerWidth,
      font: parseFloat(getComputedStyle(document.documentElement).fontSize),
      documentWidth: document.documentElement.scrollWidth,
      dialog: dialog
        ? {
            width: dialog.clientWidth,
            scrollWidth: dialog.scrollWidth,
            overflowing,
          }
        : null,
      table:
        region && row
          ? {
              width: region.clientWidth,
              stickyWidth: row.getBoundingClientRect().width,
            }
          : null,
    };
  }, name);
}
async function demo(page: Page) {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/?fuente=demo');
  await startDemo(page);
  await expect(
    page.getByText('Análisis completado con observaciones', { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test('UI5 · diseño integrado a cinco anchuras, dos modos y texto al 200 por ciento', async ({
  page,
  browser,
}, info) => {
  test.skip(
    !desktopMatrix(info),
    'La matriz de cinco anchuras se ejecuta una vez por motor; los otros recorridos cubren los proyectos móviles.',
  );
  test.setTimeout(180000);
  await demo(page);
  const samples: Awaited<ReturnType<typeof geometry>>[] = [];
  const failures: string[] = [];
  async function inspect(name: string) {
    const sample = await geometry(page, name);
    samples.push(sample);
    if (sample.documentWidth > sample.width + 1)
      failures.push(
        `${name}: overflow del documento ${sample.documentWidth}/${sample.width}`,
      );
    if (sample.dialog && sample.dialog.scrollWidth > sample.dialog.width + 1) {
      failures.push(
        `${name}: overflow del modal ${sample.dialog.scrollWidth}/${sample.dialog.width}; ${JSON.stringify(sample.dialog.overflowing)}`,
      );
      await capture(page, info, `fallo-${name}`);
    }
    if (
      name.startsWith('resultados') &&
      sample.table &&
      sample.table.stickyWidth >= sample.table.width * 0.7
    )
      failures.push(
        `${name}: la empresa fija ocupa ${Math.round(sample.table.stickyWidth)}/${sample.table.width}px y tapa las cifras`,
      );
  }
  try {
    for (const scheme of ['light', 'dark'] as const) {
      await mode(page, scheme);
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        for (const scale of [1, 2]) {
          await page.evaluate((scale) => {
            document.documentElement.style.fontSize = `${scale * 100}%`;
          }, scale);
          const suffix = `${scheme}-${width}-${scale * 100}`;
          await inspect(`resultados-${suffix}`);
          if ([375, 1440].includes(width) && scale === 1)
            await capture(page, info, `resultados-${suffix}`);
          const company = page.getByRole('link', {
            name: 'Industrial Aurora',
            exact: true,
          });
          await company.click();
          const detail = page.getByRole('dialog', {
            name: 'Industrial Aurora',
            exact: true,
          });
          await expect(
            detail.getByRole('heading', { name: 'Métodos' }),
          ).toBeVisible();
          await expect(
            detail.locator('details:not(#palette-switcher)'),
          ).toHaveCount(0);
          await inspect(`detalle-${suffix}`);
          if (width === 320 && scale === 2) {
            const methodsTable = detail.locator('.methods-table');
            await methodsTable.evaluate((table) => {
              table.style.letterSpacing = '0.12em';
            });
            await inspect(`detalle-espaciado-${suffix}`);
            await methodsTable.scrollIntoViewIfNeeded();
            await capture(page, info, `detalle-espaciado-${suffix}`);
          }
          if ([375, 1440].includes(width) && scale === 1)
            await capture(page, info, `detalle-${suffix}`);
          await detail.getByRole('button', { name: 'Cerrar detalle' }).click();
          await expect(company).toBeFocused();
          await page
            .getByRole('button', { name: 'Ajustes de valoración' })
            .click();
          const settings = page.getByRole('dialog', {
            name: 'Ajustes de valoración',
          });
          await expect(settings.getByRole('spinbutton')).toHaveCount(9);
          await expect(
            settings.locator('details:not(#palette-switcher)'),
          ).toHaveCount(0);
          const save = settings.getByRole('button', {
            name: 'Guardar',
            exact: true,
          });
          await save.scrollIntoViewIfNeeded();
          const usable = await save.evaluate((el) => {
            const r = el.getBoundingClientRect(),
              hit = document.elementFromPoint(
                r.x + r.width / 2,
                r.y + r.height / 2,
              );
            return hit !== null && el.contains(hit);
          });
          if (!usable)
            failures.push(
              `ajustes-${suffix}: Apariencia u otro elemento tapa Guardar`,
            );
          await inspect(`ajustes-${suffix}`);
          if (
            (width === 375 && scale === 1) ||
            (width === 768 && scale === 2) ||
            !usable
          )
            await capture(page, info, `ajustes-${suffix}`);
          await page.keyboard.press('Escape');
          await expect(settings).not.toBeVisible();
          await page.getByRole('button', { name: 'Editar selección' }).click();
          await inspect(`seleccion-${suffix}`);
          if ([375, 1440].includes(width) && scale === 1)
            await capture(page, info, `seleccion-${suffix}`);
          await page
            .getByRole('link', { name: 'Historial', exact: true })
            .click();
          await inspect(`historial-${suffix}`);
          if ([375, 1440].includes(width) && scale === 1)
            await capture(page, info, `historial-${suffix}`);
          await page
            .getByRole('link', { name: 'Resultados', exact: true })
            .click();
        }
      }
    }
    await page.evaluate(() =>
      document.documentElement.style.removeProperty('font-size'),
    );
    await page.goto('/metodologia/');
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      await expect(page.getByRole('heading', { level: 2 })).toHaveCount(5);
      await expect(page.locator('main details')).toHaveCount(0);
      await inspect(`calculo-${width}-200`);
      if ([375, 1440].includes(width))
        await capture(
          page,
          info,
          `calculo-${await page.locator('html').getAttribute('data-color-scheme')}-${width}-200`,
        );
    }
  } finally {
    await writeFile(
      info.outputPath('ui5-layout.json'),
      JSON.stringify(
        {
          browser: browser.version(),
          project: info.project.name,
          viewport: page.viewportSize(),
          samples,
          failures,
        },
        null,
        2,
      ),
    );
  }
  expect(failures).toEqual([]);
});

test('UI5 · seis paletas y colores extremos en claro y oscuro, sin otro análisis', async ({
  page,
  browser,
}, info) => {
  test.skip(
    !desktopMatrix(info),
    'Cada motor recorre todas las paletas una vez.',
  );
  test.setTimeout(180000);
  let posts = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/analyses')) posts++;
  });
  await demo(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole('link', { name: 'Industrial Aurora', exact: true })
    .click();
  const detail = page.getByRole('dialog', {
    name: 'Industrial Aurora',
    exact: true,
  });
  const samples: unknown[] = [];
  for (const scheme of ['light', 'dark'] as const) {
    await mode(page, scheme);
    for (const color of [...palettes, '#000000', '#ffffff', '#ff0000']) {
      const picker = detail.locator('#palette-switcher');
      if (!(await picker.getAttribute('open')))
        await picker.locator('summary').click();
      if (color.startsWith('#'))
        await page.getByLabel('Color personalizado').fill(color);
      else await choosePalette(page, color);
      await expect(detail).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(detail).toBeVisible();
      const audit = await auditPage(page);
      samples.push({
        mode: scheme,
        color,
        violations: audit.violations,
        incomplete: audit.incomplete.map((v) => v.id),
      });
      await writeFile(
        info.outputPath('ui5-palettes.json'),
        JSON.stringify({ browser: browser.version(), samples }, null, 2),
      );
      expect.soft(audit.violations, `${scheme}/${color}`).toEqual([]);
      if (['Océano', 'Grafito', '#ffffff', '#000000'].includes(color))
        await capture(page, info, `paleta-${scheme}-${color.replace('#', '')}`);
    }
  }
  expect(posts).toBe(1);
});

test('UI5 · cierre exterior, arrastres y Apariencia dentro del modal conservan el borrador', async ({
  page,
}) => {
  await demo(page);
  const trigger = page.getByRole('button', { name: 'Ajustes de valoración' });
  await trigger.click();
  const settings = page.getByRole('dialog', { name: 'Ajustes de valoración' });
  await settings
    .getByLabel('Tasa de descuento (%)', { exact: true })
    .fill('15');
  const bounds = (await settings.boundingBox())!;
  const outside = await backdropPoint(page, settings);
  await page.mouse.click(bounds.x + 8, bounds.y + 20);
  await expect(settings).toBeVisible();
  await page.mouse.move(bounds.x + 8, bounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(outside.x, outside.y);
  await page.mouse.up();
  await expect(settings).toBeVisible();
  await page.mouse.move(outside.x, outside.y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 8, bounds.y + 20);
  await page.mouse.up();
  await expect(settings).toBeVisible();
  const picker = settings.locator('#palette-switcher');
  await picker.locator('summary').click();
  await choosePalette(page, 'Lavanda');
  await expect(settings).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(settings).toBeVisible();
  await page.mouse.click(outside.x, outside.y);
  await expect(settings).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(
    settings.getByLabel('Tasa de descuento (%)', { exact: true }),
  ).toHaveValue('10');
});

test('UI5 · vidrio CSS sin Canvas y preferencias de contraste/movimiento', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => {
      throw new Error('Canvas no disponible en esta prueba');
    };
  });
  await page.emulateMedia({
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    contrast: 'more',
  });
  await page.goto('/?fuente=demo');
  await startDemo(page);
  await expect(
    page
      .getByRole('table', { name: 'Resultados por empresa' })
      .getByRole('rowheader'),
  ).toHaveCount(3);
  await expect(page.locator('svg.liquid-scene')).toHaveCount(1);
  await page.getByRole('button', { name: 'Ajustes de valoración' }).click();
  await expect(page.getByRole('dialog').getByRole('spinbutton')).toHaveCount(9);
  const filter = await page
    .locator('#scheme-toggle')
    .evaluate((el) => getComputedStyle(el).backdropFilter);
  expect(filter).toBe('none');
  await capture(page, info, 'contraste-reducido');
  await page.keyboard.press('Escape');
  let transparency = 'not-emulated';
  if (info.project.name === 'desktop') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    });
    expect(
      await page.evaluate(
        () => matchMedia('(prefers-reduced-transparency: reduce)').matches,
      ),
    ).toBe(true);
    expect(
      await page
        .locator('.app-sidebar')
        .evaluate((el) => getComputedStyle(el).backdropFilter),
    ).toBe('none');
    transparency = 'reduce-checked';
  }
  await page.emulateMedia({ forcedColors: 'active' });
  const forced = await page.evaluate(
    () => matchMedia('(forced-colors: active)').matches,
  );
  if (forced) await expect(page.locator('.liquid-scene')).not.toBeVisible();
  else
    info.annotations.push({
      type: 'capability',
      description:
        'Este motor no emula forced-colors; comprobación efectiva en Chromium.',
    });
  if (info.project.name === 'desktop') expect(forced).toBe(true);
  await writeFile(
    info.outputPath('ui5-media.json'),
    JSON.stringify({ forcedColorsEmulated: forced, transparency }, null, 2),
  );
  await expect(
    page.getByRole('button', { name: 'Excel', exact: true }),
  ).toBeEnabled();
});

test('UI5 · gráficas conservan unidades, contraste y tamaño de texto ampliado', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  await demo(page);
  await page
    .getByRole('link', { name: 'Industrial Aurora', exact: true })
    .click();
  const detail = page.getByRole('dialog', {
    name: 'Industrial Aurora',
    exact: true,
  });
  const samples: unknown[] = [];
  const failures: string[] = [];
  for (const profile of [
    { width: 375, scale: 2, scheme: 'dark' as const },
    { width: 1440, scale: 1, scheme: 'light' as const },
  ]) {
    await page.setViewportSize({ width: profile.width, height: 1000 });
    await page.evaluate((scale) => {
      document.documentElement.style.fontSize = `${scale * 100}%`;
    }, profile.scale);
    await mode(page, profile.scheme);
    for (const tab of ['Precio histórico', 'Finanzas', 'Márgenes']) {
      await detail.getByRole('tab', { name: tab, exact: true }).click();
      const figure = detail.getByRole('figure');
      await expect(figure).toBeVisible();
      if (tab === 'Márgenes') {
        const provenance = detail
          .locator('.detail-note')
          .filter({ hasText: 'Consulta' });
        await expect(provenance).toContainText('Porcentaje de los ingresos');
        await expect(provenance).not.toContainText('Millones');
      }
      const ticks = figure.locator('.recharts-cartesian-axis-tick-value');
      await expect(ticks.first()).toBeVisible();
      const sizes = await ticks.evaluateAll((nodes) =>
        nodes.map((el) => parseFloat(getComputedStyle(el).fontSize)),
      );
      const expectedColor = await page.evaluate(() => {
        const sample = document.createElement('span');
        sample.style.color = 'var(--chart-label)';
        document.body.append(sample);
        const color = getComputedStyle(sample).color;
        sample.remove();
        return color;
      });
      const tickColors = await ticks.evaluateAll((nodes) =>
        nodes.map((el) => getComputedStyle(el).fill),
      );
      if (tickColors.some((color) => color !== expectedColor))
        failures.push(
          `${tab}: ejes sin color del tema (${tickColors.join(',')})`,
        );
      if (sizes.some((size) => size < 16 * profile.scale))
        failures.push(
          `${profile.width}/${profile.scheme}/${tab}: ejes sin ampliar (${sizes.join(',')})`,
        );
      const clippedTicks = () =>
        ticks.evaluateAll((nodes) =>
          nodes.flatMap((el) => {
            const text = el.getBoundingClientRect();
            const svg = el.closest('svg')!.getBoundingClientRect();
            return text.left < svg.left - 1 ||
              text.right > svg.right + 1 ||
              text.top < svg.top - 1 ||
              text.bottom > svg.bottom + 1
              ? [el.textContent]
              : [];
          }),
        );
      await figure.locator('.chart-canvas').scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      await capture(
        page,
        info,
        `grafica-${profile.width}-${profile.scheme}-${tab.replaceAll(' ', '-')}`,
      );
      try {
        await expect
          .poll(clippedTicks, { message: `${tab}: cifras del eje recortadas` })
          .toEqual([]);
      } finally {
        const axes = await ticks.evaluateAll((nodes) =>
          nodes.map((el) => ({
            text: el.textContent,
            bounds: el.getBoundingClientRect().toJSON(),
            svg: el.closest('svg')!.getBoundingClientRect().toJSON(),
            font: getComputedStyle(el).font,
          })),
        );
        await writeFile(
          info.outputPath(
            `ui5-ejes-${profile.width}-${tab.replaceAll(' ', '-')}.json`,
          ),
          JSON.stringify(axes, null, 2),
        );
      }
      const horizontal = await figure
        .locator('.recharts-xAxis-tick-labels text')
        .evaluateAll((nodes) =>
          nodes
            .map((el) => {
              const r = el.getBoundingClientRect();
              return { left: r.left, right: r.right };
            })
            .sort((a, b) => a.left - b.left),
        );
      for (let i = 1; i < horizontal.length; i++) {
        const gap = horizontal[i]!.left - horizontal[i - 1]!.right;
        if (gap < 8)
          failures.push(
            `${profile.width}/${tab}: etiquetas contiguas separadas sólo ${gap.toFixed(2)} px`,
          );
      }
      const state = await geometry(page, `${tab}-${profile.width}`);
      if (
        state.documentWidth > state.width + 1 ||
        (state.dialog && state.dialog.scrollWidth > state.dialog.width + 1)
      )
        failures.push(`${tab}: la gráfica desborda`);
      const canvas = figure.locator('.chart-canvas');
      const canvasBounds = (await canvas.boundingBox())!;
      await canvas.hover({
        position: { x: canvasBounds.width * 0.7, y: canvasBounds.height * 0.5 },
      });
      const tooltip = figure.locator('.recharts-tooltip-wrapper');
      await expect(tooltip).toBeVisible();
      const tooltipBounds = (await tooltip.boundingBox())!;
      expect(
        tooltipBounds.x,
        `${tab}: tooltip cortado a la izquierda`,
      ).toBeGreaterThanOrEqual(canvasBounds.x - 1);
      expect(
        tooltipBounds.x + tooltipBounds.width,
        `${tab}: tooltip cortado a la derecha`,
      ).toBeLessThanOrEqual(canvasBounds.x + canvasBounds.width + 1);
      await capture(
        page,
        info,
        `tooltip-${profile.width}-${tab.replaceAll(' ', '-')}`,
      );
      if (
        !(await figure
          .locator('details.chart-data')
          .evaluate((el) => (el as HTMLDetailsElement).open))
      )
        await figure.locator('summary').click();
      await expect(figure.getByRole('table')).toBeVisible();
      samples.push({ profile, tab, sizes, geometry: state });
    }
  }
  await writeFile(
    info.outputPath('ui5-charts.json'),
    JSON.stringify({ samples, failures }, null, 2),
  );
  expect(failures).toEqual([]);
});
