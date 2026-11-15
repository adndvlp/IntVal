import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { JSDOM, VirtualConsole } from 'jsdom';
import { getByRole, getAllByRole } from '@testing-library/dom';

const file = new URL(
  '../../prototipo-intval-liquid-glass.html',
  import.meta.url,
);
async function openGlass({
  reduced = false,
  noCanvas = false,
  palette,
  storageUnavailable = false,
  companyCount,
  completed = false,
  xlsx,
  mutateCompanies,
  scheme,
  systemDark = false,
} = {}) {
  let source = await readFile(file, 'utf8');
  let companies;
  let systemPreference;
  if (companyCount) {
    source = source.replace(
      /(<script id="demo-data" type="application\/json">)([\s\S]*?)(<\/script>)/,
      (_, start, json, end) => {
        const data = JSON.parse(json);
        const base = data.companies[0];
        companies = Array.from({ length: companyCount }, (_, i) => ({
          ...base,
          ticker: `ESC-${String(i).padStart(4, '0')}`,
          company_name: `Empresa ${String(i).padStart(4, '0')}`,
          market: i % 2 ? 'MX' : 'USA',
          currency: i % 2 ? 'MXN' : 'USD',
          market_price: i + 10,
          median: {
            ...base.median,
            value_per_share: i + 20,
            upside: i / 10000,
          },
          audit_fields: [],
          prices: { items: [] },
          financials: { items: [], margins: { items: [] } },
        }));
        mutateCompanies?.(companies);
        return start + JSON.stringify({ ...data, companies }) + end;
      },
    );
  }
  const idle = [],
    maps = [],
    errors = [];
  let canvasCalls = 0;
  const console = new VirtualConsole();
  console.on('jsdomError', (error) => errors.push(error.message));
  const original = JSON.stringify({
    initialized: true,
    selected: ['DEMO-USA'],
    jobs: [],
    current: null,
  });
  const dom = new JSDOM(source, {
    url: 'https://glass.example/',
    runScripts: 'dangerously',
    virtualConsole: console,
    beforeParse(window) {
      window.scrollTo = () => {};
      window.CSS = { supports: () => true };
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36',
      });
      systemPreference = new window.EventTarget();
      systemPreference.matches = systemDark;
      window.matchMedia = (query) =>
        query.includes('prefers-color-scheme')
          ? systemPreference
          : {
              matches:
                reduced && query.includes('prefers-reduced-transparency'),
            };
      window.requestIdleCallback = (callback) => {
        idle.push(callback);
        return idle.length;
      };
      window.cancelIdleCallback = () => {};
      window.ResizeObserver = class {
        constructor(callback) {
          this.callback = callback;
        }
        observe() {
          this.callback();
        }
        disconnect() {}
      };
      window.HTMLElement.prototype.getBoundingClientRect = function () {
        return this.classList.contains('header')
          ? { width: 238, height: 620 }
          : { width: 0, height: 0 };
      };
      window.HTMLCanvasElement.prototype.getContext = () => {
        canvasCalls++;
        if (noCanvas) return null;
        return {
          createImageData(width, height) {
            const map = {
              width,
              height,
              data: new Uint8ClampedArray(width * height * 4),
            };
            maps.push(map);
            return map;
          },
          putImageData() {},
        };
      };
      window.HTMLCanvasElement.prototype.toDataURL = () =>
        'data:image/png;base64,iVBORw0KGgo=';
      window.HTMLDialogElement.prototype.showModal = function () {
        this.open = true;
      };
      window.HTMLDialogElement.prototype.close = function () {
        this.open = false;
        this.dispatchEvent(new window.Event('close'));
      };
      window.localStorage.setItem('intval-design-preview-v1', original);
      if (xlsx) window.XLSX = xlsx;
      if (completed) {
        const ids = companies.map((company) => company.ticker);
        window.localStorage.setItem(
          'intval-liquid-glass-preview-v1',
          JSON.stringify({
            initialized: true,
            selected: ids,
            current: 'large',
            jobs: [
              {
                id: 'large',
                ids,
                status: 'completed',
                processed: ids.length,
                created: '2026-11-14T10:00:00Z',
                config: {},
              },
            ],
          }),
        );
      }
      if (palette)
        window.localStorage.setItem(
          'intval-liquid-glass-palette-v1',
          JSON.stringify(palette),
        );
      if (scheme)
        window.localStorage.setItem('intval-liquid-glass-scheme-v1', scheme);
      if (storageUnavailable) {
        window.Storage.prototype.getItem = () => {
          throw new Error('Storage no disponible');
        };
        window.Storage.prototype.setItem = () => {
          throw new Error('Storage no disponible');
        };
      }
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 180));
  for (const task of idle.splice(0)) task({ timeRemaining: () => 50 });
  return {
    dom,
    body: dom.window.document.body,
    maps,
    errors,
    original,
    canvasCalls: () => canvasCalls,
    idle,
    setSystemDark(value) {
      systemPreference.matches = value;
      systemPreference.dispatchEvent(new dom.window.Event('change'));
    },
  };
}

