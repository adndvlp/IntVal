// Audita el build real: imports estáticos, runtime Astro e islas iniciales.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

export async function auditAssets(root, budgets) {
  root = resolve(root);
  const data = new Map();
  const read = async (path) => {
    if (!data.has(path)) data.set(path, await readFile(resolve(root, path)));
    return data.get(path);
  };
  function local(ref, parent) {
    const url = new URL(ref, new URL(parent, 'https://assets.invalid/'));
    if (url.origin !== 'https://assets.invalid')
      throw new Error('Asset externo inesperado: ' + ref);
    return decodeURIComponent(url.pathname.slice(1));
  }
  function imports(code) {
    const result = { static: [], dynamic: [] };
    const tree = ts.createSourceFile(
      'asset.js',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    function visit(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        result.static.push(node.moduleSpecifier.text);
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteralLike(node.arguments[0])
      )
        result.dynamic.push(node.arguments[0].text);
      ts.forEachChild(node, visit);
    }
    visit(tree);
    return result;
  }
  const pages = [];
  for (const budget of budgets) {
    const html = (await read(budget.path)).toString();
    const doc = new JSDOM(html).window.document;
    const initial = new Set(),
      deferred = new Set(),
      pendingDynamic = new Set();
    async function walk(path, set) {
      if (set.has(path)) return;
      set.add(path);
      const parsed = imports((await read(path)).toString());
      for (const ref of parsed.static) await walk(local(ref, path), set);
      for (const ref of parsed.dynamic) pendingDynamic.add(local(ref, path));
    }
    let inlineJsGzipBytes = 0;
    for (const script of doc.querySelectorAll('script')) {
      if (script.type && !['module', 'text/javascript'].includes(script.type))
        continue;
      if (script.src)
        await walk(local(script.getAttribute('src'), budget.path), initial);
      else {
        inlineJsGzipBytes += gzipSync(script.textContent).length;
        const parsed = imports(script.textContent);
        for (const ref of parsed.static)
          await walk(local(ref, budget.path), initial);
        for (const ref of parsed.dynamic)
          pendingDynamic.add(local(ref, budget.path));
      }
    }
    for (const island of doc.querySelectorAll('astro-island[client="load"]'))
      for (const attr of ['component-url', 'renderer-url'])
        if (island.hasAttribute(attr))
          await walk(local(island.getAttribute(attr), budget.path), initial);
    for (const path of pendingDynamic)
      if (!initial.has(path)) await walk(path, deferred);
    for (const path of initial) deferred.delete(path);
    const styles = new Set(
      [...doc.querySelectorAll('link[rel="stylesheet"]')].map((e) =>
        local(e.getAttribute('href'), budget.path),
      ),
    );
    let cssGzipBytes = 0;
    for (const path of styles)
      cssGzipBytes += gzipSync(await read(path)).length;
    for (const style of doc.querySelectorAll('style'))
      cssGzipBytes += gzipSync(style.textContent).length;
    let jsGzipBytes = inlineJsGzipBytes;
    for (const path of initial)
      jsGzipBytes += gzipSync(await read(path)).length;
    if (jsGzipBytes > budget.jsKiB * 1024)
      throw new Error(
        `${budget.path}: presupuesto de JS excedido (${jsGzipBytes} bytes gzip)`,
      );
    if (cssGzipBytes > budget.cssKiB * 1024)
      throw new Error(
        `${budget.path}: presupuesto de CSS excedido (${cssGzipBytes} bytes gzip)`,
      );
    if (budget.noCharts && [...initial].some((p) => /Charts[.]/.test(p)))
      throw new Error(`${budget.path}: gráfica en el bundle inicial`);
    const images = [];
    for (const img of doc.querySelectorAll('img[src]')) {
      const path = local(img.getAttribute('src'), budget.path);
      const bytes = (await read(path)).length;
      if (!img.hasAttribute('width') || !img.hasAttribute('height'))
        throw new Error('Imagen sin dimensiones: ' + path);
      if (img.getAttribute('loading') !== 'lazy' && bytes > 200 * 1024)
        throw new Error('Imagen inicial supera 200 KiB: ' + path);
      images.push({
        path,
        bytes,
        lazy: img.getAttribute('loading') === 'lazy',
      });
    }
    pages.push({
      path: budget.path,
      jsGzipBytes,
      inlineJsGzipBytes,
      cssGzipBytes,
      initialJsFiles: [...initial],
      deferredJsFiles: [...deferred],
      images,
    });
    doc.defaultView.close();
  }
  return {
    schema: 'intval-assets-1',
    measurement:
      'Suma de cada recurso único comprimido con gzip; incluye inline y dependencias estáticas de islas client:load; no equivale a transferencia HTTP real.',
    pages,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const report = await auditAssets('dist', [
    { path: 'index.html', jsKiB: 50, cssKiB: 50, noCharts: true },
    { path: 'metodologia/index.html', jsKiB: 50, cssKiB: 50, noCharts: true },
    { path: 'app/index.html', jsKiB: 300, cssKiB: 50, noCharts: true },
  ]);
  await mkdir('test-results', { recursive: true });
  await writeFile(
    'test-results/asset-budget.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  for (const p of report.pages)
    console.log(
      `${p.path}: JS ${(p.jsGzipBytes / 1024).toFixed(2)} KiB gzip; CSS ${(p.cssGzipBytes / 1024).toFixed(2)} KiB gzip; ${p.deferredJsFiles.length} chunks diferidos`,
    );
}
