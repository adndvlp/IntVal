import { it, expect } from 'vitest';
import { parseWorkspaceRoute } from './workspace-route';
it('fragmentos válidos, símbolos codificados y destinos mal formados no fabrican un detalle', () => {
  expect(parseWorkspaceRoute('#empresa/PE%26OLES.MX')).toEqual({
    screen: 'results',
    ticker: 'PE&OLES.MX',
  });
  expect(parseWorkspaceRoute('#resultados')).toEqual({ screen: 'results' });
  expect(parseWorkspaceRoute('#historial')).toEqual({ screen: 'history' });
  for (const hash of [
    '',
    '#desconocido',
    '#empresa/%E0%A4%A',
    '#empresa/../../secret',
  ])
    expect(parseWorkspaceRoute(hash)).toEqual({ screen: 'selection' });
});
