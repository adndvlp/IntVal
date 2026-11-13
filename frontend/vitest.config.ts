import { getViteConfig } from 'astro/config';
import type { ViteUserConfig } from 'vitest/config';

const config: ViteUserConfig = {
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/api.ts', 'src/components/**/*.tsx'],
      exclude: ['**/*.test.*'],
      reporter: ['text', 'lcov'],
      thresholds: { statements: 85, branches: 85, functions: 85, lines: 85 },
    },
  },
};

export default getViteConfig(config);
