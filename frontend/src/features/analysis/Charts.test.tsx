import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import Charts from './Charts';
import { company, financials, prices } from './test-fixtures';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('comparación conserva los valores y ausencias con una alternativa tabular accesible', async () => {
  const row = company();
  row.proxies[0]!.value_per_share = null;
  render(<Charts kind="comparison" company={row} />);
  await userEvent.click(screen.getByText('Ver datos de la gráfica'));
  const table = within(
    screen.getByRole('table', { name: 'Datos de comparación por acción' }),
  );
  expect(table.getByText('116.19 USD')).toBeTruthy();
  expect(table.getByText('—')).toBeTruthy();
  expect(table.getByRole('rowheader', { name: 'Proxy NOPAT' })).toBeTruthy();
});

it('precio histórico conserva fechas y huecos; financieros permanecen en millones y márgenes en ratios', async () => {
  const row = company();
  const view = render(<Charts kind="prices" company={row} prices={prices()} />);
  await userEvent.click(screen.getByText('Ver datos de la gráfica'));
  const table = within(
    screen.getByRole('table', { name: 'Datos del precio histórico' }),
  );
  expect(table.getByText('2025-01-02')).toBeTruthy();
  expect(table.getByText('—')).toBeTruthy();
  view.rerender(
    <Charts kind="financials" company={row} financials={financials()} />,
  );
  expect(
    within(
      screen.getByRole('table', { name: 'Datos financieros · millones' }),
    ).getByText('0.001000'),
  ).toBeTruthy();
  expect(screen.getByText('Millones de USD')).toBeTruthy();
  view.rerender(
    <Charts kind="margins" company={row} financials={financials()} />,
  );
  expect(
    within(
      screen.getByRole('table', { name: 'Datos de márgenes · porcentajes' }),
    ).getByText('+13%'),
  ).toBeTruthy();
  expect(
    within(
      screen.getByRole('table', { name: 'Datos de márgenes · porcentajes' }),
    ).getByRole('columnheader', { name: 'Margen NOPAT' }),
  ).toBeTruthy();
});
