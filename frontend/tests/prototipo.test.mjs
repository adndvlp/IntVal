import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { JSDOM } from 'jsdom';
import {
  getByRole,
  getAllByRole,
  queryByRole,
  queryByText,
} from '@testing-library/dom';

const liquidGlass =
  process.env.INTVAL_VARIANT === 'liquid-glass' ||
  (!process.env.INTVAL_VARIANT &&
    !existsSync(new URL('../../prototipo-intval.html', import.meta.url)));
const storageKey = liquidGlass
  ? 'intval-liquid-glass-preview-v1'
  : 'intval-design-preview-v1';
const previewFile = new URL(
  liquidGlass
    ? '../../prototipo-intval-liquid-glass.html'
    : '../../prototipo-intval.html',
  import.meta.url,
);
async function open({ route = '', saved, xlsx, file = false } = {}) {
  const source = await readFile(previewFile, 'utf8');
  const dom = new JSDOM(source, {
    url:
      (file ? 'file:///prototipo-intval.html' : 'https://prototipo.example/') +
      (route ? '#' + route : ''),
    runScripts: 'dangerously',
    beforeParse(window) {
      window.scrollTo = () => {};
      window.HTMLDialogElement.prototype.showModal = function () {
        this.open = true;
      };
      window.HTMLDialogElement.prototype.close = function () {
        this.open = false;
        this.dispatchEvent(new window.Event('close'));
      };
      if (saved) window.localStorage.setItem(storageKey, JSON.stringify(saved));
      if (xlsx) window.XLSX = xlsx;
    },
  });
  return { dom, body: dom.window.document.body };
}
async function until(check) {
  const deadline = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > deadline)
      throw new Error('No se completó el recorrido esperado');
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}
function click(body, role, name) {
  getByRole(body, role, { name, exact: true }).click();
}
function input(dom, field, value) {
  field.value = value;
  field.dispatchEvent(
    new dom.window.Event(field.tagName === 'SELECT' ? 'change' : 'input', {
      bubbles: true,
    }),
  );
}
function filterHorizonte(dom, body) {
  if (liquidGlass) {
    input(
      dom,
      getByRole(body, 'searchbox', { name: 'Buscar en resultados' }),
      'Horizonte',
    );
  } else {
    expand(body, 'result-options');
    input(
      dom,
      getByRole(body, 'combobox', { name: 'Mercado del resultado' }),
      'MX',
    );
  }
}
const clearHorizonte = 'Quitar filtro México';
function clearResultsMatch(dom, body) {
  if (liquidGlass)
    input(
      dom,
      getByRole(body, 'searchbox', { name: 'Buscar en resultados' }),
      '',
    );
  else click(body, 'button', clearHorizonte);
}
function results(body) {
  return getByRole(body, 'table', { name: 'Valoraciones de tus empresas' })
    .tBodies[0];
}
async function waitForResults(body, count) {
  await until(() => {
    const table = queryByRole(body, 'table', {
      name: 'Valoraciones de tus empresas',
    });
    return (
      table &&
      table.tBodies[0].rows.length === count &&
      !getByRole(body, 'button', { name: 'Descargar Excel' }).disabled
    );
  });
}
function expand(body, id) {
  const disclosure = body.querySelector('#' + id);
  assert.ok(disclosure, 'Falta el control para desplegar ' + id);
  if (!disclosure.open) disclosure.querySelector('summary').click();
  return disclosure;
}
function chooseMarket(dom, body, value) {
  if (!liquidGlass) expand(body, 'selection-filter');
  input(
    dom,
    getByRole(body, 'combobox', { name: 'Mercado de las empresas' }),
    value,
  );
}
function companyBoxes(body) {
  return getAllByRole(body.querySelector('#company-list'), 'checkbox');
}
function selectAllPage(body) {
  if (liquidGlass) {
    const master = getByRole(body, 'checkbox', { name: 'Seleccionar página' });
    if (!master.checked) master.click();
  } else
    getByRole(body, 'button', {
      name: 'Seleccionar todas',
      exact: true,
    }).click();
}
async function analyzeAll(dom, body) {
  selectAllPage(body);
  click(body, 'button', 'Analizar selección');
  await waitForResults(body, 3);
  assert.equal(dom.window.location.hash, '#resultados');
}
const historyJob = (id, ids, status = 'completed', processed = ids.length) => ({
  id,
  ids,
  status,
  processed,
  created: '2026-11-14T10:00:00Z',
  config: {},
});
const previousAnalysis = () => ({
  initialized: true,
  selected: ['DEMO-USA', 'DEMO-MX.MX'],
  current: 'analisis-anterior',
  jobs: [historyJob('analisis-anterior', ['DEMO-USA', 'DEMO-MX.MX'])],
});

