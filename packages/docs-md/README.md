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

Doxygen and Doxybook2

- Doxygen must be available on PATH (CI installs via apt). On Debian/Ubuntu:
  - `sudo apt-get update && sudo apt-get install -y doxygen graphviz`
- Doxybook2 is installed on demand by `tools/install-doxybook2.sh` (Linux x86_64 v1.5.0).

## CI publishing

`.github/workflows/docs.yml` builds `docs-md:site:build` and deploys `.vitepress/dist` to GitHub Pages on the default branch. The VitePress base path is configured via `VITEPRESS_BASE="/$\{\{ github.event.repository.name \}\}/"`.

For incremental rollout and contribution steps, see `CONTRIBUTING-DOCS.md` in this folder.

## Notes

- We removed Moxygen in favor of Doxybook2 (better structure and navigation).
- TypeDoc currently runs with `--skipErrorChecking` to keep generation fast; consider enabling error checking for docs builds later.
- Generated artifacts and caches are ignored via root `.gitignore`.
