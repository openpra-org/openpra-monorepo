# Contributing to OpenPRA Docs (Gradual Rollout)

This guide outlines a safe, incremental process to expand our unified documentation across TypeScript and C++ code.

Goals:

- Keep PRs small and scoped
- Preserve a green site at all times (build + link check)
- Avoid heavy generators in dev loops; run them explicitly in CI or during `prepare`

## What’s currently included

- TypeScript API (TypeDoc → Markdown)
  - Frontend utils: `packages/frontend/web-editor/src/utils` → `api/ts/web-editor`
  - Runtime SDK: `packages/shared-sdk` → `api/ts/shared-sdk`
  - Domain types: `packages/shared-types` → `api/ts/shared-types`
- C++ API (Doxygen → XML → Doxybook2 → Markdown)
  - `packages/engine/scram-node/include` → `api/cpp-doxybook2`

## Local workflows

Fast dev loop:

- One-time generation, then dev server:
  - `nx run docs-md:prepare --no-cloud`
  - `nx run docs-md:site:dev --no-cloud`

Full build + link check:

- `nx run docs-md:site:build --no-cloud`
- `nx run docs-md:site:link-check --no-cloud`

Notes:

- Doxygen must be installed locally for C++ generation (CI installs it automatically)
- Doxybook2 is downloaded on demand by `tools/install-doxybook2.sh`

## Adding a new TypeScript section (incremental)

1. Choose the scope

- Prefer feature folders or small libraries over whole apps
- Start with a single entry or folder to keep diffs small

2. Generate Markdown with TypeDoc

- For a new package, add a target in `packages/docs-md/project.json` similar to `ts:markdown:shared-sdk`
- Or temporarily include the new entry in the existing `ts:markdown` target (web-editor) using `--entryPointStrategy expand`

3. Wire navigation (minimal)

- Add a nav/side-bar section in `packages/docs-md/.vitepress/config.ts` pointing to the new README.html
- Verify locally with `site:build` and `site:link-check`

4. Land in small PRs

- Keep the first PR to: generator target + nav link + verified build
- Follow up with additional entries gradually (repeat 2–3)

## Expanding C++ coverage (incremental)

1. Adjust Doxygen input paths

- Edit `packages/docs-md/tools/Doxyfile.xml` INPUT/RECURSIVE to include the next header directories

2. Regenerate and validate

- Run `nx run docs-md:cpp:doxygen-xml --no-cloud`
- Run `nx run docs-md:cpp:doxybook2 --no-cloud`
- Build the site and link-check

3. Keep PRs small

- Add one directory or a few headers at a time; verify navigation (Files/Classes/Namespaces) renders

## Safety gates

- If Vue SSR complains about Vue-style mustache in Markdown, escape the braces using HTML entities: `&#123;&#123;` and `&#125;&#125;`

## CI behavior

- The GitHub Pages workflow (`.github/workflows/docs.yml`) runs only when relevant docs paths change
- The VitePress base path is set dynamically for Pages via `VITEPRESS_BASE="/$\{\{ github.event.repository.name \}\}/"`
- Concurrency is enabled to cancel in-progress runs on the same branch

## When to pause and refactor

- If a section grows too large/noisy, consider splitting into smaller logical groups (new targets + sidebar groups)
- For backend NestJS code, prefer documenting DTOs and shared types first; defer controllers/services until we have clearer audience needs
