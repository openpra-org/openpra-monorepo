import tseslint from 'typescript-eslint';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createTsCanaryConfig } from '../../tools/eslint/flat/presets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const relDir = path.relative(process.cwd(), __dirname) || '.';

export default tseslint.config(
  ...createTsCanaryConfig({
    tseslint,
    tsdoc: tsdocPlugin,
    tsconfigRootDir: __dirname,
    // Use the existing tsconfig; no tsconfig.eslint.json in this package
    projectTsconfigs: ['./tsconfig.json']
  }),
  // Local ratchet: promote high-signal rules in source only
  {
    files: [`${relDir}/src/**/*.{ts,tsx}`],
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
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false
        }
      ],
      '@typescript-eslint/unbound-method': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      'tsdoc/syntax': 'error'
    }
  },
  // Tests: keep canary non-blocking while ratcheting source
  {
    files: [
      `${relDir}/src/**/*.spec.ts`,
      `${relDir}/src/**/*.spec.tsx`,
      `${relDir}/src/**/*.test.ts`,
      `${relDir}/src/**/*.e2e.ts`
    ],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/unbound-method': 'off',
      'tsdoc/syntax': 'off'
    }
  }
);
