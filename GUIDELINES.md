# OpenPRA Monorepo — Rewrite Guidelines

Rules that apply to the ongoing rewrite of this repository. Every contributor — human or AI assistant — is expected to follow these.

## Workflow & communication

- **Answer first, then act.** Questions get a text answer before any code change. No diving straight into edits when a question was asked.
- **No unilateral folder decisions.** Propose any new directory (or rename / move) in text and wait for explicit approval before creating it.
- **No grouping wrappers without explicit approval.** Folders like `common/`, `utils/`, `shared/`, `helpers/`, `lib/` are off-limits unless the maintainer asks for them by name.
- **Don't overdo.** Implement what's asked. Don't extend scope, add hypothetical features, or insert defensive code for impossible cases.

## Git / commits

- **All commits attributed to the repo owner only.** Never add `Co-Authored-By: Claude` (or any other AI co-author trailer). Author and Committer must be the maintainer.
- **Conventional Commits style.** `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`. Subject ≤ ~70 characters. Detailed body when the change warrants it.
- **No `--no-verify`, no `--no-gpg-sign`, no skipping hooks.** If a hook fails, fix the underlying issue.
- **No force-push to `main`.** Never amend commits that have been pushed.

## Package & dependency rules

- **Pin exact versions in `package.json`.** Never use `^` or `~`. Match the existing pinning style.
- **No `shared-sdk`.** It was removed from the migration. Build types from scratch.
- **Zod everywhere for schemas.** No typia, no nestia. Frontend, backend, and `interfaces-shared-types` all use the same Zod major version (currently `4.3.6`).

## Architecture / layout

- **All new code goes in `apps/`, never `packages/`.** Old `packages/*` stays read-only until migrated.
  - `apps/backends/web-backend/` — NestJS API
  - `apps/frontends/web-frontend/` — React UI
  - `apps/interfaces/shared-types/` — Zod schemas + inferred TS types shared between sides
- **Domain-driven folder names.** `auth/` not `landing-page/`. `role/` not `permissions/`. Folders describe the feature, not the UI pattern.
- **Same domain folder name on both sides.** When a domain exists in frontend, backend, and shared-types, use the same folder name in all three (e.g. `auth/` in each).
- **No grouping wrappers inside `src/`.** No `components/`, no `context/`. Each domain folder owns its UI + state + API + CSS together. Example: `src/auth/` contains the forms, `AuthContext`, `authApi`, `authStorage`, and `css/`.
- **JSX and CSS are separated.** Component `.tsx` lives next to a `css/` subfolder. Import the stylesheet with `import "./css/<name>.css"`. Use BEM class naming (`.login-form__input--error`).
- **`docs/` mirrors `apps/`.** Documentation for `apps/backends/web-backend/` goes under `docs/backends/web-backend/`, and likewise for the frontend.
- **OpenPRA MEF schema is authoritative for technical elements.** The set of technical elements, their codes, names, and which risk modes include them must strictly conform to the OpenPRA Model Exchange Format schema (`apps/interfaces/mef-types/`). This rule applies to technical elements only — project-level metadata (status, progress, collaborators, etc.) is free to evolve independently. Both `web-backend` and `web-frontend` import the catalog from `interfaces-shared-types`, which derives it from MEF. Never hand-roll element lists in either app.

## Code quality

- **No `eslint-disable`.** Fix the rule violation, don't suppress it.
- **No comments explaining what code does.** Only the rare comment when the _why_ is non-obvious (a hidden invariant, a workaround for a specific bug, behavior that would surprise a reader). Identifiers carry the meaning.
- **No `any` / `never` / `unknown` type annotations.** Implicit `unknown` in `catch (err)` is fine; explicit annotations of those types are not.
- **No documentation files unless asked.** Don't auto-generate `README.md`, design docs, or planning files.

## Tests

- **Per-app `test/` folder at the app root** holds jest configs, setup files, and `tsconfig.spec.json`.
- **Per-domain `test/` subfolder** holds the spec files for that domain (e.g. `apps/backends/web-backend/src/auth/test/`, `apps/frontends/web-frontend/src/auth/test/`).
- **Frontend interactive tests:** React Testing Library + `@testing-library/user-event` + Jest under jsdom.
- **Backend functional tests:** Jest + `@nestjs/testing`, services and pipes in isolation, deps mocked.
- **Backend E2E tests:** `mongodb-memory-server` + supertest, real HTTP against a booted Nest app, transporter mocked.

## Naming conventions

- Frontend app: `web-frontend` (specific, not generic `frontend`). Nx project name: `frontends-web-frontend`. Dev port: `4201`.
- Backend app: `web-backend` (specific). Nx project name: `backends-web-backend`. Default port: `8000`.
- Shared types: `interfaces-shared-types` (path: `apps/interfaces/shared-types/`).
- CASL role context is `role`, not `ability`.
- Login and forgot-password use a single `identifier` field that accepts username OR email — not `username`.

## Security / runtime

- **Real SMTP, not stubs, in production paths.** Email goes through Nodemailer + Resend.
- **Fail hard at startup** on missing critical env vars (e.g. `RESEND_API_KEY`, `MAIL_FROM`). No silent fallbacks.
- **`.env` files live at `apps/<app>/.env`**, are `.gitignore`d, and never committed.
- **Passwords hashed with argon2.** Raw passwords are never stored or logged.
- **JWT signed with `JWT_SECRET`.** Default expiry `12h` (configurable via `JWT_EXPIRES_IN`).

## Design system (web-frontend)

- **Amethyst palette.** Primary `#7939b1`, surface-low `#f8f1ff`, background gradient `radial-gradient(ellipse at top left, #f0e8ff 0%, #fdf7ff 60%)`. Maintained across every screen.
- **Fonts.** Literata (headings) + Nunito Sans (body).
- **Form fields.** 12px border-radius. Focus ring `0 0 0 3px rgba(121, 57, 177, 0.12)`. Error border `#ba1a1a`.
- **Logo.** Use the `Logo.png` asset, never a placeholder monogram.
- **Constraint hints.** Show inline help text under labels for any field with non-obvious constraints (e.g. "At least 3 characters" under username, "At least 8 characters" under password).
- **Accessibility.** Every `<label>` uses `htmlFor` paired with a matching input `id`.
