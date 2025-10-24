// Shared ESLint Flat Config presets for canary usage across packages.
// This module is dependency-free: callers must pass plugin instances.

/**
 * Create a TypeScript-aware flat config preset aligned with our canary defaults.
 *
 * @param {object} params
 * @param {*} params.tseslint The imported `typescript-eslint` module (provides parser, plugin, and configs)
 * @param {*} params.tsdoc The imported `eslint-plugin-tsdoc` plugin object
 * @param {Record<string, any>} [params.extraPlugins] Optional additional plugins to register
 * @param {string} params.tsconfigRootDir Absolute directory path where the tsconfig lives
 * @param {string[]} params.projectTsconfigs Relative paths to tsconfig files from tsconfigRootDir
 * @returns {import('eslint').Linter.FlatConfig[]}
 */
import path from 'node:path';

export function createTsCanaryConfig({ tseslint, tsdoc, tsconfigRootDir, projectTsconfigs, extraPlugins = {} }) {
  // Ensure file globs are scoped to the package directory even when ESLint CWD is the workspace root
  const relDir = path.relative(process.cwd(), tsconfigRootDir) || '.';
  // Avoid leading "./" in glob patterns, which can prevent matches in ESLint flat config
  const dirPattern = relDir === '.' ? '' : `${relDir}/`;
  return [
    // Register plugins globally so subsequent config items can reference their rules
    {
      linterOptions: {
        reportUnusedDisableDirectives: 'warn'
      },
      plugins: {
        '@typescript-eslint': tseslint.plugin,
        tsdoc,
        ...extraPlugins
      }
    },
    {
      ignores: ['**/dist/**', '**/coverage/**', '**/.nx/**', '**/node_modules/**', '**/*.d.ts']
    },
    {
      files: [`${dirPattern}**/*.{ts,tsx}`],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          // Use the TS project service to support monorepos and referenced projects
          projectService: true,
          project: projectTsconfigs,
          tsconfigRootDir,
          // Allow parsing of standalone config/test files not included in the project tsconfig(s)
          allowDefaultProject: true
        }
      },
      rules: {
        // Start lenient; we’ll promote over time during rollout
        'tsdoc/syntax': 'off',

        // Strict type rules temporarily relaxed for canary
        '@typescript-eslint/no-redundant-type-constituents': 'warn',
        '@typescript-eslint/no-duplicate-type-constituents': 'warn',
        '@typescript-eslint/no-unsafe-function-type': 'warn',
        '@typescript-eslint/no-empty-object-type': 'warn',
        '@typescript-eslint/no-base-to-string': 'warn',
        '@typescript-eslint/no-unsafe-enum-comparison': 'warn',

    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/no-unsafe-argument': 'warn',
        '@typescript-eslint/no-unsafe-return': 'warn',
        '@typescript-eslint/no-unsafe-call': 'warn',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
        '@typescript-eslint/restrict-template-expressions': 'warn',
        '@typescript-eslint/require-await': 'warn',
        '@typescript-eslint/unbound-method': 'warn',
        // Be lenient on common JS interop during rollout
        '@typescript-eslint/no-require-imports': 'warn',
        // Allow common expression patterns used in React code
        '@typescript-eslint/no-unused-expressions': [
          'warn',
          { allowShortCircuit: true, allowTernary: true }
        ],

        // Allow the leading-underscore convention for intentionally unused values
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
        ]
      }
    },
    // Treat common tooling config files as untyped to avoid TS project resolution errors
    {
      files: [
        `${dirPattern}*.{config,conf}.{ts,js}`,
        `${dirPattern}**/jest.config.ts`,
        `${dirPattern}**/cypress.config.ts`,
        `${dirPattern}**/playwright.config.ts`,
        `${dirPattern}**/webpack.config.{ts,js}`
      ],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          // Explicitly disable project service for these files so they lint without type info
          projectService: false,
          project: false,
          tsconfigRootDir
        }
      },
      rules: {
        '@typescript-eslint/no-redundant-type-constituents': 'off',
        '@typescript-eslint/no-duplicate-type-constituents': 'off',
        '@typescript-eslint/no-base-to-string': 'off',
        '@typescript-eslint/no-empty-object-type': 'off',
        '@typescript-eslint/no-unsafe-function-type': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/restrict-template-expressions': 'off',
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/no-unsafe-enum-comparison': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
        '@typescript-eslint/require-await': 'off'
      }
    },
    // Test/e2e overrides: relax rules that are typically noisy in tests
    {
      files: [
        `${dirPattern}**/*.spec.ts`,
        `${dirPattern}**/*.spec.tsx`,
        `${dirPattern}**/*.e2e.ts`,
        `${dirPattern}**/*.e2e.tsx`
      ],
      rules: {
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/no-unsafe-call': 'warn',
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/no-unsafe-argument': 'warn',
        '@typescript-eslint/no-unsafe-return': 'warn'
      }
    }
  ];
}