test('los resultados comparten encabezados y no repiten etiquetas, explicaciones ni acciones en cada empresa', async () => {
  const { dom, body } = await open({
    route: 'resultados',
    saved: previousAnalysis(),
  });
  try {
    const table = getByRole(body, 'table', {
      name: 'Valoraciones de tus empresas',
    });
    assert.deepEqual(
      getAllByRole(table, 'columnheader').map((h) => h.textContent.trim()),
      ['Empresa', 'Precio', 'Valor estimado', 'Diferencia'],
    );
    assert.equal(getAllByRole(table, 'rowgroup').length, 2);
    for (const row of getAllByRole(results(body), 'row')) {
      assert.equal(getAllByRole(row, 'rowheader').length, 1);
      assert.equal(getAllByRole(row, 'cell').length, 3);
      assert.equal(getAllByRole(row, 'link').length, 1);
      assert.doesNotMatch(
        row.textContent,
        /Precio actual|Valor estimado|Diferencia|Ver análisis|Estimación sobre|Faltan datos/,
      );
    }
    assert.equal(body.querySelector('#result-footer'), null);
    assert.equal(queryByText(body, 'Más opciones'), null);
    const region = getByRole(body, 'region', { name: 'Tabla de valoraciones' });
    assert.equal(region.tabIndex, 0);
  } finally {
    dom.window.close();
  }
});

test('ordenar conserva las filas y el foco; el nombre de la empresa abre su detalle', async () => {
  const { dom, body } = await open({
    route: 'resultados',
    saved: previousAnalysis(),
  });
  try {
    const original = getAllByRole(results(body), 'row');
    const sort = getByRole(body, 'button', { name: 'Ordenar por diferencia' });
    sort.focus();
    sort.click();
    const ordered = getAllByRole(results(body), 'row');
    assert.equal(ordered[0], original[1]);
    assert.equal(ordered[1], original[0]);
    assert.equal(dom.window.document.activeElement, sort);
    assert.equal(
      body.querySelector('#difference-header').getAttribute('aria-sort'),
      'ascending',
    );
    getByRole(ordered[0], 'link').click();
    assert.equal(dom.window.location.hash, '#empresa/DEMO-MX.MX');
  } finally {
    dom.window.close();
  }
});

test('la selección evita párrafos, mercados repetidos y enlaces duplicados a resultados', async () => {
  const { dom, body } = await open({ saved: previousAnalysis() });
  try {
    const screen = body.querySelector('#screen-selection');
    assert.equal(
      queryByText(
        screen,
        /Obtén su valor|Prueba con|Tu selección cambió|Volver a los resultados|Personalizar cálculo/,
      ),
      null,
    );
    assert.equal(screen.querySelector('#search-help'), null);
    assert.equal(screen.querySelector('#catalog-count'), null);
    assert.equal(screen.querySelectorAll('.country').length, 0);
    assert.equal(screen.querySelectorAll('p').length, 1); // Only the empty inline error, initially hidden.
    assert.equal(
      getByRole(body, 'button', {
        name: 'Analizar selección',
      }).textContent.trim(),
      'Analizar',
    );
  } finally {
    dom.window.close();
  }
});

test('una visita nueva no inventa elecciones ni resultados y explica qué analizar', async () => {
  const { dom, body } = await open();
  try {
    assert.equal(
      companyBoxes(body).some((c) => c.checked),
      false,
    );
    assert.equal(queryByRole(body, 'link', { name: 'Resultados' }), null);
    assert.equal(queryByRole(body, 'link', { name: 'Resultados' }), null);
    assert.ok(queryByText(body, 'Datos ficticios'));
    assert.ok(getByRole(body, 'searchbox', { name: 'Buscar empresas' }));
    assert.equal(queryByText(body, /Obtén su valor/), null);
    const saved = JSON.parse(dom.window.localStorage.getItem(storageKey));
    assert.equal(saved.jobs.length, 0);
    click(body, 'link', 'Historial');
    assert.ok(queryByText(body, /No hay análisis guardados/));
  } finally {
    dom.window.close();
  }
});

test('Analizar sin empresas indica qué falta y permite completarlo sin cambiar de pantalla', async () => {
  const { dom, body } = await open();
  try {
    click(body, 'button', 'Analizar selección');
    assert.equal(body.dataset.view, 'analizar');
    assert.equal(
      getByRole(body, 'alert').textContent.trim(),
      'Selecciona al menos una empresa para analizar.',
    );
    const company = getByRole(body, 'checkbox', { name: /Industrial Aurora/ });
    assert.equal(dom.window.document.activeElement, company);
    company.click();
    assert.equal(queryByRole(body, 'alert'), null);
    click(body, 'button', 'Analizar selección');
    await waitForResults(body, 1);
    assert.equal(getAllByRole(results(body), 'row').length, 1);
    assert.match(results(body).textContent, /Industrial Aurora/);
    assert.match(results(body).textContent, /116[.,]19/);
    assert.ok(getByRole(body, 'link', { name: 'Resultados' }));
  } finally {
    dom.window.close();
  }
});

test('retira el análisis inicial automático antiguo y conserva los análisis solicitados y la selección', async () => {
  const saved = previousAnalysis();
  saved.jobs.unshift(historyJob('example-initial', ['DEMO-USA', 'DEMO-MX.MX']));
  saved.current = 'example-initial';
  const { dom, body } = await open({ saved });
  try {
    const recovered = JSON.parse(dom.window.localStorage.getItem(storageKey));
    assert.deepEqual(
      recovered.jobs.map((job) => job.id),
      ['analisis-anterior'],
    );
    assert.equal(companyBoxes(body).filter((c) => c.checked).length, 2);
    click(body, 'link', 'Historial');
    assert.equal(
      getAllByRole(body, 'button', { name: /2 empresas/ }).length,
      1,
    );
  } finally {
    dom.window.close();
  }
});

