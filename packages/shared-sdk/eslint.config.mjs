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
    projectTsconfigs: ['./tsconfig.eslint.json']
  }),
  // Local ratchet: promote a few high-signal rules in this package only
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
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      // Start surfacing TSDoc issues without blocking
      'tsdoc/syntax': 'warn'
    }
  },
  // Test overrides: keep canary non-blocking in tests while we ratchet source
  {
    files: [
      `${relDir}/src/**/*.spec.ts`,
      `${relDir}/src/**/*.spec.tsx`,
      `${relDir}/src/**/*.test.ts`,
      `${relDir}/src/**/*.e2e.ts`
    ],
    rules: {
      '@typescript-eslint/require-await': 'off',
      // Turn off high-noise unsafe rules in tests to keep canary quiet
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Unuseds in tests are okay; allow them to avoid noise
      '@typescript-eslint/no-unused-vars': 'off'
    }
  }
);
