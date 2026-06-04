import tseslint from 'typescript-eslint';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import { createTsCanaryConfig } from '../../../tools/eslint/flat/presets.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default tseslint.config(...createTsCanaryConfig({
    tseslint,
    tsdoc: tsdocPlugin,
    tsconfigRootDir: __dirname,
    projectTsconfigs: ['./tsconfig.json']
}), {
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
}, {
    files: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'src/**/*.test.ts', 'src/**/*.e2e.ts', 'tests/**/*.{ts,tsx}'],
    rules: {
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/no-unused-vars': [
            'warn',
            { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
        ],
        'tsdoc/syntax': 'off'
    }
});
