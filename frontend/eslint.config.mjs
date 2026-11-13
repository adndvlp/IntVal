import js from '@eslint/js';
import ts from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'src/lib/generated/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['**/*.astro'],
    languageOptions: {
      parserOptions: { parser: ts.parser, extraFileExtensions: ['.astro'] },
    },
  },
  {
    files: ['**/*.mjs', '**/*.ts'],
    languageOptions: {
      globals: {
        process: 'readonly',
        URL: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        fetch: 'readonly',
      },
    },
  },
];
