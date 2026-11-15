import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { getByRole, getAllByRole, queryByRole } from '@testing-library/dom';

for (const path of ['index.html', 'app/index.html']) {
  test(`${path} abre directamente el analizador con el shell Liquid Glass`, async () => {
    const html = await readFile(
      new URL('../dist/' + path, import.meta.url),
      'utf8',
    );
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    try {
      assert.equal(doc.documentElement.lang, 'es');
      assert.equal(
        getByRole(doc.body, 'heading', { level: 1 }).textContent.trim(),
        'Elige las empresas',
      );
      assert.equal(doc.querySelectorAll('main').length, 1);
      assert.equal(doc.querySelectorAll('astro-island').length, 1);
      assert.ok(doc.querySelector('.app-sidebar'));
      assert.ok(doc.querySelector('.liquid-scene[aria-hidden="true"]'));
      assert.equal(
        doc.querySelector('.hero, .hero-demo, [data-demo-figure]'),
        null,
      );
      assert.ok(getByRole(doc.body, 'navigation', { name: 'Principal' }));
      assert.ok(getByRole(doc.body, 'link', { name: 'Saltar al contenido' }));
      assert.ok(
        getByRole(doc.body, 'link', { name: 'Cómo se calcula', exact: true }),
      );
      assert.ok(
        doc
          .querySelector('noscript')
          ?.textContent.includes('Activa JavaScript para analizar'),
      );
      assert.equal(
        doc.querySelector('meta[name="color-scheme"]').content,
        'light dark',
      );
      assert.equal(
        doc.querySelector('meta[name="robots"]').content,
        'noindex, follow',
      );
      const appearance = getByRole(doc.body, 'complementary', {
        name: 'Apariencia',
      });
      assert.ok(getByRole(appearance, 'button', { name: 'Modo oscuro' }));
      doc.querySelector('#palette-switcher').open = true;
      assert.equal(getAllByRole(appearance, 'radio').length, 7);
      assert.ok(doc.querySelector('input[type="color"]'));
      assert.equal(
        queryByRole(doc.body, 'button', { name: 'Explorar la demo' }),
        null,
      );
    } finally {
      dom.window.close();
    }
  });
}

test('Cómo se calcula mantiene sus cinco apartados visibles sin depender de JavaScript', async () => {
  const html = await readFile(
    new URL('../dist/metodologia/index.html', import.meta.url),
    'utf8',
  );
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  try {
    const article = doc.querySelector('.methodology-page');
    assert.match(
      getByRole(doc.body, 'heading', { level: 1 }).textContent,
      /Cómo se calcula/,
    );
    assert.equal(article.querySelectorAll('details, summary').length, 0);
    for (const name of [
      'Qué representa la estimación central',
      'Qué puedes ajustar',
      'Cómo interpretar la diferencia con el precio',
      'Monedas y empresas sin datos suficientes',
      'De dónde sale el ejemplo',
    ])
      assert.ok(getByRole(article, 'heading', { level: 2, name, exact: true }));
    assert.match(article.textContent, /mediana/);
    assert.match(article.textContent, /demo-1.0/);
    assert.ok(
      doc.querySelector(
        'a[href="https://github.com/adndvlp/IntVal/blob/main/docs/methodology.md"]',
      ),
    );
  } finally {
    dom.window.close();
  }
});