test('seleccionar con teclado conserva el foco en la misma empresa', async () => {
  const { dom, body } = await open({ route: 'analizar' });
  try {
    const company = getByRole(body, 'checkbox', { name: /Industrial Aurora/ });
    const before = company.checked;
    company.focus();
    company.click();
    const current = getByRole(body, 'checkbox', { name: /Industrial Aurora/ });
    assert.equal(current.checked, !before);
    assert.equal(dom.window.document.activeElement, current);
  } finally {
    dom.window.close();
  }
});

test('el HTML abre directamente la selección del lote, sin landing ni paso de bienvenida', async () => {
  const { dom, body } = await open();
  try {
    assert.equal(getAllByRole(body, 'heading', { level: 1 }).length, 1);
    assert.ok(getByRole(body, 'searchbox', { name: 'Buscar empresas' }));
    assert.equal(queryByRole(body, 'spinbutton'), null);
    assert.equal(
      queryByRole(body, 'table', { name: 'Valoraciones de tus empresas' }),
      null,
    );
    assert.equal(
      queryByRole(body, 'link', { name: 'Empezar a analizar' }),
      null,
    );
    assert.equal(body.querySelector('#screen-home'), null);
    assert.ok(getByRole(body, 'heading', { name: 'Elige las empresas' }));
    assert.ok(getByRole(body, 'searchbox', { name: 'Buscar empresas' }));
    assert.equal(companyBoxes(body).length, 3);
    assert.ok(getByRole(body, 'button', { name: 'Analizar selección' }));
    assert.equal(body.dataset.view, 'analizar');
  } finally {
    dom.window.close();
  }
});

test('la selección empieza con búsqueda, empresas y Analizar; revisar el lote es opcional', async () => {
  const { dom, body } = await open({ saved: previousAnalysis() });
  try {
    const review = body.querySelector('#selection-review');
    if (liquidGlass) {
      assert.equal(review, null);
      assert.equal(body.querySelector('#batch-companies'), null);
      click(body, 'button', 'Seleccionadas');
      assert.equal(companyBoxes(body).length, 2);
      assert.ok(companyBoxes(body).every((field) => field.checked));
      click(body, 'button', 'Catálogo');
      assert.equal(companyBoxes(body).length, 3);
      assert.equal(
        companyBoxes(body).filter((field) => field.checked).length,
        2,
      );
      assert.ok(getByRole(body, 'button', { name: 'Analizar selección' }));
      return;
    }
    assert.ok(review);
    assert.equal(review.open, false);
    assert.match(
      review.querySelector('summary').textContent,
      /2\s+seleccionadas/,
    );
    // JSDOM does not apply the browser's closed-details visibility to role queries.
    const remove = getByRole(body, 'button', {
      name: 'Quitar Industrial Aurora',
    });
    assert.equal(remove.closest('details'), review);
    assert.equal(review.querySelector('summary').contains(remove), false);
    assert.ok(getByRole(body, 'button', { name: 'Analizar selección' }));
    if (!liquidGlass) expand(body, 'selection-review');
    assert.ok(getByRole(body, 'button', { name: 'Quitar Industrial Aurora' }));
    review.querySelector('summary').click();
    assert.equal(review.open, false);
    assert.equal(companyBoxes(body).filter((e) => e.checked).length, 2);
  } finally {
    dom.window.close();
  }
});

test(
  liquidGlass
    ? 'borrar la búsqueda recupera las empresas del lote sin perder el foco'
    : 'cerrar los filtros no oculta que hay un filtro activo ni impide retirarlo',
  async () => {
    const { dom, body } = await open({
      route: 'resultados',
      saved: previousAnalysis(),
    });
    try {
      if (liquidGlass) {
        const search = getByRole(body, 'searchbox', {
          name: 'Buscar en resultados',
        });
        assert.equal(search.closest('details'), null);
        search.focus();
        filterHorizonte(dom, body);
        assert.equal(getAllByRole(results(body), 'row').length, 1);
        clearResultsMatch(dom, body);
        assert.equal(dom.window.document.activeElement, search);
      } else {
        const options = body.querySelector('#result-options');
        assert.ok(options);
        assert.equal(options.open, false);
        assert.equal(
          getByRole(body, 'combobox', {
            name: 'Mercado del resultado',
          }).closest('details'),
          options,
        );
        filterHorizonte(dom, body);
        options.querySelector('summary').click();
        assert.equal(options.open, false);
        assert.equal(
          options
            .querySelector('summary')
            .contains(
              getByRole(body, 'combobox', { name: 'Mercado del resultado' }),
            ),
          false,
        );
        assert.equal(getAllByRole(results(body), 'row').length, 1);
        click(body, 'button', clearHorizonte);
        assert.equal(options.open, false);
      }
      assert.equal(getAllByRole(results(body), 'row').length, 2);
    } finally {
      dom.window.close();
    }
  },
);

