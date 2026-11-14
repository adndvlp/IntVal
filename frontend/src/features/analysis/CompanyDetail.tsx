import { lazy, Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatMoney, formatNumber, formatPercent } from './model';
import { AnalysisApi, ApiFault, retryDelay, retryQuery } from './transport';
import type { Prices, Snapshot } from './types';
import type { ChartKind } from './Charts';

const Charts = lazy(() => import('./Charts'));
const detailTitle = 'Detrás de cada cifra.';
const panels = [
  { id: 'comparison', name: 'Comparación' },
  { id: 'prices', name: 'Precio histórico' },
  { id: 'financials', name: 'Estados financieros' },
  { id: 'margins', name: 'Márgenes' },
] as const;
const valueText = (value: unknown): string =>
  value === null
    ? '—'
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

export default function CompanyDetail({
  snapshot,
  selected,
  onSelect,
  visibleTickers,
  api,
  referenceDate,
}: {
  snapshot: Snapshot;
  selected: string | null;
  onSelect: (ticker: string) => void;
  visibleTickers: string[];
  api: AnalysisApi;
  referenceDate: string;
}) {
  const [panel, setPanel] = useState<ChartKind>('comparison');
  const [period, setPeriod] = useState<Prices['period']>('1y');
  const company =
    snapshot.rows.find((r) => r.ticker === selected) ?? snapshot.rows[0];
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
  return (
    <section
      className="company-detail"
      aria-label={detailTitle}
      data-company-detail
    >
      <header className="detail-heading">
        <div>
          <p className="eyebrow">03 / En detalle</p>
          <h2 id="detail-heading">{detailTitle}</h2>
        </div>
        <div className="field">
          <label htmlFor="detail-company">Empresa del detalle</label>
          <select
            id="detail-company"
            name="detail_company"
            value={company.ticker}
            onChange={(e) => onSelect(e.target.value)}
          >
            {snapshot.rows.map((c) => (
              <option key={c.ticker} value={c.ticker}>
                {c.ticker} · {c.company_name}
              </option>
            ))}
          </select>
        </div>
      </header>
      {!visibleTickers.includes(company.ticker) && (
        <p className="inline-note">
          Esta empresa queda fuera del filtro actual; pertenece al análisis
          completo.
        </p>
      )}
      <div className="company-identity">
        <span className="ticker-mark" aria-hidden="true">
          {company.market}
        </span>
        <div>
          <h3>{company.company_name}</h3>
          <p>
            {company.ticker} · {company.currency ?? 'Moneda no disponible'} ·{' '}
            <span className="status-text">{company.status}</span>
          </p>
        </div>
      </div>
      <p className="source-line">
        {snapshot.job.source === 'demo'
          ? `Demostración · datos sintéticos · referencia ${referenceDate}`
          : 'Mercado · Yahoo Finance vía yfinance'}
      </p>
      <dl className="company-metrics">
        <div>
          <dt>Precio de mercado</dt>
          <dd>{formatMoney(company.market_price, company.currency)}</dd>
        </div>
        <div>
          <dt>Mediana de proxies</dt>
          <dd>
            {formatMoney(company.median.value_per_share, company.currency)}
          </dd>
        </div>
        <div>
          <dt>Upside mediana</dt>
          <dd>{formatPercent(company.median.upside)}</dd>
        </div>
        <div>
          <dt>
            {snapshot.job.source === 'demo'
              ? 'Objetivo ficticio de analistas'
              : 'Objetivo de analistas'}
          </dt>
          <dd>{formatMoney(company.analyst_target.value, company.currency)}</dd>
        </div>
      </dl>
      <div
        className="detail-views"
        role="group"
        aria-label="Vistas del detalle"
      >
        {panels.map((p) => (
          <button
            type="button"
            key={p.id}
            aria-pressed={panel === p.id}
            aria-controls="company-chart-panel"
            className={panel === p.id ? 'view-button active' : 'view-button'}
            onClick={() => setPanel(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div id="company-chart-panel" className="chart-panel">
        {panel === 'prices' && (
          <div className="period-control">
            <label htmlFor="price-period">Período del precio histórico</label>
            <select
              name="price_period"
              id="price-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as Prices['period'])}
            >
              <option value="1y">1 año</option>
              <option value="2y">2 años</option>
              <option value="5y">5 años</option>
              <option value="10y">10 años</option>
            </select>
          </div>
        )}
        {panel !== 'comparison' && (
          <>
            <p className="resource-note">
              Este histórico se obtiene por separado del análisis.{' '}
              {resource
                ? `${resource.provenance} Consulta: ${formatDate(resource.fetched_at)} (UTC). ${resource.cache_hit ? 'Dato reutilizado de caché.' : ''}`
                : 'Las valoraciones y sus supuestos permanecen disponibles.'}
            </p>
            {history.isPending && (
              <p role="status" className="panel-message">
                Cargando{' '}
                {panel === 'prices' ? 'precios' : 'estados financieros'}…
              </p>
            )}
            {history.error && (
              <div className="panel-message inline-warning" role="status">
                <p>{history.error.message}</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void history.refetch()}
                >
                  Reintentar histórico
                </button>
              </div>
            )}
            {emptyHistory && (
              <p className="panel-message">
                No hay observaciones disponibles para este histórico.
              </p>
            )}
          </>
        )}
        {(panel === 'comparison' ||
          (resource?.availability === 'available' && !emptyHistory)) && (
          <Suspense
            fallback={<p className="panel-message">Preparando gráfica…</p>}
          >
            <Charts
              key={`${snapshot.job.id}:${company.ticker}`}
              kind={panel}
              company={company}
              prices={prices.data}
              financials={financials.data}
            />
          </Suspense>
        )}
      </div>
      <div className="diagnostics-grid">
        <section>
          <h3>Qué entra en la mediana</h3>
          <p>
            {company.median.count} de 4 proxies incluidos. La mediana es una
            referencia heurística.
          </p>
          <ul className="proxy-decisions">
            {company.proxies.map((p) => (
              <li key={p.id}>
                <span>
                  {
                    {
                      fcl: 'FCL',
                      nopat: 'NOPAT',
                      ebitda_adjusted: 'EBITDA ajustado',
                      net_income: 'Utilidad neta',
                    }[p.id]
                  }
                </span>
                <strong>{p.included ? 'Incluido' : 'Excluido'}</strong>
                {p.exclusion_reason && <p>{p.exclusion_reason}</p>}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Procedencia y vigencia</h3>
          <dl className="trace-list">
            <div>
              <dt>Fuente</dt>
              <dd>{company.traceability.source ?? 'No disponible'}</dd>
            </div>
            <div>
              <dt>Fecha del precio</dt>
              <dd>{formatDate(company.traceability.price_date)}</dd>
            </div>
            <div>
              <dt>Tipo de cambio</dt>
              <dd>
                {formatNumber(company.traceability.fx_rate, 6)} ·{' '}
                {company.traceability.reporting_currency ?? '—'}/
                {company.traceability.quote_currency ?? '—'}
              </dd>
            </div>
            <div>
              <dt>Fuente FX</dt>
              <dd>{company.traceability.fx_source ?? 'No disponible'}</dd>
            </div>
            <div>
              <dt>Cálculo (UTC)</dt>
              <dd>
                {formatDate(company.calculation.computed_at)}
                {company.calculation.cache_hit ? ' · reutilizado de caché' : ''}
              </dd>
            </div>
            <div>
              <dt>Objetivo de analistas</dt>
              <dd>
                {company.analyst_target.statistic ??
                  'Estadístico no disponible'}{' '}
                · cobertura {company.analyst_target.coverage ?? 'no disponible'}{' '}
                · horizonte {company.analyst_target.horizon ?? 'no disponible'}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      {company.notes && <p className="diagnostic-note">{company.notes}</p>}
      <details className="audit">
        <summary>
          Supuestos aceptados y auditoría completa (
          {company.audit_fields.length} campos)
        </summary>
        <p>
          Estos datos corresponden al resultado, aunque el formulario tenga
          cambios sin aplicar. Metodología {snapshot.job.methodology_version};
          contrato financiero {snapshot.job.financial_contract_version}.
        </p>
        <dl className="accepted-config">
          {Object.entries(snapshot.job.configuration).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{valueText(value)}</dd>
            </div>
          ))}
        </dl>
        <dl className="audit-list">
          {company.audit_fields.map((f) => (
            <div key={f.key}>
              <dt>{f.label}</dt>
              <dd>{valueText(f.value)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
