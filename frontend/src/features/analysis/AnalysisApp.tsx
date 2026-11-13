import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AnalysisForm from './AnalysisForm';
import type { AnalysisState } from './AnalysisForm';
import CompanyDetail from './CompanyDetail';
import ResultsTable from './ResultsTable';
import { filterRows, formatPercent, summary, terminal } from './model';
import { ApiFault, retryDelay, retryQuery } from './transport';
import type { Filters, Job, Snapshot } from './types';
import { useAnalysis } from './use-analysis';

const initialFilters: Filters = {
  market: 'all',
  status: 'all',
  minUpside: null,
};
const stateLabels: Record<Job['state'], string> = {
  queued: 'En cola',
  running: 'Analizando empresas',
  cancelling: 'Cancelando; terminando la consulta actual',
  completed: 'Análisis completado',
  cancelled: 'Análisis cancelado',
  failed: 'No se pudo completar el lote',
};

function Controls({ analysis }: { analysis: AnalysisState }) {
  const [compact, setCompact] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(width < 70rem)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return compact ? (
    <div className="mobile-controls">
      <button
        type="button"
        className="secondary-button"
        onClick={() => dialog.current?.showModal()}
      >
        Configurar análisis <span aria-hidden="true">＋</span>
      </button>
      <dialog
        ref={dialog}
        className="controls-dialog"
        aria-labelledby="mobile-controls-title"
      >
        <div className="dialog-heading">
          <h2 id="mobile-controls-title">Configurar análisis</h2>
          <button
            type="button"
            className="text-button"
            onClick={() => dialog.current?.close()}
            aria-label="Cerrar configuración"
          >
            Cerrar <span aria-hidden="true">×</span>
          </button>
        </div>
        <AnalysisForm
          analysis={analysis}
          onSubmitted={() => dialog.current?.close()}
        />
      </dialog>
    </div>
  ) : (
    <aside
      className="analysis-controls"
      aria-label="Configuración del análisis"
    >
      <AnalysisForm analysis={analysis} />
    </aside>
  );
}

function ExportButton({
  snapshot,
  api,
  disabled,
}: {
  snapshot: Snapshot;
  api: AnalysisState['api'];
  disabled: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), [snapshot.job.id]);
  async function download() {
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    try {
      const file = await api.download(
        snapshot.job.id,
        snapshot.job.source,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.name;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof ApiFault
            ? e.message
            : 'No se pudo descargar el Excel. Puedes reintentar.',
        );
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }
  return (
    <div className="export-control">
      <button
        type="button"
        className="secondary-button"
        disabled={pending || disabled || snapshot.job.state !== 'completed'}
        onClick={() => void download()}
      >
        {pending ? 'Preparando Excel…' : 'Descargar Excel completo'}
        <span aria-hidden="true">↓</span>
      </button>
      {snapshot.job.state !== 'completed' && (
        <p className="field-help">
          El Excel estará disponible al completar el lote.
        </p>
      )}
      {error && (
        <p role="status" className="inline-warning">
          {error}
        </p>
      )}
    </div>
  );
}

