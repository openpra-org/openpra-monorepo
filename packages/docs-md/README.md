# OpenPRA Unified Docs (VitePress + Doxybook2)

This package builds the unified Markdown documentation for the monorepo:

- TypeScript API via TypeDoc (Markdown output)
- C++ API via Doxygen XML converted by Doxybook2
- Site rendered with VitePress

## Structure

- TS docs:
  - `api/ts/web-editor` — frontend utils subset
  - `api/ts/shared-sdk` — runtime SDK
  - `api/ts/shared-types` — domain types and DTOs
  - `api/ts/mef-types` — MEF technical element types
  - `api/ts/mef-schema` — generated MEF JSON schema typings
  - `api/ts/model-generator` — model generator utilities
  - `api/ts/web-backend` — NestJS backend (entry/main)
  - `api/ts/job-broker` — job-broker microservice (entry/main)
- C++ docs:
  - `api/cpp-doxybook2` — structured pages (files/classes/namespaces)
- Site output: `.vitepress/dist`

## Local usage

Recommended (faster dev loop):

1. Generate docs content once
   - `nx run docs-md:prepare --no-cloud`
   - If you don't have Doxygen installed, you can generate TS only:
     - `nx run docs-md:ts:markdown --no-cloud`
     - `nx run docs-md:ts:markdown:shared-sdk --no-cloud`
     - `nx run docs-md:ts:markdown:shared-types --no-cloud`
2. Start the dev server
   - `nx run docs-md:site:dev --no-cloud`

Full build and checks:

- Build once (no Nx Cloud):
  - `nx run docs-md:site:build --no-cloud`
- Link check:
  - `nx run docs-md:site:link-check --no-cloud`

Coverage pages (once the site is built):

- TypeScript coverage: `/api/ts/coverage.html`
- C++ coverage (Doxybook2 heuristic): `/api/cpp-doxybook2/coverage.html`

Doxygen and Doxybook2

- Doxygen must be available on PATH (CI installs via apt). On Debian/Ubuntu:
  - `sudo apt-get update && sudo apt-get install -y doxygen graphviz`
- Doxybook2 is installed on demand by `tools/install-doxybook2.sh` (Linux x86_64 v1.5.0).

## Current coverage

TypeScript

- frontend web-editor (selected utilities and related types):
  - `src/utils/constants.ts`
  - `src/utils/scientificNotation.ts`
  - `src/utils/StringUtils.ts`
  - `src/utils/recalculateFrequencies.ts`
  - `src/utils/bayesianNodeIntersectionCalculator.ts`
  - `src/utils/faultTreeData.ts`
  - `src/utils/treeUtils.ts`
  - `src/app/components/treeNodes/faultTreeNodes/faultTreeNodeType.ts`
  - `src/app/components/treeNodes/eventSequenceNodes/eventSequenceNodeType.ts`
  - `src/app/components/treeEdges/eventSequenceEdges/eventSequenceEdgeType.ts`
- shared-sdk: `src/index.ts` (aggregated)
- shared-types: `src/index.ts` (aggregated)
- mef-types: `src/index.ts` (aggregated)
- mef-schema: `src/index.ts` (aggregated)
- model-generator: `src/index.ts` (aggregated)
- web-backend: `src/main.ts` (entrypoint)
- job-broker: `src/main.ts` (entrypoint)

C++

- Engine wrappers in `packages/engine/scram-node` (headers) via Doxygen → Doxybook2.

Add more TS files incrementally by appending their paths to the `--entryPointStrategy expand` list in `packages/docs-md/project.json` under the `ts:markdown` command, then rebuild.

## CI publishing

`.github/workflows/docs.yml` builds `docs-md:site:build` and deploys `.vitepress/dist` to GitHub Pages on the default branch. The VitePress base path is configured via `VITEPRESS_BASE="/$\{\{ github.event.repository.name \}\}/"`.

For incremental rollout and contribution steps, see `CONTRIBUTING-DOCS.md` in this folder.

## Notes

- We removed Moxygen in favor of Doxybook2 (better structure and navigation).
- TypeDoc currently runs with `--skipErrorChecking` to keep generation fast; consider enabling error checking for docs builds later.
- Generated artifacts and caches are ignored via root `.gitignore`.
- Base-path handling and link checks:
  - We rely on VitePress `base` via `VITEPRESS_BASE`; no custom prefixing in links.
  - Local link checks create an ephemeral symlink in `.vitepress/dist/<base>` to emulate Pages base; it is automatically cleaned up after the crawl to avoid dev server ELOOP issues.

## Troubleshooting

- TypeDoc warnings
  - “referenced by X but not included”: include the referenced file as another entry point, or export it via an aggregated index.
  - “@param … was not used”: adjust the JSDoc to match the function signature or remove stale tags.
- SSR and braces in Markdown
  - Avoid raw double braces in content (for example, GitHub Actions expressions). Use inline code or HTML entities like `&lbrace;` and `&rbrace;` when showing literals.
