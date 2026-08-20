# Backend Overview

This guide provides a quick orientation to the backend services and how their docs are organized.

## Projects

- Web Backend (NestJS): REST API for the web app
  - Docs: [Web Backend API](/api/ts/web-backend/README.html)
  - Shared types: [Shared Types API](/api/ts/shared-types/README.html)
- Praetor (microservice): solver orchestration and job dispatch
  - Docs: [Praetor API](/api/ts/praetor/README.html)
  - Solver engine: [PRAXIS (Rust)](/api/rust/praxis/index.html)

## Tech stack

- NestJS {{ nest }}
- Mongoose {{ mongoose }} for MongoDB
- TypeScript {{ typescript }}
- Nx {{ nxVersion }} for orchestration; pnpm for package management

## Conventions

- Modules, controllers, and services live under `src/` grouped by feature.
- Mongoose schemas live under `src/schemas` and are injected via `MongooseModule.forFeature`.
- Routes are mounted under `/api/...` paths; keep controller paths stable.
- Types and DTOs come from `apps/interfaces/shared-types`.
- Zod validation pipe is used for request body validation.