function Workspace({
  baseUrl,
  initialSource,
}: {
  baseUrl: string;
  initialSource?: string;
}) {
  const analysis = useAnalysis({ baseUrl, initialSource });
  const { draft, meta, snapshot, view } = analysis;
  const [filters, setFilters] = useState<Filters>(initialFilters);
  useEffect(() => {
    setFilters(initialFilters);
  }, [draft?.source]);
  const rows = useMemo(
    () => filterRows(snapshot?.rows ?? [], filters),
    [filters, snapshot?.rows],
  );
  const stats = useMemo(() => summary(rows), [rows]);
  const select = useCallback(
    (ticker: string) => analysis.selectCompany(ticker),
    [analysis.selectCompany],
  );
  if (!meta || !draft)
    return (
      <div className="workspace-loading">
        <span className="workspace-mark" aria-hidden="true">
          i.
        </span>
        {analysis.metadataQuery.error ? (
          <>
            <h2>Retomemos la conexión.</h2>
            <p role="status">{analysis.metadataQuery.error.message}</p>
            <button
              type="button"
              onClick={() => void analysis.metadataQuery.refetch()}
            >
              Reintentar conexión
            </button>
          </>
        ) : (
          <p role="status">Preparando tu espacio de análisis…</p>
        )}
      </div>
    );
  const active = view.current?.job;
  const previous = !!snapshot && snapshot !== view.current;
  const complete = active?.state === 'completed' && !analysis.loadingRows;
  const observations = active
    ? active.counts['DATOS INCOMPLETOS'] +
      active.counts.REVISAR +
      active.counts.ERROR
    : 0;
  return (
    <div className="workspace" data-dashboard>
      <div
        className={`workspace-topline ${draft.source === 'demo' ? 'is-demo' : ''}`}
      >
        <div>
          <span className="source-dot" aria-hidden="true" />
          <strong>
            {draft.source === 'demo' ? 'Demostración' : 'Mercado'}
          </strong>
          <span>
            {draft.source === 'demo'
              ? `Datos sintéticos · referencia ${meta.demo.reference_date}`
              : 'Yahoo Finance · consulta al analizar'}
          </span>
        </div>
        <span className="connection-state">Servicio conectado</span>
      </div>
      <div className="workspace-layout">
        <Controls analysis={analysis} />
        <div className="analysis-content">
          <section
            className="results-section"
            aria-labelledby="results-heading"
          >
            <header className="results-heading">
              <div>
                <p className="eyebrow">02 / Comparación</p>
                <h2 id="results-heading">Pon las cifras en perspectiva.</h2>
              </div>
              <button
                type="button"
                className="text-button clear-button"
                onClick={() => {
                  analysis.clear();
                  setFilters(initialFilters);
                }}
              >
                Limpiar resultados
              </button>
            </header>
            {((view.pending && !analysis.transportError) || active) && (
              <div className="analysis-progress" role="status">
                <div className="progress-heading">
                  <strong>
                    {view.pending
                      ? analysis.reference
                        ? 'Recuperando análisis…'
                        : 'Enviando análisis…'
                      : complete
                        ? `${stateLabels.completed}${observations ? ' con observaciones' : ''}`
                        : analysis.loadingRows &&
                            active &&
                            terminal(active.state)
                          ? 'Cargando los resultados completos…'
                          : stateLabels[active!.state]}
                  </strong>
                  {active && !terminal(active.state) && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={
                        analysis.cancelPending || active.state === 'cancelling'
                      }
                      onClick={() => void analysis.cancel()}
                    >
                      {analysis.cancelPending
                        ? 'Solicitando cancelación…'
                        : 'Cancelar análisis'}
                    </button>
                  )}
                </div>
                {active && (
                  <>
                    <progress
                      value={active.processed}
                      max={active.total}
                      aria-label="Empresas procesadas"
                    />
                    <p>
                      {active.processed} de {active.total} empresas procesadas
                      {active.current_ticker
                        ? ` · ${active.current_ticker}`
                        : ''}
                    </p>
                    <div
                      className="progress-counts"
                      role="group"
                      aria-label="Resultados por estado"
                    >
                      <span>OK: {active.counts.OK}</span>
                      <span>
                        Datos incompletos: {active.counts['DATOS INCOMPLETOS']}
                      </span>
                      <span>Revisar: {active.counts.REVISAR}</span>
                      <span>Error: {active.counts.ERROR}</span>
                    </div>
                  </>
                )}
              </div>
            )}
            {view.message && (
              <div className="inline-warning" role="status">
                <p>{view.message}</p>
                {analysis.canRetryCreate && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void analysis.retryCreate()}
                  >
                    Reintentar envío
                  </button>
                )}
              </div>
            )}
            {analysis.transportError && (
              <div className="inline-warning" role="status">
                <p>{analysis.transportError.message}</p>
                {!analysis.unavailable && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void analysis.reconnect()}
                  >
                    Reconectar al análisis
                  </button>
                )}
              </div>
            )}
            {analysis.cancelError && (
              <p className="inline-warning" role="status">
                {analysis.cancelError}
              </p>
            )}
            {active?.state === 'failed' && (
              <p className="inline-warning">
                {active.error?.code === 'JOB_DEADLINE_EXCEEDED'
                  ? 'El lote superó su plazo de ejecución. Puedes analizar un lote menor.'
                  : 'El servicio no pudo terminar el lote. Los resultados parciales se conservan.'}
              </p>
            )}
            {previous && (
              <p className="inline-note">
                Resultado anterior. El nuevo análisis se mostrará al recibir sus
                primeras filas.
              </p>
            )}
            {analysis.dirty && (
              <p className="pending-changes">
                Hay cambios sin aplicar. Los resultados y el Excel conservan los
                supuestos del análisis aceptado.
              </p>
            )}
            {snapshot?.rows.length ? (
              <>
                <div className="results-context">
                  <span>
                    {snapshot.job.source === 'demo'
                      ? `Datos sintéticos · ${meta.demo.reference_date}`
                      : 'Resultados de mercado'}
                  </span>
                  <span>
                    {snapshot.rows.length} filas disponibles ·{' '}
                    {snapshot.job.methodology_version}
                  </span>
                </div>
                <dl className="kpi-grid">
                  <div>
                    <dt>Empresas mostradas</dt>
                    <dd>
                      {stats.count}
                      <small>de {snapshot.rows.length} disponibles</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Upside mediano</dt>
                    <dd>
                      {formatPercent(stats.medianUpside)}
                      <small>del conjunto filtrado</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Con upside &gt;15 %</dt>
                    <dd>
                      {stats.above15}
                      <small>según esta heurística</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Estado OK</dt>
                    <dd>
                      {stats.ok}
                      <small>entre las mostradas</small>
                    </dd>
                  </div>
                </dl>
                <div className="results-toolbar">
                  <search aria-label="Filtrar resultados">
                    <div className="field">
                      <label htmlFor="result-market">
                        Mercado del resultado
                      </label>
                      <select
                        name="result_market"
                        id="result-market"
                        value={filters.market}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            market: e.target.value as Filters['market'],
                          })
                        }
                      >
                        <option value="all">Todos</option>
                        <option value="USA">USA</option>
                        <option value="MX">México</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="result-status">
                        Estado del resultado
                      </label>
                      <select
                        name="result_status"
                        id="result-status"
                        value={filters.status}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            status: e.target.value as Filters['status'],
                          })
                        }
                      >
                        <option value="all">Todos los estados</option>
                        <option value="OK">OK</option>
                        <option value="DATOS INCOMPLETOS">
                          Datos incompletos
                        </option>
                        <option value="REVISAR">Revisar</option>
                        <option value="ERROR">Error</option>
                      </select>
                    </div>
                    <div className="upside-filter">
                      <label>
                        <input
                          name="filter_upside"
                          type="checkbox"
                          checked={filters.minUpside !== null}
                          onChange={(e) =>
                            setFilters({
                              ...filters,
                              minUpside: e.target.checked ? 0.15 : null,
                            })
                          }
                        />
                        Filtrar por upside mínimo
                      </label>
                      <label htmlFor="min-upside">Upside mínimo (%)</label>
                      <input
                        name="min_upside"
                        id="min-upside"
                        type="number"
                        inputMode="decimal"
                        min={-100}
                        max={10000}
                        step={1}
                        disabled={filters.minUpside === null}
                        value={
                          filters.minUpside === null
                            ? 15
                            : Number((filters.minUpside * 100).toPrecision(12))
                        }
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            minUpside:
                              e.target.value === ''
                                ? 0
                                : Number(e.target.value) / 100,
                          })
                        }
                      />
                    </div>
                  </search>
                  <ExportButton
                    key={snapshot.job.id}
                    snapshot={snapshot}
                    api={analysis.api}
                    disabled={analysis.unavailable}
                  />
                </div>
                <p className="filter-help">
                  Los filtros conservan las empresas sin upside. La descarga
                  incluye todo el análisis, independientemente de esta vista.
                  {active && !terminal(active.state)
                    ? ' Estas cifras son parciales.'
                    : ''}
                </p>
                <ResultsTable
                  rows={rows}
                  selected={view.selectedTicker}
                  onSelect={select}
                />
              </>
            ) : !view.pending && (!active || terminal(active.state)) ? (
              <div className="analysis-empty">
                <span className="empty-index" aria-hidden="true">
                  USA <span>↔</span> MX
                </span>
                <h3>Prepara tu próximo análisis.</h3>
                <p>
                  Selecciona empresas, ajusta los supuestos y compara el precio
                  con cuatro aproximaciones de valoración.
                </p>
                <ol>
                  <li>Elige un mercado y sus empresas.</li>
                  <li>Revisa tasas, márgenes y múltiplos.</li>
                  <li>Compara, consulta el detalle y exporta.</li>
                </ol>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    draft.source === 'market'
                      ? analysis.changeSource('demo')
                      : void analysis.submit()
                  }
                >
                  {draft.source === 'market'
                    ? 'Explorar la demo'
                    : 'Volver a analizar'}
                </button>
              </div>
            ) : null}
          </section>
          {!!snapshot?.rows.length && (
            <CompanyDetail
              key={snapshot.job.id}
              snapshot={snapshot}
              selected={view.selectedTicker}
              onSelect={select}
              visibleTickers={rows.map((r) => r.ticker)}
              api={analysis.api}
              referenceDate={meta.demo.reference_date}
            />
          )}
          <p className="workspace-disclaimer">
            La mediana es una referencia heurística, no una predicción de
            precio. Revisa la procedencia, las exclusiones y los supuestos.{' '}
            <a href="/metodologia/">Entender la metodología ↗</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AnalysisApp(props: {
  baseUrl?: string;
  initialSource?: string;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: retryQuery,
            retryDelay,
            refetchOnWindowFocus: false,
            gcTime: 5 * 60_000,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Workspace
        baseUrl={props.baseUrl ?? ''}
        initialSource={props.initialSource}
      />
    </QueryClientProvider>
  );
}
