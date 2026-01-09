# Building

How to build OpenPRA packages using Nx and pnpm.

## Build all packages

```bash
pnpm nx run-many -t build
```

## Build individual packages

Examples:

```bash
# Frontend web app (React)
pnpm nx build frontend-web-editor

# Backend (NestJS)
pnpm nx build web-backend

# Microservice (Raptor)
pnpm nx build raptor

# Shared libraries
a) pnpm nx build shared-types
b) pnpm nx build shared-sdk
c) pnpm nx build mef-types
```

## Serve (dev mode)

```bash
# Serve all
yarn nx run-many -t serve --all
# or
pnpm nx run-many -t serve --all

# Serve individual
pnpm nx serve frontend-web-editor
pnpm nx serve web-backend
```

## Docs site

Build the unified documentation site (TypeScript + C++):

```bash
pnpm nx run docs-md:site:build --no-cloud
```

Preview locally:

```bash
pnpm nx run docs-md:site:dev --no-cloud
```

The static site is emitted to `packages/docs-md/.vitepress/dist` and published by GitHub Pages (see `.github/workflows/docs.yml`).

## Notes

- Production images use dependencies from the root `pnpm-lock.yaml`; server apps (e.g., web-backend, job-broker) don’t generate pruned lockfiles in `dist/`.
- Nx Cloud is optional; local caching works fine. If you see 401 messages about Nx Cloud, you can ignore them locally.
