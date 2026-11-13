import type {
  Company,
  Configuration,
  EffectiveConfiguration,
  Filters,
  Job,
  Snapshot,
  Source,
} from './types';

export const configurationFields = [
  {
    key: 'tasa_descuento',
    label: 'Tasa de descuento accionista (%)',
    min: 5,
    max: 20,
    step: 0.5,
    scale: 100,
  },
  {
    key: 'tasa_descuento_empresa',
    label: 'Tasa de descuento empresa (%)',
    min: 5,
    max: 20,
    step: 0.5,
    scale: 100,
  },
  {
    key: 'factor_margen_conservador',
    label: 'Factor conservador de margen (%)',
    min: 40,
    max: 100,
    step: 5,
    scale: 100,
  },
  {
    key: 'factor_crecimiento_inicial',
    label: 'Crecimiento 1–5 como % del CAGR',
    min: 0,
    max: 100,
    step: 5,
    scale: 100,
  },
  {
    key: 'factor_crecimiento_final',
    label: 'Crecimiento 6–10 como % del inicial',
    min: 0,
    max: 100,
    step: 5,
    scale: 100,
  },
  {
    key: 'multiplo_terminal_fcl',
    label: 'Múltiplo terminal FCL',
    min: 4,
    max: 30,
    step: 0.5,
    scale: 1,
  },
  {
    key: 'multiplo_terminal_ebit',
    label: 'Múltiplo terminal NOPAT',
    min: 4,
    max: 30,
    step: 0.5,
    scale: 1,
  },
  {
    key: 'multiplo_terminal_ebitda',
    label: 'Múltiplo terminal EBITDA ajustado',
    min: 4,
    max: 30,
    step: 0.5,
    scale: 1,
  },
  {
    key: 'multiplo_terminal_utilidad_neta',
    label: 'Múltiplo terminal utilidad neta',
    min: 4,
    max: 35,
    step: 0.5,
    scale: 1,
  },
] as const;

export function editableConfiguration(
  value: EffectiveConfiguration,
): Configuration {
  return Object.fromEntries(
    configurationFields.map(({ key }) => [key, value[key]]),
  ) as Configuration;
}

export function configurationChanged(
  draft: Configuration,
  accepted: Partial<EffectiveConfiguration>,
): boolean {
  return configurationFields.some(({ key }) => draft[key] !== accepted[key]);
}

export function normalizeTickers(
  selected: string[],
  extras: string,
  source: Source,
  max: number,
  allowed: string[] = [],
): string[] {
  if (source === 'demo' && extras.trim())
    throw new Error(
      'Los símbolos adicionales están deshabilitados en demostración.',
    );
  const values = [
    ...new Set(
      [...selected, ...extras.split(/[\s,;]+/).filter(Boolean)].map((s) =>
        s.trim().toUpperCase(),
      ),
    ),
  ];
  if (!values.length)
    throw new Error('Selecciona al menos una empresa antes de analizar.');
  if (
    values.some(
      (s) => !/^[A-Z0-9][A-Z0-9&.-]{0,31}$/.test(s) || s.includes('..'),
    )
  )
    throw new Error(
      'Revisa el símbolo adicional: admite hasta 32 caracteres, letras, números, puntos, guiones y &.',
    );
  if (source === 'demo' && values.some((s) => !allowed.includes(s)))
    throw new Error('Selecciona empresas del catálogo de demostración.');
  if (values.length > max)
    throw new Error(
      `El máximo de este servicio es ${max} empresas por análisis.`,
    );
  return values;
}

export function filterRows(rows: Company[], filters: Filters): Company[] {
  return rows
    .filter(
      (r) =>
        (filters.market === 'all' || r.market === filters.market) &&
        (filters.status === 'all' || r.status === filters.status) &&
        (filters.minUpside === null ||
          r.median.upside === null ||
          r.median.upside >= filters.minUpside),
    )
    .sort((a, b) =>
      a.median.upside === null
        ? b.median.upside === null
          ? 0
          : 1
        : b.median.upside === null
          ? -1
          : b.median.upside - a.median.upside,
    );
}

export function summary(rows: Company[]) {
  const values = rows
    .map((r) => r.median.upside)
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return {
    count: rows.length,
    medianUpside: values.length
      ? values.length % 2
        ? values[middle]!
        : (values[middle - 1]! + values[middle]!) / 2
      : null,
    above15: values.filter((v) => v > 0.15).length,
    ok: rows.filter((r) => r.status === 'OK').length,
  };
}

export function formatNumber(
  value: number | null | undefined,
  digits = 2,
): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat('es-MX', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(value);
}
export function formatPercent(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat('es-MX', {
        style: 'percent',
        maximumFractionDigits: 2,
        signDisplay: 'exceptZero',
      }).format(value);
}
export function formatMoney(
  value: number | null | undefined,
  currency: string | null,
): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : `${formatNumber(value)}${currency ? ` ${currency}` : ' · moneda no disponible'}`;
}
export function formatDate(value: string | null | undefined): string {
  if (!value) return 'No disponible';
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime())
    ? 'No disponible'
    : new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(fecha);
}
export const terminal = (state: Job['state']) =>
  ['completed', 'cancelled', 'failed'].includes(state);

export type ViewState = {
  generation: number;
  pending: boolean;
  current: Snapshot | null;
  previous: Snapshot | null;
  selectedTicker: string | null;
  message: string | null;
};
export type ViewAction =
  | { type: 'begin'; generation: number }
  | { type: 'clear'; generation: number }
  | { type: 'job'; generation: number; job: Job }
  | {
      type: 'rows';
      generation: number;
      id: string;
      after: number;
      items: Company[];
    }
  | { type: 'error'; generation: number; message: string }
  | { type: 'select'; ticker: string };
export const initialView: ViewState = {
  generation: 0,
  pending: false,
  current: null,
  previous: null,
  selectedTicker: null,
  message: null,
};

export function viewReducer(state: ViewState, action: ViewAction): ViewState {
  if (action.type === 'select')
    return { ...state, selectedTicker: action.ticker };
  if (action.type === 'clear')
    return { ...initialView, generation: action.generation };
  if (action.type === 'begin')
    return {
      ...initialView,
      generation: action.generation,
      pending: true,
      previous: state.current ?? state.previous,
    };
  if (action.generation !== state.generation) return state;
  if (action.type === 'error')
    return { ...state, pending: false, message: action.message };
  if (action.type === 'job') {
    if (
      state.current &&
      (state.current.job.id !== action.job.id ||
        state.current.job.revision > action.job.revision)
    )
      return state;
    return {
      ...state,
      pending: false,
      current: { job: action.job, rows: state.current?.rows ?? [] },
      message: null,
    };
  }
  if (
    !state.current ||
    state.current.job.id !== action.id ||
    action.after !== state.current.rows.length
  )
    return state;
  const rows = [...state.current.rows, ...action.items];
  const selectedTicker = rows.some((r) => r.ticker === state.selectedTicker)
    ? state.selectedTicker
    : (rows[0]?.ticker ?? null);
  return { ...state, current: { ...state.current, rows }, selectedTicker };
}
