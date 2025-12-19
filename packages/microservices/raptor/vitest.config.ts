import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'scram-node': path.resolve(__dirname, './test/mocks/scram-node.ts'),
    },
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts', '**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.js'],
      exclude: [
        '**/*.spec.ts',
        '**/*.test.ts',
        'src/main.ts',
        'src/**/*.module.ts',
      ],
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