test('la variante tiene una sesión independiente y conserva exactamente el conjunto financiero demo-1.0', async () => {
  const { dom, body, original } = await openGlass();
  try {
    assert.equal(
      getAllByRole(body, 'checkbox').some((field) => field.checked),
      false,
    );
    getByRole(body, 'checkbox', { name: /Manufacturas Horizonte/ }).click();
    assert.equal(
      dom.window.localStorage.getItem('intval-design-preview-v1'),
      original,
    );
    assert.deepEqual(
      JSON.parse(
        dom.window.localStorage.getItem('intval-liquid-glass-preview-v1'),
      ).selected,
      ['DEMO-MX.MX'],
    );
    const data = JSON.parse(
      dom.window.document.querySelector('#demo-data').textContent,
    );
    assert.equal(
      createHash('sha256').update(JSON.stringify(data)).digest('hex'),
      '708a1d076be22e14fce8731376ff34f88eab22fb5a42db2302f2f1d5f2fb05ad',
    );
  } finally {
    dom.window.close();
  }
});

function openPalettes(body) {
  const picker = body.querySelector('#palette-switcher');
  assert.ok(picker, 'Falta el selector de paletas');
  if (!picker.open) picker.querySelector('summary').click();
  return picker;
}

function editField(dom, field, value) {
  field.value = value;
  field.dispatchEvent(
    new dom.window.Event(field.tagName === 'SELECT' ? 'change' : 'input', {
      bubbles: true,
    }),
  );
}

function tickers(body) {
  return [...body.querySelectorAll('#result-rows tr[data-company]')].map(
    (row) => row.dataset.company,
  );
}

function modalPointer(dom, target, type, x, y) {
  target.dispatchEvent(
    new dom.window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: x,
      clientY: y,
    }),
  );
}
function modalBounds(dialog) {
  dialog.getBoundingClientRect = () => ({
    left: 100,
    top: 100,
    right: 600,
    bottom: 600,
    width: 500,
    height: 500,
  });
}
function outsideClick(dom, dialog) {
  modalBounds(dialog);
  modalPointer(dom, dialog, 'pointerdown', 50, 50);
  modalPointer(dom, dialog, 'click', 50, 50);
}

test('todos los modales cierran al pulsar fuera; el detalle conserva resultados y devuelve el foco', async () => {
  const { dom, body } = await openGlass();
  try {
    assert.ok(
      [...body.querySelectorAll('dialog')].every(
        (dialog) => dialog.getAttribute('closedby') === 'any',
      ),
    );
    getByRole(body, 'button', {
      name: 'Ajustes de valoración',
      exact: true,
    }).click();
    const settings = getByRole(body, 'dialog', {
      name: 'Ajustes de valoración',
    });
    outsideClick(dom, settings);
    assert.equal(settings.open, false);
    getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).click();
    getByRole(body, 'button', {
      name: 'Analizar selección',
      exact: true,
    }).click();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const link = getByRole(body, 'link', { name: 'Ver análisis de DEMO-USA' });
    link.click();
    const detail = getByRole(body, 'dialog', { name: 'Detalle de empresa' });
    outsideClick(dom, detail);
    assert.equal(detail.open, false);
    assert.equal(dom.window.location.hash, '#resultados');
    assert.equal(body.querySelector('#result-rows').rows.length, 1);
    assert.equal(dom.window.document.activeElement, link);
  } finally {
    dom.window.close();
  }
});

test('clics dentro, padding y arrastres desde dentro no cierran un modal ni guardan ajustes al cerrarlo fuera', async () => {
  const { dom, body } = await openGlass();
  try {
    getByRole(body, 'button', {
      name: 'Ajustes de valoración',
      exact: true,
    }).click();
    const dialog = getByRole(body, 'dialog', { name: 'Ajustes de valoración' });
    modalBounds(dialog);
    const input = getByRole(dialog, 'spinbutton', {
      name: 'Tasa de descuento (%)',
      exact: true,
    });
    editField(dom, input, '12');
    modalPointer(dom, input, 'pointerdown', 150, 150);
    modalPointer(dom, input, 'click', 150, 150);
    assert.equal(dialog.open, true);
    modalPointer(dom, dialog, 'pointerdown', 110, 110);
    modalPointer(dom, dialog, 'click', 110, 110);
    assert.equal(dialog.open, true);
    modalPointer(dom, input, 'pointerdown', 150, 150);
    modalPointer(dom, dialog, 'click', 50, 50);
    assert.equal(dialog.open, true);
    modalPointer(dom, dialog, 'pointerdown', 50, 50);
    modalPointer(dom, input, 'click', 150, 150);
    assert.equal(dialog.open, true);
    modalPointer(dom, dialog, 'pointerdown', 50, 50);
    modalPointer(dom, dialog, 'pointercancel', 50, 50);
    modalPointer(dom, dialog, 'click', 50, 50);
    assert.equal(dialog.open, true);
    outsideClick(dom, dialog);
    assert.equal(dialog.open, false);
    getByRole(body, 'button', {
      name: 'Ajustes de valoración',
      exact: true,
    }).click();
    assert.equal(
      getByRole(dialog, 'spinbutton', {
        name: 'Tasa de descuento (%)',
        exact: true,
      }).value,
      '10',
    );
  } finally {
    dom.window.close();
  }
});

