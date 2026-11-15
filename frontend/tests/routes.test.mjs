import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { getByRole } from '@testing-library/dom';
import { gzipSync } from 'node:zlib';

async function pagina(ruta) {
  return new JSDOM(
    await readFile(new URL(`../dist/${ruta}`, import.meta.url), 'utf8'),
  ).window.document;
}

test('404 ofrece una salida real y las rutas de análisis mantienen noindex', async () => {
  const error = await pagina('404.html');
  assert.match(
    getByRole(error.body, 'heading', { level: 1 }).textContent,
    /página/i,
  );
  assert.equal(
    getByRole(error.body, 'link', { name: 'Volver al inicio' }).getAttribute(
      'href',
    ),
    '/',
  );
  for (const ruta of ['index.html', 'app/index.html']) {
    const doc = await pagina(ruta);
    assert.equal(
      doc.querySelector('meta[name="robots"]').content,
      'noindex, follow',
    );
  }
});

test('los enlaces visibles del build apuntan a rutas y anclas existentes', async () => {
  for (const ruta of [
    'index.html',
    'metodologia/index.html',
    'app/index.html',
    '404.html',
  ]) {
    const doc = await pagina(ruta);
    for (const a of doc.querySelectorAll('a[href]:not([hidden])')) {
      const href = a.getAttribute('href');
      if (href.startsWith('#')) {
        assert.ok(doc.getElementById(href.slice(1)), `${ruta}: ${href}`);
        continue;
      }
      if (!href.startsWith('/')) continue;
      const url = new URL(href, 'https://example.test');
      const archivo = url.pathname.endsWith('/')
        ? `${url.pathname}index.html`
        : url.pathname;
      const destino = await pagina(archivo.slice(1));
      if (url.hash) assert.ok(destino.getElementById(url.hash.slice(1)), href);
    }
    assert.ok(doc.querySelector('link[rel="icon"]'));
    assert.ok(doc.querySelector('meta[property="og:title"]'));
    assert.equal(
      doc.querySelector('link[rel="canonical"]'),
      null,
      'No inventar dominio',
    );
    for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
      const bytes = await readFile(
        new URL(`../dist${link.getAttribute('href')}`, import.meta.url),
      );
      assert.ok(gzipSync(bytes).length <= 50 * 1024, 'CSS inicial > 50 KiB');
    }
  }
});
