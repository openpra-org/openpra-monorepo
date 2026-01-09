# Backend Overview

<script setup>
import rootPkg from '../../../package.json'
import bePkg from '../../web-backend/package.json'
const nxVersion = rootPkg.devDependencies?.nx ?? 'N/A'
const nest = bePkg.dependencies?.['@nestjs/core'] ?? bePkg.dependencies?.['@nestjs/common'] ?? 'N/A'
const mongoose = bePkg.dependencies?.mongoose ?? 'N/A'
const typescript = rootPkg.devDependencies?.typescript ?? 'N/A'
</script>

This guide provides a quick orientation to the backend services and how their docs are organized.

## Projects

- Web Backend (NestJS): REST API for the web app
  - Docs: [Web Backend API](../api/ts/web-backend/README.html)
  - Related runtime: [Shared SDK API](api/ts/shared-sdk/README.html)
  - Shared types: [Shared Types API](api/ts/shared-types/README.html)
- Raptor (microservice): background jobs and orchestration
  - Docs: [Raptor API](../api/ts/raptor/README.html)
  - Related runtime: [Shared SDK API](api/ts/shared-sdk/README.html)
  - Shared types: [Shared Types API](api/ts/shared-types/README.html)
  - Solver Engine: [SCRAM API](api/cpp-doxybook2/index_classes.html)

## Tech stack

- NestJS {{ nest }}
- Mongoose {{ mongoose }} for MongoDB
- TypeScript {{ typescript }}
- Nx {{ nxVersion }} for orchestration; pnpm for package management

## Conventions

- Modules, controllers, services live under `src/` and are grouped by feature.
- Mongoose schemas live under `src/schemas` and are injected with `MongooseModule.forFeature` within feature modules.
- Routes are composed using `RouterModule.register` and mounted under `/api/...` paths; keep controller paths stable.
- DTOs and types come from `packages/shared-types`; runtime helpers live in `packages/shared-sdk`.
- Validation
  - Prefer the existing Zod validation pipe where applicable.

Links

- Web Backend API: ../api/ts/web-backend/README.html
- Raptor API: ../api/ts/raptor/README.html
- Shared SDK: ../api/ts/shared-sdk/README.html
- Shared Types: ../api/ts/shared-types/README.html
