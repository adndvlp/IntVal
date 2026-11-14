import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAnalysis } from './use-analysis';
import { server } from './test-server';
import { job, company } from './test-fixtures';

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function view() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return renderHook(() => useAnalysis({ baseUrl: '', initialSource: 'demo' }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}
it('reconecta páginas después de un fallo y no crea otro trabajo ni duplica filas', async () => {
  const api = server();
  const original = api.fetcher.getMockImplementation()!;
  let failing = true;
  api.fetcher.mockImplementation(async (input, init) =>
    String(input).includes('/results') && failing
      ? new Response(
          JSON.stringify({
            error: {
              code: 'SERVICE_UNAVAILABLE',
              retryable: false,
              fields: [],
            },
          }),
          { status: 503 },
        )
      : original(input, init),
  );
  const app = view();
  await waitFor(() => expect(app.result.current.transportError).toBeTruthy());
  expect(api.created).toHaveLength(1);
  failing = false;
  await act(async () => {
    await app.result.current.reconnect();
  });
  await waitFor(() =>
    expect(app.result.current.snapshot?.rows).toHaveLength(1),
  );
  await act(async () => {
    await app.result.current.reconnect();
  });
  expect(app.result.current.snapshot?.rows).toHaveLength(1);
  expect(api.created).toHaveLength(1);
});

it('un 410 durante un lote conserva las filas, bloquea exportar y no crea un UUID nuevo', async () => {
  const api = server({ state: 'running' });
  const app = view();
  await waitFor(() =>
    expect(app.result.current.snapshot?.rows).toHaveLength(1),
  );
  const original = api.fetcher.getMockImplementation()!;
  api.fetcher.mockImplementation(async (input, init) =>
    String(input).endsWith('/trabajo')
      ? new Response(
          JSON.stringify({
            error: { code: 'ANALYSIS_EXPIRED', retryable: false, fields: [] },
          }),
          { status: 410 },
        )
      : original(input, init),
  );
  await act(async () => {
    await app.result.current.reconnect();
  });
  await waitFor(() => expect(app.result.current.unavailable).toBe(true));
  expect(app.result.current.snapshot?.rows).toHaveLength(1);
  expect(api.created).toHaveLength(1);
});

it('un segundo análisis conserva el anterior hasta sus primeras filas y cambia la selección al lote nuevo', async () => {
  const api = server();
  const app = view();
  await waitFor(() =>
    expect(app.result.current.snapshot?.rows).toHaveLength(1),
  );
  const original = api.fetcher.getMockImplementation()!;
  let release!: (v: Response) => void;
  api.fetcher.mockImplementation(async (input, init) => {
    const path = String(input);
    if (path.endsWith('/analyses') || path.endsWith('/nuevo'))
      return new Response(JSON.stringify(job('nuevo')));
    if (path.includes('/nuevo/results'))
      return new Promise<Response>((r) => {
        release = r;
      });
    return original(input, init);
  });
  act(() => app.result.current.changeConfiguration('tasa_descuento', 0.15));
  await act(async () => {
    await app.result.current.submit();
  });
  expect(app.result.current.snapshot?.job.id).toBe('trabajo');
  await waitFor(() => expect(release).toBeTypeOf('function'));
  await act(async () => {
    release(
      new Response(
        JSON.stringify({
          id: 'nuevo',
          items: [company('SOLO-NUEVO')],
          next_cursor: 1,
          processed: 1,
          total: 1,
          done: true,
          revision: 3,
        }),
      ),
    );
  });
  await waitFor(() =>
    expect(app.result.current.snapshot?.job.id).toBe('nuevo'),
  );
  expect(app.result.current.snapshot?.rows.map((r) => r.ticker)).toEqual([
    'SOLO-NUEVO',
  ]);
  expect(app.result.current.view.selectedTicker).toBe('SOLO-NUEVO');
});
