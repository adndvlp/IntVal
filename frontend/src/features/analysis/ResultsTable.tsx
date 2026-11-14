import { scrollRegionOnArrow } from '../../lib/scroll-region';
import { useMemo } from 'react';
import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { formatMoney, formatPercent } from './model';
import type { Company } from './types';

const features = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});
const helper = createColumnHelper<typeof features, Company>();

export default function ResultsTable({
  rows,
  selected,
  onSelect,
}: {
  rows: Company[];
  selected: string | null;
  onSelect: (ticker: string) => void;
}) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('ticker', {
          header: 'Empresa',
          enableHiding: false,
          cell: ({ row }) => (
            <div className="company-label">
              <button
                type="button"
                className="company-link"
                aria-label={`Ver detalle de ${row.original.ticker}`}
                aria-pressed={row.original.ticker === selected}
                onClick={() => onSelect(row.original.ticker)}
              >
                <strong>{row.original.ticker}</strong>
              </button>
              <span className="company-name">{row.original.company_name}</span>
            </div>
          ),
        }),
        helper.accessor('market', { header: 'Mercado' }),
        helper.accessor('currency', {
          header: 'Moneda',
          cell: ({ getValue }) => getValue() ?? '—',
        }),
        helper.accessor('market_price', {
          header: 'Precio',
          cell: ({ row }) =>
            formatMoney(row.original.market_price, row.original.currency),
        }),
        helper.accessor((r) => r.median.value_per_share, {
          id: 'median',
          header: 'Mediana de proxies',
          cell: ({ row, getValue }) =>
            formatMoney(getValue(), row.original.currency),
        }),
        helper.accessor((r) => r.median.upside, {
          id: 'upside',
          header: 'Upside mediana',
          cell: ({ getValue }) => (
            <span
              className={
                getValue() !== null && getValue()! < 0 ? 'negative' : 'positive'
              }
            >
              {formatPercent(getValue())}
            </span>
          ),
        }),
        helper.accessor((r) => r.median.count, {
          id: 'models',
          header: 'Proxies incluidos',
        }),
        helper.accessor('status', {
          header: 'Estado',
          cell: ({ getValue }) => (
            <span
              className={`status-badge status-${getValue() === 'OK' ? 'ok' : getValue() === 'ERROR' ? 'error' : 'review'}`}
            >
              {getValue()}
            </span>
          ),
        }),
        ...(['fcl', 'nopat', 'ebitda_adjusted', 'net_income'] as const).flatMap(
          (id) => {
            const names = {
              fcl: 'FCL',
              nopat: 'NOPAT',
              ebitda_adjusted: 'EBITDA ajustado',
              net_income: 'Utilidad neta',
            };
            return [
              helper.accessor(
                (r) =>
                  r.proxies.find((p) => p.id === id)?.value_per_share ?? null,
                {
                  id,
                  header: `Proxy ${names[id]}`,
                  cell: ({ row, getValue }) =>
                    formatMoney(getValue(), row.original.currency),
                },
              ),
              helper.accessor(
                (r) => r.proxies.find((p) => p.id === id)?.upside ?? null,
                {
                  id: `${id}_upside`,
                  header: `Upside ${names[id]}`,
                  cell: ({ getValue }) => formatPercent(getValue()),
                },
              ),
            ];
          },
        ),
        helper.accessor((r) => r.analyst_target.value, {
          id: 'analyst',
          header: 'Objetivo de analistas',
          cell: ({ row, getValue }) =>
            formatMoney(getValue(), row.original.currency),
        }),
        helper.accessor((r) => r.analyst_target.upside, {
          id: 'analyst_upside',
          header: 'Upside analistas',
          cell: ({ getValue }) => formatPercent(getValue()),
        }),
        helper.accessor('notes', {
          header: 'Diagnóstico',
          cell: ({ getValue }) => (
            <span className="table-note">{getValue() ?? '—'}</span>
          ),
        }),
      ]),
    [onSelect, selected],
  );
  const table = useTable({
    features,
    data: rows,
    columns,
    getRowId: (r) => r.ticker,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 20 },
      columnVisibility: {
        fcl: false,
        nopat: false,
        ebitda_adjusted: false,
        net_income: false,
        fcl_upside: false,
        nopat_upside: false,
        ebitda_adjusted_upside: false,
        net_income_upside: false,
        analyst: false,
        analyst_upside: false,
        notes: false,
      },
    },
  });
  return (
    <>
      <details className="column-options">
        <summary>Columnas de la comparación</summary>
        <fieldset>
          <legend>Mostrar columnas</legend>
          {table
            .getAllLeafColumns()
            .filter((c) => c.getCanHide())
            .map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={c.getIsVisible()}
                  onChange={c.getToggleVisibilityHandler()}
                />
                {String(c.columnDef.header)}
              </label>
            ))}
        </fieldset>
      </details>
      <div
        className="result-scroll"
        role="region"
        aria-label="Comparación de empresas, desplazable horizontalmente"
        tabIndex={0}
        onKeyDown={scrollRegionOnArrow}
      >
        <table className="results-table">
          <caption>
            Resultados del análisis · ordenados por upside descendente; valores
            ausentes al final.
          </caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} scope="col">
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} data-selected={row.original.ticker === selected}>
                {row.getVisibleCells().map((cell, index) =>
                  index === 0 ? (
                    <th key={cell.id} scope="row">
                      <table.FlexRender cell={cell} />
                    </th>
                  ) : (
                    <td key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="filter-empty">
          No hay empresas que coincidan con estos filtros.
        </p>
      )}
      <div className="table-pages">
        <span>
          {rows.length
            ? `Página ${table.state.pagination.pageIndex + 1} de ${Math.max(1, table.getPageCount())}`
            : '0 empresas mostradas'}
        </span>
        <div>
          <button
            type="button"
            className="secondary-button"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Página anterior
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Página siguiente
          </button>
        </div>
      </div>
    </>
  );
}
