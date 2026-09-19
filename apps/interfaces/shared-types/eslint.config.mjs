import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const relDir = path.relative(process.cwd(), __dirname).split(path.sep).join('/') || '.';
const dirPattern = relDir === '.' ? '' : `${relDir}/`;

export default tseslint.config(
    {
        ignores: ['**/coverage/**', '**/dist/**', '**/node_modules/**', '**/*.d.ts']
    },
    {
        files: [`${dirPattern}**/*.{ts,tsx}`],
        plugins: { '@typescript-eslint': tseslint.plugin },
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: ['./tsconfig.eslint.json'],
                tsconfigRootDir: __dirname
            }
        },
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
    }
);
