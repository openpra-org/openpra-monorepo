# OpenPRA architecture

OpenPRA is an open-source probabilistic risk assessment platform organized as an Nx and pnpm monorepo. Its browser applications, service layer, model interfaces, solver engines, utility programs, documentation, and deployment definitions share one versioned repository.

## Repository layout

```text
openpra-monorepo/
├── apps/                 # Applications, interfaces, solvers, utilities, and docs
├── deploy/               # Container and orchestration definitions grouped by application
├── fixtures/             # Models and expected results used for verification
├── docker/               # Shared local and documentation deployment assets
└── resources/            # Local reference material and design-source assets
```

## Runtime layers

### Frontends

- `apps/frontends/web-frontend` is the authenticated React application used to create projects and complete PRA workbooks.
- `apps/site` is the public OpenPRA website.

Frontends consume backend APIs. They do not invoke native solvers directly.

### Backends and microservices

- `apps/backends/web-backend` provides authentication, authorization, project and workbook persistence, analytics, document storage, and application APIs.
- `apps/microservices/praetor` coordinates asynchronous or distributed solver work when that execution model is required.

### Interfaces

- `apps/interfaces/mef-types` defines the OpenPRA Model Exchange Format and technical-element schemas.
- `apps/interfaces/shared-types` defines application contracts shared by frontend and backend code.

These interfaces are the versioned boundary between workbook data, application services, and computational tools.

### Solvers

- `apps/solvers/praxis` is the Rust PRA solver and the primary location for current solver development.
- SCRAM and other retained engines provide independent algorithms, format support, and verification baselines.

Native solver capabilities are exposed to TypeScript through explicit command or native-addon boundaries rather than being reimplemented in the web layer.

### Utilities

- Pracciolini converts and verifies PRA model formats.
- Benchmarking compares supported solvers against common fixtures and expected results.
- Additional utilities support model generation, validation, and analysis workflows.

## Documentation and deployment

The documentation site is built from `apps/docs-md`. API reference material is generated during CI from TypeScript, Rust, C++, and Python sources; generated output is not maintained as a second documentation application.

Deployment files live under `deploy/<category>/<application>` wherever practical. The small root `docker` directory contains only shared local-development and documentation-deployment assets that still have active consumers.

## Dependency direction

```text
frontend → backend → microservice/native boundary → solver
              ↓
       shared interfaces and MEF schemas
```

The MEF schemas define analysis data, the backend controls persistence and execution boundaries, and solver outputs flow back through typed application contracts to the user interface.
