import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getByRole } from '@testing-library/dom';
import markup from '../../components/Appearance.astro?raw';
import { initAppearance, paletteTokens, presets } from './appearance';

let dispose: (() => void) | undefined;
let preference: EventTarget & { matches: boolean };
beforeEach(() => {
  document.head.innerHTML =
    '<meta name="color-scheme" content="light dark"><meta name="theme-color" content="#d7eaf2">';
  document.documentElement.removeAttribute('style');
  localStorage.clear();
  document.body.innerHTML = markup;
  preference = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal('matchMedia', () => preference);
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});
const toggle = () =>
  getByRole(document.body, 'button', { name: 'Modo oscuro' });
const scheme = () =>
  document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')!.content;
const open = () => {
  document.querySelector<HTMLDetailsElement>('#palette-switcher')!.open = true;
};

it('restaura paleta y modo por separado y cambiar apariencia conserva el análisis', () => {
  localStorage.setItem(
    'intval-liquid-glass-palette-v1',
    JSON.stringify({ id: 'forest' }),
  );
  localStorage.setItem('intval-liquid-glass-scheme-v1', 'dark');
  sessionStorage.setItem('analysis-guard', 'snapshot');
  dispose = initAppearance();
  expect(document.documentElement.dataset.palette).toBe('forest');
  expect(toggle().getAttribute('aria-pressed')).toBe('true');
  open();
  getByRole(document.body, 'radio', { name: 'Lavanda' }).click();
  expect(scheme()).toBe('dark');
  expect(
    JSON.parse(localStorage.getItem('intval-liquid-glass-palette-v1')!),
  ).toEqual({ id: 'lavender' });
  toggle().click();
  expect(scheme()).toBe('light dark');
  expect(localStorage.getItem('intval-liquid-glass-scheme-v1')).toBeNull();
  expect(document.documentElement.dataset.palette).toBe('lavender');
  expect(sessionStorage.getItem('analysis-guard')).toBe('snapshot');
});

it('sigue el sistema, conserva un override al cambiar el sistema y sincroniza otras pestañas', () => {
  preference.matches = true;
  dispose = initAppearance();
  expect(toggle().getAttribute('aria-pressed')).toBe('true');
  toggle().click();
  expect(scheme()).toBe('light');
  preference.matches = false;
  preference.dispatchEvent(new Event('change'));
  expect(scheme()).toBe('light');
  expect(localStorage.getItem('intval-liquid-glass-scheme-v1')).toBe('light');
  preference.matches = true;
  preference.dispatchEvent(new Event('change'));
  toggle().click();
  expect(scheme()).toBe('light dark');
  preference.matches = false;
  preference.dispatchEvent(new Event('change'));
  expect(toggle().getAttribute('aria-pressed')).toBe('false');
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: 'intval-liquid-glass-scheme-v1',
      newValue: 'dark',
    }),
  );
  expect(scheme()).toBe('dark');
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
  expect(scheme()).toBe('light dark');
});

it('personaliza, confirma, descarta preferencias inválidas y funciona si el almacenamiento falla', () => {
  localStorage.setItem('intval-liquid-glass-palette-v1', '{malformed');
  localStorage.setItem('intval-liquid-glass-scheme-v1', 'invalid');
  dispose = initAppearance();
  expect(document.documentElement.dataset.palette).toBe('ocean');
  open();
  const color = document.querySelector<HTMLInputElement>('#palette-custom')!;
  color.value = '#8254d8';
  color.dispatchEvent(new Event('input', { bubbles: true }));
  expect(document.documentElement.dataset.palette).toBe('custom');
  expect(localStorage.getItem('intval-liquid-glass-palette-v1')).toBe(
    '{malformed',
  );
  color.dispatchEvent(new Event('change', { bubbles: true }));
  expect(
    JSON.parse(localStorage.getItem('intval-liquid-glass-palette-v1')!),
  ).toEqual({ id: 'custom', color: '#8254d8' });
  dispose();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  dispose = initAppearance();
  toggle().click();
  expect(toggle().getAttribute('aria-pressed')).toBe('true');
  toggle().click();
  expect(toggle().getAttribute('aria-pressed')).toBe('false');
});

it('cierra la paleta fuera y con Escape, y la lleva al diálogo activo sin perder sus controles', async () => {
  dispose = initAppearance();
  open();
  document.body.click();
  expect(
    document.querySelector<HTMLDetailsElement>('#palette-switcher')!.open,
  ).toBe(false);
  open();
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );
  expect(document.activeElement).toBe(
    document.querySelector('#palette-switcher > summary'),
  );
  const modal = document.createElement('dialog');
  document.body.append(modal);
  modal.open = true;
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(modal.contains(toggle())).toBe(true);
  toggle().click();
  modal.remove();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(toggle().parentElement).toBe(
    document.querySelector('#palette-controls'),
  );
  expect(document.querySelector('#palette-controls')!.parentElement).toBe(
    document.body,
  );
});

it('genera todas las paletas para ambos modos sin perder contraste de texto ni estados financieros', () => {
  const lum = (hex: string) =>
    hex
      .slice(1)
      .match(/../g)!
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
  const ratio = (a: string, b: string) =>
    (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  for (const seed of [
    ...Object.values(presets).map((p) => p.color),
    '#000000',
    '#ffffff',
    '#ffffdd',
  ]) {
    for (const dark of [false, true]) {
      const tokens = paletteTokens(seed, dark);
      expect(
        ratio(tokens['--accent-ink']!, tokens['--palette-pale']!),
      ).toBeGreaterThanOrEqual(4.5);
      expect(ratio('#ffffff', tokens['--accent']!)).toBeGreaterThanOrEqual(4.5);
      expect(tokens['--scene-base']).toMatch(/^#[a-f\d]{6}$/);
    }
  }
});
