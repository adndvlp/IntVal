import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';

declare global {
  interface Window {
    __f10: {
      lcp: number | null;
      shifts: { time: number; value: number }[];
      events: { id: number; duration: number }[];
    };
  }
}

test('laboratorio móvil: tres visitas frías, estabilidad y respuesta de filtros', async ({
  browser,
}, info) => {
  test.skip(
    info.project.name !== 'desktop',
    'La medición CDP se ejecuta una vez en Chromium; funcionalidad en los tres motores.',
  );
  test.setTimeout(120000);
  const samples = [];
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:4321',
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    await context.addInitScript(() => {
      window.__f10 = { lcp: null, shifts: [], events: [] };
      new PerformanceObserver((list) => {
        const last = list.getEntries().at(-1);
        if (last) window.__f10.lcp = last.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const raw of list.getEntries()) {
          const entry = raw as PerformanceEntry & {
            hadRecentInput: boolean;
            value: number;
          };
          if (!entry.hadRecentInput)
            window.__f10.shifts.push({
              time: entry.startTime,
              value: entry.value,
            });
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        for (const raw of list.getEntries()) {
          const entry = raw as PerformanceEntry & { interactionId: number };
          if (entry.interactionId)
            window.__f10.events.push({
              id: entry.interactionId,
              duration: entry.duration,
            });
        }
      }).observe({
        type: 'event',
        buffered: true,
        durationThreshold: 16,
      } as PerformanceObserverInit);
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => window.__f10.lcp !== null);
    const landing = await page.evaluate(() => {
      // Ventanas CLS de hasta cinco segundos y sin huecos mayores de un segundo.
      let maximum = 0,
        sum = 0,
        first = 0,
        last = 0;
      for (const shift of window.__f10.shifts) {
        if (shift.time - last > 1000 || shift.time - first > 5000) {
          sum = 0;
          first = shift.time;
        }
        sum += shift.value;
        maximum = Math.max(maximum, sum);
        last = shift.time;
      }
      return { lcpMs: window.__f10.lcp, cls: maximum };
    });
    expect(landing.lcpMs).toBeLessThanOrEqual(2500);
    expect(landing.cls).toBeLessThanOrEqual(0.1);
    await page.goto('/app/?fuente=market');
    await expect(
      page.getByText('Servicio conectado', { exact: true }),
    ).toBeVisible();
    const initialJs = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((p) => p.endsWith('.js')),
    );
    expect(initialJs.some((p) => /Charts[.]/.test(p))).toBe(false);
    await page.goto('/app/?fuente=demo');
    await expect(
      page.getByText('Análisis completado con observaciones', { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('[data-chart="comparison"]').getByRole('application'),
    ).toBeVisible();
    await page.waitForLoadState('networkidle');
    const paint = [];
    for (let i = 0; i < 4; i++)
      paint.push(
        await page
          .getByLabel('Filtrar por upside mínimo')
          .evaluate(async (el) => {
            const before = performance.now();
            (el as HTMLInputElement).click();
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            );
            return performance.now() - before;
          }),
      );
    await page.waitForLoadState('networkidle');
    const events = await page.evaluate(() => window.__f10.events);
    samples.push({
      run: run + 1,
      landing,
      filterActionToTwoFramesMs: paint,
      eventTimingSamples: events,
      initialJs,
    });
    expect(Math.max(...paint)).toBeLessThanOrEqual(200);
    await context.close();
  }
  const report = {
    schema: 'intval-browser-performance-1',
    environment: {
      browser: browser.version(),
      os: process.platform,
      machine: os.arch(),
      logicalCpus: os.cpus().length,
      cpuModel: os.cpus()[0]?.model,
    },
    profile: {
      viewport: { width: 390, height: 844 },
      cpuSlowdown: 4,
      network: 'localhost sin limitación de red',
      cache: 'nuevo contexto y caché HTTP deshabilitada por muestra',
      samples: 3,
      reducedMotion: true,
    },
    interpretation:
      'Mediciones de laboratorio, sin datos de campo. Event Timing conserva muestras cuando existen. El tiempo de click DOM a dos frames es un indicador de respuesta de filtros, no INP de usuarios reales.',
    samples,
  };
  const output = info.outputPath('performance.json');
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  await info.attach('performance', {
    path: output,
    contentType: 'application/json',
  });
});
