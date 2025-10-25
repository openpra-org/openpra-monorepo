# microservice-job-broker

NestJS-based RabbitMQ microservice for distributed quantification tasks.

## Deploy and lockfile

- Deployments run Nx inside the repository image that was installed from the root `pnpm-lock.yaml`.
- We do not generate a pruned lockfile or a dist `package.json` for this service (`generateLockfile: false`, `generatePackageJson: false` in `project.json`).
- If you have a different deploy flow that expects a `dist/package.json`, re-enable `generatePackageJson` and ensure your environment supports pruned lockfile generation.

## Local testing

Unit and e2e tests require a MongoDB instance. In CI this is provided via `MONGO_URI`.

On local Debian/DevContainer environments, provide `MONGO_URI` yourself to avoid `mongodb-memory-server` OpenSSL issues:

```bash
# Example: connect to a local or dockerized MongoDB 7.x
export MONGO_URI="mongodb://localhost:27017/openpra-job-broker-test"

# Then run tests
pnpm nx test microservice-job-broker
pnpm nx run microservice-job-broker:e2e
```

Notes:

- On Debian 12, the Jest global setup auto-detects missing OpenSSL 1.1 and will use a local MongoDB via `MONGO_URI` if reachable; otherwise it prints a recommendation to set `MONGO_URI`.
- `mongodb-memory-server` binaries may not start on Debian 12; prefer an external MongoDB (7.x recommended).
- Ensure the database is disposable; tests may create/drop collections.

## Jest + SWC quick note

This package uses `@swc/jest` for fast TS transforms with decorators enabled for NestJS:

```ts
transform: {
  "^.+\\.[tj]s$": [
    "@swc/jest",
    {
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        target: "es2020",
        transform: { decoratorMetadata: true },
      },
      module: { type: "commonjs" },
      sourceMaps: "inline",
    },
  ],
},
```

Path mappings for workspace packages (when tests import from source):

```ts
moduleNameMapper: {
  "^shared-types$": "<rootDir>/../../shared-types/src/index.ts",
  "^mef-types$": "<rootDir>/../../mef-types/src/index.ts",
}
```

Tip: for types-only packages (like `mef-types`), prefer `import type { ... }` to avoid runtime resolution of `.d.ts` files.

See the root README section "Jest + SWC (fast TypeScript tests)" and "Troubleshooting (Debian 12 / OpenSSL 3)" for details.
