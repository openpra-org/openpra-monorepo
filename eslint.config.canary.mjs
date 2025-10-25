// Root ESLint Flat Config (canary draft)
//
// Purpose: Provide a workspace-level flat-config entry point for the ESLint 9 rollout,
// without affecting existing ESLint 8-based .eslintrc.json configs.
//
// Notes:
// - TypeScript, type-aware rules are configured per-package using
//   `tools/eslint/flat/presets.mjs` to avoid cross-package tsconfig issues.
// - This root config intentionally keeps only ignores for now. Packages opting into the
//   canary should maintain a local `eslint.config.mjs` that imports the shared preset.
// - When we convert the root fully, we can replace this with package-specific entries
//   (one per TS project) that call createTsCanaryConfig with the proper tsconfig paths.

/** @type {import('eslint').Linter.FlatConfig[]} */
const config = [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      // Nx cache and artifacts
      '.nx/**',
      '**/.turbo/**'
    ]
  }
];

export default config;
