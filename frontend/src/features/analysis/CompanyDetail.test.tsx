import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import CompanyDetail from './CompanyDetail';
import { AnalysisApi } from './transport';
import { company, job } from './test-fixtures';
import { server } from './test-server';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const snapshot = { job: job(), rows: [company(), company('DEMO-MX.MX')] };
function show(
  options: {
    historyFails?: boolean;
    emptyHistory?: boolean;
    emptyMargins?: boolean;
  } = {},
) {
  const api = server(options);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const select = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <CompanyDetail
        snapshot={snapshot}
        selected="DEMO-USA"
        onSelect={select}
        visibleTickers={[]}
        api={new AnalysisApi('')}
        referenceDate="2025-01-03"
      />
    </QueryClientProvider>,
  );
  return { api, select, view };
}

it('adquiere sólo el panel activo, comparte estados/márgenes y cambia el período del precio', async () => {
  const { api, select } = show();
  // El primer import de Recharts también se instrumenta en la suite con cobertura.
  await screen.findByText(
    'Comparación por acción',
    { exact: true },
    { timeout: 5000 },
  );
  expect(api.paths).toEqual([]);
  expect(screen.getByText(/queda fuera del filtro actual/)).toBeTruthy();
  await userEvent.selectOptions(
    screen.getByLabelText('Empresa del detalle'),
    'DEMO-MX.MX',
  );
  expect(select).toHaveBeenCalledWith('DEMO-MX.MX');
  await userEvent.click(
    screen.getByRole('button', { name: 'Precio histórico' }),
  );
  await screen.findByRole('figure', { name: 'Precio histórico de DEMO-USA' });
  await userEvent.selectOptions(
    screen.getByLabelText('Período del precio histórico'),
    '5y',
  );
  await waitFor(() =>
    expect(api.paths.some((p) => p.endsWith('period=5y'))).toBe(true),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Estados financieros' }),
  );
  await screen.findByText('Millones de USD');
  const financialCalls = api.paths.filter((p) =>
    p.endsWith('/financials'),
  ).length;
  await userEvent.click(screen.getByRole('button', { name: 'Márgenes' }));
  await screen.findByRole('figure', {
    name: 'Márgenes históricos de DEMO-USA',
  });
  expect(api.paths.filter((p) => p.endsWith('/financials'))).toHaveLength(
    financialCalls,
  );
  await userEvent.click(
    screen.getByText(/Supuestos aceptados y auditoría completa/),
  );
  expect(screen.getByText('Tasa de impuestos')).toBeTruthy();
});

it('un histórico fallido conserva métricas y permite un reintento localizado', async () => {
  const options = { historyFails: true };
  const { api } = show(options);
  await userEvent.click(
    screen.getByRole('button', { name: 'Precio histórico' }),
  );
  const retry = await screen.findByRole('button', {
    name: 'Reintentar histórico',
  });
  expect(screen.getAllByText('116.19 USD').length).toBeGreaterThan(0);
  expect(screen.queryByText('secreto')).toBeNull();
  options.historyFails = false;
  await userEvent.click(retry);
  await screen.findByRole('figure', { name: 'Precio histórico de DEMO-USA' });
  expect(api.paths.filter((p) => p.includes('/prices'))).toHaveLength(2);
});

it('una serie vacía se distingue del fallo sin cambiar la valoración', async () => {
  show({ emptyHistory: true });
  await userEvent.click(
    screen.getByRole('button', { name: 'Estados financieros' }),
  );
  expect(
    await screen.findByText(
      'No hay observaciones disponibles para este histórico.',
    ),
  ).toBeTruthy();
  expect(screen.getAllByText('116.19 USD').length).toBeGreaterThan(0);
  expect(
    screen.queryByRole('button', { name: 'Reintentar histórico' }),
  ).toBeNull();
});

it('informa márgenes vacíos aunque los estados financieros estén disponibles', async () => {
  const { api } = show({ emptyMargins: true });
  await userEvent.click(
    screen.getByRole('button', { name: 'Estados financieros' }),
  );
  await screen.findByRole('figure', {
    name: 'Históricos financieros de DEMO-USA',
  });
  await userEvent.click(screen.getByRole('button', { name: 'Márgenes' }));
  expect(
    await screen.findByText(
      'No hay observaciones disponibles para este histórico.',
    ),
  ).toBeTruthy();
  expect(
    screen.queryByRole('figure', { name: 'Márgenes históricos de DEMO-USA' }),
  ).toBeNull();
  expect(api.paths.filter((p) => p.endsWith('/financials'))).toHaveLength(1);
});
