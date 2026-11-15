import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

// Resuelve los tokens authored (también el fallback) sin afirmar una auditoría visual de navegador.
const css = await readFile(
  new URL('../src/styles/tokens.css', import.meta.url),
  'utf8',
);
function tokens(mode, modern) {
  const { document } = new JSDOM(
    `<meta name="color-scheme" content="${mode}"><style>${css}</style>`,
  ).window;
  const values = new Map();
  function walk(rules) {
    for (const rule of rules) {
      if (rule.selectorText) {
        if (!document.documentElement.matches(rule.selectorText)) continue;
        for (const name of rule.style)
          if (name.startsWith('--'))
            values.set(name, rule.style.getPropertyValue(name).trim());
      } else if (rule.conditionText?.includes('supports')) {
        throw new Error('Condición no reconocida');
      } else if (rule.constructor.name === 'CSSSupportsRule') {
        if (rule.conditionText.startsWith('not') !== modern)
          walk(rule.cssRules);
      } else if (rule.constructor.name === 'CSSMediaRule') {
        if (
          rule.conditionText === '(prefers-color-scheme: dark)' &&
          mode === 'dark'
        )
          walk(rule.cssRules);
      }
    }
  }
  walk(document.styleSheets[0].cssRules);
  function resolve(name) {
    let value = values.get(name) ?? name;
    value = value.replace(
      /light-dark\((#[0-9a-f]+),\s*(#[0-9a-f]+)\)/gi,
      (_, light, dark) => (mode === 'dark' ? dark : light),
    );
    return value.replace(/var\((--[\w-]+)(?:,[^)]+)?\)/g, (_, key) =>
      resolve(key),
    );
  }
  return resolve;
}
function luminance(hex) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
for (const mode of ['light', 'dark'])
  for (const modern of [true, false]) {
    test(`contraste de texto, estados y controles en ${mode}, light-dark=${modern}`, () => {
      const resolve = tokens(mode, modern);
      const pairs = [
        ['--ink', '--canvas'],
        ['--muted', '--canvas'],
        ['--ink', '--surface'],
        ['--muted', '--surface'],
        ['--primary', '--surface'],
        ['#ffffff', '--accent'],
        ['--negative', '--surface'],
        ['--positive', '--surface'],
        ['--warning', '--warning-surface'],
      ];
      const checks = [
        ...pairs.map(([fg, bg]) => [fg, bg, 4.5]),
        ...[
          '--blue',
          '--control-border',
          '--chart-blue',
          '--chart-teal',
          '--chart-amber',
          '--chart-purple',
          '--chart-revenue',
        ].map((fg) => [fg, '--surface', 3]),
      ];
      for (const [foreground, background, minimum] of checks) {
        const a = luminance(resolve(foreground)),
          b = luminance(resolve(background));
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        assert.ok(
          ratio >= minimum,
          `${foreground}/${background}: ${ratio.toFixed(2)} < ${minimum}`,
        );
      }
    });
  }
