# OpenPRA Unified Documentation (VitePress + Doxybook2)

This package builds the unified Markdown documentation for the OpenPRA monorepo.

## Documentation includes:

- TypeScript API via TypeDoc (Markdown output)
- C++ API via Doxygen XML converted by Doxybook2
- Site rendered with VitePress

## Structure

- TS docs:
  - `api/ts/web-frontend` — React application source
  - `api/ts/shared-types` — shared application contracts
  - `api/ts/web-backend` — NestJS backend
  - `api/ts/praetor` — distributed quantification service
  - `api/ts/scram-node` — SCRAM Node-addon contract
- MEF docs:
  - `mef-elements/ts` — technical-element TypeScript interfaces
  - `mef-elements/zod` — runtime validation schemas
- C++ docs:
  - `api/cpp-doxybook2` — structured pages (files/classes/namespaces)
- Site output: `.vitepress/dist`

### Explore src/ (by folder)

The site includes an "Explore src/ (by folder)" view for each TypeScript package. It groups TypeDoc modules by their top-level `src/` folders to mirror the source tree and ease discovery. This is enabled by default and can be turned off by setting `DOCS_ENABLE_SRC_EXPLORER=0` or `DOCS_ENABLE_SRC_EXPLORER=false` at build time.

## Local usage

Recommended (faster dev loop):

1. Generate docs content once
   - Everything (TS + C++ processed and sanitized) in one go:
     - `nx run docs-md:prepare --no-cloud`
   - TS-only (no Doxygen required):
     - Quick: `nx run docs-md:ts:explore:folders --no-cloud`
       - This runs all TypeDoc targets and generates the folder explorer without building the VitePress site.
     - Or run individual projects if you’re iterating on a specific area:
       - `nx run docs-md:ts:markdown:shared-types --no-cloud`
       - `nx run docs-md:ts:markdown:web-backend --no-cloud`
       - `nx run docs-md:ts:markdown:web-frontend --no-cloud`
       - `nx run docs-md:ts:markdown:praetor --no-cloud`
       - `nx run docs-md:ts:markdown:scram-node --no-cloud`
       - `nx run docs-md:mef:elements:assemble --no-cloud`
2. Start the dev server
   - `nx run docs-md:site:dev --no-cloud`

Full build and checks:

- Build once (no Nx Cloud):
  - `nx run docs-md:site:build --no-cloud`
- Link check (file-based):
  - `nx run docs-md:site:link-check --no-cloud`
  - Optionally seed more starting pages (relative to `.vitepress/dist/`):
    - `DOCS_LINKCHECK_ENTRIES="api/ts/web-frontend/_explore/index.html api/cpp-doxybook2/index_files.html" nx run docs-md:site:link-check --no-cloud`
- Link check (serve-based, validates site-absolute links):
  - `DOCS_LINKCHECK_SERVE=1 nx run docs-md:site:link-check --no-cloud`
  - Port can be overridden: `DOCS_LINKCHECK_PORT=5173 DOCS_LINKCHECK_SERVE=1 nx run docs-md:site:link-check --no-cloud`

To temporarily disable the folder explorer for a build:

- `DOCS_ENABLE_SRC_EXPLORER=0 nx run docs-md:site:build --no-cloud`

Doxygen and Doxybook2

- Doxygen must be available on PATH (CI installs via apt). On Debian/Ubuntu:
  - `sudo apt-get update && sudo apt-get install -y doxygen graphviz`
- Doxybook2 is installed on demand by `tools/install-doxybook2.sh` (Linux x86_64 v1.5.0).

## Current scope

TypeScript

- `apps/frontends/web-frontend`
- `apps/backends/web-backend`
- `apps/interfaces/shared-types`
- `apps/interfaces/mef-types`
- `apps/microservices/praetor`
- `apps/solvers/scram/targets/scram-node`

C++

- Engine wrappers in `apps/solvers/scram` (headers) via Doxygen → Doxybook2.

Add more TS files incrementally by appending their paths to the `--entryPointStrategy expand` list in `apps/docs-md/project.json` under the `ts:markdown` command, then rebuild.

### Adding a new TypeScript project to the docs

To include another TypeScript package in the docs:

1. Add a new `ts:markdown:<your-project>` target in `apps/docs-md/project.json` that invokes TypeDoc with `--entryPointStrategy expand` against that project’s source.
2. Add the new target to the `dependsOn` list of `ts:explore:folders` and `prepare` so it participates in the aggregate workflows.
3. Optionally add a sidebar entry to the VitePress nav for visibility.

## CI publishing

`.github/workflows/docs.yml` builds `docs-md:site:build` and deploys `.vitepress/dist` to GitHub Pages on the default branch. The VitePress base path is configured via `VITEPRESS_BASE="/$\{\{ github.event.repository.name \}\}/"`.

For incremental rollout and contribution steps, see `CONTRIBUTING-DOCS.md` in this folder.

## Notes

- We removed Moxygen in favor of Doxybook2 (better structure and navigation).
- TypeDoc currently runs with `--skipErrorChecking` to keep generation fast; consider enabling error checking for docs builds later.
- Generated artifacts and caches are ignored via root `.gitignore`.
- Base-path handling and link checks:
  - We rely on VitePress `base` via `VITEPRESS_BASE`; no custom prefixing in links.
  - Local link checks create an ephemeral symlink in `.vitepress/dist/<base>` to emulate Pages base (both file- and serve-based modes); it is automatically cleaned up after the crawl to avoid dev server ELOOP issues.

## Troubleshooting

- TypeDoc warnings
  - “referenced by X but not included”: include the referenced file as another entry point, or export it via an aggregated index.
  - “@param … was not used”: adjust the JSDoc to match the function signature or remove stale tags.
- SSR and braces in Markdown
  - Avoid raw double braces in content (for example, GitHub Actions expressions). Use inline code or HTML entities like `&lbrace;` and `&rbrace;` when showing literals.
