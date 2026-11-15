// Captura el producto real; sólo copia imágenes de documentación si el E2E pasa.
import { spawnSync } from 'node:child_process';
import { readdir, mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const result = spawnSync(
  process.execPath,
  [resolve('node_modules/@playwright/test/cli.js'), 'test'],
  { stdio: 'inherit', env: process.env },
);
if (result.status !== 0) process.exit(result.status ?? 1);
const files = await readdir('test-results', { recursive: true });
const destinos = {
  'entry-1440.png': '../docs/images/ui1-entry-desktop.png',
  'entry-390.png': '../docs/images/ui1-entry-mobile.png',
  'calculation-1440.png': '../docs/images/ui1-calculation.png',
};
for (const [nombre, destino] of Object.entries(destinos)) {
  const origen = files.find(
    (file) => file.endsWith('/' + nombre) && file.includes('desktop'),
  );
  if (!origen) throw new Error('No se encontró la captura: ' + nombre);
  await mkdir(dirname(destino), { recursive: true });
  await copyFile('test-results/' + origen, destino);
}
console.log('Capturas reales de UI-1 guardadas en docs/images.');
