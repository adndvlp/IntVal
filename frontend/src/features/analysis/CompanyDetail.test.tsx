import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import CompanyDetail from './CompanyDetail';
import { AnalysisApi } from './transport';
import { company, job } from './test-fixtures';
import { server } from './test-server';
import { mockDialogs } from '../../../tests/support/dialog';
import { formatDate } from './model';
beforeEach(mockDialogs);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const snapshot = { job: job(), rows: [company(), company('DEMO-MX.MX')] };
function show(
  options: {
    historyFails?: boolean;
    emptyHistory?: boolean;
    emptyMargins?: boolean;
  } = {},
  selected = 'DEMO-USA',
  data = snapshot,
) {
  const api = server(options),
    close = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <CompanyDetail
        snapshot={data}
        selected={selected}
        api={new AnalysisApi('')}
        onClose={close}
      />
    </QueryClientProvider>,
  );
  return { api, close };
}
it('Resumen visible sin consultas: una comparación, cuatro métodos y supuestos del snapshot', () => {
  const { api } = show();
  expect(screen.getByRole('dialog', { name: 'Empresa DEMO-USA' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Métodos' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Supuestos' })).toBeTruthy();
  expect(screen.getAllByRole('rowheader')).toHaveLength(4);
  expect(screen.getAllByText('100.00 USD')).toHaveLength(1);
  expect(screen.getAllByText('116.19 USD')).toHaveLength(1);
  expect(screen.getByText('10.00 % / 10.00 %')).toBeTruthy();
  expect(api.paths).toEqual([]);
});

it('la referencia procede del snapshot y una fecha ausente no se rellena desde metadatos actuales', () => {
  const saved = structuredClone(snapshot);
  saved.rows[0]!.traceability.price_date = '2024-12-31';
  show({}, 'DEMO-USA', saved);
  expect(
    screen.getByText('Fecha de referencia').nextElementSibling?.textContent,
  ).toBe(formatDate('2024-12-31'));
  cleanup();
  saved.rows[0]!.traceability.price_date = null;
  show({}, 'DEMO-USA', saved);
  expect(
    screen.getByText('Fecha de referencia').nextElementSibling?.textContent,
  ).toBe('No disponible');
});

it.each([
  ['Precio histórico', 'dataset_version', 'otra-version'],
  ['Finanzas', 'dataset_version', 'otra-version'],
  ['Precio histórico', 'currency', 'MXN'],
  ['Finanzas', 'currency', 'MXN'],
])('rechaza %s con %s ajeno al snapshot', async (tab, key, value) => {
  show();
  const fetchResource = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (...args: Parameters<typeof fetch>) => {
      const response = await fetchResource(...args);
      const data = await response.json();
      return new Response(JSON.stringify({ ...data, [key]: value }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  await userEvent.click(screen.getByRole('tab', { name: tab }));
  await screen.findByText(
    'La respuesta del servicio no es compatible. Reintenta la conexión.',
  );
  expect(screen.queryByRole('figure')).toBeNull();
  await userEvent.click(screen.getByRole('tab', { name: 'Resumen' }));
  expect(screen.getByText('116.19 USD')).toBeTruthy();
});
it('teclado recorre pestañas sin adquirir al enfocarlas; activa y comparte estados/márgenes', async () => {
  const { api } = show();
  const summary = screen.getByRole('tab', { name: 'Resumen' });
  summary.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(document.activeElement).toBe(
    screen.getByRole('tab', { name: 'Precio histórico' }),
  );
  expect(api.paths).toEqual([]);
  await userEvent.keyboard('{Enter}');
  await screen.findByRole('figure', { name: 'Precio histórico de DEMO-USA' });
  await userEvent.selectOptions(
    screen.getByLabelText('Período del precio histórico'),
    '5y',
  );
  await waitFor(() =>
    expect(api.paths.some((p) => p.endsWith('period=5y'))).toBe(true),
  );
  await userEvent.click(screen.getByRole('tab', { name: 'Finanzas' }));
  await screen.findByRole('figure', {
    name: 'Históricos financieros de DEMO-USA',
  });
  const calls = api.paths.filter((p) => p.endsWith('/financials')).length;
  await userEvent.click(screen.getByRole('tab', { name: 'Márgenes' }));
  await screen.findByRole('figure', {
    name: 'Márgenes históricos de DEMO-USA',
  });
  expect(screen.getByText(/Consulta/).textContent).toContain(
    'Porcentaje de los ingresos',
  );
  expect(screen.getByText(/Consulta/).textContent).not.toContain('Millones');
  expect(api.paths.filter((p) => p.endsWith('/financials'))).toHaveLength(
    calls,
  );
  await userEvent.click(screen.getByText('Datos', { exact: true }));
  expect(
    screen.getByRole('table', { name: 'Datos de márgenes · porcentajes' }),
  ).toBeTruthy();
  screen.getByRole('tab', { name: 'Márgenes' }).focus();
  await userEvent.keyboard('{Home}');
  expect(document.activeElement).toBe(
    screen.getByRole('tab', { name: 'Resumen' }),
  );
});
it('un fallo de histórico conserva Resumen y ofrece reintento localizado', async () => {
  const { api } = show({ historyFails: true });
  await userEvent.click(screen.getByRole('tab', { name: 'Precio histórico' }));
  const retry = await screen.findByRole('button', {
    name: 'Reintentar histórico',
  });
  api.options.historyFails = false;
  await userEvent.click(retry);
  await screen.findByRole('figure', { name: 'Precio histórico de DEMO-USA' });
  await userEvent.click(screen.getByRole('tab', { name: 'Resumen' }));
  expect(screen.getByText('116.19 USD')).toBeTruthy();
});
it('ausencias de precios y márgenes no se presentan como ceros', async () => {
  show({ emptyHistory: true, emptyMargins: true });
  await userEvent.click(screen.getByRole('tab', { name: 'Precio histórico' }));
  await screen.findByText(
    'No hay observaciones disponibles para este histórico.',
  );
  await userEvent.click(screen.getByRole('tab', { name: 'Márgenes' }));
  await screen.findByText(
    'No hay observaciones disponibles para este histórico.',
  );
  await userEvent.click(screen.getByRole('tab', { name: 'Resumen' }));
  expect(screen.getByText('116.19 USD')).toBeTruthy();
});
it('un símbolo ajeno al lote no fabrica un detalle ni consulta históricos', () => {
  const { api } = show({}, 'AJENO');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(api.paths).toEqual([]);
});
