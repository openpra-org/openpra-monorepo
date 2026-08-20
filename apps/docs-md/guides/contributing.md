# Contributing

Thanks for your interest in contributing to OpenPRA! This page summarizes the contributor workflow; please read the full guidelines:

- Governance: https://github.com/openpra-org/openpra-monorepo/blob/main/GOVERNANCE.md
- Code of Conduct: https://github.com/openpra-org/openpra-monorepo/blob/main/CODE_OF_CONDUCT.md
- Contributing Guide (full): https://github.com/openpra-org/openpra-monorepo/blob/main/CONTRIBUTING.md
- License: https://github.com/openpra-org/openpra-monorepo/blob/main/LICENSE

## How to contribute (summary)

- Fork the repo and create branches from `main`.
- Open an issue for major changes to align on scope.
- Keep diffs focused; update docs/tests where applicable.

## Pull Requests

1. Create your branch from `main`.
2. Ensure tests and lints pass locally:
   ```bash
   pnpm nx run-many -t lint
   pnpm nx run-many -t test
   ```
3. Use Conventional Commits for messages, e.g.:
   - `feat(web-editor): add graph search`
   - `fix(web-backend): handle invalid ObjectId`
4. Link the PR to the related issue with GitHub keywords.

## Coding standards

- TypeScript: follow ESLint rules in the repo. Prefer clear names and small modules.
- Tests: add/adjust minimal unit/integration tests for behavioral changes.
- Docs: update the unified docs site when public behavior changes.

## Docs

- Build docs locally:
  ```bash
  pnpm nx run docs-md:site:build --no-cloud
  ```

## Dev Container

We provide a Dev Container with MongoDB and RabbitMQ. See the Dev Container guide for setup and tips.
