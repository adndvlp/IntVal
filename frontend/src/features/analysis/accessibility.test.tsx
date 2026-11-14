import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import AnalysisApp from './AnalysisApp';
import { server } from './test-server';

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('cada supuesto inválido enlaza una explicación visible y la retira después de corregirlo', async () => {
  server();
  render(<AnalysisApp baseUrl="" initialSource="market" />);
  const rate = await screen.findByLabelText('Tasa de descuento accionista (%)');
  expect(screen.queryByText('Introduce un valor entre 5 y 20.')).toBeNull();
  await userEvent.clear(rate);
  await userEvent.tab();
  expect(rate.getAttribute('aria-invalid')).toBe('true');
  const error = screen.getByText('Introduce un valor entre 5 y 20.');
  expect(rate.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
  await userEvent.type(rate, '10');
  await userEvent.tab();
  expect(screen.queryByText('Introduce un valor entre 5 y 20.')).toBeNull();
  await userEvent.click(screen.getByText('Más supuestos de valoración'));
  const multiple = screen.getByLabelText('Múltiplo terminal FCL');
  await userEvent.clear(multiple);
  await userEvent.type(multiple, '99');
  await userEvent.tab();
  const reason = screen.getByText('Introduce un valor entre 4 y 30.');
  expect(multiple.getAttribute('aria-describedby')).toBe(reason.id);
});
