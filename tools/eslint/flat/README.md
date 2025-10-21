# ESLint 9 Flat-Config Canary

This folder contains the shared flat-config preset and guidance used to roll out ESLint 9 across the monorepo without impacting the baseline ESLint 8 setup.

## What is this?
- `presets.mjs` exports `createTsCanaryConfig({ tseslint, tsdoc, tsconfigRootDir, projectTsconfigs, extraPlugins })`.
- Each package opting into the canary creates a local `eslint.config.mjs` importing this preset.
- The preset applies TypeScript-aware rules only to `*.ts/tsx` files and uses the TS Project Service for monorepos.
- Common config files (e.g., `jest.config.ts`, `cypress.config.ts`, `playwright.config.ts`, `webpack.config.{ts,js}`) are linted without type info and with typed rules disabled to avoid parser errors.
- File globs are scoped to the package directory so workspace-root files don’t leak into package lint runs.
- The canary runs typed rules as warnings-first to avoid breakage while surfacing issues.

## Add a package to the canary (3 steps)
1) Add a local flat config:
   ```js
   // packages/<pkg>/eslint.config.mjs
   import tseslint from 'typescript-eslint';
   import tsdocPlugin from 'eslint-plugin-tsdoc';
   import { fileURLToPath } from 'node:url';
   import path from 'node:path';
   import { createTsCanaryConfig } from '../../tools/eslint/flat/presets.mjs';

   const __dirname = path.dirname(fileURLToPath(import.meta.url));

   export default tseslint.config(
     ...createTsCanaryConfig({
       tseslint,
       tsdoc: tsdocPlugin,
       tsconfigRootDir: __dirname,
       projectTsconfigs: ['./tsconfig.eslint.json', './tsconfig.json']
     })
   );
   ```
   - Use `./tsconfig.eslint.json` when present; fall back to `./tsconfig.json` if not.

2) Add local devDependencies and script:
   ```json
   {
     "devDependencies": {
       "eslint": "9.14.0",
       "typescript-eslint": "8.14.0",
       "eslint-plugin-tsdoc": "0.2.17"
     },
     "scripts": {
       "lint:canary": "eslint --config ./eslint.config.mjs \"src/**/*.{ts,tsx}\""
     }
   }
   ```

3) Add an Nx target:
   ```json
   {
     "lint-canary": {
       "executor": "nx:run-commands",
       "options": {
         "command": "pnpm --filter <pkg> run lint:canary",
         "cwd": "{workspaceRoot}"
       }
     }
   }
   ```

## Run the canary
- All onboarded packages: `pnpm -w run lint:canary:all`
- Single package: `pnpm --filter <pkg> run lint:canary`

### CI integration
- A non-blocking GitHub Actions job runs the canary on PRs: `.github/workflows/lint-canary.yml`.
- It invokes `pnpm -w run lint:canary:all` and uploads the output as an artifact (`lint-canary.txt`).
- This won’t fail the PR; we can ratchet to blocking once we’re ready.

## Defaults and conventions
- `.d.ts` files are ignored to avoid TS project noise.
- Strict type rules (e.g., `no-redundant-type-constituents`, `no-unsafe-enum-comparison`) are warnings during rollout. We’ll ratchet selectively later.
- You can pass `extraPlugins` to register additional plugin rule namespaces (e.g., `import`, `security`, `playwright`).
- Repository-wide ignores live in the root `eslint.config.mjs` (we no longer use `.eslintignore`).

## Troubleshooting
- Parsing error: tsconfig not found → include only existing tsconfig paths in `projectTsconfigs`.
- Typed rule errors in config files (e.g., Jest/Cypress) → ensure the preset’s config-file override is present so those files are parsed untyped and typed rules are disabled.
- Root files unexpectedly being linted in a package run → verify the preset’s file globs include the `relDir` prefix.
- Missing rule definition → install the corresponding plugin in the package and pass it via `extraPlugins`.
- Massive warnings → acceptable for canary. Consider local suppressions or future ratcheting plans.
- Massive warnings → acceptable for canary. Consider local suppressions or future ratcheting plans.

## Next steps
- Once canary is stable across all packages, we can:
  - Promote selected warnings to errors in focused areas.
  - Convert the root ESLint config to flat-config and retire legacy `.eslintrc`.
  - Add the canary to CI as a non-blocking check initially, then enforce incrementally.

## Baseline conversion to ESLint 9 flat-config

We’ve upgraded the workspace baseline to ESLint 9 and typescript-eslint 8. Nx’s `@nx/eslint:lint` supports flat-config when pointing `eslintConfig` to `eslint.config.mjs`.

Recommended rollout:
- Update each project’s `lint` target to set `options.eslintConfig` to the local `eslint.config.mjs`.
- Migrate repo-level ignores from `.eslintignore` into `eslint.config.mjs` at the repo root, then delete `.eslintignore` (ESLint 9 no longer supports it).
- Validate with `pnpm nx run-many -t lint --all --skip-nx-cache`.

Tips
- Don’t forward `--skip-nx-cache` to eslint; pass it to Nx only.
- Leave `lint:canary` scripts intact for the ratcheting flow; we can later unify on the Nx lint target using flat-config.
- If you see typed rules tripping on non-TS inputs, verify the TS-only rule block and the config-file override are present.
