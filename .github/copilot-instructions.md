# Copilot Instructions for OpenPRA Nx Monorepo

This document defines repository-wide guidance for AI-assisted edits and code generation across the OpenPRA Nx workspace. Keep changes minimal, safe, and aligned with our architecture.

## Core Principles

- Prefer concrete edits over advice; deliver runnable, verified changes.
- Keep diffs small and focused; avoid broad refactors unless requested.
- Respect existing conventions and public APIs; don’t break consumers.
- Use Nx targets (serve/build/test/lint) and validate locally before completion.
- Avoid adding heavy dependencies; prefer native/Nx/NestJS/React/EUI utilities.

## Workspace Overview

- Tooling: Nx, pnpm, TypeScript, Jest, ESLint, Webpack.
- Packages:
  - `packages/frontend/web-editor`: React 18 + TS, Elastic UI, React Router, SWR.
  - `packages/web-backend`: NestJS 10 + Mongoose 8.
  - `packages/shared-types`: Pure types-only library; central domain types and DTOs (no runtime). MEF schemas are generated from these types.
  - `packages/shared-sdk`: Runtime SDK (AuthService, ApiManager, invites, roles, predefined roles); imports types from `shared-types`.
  - `packages/mef-types`: MEF technical element types extracted from shared-types.
  - `packages/engine/scram-node`: Node wrappers for SCRAM engine.
  - `packages/model-generator`, `packages/microservices/raptor`: utilities/services.

## Nx Commands

- Serve all: `nx run-many -t serve --all`
- Serve individual:
  - Frontend: `nx serve frontend-web-editor`
  - Backend: `nx serve web-backend`
- Build: `nx run-many -t build`
- Test: `nx run-many -t test`
- Lint: `nx run-many -t lint`
- Graph (optional): `nx graph`

## Conventions

### TypeScript & Paths

- Use project-relative imports consistent with each package config.
- Don’t invent paths. Verify with editor or quick search.

### Frontend (web-editor)

- Routing lives under `src/app/pages` and `src/app/components/pageContainers`.
- Use React Router nested routes for model-scoped pages.
- UI: Elastic UI (EUI). Match the existing EUI version; table actions should use `type: 'icon'` with `icon` not `iconType` if needed.
- Data fetching: SWR hooks under `src/hooks`. Always return arrays to tables; handle loading/error states.
- Keep components small; colocate with feature folder under `src/components`.

### Backend (web-backend)

- NestJS modules/controllers/services live under `src/` by feature area.
- Use Mongoose schemas in `src/schemas` and inject with `MongooseModule.forFeature` in feature modules.
- Mount modules using `RouterModule.register` under `/api/...` to compose full paths.
- Validate DTOs where applicable; prefer Zod pipe already configured.
- Keep controller paths stable; avoid breaking API without coordination with frontend.

### Shared Types

- Source of truth for interfaces/types used across frontend/backend.
- Pure: no runtime code or framework dependencies. Keep NestJS/React runtime in other packages.
- Update exports in `packages/shared-types/src/lib/index.ts` when adding new types.
  // When schema JSON is needed, coordinate with maintainers; the generation pipeline has been decoupled from the deprecated `mef-schema` package.

### Shared SDK (runtime)

- Runtime-only utilities and APIs: `AuthService`, `ApiManager`, roles and invites APIs, predefined roles.
- Depends on `shared-types` for types and DTOs.
- Frontend and backend should import runtime helpers from `shared-sdk` instead of `shared-types`.

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
- Type path issues: verify `shared-types` exports and package.json dependency versions.
- Backend start warnings about transformers are informational unless build fails.

---

If in doubt, ask for the target route, data shape, and affected packages before large changes. Keep changes iterative and reversible.
