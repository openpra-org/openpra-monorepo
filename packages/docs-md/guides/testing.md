# Testing

Run unit and integration tests across the monorepo with Nx.

## Run all tests

```bash
pnpm nx run-many -t test
```

## Run tests for a single package

```bash
# Web backend (NestJS)
pnpm nx test backends-web-backend

# Web frontend
pnpm nx test frontends-web-frontend

# Praetor microservice
pnpm nx test microservices-praetor

# Shared types
pnpm nx test interfaces-shared-types
```

Pass extra Jest flags after `--`:

```bash
pnpm nx test backends-web-backend -- --test-timeout=60000 --runInBand
```

## Linting

```bash
pnpm nx run-many -t lint
```

## Notes

- Backend tests use `mongodb-memory-server` by default. Set `MONGO_URI` to point at a real MongoDB instance if needed:

```bash
export MONGO_URI="mongodb://127.0.0.1:27017/test"
pnpm nx test backends-web-backend -- --test-timeout=60000
```
