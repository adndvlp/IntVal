import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  testIgnore: process.env.F10_VISUAL ? undefined : '**/visual.spec.ts',
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4321',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        channel: process.env.PLAYWRIGHT_CHANNEL,
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'mobile',
      use: {
        channel: process.env.PLAYWRIGHT_CHANNEL,
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'firefox-desktop',
      use: {
        browserName: 'firefox',
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'firefox-mobile',
      use: {
        browserName: 'firefox',
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'webkit-desktop',
      use: { browserName: 'webkit', viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'webkit-mobile',
      use: { browserName: 'webkit', viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: [
    {
      command:
        '.venv/bin/python -m uvicorn valoracion.web.aplicacion:create_app --factory --host 127.0.0.1 --port 8766',
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      url: 'http://127.0.0.1:8766/healthz',
      env: {
        VALORACION_DEMO: '1',
        VALORACION_MARKET_ENABLED: '0',
        VALORACION_CORS_ORIGINS: 'http://127.0.0.1:4321',
      },
      reuseExistingServer: false,
    },
    {
      command: 'node scripts/smoke-server.mjs',
      url: 'http://127.0.0.1:4321',
      reuseExistingServer: false,
    },
  ],
});
