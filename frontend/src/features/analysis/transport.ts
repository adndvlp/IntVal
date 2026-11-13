import { configurationFields } from './model';
import type {
  Catalog,
  Company,
  CreateRequest,
  Financials,
  Job,
  Metadata,
  Prices,
  ResultsPage,
  Source,
} from './types';

type ObjectValue = Record<string, unknown>;
const object = (v: unknown): v is ObjectValue =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';
const number = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const integer = (v: unknown): v is number =>
  number(v) && Number.isInteger(v) && v >= 0;
const nullableNumber = (v: unknown) => v === null || number(v);
const nullableText = (v: unknown) => v === null || text(v);
const source = (v: unknown) => v === 'market' || v === 'demo';
const market = (v: unknown) => v === 'USA' || v === 'MX';
const list = (v: unknown, check: (item: unknown) => boolean): v is unknown[] =>
  Array.isArray(v) && v.every(check);
const keys = (
  v: ObjectValue,
  names: readonly string[],
  check: (item: unknown) => boolean,
) => names.every((k) => check(v[k]));
const finiteJson = (v: unknown): boolean =>
  v === null ||
  ['string', 'boolean'].includes(typeof v) ||
  number(v) ||
  (Array.isArray(v)
    ? v.every(finiteJson)
    : object(v) && Object.values(v).every(finiteJson));
const configuration = (v: unknown) =>
  object(v) &&
  configurationFields.every(
    (f) =>
      number(v[f.key]) &&
      (v[f.key] as number) * f.scale >= f.min &&
      (v[f.key] as number) * f.scale <= f.max,
  );
const proxyIds = ['fcl', 'nopat', 'ebitda_adjusted', 'net_income'];
const statuses = ['OK', 'DATOS INCOMPLETOS', 'REVISAR', 'ERROR'];

