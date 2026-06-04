# Dev Container Guide

Run OpenPRA in a reproducible VS Code Dev Container or GitHub Codespaces environment.

## Overview

This repo includes a ready-to-use Dev Container configuration under `.devcontainer/` backed by Docker Compose:

- Services: a primary `devcontainer` plus colocated `mongodb` and `rabbitmq`
- Forwarded ports: 27017 (MongoDB), 5672/15672 (RabbitMQ)
- Workspace mount: `/workspaces/openpra-monorepo`

Key files:

- `.devcontainer/devcontainer.json` — container definition and forwarded ports
- `.devcontainer/docker-compose.yml` — Dev service + MongoDB + RabbitMQ
- `.devcontainer/Dockerfile` — Node 20 base with build/runtime deps and pnpm/nx

## Start the Dev Container (VS Code)

1. Ensure Docker is running locally
2. Install the "Dev Containers" extension
3. Open this repository in VS Code
4. When prompted, choose "Reopen in Container" (or run: Command Palette → Dev Containers: Reopen in Container)

VS Code will build the image and start the `devcontainer`, `mongodb`, and `rabbitmq` services.

## Start the Dev Container (Codespaces)

- Open the repository in GitHub and click Code → Codespaces → Create codespace on main.
- The `.devcontainer` config is honored by Codespaces. Ports will be auto-forwarded.

## First-run setup

Inside the container:

```bash
pnpm install
pnpm nx --version
```

Optionally start all apps:

```bash
pnpm nx run-many -t serve --all
```

Or start specific apps:

```bash
pnpm nx serve frontend-web-editor
pnpm nx serve web-backend
```

## Notes for tests on Debian 12-based containers

On Debian 12/bookworm images, `mongodb-memory-server` can fail due to OpenSSL 1.1 binaries. Our Jest setup falls back to a real Mongo instance via `MONGO_URI`.

Example:

```bash
export MONGO_URI="mongodb://127.0.0.1:27017/test"
pnpm nx test web-backend -- --test-timeout=60000
```

The Dev Container launches MongoDB internally on 27017; use `127.0.0.1` from inside the container.
