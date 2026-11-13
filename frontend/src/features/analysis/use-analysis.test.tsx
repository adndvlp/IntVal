import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAnalysis } from './use-analysis';
import { server } from './test-server';
import { company, config, job } from './test-fixtures';

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function render(source = 'market') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </StrictMode>
  );
  return renderHook(() => useAnalysis({ baseUrl: '', initialSource: source }), {
    wrapper,
  });
}

it('Mercado carga catálogo pero no crea análisis al abrir; demo se activa una sola vez en StrictMode', async () => {
  const api = server();
  const view = render();
  await waitFor(() =>
    expect(view.result.current.catalog?.source).toBe('market'),
  );
  expect(api.created).toHaveLength(0);
  act(() => view.result.current.changeSource('demo'));
  await waitFor(() =>
    expect(view.result.current.view.current?.rows).toHaveLength(1),
  );
  expect(api.created).toHaveLength(1);
  expect(JSON.parse(api.created[0]!).tickers).toEqual([
    'DEMO-USA',
    'DEMO-MX.MX',
  ]);
});

it('limpiar durante POST cancela la aceptación tardía y no recarga automáticamente la demo', async () => {
  const api = server({ deferCreate: true });
  const view = render('demo');
  await waitFor(() => expect(api.created).toHaveLength(1));
  act(() => view.result.current.clear());
  await act(async () => {
    api.finishCreate();
  });
  await waitFor(() =>
    expect(api.paths.some((p) => p.endsWith('/cancel'))).toBe(true),
  );
  expect(view.result.current.view.current).toBeNull();
  expect(api.created).toHaveLength(1);
  view.unmount();
  const remounted = render('demo');
  await waitFor(() =>
    expect(remounted.result.current.catalog?.source).toBe('demo'),
  );
  expect(api.created).toHaveLength(1);
});

it('cambiar fuente descarta páginas tardías y preserva sólo la selección de la fuente nueva', async () => {
  const api = server({ deferPage: true });
  const view = render('demo');
  await waitFor(() =>
    expect(api.paths.some((p) => p.includes('/results'))).toBe(true),
  );
  act(() => view.result.current.changeSource('market'));
  await act(async () => {
    api.finishPage();
  });
  expect(view.result.current.view.current).toBeNull();
  expect(view.result.current.draft?.selected).toEqual([]);
  expect(api.created).toHaveLength(1);
});

it('editar supuestos no cambia el snapshot; un fallo de envío se reintenta con el mismo UUID', async () => {
  const api = server({ createFails: true });
  const view = render('demo');
  await waitFor(() =>
    expect(view.result.current.view.message).toContain('conectar'),
  );
  await act(async () => {
    await view.result.current.retryCreate();
  });
  await waitFor(() =>
    expect(view.result.current.view.current?.rows).toHaveLength(1),
  );
  expect(JSON.parse(api.created[0]!).client_request_id).toBe(
    JSON.parse(api.created[1]!).client_request_id,
  );
  act(() => view.result.current.changeConfiguration('tasa_descuento', 0.15));
  expect(view.result.current.dirty).toBe(true);
  expect(
    view.result.current.view.current?.job.configuration.tasa_descuento,
  ).toBe(0.1);
  expect(api.created).toHaveLength(2);
});

it('recupera un ID al remontar sin crear otro lote ni guardar resultados financieros', async () => {
  const api = server();
  const view = render('demo');
  await waitFor(() =>
    expect(view.result.current.view.current?.rows).toHaveLength(1),
  );
  expect(sessionStorage.getItem('intval.analysis.v1:')).not.toContain(
    'audit_fields',
  );
  view.unmount();
  const next = render('demo');
  await waitFor(() =>
    expect(next.result.current.view.current?.rows).toHaveLength(1),
  );
  expect(api.created).toHaveLength(1);
});

it('cancelar conserva los parciales y permite reintentar una cancelación no confirmada', async () => {
  const api = server({ state: 'running' });
  const view = render('demo');
  await waitFor(() =>
    expect(view.result.current.view.current?.rows).toHaveLength(1),
  );
  const original = api.fetcher.getMockImplementation()!;
  let fail = true;
  api.fetcher.mockImplementation(async (input, init) => {
    if (String(input).endsWith('/cancel') && fail)
      throw new Error('ruta privada');
    return original(input, init);
  });
  await act(async () => {
    await view.result.current.cancel();
  });
  expect(view.result.current.cancelError).toContain('conectar');
  expect(view.result.current.view.current?.rows).toHaveLength(1);
  fail = false;
  await act(async () => {
    await view.result.current.cancel();
  });
  expect(view.result.current.view.current?.job.state).toBe('cancelled');
  expect(view.result.current.cancelPending).toBe(false);
  expect(api.created).toHaveLength(1);
});

it('drena varias páginas antes de considerar disponibles todos los resultados', async () => {
  const api = server();
  const original = api.fetcher.getMockImplementation()!;
  const complete = {
    ...job('trabajo', 5),
    total: 201,
    processed: 201,
    counts: { OK: 201, 'DATOS INCOMPLETOS': 0, REVISAR: 0, ERROR: 0 },
  };
  api.fetcher.mockImplementation(async (input, init) => {
    const path = String(input);
    if (path.endsWith('/trabajo'))
      return new Response(JSON.stringify(complete));
    if (path.includes('/results')) {
      const after = Number(
        new URL(path, 'https://test.example').searchParams.get('after'),
      );
      const items = Array.from({ length: Math.min(100, 201 - after) }, (_, i) =>
        company(`SYM${after + i}`),
      );
      return new Response(
        JSON.stringify({
          id: 'trabajo',
          items,
          next_cursor: after + items.length,
          processed: 201,
          total: 201,
          done: true,
          revision: 5,
        }),
      );
    }
    return original(input, init);
  });
  const view = render('demo');
  await waitFor(
    () => expect(view.result.current.view.current?.rows).toHaveLength(201),
    { timeout: 5000 },
  );
  expect(view.result.current.loadingRows).toBe(false);
  expect(view.result.current.view.selectedTicker).toBe('SYM0');
  expect(view.result.current.view.current?.rows[200]?.ticker).toBe('SYM200');
  expect(api.created).toHaveLength(1);
});

it('una referencia expirada explica la pérdida sin crear otra solicitud', async () => {
  const api = server({ lost: true });
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
  const view = render('demo');
  await waitFor(() => expect(view.result.current.unavailable).toBe(true));
  expect(view.result.current.transportError?.message).toContain('expiró');
  expect(api.created).toHaveLength(0);
});

it('sigue funcionando con almacenamiento bloqueado y recupera una configuración de navegador inválida', async () => {
  const api = server();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('denegado', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('denegado', 'SecurityError');
  });
  const view = render('demo');
  await waitFor(() =>
    expect(view.result.current.view.current?.rows).toHaveLength(1),
  );
  expect(api.created).toHaveLength(1);
  await act(async () => {
    await view.result.current.retryCreate();
  });
  expect(api.created).toHaveLength(1);
});
