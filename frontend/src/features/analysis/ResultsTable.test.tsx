import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import ResultsTable from './ResultsTable';
import { company } from './test-fixtures';

afterEach(cleanup);

it('pagina el conjunto completo y conserva la página al seleccionar una empresa', async () => {
  const rows = Array.from({ length: 45 }, (_, i) =>
    company(`EMP${i}`, i / 100),
  );
  const select = vi.fn();
  const view = render(
    <ResultsTable rows={rows} selected={null} onSelect={select} />,
  );
  expect(
    screen.getByRole('button', { name: 'Ver detalle de EMP0' }),
  ).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Ver detalle de EMP20' }),
  ).toBeNull();
  await userEvent.click(
    screen.getByRole('button', { name: 'Página siguiente' }),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Ver detalle de EMP20' }),
  );
  expect(select).toHaveBeenCalledWith('EMP20');
  view.rerender(
    <ResultsTable rows={rows} selected="EMP20" onSelect={select} />,
  );
  expect(
    screen
      .getByRole('button', { name: 'Ver detalle de EMP20' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  await userEvent.click(
    screen.getByRole('button', { name: 'Página anterior' }),
  );
  expect(
    screen.getByRole('button', { name: 'Ver detalle de EMP0' }),
  ).toBeTruthy();
});

it('muestra todas las columnas financieras y sus ausencias sin perder encabezados semánticos', async () => {
  const row = company('SIN-DATOS', null);
  row.market_price = null;
  row.currency = null;
  row.notes = null;
  row.proxies.forEach((p) => {
    p.value_per_share = null;
    p.upside = null;
  });
  row.analyst_target.value = null;
  row.analyst_target.upside = null;
  row.status = 'DATOS INCOMPLETOS';
  const negative = company('CAIDA', -0.25);
  negative.status = 'REVISAR';
  const failed = company('FALLO');
  failed.status = 'ERROR';
  render(
    <ResultsTable
      rows={[row, negative, failed]}
      selected={null}
      onSelect={vi.fn()}
    />,
  );
  await userEvent.click(screen.getByText('Columnas de la comparación'));
  const options = screen.getByRole('group', { name: 'Mostrar columnas' });
  for (const input of within(options).getAllByRole('checkbox'))
    if (!(input as HTMLInputElement).checked) await userEvent.click(input);
  const table = screen.getByRole('table');
  expect(
    within(table).getByRole('columnheader', { name: 'Proxy EBITDA ajustado' }),
  ).toBeTruthy();
  expect(
    within(table).getByRole('columnheader', { name: 'Objetivo de analistas' }),
  ).toBeTruthy();
  expect(within(table).getAllByText('—').length).toBeGreaterThan(8);
  expect(
    within(table).getByRole('rowheader', { name: /SIN-DATOS/ }),
  ).toBeTruthy();
  const populated = within(table).getByRole('row', { name: /CAIDA/ });
  expect(within(populated).getByText('112.02 USD')).toBeTruthy();
  expect(within(populated).getAllByText('+12%')).toHaveLength(4);
  expect(within(populated).getByText('-25%')).toBeTruthy();
  expect(within(populated).getByText('120.00 USD')).toBeTruthy();
});
