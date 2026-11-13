// Fixtures de transporte independientes: importes del oráculo público demo-1.0.
// Este módulo sólo se importa en tests y no forma parte del runtime.
import type {
  Company,
  Configuration,
  Job,
  Metadata,
  Catalog,
  Prices,
  Financials,
} from './types';

export const config = (): Configuration => ({
  tasa_descuento: 0.1,
  tasa_descuento_empresa: 0.1,
  factor_margen_conservador: 0.8,
  factor_crecimiento_inicial: 0.25,
  factor_crecimiento_final: 0.5,
  multiplo_terminal_fcl: 12,
  multiplo_terminal_ebit: 12,
  multiplo_terminal_ebitda: 12,
  multiplo_terminal_utilidad_neta: 15,
});

export const effective = () => ({
  ...config(),
  anos_proyeccion: 10 as const,
  crecimiento_fallback: 0.03 as const,
  crecimiento_maximo: 0.12 as const,
  crecimiento_minimo: -0.02 as const,
  max_anos_historicos: 5 as const,
  tasa_impuestos_fallback: 0.21 as const,
  tasa_impuestos_maxima: 0.35 as const,
  tasa_impuestos_minima: 0 as const,
  pausa_entre_tickers: 0 as const,
});

export function company(
  ticker = 'DEMO-USA',
  upside: number | null = 0.1618799305100671,
): Company {
  return {
    ticker,
    market: ticker.endsWith('.MX') ? 'MX' : 'USA',
    company_name: `Empresa ${ticker}`,
    currency: ticker.endsWith('.MX') ? 'MXN' : 'USD',
    market_price: 100,
    proxies: ['fcl', 'nopat', 'ebitda_adjusted', 'net_income'].map(
      (id, index) => ({
        id: id as Company['proxies'][number]['id'],
        value_per_share: [
          112.01930042013419, 117.86990820939596, 117.86990820939596,
          114.50607789261744,
        ][index]!,
        upside: 0.12,
        included: true,
        exclusion_reason: null,
      }),
    ),
    median: {
      value_per_share: upside === null ? null : 116.1879930510067,
      upside,
      count: 4,
      included_models: ['fcl', 'nopat', 'ebitda_adjusted', 'net_income'],
    },
    analyst_target: {
      value: 120,
      upside: 0.2,
      source: 'Objetivo ficticio',
      statistic: 'sintético',
      coverage: null,
      date: null,
      horizon: null,
    },
    status: 'OK',
    notes: 'Datos sintéticos de demostración.',
    company_class: 'OPERATIVA',
    traceability: {
      source: 'demo-1.0',
      fetched_at: null,
      price_date: '2025-01-03',
      price_source: 'sintético',
      reporting_currency: 'USD',
      quote_currency: 'USD',
      fx_rate: 1,
      fx_source: 'identidad',
      fx_fetched_at: null,
      fx_date: null,
      revenue_period: '2024-12-31',
      debt_period: '2024-12-31',
      cash_period: '2024-12-31',
    },
    audit_fields: [
      {
        key: 'tax_rate',
        domain_key: 'Tasa de impuestos',
        label: 'Tasa de impuestos',
        value: 0.2,
      },
    ],
    calculation: {
      computed_at: '2026-11-13T00:00:00Z',
      expires_at: '2026-11-13T01:00:00Z',
      cache_hit: false,
    },
  };
}

export function job(
  id = 'trabajo',
  revision = 2,
  state: Job['state'] = 'completed',
): Job {
  const base = `/api/v1/analyses/${id}`;
  return {
    id,
    revision,
    state,
    source: 'demo',
    total: 1,
    processed: state === 'completed' ? 1 : 0,
    current_ticker: null,
    counts: { OK: 1, 'DATOS INCOMPLETOS': 0, REVISAR: 0, ERROR: 0 },
    configuration: effective(),
    dataset_version: 'demo-1.0',
    schema_version: '1.0',
    methodology_version: 'proxies-1.0',
    financial_contract_version: '2.0',
    created_at: '2026-11-13T00:00:00Z',
    started_at: null,
    finished_at: null,
    expires_at: null,
    error: null,
    links: {
      status: base,
      results: `${base}/results`,
      cancel: `${base}/cancel`,
      export: `${base}/export.xlsx`,
    },
  };
}

export const metadata = (): Metadata => ({
  schema_version: '1.0',
  methodology_version: 'proxies-1.0',
  financial_contract_version: '2.0',
  default_source: 'market',
  capabilities: [
    'catalog',
    'analyses',
    'cancellation',
    'histories',
    'excel_export',
  ],
  demo: { version: 'demo-1.0', reference_date: '2025-01-03' },
  configuration: { ...effective(), pausa_entre_tickers: 0.15 },
  sources: [
    { id: 'demo', enabled: true },
    { id: 'market', enabled: true },
  ],
  limits: {
    max_tickers: 650,
    max_body_bytes: 65536,
    max_queue: 2,
    max_retained: 16,
    memory_budget_bytes: 67108864,
    terminal_ttl_seconds: 3600,
    analysis_cache_ttl_seconds: 3600,
    prices_cache_ttl_seconds: 1800,
    financials_cache_ttl_seconds: 3600,
    job_deadline_seconds: 1800,
    acquisition_timeout_seconds: 60,
    analysis_workers: 1,
    max_cache_entries: 512,
    max_results_page: 100,
    max_symbol_length: 32,
    max_tombstones: 64,
    memory_measurement: 'managed_json_payload_bytes',
  },
});

export const catalog = (source: 'demo' | 'market' = 'demo'): Catalog => ({
  source,
  market: 'all',
  dataset_version: source === 'demo' ? 'demo-1.0' : 'universe-2026',
  reference_date: '2025-01-03',
  description: 'Catálogo local',
  total: 2,
  items: [
    { ticker: source === 'demo' ? 'DEMO-USA' : 'AAPL', market: 'USA' },
    { ticker: source === 'demo' ? 'DEMO-MX.MX' : 'PE&OLES.MX', market: 'MX' },
  ],
});

const history = {
  ticker: 'DEMO-USA',
  source: 'demo' as const,
  dataset_version: 'demo-1.0',
  currency: 'USD',
  reference_date: '2025-01-03',
  fetched_at: '2026-11-13T00:00:00Z',
  computed_at: '2026-11-13T00:00:00Z',
  expires_at: '2026-11-13T01:00:00Z',
  cache_hit: false,
  availability: 'available' as const,
  message: null,
  provenance: 'Datos sintéticos.',
};
export const prices = (): Prices => ({
  ...history,
  period: '1y',
  price_kind: 'synthetic',
  items: [
    { date: '2025-01-02', value: null },
    { date: '2025-01-03', value: 100 },
  ],
});
export const financials = (): Financials => ({
  ...history,
  unit: 'millions',
  items: [
    {
      year: 2024,
      revenue: 0.001,
      fcl: 0.00013,
      ebit: 0.0002,
      ebitda: 0.00025,
      net_income: 0.00012,
    },
  ],
  margins: {
    unit: 'ratio',
    items: [
      { year: 2024, fcl: 0.13, nopat: 0.16, ebitda: 0.25, net_income: 0.12 },
    ],
  },
});
