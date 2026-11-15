import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import AnalysisApp from './AnalysisApp';
import { server } from './test-server';
import { catalog } from './test-fixtures';

vi.mock('./Charts', () => ({ default: () => <p>Gráfica.</p> }));
beforeEach(() => {
  sessionStorage.clear();
  history.replaceState({}, '', '/#analizar');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(count = 1203) {
  const api = server();
  const original = api.fetcher.getMockImplementation()!;
  api.fetcher.mockImplementation(async (input, init) => {
    if (String(input).includes('/catalog'))
      return new Response(
        JSON.stringify({
          ...catalog('market'),
          total: count,
          items: Array.from({ length: count }, (_, i) => ({
            ticker: `C${String(i).padStart(4, '0')}`,
            market: i % 2 ? 'MX' : 'USA',
            name:
              i === 1202
                ? 'Aurora Final'
                : `Compañía Álamo ${String(i).padStart(4, '0')}`,
            currency: i % 2 ? 'MXN' : 'USD',
          })),
        }),
      );
    return original(input, init);
  });
  return {
    api,
    mount: () => render(<AnalysisApp baseUrl="" initialSource="market" />),
  };
}
const box = (ticker: string) =>
  screen.getByRole('checkbox', {
    name: new RegExp(`\\b${ticker}\\b`),
  }) as HTMLInputElement;
const picker = () =>
  screen.getByRole('region', { name: 'Empresas que quieres analizar' });
const master = () =>
  screen.getByRole('checkbox', {
    name: 'Seleccionar página',
  }) as HTMLInputElement;
const search = () => screen.getByRole('searchbox', { name: 'Buscar empresas' });
const next = () =>
  within(picker()).getByRole('button', { name: 'Siguiente página' });
const market = () =>
  screen.getByRole('combobox', { name: 'Mercado de las empresas' });

it('1203 empresas: monta 25 filas, diferencia página/global y conserva selección entre mercados', async () => {
  const { api, mount } = setup();
  mount();
  await screen.findByRole('checkbox', { name: /C0000/ });
  expect(within(picker()).getAllByRole('checkbox')).toHaveLength(26);
  expect(box('C0000').checked).toBe(false);
  await userEvent.click(box('C0000'));
  expect(master().indeterminate).toBe(true);
  await userEvent.click(master());
  expect(master().checked).toBe(true);
  expect(
    screen.getByRole('button', { name: 'Seleccionar 1,203 empresas' }),
  ).toBeTruthy();
  await userEvent.click(next());
  expect(box('C0025').checked).toBe(false);
  await userEvent.click(box('C0025'));
  await userEvent.selectOptions(market(), 'USA');
  expect(
    screen.getByRole('status', { name: 'Empresas seleccionadas' }).textContent,
  ).toContain('26');
  await userEvent.selectOptions(market(), 'all');
  await userEvent.click(
    within(picker()).getByRole('button', { name: 'Última página' }),
  );
  expect(within(picker()).getAllByRole('checkbox')).toHaveLength(4);
  expect(box('C1202')).toBeTruthy();
  expect(api.created).toHaveLength(0);
});

it('buscar usa nombre o símbolo normalizados antes de paginar; Enter sólo añade una coincidencia y respeta IME', async () => {
  const { api, mount } = setup();
  mount();
  await screen.findByRole('checkbox', { name: /C0000/ });
  await userEvent.type(search(), 'aurora final');
  expect(box('C1202')).toBeTruthy();
  fireEvent.keyDown(search(), { key: 'Enter', isComposing: true });
  expect(box('C1202').checked).toBe(false);
  await userEvent.type(search(), '{Enter}');
  expect(box('C1202').checked).toBe(true);
  await userEvent.clear(search());
  await userEvent.type(search(), 'COMPANIA ALAMO');
  expect(within(picker()).getAllByRole('checkbox')).toHaveLength(26);
  await userEvent.type(search(), '{Enter}');
  expect(
    screen.getByRole('status', { name: 'Empresas seleccionadas' }).textContent,
  ).toContain('1 seleccionada');
  await userEvent.clear(search());
  await userEvent.type(search(), 'c0500');
  expect(box('C0500')).toBeTruthy();
  expect(api.created).toHaveLength(0);
});

it('Catálogo y Seleccionadas comparten lista y conservan cada contexto; retirar la última vuelve al buscador', async () => {
  const { mount } = setup(80);
  mount();
  await screen.findByRole('checkbox', { name: /C0000/ });
  await userEvent.click(box('C0000'));
  await userEvent.click(box('C0001'));
  await userEvent.selectOptions(market(), 'USA');
  await userEvent.type(search(), 'Álamo');
  await userEvent.click(next());
  expect(box('C0050')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Seleccionadas' }));
  expect((search() as HTMLInputElement).value).toBe('');
  expect((market() as HTMLSelectElement).value).toBe('all');
  expect(within(picker()).getAllByRole('checkbox')).toHaveLength(3);
  await userEvent.type(search(), 'c0001');
  await userEvent.click(screen.getByRole('button', { name: 'Catálogo' }));
  expect((search() as HTMLInputElement).value).toBe('Álamo');
  expect((market() as HTMLSelectElement).value).toBe('USA');
  expect(box('C0050')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Seleccionadas' }));
  expect((search() as HTMLInputElement).value).toBe('c0001');
  await userEvent.clear(search());
  await userEvent.click(box('C0000'));
  expect(document.activeElement).toBe(box('C0001'));
  await userEvent.click(box('C0001'));
  expect(
    screen
      .getByRole('button', { name: 'Catálogo' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  expect(document.activeElement).toBe(search());
});

it('la selección global no se trunca al superar el límite y no se envía al servidor', async () => {
  const { api, mount } = setup();
  mount();
  await screen.findByRole('checkbox', { name: /C0000/ });
  await userEvent.click(master());
  await userEvent.click(
    screen.getByRole('button', { name: 'Seleccionar 1,203 empresas' }),
  );
  expect(
    screen.getByRole('status', { name: 'Empresas seleccionadas' }).textContent,
  ).toContain('1,203');
  expect(screen.getByText(/máximo.*650.*empresas por análisis/i)).toBeTruthy();
  await userEvent.click(
    screen.getByRole('button', { name: 'Analizar selección' }),
  );
  expect(api.created).toHaveLength(0);
  expect(
    screen.getByRole('status', { name: 'Empresas seleccionadas' }).textContent,
  ).toContain('1,203');
  await userEvent.click(
    screen.getByRole('button', { name: 'Limpiar selección' }),
  );
  expect(master().checked).toBe(false);
  expect(
    screen.getByRole('status', { name: 'Empresas seleccionadas' }).textContent,
  ).toContain('0');
});

it('recarga una selección sin crear trabajo y respeta el vacío intencional', async () => {
  const { api, mount } = setup(80);
  const first = mount();
  await screen.findByRole('checkbox', { name: /C0000/ });
  await userEvent.click(box('C0000'));
  await userEvent.type(search(), 'Álamo');
  await userEvent.click(next());
  first.unmount();
  const second = mount();
  await waitFor(() =>
    expect((search() as HTMLInputElement).value).toBe('Álamo'),
  );
  expect(box('C0025')).toBeTruthy();
  await userEvent.click(
    within(picker()).getByRole('button', { name: 'Primera página' }),
  );
  expect(box('C0000').checked).toBe(true);
  await userEvent.click(
    screen.getByRole('button', { name: 'Limpiar selección' }),
  );
  second.unmount();
  mount();
  await waitFor(() => expect(box('C0000').checked).toBe(false));
  expect(api.created).toHaveLength(0);
});

it('envía todas las coincidencias elegidas, incluidas las páginas que no están montadas', async () => {
  const { api, mount } = setup(604);
  mount();
  await screen.findByRole('checkbox', { name: /C0000/ });
  await userEvent.click(master());
  await userEvent.click(
    screen.getByRole('button', { name: 'Seleccionar 604 empresas' }),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Analizar selección' }),
  );
  await waitFor(() => expect(api.created).toHaveLength(1));
  const sent = JSON.parse(api.created[0]!);
  expect(sent.tickers).toHaveLength(604);
  expect(sent.tickers).toContain('C0603');
  await userEvent.click(
    screen.getByRole('button', { name: 'Editar selección' }),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Limpiar selección' }),
  );
  fireEvent(
    window,
    new HashChangeEvent('hashchange', { newURL: '/#resultados' }),
  );
  history.replaceState({}, '', '/#resultados');
  fireEvent(window, new HashChangeEvent('hashchange'));
  expect(screen.getByRole('button', { name: 'Excel' })).toBeTruthy();
});

it('al retirar la única fila de la última página ajusta el rango y conserva el foco en una empresa disponible', async () => {
  const { mount } = setup(80);
  mount();
  await screen.findByRole('checkbox', { name: /C0000/ });
  await userEvent.click(master());
  await userEvent.click(next());
  await userEvent.click(box('C0025'));
  await userEvent.click(screen.getByRole('button', { name: 'Seleccionadas' }));
  await userEvent.click(next());
  await userEvent.click(box('C0025'));
  expect(document.activeElement).toBe(box('C0024'));
  expect(
    screen.queryByRole('navigation', { name: 'Páginas de empresas' }),
  ).toBeNull();
  expect(within(picker()).getAllByRole('checkbox')).toHaveLength(26);
  await userEvent.click(master());
  expect(
    screen
      .getByRole('button', { name: 'Catálogo' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  expect(document.activeElement).toBe(search());
});
