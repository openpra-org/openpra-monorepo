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
  // Local ratchet: promote a few high-signal rules in this package only (source files)
  {
    files: [`${relDir}/src/**/*.{ts,tsx}`],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/require-await': 'error',
      // Enforce TSDoc in source outside technical-elements
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
  // MEF spec-heavy areas use JSDoc-style tags and inline braces; disable TSDoc syntax there to cut noise
  {
    files: [`${relDir}/src/lib/**/*.{ts,tsx}`],
    rules: {
      'tsdoc/syntax': 'off',
      // Reduce canary noise in spec-heavy area; we will ratchet per-subtree later
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-duplicate-type-constituents': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off'
    }
  },
  // Targeted ratchet: treat unused-vars as error for src/* except technical-elements subtree
  {
    files: [`${relDir}/src/**/*.{ts,tsx}`],
    ignores: [`${relDir}/src/lib/**/*`],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  },
  // Tests: keep canary non-blocking while we ratchet source
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
