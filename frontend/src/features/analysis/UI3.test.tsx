import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import AnalysisApp from './AnalysisApp';
import { mockDialogs, mountShell } from '../../../tests/support/dialog';
import { server } from './test-server';

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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function run() {
  await userEvent.click(
    await screen.findByRole('checkbox', { name: 'Seleccionar página' }),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Analizar selección' }),
  );
  return screen.findByRole('link', { name: /Empresa DEMO-USA/ });
}

it('el flujo abre resultados, detalle modal y ajustes transaccionales sin modificar el snapshot', async () => {
  const api = server();
  render(<AnalysisApp baseUrl="" initialSource="demo" />);
  await run();
  expect(location.hash).toBe('#resultados');
  expect(screen.queryByLabelText('Mercado del resultado')).toBeNull();
  await userEvent.click(screen.getByRole('link', { name: /Empresa DEMO-USA/ }));
  const detail = screen.getByRole('dialog', { name: /Empresa DEMO-USA/ });
  expect(within(detail).getByRole('heading', { name: 'Métodos' })).toBeTruthy();
  expect(
    within(detail).getByRole('heading', { name: 'Supuestos' }),
  ).toBeTruthy();
  expect(within(detail).queryByText('Ver métodos')).toBeNull();
  await userEvent.click(
    within(detail).getByRole('button', { name: 'Cerrar detalle' }),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Ajustes de valoración' }),
  );
  const settings = screen.getByRole('dialog', {
    name: 'Ajustes de valoración',
  });
  expect(within(settings).getAllByRole('spinbutton')).toHaveLength(9);
  const input = within(settings).getByLabelText('Tasa de descuento (%)');
  await userEvent.clear(input);
  await userEvent.type(input, '15');
  await userEvent.click(
    within(settings).getByRole('button', { name: 'Guardar' }),
  );
  expect(api.created).toHaveLength(1);
  await userEvent.click(
    screen.getByRole('button', {
      name: 'Ajustes Modificados de valoración',
    }),
  );
  expect(
    (screen.getByLabelText('Tasa de descuento (%)') as HTMLInputElement).value,
  ).toBe('15');
  await userEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar ajustes' }));
  await userEvent.click(
    screen.getByRole('button', {
      name: 'Ajustes Modificados de valoración',
    }),
  );
  expect(
    (screen.getByLabelText('Tasa de descuento (%)') as HTMLInputElement).value,
  ).toBe('15');
});

it('historial reabre el mismo ID sin POST y conserva el trabajo mientras se edita la selección', async () => {
  const api = server();
  render(<AnalysisApp baseUrl="" initialSource="demo" />);
  await run();
  await userEvent.click(
    screen.getByRole('button', { name: 'Editar selección' }),
  );
  expect(location.hash).toBe('#analizar');
  await userEvent.click(screen.getByRole('link', { name: 'Historial' }));
  const historyView = screen.getByRole('region', {
    name: 'Análisis anteriores',
  });
  expect(within(historyView).getByText('Datos ficticios')).toBeTruthy();
  expect(screen.queryByText('Servicio conectado')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: /Abrir análisis/ }));
  await screen.findByRole('link', { name: /Empresa DEMO-USA/ });
  expect(api.created).toHaveLength(1);
});

it('cancelar antes de recibir el ID cancela la aceptación tardía sin mostrar sus filas', async () => {
  const api = server({ deferCreate: true });
  render(<AnalysisApp baseUrl="" initialSource="demo" />);
  const select = await screen.findByRole('checkbox', {
    name: 'Seleccionar página',
  });
  await userEvent.click(select);
  await userEvent.click(
    screen.getByRole('button', { name: 'Analizar selección' }),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Cancelar solicitud' }),
  );
  api.finishCreate();
  await waitFor(() =>
    expect(api.paths.some((p) => p.endsWith('/cancel'))).toBe(true),
  );
  expect(location.hash).toBe('#analizar');
  expect(screen.queryByRole('link', { name: /Empresa DEMO-USA/ })).toBeNull();
  expect(api.created).toHaveLength(1);
});
