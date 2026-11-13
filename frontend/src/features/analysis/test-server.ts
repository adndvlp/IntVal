import { vi } from 'vitest';
import {
  catalog,
  company,
  financials,
  job,
  metadata,
  prices,
} from './test-fixtures';
import type { Job, Metadata } from './types';

export function server(
  options: {
    deferCreate?: boolean;
    deferPage?: boolean;
    createFails?: boolean;
    historyFails?: boolean;
    emptyHistory?: boolean;
    emptyMargins?: boolean;
    state?: Job['state'];
    lost?: boolean;
    meta?: Metadata;
  } = {},
) {
  let resolveCreate!: (v: Response) => void;
  let resolvePage!: (v: Response) => void;
  const created: string[] = [];
  const paths: string[] = [];
  let currentSource: 'demo' | 'market' = 'demo';
  function currentJob(
    revision = 3,
    state: Job['state'] = options.state ?? 'completed',
  ) {
    const value = job('trabajo', revision, state);
    return {
      ...value,
      source: currentSource,
      processed: 1,
      counts: { ...value.counts, OK: 1 },
      dataset_version: currentSource === 'demo' ? 'demo-1.0' : 'universe-2026',
    };
  }
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      paths.push(path);
      const response = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      if (path.endsWith('/meta')) return response(options.meta ?? metadata());
      if (path.includes('/catalog'))
        return response(
          catalog(path.includes('source=market') ? 'market' : 'demo'),
        );
      if (path.endsWith('/analyses')) {
        created.push(init?.body as string);
        currentSource = JSON.parse(init?.body as string).source;
        if (options.createFails) {
          options.createFails = false;
          throw new Error('red privada');
        }
        if (options.deferCreate)
          return new Promise<Response>((r) => {
            resolveCreate = r;
          });
        return response(currentJob());
      }
      if (path.endsWith('/cancel')) return response(currentJob(4, 'cancelled'));
      if (path.includes('/companies/')) {
        if (options.historyFails)
          return response(
            {
              error: {
                code: 'HISTORY_FAILED',
                message: 'secreto',
                retryable: false,
                fields: [],
              },
            },
            502,
          );
        const symbol = decodeURIComponent(
          path.split('/companies/')[1]!.split('/')[0]!,
        );
        if (path.includes('/prices'))
          return response({
            ...prices(),
            ticker: symbol,
            source: currentSource,
            availability: options.emptyHistory ? 'empty' : 'available',
            items: options.emptyHistory ? [] : prices().items,
          });
        return response({
          ...financials(),
          ticker: symbol,
          source: currentSource,
          availability: options.emptyHistory ? 'empty' : 'available',
          items: options.emptyHistory ? [] : financials().items,
          margins: {
            ...financials().margins,
            items: options.emptyMargins ? [] : financials().margins.items,
          },
        });
      }
      if (path.includes('/results')) {
        if (options.deferPage)
          return new Promise<Response>((r) => {
            resolvePage = r;
          });
        return response({
          id: 'trabajo',
          items: [company()],
          next_cursor: 1,
          processed: 1,
          total: 1,
          done: true,
          revision: 3,
        });
      }
      if (options.lost)
        return response(
          {
            error: {
              code: 'ANALYSIS_EXPIRED',
              message: 'privado',
              retryable: false,
              fields: [],
            },
          },
          410,
        );
      return response(currentJob());
    },
  );
  vi.stubGlobal('fetch', fetcher);
  return {
    fetcher,
    created,
    paths,
    options,
    finishCreate: () =>
      resolveCreate(new Response(JSON.stringify(job('trabajo')))),
    finishPage: () =>
      resolvePage(
        new Response(
          JSON.stringify({
            id: 'trabajo',
            items: [company()],
            next_cursor: 1,
            processed: 1,
            total: 1,
            done: true,
            revision: 3,
          }),
        ),
      ),
  };
}