test('el resumen del lote conserva las empresas elegidas fuera del mercado visible', async () => {
  const { dom, body } = await open({ saved: previousAnalysis() });
  try {
    const batch = getByRole(body, 'complementary', {
      name: 'Selección de empresas',
    });
    if (!liquidGlass) expand(body, 'selection-review');
    chooseMarket(dom, body, 'MX');
    assert.equal(companyBoxes(body).length, 1);
    if (liquidGlass) {
      click(body, 'button', 'Seleccionadas');
      assert.equal(companyBoxes(body).length, 2);
      getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).click();
      assert.equal(
        dom.window.document.activeElement,
        getByRole(body, 'checkbox', { name: /Manufacturas Horizonte/ }),
      );
      click(body, 'button', 'Catálogo');
      assert.equal(
        getByRole(body, 'combobox', { name: 'Mercado de las empresas' }).value,
        'MX',
      );
      assert.equal(body.querySelector('#selected-count').textContent, '1');
    } else {
      assert.ok(
        getByRole(batch, 'button', { name: 'Quitar Industrial Aurora' }),
      );
      assert.ok(
        getByRole(batch, 'button', { name: 'Quitar Manufacturas Horizonte' }),
      );
      click(batch, 'button', 'Quitar Industrial Aurora');
      assert.equal(
        getByRole(body, 'combobox', { name: 'Mercado de las empresas' }).value,
        'MX',
      );
      assert.match(body.querySelector('#selected-count').textContent, /1/);
      assert.equal(
        dom.window.document.activeElement,
        getByRole(batch, 'button', { name: 'Quitar Manufacturas Horizonte' }),
      );
    }
    chooseMarket(dom, body, 'USA');
    assert.equal(
      getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).checked,
      false,
    );
  } finally {
    dom.window.close();
  }
});

test('vaciar el resumen mantiene los resultados anteriores y devuelve el foco a la búsqueda', async () => {
  const { dom, body } = await open({ saved: previousAnalysis() });
  try {
    const batch = getByRole(body, 'complementary', {
      name: 'Selección de empresas',
    });
    if (!liquidGlass) expand(body, 'selection-review');
    if (liquidGlass) {
      click(body, 'button', 'Seleccionadas');
      getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).click();
      getByRole(body, 'checkbox', { name: /Manufacturas Horizonte/ }).click();
    } else {
      click(batch, 'button', 'Quitar Industrial Aurora');
      click(batch, 'button', 'Quitar Manufacturas Horizonte');
    }
    assert.equal(
      getByRole(body, 'button', { name: 'Analizar selección' }).disabled,
      false,
    );
    assert.equal(body.querySelector('#selected-count').textContent, '0');
    assert.equal(
      dom.window.document.activeElement,
      getByRole(body, 'searchbox'),
    );
    click(body, 'link', 'Resultados');
    assert.equal(getAllByRole(results(body), 'row').length, 2);
  } finally {
    dom.window.close();
  }
});

test('un lote completo lleva directamente a sus valoraciones, con monedas y ausencias correctas', async () => {
  const { dom, body } = await open({ route: 'analizar' });
  try {
    await analyzeAll(dom, body);
    if (liquidGlass)
      assert.ok(getByRole(body, 'searchbox', { name: 'Buscar en resultados' }));
    else assert.equal(queryByRole(body, 'searchbox'), null);
    assert.equal(queryByRole(body, 'checkbox'), null);
    assert.equal(queryByRole(body, 'spinbutton'), null);
    const list = results(body);
    assert.equal(getAllByRole(list, 'row').length, 3);
    assert.match(list.textContent, /116[.,]19/);
    assert.match(list.textContent, /209[.,]14/);
    assert.match(list.textContent, /Sin estimación/);
    assert.equal(
      getByRole(list, 'row', { name: 'Datos insuficientes' }).querySelector(
        '.difference-cell',
      ).textContent,
      '—',
    );
    assert.doesNotMatch(list.textContent, /NOPAT|EBITDA|CAGR|múltiplo|modelo/i);
    for (const name of ['DEMO-USA', 'DEMO-MX.MX', 'DEMO-INCOMPLETA'])
      assert.ok(getByRole(list, 'link', { name: 'Ver análisis de ' + name }));
    assert.match(
      getByRole(list, 'row', { name: 'Industrial Aurora' }).textContent,
      /USD/,
    );
    assert.match(
      getByRole(list, 'row', { name: 'Manufacturas Horizonte' }).textContent,
      /MXN/,
    );
  } finally {
    dom.window.close();
  }
});

test('se puede elegir todo un mercado conservando las empresas ya elegidas de otro', async () => {
  const { dom, body } = await open({
    route: 'analizar',
    saved: previousAnalysis(),
  });
  try {
    if (!liquidGlass) expand(body, 'selection-review');
    click(body, 'button', 'Limpiar selección');
    chooseMarket(dom, body, 'MX');
    selectAllPage(body);
    chooseMarket(dom, body, 'USA');
    selectAllPage(body);
    assert.match(body.querySelector('#selected-count').textContent, /3/);
    click(body, 'button', 'Analizar selección');
    await waitForResults(body, 3);
    assert.equal(getAllByRole(results(body), 'row').length, 3);
  } finally {
    dom.window.close();
  }
});

