import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { getByRole, getAllByRole } from '@testing-library/dom';
import { gzipSync } from 'node:zlib';

async function pagina(ruta) {
  const html = await readFile(
    new URL(`../dist/${ruta}`, import.meta.url),
    'utf8',
  );
  return new JSDOM(html).window.document;
}

test('la landing entrega su narrativa, CTA y ejemplo en el HTML inicial', async () => {
  const doc = await pagina('index.html');
  assert.match(
    getByRole(doc.body, 'heading', { level: 1 }).textContent,
    /precio.*perspectiva/s,
  );
  for (const id of [
    'demostracion',
    'como-funciona',
    'capacidades',
    'metodologia',
    'proyecto',
  ]) {
    assert.ok(doc.getElementById(id), id);
  }
  assert.ok(
    getAllByRole(doc.body, 'link', { name: /Explorar la demo/ }).every(
      (a) => a.getAttribute('href') === '/app/?fuente=demo',
    ),
  );
  assert.ok(
    getAllByRole(doc.body, 'link', { name: /Analizar empresas/ }).every(
      (a) => a.getAttribute('href') === '/app/?fuente=market',
    ),
  );
  assert.match(doc.body.textContent, /en preparación/);
  const figura = doc.querySelector('[data-demo-figure]');
  assert.match(figura.textContent, /Datos sintéticos/);
  assert.match(figura.textContent, /2025-01-03/);
  const tabla = getByRole(figura, 'table', {
    name: 'Comparación en USD por acción',
  });
  for (const importe of ['100.00', '112.02', '117.87', '114.51', '116.19'])
    assert.match(tabla.textContent, new RegExp(importe.replace('.', '\\.')));
  assert.match(figura.textContent, /16.2/);
  assert.match(figura.textContent, /No es rentabilidad/);
  assert.equal(doc.querySelectorAll('astro-island').length, 0);
  assert.equal(doc.querySelectorAll('script[src]').length, 0);
});

test('metodología y 404 son páginas completas y enlazan destinos reales', async () => {
  const doc = await pagina('metodologia/index.html');
  assert.equal(doc.documentElement.lang, 'es');
  assert.match(doc.title, /Metodología/);
  assert.match(doc.body.textContent, /proxies-1.0/);
  assert.match(doc.body.textContent, /FCFF|FCFE/);
  assert.match(doc.body.textContent, /reinversión/);
  assert.match(doc.body.textContent, /mediana/i);
  assert.match(doc.body.textContent, /financieras/);
  assert.ok(
    doc.querySelector(
      'a[href="https://github.com/adndvlp/IntVal/blob/main/docs/methodology.md"]',
    ),
  );
  const error = await pagina('404.html');
  assert.match(
    getByRole(error.body, 'heading', { level: 1 }).textContent,
    /página/i,
  );
  assert.ok(getByRole(error.body, 'link', { name: 'Volver al inicio' }));
  const app = await pagina('app/index.html');
  assert.equal(
    app.querySelector('meta[name="robots"]').content,
    'noindex, follow',
  );
});

test('rutas internas, anclas y presupuesto inicial de la landing', async () => {
  for (const ruta of [
    'index.html',
    'metodologia/index.html',
    'app/index.html',
    '404.html',
  ]) {
    const doc = await pagina(ruta);
    for (const a of doc.querySelectorAll('a[href]')) {
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
  }
  const doc = await pagina('index.html');
  for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
    const bytes = await readFile(
      new URL(`../dist${link.getAttribute('href')}`, import.meta.url),
    );
    assert.ok(gzipSync(bytes).length <= 50 * 1024, 'CSS inicial > 50 KiB');
  }
  assert.ok(doc.querySelector('link[rel="icon"]'));
  assert.ok(doc.querySelector('meta[property="og:title"]'));
  assert.equal(
    doc.querySelector('link[rel="canonical"]'),
    null,
    'No inventar dominio',
  );
});
