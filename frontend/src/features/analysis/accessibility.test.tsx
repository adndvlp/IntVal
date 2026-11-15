import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import AnalysisApp from './AnalysisApp';
import { server } from './test-server';
import { mockDialogs } from '../../../tests/support/dialog';

beforeEach(() => {
  sessionStorage.clear();
  history.replaceState({}, '', '/#analizar');
  mockDialogs();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('cada supuesto inválido enlaza una explicación visible y la retira después de corregirlo', async () => {
  server();
  render(<AnalysisApp baseUrl="" initialSource="market" />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Ajustes de valoración' }),
  );
  const rate = screen.getByLabelText('Tasa de descuento (%)');
  expect(
    screen.queryByText('Introduce un valor entre 5 y 20, en pasos de 0.5.'),
  ).toBeNull();
  await userEvent.clear(rate);
  await userEvent.tab();
  expect(rate.getAttribute('aria-invalid')).toBe('true');
  const error = screen.getByText(
    'Introduce un valor entre 5 y 20, en pasos de 0.5.',
  );
  expect(rate.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
  await userEvent.type(rate, '10');
  await userEvent.tab();
  expect(
    screen.queryByText('Introduce un valor entre 5 y 20, en pasos de 0.5.'),
  ).toBeNull();
  const multiple = screen.getByLabelText('Múltiplo FCL');
  await userEvent.clear(multiple);
  await userEvent.type(multiple, '99');
  await userEvent.tab();
  const reason = screen.getByText(
    'Introduce un valor entre 4 y 30, en pasos de 1.',
  );
  expect(multiple.getAttribute('aria-describedby')).toBe(reason.id);
});
