import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AnalysisForm from './AnalysisForm';
import CompanyDetail from './CompanyDetail';
import ResultsTable from './ResultsTable';
import SettingsDialog from './SettingsDialog';
import ExportButton, { useExport } from './ExportButton';
import { useWorkspaceRoute } from './workspace-route';
import { configurationChanged, editableConfiguration, terminal } from './model';
import { retryDelay, retryQuery } from './transport';
import type { Job } from './types';
import { useAnalysis } from './use-analysis';
import '../../styles/workspace.css';

export const stateLabels: Record<Job['state'], string> = {
  queued: 'En cola',
  running: 'Analizando empresas',
  cancelling: 'Cancelando; terminando la consulta actual',
  completed: 'Análisis completado',
  cancelled: 'Análisis cancelado',
  failed: 'No se pudo completar el lote',
};
function Workspace({
  baseUrl,
  initialSource,
}: {
  baseUrl: string;
  initialSource?: string;
}) {
  const analysis = useAnalysis({ baseUrl, initialSource });
  const { draft, meta, snapshot, view } = analysis;
  const { route, navigate, closeDetail } = useWorkspaceRoute();
  const [settings, setSettings] = useState(false);
  const priorScreen = useRef(route.screen);
  const exporter = useExport(analysis.api, snapshot?.job.id);
  const active = view.current?.job;
  const source =
    route.screen === 'results' && snapshot
      ? snapshot.job.source
      : draft?.source;
  useEffect(() => {
    const indicator = document.querySelector('[data-active-source]');
    if (indicator)
      indicator.textContent =
        route.screen === 'history'
          ? 'Este navegador'
          : source === 'demo'
            ? 'Datos ficticios'
            : source === 'market'
              ? 'Mercado'
              : 'USA · México';
    const brand = document.querySelector<HTMLAnchorElement>('.brand');
    if (brand) brand.href = '#analizar';
    const links = [
      document.querySelector<HTMLAnchorElement>('[data-analysis-nav]'),
      document.querySelector<HTMLAnchorElement>('[data-results-nav]'),
      document.querySelector<HTMLAnchorElement>('[data-history-nav]'),
    ];
    const hashes = ['#analizar', '#resultados', '#historial'];
    links.forEach((link, i) => {
      if (!link) return;
      link.href = hashes[i]!;
      if (i === 1)
        link.hidden =
          !snapshot && !active && !view.pending && !analysis.reference;
      if (['selection', 'results', 'history'][i] === route.screen)
        link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const heading = document.querySelector<HTMLElement>('#contenido');
    const title =
      route.screen === 'selection'
        ? 'Elige las empresas'
        : route.screen === 'history'
          ? 'Análisis anteriores'
          : 'Resultados';
    if (heading) {
      heading.textContent = title;
      if (priorScreen.current !== route.screen && !route.ticker)
        heading.focus();
    }
    document.title = `${title} | IntVal`;
    priorScreen.current = route.screen;
  }, [
    route.screen,
    route.ticker,
    source,
    snapshot,
    active,
    view.pending,
    analysis.reference,
  ]);
  if (!meta || !draft)
    return (
      <div className="workspace-loading" id="resultados">
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
  const observations = active
    ? active.counts['DATOS INCOMPLETOS'] +
      active.counts.REVISAR +
      active.counts.ERROR
    : 0;
  const completed = active?.state === 'completed' && !analysis.loadingRows;
  const noEstimates =
    completed &&
    snapshot?.job.id === active?.id &&
    snapshot.rows.length > 0 &&
    snapshot.rows.every((company) => company.median.value_per_share === null);
  const unavailableReason =
    noEstimates && snapshot.rows.length === 1
      ? snapshot.rows[0]?.notes?.split(';')[0]
      : undefined;
  const defaults = editableConfiguration(meta.configuration);
  const modified = configurationChanged(
    draft.configuration,
    meta.configuration,
  );
  const exportControl = snapshot ? (
    <ExportButton
      snapshot={snapshot}
      state={exporter}
      unavailable={analysis.unavailable}
    />
  ) : null;
  const detailCompany =
    route.ticker && snapshot?.rows.some((c) => c.ticker === route.ticker);
  return (
    <div className="workspace" data-dashboard>
      <div className="workspace-toolbar">
        <span className="source-indicator">
          {route.screen === 'history'
            ? 'Este navegador'
            : source === 'demo'
              ? `Datos ficticios · ${meta.demo.reference_date}`
              : 'Mercado'}
        </span>
        <button
          type="button"
          aria-label={
            modified
              ? 'Ajustes Modificados de valoración'
              : 'Ajustes de valoración'
          }
          onClick={(event) => {
            event.currentTarget.focus({ preventScroll: true });
            setSettings(true);
          }}
        >
          Ajustes{' '}
          {modified && <span className="modified-indicator">Modificados</span>}
        </button>
      </div>
      <section
        id="analizar"
        hidden={route.screen !== 'selection'}
        aria-label="Elegir empresas"
      >
        <div className="analysis-controls">
          <AnalysisForm
            analysis={analysis}
            onAnalyze={() => navigate('#resultados')}
          />
        </div>
      </section>
      <section
        id="resultados"
        className="results-section"
        aria-label="Resultados del análisis"
        hidden={route.screen !== 'results'}
      >
        {(view.pending || active) && (
          <div className="analysis-progress" role="status">
            <div className="progress-heading">
              <strong>
                {view.pending
                  ? analysis.reference
                    ? 'Recuperando análisis…'
                    : 'Enviando análisis…'
                  : completed
                    ? noEstimates
                      ? 'No hay estimaciones disponibles'
                      : `${stateLabels.completed}${observations ? ' con observaciones' : ''}`
                    : analysis.loadingRows && active && terminal(active.state)
                      ? 'Cargando los resultados completos…'
                      : stateLabels[active!.state]}
              </strong>
              {view.pending && !analysis.reference && (
                <button
                  type="button"
                  onClick={() => {
                    analysis.cancelSubmission();
                    navigate(view.previous ? '#resultados' : '#analizar');
                  }}
                >
                  Cancelar solicitud
                </button>
              )}
              {active && !terminal(active.state) && (
                <button
                  type="button"
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
            {unavailableReason && <p>{unavailableReason}</p>}
            {active && !terminal(active.state) && (
              <>
                <progress
                  value={active.processed}
                  max={active.total}
                  aria-label="Empresas procesadas"
                />
                <span>
                  {active.processed} de {active.total}
                  {active.current_ticker ? ` · ${active.current_ticker}` : ''}
                </span>
              </>
            )}
          </div>
        )}
        {view.message && (
          <div className="inline-warning" role="status">
            <p>{view.message}</p>
            {analysis.canRetryCreate && (
              <button type="button" onClick={() => void analysis.retryCreate()}>
                Reintentar envío
              </button>
            )}
          </div>
        )}
        {analysis.transportError && (
          <div className="inline-warning" role="status">
            <p>{analysis.transportError.message}</p>
            {analysis.unavailable ? (
              <button type="button" onClick={() => navigate('#analizar')}>
                Volver a analizar
              </button>
            ) : (
              <button type="button" onClick={() => void analysis.reconnect()}>
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
        {snapshot && snapshot !== view.current && (
          <p className="inline-note">
            Resultado anterior. El nuevo análisis se mostrará al recibir sus
            primeras filas.
          </p>
        )}
        {snapshot?.rows.length ? (
          <ResultsTable
            key={snapshot.job.id}
            rows={snapshot.rows}
            selected={route.ticker ?? null}
            onSelect={(ticker) => {
              analysis.selectCompany(ticker);
              navigate(`#empresa/${encodeURIComponent(ticker)}`);
            }}
            actions={
              <>
                <button type="button" onClick={() => navigate('#analizar')}>
                  Editar selección
                </button>
                {exportControl}
              </>
            }
          />
        ) : !view.pending && (!active || terminal(active.state)) ? (
          <div className="selection-empty">
            <p>Aún no hay resultados disponibles.</p>
            <button type="button" onClick={() => navigate('#analizar')}>
              Crear un análisis
            </button>
          </div>
        ) : (
          <p>Esperando resultados…</p>
        )}
        {route.ticker &&
          !detailCompany &&
          !view.pending &&
          !analysis.loadingRows && (
            <p role="status">La empresa no está disponible en este análisis.</p>
          )}
      </section>
      <section
        id="historial"
        className="history-view"
        aria-label="Análisis anteriores"
        hidden={route.screen !== 'history'}
      >
        {analysis.history.length ? (
          <ul className="history-list">
            {analysis.history.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-label={`Abrir análisis de ${entry.total} empresas · ${entry.createdAt}`}
                  onClick={() => {
                    analysis.openAnalysis(entry);
                    navigate('#resultados');
                  }}
                >
                  <span>
                    <strong>
                      {entry.total} {entry.total === 1 ? 'empresa' : 'empresas'}
                    </strong>
                    <span>
                      {entry.labels.join(', ')}
                      {entry.total > entry.labels.length
                        ? ` +${entry.total - entry.labels.length}`
                        : ''}
                    </span>
                  </span>
                  <span className="history-meta">
                    <span>
                      {entry.source === 'demo' ? 'Datos ficticios' : 'Mercado'}
                    </span>
                    <span>
                      {entry.expired
                        ? 'Ya no disponible'
                        : stateLabels[entry.state]}
                    </span>
                    <time dateTime={entry.createdAt}>
                      {new Intl.DateTimeFormat('es-MX', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(entry.createdAt))}
                    </time>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="selection-empty">
            <p>Todavía no hay análisis en este navegador.</p>
            <button type="button" onClick={() => navigate('#analizar')}>
              Crear un análisis
            </button>
          </div>
        )}
      </section>
      {detailCompany && snapshot && (
        <CompanyDetail
          key={`${snapshot.job.id}:${route.ticker}`}
          snapshot={snapshot}
          selected={route.ticker!}
          api={analysis.api}
          exportControl={exportControl}
          onClose={closeDetail}
        />
      )}
      {settings && (
        <SettingsDialog
          value={draft.configuration}
          defaults={defaults}
          onSave={analysis.commitConfiguration}
          onClose={() => setSettings(false)}
        />
      )}
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
