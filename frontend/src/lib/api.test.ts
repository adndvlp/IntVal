import { afterEach, describe, expect, it, vi } from 'vitest';
import { obtenerMetadatos } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('cliente de metadatos', () => {
  it('usa la URL configurada y sólo capacidades reales', async () => {
    const meta = { schema_version: '1.0', capabilities: ['catalog'] };
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(meta)));
    vi.stubGlobal('fetch', fetcher);
    expect(await obtenerMetadatos('https://api.example')).toEqual(meta);
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.example/api/v1/meta');
  });

  it('permite el mismo origen sin incorporar un proveedor al cliente', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response('{"schema_version":"1.0","capabilities":["catalog"]}'),
      );
    vi.stubGlobal('fetch', fetcher);
    await obtenerMetadatos('');
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/meta');
  });

  it.each([
    new Response('detalle privado', { status: 503 }),
    new Response('<html>Fallback estático</html>'),
    new Response('{"schema_version":"otra","capabilities":["catalog"]}'),
    new Response('{"schema_version":"1.0","capabilities":[]}'),
    new Response('null'),
  ])(
    'rechaza respuestas incompatibles sin exponer detalles',
    async (response) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
      await expect(obtenerMetadatos('')).rejects.toThrow(
        'No se pudo comprobar la conexión.',
      );
    },
  );

  it('normaliza errores de red y permite abortar la consulta', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(new Error('ruta privada del servidor'));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    await expect(obtenerMetadatos('', controller.signal)).rejects.toThrow(
      'No se pudo comprobar la conexión.',
    );
    expect(fetcher.mock.calls[0]?.[1].signal).toBe(controller.signal);
  });
});
