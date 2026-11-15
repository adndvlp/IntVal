// Respuestas y XLSX generados por FastAPI/Python en esta ejecución; no hay servidor TCP.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from 'vitest';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnalysisApp from './AnalysisApp';
import { AnalysisApi } from './transport';
import { configurationFields, formatNumber } from './model';
import { companyName, formatDifference } from './ResultsTable';
import { mockDialogs, mountShell } from '../../../tests/support/dialog';
import appearanceMarkup from '../../components/Appearance.astro?raw';
import { initAppearance } from '../appearance/appearance';
import type {
  Catalog,
  CreateRequest,
  Financials,
  Job,
  Metadata,
  Prices,
  ResultsPage,
  Snapshot,
} from './types';

type Case = Snapshot & {
  accepted: Job;
  request: CreateRequest;
  page: ResultsPage;
  prices: Record<string, Prices>;
  financials: Record<string, Financials>;
  xlsx: string;
  download_headers: Record<string, string>;
};
type Exchange = {
  metadata: Metadata;
  catalog: Catalog;
  cases: Record<string, Case>;
};
let folder: string, exchange: Exchange;
let disposeAppearance: (() => void) | undefined;
beforeAll(() => {
  folder = mkdtempSync(join(tmpdir(), 'intval-ui4-'));
  execFileSync(
    resolve(process.cwd(), '../.venv/bin/python'),
    ['-m', 'tests.fixtures.intercambio_ui4', folder],
    {
      cwd: resolve(process.cwd(), '..'),
      stdio: 'pipe',
      timeout: 30000,
    },
  );
  exchange = JSON.parse(
    readFileSync(join(folder, 'exchange.json'), 'utf8'),
  ) as Exchange;
}, 35000);
afterAll(() => {
  if (folder) rmSync(folder, { recursive: true, force: true });
});
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  history.replaceState({}, '', '/#analizar');
  mockDialogs();
  mountShell();
});
afterEach(() => {
  disposeAppearance?.();
  disposeAppearance = undefined;
  cleanup();
  document.head.innerHTML = '';
  document.documentElement.removeAttribute('style');
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function replay() {
  const posts: CreateRequest[] = [],
    exports: string[] = [];
  let release: (() => void) | undefined;
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://asgi.test'),
        path = decodeURIComponent(url.pathname);
      if (path.endsWith('/meta')) return json(exchange.metadata);
      if (path.endsWith('/catalog')) return json(exchange.catalog);
      if (init?.method === 'POST' && path.endsWith('/analyses')) {
        const request = JSON.parse(String(init.body)) as CreateRequest;
        posts.push(request);
        const accepted = Object.values(exchange.cases).find(
          (c) =>
            c.request.source === request.source &&
            [...c.request.tickers].sort().join() ===
              [...request.tickers].sort().join() &&
            configurationFields.every(
              (f) =>
                c.request.configuration?.[f.key] ===
                request.configuration?.[f.key],
            ),
        );
        if (!accepted)
          throw new Error(
            'POST distinto de las solicitudes conciliadas con Python',
          );
        return json(accepted.accepted, 202);
      }
      const data = Object.values(exchange.cases).find((c) =>
        path.includes(c.job.id),
      );
      if (!data) throw new Error(`ID desconocido: ${path}`);
      if (path.endsWith('/export.xlsx')) {
        exports.push(data.job.id);
        return new Promise<Response>((done) => {
          release = () =>
            done(
              new Response(readFileSync(join(folder, data.xlsx)), {
                headers: data.download_headers,
              }),
            );
        });
      }
      if (path.endsWith('/results')) return json(data.page);
      const ticker = path.split('/companies/')[1]?.split('/')[0];
      if (ticker && path.endsWith('/prices')) return json(data.prices[ticker]);
      if (ticker && path.endsWith('/financials'))
        return json(data.financials[ticker]);
      return json(data.job);
    }),
  );
  return { posts, exports, release: () => release?.() };
}

it('el transporte conserva sin transformar todos los valores y unidades reales de Python', async () => {
  replay();
  const api = new AnalysisApi('');
  for (const data of Object.values(exchange.cases)) {
    expect(await api.status(data.job.id)).toEqual(data.job);
    expect((await api.results(data.job.id, 0)).items).toEqual(data.rows);
    for (const row of data.rows.filter((c) => c.status !== 'ERROR')) {
      expect(await api.prices(data.job.id, row.ticker, '1y')).toEqual(
        data.prices[row.ticker],
      );
      expect(await api.financials(data.job.id, row.ticker)).toEqual(
        data.financials[row.ticker],
      );
    }
  }
});

