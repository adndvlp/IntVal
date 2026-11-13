import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AnalysisApp from './AnalysisApp';
import { server } from './test-server';
import { catalog, config, metadata } from './test-fixtures';

const nativeShowModal = HTMLDialogElement.prototype.showModal;
const nativeClose = HTMLDialogElement.prototype.close;

vi.mock('./Charts', () => ({
  default: () => <p>Gráfica con datos de la empresa seleccionada.</p>,
}));
beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  HTMLDialogElement.prototype.showModal = nativeShowModal;
  HTMLDialogElement.prototype.close = nativeClose;
});

it('presenta el formulario, elige demo y permite filtrar sin perder el Excel ni los supuestos aceptados', async () => {
  const api = server();
  render(<AnalysisApp baseUrl="" initialSource="market" />);
  await screen.findByRole('radio', { name: 'Demostración' });
  expect(api.created).toHaveLength(0);
  await userEvent.click(screen.getByRole('radio', { name: 'Demostración' }));
  await screen.findByRole('button', { name: 'Ver detalle de DEMO-USA' });
  await userEvent.selectOptions(
    screen.getByLabelText('Estado del resultado'),
    'ERROR',
  );
  expect(
    screen.getByText('No hay empresas que coincidan con estos filtros.'),
  ).toBeTruthy();
  expect(
    (
      screen.getByRole('button', {
        name: 'Descargar Excel completo',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  await userEvent.clear(
    screen.getByLabelText('Tasa de descuento accionista (%)'),
  );
  await userEvent.type(
    screen.getByLabelText('Tasa de descuento accionista (%)'),
    '15',
  );
  expect(screen.getByText(/Hay cambios sin aplicar/)).toBeTruthy();
  expect(api.created).toHaveLength(1);
  await userEvent.click(
    screen.getByRole('button', { name: 'Limpiar resultados' }),
  );
  expect(
    screen.queryByRole('button', { name: 'Descargar Excel completo' }),
  ).toBeNull();
  expect(screen.getByText('Prepara tu próximo análisis.')).toBeTruthy();
  await waitFor(() => expect(api.created).toHaveLength(1));
});

it('una selección vacía anuncia el error y no consulta el motor', async () => {
  const api = server();
  render(<AnalysisApp baseUrl="" initialSource="market" />);
  await screen.findByRole('button', { name: 'Seleccionar todo el mercado' });
  await userEvent.click(
    screen.getByRole('button', { name: 'Analizar empresas' }),
  );
  expect(
    await screen.findByText(/Selecciona al menos una empresa/),
  ).toBeTruthy();
  expect(api.created).toHaveLength(0);
  expect(screen.getByRole('alert').getAttribute('tabindex')).toBe('-1');
});

it('un lote con todas sus filas ERROR termina con observaciones y conserva diagnóstico y Excel', async () => {
  const api = server();
  const original = api.fetcher.getMockImplementation()!;
  api.fetcher.mockImplementation(async (input, init) => {
    const response = await original(input, init);
    const data = await response.json();
    if (data.counts)
      data.counts = { OK: 0, 'DATOS INCOMPLETOS': 0, REVISAR: 0, ERROR: 1 };
    if (String(input).includes('/results'))
      data.items = data.items.map((row: object) => ({
        ...row,
        status: 'ERROR',
        notes: 'Datos no disponibles en este caso.',
      }));
    return new Response(JSON.stringify(data));
  });
  render(<AnalysisApp baseUrl="" initialSource="demo" />);
  expect(
    await screen.findByText('Análisis completado con observaciones'),
  ).toBeTruthy();
  expect(screen.getByText('Error: 1')).toBeTruthy();
  expect(
    (
      screen.getByRole('button', {
        name: 'Descargar Excel completo',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  expect(
    screen.getByRole('button', { name: 'Ver detalle de DEMO-USA' }),
  ).toBeTruthy();
  expect(screen.getByText('Datos no disponibles en este caso.')).toBeTruthy();
});

it('la entrada a la demo usa la misma acción clara que la landing', async () => {
  const api = server();
  render(<AnalysisApp baseUrl="" initialSource="market" />);
  const explore = await screen.findByRole('button', {
    name: 'Explorar la demo',
  });
  await userEvent.click(explore);
  await screen.findByRole('button', { name: 'Ver detalle de DEMO-USA' });
  expect(JSON.parse(api.created[0]!).source).toBe('demo');
});

it('permite buscar, elegir todo un mercado, normalizar extras y editar los nueve supuestos', async () => {
  const api = server();
  render(<AnalysisApp baseUrl="" initialSource="market" />);
  await screen.findByRole('button', { name: 'Seleccionar todo el mercado' });
  await userEvent.click(screen.getByRole('radio', { name: 'USA' }));
  await userEvent.click(
    screen.getByRole('button', { name: 'Seleccionar todo el mercado' }),
  );
  expect(
    (screen.getByRole('checkbox', { name: /AAPL/ }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  await userEvent.click(screen.getByRole('checkbox', { name: /AAPL/ }));
  await userEvent.type(
    screen.getByLabelText('Buscar símbolo en el catálogo'),
    'AAPL',
  );
  await userEvent.click(screen.getByRole('checkbox', { name: /AAPL/ }));
  await userEvent.type(
    screen.getByLabelText('Símbolos adicionales'),
    ' aapl, pe&oles.mx, AAPL ',
  );
  await userEvent.click(screen.getByText('Más supuestos de valoración'));
  for (const label of [
    'Factor conservador de margen (%)',
    'Crecimiento 1–5 como % del CAGR',
    'Crecimiento 6–10 como % del inicial',
  ]) {
    const input = screen.getByLabelText(label);
    await userEvent.clear(input);
    await userEvent.type(input, '50');
  }
  for (const label of [
    'Múltiplo terminal FCL',
    'Múltiplo terminal NOPAT',
    'Múltiplo terminal EBITDA ajustado',
    'Múltiplo terminal utilidad neta',
  ]) {
    const input = screen.getByLabelText(label);
    await userEvent.clear(input);
    await userEvent.type(input, '10');
  }
  await userEvent.click(
    screen.getByRole('button', { name: 'Analizar empresas' }),
  );
  await waitFor(() => expect(api.created).toHaveLength(1));
  const accepted = JSON.parse(api.created[0]!);
  expect(accepted.tickers).toEqual(['AAPL', 'PE&OLES.MX']);
  expect(accepted.configuration.factor_margen_conservador).toBe(0.5);
  expect(accepted.configuration.multiplo_terminal_ebitda).toBe(10);
});

it('una descarga fallida conserva resultados y permite reintentar el mismo snapshot', async () => {
  const api = server();
  render(<AnalysisApp baseUrl="" initialSource="demo" />);
  const button = await screen.findByRole('button', {
    name: 'Descargar Excel completo',
  });
  const original = api.fetcher.getMockImplementation()!;
  let attempts = 0;
  api.fetcher.mockImplementation(async (input, init) => {
    if (String(input).endsWith('/export.xlsx')) {
      attempts += 1;
      return new Response(
        JSON.stringify({
          error: { code: 'EXPORT_FAILED', retryable: false, fields: [] },
        }),
        { status: 500 },
      );
    }
    return original(input, init);
  });
  await userEvent.click(button);
  expect(await screen.findByText(/No se pudo preparar el Excel/)).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Ver detalle de DEMO-USA' }),
  ).toBeTruthy();
  await userEvent.click(
    screen.getByRole('button', { name: 'Descargar Excel completo' }),
  );
  await waitFor(() => expect(attempts).toBe(2));
  expect(api.created).toHaveLength(1);
});

it('una recuperación expirada muestra la explicación sin anunciar un envío nuevo', async () => {
  server({ lost: true });
  sessionStorage.setItem(
    'intval.analysis.v1:',
    JSON.stringify({
      source: 'demo',
      suppressed: false,
      analysis: { id: 'trabajo', dataset: 'demo-1.0' },
      request: {
        source: 'demo',
        client_request_id: '00000000-0000-4000-8000-000000000009',
        tickers: ['DEMO-USA'],
        configuration: config(),
      },
    }),
  );
  render(<AnalysisApp baseUrl="" initialSource="demo" />);
  expect(await screen.findByText(/El análisis expiró/)).toBeTruthy();
  expect(screen.queryByText('Enviando análisis…')).toBeNull();
});

it('permite reconectar metadatos y comunica un mercado deshabilitado sin analizarlo', async () => {
  const meta = metadata();
  meta.sources[1]!.enabled = false;
  const api = server({ meta });
  const original = api.fetcher.getMockImplementation()!;
  let fail = true;
  api.fetcher.mockImplementation(async (input, init) =>
    String(input).endsWith('/meta') && fail
      ? new Response('<html>')
      : original(input, init),
  );
  render(<AnalysisApp baseUrl="" initialSource="market" />);
  const retry = await screen.findByRole('button', {
    name: 'Reintentar conexión',
  });
  expect(screen.getByText('Retomemos la conexión.')).toBeTruthy();
  fail = false;
  await userEvent.click(retry);
  expect(await screen.findByText(/Mercado está deshabilitado/)).toBeTruthy();
  expect(
    (
      screen.getByRole('button', {
        name: 'Analizar empresas',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(api.created).toHaveLength(0);
});

it('cancela un lote desde la vista de progreso conservando las filas parciales', async () => {
  const api = server({ state: 'running' });
  render(<AnalysisApp baseUrl="" initialSource="demo" />);
  await screen.findByRole('button', { name: 'Ver detalle de DEMO-USA' });
  await userEvent.click(
    screen.getByRole('button', { name: 'Cancelar análisis' }),
  );
  expect(
    await screen.findByText('Análisis cancelado', { exact: true }),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Ver detalle de DEMO-USA' }),
  ).toBeTruthy();
  expect(
    (
      screen.getByRole('button', {
        name: 'Descargar Excel completo',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(api.created).toHaveLength(1);
});

it('el panel móvil abre y cierra un diálogo nativo con el formulario conservado', async () => {
  server();
  // jsdom no implementa estas APIs; contención de foco/Esc se comprueban en Chrome.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const media = {
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );
  render(<AnalysisApp baseUrl="" initialSource="market" />);
  const open = await screen.findByRole('button', {
    name: /Configurar análisis/,
  });
  await userEvent.click(open);
  const dialog = screen.getByRole('dialog', { name: 'Configurar análisis' });
  expect((dialog as HTMLDialogElement).open).toBe(true);
  await userEvent.click(
    screen.getByRole('button', { name: 'Cerrar configuración' }),
  );
  expect(
    screen.queryByRole('dialog', { name: 'Configurar análisis' }),
  ).toBeNull();
});

it('pagina un catálogo de 604 empresas y la selección masiva incluye las páginas no visibles', async () => {
  const api = server();
  const original = api.fetcher.getMockImplementation()!;
  api.fetcher.mockImplementation(async (input, init) => {
    if (String(input).includes('/catalog'))
      return new Response(
        JSON.stringify({
          ...catalog('market'),
          total: 604,
          items: Array.from({ length: 604 }, (_, i) => ({
            ticker: `EMP${i}`,
            market: 'USA',
          })),
        }),
      );
    return original(input, init);
  });
  render(<AnalysisApp baseUrl="" initialSource="market" />);
  await screen.findByRole('checkbox', { name: /EMP0/ });
  await userEvent.click(
    screen.getByRole('button', { name: 'Más empresas del catálogo' }),
  );
  expect(screen.getByRole('checkbox', { name: /EMP30/ })).toBeTruthy();
  await userEvent.click(
    screen.getByRole('button', { name: 'Empresas anteriores' }),
  );
  expect(screen.getByRole('checkbox', { name: /EMP0/ })).toBeTruthy();
  await userEvent.type(
    screen.getByLabelText('Buscar símbolo en el catálogo'),
    'INEXISTENTE',
  );
  expect(
    screen.getByText('No hay símbolos que coincidan con la búsqueda.'),
  ).toBeTruthy();
  await userEvent.click(
    screen.getByRole('button', { name: 'Seleccionar todo el mercado' }),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Analizar empresas' }),
  );
  await waitFor(() => expect(api.created).toHaveLength(1));
  expect(JSON.parse(api.created[0]!).tickers).toHaveLength(604);
});

it('valida al abandonar un campo numérico y bloquea el envío hasta corregirlo', async () => {
  const api = server();
  render(<AnalysisApp baseUrl="" initialSource="market" />);
  const input = await screen.findByLabelText(
    'Tasa de descuento accionista (%)',
  );
  await userEvent.clear(input);
  await userEvent.tab();
  expect(input.getAttribute('aria-invalid')).toBe('true');
  await userEvent.click(
    screen.getByRole('button', { name: 'Analizar empresas' }),
  );
  expect(api.created).toHaveLength(0);
  await userEvent.type(input, '10');
  await userEvent.tab();
  expect(input.getAttribute('aria-invalid')).toBe('false');
});

it('aplica filtros locales y descarga el snapshot completo liberando la URL temporal', async () => {
  const api = server();
  const original = api.fetcher.getMockImplementation()!;
  api.fetcher.mockImplementation(async (input, init) =>
    String(input).endsWith('/export.xlsx')
      ? new Response(new Uint8Array([80, 75, 3, 4]), {
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        })
      : original(input, init),
  );
  const create = vi.fn(() => 'blob:test-download');
  const revoke = vi.fn();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  render(<AnalysisApp baseUrl="" initialSource="demo" />);
  await screen.findByRole('button', { name: 'Ver detalle de DEMO-USA' });
  await userEvent.selectOptions(
    screen.getByLabelText('Mercado del resultado'),
    'MX',
  );
  expect(
    screen.queryByRole('button', { name: 'Ver detalle de DEMO-USA' }),
  ).toBeNull();
  await userEvent.selectOptions(
    screen.getByLabelText('Mercado del resultado'),
    'USA',
  );
  await userEvent.click(screen.getByLabelText('Filtrar por upside mínimo'));
  const minimum = screen.getByLabelText('Upside mínimo (%)');
  await userEvent.clear(minimum);
  await userEvent.type(minimum, '20');
  expect(
    screen.queryByRole('button', { name: 'Ver detalle de DEMO-USA' }),
  ).toBeNull();
  await userEvent.click(screen.getByLabelText('Filtrar por upside mínimo'));
  expect(
    screen.getByRole('button', { name: 'Ver detalle de DEMO-USA' }),
  ).toBeTruthy();
  await userEvent.click(
    screen.getByRole('button', { name: 'Descargar Excel completo' }),
  );
  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(create).toHaveBeenCalledOnce();
  expect(
    api.fetcher.mock.calls
      .map(([input]) => String(input))
      .filter((p) => p.endsWith('/export.xlsx')),
  ).toEqual(['/api/v1/analyses/trabajo/export.xlsx']);
  await waitFor(
    () => expect(revoke).toHaveBeenCalledWith('blob:test-download'),
    { timeout: 2000 },
  );
  expect(api.created).toHaveLength(1);
});
