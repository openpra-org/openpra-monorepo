# Web App and Site Deployment

CI/CD for the `apps/` web application and public site targets the `gaia1`
self-hosted runner. The web application deploys to
`https://<branch-slug>-dev.openpra.org`; the site deploys to `https://openpra.org`.

## Pipeline

`.github/workflows/cd-apps.yml` runs two jobs:

1. **build-and-push** (`ubuntu-latest`): builds `backends-web-backend`,
   `frontends-web-frontend`, and `site`, assembles per-service Docker contexts,
   and pushes to `registry.openpra.org`:
   - `openpra-apps-web-backend:<short-sha>` and `:<branch-slug>`
   - `openpra-apps-web-frontend:<short-sha>` and `:<branch-slug>`
   - `openpra-apps-site:<short-sha>` and `:<branch-slug>`
2. **deploy** (`gaia1`): deploys `deploy/web/cd-stack.yml` as stack
   `openpra-apps-<branch-slug>` and `deploy/site/cd-stack.yml` as the independent
   `openpra-site` stack.

Triggers: `workflow_dispatch` and `push` to `main`.

## Stack services (`cd-stack.yml`)

- **frontend** — nginx serving the static SPA; Traefik routes `Host(<host>)`.
- **backend** — NestJS on port 8000; Traefik routes `Host(<host>) && PathPrefix(/api)`.
- **mongodb** — internal only, `mongodb_data` volume.
- **minio** — exposed at `minio-<host>` (browser loads avatars/covers directly
  from `MINIO_PUBLIC_URL`), `minio_data` volume.
- **site** — nginx serving the Astro static output at `https://openpra.org`
  through the separate `openpra-site` stack.

TLS is issued by the existing `traefik-public` Traefik via the `cloudflare`
cert resolver; the stack attaches to the external `traefik-public` network.

## Required GitHub Actions secrets

Shared registry credentials:

- `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`

New, for this app (Actions forbids secret names starting with `GITHUB_`, hence
the `APPS_GH_*` names):

- `APPS_JWT_SECRET` — backend JWT signing key
- `APPS_GOOGLE_CLIENT_ID`, `APPS_GOOGLE_CLIENT_SECRET`
- `APPS_GH_CLIENT_ID`, `APPS_GH_CLIENT_SECRET` (GitHub OAuth app)
- `APPS_RESEND_API_KEY` — transactional email
- `APPS_TFA_ENC_KEY` — 32-byte hex key encrypting TOTP secrets at rest

Non-secret runtime config (Mongo URI, MinIO creds/buckets, mail-from, TFA
issuer/time URL, ports) is set inline in `cd-stack.yml`.

## One-time external setup

- **DNS**: `<branch-slug>-dev.openpra.org`,
  `minio-<branch-slug>-dev.openpra.org`, and `openpra.org` must resolve to the
  Traefik ingress. The wildcard record covers the subdomains; the apex needs its
  own DNS record.
- **OAuth redirect URIs**: add the deployed callbacks to each provider console,
  or OAuth login fails:
  - Google: `https://<host>/api/auth/oauth/google/callback`
  - GitHub: `https://<host>/api/auth/oauth/github/callback`
  - (confirm exact paths against `auth.controller.ts`)
- **Swarm prerequisites on gaia1**: member of the swarm that runs `traefik-public`
  with the `cloudflare` cert resolver. For a multi-node swarm, pin `mongodb` and
  `minio` to a fixed node so their volumes stay put.