test('buscar y Enter añade una coincidencia, conserva la selección y espera la acción Analizar', async () => {
  const { dom, body } = await open({
    route: 'analizar',
    saved: {
      initialized: true,
      selected: ['DEMO-USA'],
      jobs: [],
      current: null,
    },
  });
  try {
    const search = getByRole(body, 'searchbox', { name: 'Buscar empresas' });
    input(dom, search, 'DEMO-MX.MX');
    search.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    assert.equal(dom.window.location.hash, '#analizar');
    assert.equal(
      getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).checked,
      true,
    );
    assert.equal(
      getByRole(body, 'checkbox', { name: /Manufacturas Horizonte/ }).checked,
      true,
    );
    assert.equal(
      queryByRole(body, 'table', { name: 'Valoraciones de tus empresas' }),
      null,
    );
    assert.match(body.querySelector('#selected-count').textContent, /2/);
  } finally {
    dom.window.close();
  }
});

test('una selección vacía guardada se conserva y permite volver a elegir', async () => {
  const { dom, body } = await open({
    route: 'analizar',
    saved: { initialized: true, selected: [], jobs: [], current: null },
  });
  try {
    assert.equal(
      getByRole(body, 'button', { name: 'Analizar selección' }).disabled,
      false,
    );
    assert.equal(companyBoxes(body).filter((e) => e.checked).length, 0);
    getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).click();
    assert.equal(
      getByRole(body, 'button', { name: 'Analizar selección' }).disabled,
      false,
    );
    input(dom, getByRole(body, 'searchbox'), 'no existe');
    assert.ok(queryByText(body, /No hay coincidencias/));
    input(dom, getByRole(body, 'searchbox'), '');
    assert.equal(
      getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).checked,
      true,
    );
  } finally {
    dom.window.close();
  }
});

test('editar empresas no altera el resultado anterior y permite regresar sin recalcular', async () => {
  const { dom, body } = await open({
    route: 'resultados',
    saved: previousAnalysis(),
  });
  try {
    const previous = results(body).textContent;
    click(body, 'link', 'Editar selección');
    getByRole(body, 'checkbox', { name: /Datos insuficientes/ }).click();
    assert.match(
      getByRole(body, 'button', { name: 'Analizar selección' }).textContent,
      /Analizar de nuevo/,
    );
    click(body, 'link', 'Resultados');
    assert.equal(results(body).textContent, previous);
    click(body, 'link', 'Editar selección');
    click(body, 'button', 'Analizar selección');
    await waitForResults(body, 3);
    assert.match(results(body).textContent, /Datos insuficientes/);
  } finally {
    dom.window.close();
  }
});

test('el filtro del resultado se reconoce, se retira y ordena sin convertir ausencias en cero', async () => {
  const { dom, body } = await open({ route: 'analizar' });
  try {
    await analyzeAll(dom, body);
    filterHorizonte(dom, body);
    assert.equal(getAllByRole(results(body), 'row').length, 1);
    assert.match(results(body).textContent, /Manufacturas Horizonte/);
    clearResultsMatch(dom, body);
    click(body, 'button', 'Ordenar por diferencia');
    const rows = getAllByRole(results(body), 'row');
    assert.equal(rows[0].getAttribute('aria-label'), 'Manufacturas Horizonte');
    assert.match(rows.at(-1).textContent, /Sin estimación/);
  } finally {
    dom.window.close();
  }
});

test('el detalle presenta una sola comparación, sin tarjetas ni tablas que repitan sus valores', async () => {
  const { dom, body } = await open({
    route: 'resultados',
    saved: previousAnalysis(),
  });
  try {
    const before = results(body).textContent;
    click(body, 'link', 'Ver análisis de DEMO-USA');
    const detail = getByRole(body, 'dialog', { name: 'Detalle de empresa' });
    assert.equal(detail.querySelector('#detail-metrics'), null);
    const comparison = detail.querySelector('.valuation-comparison');
    assert.ok(comparison);
    assert.equal((comparison.textContent.match(/100[.,]00/g) || []).length, 1);
    assert.equal((comparison.textContent.match(/116[.,]19/g) || []).length, 1);
    assert.match(comparison.textContent, /16[.,]19/);
    assert.equal(detail.querySelector('#chart-data-disclosure').hidden, true);
    assert.equal(detail.querySelector('#chart-data table'), null);
    assert.doesNotMatch(
      detail.textContent,
      /Estos datos pertenecen|Los datos son del mismo lote|Por acción|La estimación está por encima/,
    );
    const breakdown = detail.querySelector('#model-breakdown');
    assert.ok(breakdown);
    if (liquidGlass) {
      assert.equal(breakdown.tagName, 'SECTION');
      assert.equal(breakdown.closest('details'), null);
      assert.ok(getByRole(breakdown, 'heading', { name: 'Métodos', level: 2 }));
    } else {
      assert.equal(breakdown.open, false);
      breakdown.querySelector('summary').click();
      assert.equal(breakdown.open, true);
    }
    assert.match(breakdown.textContent, /NOPAT/);
    const methods = getByRole(breakdown, 'table', {
      name: 'Estimaciones por método',
    });
    assert.equal(methods.tBodies[0].rows.length, 4);
    assert.doesNotMatch(methods.textContent, /Precio actual|Valor estimado/);
    if (liquidGlass) {
      const evidence = getByRole(detail, 'region', { name: 'Supuestos' });
      assert.equal(evidence.closest('details'), null);
      assert.ok(
        getByRole(evidence, 'heading', { name: 'Supuestos', level: 2 }),
      );
    } else {
      assert.equal(detail.querySelector('.evidence').open, false);
    }
    click(body, 'button', 'Cerrar análisis');
    assert.equal(dom.window.location.hash, '#resultados');
    assert.equal(results(body).textContent, before);
    assert.equal(
      dom.window.document.activeElement,
      getByRole(body, 'link', { name: 'Ver análisis de DEMO-USA' }),
    );
  } finally {
    dom.window.close();
  }
});

