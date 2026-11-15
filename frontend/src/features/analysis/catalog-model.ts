import type { Catalog } from './types';

export type CatalogEntry = Catalog['items'][number];
export const catalogPageSize = 25;
export const foldSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .trim();

export function indexCatalog(items: CatalogEntry[]) {
  const byTicker = new Map<string, CatalogEntry>();
  const search = new Map<string, string>();
  for (const item of items) {
    const ticker = item.ticker.trim().toUpperCase();
    if (byTicker.has(ticker)) continue;
    const entry = { ...item, ticker };
    byTicker.set(ticker, entry);
    search.set(ticker, foldSearch(`${entry.name ?? ''} ${ticker}`));
  }
  return { items: [...byTicker.values()], byTicker, search };
}
export type CatalogIndex = ReturnType<typeof indexCatalog>;
export function cleanSelection(
  values: string[],
  index: CatalogIndex,
): string[] {
  return [...new Set(values.map((t) => t.trim().toUpperCase()))].filter((t) =>
    index.byTicker.has(t),
  );
}
export const selectionKey = (
  baseUrl: string,
  source: string,
  dataset: string,
) => `intval.selection.v1:${baseUrl}:${source}:${dataset}`;

type SavedSelection = { selected: string[]; extras: string };
export function readSelection(key: string): SavedSelection | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (
      v?.version !== 1 ||
      !Array.isArray(v.selected) ||
      !v.selected.every((t: unknown) => typeof t === 'string') ||
      typeof v.extras !== 'string'
    )
      return null;
    return { selected: v.selected, extras: v.extras };
  } catch {
    return null;
  }
}
export function saveSelection(key: string, value: SavedSelection) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ version: 1, ...value }));
  } catch {
    /* La selección sigue disponible durante la visita. */
  }
}

export type CatalogView = 'catalog' | 'selected';
export type CatalogContext = {
  search: string;
  market: 'all' | 'USA' | 'MX';
  page: number;
};
export type CatalogViews = {
  view: CatalogView;
  contexts: Record<CatalogView, CatalogContext>;
};
export function readCatalogViews(key: string): CatalogViews | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    const validContext = (c: CatalogContext | undefined) =>
      c &&
      typeof c.search === 'string' &&
      ['all', 'USA', 'MX'].includes(c.market) &&
      Number.isInteger(c.page) &&
      c.page >= 0;
    return v?.version === 1 &&
      ['catalog', 'selected'].includes(v.view) &&
      validContext(v.contexts?.catalog) &&
      validContext(v.contexts?.selected)
      ? v
      : null;
  } catch {
    return null;
  }
}
export function saveCatalogViews(key: string, value: CatalogViews) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ version: 1, ...value }));
  } catch {
    /* Los filtros siguen funcionando sin almacenamiento. */
  }
}
