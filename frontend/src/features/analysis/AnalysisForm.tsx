import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { configurationFields } from './model';
import type { useAnalysis } from './use-analysis';

export type AnalysisState = ReturnType<typeof useAnalysis>;

export default function AnalysisForm({
  analysis,
  onSubmitted,
}: {
  analysis: AnalysisState;
  onSubmitted?: () => void;
}) {
  const { draft, meta, catalog } = analysis;
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [invalid, setInvalid] = useState<string[]>([]);
  const error = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (analysis.formError) error.current?.focus();
  }, [analysis.formError]);
  useEffect(() => {
    setOffset(0);
  }, [search, draft?.market, draft?.source]);
  if (!draft || !meta) return null;
  const ready = catalog?.source === draft.source;
  const items = (ready ? catalog.items : []).filter(
    (c) =>
      (draft.market === 'all' || c.market === draft.market) &&
      c.ticker.toLowerCase().includes(search.toLowerCase()),
  );
  const shown = items.slice(offset, offset + 30);
  const marketEnabled = meta.sources.some(
    (s) => s.id === 'market' && s.enabled,
  );
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await analysis.submit();
    if (ok) onSubmitted?.();
  }
  return (
    <form
      className="analysis-form"
      action={`${analysis.api.baseUrl}/api/v1/analyses`}
      method="post"
      aria-labelledby="form-heading"
      onSubmit={submit}
    >
      <header className="controls-heading">
        <span className="eyebrow">01 / Configuración</span>
        <h2 id="form-heading">Construye tu análisis.</h2>
        <p>Elige empresas y revisa los supuestos antes de comparar.</p>
      </header>
      <fieldset className="source-options">
        <legend>Fuente de datos</legend>
        {(['market', 'demo'] as const).map((s) => (
          <label
            key={s}
            className={draft.source === s ? 'choice active' : 'choice'}
          >
            <input
              type="radio"
              name="source"
              value={s}
              checked={draft.source === s}
              onChange={() => analysis.changeSource(s)}
            />
            <span>{s === 'market' ? 'Mercado' : 'Demostración'}</span>
          </label>
        ))}
      </fieldset>
      <p className="field-help">
        {draft.source === 'demo'
          ? `Datos sintéticos · referencia ${meta.demo.reference_date}. No son empresas reales.`
          : 'Yahoo Finance. La consulta empieza cuando solicitas un análisis.'}
      </p>
      {draft.source === 'market' && !marketEnabled && (
        <p className="inline-warning">
          Mercado está deshabilitado en este entorno. Puedes explorar la
          demostración.
        </p>
      )}
      <fieldset>
        <legend>Mercado</legend>
        <div className="market-options">
          {(['all', 'USA', 'MX'] as const).map((m) => (
            <label
              key={m}
              className={draft.market === m ? 'choice active' : 'choice'}
            >
              <input
                type="radio"
                name="market"
                value={m}
                checked={draft.market === m}
                onChange={() => analysis.changeMarket(m)}
              />
              <span>
                {m === 'all' ? 'Todos' : m === 'USA' ? 'USA' : 'México'}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Empresas</legend>
        <div className="catalog-search">
          <label htmlFor="catalog-search">Buscar símbolo en el catálogo</label>
          <input
            id="catalog-search"
            name="catalog_search"
            type="search"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="compact-actions">
          <button
            type="button"
            className="text-button"
            onClick={analysis.selectAll}
            disabled={!ready}
          >
            Seleccionar todo el mercado
          </button>
          <button
            type="button"
            className="text-button"
            onClick={analysis.selectNone}
          >
            Quitar selección
          </button>
        </div>
        <p className="selection-count">
          <strong>{draft.selected.length}</strong> seleccionadas · máximo{' '}
          {meta.limits.max_tickers}
        </p>
        {analysis.catalogQuery.isPending && <p>Cargando catálogo…</p>}
        {analysis.catalogQuery.error && (
          <div className="inline-warning">
            <p>{analysis.catalogQuery.error.message}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => void analysis.catalogQuery.refetch()}
            >
              Reintentar catálogo
            </button>
          </div>
        )}
        {ready && (
          <div className="catalog-options">
            {shown.map((c) => (
              <label key={c.ticker} className="ticker-option">
                <input
                  name="tickers"
                  type="checkbox"
                  value={c.ticker}
                  checked={draft.selected.includes(c.ticker)}
                  onChange={() => analysis.toggleTicker(c.ticker)}
                />
                <span>{c.ticker}</span>
                <small>{c.market}</small>
              </label>
            ))}
            {!shown.length && (
              <p>No hay símbolos que coincidan con la búsqueda.</p>
            )}
          </div>
        )}
        {items.length > 30 && (
          <div className="catalog-pages">
            <button
              type="button"
              className="text-button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 30))}
            >
              Empresas anteriores
            </button>
            <span>
              {offset + 1}–{Math.min(offset + 30, items.length)} de{' '}
              {items.length}
            </span>
            <button
              type="button"
              className="text-button"
              disabled={offset + 30 >= items.length}
              onClick={() => setOffset(offset + 30)}
            >
              Más empresas del catálogo
            </button>
          </div>
        )}
        {draft.source === 'market' && (
          <div className="field">
            <label htmlFor="extra-tickers">Símbolos adicionales</label>
            <textarea
              id="extra-tickers"
              name="extra_tickers"
              rows={2}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={draft.extras}
              onChange={(e) => analysis.changeExtras(e.target.value)}
              aria-describedby="extras-help"
            />
            <p id="extras-help" className="field-help">
              Separados por espacios o comas. Ejemplo: AAPL, PE&amp;OLES.MX. Se
              normalizan y se eliminan duplicados.
            </p>
          </div>
        )}
      </fieldset>
      <fieldset>
        <legend>Supuestos principales</legend>
        <p className="field-help" id="discount-help">
          Tasas manuales para diez años. La tasa de empresa no es un WACC
          estimado automáticamente.
        </p>
        {configurationFields.slice(0, 2).map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={f.key}>{f.label}</label>
            <input
              id={f.key}
              name={f.key}
              type="number"
              inputMode="decimal"
              required
              min={f.min}
              max={f.max}
              step={f.step}
              value={
                Number.isFinite(draft.configuration[f.key])
                  ? Number(
                      (draft.configuration[f.key] * f.scale).toPrecision(12),
                    )
                  : ''
              }
              aria-invalid={invalid.includes(f.key)}
              aria-describedby="discount-help"
              onInvalid={() => setInvalid((v) => [...new Set([...v, f.key])])}
              onBlur={(e) => {
                const valid = e.currentTarget.validity.valid;
                setInvalid((v) =>
                  valid
                    ? v.filter((k) => k !== f.key)
                    : [...new Set([...v, f.key])],
                );
              }}
              onChange={(e) => {
                setInvalid((v) => v.filter((k) => k !== f.key));
                analysis.changeConfiguration(
                  f.key,
                  e.target.value === ''
                    ? NaN
                    : Number(e.target.value) / f.scale,
                );
              }}
            />
          </div>
        ))}
        <details className="assumptions">
          <summary>Más supuestos de valoración</summary>
          <p className="field-help">
            Factores de crecimiento y margen, y múltiplos terminales manuales.
          </p>
          {configurationFields.slice(2).map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              <input
                id={f.key}
                name={f.key}
                type="number"
                inputMode="decimal"
                required
                min={f.min}
                max={f.max}
                step={f.step}
                value={
                  Number.isFinite(draft.configuration[f.key])
                    ? Number(
                        (draft.configuration[f.key] * f.scale).toPrecision(12),
                      )
                    : ''
                }
                aria-invalid={invalid.includes(f.key)}
                onInvalid={() => setInvalid((v) => [...new Set([...v, f.key])])}
                onBlur={(e) => {
                  const valid = e.currentTarget.validity.valid;
                  setInvalid((v) =>
                    valid
                      ? v.filter((k) => k !== f.key)
                      : [...new Set([...v, f.key])],
                  );
                }}
                onChange={(e) => {
                  setInvalid((v) => v.filter((k) => k !== f.key));
                  analysis.changeConfiguration(
                    f.key,
                    e.target.value === ''
                      ? NaN
                      : Number(e.target.value) / f.scale,
                  );
                }}
              />
            </div>
          ))}
        </details>
      </fieldset>
      {analysis.formError && (
        <div
          ref={error}
          id="form-error"
          className="inline-warning"
          role="alert"
          tabIndex={-1}
        >
          {analysis.formError}
        </div>
      )}
      <button
        type="submit"
        className="analyze-button"
        disabled={
          analysis.submitting ||
          !ready ||
          (draft.source === 'market' && !marketEnabled)
        }
      >
        {analysis.submitting ? 'Enviando análisis…' : 'Analizar empresas'}
        <span aria-hidden="true">↗</span>
      </button>
      <p className="field-help">
        Analizar genera un resultado con estos supuestos. Los cambios
        posteriores se aplican al volver a analizar.
      </p>
    </form>
  );
}
