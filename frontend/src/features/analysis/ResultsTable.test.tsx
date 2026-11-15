import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import ResultsTable from './ResultsTable';
import { company } from './test-fixtures';

afterEach(cleanup);
const table = () => screen.getByRole('table');
const tickers = () =>
  within(table())
    .getAllByRole('rowheader')
    .map((e) => e.textContent);
const search = () =>
  screen.getByRole('searchbox', { name: 'Buscar en resultados' });
const click = (name: string) =>
  userEvent.click(within(table()).getByRole('button', { name }));

it('cuatro columnas, diferencia descendente inicial, ausencias al final y cifras sin duplicados', () => {
  render(
    <ResultsTable
      rows={[
        company('BAJA', -0.1),
        company('AUSENTE', null),
        company('ALTA', 0.3),
      ]}
      selected={null}
      onSelect={vi.fn()}
    />,
  );
  expect(
    within(table())
      .getAllByRole('columnheader')
      .map((h) => h.textContent?.replace(/[↑↓↕]/g, '').trim()),
  ).toEqual(['Empresa', 'Precio', 'Valor estimado', 'Diferencia']);
  expect(tickers()).toEqual([
    expect.stringContaining('ALTA'),
    expect.stringContaining('BAJA'),
    expect.stringContaining('AUSENTE'),
  ]);
  expect(screen.getByText('Sin estimación')).toBeTruthy();
  expect(screen.queryByText('Columnas de la comparación')).toBeNull();
  expect(within(table()).getAllByRole('cell')[2]!.textContent).toBe('+30.00 %');
});

it('ordena números originales globalmente, conserva los nodos y foco; sólo un encabezado lleva aria-sort', async () => {
  const rows = [
    company('A', 0.3),
    { ...company('B', 0.1), market_price: 20 },
    { ...company('C', null), market_price: null },
  ];
  render(<ResultsTable rows={rows} selected={null} onSelect={vi.fn()} />);
  const button = within(table()).getByRole('button', { name: 'Precio' });
  const row = screen.getByRole('rowheader', { name: /Empresa A/ });
  await userEvent.click(button);
  expect(document.activeElement).toBe(button);
  expect(tickers()[0]).toContain('B');
  expect(table().querySelectorAll('[aria-sort]')).toHaveLength(1);
  expect(button.parentElement?.getAttribute('aria-sort')).toBe('ascending');
  expect(screen.getByRole('rowheader', { name: /Empresa A/ })).toBe(row);
  await userEvent.click(button);
  expect(tickers()[0]).toContain('A');
  expect(tickers().at(-1)).toContain('C');
  await click('Empresa');
  expect(tickers()[0]).toContain('A');
  await click('Valor estimado');
  expect(table().querySelectorAll('[aria-sort]')).toHaveLength(1);
});

it('1203 resultados: 25 filas, búsqueda normalizada global y última página parcial', async () => {
  const rows = Array.from({ length: 1203 }, (_, i) => ({
    ...company(`E${i}`, i / 1000),
    company_name: i === 1 ? 'Álamo único' : `Empresa ${i}`,
  }));
  render(<ResultsTable rows={rows} selected={null} onSelect={vi.fn()} />);
  expect(tickers()).toHaveLength(25);
  expect(tickers()[0]).toContain('E1202');
  await userEvent.click(screen.getByRole('button', { name: 'Última página' }));
  expect(tickers()).toHaveLength(3);
  await userEvent.type(search(), 'ALAMO UNICO');
  expect(tickers()).toEqual([expect.stringContaining('E1')]);
  expect(
    screen.queryByRole('navigation', { name: 'Páginas de resultados' }),
  ).toBeNull();
  await userEvent.clear(search());
  expect(tickers()).toHaveLength(25);
});

it('abrir detalle conserva búsqueda, orden, página y contexto de la comparación', async () => {
  const select = vi.fn();
  const rows = Array.from({ length: 80 }, (_, i) => company(`E${i}`, i / 100));
  const view = render(
    <ResultsTable rows={rows} selected={null} onSelect={select} />,
  );
  await click('Empresa');
  await userEvent.click(
    screen.getByRole('button', { name: 'Siguiente página' }),
  );
  const link = screen.getByRole('link', { name: /Empresa E25/ });
  await userEvent.click(link);
  expect(select).toHaveBeenCalledWith('E25');
  view.rerender(<ResultsTable rows={rows} selected="E25" onSelect={select} />);
  expect(screen.getByRole('link', { name: /Empresa E25/ })).toBe(link);
  expect(tickers()).toHaveLength(25);
  await userEvent.type(search(), 'NO EXISTE');
  expect(screen.getByText('No hay coincidencias.')).toBeTruthy();
});

it('las flechas desplazan únicamente la región enfocada', async () => {
  render(
    <ResultsTable rows={[company()]} selected={null} onSelect={vi.fn()} />,
  );
  const region = screen.getByRole('region', {
    name: 'Comparación de empresas, desplazable horizontalmente',
  });
  Object.defineProperty(region, 'clientWidth', { value: 400 });
  Object.defineProperty(region, 'scrollBy', {
    value: ({ left }: { left: number }) => (region.scrollLeft += left),
  });
  region.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(region.scrollLeft).toBe(300);
  await click('Precio');
  await userEvent.keyboard('{ArrowRight}');
  expect(region.scrollLeft).toBe(300);
});
