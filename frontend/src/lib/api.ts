import type { paths } from './generated/api';

type Metadatos =
  paths['/api/v1/meta']['get']['responses'][200]['content']['application/json'];
type Capacidades = Pick<Metadatos, 'schema_version' | 'capabilities'>;

// Validamos el subconjunto que consume este shell. El resto del DTO se usará
// cuando existan sus vistas, sin convertir un JSON desconocido con un cast.
export async function obtenerMetadatos(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<Capacidades> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/meta`, {
      signal,
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error();
    const data: unknown = await response.json();
    if (
      typeof data !== 'object' ||
      data === null ||
      !('schema_version' in data) ||
      data.schema_version !== '1.0' ||
      !('capabilities' in data) ||
      !Array.isArray(data.capabilities) ||
      !data.capabilities.includes('catalog') ||
      !data.capabilities.every((capability) => typeof capability === 'string')
    )
      throw new Error();
    return { schema_version: data.schema_version, capabilities: ['catalog'] };
  } catch {
    throw new Error('No se pudo comprobar la conexión.');
  }
}