test(
  liquidGlass
    ? 'el buscador queda sobre la tabla fuera de las acciones de exportación'
    : 'los filtros quedan junto a las acciones y no reservan una franja dentro de la tabla',
  async () => {
    const { dom, body } = await open({
      route: 'resultados',
      saved: previousAnalysis(),
    });
    try {
      const filters = liquidGlass
        ? getByRole(body, 'search', { name: 'Búsqueda en resultados' })
        : body.querySelector('#result-options');
      if (liquidGlass) {
        assert.equal(filters.closest('.results-actions'), null);
        assert.equal(filters.querySelector('details, select'), null);
        assert.ok(
          filters.compareDocumentPosition(
            body.querySelector('#populated-results'),
          ) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING,
        );
      } else assert.ok(filters.closest('.results-actions'));
      assert.equal(body.querySelector('#populated-results search'), null);
      assert.equal(body.querySelectorAll('.valuation-table col').length, 4);
      filterHorizonte(dom, body);
      assert.equal(getAllByRole(results(body), 'row').length, 1);
      assert.match(results(body).textContent, /Horizonte/);
    } finally {
      dom.window.close();
    }
  },
);

test(
  liquidGlass
    ? 'salir del buscador y pulsar Escape conserva sus resultados'
    : 'los filtros flotantes se cierran al salir y con Escape sin perder el filtro aplicado',
  async () => {
    const { dom, body } = await open({
      route: 'resultados',
      saved: previousAnalysis(),
    });
    try {
      filterHorizonte(dom, body);
      if (liquidGlass) {
        const field = getByRole(body, 'searchbox', {
          name: 'Buscar en resultados',
        });
        field.focus();
        field.dispatchEvent(
          new dom.window.KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
          }),
        );
        assert.equal(dom.window.document.activeElement, field);
        getByRole(body, 'heading', { name: 'Resultados', exact: true }).click();
        assert.equal(field.value, 'Horizonte');
        assert.equal(field.closest('search').hidden, false);
        assert.equal(getAllByRole(results(body), 'row').length, 1);
      } else {
        const filters = body.querySelector('#result-options');
        filters.querySelector('select').dispatchEvent(
          new dom.window.KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
          }),
        );
        assert.equal(filters.open, false);
        assert.equal(
          dom.window.document.activeElement,
          filters.querySelector('summary'),
        );
        assert.equal(getAllByRole(results(body), 'row').length, 1);
        expand(body, 'result-options');
        getByRole(body, 'heading', { name: 'Resultados', exact: true }).click();
        assert.equal(filters.open, false);
        assert.ok(getByRole(body, 'button', { name: clearHorizonte }));
      }
    } finally {
      dom.window.close();
    }
  },
);

test('precios, finanzas y márgenes conservan sus gráficas, datos y navegación con flechas', async () => {
  const { dom, body } = await open({ route: 'empresa/DEMO-USA' });
  try {
    const first = getByRole(body, 'tab', { name: 'Resumen', exact: true });
    first.focus();
    first.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
      }),
    );
    const prices = getByRole(body, 'tab', { name: 'Precio histórico' });
    assert.equal(dom.window.document.activeElement, prices);
    for (const name of [
      'Precio histórico',
      liquidGlass ? 'Finanzas' : 'Estados financieros',
      'Márgenes',
    ]) {
      click(body, 'tab', name);
      const panel = getByRole(body, 'tabpanel');
      assert.ok(getByRole(panel, 'img', { name: /Industrial Aurora/ }));
      assert.equal(
        panel.getAttribute('aria-labelledby'),
        getByRole(body, 'tab', { name }).id,
      );
      assert.ok(body.querySelector('#chart-data table'));
      assert.equal(body.querySelector('#chart-data-disclosure').hidden, false);
    }
    const dialog = getByRole(body, 'dialog');
    if (
      dialog.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }))
    )
      dialog.close();
    assert.equal(dom.window.location.hash, '#resultados');
  } finally {
    dom.window.close();
  }
});