test('el cierre exterior respeta cancel antes de cerrar el modal', async () => {
  const { dom, body } = await openGlass();
  try {
    getByRole(body, 'button', {
      name: 'Ajustes de valoración',
      exact: true,
    }).click();
    const dialog = getByRole(body, 'dialog', { name: 'Ajustes de valoración' });
    dialog.addEventListener('cancel', (event) => event.preventDefault(), {
      once: true,
    });
    outsideClick(dom, dialog);
    assert.equal(dialog.open, true);
    outsideClick(dom, dialog);
    assert.equal(dialog.open, false);
  } finally {
    dom.window.close();
  }
});
test('resultados conserva el buscador y ordena desde los encabezados sin filtros numéricos', async () => {
  const { dom, body } = await openGlass({
    companyCount: 3,
    completed: true,
    mutateCompanies(companies) {
      companies.forEach((company, i) => {
        company.market_price = [100, 200, 80][i];
        company.median = {
          ...company.median,
          upside: [0.1, -0.05, null][i],
          value_per_share: [110, 190, null][i],
        };
      });
    },
  });
  try {
    getByRole(body, 'link', { name: 'Resultados', exact: true }).click();
    const screen = body.querySelector('#screen-analysis');
    assert.equal(
      screen.querySelector(
        'fieldset, input[type="number"], input[type="radio"], [data-clear-filter]',
      ),
      null,
    );
    const search = getByRole(screen, 'searchbox', {
      name: 'Buscar en resultados',
    });
    assert.equal(getAllByRole(screen, 'searchbox').length, 1);
    for (const [name, ascending, descending] of [
      [
        'precio',
        ['ESC-0002', 'ESC-0000', 'ESC-0001'],
        ['ESC-0001', 'ESC-0000', 'ESC-0002'],
      ],
      [
        'valor estimado',
        ['ESC-0000', 'ESC-0001', 'ESC-0002'],
        ['ESC-0001', 'ESC-0000', 'ESC-0002'],
      ],
      [
        'diferencia',
        ['ESC-0001', 'ESC-0000', 'ESC-0002'],
        ['ESC-0000', 'ESC-0001', 'ESC-0002'],
      ],
    ]) {
      const sort = getByRole(screen, 'button', {
        name: 'Ordenar por ' + name,
        exact: true,
      });
      sort.focus();
      sort.click();
      assert.deepEqual(tickers(body), ascending);
      assert.equal(sort.closest('th').getAttribute('aria-sort'), 'ascending');
      sort.click();
      assert.deepEqual(tickers(body), descending);
      assert.equal(sort.closest('th').getAttribute('aria-sort'), 'descending');
      assert.equal(screen.querySelectorAll('th[aria-sort]').length, 1);
      assert.equal(dom.window.document.activeElement, sort);
    }
    editField(dom, search, 'ESC-0001');
    assert.deepEqual(tickers(body), ['ESC-0001']);
    editField(dom, search, '');
    assert.equal(tickers(body).length, 3);
  } finally {
    dom.window.close();
  }
});

test('catálogo y seleccionadas comparten una lista, conservan la búsqueda y distinguen página de selección global', async () => {
  const { dom, body } = await openGlass({ companyCount: 1203 });
  try {
    const screen = body.querySelector('#screen-selection');
    const list = body.querySelector('#company-list');
    assert.equal(screen.querySelector('details, summary'), null);
    assert.equal(body.querySelector('#batch-companies'), null);
    const page = getByRole(body, 'checkbox', { name: 'Seleccionar página' });
    getByRole(list, 'checkbox', { name: /ESC-0000/ }).click();
    assert.equal(page.indeterminate, true);
    const pager = getByRole(body, 'navigation', {
      name: 'Páginas de empresas',
    });
    getByRole(pager, 'button', { name: 'Página siguiente' }).click();
    getByRole(list, 'checkbox', { name: /ESC-0025/ }).click();
    getByRole(body, 'button', { name: 'Seleccionadas', exact: true }).click();
    assert.equal(list.querySelectorAll('input').length, 2);
    getByRole(body, 'button', { name: 'Catálogo', exact: true }).click();
    assert.match(pager.textContent, /26[–-]50 de 1,203/);
    const search = getByRole(body, 'searchbox', { name: 'Buscar empresas' });
    editField(dom, search, 'ESC-1202');
    getByRole(list, 'checkbox', { name: /ESC-1202/ }).click();
    getByRole(body, 'button', { name: 'Seleccionadas', exact: true }).click();
    assert.equal(search.value, '');
    assert.equal(list.querySelectorAll('input').length, 3);
    assert.equal(list.querySelectorAll('input:checked').length, 3);
    assert.equal(
      getByRole(body, 'button', {
        name: 'Seleccionadas',
        exact: true,
      }).getAttribute('aria-pressed'),
      'true',
    );
    getByRole(list, 'checkbox', { name: /ESC-0025/ }).click();
    assert.equal(list.querySelectorAll('input').length, 2);
    assert.equal(dom.window.document.activeElement.value, 'ESC-1202');
    getByRole(body, 'button', { name: 'Catálogo', exact: true }).click();
    assert.equal(search.value, 'ESC-1202');
    assert.equal(list.querySelectorAll('input').length, 1);
    editField(dom, search, '');
    page.click();
    assert.equal(body.querySelector('#selected-count').textContent, '26');
    assert.equal(list.querySelectorAll('input:checked').length, 25);
    getByRole(body, 'button', {
      name: 'Seleccionar 1,203 empresas',
      exact: true,
    }).click();
    assert.equal(body.querySelector('#selected-count').textContent, '1203');
    assert.equal(dom.window.document.activeElement, page);
    assert.ok(list.querySelectorAll('input').length <= 25);
    page.click();
    assert.equal(body.querySelector('#selected-count').textContent, '1178');
    assert.equal(list.querySelectorAll('input:checked').length, 0);
  } finally {
    dom.window.close();
  }
});

