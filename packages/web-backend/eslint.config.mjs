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
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false
        }
      ],
      '@typescript-eslint/unbound-method': 'error',
      // Targeted restriction: prevent deep relative imports that typically cross modules.
      // Allow up to two levels; block 3+ levels upwards.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../../../*',
                '../../../../*',
                '../../../../../*',
                '../../../../../../*'
              ],
              message:
                'Avoid deep relative imports across modules. Use a public API (barrel) or a configured path alias.'
            }
          ]
        }
      ],
      'tsdoc/syntax': 'off'
    }
  },
  // Expanded ratchet: catch unhandled promises across all source
  {
    files: [`${relDir}/src/**/*.{ts,tsx}`],
    rules: {
      '@typescript-eslint/no-floating-promises': 'error'
    }
  },
  // Allow deep relative imports within schema directories (legitimate internal composition)
  {
    files: [`${relDir}/src/**/schemas/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': 'off'
    }
  },
  // Pilot: re-enable TSDoc warnings in a small area to drive incremental cleanup
  {
    files: [`${relDir}/src/auth/**/*.{ts,tsx}`],
    rules: {
      'tsdoc/syntax': 'warn'
    }
  },
  {
    files: [`${relDir}/src/collab/**/*.{ts,tsx}`],
    rules: {
      'tsdoc/syntax': 'warn'
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
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  }
);
