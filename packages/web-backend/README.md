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
