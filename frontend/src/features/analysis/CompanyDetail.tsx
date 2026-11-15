import { lazy, Suspense, useId, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import Modal from '../../components/Modal';
import { formatDate, formatMoney, formatNumber } from './model';
import { companyName, formatDifference } from './ResultsTable';
import { AnalysisApi, ApiFault, retryDelay, retryQuery } from './transport';
import type { Prices, Snapshot } from './types';
const Charts = lazy(() => import('./Charts'));
const panels = [
  { id: 'summary', name: 'Resumen' },
  { id: 'prices', name: 'Precio histórico' },
  { id: 'financials', name: 'Finanzas' },
  { id: 'margins', name: 'Márgenes' },
] as const;
type Panel = (typeof panels)[number]['id'];
const tabScrollOptions = {
  block: 'nearest',
  inline: 'nearest',
  container: 'nearest',
} as const;
const methods = {
  fcl: 'Flujo de caja libre',
  nopat: 'NOPAT',
  ebitda_adjusted: 'EBITDA ajustado',
  net_income: 'Utilidad neta',
};
export default function CompanyDetail({
  snapshot,
  selected,
  api,
  referenceDate,
  onClose,
  exportControl,
}: {
  snapshot: Snapshot;
  selected: string | null;
  api: AnalysisApi;
  referenceDate: string;
  onClose: () => void;
  exportControl?: ReactNode;
}) {
  const [panel, setPanel] = useState<Panel>('summary');
  const [period, setPeriod] = useState<Prices['period']>('1y');
  const id = useId();
  const nativeFocus =
    typeof HTMLElement !== 'undefined' &&
    Object.hasOwn(HTMLElement.prototype, 'focusGroup');
  const tabs = useRef<HTMLDivElement>(null);
  const company = snapshot.rows.find((r) => r.ticker === selected);
  const prefix = [
    'intval',
    api.baseUrl,
    snapshot.job.source,
    snapshot.job.dataset_version,
    snapshot.job.id,
    company?.ticker,
  ];
  const prices = useQuery({
    queryKey: [...prefix, 'prices', period],
    queryFn: async ({ signal }) => {
      const data = await api.prices(
        snapshot.job.id,
        company!.ticker,
        period,
        signal,
      );
      if (
        data.source !== snapshot.job.source ||
        data.ticker !== company!.ticker
      )
        throw new ApiFault('INVALID_RESPONSE');
      return data;
    },
    enabled: !!company && panel === 'prices',
    retry: retryQuery,
    retryDelay,
    staleTime: (q) =>
      Math.max(0, Date.parse(q.state.data?.expires_at ?? '') - Date.now()) || 0,
    refetchOnWindowFocus: false,
  });
  const financials = useQuery({
    queryKey: [...prefix, 'financials'],
    queryFn: async ({ signal }) => {
      const data = await api.financials(
        snapshot.job.id,
        company!.ticker,
        signal,
      );
      if (
        data.source !== snapshot.job.source ||
        data.ticker !== company!.ticker
      )
        throw new ApiFault('INVALID_RESPONSE');
      return data;
    },
    enabled: !!company && (panel === 'financials' || panel === 'margins'),
    retry: retryQuery,
    retryDelay,
    staleTime: (q) =>
      Math.max(0, Date.parse(q.state.data?.expires_at ?? '') - Date.now()) || 0,
    refetchOnWindowFocus: false,
  });
  if (!company) return null;
  const history = panel === 'prices' ? prices : financials;
  const resource = history.data;
  const emptyHistory =
    resource?.availability === 'empty' ||
    (panel === 'margins' && financials.data?.margins.items.length === 0);
  const configuration = snapshot.job.configuration;
  const maximum = Math.max(
    1,
    ...company.proxies.map((p) => p.value_per_share ?? 0),
  );
  return (
    <Modal
      title={companyName(company)}
      onClose={onClose}
      closeLabel="Cerrar detalle"
      className="detail-dialog"
    >
      <header className="company-dialog-heading">
        <div>
          <h2>{companyName(company)}</h2>
          <p>
            {company.ticker} · {company.market === 'MX' ? 'México' : 'USA'}
            {company.currency ? ` · ${company.currency}` : ''}
          </p>
        </div>
        {exportControl}
      </header>
      <div
        className="detail-tabs"
        role="tablist"
        aria-label="Detalle de empresa"
        ref={tabs}
        {...{ focusgroup: 'tablist nomemory' }}
        onKeyDown={(e) => {
          if (Object.hasOwn(HTMLElement.prototype, 'focusGroup')) return;
          const buttons = [
            ...tabs.current!.querySelectorAll<HTMLButtonElement>('[role=tab]'),
          ];
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            e.key === 'ArrowRight'
              ? (index + 1) % buttons.length
              : e.key === 'ArrowLeft'
                ? (index + buttons.length - 1) % buttons.length
                : e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? buttons.length - 1
                    : -1;
          if (next >= 0) {
            e.preventDefault();
            buttons[next]!.focus();
            buttons[next]!.scrollIntoView?.(tabScrollOptions);
          }
        }}
      >
        {panels.map((p) => (
          <button
            key={p.id}
            type="button"
            id={`${id}-${p.id}`}
            role="tab"
            aria-selected={panel === p.id}
            tabIndex={nativeFocus ? undefined : panel === p.id ? 0 : -1}
            {...{ focusgroupstart: panel === p.id ? '' : undefined }}
            onClick={(e) => {
              setPanel(p.id);
              e.currentTarget.scrollIntoView?.(tabScrollOptions);
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        aria-labelledby={`${id}-${panel}`}
        tabIndex={0}
        className="detail-panel"
      >
        {panel === 'summary' ? (
          <>
            <dl className="valuation-comparison">
              <div>
                <dt>Precio</dt>
                <dd>{formatMoney(company.market_price, company.currency)}</dd>
              </div>
              <div
                className={`valuation-difference ${company.median.upside === null ? 'muted' : company.median.upside < 0 ? 'negative' : 'positive'}`}
              >
                <dt>Diferencia</dt>
                <dd>{formatDifference(company.median.upside)}</dd>
                <span aria-hidden="true">→</span>
              </div>
              <div>
                <dt>Estimado</dt>
                <dd>
                  {company.median.value_per_share === null
                    ? 'Sin estimación'
                    : formatMoney(
                        company.median.value_per_share,
                        company.currency,
                      )}
                </dd>
              </div>
            </dl>
            <section className="detail-section">
              <h3>Métodos</h3>
              <p className="detail-note">Mediana de los métodos disponibles.</p>
              <table className="methods-table">
                <caption className="sr-only">
                  Cuatro métodos de valoración
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Método</th>
                    <th scope="col">
                      {company.currency ?? 'Moneda no disponible'} / acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {company.proxies.map((p) => (
                    <tr key={p.id}>
                      <th scope="row">
                        {methods[p.id]}
                        {!p.included && (
                          <small>
                            {p.exclusion_reason ?? 'Excluido del estimado'}
                          </small>
                        )}
                      </th>
                      <td>
                        <span className="method-meter" aria-hidden="true">
                          <span
                            style={{
                              inlineSize: `${Math.max(0, (p.value_per_share ?? 0) / maximum) * 100}%`,
                            }}
                          />
                        </span>
                        <span>{formatNumber(p.value_per_share)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="detail-section">
              <h3>Supuestos</h3>
              <dl className="snapshot-assumptions">
                <div>
                  <dt>Fuente</dt>
                  <dd>
                    {company.traceability.source ??
                      (snapshot.job.source === 'demo'
                        ? 'Datos ficticios'
                        : 'Mercado')}{' '}
                    · {snapshot.job.dataset_version}
                  </dd>
                </div>
                <div>
                  <dt>Fecha de referencia</dt>
                  <dd>
                    {formatDate(
                      snapshot.job.source === 'demo'
                        ? referenceDate
                        : company.traceability.price_date,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Moneda</dt>
                  <dd>{company.currency ?? 'No disponible'}</dd>
                </div>
                <div>
                  <dt>Proyección</dt>
                  <dd>{configuration.anos_proyeccion} años</dd>
                </div>
                <div>
                  <dt>Descuento accionista / empresa</dt>
                  <dd>
                    {formatNumber(configuration.tasa_descuento * 100)} % /{' '}
                    {formatNumber(configuration.tasa_descuento_empresa * 100)} %
                  </dd>
                </div>
                <div>
                  <dt>Objetivo de analistas</dt>
                  <dd>
                    {formatMoney(
                      company.analyst_target.value,
                      company.currency,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    {company.status === 'OK'
                      ? 'Datos suficientes'
                      : company.status}
                  </dd>
                </div>
              </dl>
              {company.notes && <p className="detail-note">{company.notes}</p>}
            </section>
          </>
        ) : (
          <>
            {panel === 'prices' && (
              <div className="period-control">
                <label htmlFor={`${id}-period`}>
                  Período del precio histórico
                </label>
                <select
                  id={`${id}-period`}
                  name="price_period"
                  value={period}
                  onChange={(e) =>
                    setPeriod(e.target.value as Prices['period'])
                  }
                >
                  <option value="1y">1 año</option>
                  <option value="2y">2 años</option>
                  <option value="5y">5 años</option>
                  <option value="10y">10 años</option>
                </select>
              </div>
            )}
            {history.isPending && <p role="status">Cargando histórico…</p>}
            {history.error && (
              <div className="inline-warning" role="status">
                <p>{history.error.message}</p>
                <button type="button" onClick={() => void history.refetch()}>
                  Reintentar histórico
                </button>
              </div>
            )}
            {emptyHistory && (
              <p>No hay observaciones disponibles para este histórico.</p>
            )}
            {resource?.availability === 'available' && !emptyHistory && (
              <>
                <p className="detail-note">
                  {resource.provenance} · Consulta{' '}
                  {formatDate(resource.fetched_at)} ·{' '}
                  {panel === 'prices'
                    ? prices.data?.price_kind === 'synthetic'
                      ? 'Precio sintético'
                      : 'Cierre ajustado'
                    : financials.data?.unit === 'millions'
                      ? `Millones de ${resource.currency ?? 'moneda no disponible'}`
                      : resource.currency}
                </p>
                <Suspense fallback={<p role="status">Preparando gráfica…</p>}>
                  <Charts
                    kind={panel}
                    company={company}
                    prices={prices.data}
                    financials={financials.data}
                  />
                </Suspense>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
