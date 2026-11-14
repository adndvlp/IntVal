import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditAssets } from './asset-budget.mjs';

test('cuenta imports estáticos/renderer, separa import dinámico y rechaza un presupuesto excedido', async () => {
  const root = await mkdtemp(join(tmpdir(), 'intval-budget-'));
  try {
    await mkdir(join(root, '_astro'));
    await writeFile(
      join(root, 'index.html'),
      '<link rel="stylesheet" href="/_astro/site.css"><script type="module" src="/_astro/main.js"></script>',
    );
    await writeFile(
      join(root, '_astro/main.js'),
      'import "./shared.js"; export async function chart(){return import(`./Charts.js`)}',
    );
    await writeFile(join(root, '_astro/shared.js'), 'export const shared=1;');
    await writeFile(join(root, '_astro/Charts.js'), 'export const chart=1;');
    await writeFile(join(root, '_astro/site.css'), 'body{color:black}');
    const result = await auditAssets(root, [
      { path: 'index.html', jsKiB: 50, cssKiB: 50 },
    ]);
    assert.deepEqual(result.pages[0].initialJsFiles.sort(), [
      '_astro/main.js',
      '_astro/shared.js',
    ]);
    assert.deepEqual(result.pages[0].deferredJsFiles, ['_astro/Charts.js']);
    assert.ok(result.pages[0].jsGzipBytes > 0);
    await assert.rejects(
      auditAssets(root, [{ path: 'index.html', jsKiB: 0, cssKiB: 50 }]),
      /presupuesto.*JS/,
    );
    await writeFile(join(root, '_astro/shared.js'), 'import "./missing.js";');
    await assert.rejects(
      auditAssets(root, [{ path: 'index.html', jsKiB: 50, cssKiB: 50 }]),
      /ENOENT/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('descubre la isla Astro inicial y su renderer sin contar dos veces dependencias', async () => {
  const root = await mkdtemp(join(tmpdir(), 'intval-island-'));
  try {
    await mkdir(join(root, '_astro'));
    await writeFile(
      join(root, 'index.html'),
      '<astro-island component-url="/_astro/main.js" renderer-url="/_astro/renderer.js" client="load"></astro-island>',
    );
    await writeFile(join(root, '_astro/main.js'), 'import "./shared.js";');
    await writeFile(join(root, '_astro/renderer.js'), 'import "./shared.js";');
    await writeFile(join(root, '_astro/shared.js'), 'export const shared=1;');
    const {
      pages: [page],
    } = await auditAssets(root, [
      { path: 'index.html', jsKiB: 300, cssKiB: 50 },
    ]);
    assert.equal(page.initialJsFiles.length, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