test('1203 empresas: búsqueda global, páginas acotadas y selección entre páginas y filtros', async () => {
  const { dom, body } = await openGlass({ companyCount: 1203 });
  try {
    const list = body.querySelector('#company-list');
    assert.equal(list.querySelectorAll('input').length, 25);
    const pager = getByRole(body, 'navigation', {
      name: 'Páginas de empresas',
    });
    assert.match(pager.textContent, /1[–-]25 de 1,203/);
    getByRole(list, 'checkbox', { name: /ESC-0000/ }).click();
    getByRole(pager, 'button', { name: 'Página siguiente' }).click();
    assert.equal(list.querySelectorAll('input').length, 25);
    getByRole(list, 'checkbox', { name: /ESC-0025/ }).click();
    const search = getByRole(body, 'searchbox', { name: 'Buscar empresas' });
    editField(dom, search, 'ESC-1202');
    assert.equal(list.querySelectorAll('input').length, 1);
    getByRole(list, 'checkbox', { name: /ESC-1202/ }).click();
    editField(dom, search, '');
    assert.equal(
      getByRole(list, 'checkbox', { name: /ESC-0000/ }).checked,
      true,
    );
    getByRole(pager, 'button', { name: 'Página siguiente' }).click();
    assert.equal(
      getByRole(list, 'checkbox', { name: /ESC-0025/ }).checked,
      true,
    );
    assert.equal(body.querySelector('#selected-count').textContent, '3');
    editField(dom, body.querySelector('#selection-market'), 'MX');
    assert.equal(list.querySelectorAll('input').length, 25);
    assert.equal(body.querySelector('#selected-count').textContent, '3');
    editField(dom, body.querySelector('#selection-market'), 'all');
    getByRole(body, 'checkbox', { name: 'Seleccionar página' }).click();
    getByRole(body, 'button', {
      name: 'Seleccionar 1,203 empresas',
      exact: true,
    }).click();
    assert.equal(body.querySelector('#selected-count').textContent, '1203');
    assert.equal(body.querySelector('#batch-companies'), null);
    assert.equal(
      JSON.parse(
        dom.window.localStorage.getItem('intval-liquid-glass-preview-v1'),
      ).selected.length,
      1203,
    );
    getByRole(body, 'button', { name: 'Seleccionadas', exact: true }).click();
    const selectedPager = getByRole(body, 'navigation', {
      name: 'Páginas de empresas',
    });
    getByRole(selectedPager, 'button', { name: 'Última página' }).click();
    assert.equal(list.querySelectorAll('input').length, 3);
    list.querySelector('input').click();
    assert.equal(list.querySelectorAll('input').length, 2);
    const clear = getByRole(body, 'button', { name: 'Limpiar selección' });
    clear.focus();
    clear.click();
    assert.equal(body.querySelector('#selected-count').textContent, '0');
    assert.equal(dom.window.document.activeElement, search);
  } finally {
    dom.window.close();
  }
});

test('1203 resultados: orden global, última página parcial, búsqueda y regreso del detalle conservan el contexto', async () => {
  const { dom, body } = await openGlass({
    companyCount: 1203,
    completed: true,
  });
  try {
    getByRole(body, 'link', { name: 'Resultados', exact: true }).click();
    const rows = body.querySelector('#result-rows');
    assert.equal(rows.rows.length, 25);
    assert.match(rows.rows[0].textContent, /ESC-1202/);
    const pager = getByRole(body, 'navigation', {
      name: 'Páginas de resultados',
    });
    getByRole(pager, 'button', { name: 'Última página' }).click();
    assert.equal(rows.rows.length, 3);
    assert.match(pager.textContent, /1,201[–-]1,203 de 1,203/);
    getByRole(rows.rows[0], 'link').click();
    getByRole(body, 'button', { name: 'Cerrar análisis' }).click();
    assert.equal(rows.rows.length, 3);
    assert.match(pager.textContent, /1,201[–-]1,203/);
    const search = getByRole(body, 'searchbox', {
      name: 'Buscar en resultados',
    });
    editField(dom, search, 'ESC-0777');
    assert.equal(rows.rows.length, 1);
    assert.match(rows.textContent, /ESC-0777/);
    editField(dom, search, '');
    getByRole(body, 'button', { name: 'Ordenar por empresa' }).click();
    assert.equal(rows.rows.length, 25);
    assert.match(rows.rows[0].textContent, /ESC-0000/);
    assert.equal(body.querySelectorAll('th[aria-sort]').length, 1);
    assert.equal(
      body.querySelector('th[aria-sort]').getAttribute('aria-sort'),
      'ascending',
    );
    getByRole(body, 'button', { name: 'Ordenar por empresa' }).click();
    assert.match(rows.rows[0].textContent, /ESC-1202/);
    const price = getByRole(body, 'button', {
      name: 'Ordenar por precio',
      exact: true,
    });
    price.click();
    assert.equal(rows.rows.length, 25);
    assert.match(rows.rows[0].textContent, /ESC-0000/);
    price.click();
    assert.match(rows.rows[0].textContent, /ESC-1202/);
    assert.ok(body.querySelectorAll('#company-list input').length <= 25);
    assert.equal(body.querySelector('#batch-companies'), null);
  } finally {
    dom.window.close();
  }
});

