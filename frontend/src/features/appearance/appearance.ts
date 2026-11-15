export const presets = {
  ocean: { label: 'Océano', color: '#0878d4' },
  forest: { label: 'Bosque', color: '#138565' },
  lavender: { label: 'Lavanda', color: '#8056d9' },
  amber: { label: 'Ámbar', color: '#c06d1a' },
  rose: { label: 'Rosa', color: '#c34d7b' },
  graphite: { label: 'Grafito', color: '#536171' },
} as const;
const paletteKey = 'intval-liquid-glass-palette-v1';
const schemeKey = 'intval-liquid-glass-scheme-v1';
const valid = (v: unknown): v is string =>
  typeof v === 'string' && /^#[a-f\d]{6}$/i.test(v);
const rgb = (hex: string) =>
  hex
    .slice(1)
    .match(/../g)!
    .map((v) => parseInt(v, 16));
const hex = (values: number[]) =>
  '#' + values.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, amount: number) =>
  hex(rgb(a).map((v, i) => v * (1 - amount) + rgb(b)[i]! * amount));
const rgba = (c: string, alpha: number) =>
  `rgb(${rgb(c).join(' ')} / ${alpha})`;
function contrast(color: string) {
  const [r, g, b] = rgb(color).map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 1.05 / (r! * 0.2126 + g! * 0.7152 + b! * 0.0722 + 0.05);
}
function readable(color: string, target = 5.4) {
  if (contrast(color) >= target) return color;
  let low = 0,
    high = 1;
  for (let i = 0; i < 16; i++) {
    const middle = (low + high) / 2;
    if (contrast(mix(color, '#000000', middle)) >= target) high = middle;
    else low = middle;
  }
  return mix(color, '#000000', high);
}
export function paletteTokens(
  input: string,
  dark: boolean,
): Record<string, string> {
  const seed = valid(input) ? input.toLowerCase() : presets.ocean.color;
  const accent = readable(seed);
  const complement = hex(rgb(seed).map((v) => 255 - v));
  const values: Record<string, string> = {
    '--blue': accent,
    '--accent': accent,
    '--accent-top': readable(seed, 4.8),
    '--accent-bottom': mix(accent, '#000000', 0.14),
    '--accent-soft': mix(seed, '#ffffff', 0.55),
    '--accent-ink': readable(seed, 9),
    '--accent-shadow': rgba(accent, 0.45),
    '--control-border': readable(mix(accent, '#ffffff', 0.2), 3.2),
    '--palette-tint': mix(seed, '#ffffff', 0.92),
    '--palette-pale': mix(seed, '#ffffff', 0.97),
    '--palette-line': mix(seed, '#ffffff', 0.84),
    '--line': mix(seed, '#ffffff', 0.84),
    '--subtle': mix(seed, '#ffffff', 0.94),
    '--blue-soft': mix(seed, '#ffffff', 0.92),
    '--glass': rgba(mix(seed, '#ffffff', 0.95), 0.78),
    '--glass-shadow': `0 24px 60px -20px ${rgba(accent, 0.23)}, 0 6px 18px -8px ${rgba(accent, 0.15)}, inset 0 1px 0 #ffffffed, inset 0 -1px 0 #ffffff80`,
    '--scene-base': mix(seed, '#ffffff', 0.88),
    '--scene-sky-1': mix(seed, '#ffffff', 0.83),
    '--scene-sky-2': mix(seed, '#ffffff', 0.96),
    '--scene-sky-3': mix(seed, '#ffffff', 0.86),
    '--scene-tide-1': mix(seed, '#000000', 0.32),
    '--scene-tide-2': mix(seed, '#ffffff', 0.38),
    '--scene-tide-3': mix(seed, '#ffffff', 0.85),
    '--scene-swell-1': mix(seed, '#ffffff', 0.65),
    '--scene-swell-2': mix(seed, '#ffffff', 0.94),
    '--scene-sun': mix(complement, '#ffffff', 0.8),
    '--scene-wash': mix(seed, '#ffffff', 0.8),
  };
  if (seed === presets.ocean.color && !dark)
    Object.assign(values, {
      '--scene-base': '#d7eaf2',
      '--scene-sky-1': '#c5e6ee',
      '--scene-sky-2': '#eef5f8',
      '--scene-sky-3': '#cbddec',
      '--scene-tide-1': '#246e97',
      '--scene-tide-2': '#58aeca',
      '--scene-tide-3': '#d3f1f3',
      '--scene-swell-1': '#b1d2e6',
      '--scene-swell-2': '#e5f6f7',
      '--scene-sun': '#ffe7cf',
      '--scene-wash': '#d4e7f4',
      '--glass': 'rgb(245 253 255 / .78)',
    });
  if (dark)
    Object.assign(values, {
      '--blue': mix(seed, '#ffffff', 0.62),
      '--accent-soft': mix(seed, '#ffffff', 0.56),
      '--accent-ink': mix(seed, '#ffffff', 0.78),
      '--control-border': mix(seed, '#ffffff', 0.52),
      '--palette-tint': mix(seed, '#1c2c3d', 0.9),
      '--palette-pale': mix(seed, '#151f2b', 0.97),
      '--palette-line': mix(seed, '#526376', 0.88),
      '--line': mix(seed, '#526376', 0.88),
      '--subtle': mix(seed, '#213043', 0.95),
      '--blue-soft': mix(seed, '#1c2c3d', 0.9),
      '--glass': rgba(mix(seed, '#101c2a', 0.96), 0.88),
      '--glass-shadow':
        '0 24px 60px -20px #00000099, 0 6px 18px -8px #00000066, inset 0 1px 0 #ffffff26, inset 0 -1px 0 #ffffff0f',
      '--scene-base': mix(seed, '#080e17', 0.96),
      '--scene-sky-1': mix(seed, '#080e17', 0.92),
      '--scene-sky-2': mix(seed, '#142130', 0.94),
      '--scene-sky-3': mix(seed, '#101e2b', 0.94),
      '--scene-tide-1': mix(seed, '#060b12', 0.84),
      '--scene-tide-2': mix(seed, '#172d40', 0.78),
      '--scene-tide-3': mix(seed, '#0d1925', 0.91),
      '--scene-swell-1': mix(seed, '#1c3449', 0.94),
      '--scene-swell-2': mix(seed, '#152737', 0.95),
      '--scene-sun': mix(complement, '#172130', 0.96),
      '--scene-wash': mix(seed, '#102030', 0.93),
    });
  return values;
}

