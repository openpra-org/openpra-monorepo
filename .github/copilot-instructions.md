# Copilot Instructions for OpenPRA Nx Monorepo

This document defines repository-wide guidance for AI-assisted edits and code generation across the OpenPRA Nx workspace. Keep changes minimal, safe, and aligned with our architecture.

## Core Principles

- Prefer concrete edits over advice; deliver runnable, verified changes.
- Keep diffs small and focused; avoid broad refactors unless requested.
- Respect existing conventions and public APIs; don’t break consumers.
- Use Nx targets (serve/build/test/lint) and validate locally before completion.
- Avoid adding heavy dependencies; prefer native/Nx/NestJS/React/EUI utilities.

## Workspace Overview

- Tooling: Nx, pnpm, TypeScript, Jest, ESLint, Webpack, Rust, and CMake.
- Active projects live under `apps/`:
  - `apps/frontends/web-frontend`: React 18 + TypeScript web client.
  - `apps/backends/web-backend`: NestJS REST API.
  - `apps/interfaces/shared-types`: shared application schemas and DTOs.
  - `apps/interfaces/mef-types`: MEF technical-element schemas and validation.
  - `apps/microservices/praetor`: distributed quantification service.
  - `apps/solvers/praxis`: Rust PRA solver.
  - `apps/solvers/scram`: SCRAM C++ engine and `scram-node` addon.
  - `apps/docs-md`: unified documentation site.

## Nx Commands

- Serve all: `nx run-many -t serve --all`
- Serve individual:
  - Frontend: `nx serve frontends-web-frontend`
  - Backend: `nx serve backends-web-backend`
- Build: `nx run-many -t build`
- Test: `nx run-many -t test`
- Lint: `nx run-many -t lint`
- Graph (optional): `nx graph`

## Conventions

### TypeScript & Paths

- Use project-relative imports consistent with each package config.
- Don’t invent paths. Verify with editor or quick search.

### Frontend (web-frontend)

- Keep workbook and newly developed method code in their existing feature directories.
- Follow the shared design system and existing React Router conventions.
- Keep components small and colocate tests with the affected feature.

### Backend (web-backend)

- NestJS modules/controllers/services live under `src/` by feature area.
- Use Mongoose schemas in `src/schemas` and inject with `MongooseModule.forFeature` in feature modules.
- Mount modules using `RouterModule.register` under `/api/...` to compose full paths.
- Validate DTOs where applicable; prefer Zod pipe already configured.
- Keep controller paths stable; avoid breaking API without coordination with frontend.

### Shared Types

- `apps/interfaces/shared-types` is the source of truth for shared application DTOs.
- `apps/interfaces/mef-types` is the source of truth for MEF technical-element types.
- Keep interfaces free of NestJS and React runtime dependencies.
- Export additions through the appropriate interface project index.

## Quality Gates (Green-Before-Done)

- Build: `nx run-many -t build` must pass.
- Lint: `nx run-many -t lint` must pass for changed packages.
- Tests: Add/adjust minimal tests when changing public behavior.
- For backend: ensure Nest app starts and routes are mapped (watch logs).

## PR & Diff Hygiene

- Keep PRs focused; include a concise description of user-facing impact.
- Avoid unrelated formatting; preserve existing style unless a linter dictates.
- Document any new env vars, routes, or scripts in package READMEs.

## Safe Defaults & Edge Cases

- SWR hooks: default `data` to `[]` for EUI tables; handle `isLoading` and errors.
- Mongoose models: define indexes and required fields thoughtfully; validate IDs.
- Routing: verify nested route precedence to avoid parent overshadowing children.
- Config: never commit secrets; use `.env` and documented vars.

## How to Propose Changes (AI agents)

1. Gather context (search/read relevant files).
2. Plan explicit edits (list files, what changes, why).
3. Make minimal diffs with correct paths.
4. Validate: build/serve/test where applicable.
5. Summarize outcomes and next steps; note assumptions.

## Troubleshooting Tips

- 404s on API calls: confirm RouterModule mount paths and controller prefixes.
- EUI tables crashing: ensure `items` is always an array; avoid undefined.
- Type path issues: verify `interfaces-shared-types` or `interfaces-mef-types` exports and workspace dependencies.
- Backend start warnings about transformers are informational unless build fails.

---

If in doubt, ask for the target route, data shape, and affected projects before large changes. Keep changes iterative and reversible.
