import { configurationFields } from './model';
import type { CreateRequest, Job, Source } from './types';
export type HistoryEntry = {
  id: string;
  source: Source;
  dataset: string;
  createdAt: string;
  state: Job['state'];
  revision: number;
  total: number;
  labels: string[];
  request?: CreateRequest;
  expired?: boolean;
};
export const historyKey = (api: string) => `intval.history.v1:${api}`;
export const requestIdentity = (r: CreateRequest) =>
  JSON.stringify([
    r.source,
    [...new Set(r.tickers)].sort(),
    configurationFields.map((f) => r.configuration?.[f.key]),
  ]);
export function validRequest(v: unknown): v is CreateRequest {
  if (!v || typeof v !== 'object') return false;
  const r = v as CreateRequest;
  return (
    ['demo', 'market'].includes(r.source) &&
    typeof r.client_request_id === 'string' &&
    Array.isArray(r.tickers) &&
    r.tickers.every(
      (t) =>
        typeof t === 'string' &&
        /^[A-Z0-9][A-Z0-9&.-]{0,31}$/.test(t) &&
        !t.includes('..'),
    ) &&
    !!r.configuration &&
    configurationFields.every((f) => Number.isFinite(r.configuration?.[f.key]))
  );
}
export function readHistory(key: string): HistoryEntry[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (v?.version !== 1 || !Array.isArray(v.items)) return [];
    const seen = new Set<string>();
    return v.items.slice(0, 2048).filter((e: HistoryEntry) => {
      if (
        !e ||
        typeof e.id !== 'string' ||
        !e.id ||
        seen.has(e.id) ||
        !['demo', 'market'].includes(e.source) ||
        typeof e.dataset !== 'string' ||
        !Number.isFinite(Date.parse(e.createdAt)) ||
        ![
          'queued',
          'running',
          'cancelling',
          'completed',
          'cancelled',
          'failed',
        ].includes(e.state) ||
        !Number.isInteger(e.revision) ||
        !Number.isInteger(e.total) ||
        e.total < 1 ||
        !Array.isArray(e.labels) ||
        !e.labels.every((t) => typeof t === 'string') ||
        (e.request !== undefined &&
          (!validRequest(e.request) || e.request.source !== e.source))
      )
        return false;
      seen.add(e.id);
      return true;
    });
  } catch {
    return [];
  }
}
export function saveHistory(key: string, entries: HistoryEntry[]) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ version: 1, items: entries }));
  } catch {
    /* Referencias disponibles en memoria durante la visita. */
  }
}
export function mergeHistory(
  previous: HistoryEntry[],
  job: Job,
  max: number,
  request?: CreateRequest,
  labels?: string[],
): HistoryEntry[] {
  const old = previous.find((e) => e.id === job.id);
  if (old && old.revision > job.revision) return previous;
  const entry: HistoryEntry = {
    id: job.id,
    source: job.source,
    dataset: job.dataset_version,
    createdAt: job.created_at,
    state: job.state,
    revision: job.revision,
    total: job.total,
    labels:
      labels?.slice(0, 3) ?? old?.labels ?? request?.tickers.slice(0, 3) ?? [],
    request: request ?? old?.request,
  };
  if (JSON.stringify(entry) === JSON.stringify(old) && previous.length <= max)
    return previous;
  return [entry, ...previous.filter((e) => e.id !== job.id)]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, Math.max(1, max));
}
