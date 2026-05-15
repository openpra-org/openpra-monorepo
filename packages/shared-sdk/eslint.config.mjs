import tseslint from 'typescript-eslint';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createTsCanaryConfig } from '../../tools/eslint/flat/presets.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const relDir = path.relative(process.cwd(), __dirname) || '.';
export default tseslint.config(...createTsCanaryConfig({
    tseslint,
    tsdoc: tsdocPlugin,
    tsconfigRootDir: __dirname,
    projectTsconfigs: ['./tsconfig.eslint.json']
}), {
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
        '@typescript-eslint/no-misused-promises': [
            'error',
            {
                checksVoidReturn: false
            }
        ],
        '@typescript-eslint/unbound-method': 'error',
        'tsdoc/syntax': 'error'
    }
}, {
    files: [
        `${relDir}/src/**/*.spec.ts`,
        `${relDir}/src/**/*.spec.tsx`,
        `${relDir}/src/**/*.test.ts`,
        `${relDir}/src/**/*.e2e.ts`
    ],
    rules: {
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'tsdoc/syntax': 'off'
    }
});
