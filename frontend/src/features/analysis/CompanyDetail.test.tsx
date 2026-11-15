import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import CompanyDetail from './CompanyDetail';
import { AnalysisApi } from './transport';
import { company, job } from './test-fixtures';
import { server } from './test-server';
import { mockDialogs } from '../../../tests/support/dialog';
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
) {
  const api = server(options),
    close = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <CompanyDetail
        snapshot={snapshot}
        selected={selected}
        api={new AnalysisApi('')}
        referenceDate="2025-01-03"
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
