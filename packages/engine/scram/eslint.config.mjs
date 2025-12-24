import tseslint from 'typescript-eslint';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import { createTsCanaryConfig } from '../../../tools/eslint/flat/presets.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  ...createTsCanaryConfig({
    tseslint,
    tsdoc: tsdocPlugin,
    tsconfigRootDir: __dirname,
    // This package is native-first; TS lives mostly in tests and type stubs.
    // Use root tsconfig as there may not be a dedicated tsconfig.eslint.json here.
    projectTsconfigs: ['./tsconfig.json']
  }),
  // Local ratchet: promote high-signal rules in source only
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/require-await': 'error',
      'tsdoc/syntax': 'error'
    }
  },
  // Tests: keep canary non-blocking while ratcheting source
  {
    files: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'src/**/*.test.ts', 'src/**/*.e2e.ts', 'tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      'tsdoc/syntax': 'off'
    }
  }
);
