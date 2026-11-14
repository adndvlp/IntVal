import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// WCAG: contraste de combinaciones críticas reales; axe revisa los estados renderizados.
test('texto, errores, controles y foco conservan contraste suficiente en la paleta normal', async () => {
  const css = await readFile(
    new URL('../src/styles/tokens.css', import.meta.url),
    'utf8',
  );
  const palette = Object.fromEntries(
    [...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [
      m[1],
      m[2],
    ]),
  );
  function luminance(hex) {
    const rgb = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  }
  const pairs = [
    ['ink', 'canvas', 4.5],
    ['muted', 'canvas', 4.5],
    ['ink', 'surface', 4.5],
    ['muted', 'surface', 4.5],
    ['primary', 'surface', 4.5],
    ['surface', 'primary', 4.5],
    ['negative', 'surface', 4.5],
    ['warning', 'surface', 4.5],
    ['on-dark', 'ink', 4.5],
    ['muted-on-dark', 'ink', 4.5],
    ['primary', 'canvas', 3],
    ['#76847c', 'surface', 3],
  ];
  for (const [foreground, background, minimum] of pairs) {
    const a = luminance(palette[foreground] ?? foreground),
      b = luminance(palette[background] ?? background);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(
      ratio >= minimum,
      `${foreground}/${background}: ${ratio.toFixed(2)} < ${minimum}`,
    );
  }
});
