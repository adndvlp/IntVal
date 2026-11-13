import { afterEach, expect, it, vi } from 'vitest';
import { AnalysisApi, ApiFault } from './transport';
import {
  catalog,
  company,
  config,
  financials,
  job,
  metadata,
  prices,
} from './test-fixtures';

afterEach(() => vi.unstubAllGlobals());
const answer = (value: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
const mock = (value: unknown) => {
  const f = vi.fn().mockResolvedValue(answer(value));
  vi.stubGlobal('fetch', f);
  return f;
};

it('obtiene contrato completo y usa las rutas generadas con señal y credenciales omitidas', async () => {
  const f = mock(metadata());
  const api = new AnalysisApi('https://api.example/');
  const c = new AbortController();
  expect((await api.metadata(c.signal)).limits.max_tickers).toBe(650);
  expect(f.mock.calls[0]?.[0]).toBe('https://api.example/api/v1/meta');
  expect(f.mock.calls[0]?.[1].signal).toBe(c.signal);
  expect(f.mock.calls[0]?.[1].credentials).toBe('omit');
  f.mockResolvedValue(answer(catalog('market')));
  await api.catalog('market', c.signal);
  expect(f.mock.calls[1]?.[0]).toContain('source=market');
});

it('creación conserva UUID/configuración y descarga sólo el snapshot del ID aceptado', async () => {
  const f = mock(job());
  const api = new AnalysisApi('');
  const request = {
    client_request_id: '00000000-0000-4000-8000-000000000009',
    source: 'demo' as const,
    tickers: ['DEMO-USA'],
    configuration: config(),
  };
  await api.create(request);
  expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual(request);
  f.mockResolvedValue(
    new Response(new Uint8Array([80, 75, 3, 4]), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    }),
  );
  const file = await api.download('trabajo', 'demo');
  expect(file.name).toBe('demo_valoraciones_USA_MX.xlsx');
  expect(f.mock.calls[1]?.[0]).toBe('/api/v1/analyses/trabajo/export.xlsx');
  expect(f.mock.calls[1]?.[1].body).toBeUndefined();
});

it('valida páginas, históricos y símbolos codificados sin inventar cifras', async () => {
  const f = mock({
    id: 'trabajo',
    items: [company()],
    next_cursor: 1,
    processed: 1,
    total: 1,
    done: true,
    revision: 2,
  });
  const api = new AnalysisApi('');
  expect((await api.results('trabajo', 0)).items[0]?.median.upside).toBeCloseTo(
    0.1618799305100671,
  );
  f.mockResolvedValue(answer(prices()));
  expect(
    (await api.prices('trabajo', 'DEMO-USA', '1y')).items[0]?.value,
  ).toBeNull();
  f.mockResolvedValue(answer(financials()));
  expect(
    (await api.financials('trabajo', 'PE&OLES.MX')).items[0]?.revenue,
  ).toBe(0.001);
  expect(f.mock.calls.at(-1)?.[0]).toContain('PE%26OLES.MX');
  f.mockResolvedValue(answer(job('trabajo', 4, 'cancelled')));
  expect((await api.cancel('trabajo')).state).toBe('cancelled');
});

it.each([
  null,
  { ...metadata(), capabilities: ['catalog'] },
  { ...metadata(), schema_version: 'otra' },
  '<html>',
  { ...metadata(), configuration: { ...config(), tasa_descuento: true } },
])(
  'rechaza metadatos incompatibles sin casts de una respuesta desconocida',
  async (data) => {
    mock(data);
    await expect(new AnalysisApi('').metadata()).rejects.toBeInstanceOf(
      ApiFault,
    );
  },
);

it('no presenta como válidos una fila no finita ni un cursor incoherente', async () => {
  const row = company();
  row.median.upside = Infinity;
  const f = mock({
    id: 'trabajo',
    items: [row],
    next_cursor: 8,
    processed: 1,
    total: 1,
    done: true,
    revision: 2,
  });
  await expect(new AnalysisApi('').results('trabajo', 0)).rejects.toMatchObject(
    { code: 'INVALID_RESPONSE' },
  );
  f.mockResolvedValue(answer({ ...job(), processed: 10, total: 1 }));
  await expect(new AnalysisApi('').status('trabajo')).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
});

it('errores seguros respetan Retry-After; una respuesta HTML no es un Excel', async () => {
  const f = mock(null);
  f.mockResolvedValue(
    answer(
      {
        error: {
          code: 'ACQUISITION_BUSY',
          message: '/Users/privado/token',
          retryable: true,
          fields: [],
        },
      },
      503,
      { 'Retry-After': '7' },
    ),
  );
  const api = new AnalysisApi('');
  await expect(api.prices('trabajo', 'DEMO-USA', '1y')).rejects.toMatchObject({
    retryable: true,
    retryAfter: 7000,
  });
  try {
    await api.status('trabajo');
  } catch (e) {
    expect(String(e)).not.toContain('privado');
  }
  f.mockResolvedValue(
    new Response('<html>', { headers: { 'Content-Type': 'text/html' } }),
  );
  await expect(api.download('trabajo', 'demo')).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
});

it('normaliza el fallo de red y conserva AbortError para detener la vista', async () => {
  const f = vi.fn().mockRejectedValue(new Error('secreto'));
  vi.stubGlobal('fetch', f);
  const api = new AnalysisApi('');
  await expect(api.metadata()).rejects.toMatchObject({
    code: 'NETWORK_ERROR',
    retryable: true,
  });
  f.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
  await expect(api.status('trabajo')).rejects.toMatchObject({
    name: 'AbortError',
  });
});