test('los ajustes agrupan sus campos y conservan la validación antes de guardar', async () => {
  const { dom, body } = await open({ route: 'analizar' });
  try {
    click(body, 'button', 'Ajustes de valoración');
    const dialog = getByRole(body, 'dialog', { name: 'Ajustes de valoración' });
    assert.equal(dialog.querySelectorAll('.settings-extra').length, 2);
    if (liquidGlass) {
      assert.equal(dialog.querySelector('details, summary'), null);
      assert.ok(getByRole(dialog, 'group', { name: 'Crecimiento y márgenes' }));
      assert.ok(
        getByRole(dialog, 'group', {
          name: 'Valores al final de la proyección',
        }),
      );
      assert.equal(getAllByRole(dialog, 'spinbutton').length, 9);
    } else {
      assert.ok(
        [...dialog.querySelectorAll('.settings-extra')].every((d) => !d.open),
      );
    }
    const field = dialog.querySelector('#setting-multiplo_terminal_fcl');
    field.value = '100';
    field.dispatchEvent(new dom.window.Event('invalid', { cancelable: true }));
    if (liquidGlass) {
      assert.equal(field.closest('details'), null);
      assert.equal(field.validity.rangeOverflow, true);
    } else {
      assert.equal(field.closest('details').open, true);
    }
    assert.ok(field.getAttribute('aria-describedby'));
    assert.equal(
      queryByRole(dialog, 'textbox', { name: /cola|worker|API/i }),
      null,
    );
    click(body, 'button', 'Cerrar ajustes');
    assert.equal(queryByRole(body, 'dialog'), null);
  } finally {
    dom.window.close();
  }
});

test('los ajustes personalizados siguen señalados al recuperar una sesión', async () => {
  const { dom, body } = await open({
    saved: {
      initialized: true,
      selected: ['DEMO-USA'],
      config: { tasa_descuento: 0.12 },
      jobs: [],
    },
  });
  try {
    const badge = body.querySelector('#settings-label');
    assert.equal(badge.hidden, false);
    assert.equal(badge.textContent, 'Modificados');
    getByRole(body, 'button', { name: /^Ajustes de valoración/ }).click();
    assert.equal(
      getByRole(body, 'spinbutton', { name: /Tasa de descuento/ }).value,
      '12',
    );
  } finally {
    dom.window.close();
  }
});

test('el historial abre el lote elegido con la selección correspondiente', async () => {
  const { dom, body } = await open({
    route: 'historial',
    saved: {
      initialized: true,
      selected: ['DEMO-USA'],
      current: 'primero',
      jobs: [
        historyJob('primero', ['DEMO-USA']),
        historyJob('segundo', ['DEMO-MX.MX']),
      ],
    },
  });
  try {
    assert.ok(getByRole(body, 'heading', { name: 'Análisis anteriores' }));
    body.querySelector('[data-job="segundo"]').click();
    assert.equal(dom.window.location.hash, '#resultados');
    assert.match(results(body).textContent, /Manufacturas Horizonte/);
    assert.doesNotMatch(results(body).textContent, /Industrial Aurora/);
    click(body, 'link', 'Editar selección');
    assert.equal(
      getByRole(body, 'checkbox', { name: /Manufacturas Horizonte/ }).checked,
      true,
    );
    assert.equal(
      getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).checked,
      false,
    );
  } finally {
    dom.window.close();
  }
});

test('recupera el lote al recargar sin pedir configuración ni duplicarlo', async () => {
  const { dom, body } = await open({
    route: 'resultados',
    saved: {
      initialized: true,
      selected: ['DEMO-USA', 'DEMO-MX.MX'],
      current: 'recuperar',
      jobs: [historyJob('recuperar', ['DEMO-USA', 'DEMO-MX.MX'], 'running', 0)],
    },
  });
  try {
    await waitForResults(body, 2);
    assert.equal(getAllByRole(results(body), 'row').length, 2);
    const saved = JSON.parse(dom.window.localStorage.getItem(storageKey));
    assert.equal(saved.jobs.length, 1);
    assert.equal(saved.jobs[0].status, 'completed');
  } finally {
    dom.window.close();
  }
});

test('la cancelación conserva lo ya procesado y permite iniciar otro lote', async () => {
  const { dom, body } = await open({ route: 'analizar' });
  try {
    selectAllPage(body);
    click(body, 'button', 'Analizar selección');
    await until(() => body.querySelector('#result-rows tr[data-company]'));
    click(body, 'button', 'Cancelar');
    assert.match(body.querySelector('#result-meta').textContent, /cancelado/);
    assert.equal(getAllByRole(results(body), 'row').length, 1);
    click(body, 'link', 'Editar selección');
    click(body, 'button', 'Analizar selección');
    await waitForResults(body, 3);
  } finally {
    dom.window.close();
  }
});

test('navegar mientras trabaja no pierde el lote ni obliga a esperar en una pantalla', async () => {
  const { dom, body } = await open({ route: 'analizar' });
  try {
    selectAllPage(body);
    const button = getByRole(body, 'button', { name: 'Analizar selección' });
    button.click();
    button.click();
    click(body, 'link', 'Analizar');
    assert.equal(dom.window.location.hash, '#analizar');
    await until(
      () =>
        JSON.parse(dom.window.localStorage.getItem(storageKey)).jobs[0]
          .status === 'completed',
    );
    assert.equal(dom.window.location.hash, '#analizar');
    const saved = JSON.parse(dom.window.localStorage.getItem(storageKey));
    assert.equal(saved.jobs.filter((j) => j.ids.length === 3).length, 1);
  } finally {
    dom.window.close();
  }
});

