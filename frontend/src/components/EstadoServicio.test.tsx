import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import EstadoServicio from './EstadoServicio';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('no consulta datos al cargar; informa el alcance de la conexión', () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  render(<EstadoServicio />);
  expect(
    screen.getByRole('button', { name: 'Comprobar conexión' }),
  ).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('Sin comprobar');
  expect(fetcher).not.toHaveBeenCalled();
});

it('impide consultas duplicadas mientras espera y anuncia el resultado', async () => {
  let resolver!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolver = resolve;
        }),
    ),
  );
  render(<EstadoServicio />);
  await userEvent.click(screen.getByRole('button'));
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('status').textContent).toContain('Comprobando');
  resolver(new Response('{"schema_version":"1.0","capabilities":["catalog"]}'));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain(
      'Conexión disponible',
    ),
  );
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(
    false,
  );
});

it('muestra un error seguro y permite reintentar', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('secreto'))
    .mockResolvedValueOnce(
      new Response('{"schema_version":"1.0","capabilities":["catalog"]}'),
    );
  vi.stubGlobal('fetch', fetcher);
  render(<EstadoServicio />);
  await userEvent.click(screen.getByRole('button'));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain(
      'No se pudo comprobar',
    ),
  );
  expect(screen.queryByText('secreto')).toBeNull();
  await userEvent.click(screen.getByRole('button'));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain(
      'Conexión disponible',
    ),
  );
});

it('aborta la petición al abandonar la vista', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(() => new Promise<Response>(() => {}));
  vi.stubGlobal('fetch', fetcher);
  const view = render(<EstadoServicio />);
  await userEvent.click(screen.getByRole('button'));
  const signal = fetcher.mock.calls[0]?.[1]?.signal as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
});
