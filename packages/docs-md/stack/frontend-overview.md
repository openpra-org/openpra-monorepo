# Frontend Overview

<script setup>
import rootPkg from '../../../package.json'
import fePkg from '../../frontend/web-editor/package.json'
const nxVersion = rootPkg.devDependencies?.nx ?? 'N/A'
const react = fePkg.dependencies?.react ?? 'N/A'
const typescript = rootPkg.devDependencies?.typescript ?? (fePkg.devDependencies?.typescript ?? 'N/A')
const eui = fePkg.dependencies?.['@elastic/eui'] ?? 'N/A'
const reactRouter = fePkg.dependencies?.['react-router-dom'] ?? 'N/A'
const swr = fePkg.dependencies?.swr ?? 'N/A'
</script>

This guide provides a quick orientation to the frontend Web Editor and how its docs are organized.

## Projects

- Web Editor (React + Elastic UI + TypeScript): SPA for building and editing models
  - Docs: [Web Editor API](api/ts/web-editor/README.html)
  - Related runtime: [Shared SDK API](api/ts/shared-sdk/README.html)
  - Shared types: [Shared Types API](api/ts/shared-types/README.html)

## Tech stack

- React {{ react }}, TypeScript {{ typescript }}
- Elastic UI (EUI) {{ eui }}
- React Router {{ reactRouter }} (nested routes)
- SWR {{ swr }} for data fetching
- Nx {{ nxVersion }} for orchestration; pnpm for package management

## Conventions

- Routing lives under `src/app/pages` and `src/app/components/pageContainers` using React Router nested routes (model-scoped pages).
- Data fetching hooks live under `src/hooks` and use SWR.
- Table data should always be an array (default to `[]`) to avoid EUI crashes; handle loading and error states.
- UI components use EUI; keep components small and colocate within feature folders under `src/components`.
- Types and DTOs come from `packages/shared-types`; runtime helpers live in `packages/shared-sdk`.
