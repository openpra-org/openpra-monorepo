# Testing

Run unit and integration tests across the monorepo with Nx.

## Run tests (all)

```bash
pnpm nx run-many -t test
```

## Run tests (single package)

```bash
# Backend (NestJS)
pnpm nx test web-backend

# Microservice
yarn nx test raptor

# Frontend
yarn nx test frontend-web-editor
```

Pass extra Jest flags after `--`:

```bash
pnpm nx test web-backend -- --test-timeout=60000 --runInBand
```

## Linting

```bash
pnpm nx run-many -t lint
```

## Debian 12 (OpenSSL 3) and mongodb-memory-server

On Debian 12/bookworm (including the Dev Container), `mongodb-memory-server` may not run due to OpenSSL 1.1 binaries. Our Jest setups detect this and prefer a real MongoDB via `MONGO_URI` when available.

Set `MONGO_URI` explicitly if needed:

```bash
export MONGO_URI="mongodb://127.0.0.1:27017/test"
pnpm nx test web-backend -- --test-timeout=60000
```

See also the project README for details and per-package READMEs for any test-specific notes.