function validMetadata(v: unknown): v is Metadata {
  const capabilities = object(v) ? v.capabilities : null;
  return (
    object(v) &&
    v.schema_version === '1.0' &&
    source(v.default_source) &&
    list(capabilities, text) &&
    ['catalog', 'analyses', 'cancellation', 'histories', 'excel_export'].every(
      (c) => capabilities.includes(c),
    ) &&
    keys(v, ['methodology_version', 'financial_contract_version'], text) &&
    configuration(v.configuration) &&
    object(v.demo) &&
    keys(v.demo, ['version', 'reference_date'], text) &&
    object(v.limits) &&
    keys(
      v.limits,
      [
        'max_tickers',
        'max_body_bytes',
        'max_queue',
        'max_retained',
        'memory_budget_bytes',
        'terminal_ttl_seconds',
        'analysis_cache_ttl_seconds',
        'prices_cache_ttl_seconds',
        'financials_cache_ttl_seconds',
        'job_deadline_seconds',
        'acquisition_timeout_seconds',
      ],
      (x) => integer(x) && x > 0,
    ) &&
    list(
      v.sources,
      (x) => object(x) && source(x.id) && typeof x.enabled === 'boolean',
    )
  );
}
function validCatalog(v: unknown): v is Catalog {
  return (
    object(v) &&
    source(v.source) &&
    ['USA', 'MX', 'all'].includes(String(v.market)) &&
    integer(v.total) &&
    keys(v, ['dataset_version', 'reference_date', 'description'], text) &&
    list(v.items, (x) => object(x) && text(x.ticker) && market(x.market)) &&
    v.items.length === v.total
  );
}
function validJob(v: unknown): v is Job {
  return (
    object(v) &&
    keys(
      v,
      [
        'id',
        'dataset_version',
        'methodology_version',
        'financial_contract_version',
        'created_at',
      ],
      text,
    ) &&
    v.schema_version === '1.0' &&
    source(v.source) &&
    [
      'queued',
      'running',
      'cancelling',
      'completed',
      'cancelled',
      'failed',
    ].includes(String(v.state)) &&
    integer(v.total) &&
    integer(v.processed) &&
    v.processed <= v.total &&
    integer(v.revision) &&
    configuration(v.configuration) &&
    keys(
      v,
      ['current_ticker', 'started_at', 'finished_at', 'expires_at'],
      nullableText,
    ) &&
    object(v.counts) &&
    keys(v.counts, statuses, integer) &&
    (v.error === null || object(v.error)) &&
    object(v.links) &&
    keys(v.links, ['status', 'results', 'cancel', 'export'], text)
  );
}
function validCompany(v: unknown): v is Company {
  return (
    object(v) &&
    keys(v, ['ticker', 'company_name'], text) &&
    market(v.market) &&
    nullableText(v.currency) &&
    nullableNumber(v.market_price) &&
    statuses.includes(String(v.status)) &&
    nullableText(v.notes) &&
    nullableText(v.company_class) &&
    list(
      v.proxies,
      (x) =>
        object(x) &&
        proxyIds.includes(String(x.id)) &&
        keys(x, ['value_per_share', 'upside'], nullableNumber) &&
        typeof x.included === 'boolean' &&
        nullableText(x.exclusion_reason),
    ) &&
    v.proxies.length === 4 &&
    new Set(v.proxies.map((x) => (x as ObjectValue).id)).size === 4 &&
    object(v.median) &&
    keys(v.median, ['value_per_share', 'upside'], nullableNumber) &&
    integer(v.median.count) &&
    list(v.median.included_models, (x) => proxyIds.includes(String(x))) &&
    object(v.analyst_target) &&
    keys(v.analyst_target, ['value', 'upside'], nullableNumber) &&
    nullableNumber(v.analyst_target.coverage) &&
    keys(
      v.analyst_target,
      ['statistic', 'date', 'horizon', 'source'],
      nullableText,
    ) &&
    object(v.traceability) &&
    keys(
      v.traceability,
      [
        'source',
        'fetched_at',
        'price_date',
        'price_source',
        'reporting_currency',
        'quote_currency',
        'fx_source',
        'fx_fetched_at',
        'fx_date',
        'revenue_period',
        'debt_period',
        'cash_period',
      ],
      nullableText,
    ) &&
    nullableNumber(v.traceability.fx_rate) &&
    list(
      v.audit_fields,
      (x) =>
        object(x) &&
        keys(x, ['key', 'domain_key', 'label'], text) &&
        'value' in x,
    ) &&
    object(v.calculation) &&
    keys(v.calculation, ['computed_at', 'expires_at'], text) &&
    typeof v.calculation.cache_hit === 'boolean'
  );
}
function validPage(v: unknown): v is ResultsPage {
  return (
    object(v) &&
    text(v.id) &&
    keys(v, ['next_cursor', 'processed', 'total', 'revision'], integer) &&
    typeof v.done === 'boolean' &&
    list(v.items, validCompany)
  );
}
function history(v: unknown): v is ObjectValue {
  return (
    object(v) &&
    source(v.source) &&
    keys(
      v,
      [
        'ticker',
        'dataset_version',
        'computed_at',
        'expires_at',
        'fetched_at',
        'provenance',
      ],
      text,
    ) &&
    nullableText(v.currency) &&
    nullableText(v.reference_date) &&
    nullableText(v.message) &&
    typeof v.cache_hit === 'boolean' &&
    ['empty', 'available'].includes(String(v.availability))
  );
}
function validPrices(v: unknown): v is Prices {
  return (
    history(v) &&
    ['1y', '2y', '5y', '10y'].includes(String(v.period)) &&
    ['synthetic', 'adjusted_close'].includes(String(v.price_kind)) &&
    list(
      v.items,
      (x) =>
        object(x) &&
        text(x.date) &&
        /^\d{4}-\d{2}-\d{2}$/.test(x.date) &&
        nullableNumber(x.value),
    )
  );
}
function validFinancials(v: unknown): v is Financials {
  return (
    history(v) &&
    v.unit === 'millions' &&
    list(
      v.items,
      (x) =>
        object(x) &&
        integer(x.year) &&
        keys(
          x,
          ['revenue', 'fcl', 'ebit', 'ebitda', 'net_income'],
          nullableNumber,
        ),
    ) &&
    object(v.margins) &&
    v.margins.unit === 'ratio' &&
    list(
      v.margins.items,
      (x) =>
        object(x) &&
        integer(x.year) &&
        keys(x, ['fcl', 'nopat', 'ebitda', 'net_income'], nullableNumber),
    )
  );
}

const messages: Record<string, string> = {
  INVALID_REQUEST: 'Revisa la selección y los supuestos del análisis.',
  SOURCE_DISABLED: 'La fuente de mercado está deshabilitada en este servicio.',
  IDEMPOTENCY_CONFLICT:
    'Esta solicitud ya se usó con otro contenido. Inicia un nuevo análisis.',
  CAPACITY_EXCEEDED:
    'El servicio está ocupado. Espera unos segundos y reintenta el mismo envío.',
  ANALYSIS_EXPIRED:
    'El análisis expiró. Puedes volver a analizar las empresas.',
  ANALYSIS_NOT_FOUND:
    'El análisis ya no está disponible. Puede haberse reiniciado el servicio. Puedes volver a analizar.',
  HISTORY_FAILED:
    'No se pudo obtener este histórico. Los resultados del análisis siguen disponibles.',
  ACQUISITION_BUSY:
    'La fuente está ocupada. Reintenta este panel en unos segundos.',
  EXPORT_NOT_READY: 'La descarga requiere un análisis completado.',
  EXPORT_FAILED: 'No se pudo preparar el Excel. Puedes reintentar la descarga.',
  EXPORT_BUSY: 'Se está preparando otra descarga. Reintenta en unos segundos.',
  COMPANY_NOT_READY: 'Espera a que termine el análisis de esta empresa.',
  COMPANY_NOT_FOUND: 'Esta empresa no pertenece al análisis.',
  BODY_TOO_LARGE: 'La selección supera el tamaño permitido. Reduce el lote.',
  NETWORK_ERROR: 'No se pudo conectar con el servicio. Puedes reintentar.',
  INVALID_RESPONSE:
    'La respuesta del servicio no es compatible. Reintenta la conexión.',
};

