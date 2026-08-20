# OpenPRA Monorepo

<a href="https://doi.org/10.5281/zenodo.10891407"><img src="https://zenodo.org/badge/DOI/10.5281/zenodo.10891407.svg" alt="DOI"></a> [![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

Welcome to the OpenPRA monorepo. This is the unified codebase for the OpenPRA App. It includes the web client, the backend REST API, distributed microservices, probabilistic risk assessment (PRA) solver engines, shared type definitions, and utility packages.

This README is a complete deployment guide:

1. [Local development](#5-run-the-app-locally-development-mode). Infrastructure in Docker, apps running natively with hot reload.
2. [Docker](#6-docker-deployment). The production container images, built and run on one machine.
3. [Cluster](#7-cluster-deployment-docker-swarm). Docker Swarm behind Traefik, driven by GitHub Actions.

## Repository layout

The repo is mid-migration. Active development happens under `apps/`. The old `packages/` tree is legacy and stays read-only until fully migrated. See `GUIDELINES.md` for the rules.

| Path                                   | Nx project name           | What it is                                                                            |
| -------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| `apps/frontends/web-frontend`          | `frontends-web-frontend`  | React 18 web client (webpack)                                                         |
| `apps/backends/web-backend`            | `backends-web-backend`    | NestJS REST API (Mongoose, MinIO, JWT, OAuth, 2FA)                                    |
| `apps/microservices/praetor`           | `praetor`                 | Distributed quantification broker and engine (RabbitMQ, MinIO)                        |
| `apps/interfaces/shared-types`         | `interfaces-shared-types` | Shared Zod schemas and inferred types                                                 |
| `apps/interfaces/mef-types`            | `interfaces-mef-types`    | OpenPRA MEF technical element types                                                   |
| `apps/solvers/scram`                   | none (CMake)              | SCRAM C++ PRA engine                                                                  |
| `apps/solvers/praxis`                  | none (Cargo)              | PRAXIS Rust solver                                                                    |
| `apps/solvers/xfta`                    | none                      | XFTA solver binary and documentation                                                  |
| `apps/solvers/{ftrex,zebra,saphsolve}` | none                      | Licensed solver directories, gitignored, absent from a fresh clone                    |
| `apps/utilities/pracciolini`           | none                      | Python model conversion tooling                                                       |
| `packages/*`                           | various                   | Legacy v1 packages (`frontend-web-editor`, `web-backend`, `engine-scram`, and others) |

### Services and ports

| Service                   | Port        | Notes                                            |
| ------------------------- | ----------- | ------------------------------------------------ |
| web-frontend (dev server) | 4201        | Proxies `/api` to the backend                    |
| web-backend               | 8000        | All routes under the `/api` prefix               |
| praetor manager           | 3000        | Swagger UI at `/q/docs`                          |
| MongoDB                   | 27017       | No auth in local dev                             |
| RabbitMQ                  | 5672, 15672 | Management UI on 15672, login `guest`/`guest`    |
| MinIO                     | 9000, 9001  | Console on 9001, login `minioadmin`/`minioadmin` |
| Full-Docker frontend      | 8080        | Only in the Docker deployment mode               |

---

## 1. Prerequisites

### Git and Git LFS

macOS: `brew install git git-lfs`. Debian and Ubuntu: `sudo apt-get install git git-lfs`. Windows: install [Git for Windows](https://git-scm.com/download/win) and [Git LFS](https://git-lfs.com/).

Then activate LFS once per machine:

```bash
git lfs install
```

### Node.js via nvm

macOS and Linux:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 20.17.0
nvm use 20.17.0
```

Windows: install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases/latest), then run the same two `nvm` commands.

### pnpm

```bash
npm install -g pnpm@10.19.0
```

### Docker

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) on macOS and Windows, or Docker Engine plus the compose plugin on Linux. Verify with `docker info`, which fails when the daemon is not running or not reachable. On Linux, also add your user to the docker group so you can use Docker without sudo: `sudo usermod -aG docker $USER`, then log out and back in.

## 2. Clone the repository

```bash
git clone --recurse-submodules https://github.com/openpra-org/openpra-monorepo.git
cd openpra-monorepo
git checkout main
git submodule update --init --recursive
```

The three submodules under `fixtures/models/` hold example model datasets (synthetic models, the Aralia fault tree dataset, and a generic PWR model). If you cloned without `--recurse-submodules`, the second `git submodule` command fetches them.

If you cloned before installing Git LFS, the PDF files are tiny pointer stubs. Fix with `git lfs pull`.

## 3. Install dependencies

From the repo root:

```bash
pnpm install
```

This installs every workspace package and sets up the Husky git hooks. A fresh clone resolves about 2700 packages, so the first install takes a few minutes. Reruns finish in seconds. Two notes.

- pnpm 10 blocks dependency build scripts by default. If pnpm prints a warning about ignored build scripts, run `pnpm approve-builds`, approve the listed packages, and run `pnpm install` again.
- A plain install does not compile any native modules. You do not need a C++ toolchain to run the web app.

## 4. Environment variables and secrets

### 4.1 How configuration is loaded

There are two env files that matter.

1. The root `.env` is **committed to git**. You already have it after cloning. It carries dev defaults for MongoDB, RabbitMQ, MinIO, and the full RabbitMQ queue topology (`MQ_*`). Nx loads it automatically for every task, which is how `praetor` and the legacy packages get their settings. Do not put personal secrets in it.
2. `apps/backends/web-backend/.env` is **gitignored and does not exist in a fresh clone**. The backend loads it from that exact path ([app.module.ts](apps/backends/web-backend/src/app.module.ts)). The backend refuses to boot without the required values in it. You must create this file.

The frontend needs no env file. It calls the backend with relative `/api` paths, and the dev server proxies those to `BACKEND_URL` (default `http://localhost:8000`).

### 4.2 Create the backend .env file

Create `apps/backends/web-backend/.env` with this content:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/openpra
PORT=8000
APP_BASE_URL=http://localhost:4201

JWT_SECRET=REPLACE_WITH_GENERATED_SECRET
JWT_EXPIRES_IN=7d

RESEND_API_KEY=local-placeholder
MAIL_FROM=noreply@localhost
MAIL_FROM_NAME=OpenPRA

TFA_ENC_KEY=REPLACE_WITH_GENERATED_SECRET
TFA_ISSUER=OpenPRA
TFA_TIME_URL=https://www.google.com/generate_204

OAUTH_CALLBACK_BASE=http://localhost:8000/api
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=openpra-web
MINIO_PUBLIC_URL=http://localhost:9000
```

Save the file as plain UTF-8. On Windows, create it in your editor rather than with `Out-File`, whose UTF-16 default produces a file the config loader cannot read.

What is required and what is optional:

| Variable                                                                                     | Required | Behavior                                                                                                                           |
| -------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`, `MAIL_FROM`                                                                | Yes      | Backend throws at boot if missing. A placeholder value boots fine. Only the password reset email actually sends mail.              |
| `TFA_ENC_KEY`                                                                                | Yes      | Backend throws at boot if missing. Encrypts stored 2FA secrets.                                                                    |
| `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_PUBLIC_URL` | Yes      | Backend throws at boot if missing. Buckets are created automatically on first use.                                                 |
| `MONGO_URI`                                                                                  | No       | Defaults to `mongodb://127.0.0.1:27017/openpra`. Note the name. It is `MONGO_URI`, not the `MONGO_URL` used by the legacy backend. |
| `JWT_SECRET`, `JWT_EXPIRES_IN`                                                               | No       | Insecure defaults exist. Always set `JWT_SECRET` anyway.                                                                           |
| `APP_BASE_URL`                                                                               | No       | CORS origin and the base for links in emails. Must equal the frontend origin.                                                      |
| `OAUTH_CALLBACK_BASE`                                                                        | No       | Base of the OAuth redirect URIs. Default `http://localhost:8000/api`.                                                              |
| `GOOGLE_*`, `GITHUB_*`                                                                       | No       | Leave empty and the social login buttons report the provider as not configured. Everything else works.                             |
| `PORT`, `MAIL_FROM_NAME`, `TFA_ISSUER`, `TFA_TIME_URL`                                       | No       | Sensible defaults.                                                                                                                 |

### 4.3 Generate secrets

Run this twice, once for `JWT_SECRET` and once for `TFA_ENC_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 4.4 Resend email key (optional for local dev)

Email is only sent for password resets. The placeholder value lets the backend boot. To make password reset actually deliver mail, create a free account at [resend.com](https://resend.com), create an API key under API Keys, set it as `RESEND_API_KEY`, and set `MAIL_FROM` to an address on a domain you verified in Resend.

### 4.5 Google OAuth app

Skip this if you do not need the Google login button.

1. Go to the [Google Cloud Console](https://console.cloud.google.com) and create or select a project.
2. Open APIs & Services, then OAuth consent screen. Configure it as External and add your teammates as test users.
3. Open APIs & Services, then Credentials. Click Create Credentials, then OAuth client ID, application type Web application.
4. Add this authorized redirect URI for local dev: `http://localhost:8000/api/auth/oauth/google/callback`
5. For a deployed instance, add `https://<your-host>/api/auth/oauth/google/callback` as well.
6. Copy the client ID and client secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

The redirect URI is always `${OAUTH_CALLBACK_BASE}/auth/oauth/google/callback`. It must match character for character or Google returns `redirect_uri_mismatch`.

### 4.6 GitHub OAuth app

Skip this if you do not need the GitHub login button.

1. Go to GitHub Settings, then Developer settings, then OAuth Apps, then New OAuth App.
2. Homepage URL: `http://localhost:4201`
3. Authorization callback URL: `http://localhost:8000/api/auth/oauth/github/callback`
4. Register, then click Generate a new client secret.
5. Copy both values into `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

A GitHub OAuth app holds a single callback URL. Create one app per environment (local, dev cluster, production).

## 5. Run the app locally (development mode)

### 5.1 Start the infrastructure

Make sure the Docker engine is actually running first. On macOS and Windows that means Docker Desktop is open. `docker compose version` succeeds even when the engine is down, so verify with `docker info` instead. If the engine is down you will see a `cannot connect to the Docker API` or npipe error on the next command.

`docker-compose.infra.yml` is gitignored, just like the backend `.env`, so a fresh clone does not contain it. Create it at the repo root with this content:

```yaml
services:
  mongodb:
    image: mongo:latest
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  rabbitmq:
    image: rabbitmq:management-alpine
    restart: unless-stopped
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
      - ./docker/configs/rabbitmq/enabled_plugins:/etc/rabbitmq/enabled_plugins

  minio:
    image: quay.io/minio/minio
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"

volumes:
  mongo_data:
  rabbitmq_data:
  minio_data:
```

Then start the stack:

```bash
docker compose -f docker-compose.infra.yml up -d
```

This starts MongoDB (27017), RabbitMQ (5672 and 15672), and MinIO (9000 and 9001) with persistent volumes. Verify:

```bash
docker compose -f docker-compose.infra.yml ps
```

All three should be `running`. The MinIO console is at http://localhost:9001 and the RabbitMQ UI at http://localhost:15672.

### 5.2 Start the backend

```bash
pnpm nx serve backends-web-backend
```

Wait for `web-backend listening on http://localhost:8000`. If the `.env` is missing or incomplete, the app compiles, maps all routes, and then dies at module init with an error naming one missing variable, for example `Error: MINIO_BUCKET is required but not set`, followed by `Process exited with code 1, waiting for changes to restart...`. Missing variables surface one at a time, so complete the whole template from section 4.2 instead of fixing them one by one.

### 5.3 Start the frontend

In a second terminal:

```bash
pnpm nx serve frontends-web-frontend
```

Open http://localhost:4201. Register an account with email and password. Login, projects, and workbooks all work at this point.

### 5.4 Start praetor (quantification)

Praetor is only needed for running quantification jobs. In two more terminals:

```bash
pnpm nx start-manager praetor
pnpm nx start-engine praetor
```

The manager listens on port 3000 with Swagger at http://localhost:3000/q/docs. Both processes read RabbitMQ and MinIO settings from the committed root `.env`, which Nx injects, and they create their MinIO buckets on first start. Both boot without any native addon. Executing a quantification job is what requires the `scram-node` addon. Building it requires CMake, g++, Boost, and libxml2 (`pnpm nx build engine-scram`). If you cannot build it on your machine, run praetor in Docker instead (section 6.3).

## 6. Docker deployment

This mode builds and runs the same production images that CI ships. Stop the dev infrastructure first so ports do not clash:

```bash
docker compose -f docker-compose.infra.yml down
```

### 6.1 Build the images

The steps below mirror `.github/workflows/cd-apps.yml`. Run them in bash from the repo root. On Windows use Git Bash or WSL.

```bash
pnpm nx build backends-web-backend --configuration=production
pnpm nx build frontends-web-frontend --configuration=production

mkdir -p docker-context/web-backend
cp dist/apps/backends/web-backend/main.js docker-context/web-backend/main.js
cp apps/backends/web-backend/package.json docker-context/web-backend/package.json
node -e '
  const fs = require("fs");
  const path = "docker-context/web-backend/package.json";
  const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
  for (const key of ["dependencies", "devDependencies"]) {
    if (!pkg[key]) continue;
    for (const [name, version] of Object.entries({ ...pkg[key] })) {
      if (typeof version === "string" && version.startsWith("workspace:")) delete pkg[key][name];
    }
  }
  delete pkg.devDependencies;
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2));
'
cp deploy/web/backend.Dockerfile docker-context/web-backend/Dockerfile
docker build -t openpra-apps-web-backend:local docker-context/web-backend

mkdir -p docker-context/web-frontend/html
cp -r dist/apps/frontends/web-frontend/* docker-context/web-frontend/html/
cp deploy/web/nginx.conf docker-context/web-frontend/nginx.conf
cp deploy/web/frontend.Dockerfile docker-context/web-frontend/Dockerfile
docker build -t openpra-apps-web-frontend:local docker-context/web-frontend
```

### 6.2 Run the full stack

```bash
docker compose -f docker/docker-compose.apps.yml up -d
```

Open http://localhost:8080. The compose file wires the frontend nginx to proxy `/api` to the backend, plus MongoDB and MinIO. Secrets default to local-only placeholders. Override them through the shell environment when needed, for example:

```bash
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))") \
docker compose -f docker/docker-compose.apps.yml up -d
```

For OAuth in this mode the callback base is `http://localhost:8080/api`, so the OAuth apps need `http://localhost:8080/api/auth/oauth/<provider>/callback` as an additional redirect URI.

Tear down with `docker compose -f docker/docker-compose.apps.yml down`.

### 6.3 Praetor in Docker

Praetor has a self-contained stack that builds the image (including the SCRAM native addon) and starts RabbitMQ and MinIO alongside it:

```bash
docker compose -f deploy/microservices/praetor/docker-compose.yml up --build -d
```

The build takes a while on the first run because it compiles the C++ addon. The manager is at http://localhost:3000/q/docs. Stop other stacks first to free the RabbitMQ and MinIO ports.

## 7. Cluster deployment (Docker Swarm)

Production and branch deployments run on Docker Swarm behind Traefik. There is no Kubernetes in this repo. Two ways to deploy follow: the GitHub Actions pipeline we use, and a manual path for your own cluster.

### 7.1 How our pipeline works

`.github/workflows/cd-apps.yml` runs on every push to `main` and on manual dispatch.

1. The build job compiles both apps, assembles the Docker contexts exactly as in section 6.1, and pushes the images to our private registry `registry.openpra.org` tagged with the short SHA and the branch slug.
2. The deploy job runs on the self-hosted runner `gaia1` (a Swarm manager). It populates a content-addressed volume with the example documents, then runs `docker stack deploy` with `deploy/web/cd-stack.yml`.
3. Traefik picks up the stack labels and serves the app at `https://<branch-slug>-dev.openpra.org`, with MinIO at `https://minio-<branch-slug>-dev.openpra.org`.

### 7.2 GitHub repository secrets

The pipeline needs these repository secrets. Without them the deploy job fails or the backend boots without OAuth and email.

| Secret                                               | Used for                                           |
| ---------------------------------------------------- | -------------------------------------------------- |
| `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`             | Login to `registry.openpra.org`                    |
| `APPS_JWT_SECRET`                                    | Backend `JWT_SECRET` (deploy fails fast if unset)  |
| `APPS_TFA_ENC_KEY`                                   | Backend `TFA_ENC_KEY` (deploy fails fast if unset) |
| `APPS_RESEND_API_KEY`                                | Backend `RESEND_API_KEY`                           |
| `APPS_GOOGLE_CLIENT_ID`, `APPS_GOOGLE_CLIENT_SECRET` | Google login                                       |
| `APPS_GH_CLIENT_ID`, `APPS_GH_CLIENT_SECRET`         | GitHub login                                       |

The OAuth apps for a cluster deployment need the callback `https://<host>/api/auth/oauth/<provider>/callback` registered, one per host.

### 7.3 One-time cluster preparation

On the machine that will be the Swarm manager:

```bash
docker swarm init
docker network create --driver=overlay traefik-public
```

Then deploy a Traefik v2 instance attached to `traefik-public` with a certificate resolver named `cloudflare`. `deploy/microservices/praetor/traefik-stack.yml` is a working starting point, but edit the ACME email and switch the resolver name or DNS provider to match your setup. `deploy/web/cd-stack.yml` references the resolver name `cloudflare` in its labels.

DNS: point `<host>` and `minio-<host>` at the cluster ingress.

Registry: the stack pulls images by name, so either push your images to a registry the cluster can reach and `docker login` on the manager, or build the images directly on the single node and deploy with `--resolve-image never`.

Placement: `deploy/web/cd-stack.yml` pins mongodb, minio, and the backend to `node.hostname == gaia`. On your own cluster, edit those `placement.constraints` to a hostname or label that exists, otherwise the services stay in `pending` forever.

### 7.4 Manual stack deploy

From a checkout on the Swarm manager, after building or pulling the two images:

```bash
export APP_NAME=openpra-apps-main
export HOST_URL=app.example.org
export IMAGE_BACKEND=openpra-apps-web-backend:local
export IMAGE_FRONTEND=openpra-apps-web-frontend:local
export IMAGE_MONGO=mongo:latest
export IMAGE_MINIO=minio/minio:latest
export JWT_SECRET=<generated>
export TFA_ENC_KEY=<generated>
export RESEND_API_KEY=<key or placeholder>
export GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= GITHUB_CLIENT_ID= GITHUB_CLIENT_SECRET=

export DOCS_HASH=$(find dist/apps/backends/web-backend/example-documents -type f -exec sha256sum {} \; | sort | sha256sum | cut -c1-16)
docker volume create "openpra-docs-$DOCS_HASH"
docker run --rm -v "openpra-docs-$DOCS_HASH":/dest -v "$PWD/dist/apps/backends/web-backend/example-documents":/src:ro \
  busybox sh -c 'cp -r /src/. /dest/'

docker stack deploy --with-registry-auth --resolve-image never \
  --compose-file deploy/web/cd-stack.yml "$APP_NAME"

docker service ls --filter "label=com.docker.stack.namespace=$APP_NAME"
```

`HOST_URL`, `JWT_SECRET`, and `TFA_ENC_KEY` are mandatory. The stack file rejects deployment when they are unset. Check `docker service ps <service> --no-trunc` for anything stuck in `pending` (usually a placement constraint) or restarting (usually a missing env value, check `docker service logs`).

### 7.5 Praetor on the cluster

Praetor has its own Swarm stack at `deploy/microservices/praetor/cd-stack.yml`. It expects the image in `IMAGE_BACKEND`, replica counts in `NUM_BROKERS` and `NUM_WORKERS`, placement pools in `DEPLOYMENT_BROKER_POOL` and `DEPLOYMENT_WORKER_POOL`, and two file-based secrets, `secrets/DSF_JWT_SECRET` and `secrets/CLOUDFLARE_TUNNEL_TOKEN`, relative to the stack file. Those two files are not in the repository. Create them on the swarm manager next to the stack file before deploying, the first holding a generated JWT secret and the second the Cloudflare tunnel token. It publishes the manager through a Cloudflare tunnel instead of Traefik.

## 8. Offline deployment (air-gapped machines)

For a machine with no internet access, nothing can be pulled or installed there. Instead, one connected machine builds a single self-contained tarball, and the offline machine only loads and runs it. Docker images carry everything, so the offline machine needs only Docker Engine with the compose plugin and a user in the docker group.

Build the bundle on a connected machine (Linux, or Docker Desktop on Windows and macOS, images are built for linux/amd64):

```bash
bash deploy/offline/make-bundle.sh /path/to/output
```

The bundle covers the web app only: frontend, backend, MongoDB, and MinIO. Praetor and the solver engines are excluded, since they are not needed by the web app. The script builds the backend and frontend images, pulls mongo and minio, saves all four images into one tar, and packs them with a self-contained compose file, the nginx proxy config, the example documents, an INSTALL.md, and a git bundle of the source. The result is `openpra-offline-bundle.tar.gz`.

If the offline machine might not have Docker at all, also build the Docker installer archive:

```bash
bash deploy/offline/make-docker-bundle.sh /path/to/output
```

This downloads the official static Docker binaries and the compose plugin, which work on any x86_64 Linux regardless of distribution, and packs them with an installer script as `docker-engine-offline.tar.gz` next to the app bundle. On the target machine, untar it and run `sudo bash install-docker.sh` first, then proceed with the app bundle.

On the offline machine:

```bash
tar -xzf openpra-offline-bundle.tar.gz
cd openpra-offline
docker load -i openpra-images.tar
docker compose up -d
```

The app is then at http://localhost:8080. The bundled `INSTALL.md` covers serving other machines on the network (`OPENPRA_HOST=<server-ip>`), overriding `JWT_SECRET` and `TFA_ENC_KEY`, and restoring the source from the git bundle.

Offline behavior to communicate to users: password reset emails cannot send, Google and GitHub login are unavailable so accounts use username and password, and 2FA verifies against the server clock. `TFA_TIME_URL` is deliberately unset in the offline compose so the backend never tries to reach the internet.

## 9. Troubleshooting

**The backend compiles, then exits with `... is required but not set`.** The first one you see is usually `Error: MINIO_BUCKET is required but not set`. Missing variables are reported one at a time, so do not fix them one by one. Create or complete the full `apps/backends/web-backend/.env` (section 4.2). This is the single most common failure for new setups.

**Mongo connects to the wrong database or not at all.** The current backend reads `MONGO_URI`. The legacy backend and the committed root `.env` use `MONGO_URL`. Set `MONGO_URI` in the backend `.env` and do not expect the root `.env` value to apply.

**`redirect_uri_mismatch` or OAuth error page.** The redirect URI registered with the provider must equal `${OAUTH_CALLBACK_BASE}/auth/oauth/<provider>/callback` exactly, including scheme and port.

**Social login buttons say the provider is not configured.** Both the client ID and the client secret for that provider must be non-empty in the backend env.

**Password reset emails never arrive.** You are running with the placeholder `RESEND_API_KEY`. Set a real key (section 4.4).

**CORS errors in the browser console.** `APP_BASE_URL` must equal the exact frontend origin, `http://localhost:4201` in dev mode.

**pnpm warns about ignored build scripts.** Run `pnpm approve-builds`, approve, and `pnpm install` again.

**`permission denied while trying to connect to the Docker daemon socket` on Linux.** Any image pull or compose command fails this way when your user cannot access `/var/run/docker.sock`. Make sure the daemon runs (`sudo systemctl enable --now docker`), add yourself to the docker group (`sudo usermod -aG docker $USER`), then log out and back in or run `newgrp docker`. Verify with `docker info` without sudo. Avoid running compose under sudo, since root then owns the containers and volumes.

**PDF files are one-line pointer files, or `git push` fails in the LFS hook.** Install Git LFS, run `git lfs install`, then `git lfs pull`.

**`fixtures/models/*` directories are empty.** Run `git submodule update --init --recursive`.

**Ports already in use.** The dev infra stack, the praetor Docker stack, and the full-Docker stack all bind MongoDB, RabbitMQ, or MinIO ports. Run one stack at a time, or `docker compose ... down` the others first.

**Swarm service stuck in `pending`.** A placement constraint references a node that does not exist. Edit the `placement.constraints` in the stack file (section 7.3).

**`nx run praetor:serve` fails.** That target does not exist. Use `start-manager` and `start-engine` (section 5.4).

---

# Development reference

## Testing and linting

```bash
pnpm nx run-many -t test
pnpm nx run-many -t lint
pnpm nx test backends-web-backend
pnpm nx typecheck frontends-web-frontend
```

Backend tests use `mongodb-memory-server` and fall back to a running MongoDB via `MONGO_URI` on platforms where the bundled binary fails (for example Debian 12 with OpenSSL 3):

```bash
export MONGO_URI="mongodb://127.0.0.1:27017/test"
pnpm nx test backends-web-backend
```

## Conventional commits

Commit messages must follow Conventional Commits. A Husky `commit-msg` hook runs Commitlint. Format: `type(scope): short description` with types `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`. If a commit is rejected, amend the message with `git commit --amend`. Hooks install automatically on `pnpm install`.

## Versioning and releases

Nx Release drives versioning, changelogs, npm publishing, and GitHub releases:

```bash
pnpm nx release version --dry-run
pnpm nx release version
pnpm nx release changelog
pnpm nx release publish
pnpm nx release github
```

The CI workflow is `.github/workflows/release.yml`. It needs the `NPM_TOKEN` and `MONGO_URI` secrets.

## Docs

```bash
pnpm nx run docs-md:site:build --no-cloud
pnpm --filter docs-md preview --host 127.0.0.1 --port 5050
```

The docs site deploys through `.github/workflows/docs.yml` to the Swarm as well.

## Citation

```bibtex
@software{openpra_initiative_2024_10891408,
  author       = {OpenPRA ORG Inc.},
  title        = {openpra-org/openpra-monorepo},
  month        = mar,
  year         = 2024,
  publisher    = {Zenodo},
  version      = {v0.1.1},
  doi          = {10.5281/zenodo.10891408},
  url          = {https://doi.org/10.5281/zenodo.10891408}
}
```

## License

MIT