test('Excel conserva las siete hojas y todo el lote aunque haya filtros; un error permite reintentar', async () => {
  let downloaded,
    attempts = 0;
  const xlsx = {
    utils: {
      book_new: () => ({ Sheets: {} }),
      aoa_to_sheet: (rows) => ({ rows, '!ref': 'A1:H4' }),
      book_append_sheet: (book, sheet, name) => {
        book.Sheets[name] = sheet;
      },
    },
    writeFile: (book) => {
      if (++attempts === 1) throw new Error('Fallo simulado');
      downloaded = book;
    },
  };
  const { dom, body } = await open({ route: 'analizar', xlsx });
  try {
    await analyzeAll(dom, body);
    filterHorizonte(dom, body);
    click(body, 'button', 'Descargar Excel');
    await until(() => queryByText(body, /No se pudo exportar/));
    assert.equal(getAllByRole(results(body), 'row').length, 1);
    click(body, 'button', 'Descargar Excel');
    await until(() => downloaded);
    assert.deepEqual(Object.keys(downloaded.Sheets), [
      'Resumen',
      'Modelos',
      'Supuestos',
      'Financieros',
      'Precios',
      'Margenes',
      'Trazabilidad',
    ]);
    assert.equal(downloaded.Sheets.Resumen.rows.length, 4);
    assert.deepEqual(
      Array.from(
        downloaded.Sheets.Resumen.rows.slice(1),
        (row) => row[1],
      ).sort(),
      ['DEMO-INCOMPLETA', 'DEMO-MX.MX', 'DEMO-USA'],
    );
  } finally {
    dom.window.close();
  }
});

test('los enlaces antiguos y la marca llevan al analizador conservando la selección', async () => {
  for (const route of ['inicio', 'ruta-inexistente']) {
    const { dom, body } = await open({
      route,
      saved: {
        initialized: true,
        selected: ['DEMO-MX.MX'],
        jobs: [],
        current: null,
      },
    });
    try {
      assert.ok(getByRole(body, 'searchbox', { name: 'Buscar empresas' }));
      assert.equal(body.dataset.view, 'analizar');
      click(body, 'link', 'Historial');
      click(body, 'link', 'IntVal — Analizador');
      assert.equal(dom.window.location.hash, '#analizar');
      assert.equal(
        getByRole(body, 'checkbox', { name: /Manufacturas Horizonte/ }).checked,
        true,
      );
    } finally {
      dom.window.close();
    }
  }
});

test('la metodología es opcional y los enlaces de contenido no reinician la sesión', async () => {
  const { dom, body } = await open({ route: 'analizar' });
  try {
    getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).click();
    getByRole(body, 'checkbox', { name: /Manufacturas Horizonte/ }).click();
    click(body, 'link', 'Saltar al contenido');
    assert.equal(dom.window.location.hash, '#analizar');
    click(body, 'link', 'Cómo se calcula');
    assert.equal(dom.window.location.hash, '#metodologia');
    assert.ok(getByRole(body, 'heading', { name: 'Cómo se calcula.' }));
    if (liquidGlass) {
      const page = body.querySelector('#screen-method');
      assert.equal(page.querySelector('details, summary'), null);
      assert.equal(getAllByRole(page, 'heading', { level: 2 }).length, 5);
      assert.ok(queryByText(page, /Los tres casos usan/));
    }
    dom.window.history.pushState(null, '', '#analizar');
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
    assert.equal(companyBoxes(body).filter((e) => e.checked).length, 2);
  } finally {
    dom.window.close();
  }
});

test('un lote nuevo muestra sus empresas aunque el resultado anterior estuviera filtrado', async () => {
  const { dom, body } = await open({
    route: 'resultados',
    saved: previousAnalysis(),
  });
  try {
    filterHorizonte(dom, body);
    click(body, 'link', 'Editar selección');
    if (!liquidGlass) expand(body, 'selection-review');
    click(body, 'button', 'Limpiar selección');
    getByRole(body, 'checkbox', { name: /Industrial Aurora/ }).click();
    click(body, 'button', 'Analizar selección');
    await waitForResults(body, 1);
    if (liquidGlass) {
      assert.equal(body.querySelector('#result-search').value, '');
    } else
      assert.equal(
        getByRole(body, 'combobox', { name: 'Mercado del resultado' }).value,
        'all',
      );
    assert.match(results(body).textContent, /Industrial Aurora/);
    assert.equal(getAllByRole(results(body), 'row').length, 1);
  } finally {
    dom.window.close();
  }
});

test('el recorrido también funciona desde un archivo sin acceso a localStorage', async () => {
  const { dom, body } = await open({ file: true, route: 'analizar' });
  try {
    await analyzeAll(dom, body);
    click(body, 'link', 'Ver análisis de DEMO-USA');
    click(body, 'button', 'Cerrar análisis');
    assert.equal(dom.window.location.hash, '#resultados');
    assert.equal(getAllByRole(results(body), 'row').length, 3);
  } finally {
    dom.window.close();
  }
});

test('el HTML no necesita JavaScript de CDN para arrancar y conserva el presupuesto de carga', async () => {
  const source = await readFile(previewFile);
  const { dom } = await open();
  try {
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('script[src], img[src]').length, 0);
    const css = doc.querySelectorAll('link[rel=stylesheet]');
    assert.equal(css.length, 1);
    assert.equal(new URL(css[0].href).hostname, 'fonts.googleapis.com');
    const budgetKiB = liquidGlass ? 40 : 35;
    assert.ok(gzipSync(source).length < budgetKiB * 1024);
    const ids = [...doc.querySelectorAll('[id]')].map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
  } finally {
    dom.window.close();
  }
});
