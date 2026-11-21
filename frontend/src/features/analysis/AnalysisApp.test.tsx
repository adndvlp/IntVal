import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AnalysisApp from './AnalysisApp';
import { server } from './test-server';
import { config, metadata } from './test-fixtures';
import { mockDialogs, mountShell } from '../../../tests/support/dialog';
vi.mock('./Charts', () => ({ default: () => <p>Gráfica histórica.</p> }));
beforeEach(() => {
  sessionStorage.clear();
  history.replaceState({}, '', '/#analizar');
  mockDialogs();
  mountShell();
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function run() {
  const select = await screen.findByRole('checkbox', {
    name: 'Seleccionar página',
  });
  await waitFor(() =>
    expect((select as HTMLInputElement).disabled).toBe(false),
  );
  await userEvent.click(select);
  await userEvent.click(
    screen.getByRole('button', { name: 'Analizar selección' }),
  );
  return screen.findByRole('link', { name: /Empresa DEMO-USA/ });
}
it('selección vacía localizada y demo sin autoinicio, también en móvil', async () => {
  const api = server();
  render(<AnalysisApp baseUrl="" initialSource="market" />);
  await userEvent.click(
    await screen.findByRole('radio', { name: 'Demostración' }),
  );
  await screen.findByRole('checkbox', { name: /DEMO-USA/ });
  expect(api.created).toHaveLength(0);
  await userEvent.click(
    screen.getByRole('button', { name: 'Analizar selección' }),
  );
  expect(
    await screen.findByText(/Selecciona al menos una empresa/),
  ).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('alert'));
  expect(api.created).toHaveLength(0);
});
it('un lote con errores conserva la empresa, su diagnóstico y el Excel', async () => {
  const api = server(),
    original = api.fetcher.getMockImplementation()!;
  api.fetcher.mockImplementation(async (input, init) => {
    const response = await original(input, init),
      data = await response.json();
    if (data.counts)
      data.counts = { OK: 0, 'DATOS INCOMPLETOS': 0, REVISAR: 0, ERROR: 1 };
    if (data.items?.[0]?.proxies) {
      data.items[0].status = 'ERROR';
      data.items[0].median = {
        value_per_share: null,
        upside: null,
        count: 0,
        included_models: [],
      };
      data.items[0].notes = 'Datos no disponibles en este caso.';
    }
    return new Response(JSON.stringify(data), { status: response.status });
  });
  render(<AnalysisApp baseUrl="" initialSource="demo" />);
  const link = await run();
  expect(
    await screen.findByText('Análisis completado con observaciones'),
  ).toBeTruthy();
  expect(screen.getByText('Sin estimación')).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'Excel' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  await userEvent.click(link);
  expect(screen.getByText('Datos no disponibles en este caso.')).toBeTruthy();
});
it('envía los nueve ajustes guardados y normaliza los símbolos adicionales', async () => {
  const api = server();
  render(<AnalysisApp baseUrl="" initialSource="market" />);
  await screen.findByRole('checkbox', { name: /AAPL/ });
  await userEvent.click(screen.getByRole('checkbox', { name: /AAPL/ }));
  await userEvent.type(
    screen.getByLabelText('Símbolos adicionales'),
    'aapl, pe&oles.mx, AAPL',
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Ajustes de valoración' }),
  );
  const dialog = screen.getByRole('dialog');
  for (const input of within(dialog).getAllByRole('spinbutton')) {
    const value = input.getAttribute('name')?.startsWith('multiplo')
      ? '10'
      : input.getAttribute('name')?.includes('descuento')
        ? '15'
        : '50';
    await userEvent.clear(input);
    await userEvent.type(input, value);
  }
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Guardar' }),
  );
  const modifiedSettings = screen.getByRole('button', {
    name: 'Ajustes Modificados de valoración',
  });
  expect(modifiedSettings.textContent).toBe('Ajustes Modificados');
  await userEvent.click(
    screen.getByRole('button', { name: 'Analizar selección' }),
  );
  await waitFor(() => expect(api.created).toHaveLength(1));
  const sent = JSON.parse(api.created[0]!);
  expect(sent.tickers).toEqual(['AAPL', 'PE&OLES.MX']);
  expect(sent.configuration).toEqual({
    ...config(),
    tasa_descuento: 0.15,
    tasa_descuento_empresa: 0.15,
    factor_margen_conservador: 0.5,
    factor_crecimiento_inicial: 0.5,
    factor_crecimiento_final: 0.5,
    multiplo_terminal_fcl: 10,
    multiplo_terminal_ebit: 10,
    multiplo_terminal_ebitda: 10,
    multiplo_terminal_utilidad_neta: 10,
  });
});
it('una descarga fallida conserva búsqueda y snapshot y permite reintentar sin otro análisis', async () => {
  const api = server(),
    original = api.fetcher.getMockImplementation()!;
  let fail = true;
  api.fetcher.mockImplementation((input, init) =>
    String(input).endsWith('/export.xlsx')
      ? fail
        ? Promise.reject(new Error('network'))
        : Promise.resolve(
            new Response('PK\x03\x04', {
              headers: {
                'Content-Type':
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              },
            }),
          )
      : original(input, init),
  );
  const create = vi.fn(() => 'blob:excel');
  const revoke = vi.fn();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<AnalysisApp baseUrl="" initialSource="demo" />);
  await run();
  await userEvent.type(
    screen.getByRole('searchbox', { name: 'Buscar en resultados' }),
    'DEMO-USA',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Excel' }));
  await screen.findByText(
    'No se pudo conectar con el servicio. Puedes reintentar.',
  );
  fail = false;
  await userEvent.click(screen.getByRole('button', { name: 'Excel' }));
  await waitFor(() => expect(create).toHaveBeenCalled());
  expect(api.created).toHaveLength(1);
  expect(
    (
      screen.getByRole('searchbox', {
        name: 'Buscar en resultados',
      }) as HTMLInputElement
    ).value,
  ).toBe('DEMO-USA');
  await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:excel'), {
    timeout: 2000,
  });
});
it('una recuperación expirada conserva el borrador y no anuncia un envío nuevo', async () => {
  const api = server({ lost: true });
  sessionStorage.setItem(
    'intval.analysis.v1:',
    JSON.stringify({
      source: 'demo',
      suppressed: false,
      request: {
        source: 'demo',
        client_request_id: crypto.randomUUID(),
        tickers: ['DEMO-USA'],
        configuration: config(),
      },
      analysis: { id: 'trabajo', dataset: 'demo-1.0' },
    }),
  );
  history.replaceState({}, '', '/#resultados');
  render(<AnalysisApp baseUrl="" initialSource="demo" />);
  await screen.findByText(/El análisis expiró/);
  expect(api.created).toHaveLength(0);
  expect(screen.queryByText('Enviando análisis…')).toBeNull();
  await userEvent.click(
    screen.getByRole('button', { name: 'Volver a analizar' }),
  );
  await waitFor(() =>
    expect(
      (screen.getByRole('checkbox', { name: /DEMO-USA/ }) as HTMLInputElement)
        .checked,
    ).toBe(true),
  );
});
it('metadatos fallidos se reintentan y Mercado deshabilitado no envía análisis', async () => {
  const meta = metadata();
  meta.sources[1]!.enabled = false;
  const api = server({ meta }),
    original = api.fetcher.getMockImplementation()!;
  let fail = true;
  api.fetcher.mockImplementation((input, init) =>
    String(input).endsWith('/meta') && fail
      ? Promise.resolve(
          new Response(
            JSON.stringify({
              error: { code: 'INVALID_REQUEST', fields: [], retryable: false },
            }),
            { status: 422 },
          ),
        )
      : original(input, init),
  );
  render(<AnalysisApp baseUrl="" initialSource="market" />);
  await screen.findByRole('button', { name: 'Reintentar conexión' });
  fail = false;
  await userEvent.click(
    screen.getByRole('button', { name: 'Reintentar conexión' }),
  );
  await screen.findByText(/Mercado está deshabilitado/);
  expect(
    (
      screen.getByRole('button', {
        name: 'Analizar selección',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(api.created).toHaveLength(0);
});
it('cancelar conserva los parciales y consultar selección no cancela automáticamente', async () => {
  const api = server({ state: 'running' });
  render(<AnalysisApp baseUrl="" initialSource="demo" />);
  await run();
  await userEvent.click(
    screen.getByRole('button', { name: 'Editar selección' }),
  );
  expect(api.paths.filter((p) => p.endsWith('/cancel'))).toHaveLength(0);
  await userEvent.click(screen.getByRole('link', { name: 'Resultados' }));
  await userEvent.click(
    screen.getByRole('button', { name: 'Cancelar análisis' }),
  );
  await within(
    screen.getByRole('region', { name: 'Resultados del análisis' }),
  ).findByText('Análisis cancelado');
  expect(screen.getByRole('link', { name: /Empresa DEMO-USA/ })).toBeTruthy();
});
