# Frontend Overview

This guide provides a quick orientation to the web frontend and how its docs are organized.

## Projects

- Web Frontend (React + TypeScript): SPA for building and editing PRA models
  - Docs: [Web Frontend API](/api/ts/web-frontend/README.html)
  - Shared types: [Shared Types API](/api/ts/shared-types/README.html)
  - MEF types: [MEF Types](/mef-elements/ts/README.html)

## Tech stack

- React {{ react }}, TypeScript {{ typescript }}
- React Router {{ reactRouter }} (nested routes)
- Zustand {{ zustand }} for state management
- Zod {{ zod }} for runtime validation
- Nx {{ nxVersion }} for orchestration; pnpm for package management

## Conventions

- Routes are defined using React Router nested routes; model-scoped pages live under `src/app/`.
- State management uses Zustand stores colocated with their feature.
- Types and DTOs come from `apps/interfaces/shared-types` and `apps/interfaces/mef-types`.
- Zod schemas mirror shared-types for runtime boundary validation.
