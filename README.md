# OpenPRA monorepo

<a href="https://doi.org/10.5281/zenodo.10891407"><img src="https://zenodo.org/badge/DOI/10.5281/zenodo.10891407.svg" alt="DOI"></a> [![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

Welcome to the OpenPRA monorepo. This is the unified codebase for the OpenPRA App. It includes the web client, the backend REST API, distributed microservices, probabilistic risk assessment (PRA) solver engines, shared type definitions, and utility packages.

This README is a complete deployment guide. It assumes you are setting up the repository for the first time. Follow it top to bottom and you will end with a running app. Three deployment modes are covered.

1. [Local development](#5-run-the-app-locally-development-mode). Infrastructure in Docker, apps running natively with hot reload.
2. [Docker](#6-docker-deployment). The production container images, built and run on one machine.
3. [Cluster](#7-cluster-deployment-docker-swarm). Docker Swarm behind Traefik, driven by GitHub Actions.

## Repository layout

The repo is mid-migration. Active development happens under `apps/`. The old `packages/` tree is legacy and stays read-only until fully migrated. See `GUIDELINES.md` for the rules.

| Path                                        | Nx project name           | What it is                                                                            |
| ------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| `apps/frontends/web-frontend`               | `frontends-web-frontend`  | React 18 web client (webpack)                                                         |
| `apps/backends/web-backend`                 | `backends-web-backend`    | NestJS REST API (Mongoose, MinIO, JWT, OAuth, 2FA)                                    |
| `apps/microservices/praetor`                | `praetor`                 | Distributed quantification broker and engine (RabbitMQ, MinIO)                        |
| `apps/interfaces/shared-types`              | `interfaces-shared-types` | Shared Zod schemas and inferred types                                                 |
| `apps/interfaces/mef-types`                 | `interfaces-mef-types`    | OpenPRA MEF technical element types                                                   |
| `apps/solvers/scram`                        | none (CMake)              | SCRAM C++ PRA engine                                                                  |
| `apps/solvers/praxis`                       | none (Cargo)              | PRAXIS Rust solver                                                                    |
| `apps/solvers/{ftrex,zebra,xfta,saphsolve}` | none                      | Third-party solver binaries and wrappers                                              |
| `apps/utilities/pracciolini`                | none                      | Python model conversion tooling                                                       |
| `packages/*`                                | various                   | Legacy v1 packages (`frontend-web-editor`, `web-backend`, `engine-scram`, and others) |

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

# Deployment guide

## 0. Walkthrough checklist

The condensed path. Each step links to the detailed section.

1. Install the [prerequisites](#1-prerequisites): git, Git LFS, nvm, Node 20.17.0, pnpm, Docker.
2. [Clone](#2-clone-the-repository) with submodules: `git clone --recurse-submodules https://github.com/openpra-org/openpra-monorepo.git`
3. `git checkout revamp`
4. `pnpm install`
5. Create [`apps/backends/web-backend/.env`](#42-create-the-backend-env-file) from the template below. This file is gitignored. Nobody gets it with the clone. Every fresh setup must create it.
6. Generate `JWT_SECRET` and `TFA_ENC_KEY` with the [one-liner](#43-generate-secrets).
7. Optionally create [Google](#45-google-oauth-app) and [GitHub](#46-github-oauth-app) OAuth apps and fill in the four client variables.
8. Start infrastructure: `docker compose -f docker-compose.infra.yml up -d`
9. Start the backend: `pnpm nx serve backends-web-backend`
10. Start the frontend in a second terminal: `pnpm nx serve frontends-web-frontend`
11. Open http://localhost:4201 and register a local account.
12. For quantification, start praetor: `pnpm nx start-manager praetor` and `pnpm nx start-engine praetor`.

## 1. Prerequisites

Install these before touching the repo.

| Tool                    | Version         | Why                                                                               |
| ----------------------- | --------------- | --------------------------------------------------------------------------------- |
| git                     | recent          | Clone and hooks                                                                   |
| Git LFS                 | recent          | Solver manual PDFs are LFS objects, and the pre-push hook runs `git lfs pre-push` |
| Node.js                 | 20.17.0 exactly | Pinned in `.node-version`                                                         |
| pnpm                    | 10.19.0         | The version CI uses                                                               |
| Docker + Docker Compose | recent          | Infrastructure and container deployments                                          |

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

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) on macOS and Windows, or Docker Engine plus the compose plugin on Linux. Verify with `docker compose version`.

## 2. Clone the repository

```bash
git clone --recurse-submodules https://github.com/openpra-org/openpra-monorepo.git
cd openpra-monorepo
git checkout revamp
git submodule update --init --recursive
```

The three submodules under `fixtures/models/` hold example model datasets (synthetic models, the Aralia fault tree dataset, and a generic PWR model). If you cloned without `--recurse-submodules`, the second `git submodule` command fetches them.

If you cloned before installing Git LFS, the PDF files are tiny pointer stubs. Fix with `git lfs pull`.

## 3. Install dependencies

From the repo root:

```bash
pnpm install
```

This installs every workspace package and sets up the Husky git hooks. Two notes.

- pnpm 10 blocks dependency build scripts by default. If pnpm prints a warning about ignored build scripts, run `pnpm approve-builds`, approve the listed packages, and run `pnpm install` again.
- A plain install does not compile any native modules. You do not need a C++ toolchain to run the web app.

## 4. Environment variables and secrets

This is the step most new setups fail on. Read it fully once.

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

Wait for `web-backend listening on http://localhost:8000`. If the process exits instead, the error names the missing env variable. Fix `apps/backends/web-backend/.env` and rerun.

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

The manager listens on port 3000 with Swagger at http://localhost:3000/q/docs. Both processes read RabbitMQ and MinIO settings from the committed root `.env`, which Nx injects. The engine needs the `scram-node` native addon to execute jobs. Building that addon requires CMake, g++, Boost, and libxml2 (`pnpm nx build engine-scram`). If you cannot build it on your machine, run praetor in Docker instead (section 6.3).

## 6. Docker deployment

This mode builds and runs the same production images that CI ships. Stop the dev infrastructure first so ports do not clash:

```bash
docker compose -f docker-compose.infra.yml down
```

> Do not use the root `docker-compose.yml` for this. It predates the revamp. It targets the legacy `packages/` project names and praetor targets that no longer exist.

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

`.github/workflows/cd-apps.yml` runs on every push to `revamp` and on manual dispatch.

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

Praetor has its own Swarm stack at `deploy/microservices/praetor/cd-stack.yml`. It expects the image in `IMAGE_BACKEND`, replica counts in `NUM_BROKERS` and `NUM_WORKERS`, placement pools in `DEPLOYMENT_BROKER_POOL` and `DEPLOYMENT_WORKER_POOL`, and two file-based secrets, `secrets/DSF_JWT_SECRET` and `secrets/CLOUDFLARE_TUNNEL_TOKEN`, relative to the stack file. It publishes the manager through a Cloudflare tunnel instead of Traefik.

## 8. Troubleshooting

**The backend exits immediately on boot.** The error names the missing variable, for example `RESEND_API_KEY is required` or `MINIO_ENDPOINT is required`. Create or complete `apps/backends/web-backend/.env` (section 4.2). This is the single most common failure for new setups.

**Mongo connects to the wrong database or not at all.** The revamp backend reads `MONGO_URI`. The legacy backend and the committed root `.env` use `MONGO_URL`. Set `MONGO_URI` in the backend `.env` and do not expect the root `.env` value to apply.

**`redirect_uri_mismatch` or OAuth error page.** The redirect URI registered with the provider must equal `${OAUTH_CALLBACK_BASE}/auth/oauth/<provider>/callback` exactly, including scheme and port.

**Social login buttons say the provider is not configured.** Both the client ID and the client secret for that provider must be non-empty in the backend env.

**Password reset emails never arrive.** You are running with the placeholder `RESEND_API_KEY`. Set a real key (section 4.4).

**CORS errors in the browser console.** `APP_BASE_URL` must equal the exact frontend origin, `http://localhost:4201` in dev mode.

**pnpm warns about ignored build scripts.** Run `pnpm approve-builds`, approve, and `pnpm install` again.

**PDF files are one-line pointer files, or `git push` fails in the LFS hook.** Install Git LFS, run `git lfs install`, then `git lfs pull`.

**`fixtures/models/*` directories are empty.** Run `git submodule update --init --recursive`.

**Ports already in use.** The dev infra stack, the praetor Docker stack, and the full-Docker stack all bind MongoDB, RabbitMQ, or MinIO ports. Run one stack at a time, or `docker compose ... down` the others first.

**Swarm service stuck in `pending`.** A placement constraint references a node that does not exist. Edit the `placement.constraints` in the stack file (section 7.3).

**`nx run praetor:serve` fails.** That target does not exist. Use `start-manager` and `start-engine` (section 5.4). The root `docker-compose.yml` still references the old targets and is not part of the supported paths.

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
pnpm nx run docs:build-site
python3 -m http.server 5050 -d dist/docs
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
