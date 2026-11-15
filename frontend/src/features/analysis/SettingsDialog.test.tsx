import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import SettingsDialog from './SettingsDialog';
import { config } from './test-fixtures';
import {
  configurationKey,
  readConfiguration,
  saveConfiguration,
  validConfiguration,
} from './configuration-storage';
import { mockDialogs } from '../../../tests/support/dialog';
beforeEach(() => {
  mockDialogs();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('nueve campos en tres grupos visibles; guardar conserva escala y precisión', async () => {
  const save = vi.fn(),
    close = vi.fn();
  render(
    <SettingsDialog
      value={config()}
      defaults={config()}
      onSave={save}
      onClose={close}
    />,
  );
  expect(screen.getAllByRole('spinbutton')).toHaveLength(9);
  for (const name of [
    'Tasas de descuento',
    'Crecimiento y márgenes',
    'Valores al final de la proyección',
  ])
    expect(screen.getByRole('group', { name })).toBeTruthy();
  const rate = screen.getByLabelText('Tasa de descuento (%)');
  await userEvent.clear(rate);
  await userEvent.type(rate, '5.5');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(save).toHaveBeenCalledWith({ ...config(), tasa_descuento: 0.055 });
  expect(close).toHaveBeenCalledTimes(1);
});
it('rango, paso y requerido se validan sin perder el campo introducido ni confirmar', async () => {
  const save = vi.fn();
  render(
    <SettingsDialog
      value={config()}
      defaults={config()}
      onSave={save}
      onClose={vi.fn()}
    />,
  );
  const rate = screen.getByLabelText(
    'Tasa de descuento (%)',
  ) as HTMLInputElement;
  await userEvent.clear(rate);
  await userEvent.type(rate, '4');
  await userEvent.tab();
  expect(rate.getAttribute('aria-invalid')).toBe('true');
  fireEvent.submit(rate.form!);
  expect(document.activeElement).toBe(rate);
  expect(rate.value).toBe('4');
  expect(save).not.toHaveBeenCalled();
  await userEvent.clear(rate);
  await userEvent.type(rate, '10.2');
  fireEvent.submit(rate.form!);
  expect(save).not.toHaveBeenCalled();
  await userEvent.clear(rate);
  fireEvent.submit(rate.form!);
  expect(save).not.toHaveBeenCalled();
});
it('restablecer sólo modifica el borrador; cerrar nunca confirma', async () => {
  const save = vi.fn(),
    close = vi.fn();
  render(
    <SettingsDialog
      value={{ ...config(), tasa_descuento: 0.15 }}
      defaults={config()}
      onSave={save}
      onClose={close}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
  expect(
    (screen.getByLabelText('Tasa de descuento (%)') as HTMLInputElement).value,
  ).toBe('10');
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar ajustes' }));
  expect(save).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledTimes(1);
});
it('la preferencia confirmada valida versión y contenido y tolera almacenamiento bloqueado', () => {
  const key = configurationKey('');
  saveConfiguration(key, config());
  expect(readConfiguration(key)).toEqual(config());
  expect(
    validConfiguration({ ...config(), factor_crecimiento_inicial: 0.01 }),
  ).toBe(false);
  sessionStorage.setItem(key, '{');
  expect(readConfiguration(key)).toBeNull();
  sessionStorage.setItem(key, '{"version":2}');
  expect(readConfiguration(key)).toBeNull();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(readConfiguration(key)).toBeNull();
  expect(() => saveConfiguration(key, config())).not.toThrow();
});