test('Excel exporta las 1203 empresas aunque sólo haya una página filtrada visible', async () => {
  const sheets = {};
  const { dom, body } = await openGlass({
    companyCount: 1203,
    completed: true,
    xlsx: {
      utils: {
        book_new: () => ({}),
        aoa_to_sheet: (rows) => rows,
        book_append_sheet: (_, rows, name) => {
          sheets[name] = rows;
        },
      },
      writeFile: () => {},
    },
  });
  try {
    getByRole(body, 'link', { name: 'Resultados', exact: true }).click();
    editField(dom, body.querySelector('#result-search'), 'ESC-0777');
    assert.equal(body.querySelector('#result-rows').rows.length, 1);
    getByRole(body, 'button', { name: 'Descargar Excel', exact: true }).click();
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(sheets.Resumen.length, 1204);
    assert.equal(Object.keys(sheets).length, 7);
  } finally {
    dom.window.close();
  }
});

test('la tabla comparte sus etiquetas y el detalle permite reconocer precio y estimado sin instrucciones', async () => {
  const { dom, body } = await openGlass();
  try {
    getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).click();
    getByRole(body, 'button', { name: 'Analizar selección' }).click();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const row = getByRole(body, 'row', { name: 'Industrial Aurora' });
    assert.deepEqual(
      [...row.querySelectorAll('.number-cell')].map(
        (value) => value.textContent,
      ),
      ['100.00', '116.19'],
    );
    assert.match(
      row.querySelector('.difference-cell').textContent,
      /\+16[.,]19/,
    );
    assert.equal(row.querySelectorAll('p, button, details').length, 0);
    assert.equal(
      body.querySelector('#sort-upside').closest('th').id,
      'difference-header',
    );
    getByRole(row, 'link').click();
    const dialog = getByRole(body, 'dialog', { name: 'Detalle de empresa' });
    assert.ok(dialog.open);
    assert.equal(dialog.querySelectorAll('.value-pair').length, 1);
    assert.equal(dialog.querySelectorAll('.comparison-track').length, 0);
    const methods = getByRole(dialog, 'table', {
      name: 'Estimaciones por método',
    });
    assert.equal(methods.closest('details'), null);
    assert.equal(dialog.querySelector('#model-breakdown').tagName, 'SECTION');
    const evidence = getByRole(dialog, 'region', { name: 'Supuestos' });
    assert.equal(evidence.closest('details'), null);
    assert.equal(evidence.querySelector('summary'), null);
    getByRole(dialog, 'tab', { name: 'Precio histórico' }).click();
    assert.ok(getByRole(dialog, 'region', { name: 'Supuestos' }));
    getByRole(dialog, 'tab', { name: 'Resumen' }).click();
    assert.equal(
      getByRole(dialog, 'table', { name: 'Estimaciones por método' }).closest(
        'details',
      ),
      null,
    );
    getByRole(body, 'button', { name: 'Cerrar análisis' }).click();
    assert.equal(dom.window.location.hash, '#resultados');
  } finally {
    dom.window.close();
  }
});

test('elegir una empresa usa una fila completa y comunica la selección sin depender del color', async () => {
  const { dom, body } = await openGlass();
  try {
    const option = getByRole(body, 'checkbox', {
      name: /Manufacturas Horizonte/,
    });
    const label = option.closest('label');
    label.click();
    assert.equal(
      getByRole(body, 'checkbox', { name: /Manufacturas Horizonte/ }).checked,
      true,
    );
    assert.equal(body.querySelector('#selected-count').textContent, '1');
    getByRole(body, 'button', { name: 'Analizar selección' }).click();
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(
      getAllByRole(body, 'row', { name: 'Manufacturas Horizonte' }).length,
      1,
    );
    assert.match(body.querySelector('#result-rows').textContent, /209[.,]14/);
  } finally {
    dom.window.close();
  }
});

function contrastWithWhite(hex) {
  const rgb = hex.match(/[a-f\d]{2}/gi).map((v) => parseInt(v, 16) / 255);
  const linear = rgb.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return (
    1.05 / (0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] + 0.05)
  );
}

