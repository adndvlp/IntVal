import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import {
  historyKey,
  readHistory,
  saveHistory,
  mergeHistory,
  requestIdentity,
  validRequest,
} from './analysis-history';
import { job, config } from './test-fixtures';
import type { CreateRequest } from './types';
const request = (): CreateRequest => ({
  source: 'demo',
  client_request_id: crypto.randomUUID(),
  tickers: ['DEMO-USA', 'DEMO-MX.MX'],
  configuration: config(),
});
beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());
it('referencias acotadas por retención real, sin resultados financieros, con revisión monótona', () => {
  let entries = mergeHistory([], job('a', 1, 'running'), 2, request());
  entries = mergeHistory(entries, job('b', 2), 2, request());
  entries = mergeHistory(entries, job('c', 3), 2, request());
  expect(entries.map((e) => e.id)).toEqual(['c', 'b']);
  const same = mergeHistory(entries, job('c', 2), 2);
  expect(same).toBe(entries);
  saveHistory(historyKey(''), entries);
  expect(readHistory(historyKey(''))).toEqual(entries);
  expect(sessionStorage.getItem(historyKey(''))).not.toMatch(
    /market_price|audit_fields|proxies/,
  );
  expect(mergeHistory(entries, job('c', 3), 2)).toBe(entries);
});
it('la identidad distingue fuente y ajustes y no duplica la misma selección reordenada', () => {
  const a = request();
  expect(requestIdentity(a)).toBe(
    requestIdentity({ ...a, tickers: [...a.tickers].reverse() }),
  );
  expect(requestIdentity(a)).not.toBe(
    requestIdentity({ ...a, source: 'market' }),
  );
  expect(requestIdentity(a)).not.toBe(
    requestIdentity({
      ...a,
      configuration: { ...config(), tasa_descuento: 0.15 },
    }),
  );
  expect(validRequest({ ...a, tickers: ['../secret'] })).toBe(false);
  expect(validRequest({ ...a, configuration: {} })).toBe(false);
});
it('descarta referencias corruptas, duplicadas o con solicitud de otra fuente', () => {
  const entries = mergeHistory([], job('a'), 2, request());
  sessionStorage.setItem(
    'test',
    JSON.stringify({
      version: 1,
      items: [
        ...entries,
        ...entries,
        {
          ...entries[0],
          id: 'bad',
          request: { ...request(), source: 'market' },
        },
      ],
    }),
  );
  expect(readHistory('test')).toHaveLength(1);
  sessionStorage.setItem('test', '{');
  expect(readHistory('test')).toEqual([]);
  sessionStorage.setItem('test', '{"version":2}');
  expect(readHistory('test')).toEqual([]);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(readHistory('test')).toEqual([]);
  expect(() => saveHistory('test', entries)).not.toThrow();
});
