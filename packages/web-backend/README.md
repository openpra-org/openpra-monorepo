# web-backend

NestJS backend for OpenPRA.

## Local testing

Backend unit/integration tests require a MongoDB instance. In CI this is provided via `MONGO_URI`.

On local Debian/DevContainer environments, provide `MONGO_URI` yourself to avoid `mongodb-memory-server` OpenSSL issues:

```bash
# Example: connect to a local or dockerized MongoDB 7.x
export MONGO_URI="mongodb://localhost:27017/openpra-test"

# Then run tests
pnpm nx test web-backend

# Or use the convenience Nx targets (set MONGO_URI for you):
pnpm nx run web-backend:test-local
pnpm nx run web-backend:e2e-local
```

Notes:

- mongodb-memory-server is pinned but may not start on Debian 12 due to OpenSSL incompatibilities.
- CI supplies `MONGO_URI` and tests pass there; locally prefer a real MongoDB (7.x recommended).
- Ensure the database is disposable; tests may create/drop collections.

## External e2e (opt-in)

There is an additional external integration test suite that exercises real HTTP endpoints against a running backend. It's skipped by default to avoid environment flakiness. To run it locally:

```bash
# 1) Start a backend instance (adjust if your serve target differs)
pnpm nx serve web-backend

# 2) In another terminal, enable the external suite and point it at your backend
export RUN_EXTERNAL_E2E=true
export BACKEND_BASE_URL="http://localhost:8000/api"  # update if your base URL differs

# 3) Run tests (uses your MONGO_URI or the e2e-local target convenience)
pnpm nx run web-backend:e2e-local
```

Notes:

- The test harness provides a default `UNSAFE_JWT_SECRET_KEY` if not set. You can override it via env if needed.
- These tests create isolated users and clean up between runs; ensure your MongoDB points to a disposable DB.
- If you prefer a quick local Mongo without installing, you can use Docker:

```bash
docker run -d --name mongo -p 27017:27017 mongo:7
export MONGO_URI="mongodb://localhost:27017/openpra-test"
```