test('modo oscuro y paleta son independientes, persisten y siguen disponibles dentro de los modales', async () => {
  const { dom, body, errors } = await openGlass({ palette: { id: 'forest' } });
  try {
    getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).click();
    getByRole(body, 'button', { name: 'Analizar selección' }).click();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const snapshot = dom.window.localStorage.getItem(
      'intval-liquid-glass-preview-v1',
    );
    getByRole(body, 'link', { name: 'Ver análisis de DEMO-USA' }).click();
    getByRole(body, 'tab', { name: 'Precio histórico' }).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const chart = body.querySelector('#chart-area svg');
    const toggle = getByRole(body, 'button', {
      name: 'Modo oscuro',
      exact: true,
    });
    assert.ok(toggle.closest('dialog[open]'));
    toggle.click();
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(
      dom.window.document.querySelector('meta[name="color-scheme"]').content,
      'dark',
    );
    assert.equal(
      dom.window.localStorage.getItem('intval-liquid-glass-scheme-v1'),
      'dark',
    );
    assert.equal(dom.window.document.documentElement.dataset.palette, 'forest');
    assert.equal(dom.window.getComputedStyle(body).color, 'rgb(233, 240, 247)');
    assert.equal(body.querySelector('#chart-area svg'), chart);
    assert.equal(
      dom.window.localStorage.getItem('intval-liquid-glass-preview-v1'),
      snapshot,
    );
    openPalettes(body);
    getByRole(body, 'radio', { name: 'Lavanda', exact: true }).click();
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(body.querySelector('#chart-area svg'), chart);
    getByRole(body, 'button', { name: 'Cerrar análisis' }).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(toggle.closest('dialog'), null);
    toggle.click();
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
    assert.equal(
      dom.window.localStorage.getItem('intval-liquid-glass-scheme-v1'),
      null,
    );
    assert.equal(
      dom.window.document.documentElement.dataset.palette,
      'lavender',
    );
    assert.equal(errors.length, 0);
  } finally {
    dom.window.close();
  }
  const restored = await openGlass({ scheme: 'dark', palette: { id: 'rose' } });
  try {
    assert.equal(
      getByRole(restored.body, 'button', { name: 'Modo oscuro' }).getAttribute(
        'aria-pressed',
      ),
      'true',
    );
    assert.equal(
      restored.dom.window.document.querySelector('meta[name="color-scheme"]')
        .content,
      'dark',
    );
    assert.equal(
      restored.dom.window.getComputedStyle(restored.body).color,
      'rgb(233, 240, 247)',
    );
    assert.equal(
      restored.dom.window.document.documentElement.dataset.palette,
      'rose',
    );
  } finally {
    restored.dom.window.close();
  }
});

test('el modo sigue al sistema hasta elegir otro, conserva la elección y sincroniza otras pestañas', async () => {
  const { dom, body, setSystemDark } = await openGlass({ systemDark: true });
  try {
    const toggle = getByRole(body, 'button', { name: 'Modo oscuro' });
    const meta = dom.window.document.querySelector('meta[name="color-scheme"]');
    const key = 'intval-liquid-glass-scheme-v1';
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(meta.content, 'light dark');
    toggle.click();
    assert.equal(meta.content, 'light');
    assert.equal(dom.window.localStorage.getItem(key), 'light');
    setSystemDark(false);
    setSystemDark(true);
    assert.equal(meta.content, 'light');
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
    toggle.click();
    assert.equal(dom.window.localStorage.getItem(key), null);
    assert.equal(meta.content, 'light dark');
    setSystemDark(false);
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
    dom.window.dispatchEvent(
      new dom.window.StorageEvent('storage', { key, newValue: 'dark' }),
    );
    assert.equal(meta.content, 'dark');
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    dom.window.dispatchEvent(
      new dom.window.StorageEvent('storage', { key, newValue: null }),
    );
    assert.equal(meta.content, 'light dark');
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  } finally {
    dom.window.close();
  }
});

test('el modo funciona con almacenamiento bloqueado y descarta preferencias inválidas', async () => {
  for (const options of [
    { storageUnavailable: true },
    { scheme: 'incorrecto' },
  ]) {
    const { dom, body, errors } = await openGlass(options);
    try {
      const toggle = getByRole(body, 'button', { name: 'Modo oscuro' });
      assert.equal(toggle.getAttribute('aria-pressed'), 'false');
      toggle.click();
      assert.equal(toggle.getAttribute('aria-pressed'), 'true');
      assert.equal(
        dom.window.getComputedStyle(body).color,
        'rgb(233, 240, 247)',
      );
      toggle.click();
      assert.equal(toggle.getAttribute('aria-pressed'), 'false');
      assert.equal(errors.length, 0);
    } finally {
      dom.window.close();
    }
  }
});

