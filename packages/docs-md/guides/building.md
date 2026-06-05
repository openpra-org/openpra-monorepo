# Building

How to build OpenPRA packages using Nx and pnpm.

## Build all

```bash
pnpm nx run-many -t build
```

## Build individual targets

```bash
# Web frontend (React)
pnpm nx build frontends-web-frontend

# Web backend (NestJS)
pnpm nx build backends-web-backend

# Praetor microservice
pnpm nx build microservices-praetor

# Shared libraries
pnpm nx build interfaces-shared-types
pnpm nx build interfaces-mef-types
```

## Serve (dev mode)

```bash
# Serve all
pnpm nx run-many -t serve

# Serve individual
pnpm nx serve frontends-web-frontend
pnpm nx serve backends-web-backend
```

## Docs site

Build the unified documentation site:

```bash
pnpm nx run docs-md:site:build --no-cloud
```

Preview locally:

```bash
pnpm nx run docs-md:site:dev --no-cloud
```

The static site is emitted to `packages/docs-md/.vitepress/dist`.

## Notes

- Nx Cloud is optional; local caching works fine. If you see 401 messages about Nx Cloud, ignore them locally.
