import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { formatNumber } from './model';
import { foldSearch } from './catalog-model';
import { scrollRegionOnArrow } from '../../lib/scroll-region';
import type { Company } from './types';

const columns = [
  { id: 'company', label: 'Empresa' },
  { id: 'price', label: 'Precio' },
  { id: 'estimate', label: 'Valor estimado' },
  { id: 'difference', label: 'Diferencia' },
] as const;
type SortKey = (typeof columns)[number]['id'];
const collator = new Intl.Collator('es-MX', {
  numeric: true,
  sensitivity: 'base',
});
export const formatDifference = (value: number | null) =>
  value === null
    ? '—'
    : `${value > 0 ? '+' : ''}${formatNumber(value * 100)} %`;
export const companyName = (c: Company) =>
  c.company_name.replace(/\s+\(demo\)$/i, '');
export default function ResultsTable({
  rows,
  selected,
  onSelect,
  actions,
}: {
  rows: Company[];
  selected: string | null;
  onSelect: (ticker: string) => void;
  actions?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'difference',
    desc: true,
  });
  const [page, setPage] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const id = useId();
  const table = useRef<HTMLTableElement>(null);
  const indexed = useMemo(
    () =>
      rows.map((row) => ({
        row,
        search: foldSearch(`${row.company_name} ${row.ticker}`),
      })),
    [rows],
  );
  const filtered = useMemo(() => {
    const needle = foldSearch(query);
    const value = (c: Company) =>
      sort.key === 'price'
        ? c.market_price
        : sort.key === 'estimate'
          ? c.median.value_per_share
          : c.median.upside;
    return indexed
      .filter((c) => c.search.includes(needle))
      .map((c) => c.row)
      .sort((a, b) => {
        if (sort.key === 'company')
          return (
            (sort.desc ? -1 : 1) *
            collator.compare(companyName(a), companyName(b))
          );
        const x = value(a),
          y = value(b);
        if (x === null) return y === null ? 0 : 1;
        if (y === null) return -1;
        return (sort.desc ? -1 : 1) * (x - y);
      });
  }, [indexed, query, sort]);
  const last = Math.max(0, Math.ceil(filtered.length / 25) - 1);
  const current = Math.min(page, last);
  useEffect(() => {
    if (page !== current) setPage(current);
  }, [page, current]);
  function changeSort(key: SortKey) {
    const desc = key === sort.key ? !sort.desc : false;
    setSort({ key, desc });
    setPage(0);
    setAnnouncement(
      `Ordenado por ${columns.find((c) => c.id === key)!.label}, ${desc ? 'descendente' : 'ascendente'}.`,
    );
  }
  const sortAction = useRef(changeSort);
  sortAction.current = changeSort;
  useEffect(() => {
    const element = table.current;
    const command = (raw: Event) => {
      const e = raw as Event & { command?: string; source?: HTMLElement };
      const key = e.source?.dataset.column;
      if (e.command === '--sort' && columns.some((c) => c.id === key))
        sortAction.current(key as SortKey);
    };
    element?.addEventListener('command', command);
    return () => element?.removeEventListener('command', command);
  }, []);
  return (
    <>
      <div className="results-viewhead">
        <span role="status">
          {filtered.length.toLocaleString('es-MX')}{' '}
          {filtered.length === 1 ? 'empresa' : 'empresas'}
        </span>
        <div className="result-actions">{actions}</div>
      </div>
      <search className="result-search" aria-label="Buscar resultados">
        <label htmlFor={`${id}-search`}>Buscar en resultados</label>
        <input
          type="search"
          name="result_search"
          id={`${id}-search`}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
      </search>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <div
        className="result-scroll"
        role="region"
        aria-label="Comparación de empresas, desplazable horizontalmente"
        tabIndex={0}
        onKeyDown={scrollRegionOnArrow}
      >
        <table ref={table} id={id} className="comparison-table">
          <caption className="sr-only">Resultados por empresa</caption>
          <colgroup>
            <col className="company-column" />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  aria-sort={
                    sort.key === c.id
                      ? sort.desc
                        ? 'descending'
                        : 'ascending'
                      : undefined
                  }
                >
                  <button
                    type="button"
                    {...{ commandfor: id, command: '--sort' }}
                    data-column={c.id}
                    onClick={() => {
                      if (!('commandForElement' in HTMLButtonElement.prototype))
                        changeSort(c.id);
                    }}
                  >
                    <span>{c.label}</span>
                    {sort.key === c.id && (
                      <span className="sort-icon" aria-hidden="true">
                        {sort.desc ? '↓' : '↑'}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(current * 25, (current + 1) * 25).map((c) => (
              <tr key={c.ticker} data-selected={selected === c.ticker}>
                <th scope="row">
                  <a
                    href={`#empresa/${encodeURIComponent(c.ticker)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.currentTarget.focus({ preventScroll: true });
                      onSelect(c.ticker);
                    }}
                  >
                    {companyName(c)}
                  </a>
                  <small>
                    {c.ticker}
                    {c.currency ? ` · ${c.currency}` : ''}
                  </small>
                </th>
                <td>{formatNumber(c.market_price)}</td>
                <td>
                  {c.median.value_per_share === null ? (
                    <span className="muted">Sin estimación</span>
                  ) : (
                    formatNumber(c.median.value_per_share)
                  )}
                </td>
                <td
                  className={
                    c.median.upside === null
                      ? 'muted'
                      : c.median.upside < 0
                        ? 'negative'
                        : 'positive'
                  }
                >
                  {formatDifference(c.median.upside)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <p className="selection-empty">No hay coincidencias.</p>
      )}
      {filtered.length > 25 && (
        <nav
          className="selection-pagination"
          aria-label="Páginas de resultados"
        >
          <span>
            {current * 25 + 1}–{Math.min((current + 1) * 25, filtered.length)}{' '}
            de {filtered.length.toLocaleString('es-MX')}
          </span>
          <div>
            {[
              {
                name: 'Primera página',
                text: '«',
                to: 0,
                disabled: current === 0,
              },
              {
                name: 'Página anterior',
                text: '‹',
                to: current - 1,
                disabled: current === 0,
              },
              {
                name: 'Siguiente página',
                text: '›',
                to: current + 1,
                disabled: current === last,
              },
              {
                name: 'Última página',
                text: '»',
                to: last,
                disabled: current === last,
              },
            ].map((p) => (
              <button
                key={p.name}
                type="button"
                aria-label={p.name}
                disabled={p.disabled}
                onClick={() => setPage(p.to)}
              >
                {p.text}
              </button>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