test('ambos modos mantienen legibles tablas, campos, modales y pie en todas las paletas', async () => {
  const { dom, body } = await openGlass({ companyCount: 3, completed: true });
  try {
    getByRole(body, 'link', { name: 'Resultados', exact: true }).click();
    getByRole(body, 'button', {
      name: 'Ajustes de valoración',
      exact: true,
    }).click();
    getByRole(body, 'button', { name: 'Cerrar ajustes', exact: true }).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const styleOf = (selector) =>
      dom.window.getComputedStyle(body.querySelector(selector));
    const channels = (color) => color.match(/[\d.]+/g).map(Number);
    const luminance = (rgb) =>
      rgb
        .slice(0, 3)
        .map((v) => {
          v /= 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce(
          (sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i],
          0,
        );
    const check = (selector, name, dark) => {
      const style = styleOf(selector);
      const foreground = channels(style.color),
        background = channels(style.backgroundColor);
      assert.ok(
        background[3] === undefined || background[3] >= 0.75,
        `Superficie de lectura: ${selector}, ${name}`,
      );
      for (const behind of [0, 255]) {
        const alpha = background[3] ?? 1;
        const surface = background
          .slice(0, 3)
          .map((v) => v * alpha + behind * (1 - alpha));
        const a = luminance(foreground),
          b = luminance(surface);
        assert.ok(
          (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5,
          `Contraste: ${selector}, ${name}, ${dark}`,
        );
      }
      if (dark)
        assert.ok(
          luminance(background) < 0.15,
          `Sin panel claro en modo oscuro: ${selector}`,
        );
    };
    const toggle = getByRole(body, 'button', { name: 'Modo oscuro' });
    for (const dark of [false, true]) {
      if (dark) toggle.click();
      openPalettes(body);
      for (const name of [
        'Océano',
        'Bosque',
        'Lavanda',
        'Ámbar',
        'Rosa',
        'Grafito',
        '#000000',
        '#ffffff',
        '#ffffdd',
      ]) {
        if (name.startsWith('#')) {
          const input = body.querySelector('#palette-custom');
          input.value = name;
          input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        } else getByRole(body, 'radio', { name, exact: true }).click();
        for (const selector of [
          '.valuation-table tbody tr',
          '.valuation-table thead th',
          '#result-search',
          '.footer a',
          '#settings-dialog',
          '.setting-field input',
          '.palette-panel',
          '#scheme-toggle',
        ])
          check(selector, name, dark);
        const css = styleOf('.valuation-table tbody tr');
        const probe = dom.window.document.createElement('span');
        body.append(probe);
        for (const token of [
          '--muted',
          '--green',
          '--red',
          '--chart-label',
          '--chart-blue',
          '--chart-teal',
          '--chart-amber',
          '--chart-purple',
          '--chart-revenue',
        ]) {
          probe.style.color = `var(${token})`;
          const a = luminance(
            channels(dom.window.getComputedStyle(probe).color),
          );
          const b = luminance(channels(css.backgroundColor));
          const minimum =
            token.includes('chart-') && token !== '--chart-label' ? 3 : 4.5;
          assert.ok(
            (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= minimum,
            `Contraste ${token}, ${name}, ${dark}`,
          );
        }
        probe.remove();
      }
    }
  } finally {
    dom.window.close();
  }
});

test('Cómo se calcula mantiene un fondo opaco y contraste suficiente al cambiar cualquier paleta', async () => {
  const { dom, body } = await openGlass();
  try {
    const footer = getByRole(body, 'contentinfo');
    const link = getByRole(footer, 'link', {
      name: 'Cómo se calcula',
      exact: true,
    });
    const colors = new Set();
    const backgrounds = new Set();
    const luminance = (channels) =>
      channels
        .slice(0, 3)
        .map((v) => {
          v /= 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce(
          (total, value, i) => total + value * [0.2126, 0.7152, 0.0722][i],
          0,
        );
    const check = (name) => {
      const style = dom.window.getComputedStyle(link);
      const background = style.backgroundColor.match(/[\d.]+/g).map(Number);
      const foreground = style.color.match(/[\d.]+/g).map(Number);
      assert.equal(background[3] ?? 1, 1, `Fondo opaco: ${name}`);
      const light = luminance(background),
        dark = luminance(foreground);
      assert.ok(
        (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05) >= 4.5,
        `Contraste de texto: ${name}`,
      );
      colors.add(style.color);
      backgrounds.add(style.backgroundColor);
    };
    openPalettes(body);
    for (const name of [
      'Océano',
      'Bosque',
      'Lavanda',
      'Ámbar',
      'Rosa',
      'Grafito',
    ]) {
      getByRole(body, 'radio', { name, exact: true }).click();
      check(name);
    }
    for (const color of [
      '#000000',
      '#ffffff',
      '#ffffdd',
      '#0000ff',
      '#ff0000',
    ]) {
      const input = body.querySelector('#palette-custom');
      input.value = color;
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      check(color);
    }
    assert.ok(colors.size > 1, 'El texto responde a la paleta');
    assert.ok(backgrounds.size > 1, 'El fondo responde a la paleta');
    assert.equal(link.getAttribute('href'), '#metodologia');
  } finally {
    dom.window.close();
  }
});

test('la paleta cambia fondo y acentos al instante, se guarda y no altera la selección ni los datos', async () => {
  const { dom, body } = await openGlass();
  try {
    getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).click();
    const analysis = dom.window.localStorage.getItem(
      'intval-liquid-glass-preview-v1',
    );
    const initialAccent =
      dom.window.document.documentElement.style.getPropertyValue('--blue');
    openPalettes(body);
    getByRole(body, 'radio', { name: 'Bosque', exact: true }).click();
    assert.equal(dom.window.document.documentElement.dataset.palette, 'forest');
    assert.equal(body.querySelector('#palette-current').textContent, 'Bosque');
    assert.match(
      dom.window.document.documentElement.style.getPropertyValue(
        '--scene-tide-1',
      ),
      /^#[a-f\d]{6}$/i,
    );
    assert.equal(
      JSON.parse(
        dom.window.localStorage.getItem('intval-liquid-glass-palette-v1'),
      ).id,
      'forest',
    );
    assert.equal(
      dom.window.localStorage.getItem('intval-liquid-glass-preview-v1'),
      analysis,
    );
    assert.equal(
      getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).checked,
      true,
    );
    getByRole(body, 'radio', { name: 'Océano', exact: true }).click();
    assert.equal(
      dom.window.document.documentElement.style.getPropertyValue('--blue'),
      initialAccent,
    );
    assert.equal(body.querySelector('#palette-current').textContent, 'Océano');
  } finally {
    dom.window.close();
  }
});

test('recupera una paleta guardada y permite colores personalizados claros sin perder contraste', async () => {
  const { dom, body } = await openGlass({ palette: { id: 'rose' } });
  try {
    assert.equal(dom.window.document.documentElement.dataset.palette, 'rose');
    openPalettes(body);
    assert.equal(
      getByRole(body, 'radio', { name: 'Rosa', exact: true }).checked,
      true,
    );
    const input = body.querySelector('#palette-custom');
    input.value = '#ffffdd';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(
      getByRole(body, 'radio', { name: 'Personalizada', exact: true }).checked,
      true,
    );
    assert.equal(
      body.querySelector('#palette-current').textContent,
      'Personalizada',
    );
    const root = dom.window.document.documentElement;
    assert.ok(contrastWithWhite(root.style.getPropertyValue('--blue')) >= 4.5);
    assert.ok(
      contrastWithWhite(root.style.getPropertyValue('--accent-top')) >= 4.5,
    );
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.deepEqual(
      JSON.parse(
        dom.window.localStorage.getItem('intval-liquid-glass-palette-v1'),
      ),
      { id: 'custom', color: '#ffffdd' },
    );
  } finally {
    dom.window.close();
  }
});

test('una paleta personalizada vuelve a aplicarse al abrir la página', async () => {
  const { dom, body } = await openGlass({
    palette: { id: 'custom', color: '#8254d8' },
  });
  try {
    assert.equal(dom.window.document.documentElement.dataset.palette, 'custom');
    assert.equal(body.querySelector('#palette-custom').value, '#8254d8');
    assert.equal(
      body.querySelector('#palette-current').textContent,
      'Personalizada',
    );
  } finally {
    dom.window.close();
  }
});

test('la paleta sigue accesible dentro del detalle y cambiarla conserva la gráfica, la pestaña y el análisis', async () => {
  const { dom, body } = await openGlass();
  try {
    getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).click();
    getByRole(body, 'button', { name: 'Analizar selección' }).click();
    await new Promise((resolve) => setTimeout(resolve, 400));
    getByRole(body, 'link', { name: 'Ver análisis de DEMO-USA' }).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const dialog = getByRole(body, 'dialog', { name: 'Detalle de empresa' });
    const picker = openPalettes(body);
    assert.ok(dialog.contains(picker));
    getByRole(body, 'tab', { name: 'Precio histórico' }).click();
    const chart = body.querySelector('#chart-area svg');
    openPalettes(body);
    const analysis = dom.window.localStorage.getItem(
      'intval-liquid-glass-preview-v1',
    );
    getByRole(body, 'radio', { name: 'Ámbar', exact: true }).click();
    assert.equal(body.querySelector('#chart-area svg'), chart);
    assert.equal(
      getByRole(body, 'tab', { name: 'Precio histórico' }).getAttribute(
        'aria-selected',
      ),
      'true',
    );
    assert.equal(
      dom.window.localStorage.getItem('intval-liquid-glass-preview-v1'),
      analysis,
    );
    const escape = new dom.window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    picker.querySelector('input').dispatchEvent(escape);
    assert.equal(escape.defaultPrevented, true);
    assert.equal(picker.open, false);
    assert.equal(dialog.open, true);
    getByRole(body, 'button', { name: 'Cerrar análisis' }).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(body.querySelector('#palette-controls').parentElement, body);
  } finally {
    dom.window.close();
  }
});

test('paletas inválidas o almacenamiento bloqueado no impiden cambiar el color', async () => {
  for (const options of [
    { palette: { id: 'custom', color: 'incorrecto' } },
    { storageUnavailable: true },
  ]) {
    const { dom, body, errors } = await openGlass(options);
    try {
      assert.equal(
        dom.window.document.documentElement.dataset.palette,
        'ocean',
      );
      openPalettes(body);
      getByRole(body, 'radio', { name: 'Lavanda', exact: true }).click();
      assert.equal(
        dom.window.document.documentElement.dataset.palette,
        'lavender',
      );
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  }
});

test('el mapa óptico desplaza los bordes y deja el centro neutro, con resolución acotada y sin bucle de render', async () => {
  const { dom, maps, idle, errors } = await openGlass();
  try {
    assert.equal(maps.length, 1);
    const map = maps[0];
    assert.ok(map.width * map.height <= 320 * 320);
    const center =
      (Math.floor(map.height / 2) * map.width + Math.floor(map.width / 2)) * 4;
    const edge = Math.floor(map.height / 2) * map.width * 4;
    assert.equal(map.data[center], 128);
    assert.equal(map.data[center + 1], 128);
    assert.notEqual(map.data[edge], 128);
    assert.equal(map.data[edge + 3], 255);
    assert.equal(
      dom.window.document.querySelector('.header').dataset.optics,
      'ready',
    );
    assert.equal(idle.length, 0);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test('reducir transparencia evita generar el mapa y mantiene operables los controles', async () => {
  const { dom, body, canvasCalls, errors } = await openGlass({ reduced: true });
  try {
    assert.equal(canvasCalls(), 0);
    assert.equal(
      dom.window.document.querySelector('.header').dataset.optics,
      undefined,
    );
    getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).click();
    assert.equal(
      getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).checked,
      true,
    );
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test('si Canvas no está disponible, el analizador conserva el efecto base y sigue funcionando', async () => {
  const { dom, body, errors } = await openGlass({ noCanvas: true });
  try {
    assert.equal(
      dom.window.document.querySelector('.header').dataset.optics,
      undefined,
    );
    getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).click();
    getByRole(body, 'button', { name: 'Analizar selección' }).click();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const table = getByRole(body, 'table', {
      name: 'Valoraciones de tus empresas',
    });
    assert.match(table.textContent, /116[.,]19/);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});