it('el formulario envía los nueve ajustes a Python; detalle y ambos Excel conservan el lote aceptado', async () => {
  const calls = replay(),
    original = exchange.cases.default!,
    modified = exchange.cases.custom!;
  const downloads: Blob[] = [];
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(blob: Blob) {
        downloads.push(blob);
        return 'blob:ui4';
      }
      static revokeObjectURL() {}
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<AnalysisApp baseUrl="" initialSource="demo" />);
  document.head.innerHTML = '<meta name="color-scheme" content="light dark">';
  document.body.insertAdjacentHTML('beforeend', appearanceMarkup);
  vi.stubGlobal('matchMedia', () =>
    Object.assign(new EventTarget(), { matches: false }),
  );
  disposeAppearance = initAppearance();
  await userEvent.click(
    await screen.findByRole('checkbox', { name: 'Seleccionar página' }),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Analizar selección' }),
  );
  await screen.findByRole('link', { name: 'Industrial Aurora' });
  const table = screen.getByRole('table', { name: 'Resultados por empresa' });
  for (const row of original.rows) {
    const rendered = within(table)
      .getByRole('link', { name: companyName(row) })
      .closest('tr')!;
    const values = within(rendered)
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect(values).toEqual([
      formatNumber(row.market_price),
      row.median.value_per_share === null
        ? 'Sin estimación'
        : formatNumber(row.median.value_per_share),
      formatDifference(row.median.upside),
    ]);
  }
  await userEvent.click(within(table).getByRole('button', { name: 'Precio' }));
  await userEvent.type(
    screen.getByRole('searchbox', { name: 'Buscar en resultados' }),
    'Horizonte',
  );
  expect(within(table).getAllByRole('rowheader')).toHaveLength(1);
  await userEvent.click(
    screen.getByRole('button', { name: 'Ajustes de valoración' }),
  );
  for (const f of configurationFields) {
    const field = screen.getByLabelText(f.label);
    await userEvent.clear(field);
    await userEvent.type(
      field,
      String(
        Number(
          (modified.request.configuration![f.key] * f.scale).toPrecision(12),
        ),
      ),
    );
  }
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await userEvent.click(
    within(table).getByRole('link', { name: 'Manufacturas Horizonte' }),
  );
  const detail = screen.getByRole('dialog', { name: 'Manufacturas Horizonte' });
  expect(within(detail).getByText('10.00 % / 10.00 %')).toBeTruthy();
  await userEvent.click(within(detail).getByRole('button', { name: 'Excel' }));
  const busy = await screen.findAllByRole('button', {
    name: /Preparando Excel/,
    hidden: true,
  });
  expect(busy).toHaveLength(2);
  expect(busy.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  expect(calls.exports).toEqual([original.job.id]);
  calls.release();
  await waitFor(() => expect(downloads).toHaveLength(1));
  expect(Buffer.from(await downloads[0]!.arrayBuffer())).toEqual(
    readFileSync(join(folder, original.xlsx)),
  );
  await userEvent.click(
    within(detail).getByRole('button', { name: 'Cerrar detalle' }),
  );
  expect(
    (
      screen.getByRole('searchbox', {
        name: 'Buscar en resultados',
      }) as HTMLInputElement
    ).value,
  ).toBe('Horizonte');
  await userEvent.click(screen.getByRole('button', { name: 'Modo oscuro' }));
  document.querySelector<HTMLDetailsElement>('#palette-switcher')!.open = true;
  await userEvent.click(screen.getByRole('radio', { name: 'Lavanda' }));
  expect(document.documentElement.dataset.palette).toBe('lavender');
  expect(
    document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')!
      .content,
  ).toBe('dark');
  expect(calls.posts).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Excel' }));
  await waitFor(() =>
    expect(calls.exports).toEqual([original.job.id, original.job.id]),
  );
  calls.release();
  await waitFor(() => expect(downloads).toHaveLength(2));
  expect(Buffer.from(await downloads[1]!.arrayBuffer())).toEqual(
    readFileSync(join(folder, original.xlsx)),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Editar selección' }),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Analizar selección' }),
  );
  await waitFor(() => expect(calls.posts).toHaveLength(2));
  expect(calls.posts[1]!.configuration).toEqual(modified.request.configuration);
  expect(calls.posts[1]!.tickers).toEqual(modified.request.tickers);
  await screen.findByRole('link', { name: 'Industrial Aurora' });
  const newTable = screen.getByRole('table', {
    name: 'Resultados por empresa',
  });
  expect(newTable.textContent).toContain(
    formatNumber(modified.rows[0]!.median.value_per_share),
  );
  await userEvent.click(screen.getByRole('link', { name: 'Historial' }));
  const entries = screen.getByRole('region', { name: 'Análisis anteriores' });
  const prior = within(entries)
    .getAllByRole('button', { name: /Abrir análisis/ })
    .at(-1)!;
  await userEvent.click(prior);
  await waitFor(() =>
    expect(
      screen.getByRole('table', { name: 'Resultados por empresa' }).textContent,
    ).toContain('116.19'),
  );
  expect(calls.posts).toHaveLength(2);
}, 15000);
