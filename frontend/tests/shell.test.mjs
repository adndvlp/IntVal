import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { getByRole } from '@testing-library/dom';

for (const [ruta, archivo] of [
  ['/', 'index.html'],
  ['/app/', 'app/index.html'],
]) {
  test(`el HTML estático de ${ruta} tiene contenido y navegación sin JavaScript`, async () => {
    const html = await readFile(
      new URL(`../dist/${archivo}`, import.meta.url),
      'utf8',
    );
    const { document } = new JSDOM(html).window;
    assert.equal(document.documentElement.lang, 'es');
    assert.ok(document.title.includes('IntVal'));
    assert.equal(document.querySelectorAll('main').length, 1);
    assert.equal(document.querySelectorAll('h1').length, 1);
    const nav = getByRole(document.body, 'navigation', { name: 'Principal' });
    assert.equal(
      nav.querySelector('[aria-current="page"]').getAttribute('href'),
      ruta,
    );
    const salto = getByRole(document.body, 'link', {
      name: 'Saltar al contenido',
    });
    assert.equal(
      document.querySelector(salto.getAttribute('href')).tagName,
      'H1',
    );
    assert.equal(
      document
        .querySelector(salto.getAttribute('href'))
        .getAttribute('tabindex'),
      '-1',
    );
    assert.equal(
      getByRole(document.body, 'link', { name: 'Aplicación' }).getAttribute(
        'href',
      ),
      '/app/',
    );
  });
}
