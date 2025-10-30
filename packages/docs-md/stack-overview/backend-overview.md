# Backend Overview

This guide provides a quick orientation to the backend services and how their docs are organized.

## Projects

- Web Backend (NestJS): REST API for the web app
  - Docs: [API (TypeDoc)](../api/ts/web-backend/README.html)
- Job Broker (microservice): background jobs and orchestration
  - Docs: [API (TypeDoc)](../api/ts/job-broker/README.html)

## Tech stack

- NestJS 10
- Mongoose 8 for MongoDB
- Nx for orchestration, pnpm for package management

## Conventions

- Modules, controllers, services live under `src/` and are grouped by feature.
- Mongoose schemas live under `src/schemas` and are injected with `MongooseModule.forFeature` within feature modules.
- Routes are composed using `RouterModule.register` and mounted under `/api/...` paths; keep controller paths stable.
- DTOs and types come from `packages/shared-types`; runtime helpers live in `packages/shared-sdk`.
- Validation
  - Prefer the existing Zod validation pipe where applicable.

## Building docs

- TypeScript API docs are generated with TypeDoc and rendered by VitePress.
- See the full docs site navigation for the TS API and C++ API sections.

Links

- Web Backend API: ../api/ts/web-backend/README.html
- Job Broker API: ../api/ts/job-broker/README.html
- Shared SDK: ../api/ts/shared-sdk/README.html
- Shared Types: ../api/ts/shared-types/README.html