export class ApiFault extends Error {
  constructor(
    public code: string,
    public status = 0,
    public retryable = false,
    public retryAfter = 0,
    public fields: string[] = [],
  ) {
    super(
      messages[code] ?? 'No se pudo completar la operación. Puedes reintentar.',
    );
    this.name = 'ApiFault';
  }
}

async function failed(response: Response): Promise<never> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const e = object(payload) && object(payload.error) ? payload.error : null;
  const code =
    e && text(e.code)
      ? e.code
      : response.status === 404
        ? 'ANALYSIS_NOT_FOUND'
        : response.status === 410
          ? 'ANALYSIS_EXPIRED'
          : 'SERVICE_ERROR';
  const header = response.headers.get('Retry-After');
  const seconds = header ? Number(header) : 0;
  const retryAfter = header
    ? Number.isFinite(seconds)
      ? Math.max(0, seconds * 1000)
      : Math.max(0, Date.parse(header) - Date.now()) || 0
    : 0;
  throw new ApiFault(
    code,
    response.status,
    e && typeof e.retryable === 'boolean'
      ? e.retryable
      : response.status >= 500 || response.status === 429,
    retryAfter,
    e && Array.isArray(e.fields)
      ? e.fields
          .filter(object)
          .map((f) => f.field)
          .filter(
            (f): f is string =>
              text(f) && /^(configuration\.[a-z_]+|tickers|source)$/.test(f),
          )
      : [],
  );
}

export class AnalysisApi {
  readonly baseUrl: string;
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }
  private async response(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        credentials: 'omit',
        headers: { Accept: 'application/json', ...options.headers },
      });
      if (!response.ok) await failed(response);
      return response;
    } catch (e) {
      if (e instanceof ApiFault || (object(e) && e.name === 'AbortError'))
        throw e;
      throw new ApiFault('NETWORK_ERROR', 0, true);
    }
  }
  private async json<T>(
    path: string,
    check: (v: unknown) => v is T,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await this.response(path, options);
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new ApiFault('INVALID_RESPONSE');
    }
    if (!finiteJson(value) || !check(value))
      throw new ApiFault('INVALID_RESPONSE');
    return value;
  }
  metadata(signal?: AbortSignal) {
    return this.json('/api/v1/meta', validMetadata, { signal });
  }
  catalog(source: Source, signal?: AbortSignal) {
    return this.json(
      `/api/v1/catalog?source=${source}&market=all`,
      validCatalog,
      { signal },
    );
  }
  async create(payload: CreateRequest) {
    const value = await this.json('/api/v1/analyses', validJob, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (value.source !== payload.source) throw new ApiFault('INVALID_RESPONSE');
    return value;
  }
  private path(id: string) {
    return `/api/v1/analyses/${encodeURIComponent(id)}`;
  }
  async status(id: string, signal?: AbortSignal) {
    const value = await this.json(this.path(id), validJob, { signal });
    if (value.id !== id) throw new ApiFault('INVALID_RESPONSE');
    return value;
  }
  async results(id: string, after: number, signal?: AbortSignal) {
    const value = await this.json(
      `${this.path(id)}/results?after=${after}&limit=100`,
      validPage,
      { signal },
    );
    if (
      value.id !== id ||
      value.next_cursor !== after + value.items.length ||
      value.next_cursor > value.processed ||
      value.processed > value.total
    )
      throw new ApiFault('INVALID_RESPONSE');
    return value;
  }
  cancel(id: string) {
    return this.json(`${this.path(id)}/cancel`, validJob, { method: 'POST' });
  }
  prices(
    id: string,
    ticker: string,
    period: Prices['period'],
    signal?: AbortSignal,
  ) {
    return this.json(
      `${this.path(id)}/companies/${encodeURIComponent(ticker)}/prices?period=${period}`,
      validPrices,
      { signal },
    );
  }
  financials(id: string, ticker: string, signal?: AbortSignal) {
    return this.json(
      `${this.path(id)}/companies/${encodeURIComponent(ticker)}/financials`,
      validFinancials,
      { signal },
    );
  }
  async download(id: string, source: Source, signal?: AbortSignal) {
    const response = await this.response(`${this.path(id)}/export.xlsx`, {
      signal,
      headers: {
        Accept:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
    if (
      !response.headers
        .get('Content-Type')
        ?.includes(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
    )
      throw new ApiFault('INVALID_RESPONSE');
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes[0] !== 80 || bytes[1] !== 75 || bytes[2] !== 3 || bytes[3] !== 4)
      throw new ApiFault('INVALID_RESPONSE');
    return {
      blob,
      name:
        source === 'demo'
          ? 'demo_valoraciones_USA_MX.xlsx'
          : 'valoraciones_USA_MX.xlsx',
    };
  }
}

export const retryQuery = (count: number, error: Error) =>
  count < 2 && error instanceof ApiFault && error.retryable;
export const retryDelay = (attempt: number, error: Error) =>
  Math.max(
    1000 * 2 ** attempt,
    error instanceof ApiFault ? error.retryAfter : 0,
  );
