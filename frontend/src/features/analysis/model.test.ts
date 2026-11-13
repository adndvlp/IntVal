import { describe, expect, it } from 'vitest';
import {
  filterRows,
  summary,
  normalizeTickers,
  configurationChanged,
  formatPercent,
  viewReducer,
  initialView,
} from './model';
import { company, job, config } from './test-fixtures';

describe('selección y presentación del análisis', () => {
  it('normaliza y cuenta después de deduplicar; conserva el símbolo PE&OLES', () => {
    expect(
      normalizeTickers(
        [' aapl ', 'AAPL'],
        'pe&oles.mx, brk-b AAPL',
        'market',
        3,
      ),
    ).toEqual(['AAPL', 'PE&OLES.MX', 'BRK-B']);
    expect(() => normalizeTickers([], '', 'market', 650)).toThrow('Selecciona');
    expect(() => normalizeTickers([], '../app.py', 'market', 650)).toThrow(
      'símbolo',
    );
    expect(() =>
      normalizeTickers(['DEMO-USA'], 'AAPL', 'demo', 650, ['DEMO-USA']),
    ).toThrow('demostración');
    expect(() => normalizeTickers(['A', 'B'], '', 'market', 1)).toThrow(
      'máximo',
    );
  });

  it('filtra conservando ausencias, ordena y calcula KPI sólo sobre filas visibles', () => {
    const rows = [
      company('A', 0.3),
      company('B', null),
      company('C', -0.2),
      company('D', 0.1),
    ];
    const filtered = filterRows(rows, {
      market: 'all',
      status: 'all',
      minUpside: 0.15,
    });
    expect(filtered.map((r) => r.ticker)).toEqual(['A', 'B']);
    expect(summary(filtered)).toEqual({
      count: 2,
      medianUpside: 0.3,
      above15: 1,
      ok: 2,
    });
    expect(
      filterRows(rows, { market: 'MX', status: 'all', minUpside: null }),
    ).toEqual([]);
    expect(summary([])).toEqual({
      count: 0,
      medianUpside: null,
      above15: 0,
      ok: 0,
    });
    expect(summary(rows).medianUpside).toBe(0.1);
    expect(formatPercent(0.15)).toContain('15');
    expect(formatPercent(null)).toBe('—');
  });

  it('compara supuestos editables y no considera la pausa un cambio del formulario', () => {
    expect(
      configurationChanged(config(), { ...config(), pausa_entre_tickers: 0 }),
    ).toBe(false);
    expect(
      configurationChanged({ ...config(), tasa_descuento: 0.15 }, config()),
    ).toBe(true);
  });
});

describe('snapshot de vista y respuestas tardías', () => {
  it('limpiar invalida estado, páginas y fallos de una generación anterior', () => {
    const pending = viewReducer(initialView, { type: 'begin', generation: 1 });
    const cleared = viewReducer(pending, { type: 'clear', generation: 2 });
    expect(
      viewReducer(cleared, {
        type: 'job',
        generation: 1,
        job: job('anterior'),
      }),
    ).toEqual(cleared);
    expect(
      viewReducer(cleared, { type: 'error', generation: 1, message: 'tardío' }),
    ).toEqual(cleared);
  });

  it('preserva el resultado anterior, ignora revisiones viejas y pagina append-only', () => {
    let state = viewReducer(initialView, { type: 'begin', generation: 1 });
    state = viewReducer(state, {
      type: 'job',
      generation: 1,
      job: job('uno', 3),
    });
    state = viewReducer(state, {
      type: 'rows',
      generation: 1,
      id: 'uno',
      after: 0,
      items: [company('A', 0.2)],
    });
    expect(
      viewReducer(state, { type: 'job', generation: 1, job: job('uno', 1) }),
    ).toEqual(state);
    expect(
      viewReducer(state, {
        type: 'rows',
        generation: 1,
        id: 'uno',
        after: 0,
        items: [company('A', 0.2)],
      }),
    ).toEqual(state);
    state = viewReducer(state, { type: 'begin', generation: 2 });
    expect(state.previous?.rows[0]?.ticker).toBe('A');
    state = viewReducer(state, { type: 'job', generation: 2, job: job('dos') });
    state = viewReducer(state, {
      type: 'rows',
      generation: 2,
      id: 'dos',
      after: 0,
      items: [company('B', null)],
    });
    expect(state.selectedTicker).toBe('B');
    expect(state.current?.rows.map((r) => r.ticker)).toEqual(['B']);
    expect(
      viewReducer(state, {
        type: 'rows',
        generation: 1,
        id: 'uno',
        after: 1,
        items: [company('C', null)],
      }),
    ).toEqual(state);
  });
});
