import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { getByRole } from '@testing-library/dom';

for (const archivo of ['index.html', 'app/index.html']) {
  test(`el shell de ${archivo} conserva navegación y alternativas sin JavaScript`, async () => {
    const html = await readFile(
      new URL(`../dist/${archivo}`, import.meta.url),
      'utf8',
    );
    const { document } = new JSDOM(html).window;
    assert.equal(document.documentElement.lang, 'es');
    assert.ok(document.title.includes('IntVal'));
    const nav = getByRole(document.body, 'navigation', { name: 'Principal' });
    assert.equal(
      nav.querySelector('[aria-current="page"]').textContent.trim(),
      'Analizar',
    );
    assert.equal(
      nav.querySelector('[aria-current="page"]').getAttribute('href'),
      '#contenido',
    );
    const salto = getByRole(document.body, 'link', {
      name: 'Saltar al contenido',
    });
    const heading = document.querySelector(salto.getAttribute('href'));
    assert.equal(heading.tagName, 'H1');
    assert.equal(heading.getAttribute('tabindex'), '-1');
    assert.match(
      document.querySelector('noscript').textContent,
      /Activa JavaScript para analizar/,
    );
    assert.ok(document.querySelector('noscript a[href="/metodologia/"]'));
    assert.equal(nav.querySelector('[role="menu"]'), null);
  });
}
