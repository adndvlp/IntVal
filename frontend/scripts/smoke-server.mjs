// Playwright prueba el artefacto de producción con una API real e independiente.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const astroPackage = JSON.parse(
  readFileSync('node_modules/astro/package.json', 'utf8'),
);
const astro = resolve('node_modules/astro', astroPackage.bin.astro);
const env = { ...process.env, PUBLIC_API_BASE_URL: 'http://127.0.0.1:8766' };
const build = spawnSync(process.execPath, [astro, 'build'], {
  env,
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);
const child = spawn(
  process.execPath,
  [astro, 'preview', '--host', '127.0.0.1', '--port', '4321'],
  { env, stdio: 'inherit' },
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
