import tseslint from 'typescript-eslint';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import importPlugin from 'eslint-plugin-import';
import securityPlugin from 'eslint-plugin-security';
import playwrightPlugin from 'eslint-plugin-playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createTsCanaryConfig } from '../../../tools/eslint/flat/presets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const relDir = path.relative(process.cwd(), __dirname) || '.';

export default tseslint.config(
  ...createTsCanaryConfig({
    tseslint,
    tsdoc: tsdocPlugin,
    tsconfigRootDir: __dirname,
    projectTsconfigs: ['./tsconfig.eslint.json'],
    extraPlugins: {
      import: importPlugin,
      security: securityPlugin,
      playwright: playwrightPlugin
    }
  }),
  // Local ratchet: promote high-signal rules in source only
  {
    files: ['src/**/*.{ts,tsx}'],
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
      'tsdoc/syntax': 'warn'
    }
  },
  // Targeted ratchet: components/headers only (safe, small scope)
  {
    files: [
      `${relDir}/src/app/components/headers/**/*.{ts,tsx}`,
      `${relDir}/src/app/components/cards/**/*.{ts,tsx}`,
      `${relDir}/src/app/components/forms/**/*.{ts,tsx}`,
      `${relDir}/src/app/theme/**/*.{ts,tsx}`,
      `${relDir}/src/app/pages/**/*.{ts,tsx}`,
      // Small zustand slices ratchet
      `${relDir}/src/app/zustand/ExternalHazards/**/*Actions.tsx`,
      `${relDir}/src/app/zustand/InternalEvents/**/*Actions.tsx`,
      `${relDir}/src/app/zustand/FullScope/**/*Actions.tsx`,
      `${relDir}/src/app/zustand/InternalHazards/**/*Actions.tsx`,
      `${relDir}/src/app/zustand/NestedModels/ActionHelpers/EventTreesActions.tsx`,
      `${relDir}/src/app/zustand/NestedModels/ActionHelpers/FaultTreesActions.tsx`
      ,`${relDir}/src/app/zustand/NestedModels/ActionHelpers/BayesianNetworksActions.tsx`
      ,`${relDir}/src/app/zustand/NestedModels/ActionHelpers/EventSequenceAnalysisActions.tsx`
      ,`${relDir}/src/app/zustand/NestedModels/ActionHelpers/EventSequenceDiagramsActions.tsx`
      ,`${relDir}/src/app/zustand/NestedModels/ActionHelpers/InitiatingEventsActions.tsx`
    ],
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
  // Tests: keep canary non-blocking while ratcheting source
  {
    files: [
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'tests/**/*.{ts,tsx}',
      'e2e/**/*.{ts,tsx}'
    ],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  }
);
