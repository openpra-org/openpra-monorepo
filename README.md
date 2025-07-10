# OpenPRA monorepo

<a href="https://doi.org/10.5281/zenodo.10891407"><img src="https://zenodo.org/badge/DOI/10.5281/zenodo.10891407.svg" alt="DOI"></a> [![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

Welcome to the OpenPRA monorepo, the unified codebase for the [v2 OpenPRA App](https://v2-app.openpra.org/), which
includes the web client, backend REST APIs, distributed microservices, wrappers for underlying C/C++ probabilistic risk
assessment (PRA) engines, shared JSON schema definitions, and utility packages for automated PRA model generation.

## Internal Packages

Included within this monorepo are the following packages:

- `engine-scram-node`: Node.js wrappers for the `SCRAM` C/C++ engine.
- `frontend-web-editor`: A React v18 and TypeScript-based frontend UI.
- `mef-schema`: OpenPRA MEF JSON Schema definitions, generated using the `shared-types` package.
- `microservice-job-broker`: RabbitMQ based distributed queues for scaling quantification requests.
- `model-generator`: A tool for creating synthetic PRA models.
- `shared-types`: Shared TypeScript type definitions, serving as the single source of truth for all data types.
- `web-backend`: A NestJS REST-API backend service written in TypeScript.

We're managing this monorepo using the [Nx](https://nx.dev) build system, which enables flexible package bundling. For
instance, the `mef-schema` package centralizes the
[OpenPRA-MEF (Model Exchange Format) JSON definitions](https://docs.openpra.org/en/model-exchange-formats), generated
from the TypeScript definitions specified in the `shared-types` package.


# Quick Start Guide

Follow these steps to set up and run the project.

## Prerequisites

Make sure you have the following tools installed on your system:

- **Node.js v20.17.0** (managed via **nvm**)
- **pnpm** (Package Manager)
- **MongoDB**
- **RabbitMQ**

## Installation

### 1. Install **nvm** (Node Version Manager)

#### macOS and Linux

Run the following command in your terminal:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

After installation, restart your terminal or run `source ~/.bashrc` (or `source ~/.zshrc` for Zsh).

#### Windows

Download and run the [nvm Windows installer](https://github.com/coreybutler/nvm-windows/releases/latest/download/nvm-setup.zip).

### 2. Install **`node`**

Once installed, `nvm` can be used to download and use the `node` version of choice. Install it using `nvm` with the
following commands:

```shell
nvm install 20.17.0
nvm use 20.17.0
```

### 3. Install **pnpm** (Package Manager)

#### macOS and Linux

Run:

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

Ensure `pnpm` is added to your `PATH`. You may need to restart your terminal or run `source ~/.bashrc`.

#### Windows

Run:

```bash
npm install -g pnpm
```

### 4. Install **MongoDB**

Follow the official MongoDB installation guide for your operating system:

- **macOS**: [Install MongoDB on macOS](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-os-x/)
- **Windows**: [Install MongoDB on Windows](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-windows/)
- **Linux**: [Install MongoDB on Linux](https://docs.mongodb.com/manual/administration/install-on-linux/)

## Setup

Once prerequisites are installed, initialize the project with these commands:

```shell
pnpm setup
pnpm install
pnpm install --global nx@19.6.2
```

## Running the Project

### Start All Services Concurrently

To serve all packages at once, run:

```bash
nx run-many -t serve --all
```

### Start Individual Services

To serve a specific package, run:

- **Web Editor**:

  ```bash
  nx serve frontend-web-editor
  ```

- **Web Backend**:

  ```bash
  nx serve web-backend
  ```

## Testing and Linting

### Run Tests

Execute Jest unit tests:

```bash
nx run-many -t test
```

### Run Linting

Check code quality with ESLint:

```bash
nx run-many -t lint
```

## Additional Documentation

Additional documentation can be found in the [Extended README](README/README.md)
section.

---

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