export function initAppearance() {
  const root = document.documentElement;
  const controls = document.querySelector<HTMLElement>('#palette-controls');
  const picker =
    document.querySelector<HTMLDetailsElement>('#palette-switcher');
  const color = document.querySelector<HTMLInputElement>('#palette-custom');
  const toggle = document.querySelector<HTMLButtonElement>('#scheme-toggle');
  const scheme = document.querySelector<HTMLMetaElement>(
    'meta[name="color-scheme"]',
  );
  if (!controls || !picker || !color || !toggle || !scheme) return () => {};
  const system = window.matchMedia?.('(prefers-color-scheme: dark)');
  const dark = () =>
    scheme.content === 'dark' ||
    (scheme.content !== 'light' && !!system?.matches);
  const read = (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const storedScheme = read(schemeKey);
  scheme.content =
    storedScheme === 'light' || storedScheme === 'dark'
      ? storedScheme
      : 'light dark';
  const abort = new AbortController();
  const signal = abort.signal;
  let active = { id: 'ocean', color: presets.ocean.color as string };
  function apply(id: string, seed: unknown, save: boolean) {
    const preset = Object.hasOwn(presets, id)
      ? presets[id as keyof typeof presets]
      : null;
    active = preset
      ? { id, color: preset.color }
      : id === 'custom' && valid(seed)
        ? { id, color: seed.toLowerCase() }
        : { id: 'ocean', color: presets.ocean.color };
    for (const [key, value] of Object.entries(
      paletteTokens(active.color, dark()),
    ))
      root.style.setProperty(key, value);
    root.dataset.palette = active.id;
    root.dataset.colorScheme = dark() ? 'dark' : 'light';
    toggle!.setAttribute('aria-pressed', String(dark()));
    toggle!.title = dark() ? 'Usar modo claro' : 'Usar modo oscuro';
    document.querySelector('#palette-current')!.textContent =
      active.id === 'custom'
        ? 'Personalizada'
        : presets[active.id as keyof typeof presets].label;
    controls!
      .querySelectorAll<HTMLInputElement>('input[name="palette"]')
      .forEach((input) => {
        input.checked = input.value === active.id;
      });
    color!.value = active.color;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', root.style.getPropertyValue('--scene-base'));
    if (save)
      try {
        localStorage.setItem(
          paletteKey,
          JSON.stringify(
            active.id === 'custom'
              ? { id: active.id, color: active.color }
              : { id: active.id },
          ),
        );
      } catch {
        /* The selection still applies for this visit. */
      }
  }
  let saved: { id?: string; color?: unknown } | null = null;
  try {
    saved = JSON.parse(read(paletteKey) || 'null');
  } catch {
    /* Invalid preferences use Ocean. */
  }
  apply(
    typeof saved?.id === 'string' ? saved.id : 'ocean',
    saved?.color,
    false,
  );
  const refresh = () => apply(active.id, active.color, false);
  toggle.addEventListener(
    'click',
    () => {
      const target = dark() ? 'light' : 'dark';
      const override =
        target === (system?.matches ? 'dark' : 'light') ? null : target;
      scheme.content = override || 'light dark';
      try {
        if (override) localStorage.setItem(schemeKey, override);
        else localStorage.removeItem(schemeKey);
      } catch {
        /* No persistence is required to switch. */
      }
      refresh();
    },
    { signal },
  );
  system?.addEventListener('change', refresh, { signal });
  window.addEventListener(
    'storage',
    (event) => {
      if (event.key !== schemeKey && event.key !== null) return;
      scheme.content =
        event.newValue === 'dark' || event.newValue === 'light'
          ? event.newValue
          : 'light dark';
      refresh();
    },
    { signal },
  );
  controls.addEventListener(
    'change',
    (event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement && input.name === 'palette')
        apply(input.value, color.value, true);
    },
    { signal },
  );
  color.addEventListener('input', () => apply('custom', color.value, false), {
    signal,
  });
  color.addEventListener('change', () => apply('custom', color.value, true), {
    signal,
  });
  document.addEventListener(
    'click',
    (event) => {
      if (picker.open && !controls.contains(event.target as Node))
        picker.open = false;
    },
    { signal },
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && picker.open) {
        event.preventDefault();
        picker.open = false;
        picker.querySelector<HTMLElement>('summary')!.focus();
      }
    },
    { signal },
  );
  function mount() {
    const owner =
      [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(
        -1,
      ) ?? document.body;
    if (controls!.parentElement !== owner) owner.append(controls!);
  }
  const observer = new MutationObserver(mount);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['open'],
  });
  mount();
  return () => {
    abort.abort();
    observer.disconnect();
  };
}
