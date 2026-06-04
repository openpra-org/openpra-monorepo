# mef-types

Type-only MEF contracts and light utilities extracted from `shared-types`.

This package provides the MEF technical element type definitions and a few
runtime-light helpers. It is primarily consumed via TypeScript path aliases in
the monorepo and is not published.

## Usage

- Prefer type-only imports to avoid runtime resolution of declaration files:

  import type { Role, QuantifyRequest, ExecutionTask } from "mef-types";

- Deep imports remain supported for advanced areas (e.g., technical elements),
  but use the top-level barrel when possible for common contracts.

## Build and lint

- Build: nx build mef-types
- Lint: nx lint mef-types or pnpm --filter mef-types run lint:canary

Notes

- The `src/lib/` subtree contains the MEF technical elements (spec-heavy types)
  and is excluded from strict TSDoc lint rules to reduce noise.
- This package is private and intended for internal consumption only.
