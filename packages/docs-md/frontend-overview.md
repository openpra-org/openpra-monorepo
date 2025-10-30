# Frontend Overview

This guide provides a quick orientation to the frontend Web Editor and how its docs are organized.

## Projects

- Web Editor (React 18 + TypeScript): SPA for building and editing models
  - Docs: [API (TypeDoc)](api/ts/web-editor/README.html)
  - Related runtime: [Shared SDK](api/ts/shared-sdk/README.html)
  - Shared types: [Shared Types](api/ts/shared-types/README.html)

## Tech stack

- React 18, TypeScript
- Elastic UI (EUI)
- React Router (nested routes)
- SWR for data fetching
- Nx for orchestration, pnpm for package management

## Conventions

- Routing lives under `src/app/pages` and `src/app/components/pageContainers` using React Router nested routes (model-scoped pages).
- Data fetching hooks live under `src/hooks` and use SWR.
  - Table data should always be an array (default to `[]`) to avoid EUI crashes; handle loading and error states.
- UI components use EUI; keep components small and colocate within feature folders under `src/components`.
- Types and DTOs come from `packages/shared-types`; runtime helpers live in `packages/shared-sdk`.

## Building docs

- TypeScript API docs are generated with TypeDoc and rendered by VitePress.
- See the TS API section in the site navigation for related packages.

Links

- Web Editor API: [api/ts/web-editor/README.html](api/ts/web-editor/README.html)
- Shared SDK: [api/ts/shared-sdk/README.html](api/ts/shared-sdk/README.html)
- Shared Types: [api/ts/shared-types/README.html](api/ts/shared-types/README.html)
