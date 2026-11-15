import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import {
  indexCatalog,
  cleanSelection,
  selectionKey,
  readSelection,
  saveSelection,
} from './catalog-model';
import { catalog } from './test-fixtures';
beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

it('restaura sólo símbolos conocidos, canónicos y sin duplicados; conserva un vacío intencional', () => {
  const index = indexCatalog(catalog().items);
  const key = selectionKey('', 'demo', 'demo-1.0');
  saveSelection(key, {
    selected: ['demo-usa', 'DEMO-USA', 'DESCONOCIDO'],
    extras: '',
  });
  expect(cleanSelection(readSelection(key)!.selected, index)).toEqual([
    'DEMO-USA',
  ]);
  saveSelection(key, { selected: [], extras: '' });
  expect(readSelection(key)?.selected).toEqual([]);
  expect(selectionKey('', 'market', 'demo-1.0')).not.toBe(key);
  expect(selectionKey('/otra-api', 'demo', 'demo-1.0')).not.toBe(key);
  expect(selectionKey('', 'demo', 'demo-2.0')).not.toBe(key);
});
it('ignora versiones, contenido corrupto y tipos inválidos y tolera almacenamiento bloqueado', () => {
  for (const value of [
    '{',
    'null',
    '{"version":2}',
    '{"version":1,"selected":[3],"extras":""}',
  ]) {
    sessionStorage.setItem('test', value);
    expect(readSelection('test')).toBeNull();
  }
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(readSelection('test')).toBeNull();
  expect(() =>
    saveSelection('test', { selected: [], extras: '' }),
  ).not.toThrow();
});
