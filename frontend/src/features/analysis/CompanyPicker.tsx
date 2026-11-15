import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisState } from './AnalysisForm';
import type { Market } from './types';
import {
  catalogPageSize,
  foldSearch,
  selectionKey,
  readCatalogViews,
  saveCatalogViews,
} from './catalog-model';
import '../../styles/selection.css';

type View = 'catalog' | 'selected';
type Context = { search: string; market: Market; page: number };
const initial = (): Context => ({ search: '', market: 'all', page: 0 });
const numeric = (value: number) => value.toLocaleString('es-MX');

export default function CompanyPicker({
  analysis,
}: {
  analysis: AnalysisState;
}) {
  const { catalog, catalogIndex } = analysis;
  const draft = analysis.draft!;
  const meta = analysis.meta!;
  const [view, setView] = useState<View>('catalog');
  const [contexts, setContexts] = useState<Record<View, Context>>({
    catalog: initial(),
    selected: initial(),
  });
  const context = contexts[view];
  const search = useRef<HTMLInputElement>(null);
  const master = useRef<HTMLInputElement>(null);
  const error = useRef<HTMLParagraphElement>(null);
  const rows = useRef(new Map<string, HTMLInputElement>());
  const focusNext = useRef<string | null>(null);
  const selected = useMemo(() => new Set(draft.selected), [draft.selected]);
  const ready = catalog?.source === draft.source && analysis.selectionReady;
  const viewKey = ready
    ? `${selectionKey(analysis.api.baseUrl, draft.source, catalog.dataset_version)}:views`
    : null;
  const [restoredViewKey, setRestoredViewKey] = useState<string | null>(null);
  useEffect(() => {
    if (!viewKey) return;
    const saved = readCatalogViews(viewKey);
    if (saved) {
      setContexts(saved.contexts);
      setView(saved.view);
    }
    setRestoredViewKey(viewKey);
  }, [viewKey]);
  useEffect(() => {
    if (viewKey && restoredViewKey === viewKey)
      saveCatalogViews(viewKey, { view, contexts });
  }, [viewKey, restoredViewKey, view, contexts]);
  const matches = useMemo(() => {
    const query = foldSearch(context.search);
    return ready
      ? catalogIndex.items.filter(
          (c) =>
            (view === 'catalog' || selected.has(c.ticker)) &&
            (context.market === 'all' || c.market === context.market) &&
            catalogIndex.search.get(c.ticker)!.includes(query),
        )
      : [];
  }, [ready, catalogIndex, context.search, context.market, selected, view]);
  const lastPage = Math.max(0, Math.ceil(matches.length / catalogPageSize) - 1);
  const page = Math.min(context.page, lastPage);
  const shown = matches.slice(
    page * catalogPageSize,
    (page + 1) * catalogPageSize,
  );
  const selectedOnPage = shown.filter((c) => selected.has(c.ticker)).length;
  const allOnPage = shown.length > 0 && selectedOnPage === shown.length;
  const globalAction =
    view === 'catalog' &&
    allOnPage &&
    matches.length > shown.length &&
    matches.some((c) => !selected.has(c.ticker));
  const update = (patch: Partial<Context>) =>
    setContexts((old) => ({ ...old, [view]: { ...old[view], ...patch } }));
  useEffect(() => {
    if (master.current)
      master.current.indeterminate = selectedOnPage > 0 && !allOnPage;
  }, [selectedOnPage, allOnPage]);
  useEffect(() => {
    if (page !== context.page)
      setContexts((old) => ({ ...old, [view]: { ...old[view], page } }));
  }, [page, context.page, view]);
  useEffect(() => {
    if (analysis.formError) error.current?.focus();
  }, [analysis.formError]);
  useLayoutEffect(() => {
    if (!focusNext.current) return;
    const target = rows.current.get(focusNext.current) ?? search.current;
    focusNext.current = null;
    target?.focus();
  });
  function changeView(next: View) {
    setView(next);
    analysis.changeMarket(contexts[next].market);
  }
  function clearSelection() {
    if (view === 'selected') changeView('catalog');
    focusNext.current = 'search';
    analysis.selectNone();
  }
  function toggle(ticker: string, checked: boolean, index: number) {
    if (view === 'selected' && !checked) {
      if (selected.size === 1) {
        changeView('catalog');
        focusNext.current = 'search';
      } else {
        const position = page * catalogPageSize + index;
        focusNext.current =
          matches[position + 1]?.ticker ??
          matches[position - 1]?.ticker ??
          'search';
      }
    }
    analysis.selectTickers([ticker], checked);
  }
  const marketEnabled = meta.sources.some(
    (s) => s.id === draft.source && s.enabled,
  );
  const count = new Set([
    ...draft.selected,
    ...draft.extras
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map((t) => t.trim().toUpperCase()),
  ]).size;
  const warning =
    analysis.formError ||
    (count > meta.limits.max_tickers
      ? `El máximo de este servicio es ${meta.limits.max_tickers} empresas por análisis.`
      : null);
  return (
    <section
      className="company-workspace"
      aria-label="Empresas que quieres analizar"
    >
      <search
        className="selection-search"
        aria-label="Buscar y filtrar empresas"
      >
        <div className="selection-search-field">
          <label htmlFor="company-search">Buscar empresas</label>
          <input
            ref={search}
            id="company-search"
            name="company_search"
            type="search"
            placeholder="Buscar empresa o símbolo"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            value={context.search}
            onChange={(e) => update({ search: e.target.value, page: 0 })}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
              e.preventDefault();
              if (matches.length === 1)
                analysis.selectTickers([matches[0]!.ticker], true);
            }}
          />
        </div>
        <div className="selection-market-field">
          <label htmlFor="selection-market">Mercado</label>
          <select
            id="selection-market"
            name="selection_market"
            aria-label="Mercado de las empresas"
            value={context.market}
            onChange={(e) => {
              const market = e.target.value as Market;
              update({ market, page: 0 });
              analysis.changeMarket(market);
            }}
          >
            <option value="all">Todos los mercados</option>
            <option value="USA">USA</option>
            <option value="MX">México</option>
          </select>
        </div>
        <div
          className="selection-views"
          role="group"
          aria-label="Vista de empresas"
        >
          <button
            type="button"
            aria-pressed={view === 'catalog'}
            onClick={() => changeView('catalog')}
          >
            Catálogo
          </button>
          <button
            type="button"
            aria-pressed={view === 'selected'}
            disabled={selected.size === 0}
            onClick={() => changeView('selected')}
          >
            Seleccionadas
          </button>
        </div>
      </search>
      <div className="batch-summary">
        <div className="batch-selection">
          <label className="page-selector">
            <input
              ref={master}
              name="select_page"
              type="checkbox"
              checked={allOnPage}
              disabled={!shown.length}
              onChange={(e) => {
                if (view === 'selected' && !e.target.checked) {
                  if (selected.size === shown.length) changeView('catalog');
                  focusNext.current = 'search';
                }
                analysis.selectTickers(
                  shown.map((c) => c.ticker),
                  e.target.checked,
                );
              }}
            />
            Seleccionar página
          </label>
          <span
            className="selection-count"
            role="status"
            aria-label="Empresas seleccionadas"
          >
            <strong>{numeric(count)}</strong>{' '}
            {count === 1 ? 'seleccionada' : 'seleccionadas'}
          </span>
          {globalAction && (
            <button
              className="text-button"
              type="button"
              onClick={() =>
                analysis.selectTickers(
                  matches.map((c) => c.ticker),
                  true,
                )
              }
            >
              Seleccionar {numeric(matches.length)} empresas
            </button>
          )}
        </div>
        <div className="selection-actions">
          <button
            type="button"
            className="text-button"
            aria-label="Limpiar selección"
            disabled={!count}
            onClick={clearSelection}
          >
            Limpiar
          </button>
          <button
            type="submit"
            className="analyze-button"
            aria-label="Analizar selección"
            disabled={analysis.submitting || !ready || !marketEnabled}
          >
            {analysis.submitting
              ? 'Enviando…'
              : analysis.snapshot && analysis.dirty
                ? 'Analizar de nuevo'
                : 'Analizar'}
          </button>
        </div>
      </div>
      {warning && (
        <p
          ref={error}
          className="selection-error"
          id="selection-error"
          role={analysis.formError ? 'alert' : undefined}
          tabIndex={-1}
        >
          {warning}
        </p>
      )}
      {!ready && !analysis.catalogQuery.error && (
        <p className="selection-empty" role="status">
          Cargando catálogo…
        </p>
      )}
      {analysis.catalogQuery.error && (
        <div className="selection-empty inline-warning">
          <p>{analysis.catalogQuery.error.message}</p>
          <button
            type="button"
            onClick={() => void analysis.catalogQuery.refetch()}
          >
            Reintentar catálogo
          </button>
        </div>
      )}
      <div className="company-list">
        {shown.map((c, i) => (
          <label key={c.ticker} className="company-option">
            <input
              name="tickers"
              type="checkbox"
              value={c.ticker}
              checked={selected.has(c.ticker)}
              ref={(el) => {
                if (el) rows.current.set(c.ticker, el);
                else rows.current.delete(c.ticker);
              }}
              onChange={(e) => toggle(c.ticker, e.target.checked, i)}
            />
            <span className="company-identity">
              <strong>{c.name?.trim() || c.ticker}</strong>{' '}
              <small>
                {c.name
                  ? `${c.ticker}${c.currency ? ` · ${c.currency}` : ''}`
                  : c.currency || (c.market === 'USA' ? 'USA' : 'México')}
              </small>
            </span>
          </label>
        ))}
        {ready && !shown.length && (
          <p className="selection-empty">
            No hay coincidencias. Prueba otro nombre o símbolo.
          </p>
        )}
      </div>
      {matches.length > catalogPageSize && (
        <nav className="selection-pagination" aria-label="Páginas de empresas">
          <span>
            {numeric(page * catalogPageSize + 1)}–
            {numeric(Math.min((page + 1) * catalogPageSize, matches.length))} de{' '}
            {numeric(matches.length)}
          </span>
          <div>
            <button
              type="button"
              aria-label="Primera página"
              disabled={page === 0}
              onClick={() => update({ page: 0 })}
            >
              «
            </button>
            <button
              type="button"
              aria-label="Página anterior"
              disabled={page === 0}
              onClick={() => update({ page: page - 1 })}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Siguiente página"
              disabled={page === lastPage}
              onClick={() => update({ page: page + 1 })}
            >
              ›
            </button>
            <button
              type="button"
              aria-label="Última página"
              disabled={page === lastPage}
              onClick={() => update({ page: lastPage })}
            >
              »
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
