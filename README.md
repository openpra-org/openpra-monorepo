# OpenPRA MonoRepo

Welcome to the OpenPRA Monorepo, the unified codebase for
the [OpenPRA application suite](https://docs.openpra.org/).
This repository uses the [Nx](https://nx.dev) build system, which encapsulates
and manages a collection of packages.
Together, these packages facilitate the maintenance
of [OpenPRA App](https://app.op), including the frontend, backend,
wrappers for underlying C/C++ engines, shared TypeScript definitions, and
utility packages for common functions.

For instance, the `openpra-json-schema` package centralizes the
[OpenPRA-MEF (Model Exchange Format) definitions](https://docs.openpra.org/en/model-exchange-formats),
while the
`shared-types` package leverages these definitions to create TypeScript types
and other shared data structures.

## Additional Documentation

Additional documentation can be found in the [Extended README](README/README.md)
section.

## Table of Contents

- [Packages](#packages)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [`nvm`](#nvm)
  - [`node`](#node)
  - [`pnpm`](#pnpm)
  - [`mongo`](#mongo)
- [Setup](#setup)
- [Development Steps](#development-steps)
  - [Command Line Usage](#command-line-usage)
  - [Installing Packages](#installing-packages)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Packages

Included within this monorepo are the following packages:

- `engine-scram-node`: Node.js wrappers for the `SCRAM` C/C++ engine.
- `frontend-web-editor`: A React v18 and TypeScript-based frontend UI.
- `model-generator`: A tool for creating models from predefined schemas.
- `shared-types`: Shared TypeScript definitions for consistent data structuring.
- `web-backend`: A NestJS and TypeScript backend service.

## Prerequisites

Before setting up the project, please ensure the following tools are installed
on your system, instructions for which
are provided in the following sections.

- `pnpm` (Package Manager)
- `nvm` (Node Version Manager)
- Node.js `lts/iron`
- MongoDB (for hosting a database)
  - [Optional] Native Mongo App
  - [Optional] Docker Desktop & Compose
- A Chromium-based web browser (for debugging in-browser Javascript with
  breakpoints)
- React Developer Tools

## Installation

### `nvm`

- **Linux**: Installation instructions can be
  found [here](https://github.com/nvm-sh/nvm).
- **Windows**: Download and
  install [nvm-setup.exe](https://github.com/coreybutler/nvm/releases).
- **MacOS**: Install Homebrew if not present with
  - `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"`
  - then `brew install nvm`

### `node`

Once installed, `nvm` can be used to download and use the `node` version of
choice. Install it using `nvm` with the
following commands:

```shell
nvm install 20.9.0
nvm use 20.9.0
```

### `pnpm`

- **Windows**: `winget install pnpm`.
- **macOS**: Install Homebrew if not present with
  - `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"`
  - then `brew install pnpm`
- **Linux**: Refer to
  the [PNPM installation guide](https://pnpm.io/installation) for your
  distribution.

### `mongo`

Choose one of the two options below, not both!

* #### Docker Desktop

  * Install
    the [Docker Desktop](https://www.docker.com/products/docker-desktop/) app
    for your OS.
  * Then, follow the instructions to
    install [Docker Compose v2](https://docs.docker.com/compose/install/).
  * Be sure to skip the `Native App` step in this case.

* #### Native App

  * For ease of development on Linux/MacOS, we have typically been
    using `Docker` and `docker compose` to spin up MongoDB.
  * However, you can also just download MongoDB for your OS and run it directly.
    If you intend to do this, follow the
    [official MongoDB installation guide](https://docs.mongodb.com/manual/installation/)
    for your OS.

### `React Developer Tools`

  * Install the [React Developer Tools](https://react.dev/learn/react-developer-tools) for your browser.
  * Verify the installation by going to the [React](https://react.dev/) Website and opening `Developer Tools` on your Browser.
  * You should have two additional tabs along with the already present ones - `Profiler` and `Components`.

## Setup

Once prerequisites are installed, initialize the project with these commands:

```shell
pnpm setup
pnpm install
pnpm install --global nx@17.1.2
```

### Nx Migrations [Admin Only]

```shell
nx migrate 17.1.2
pnpm install --no-frozen-lockfile
## if migrations.json was created, run:
nx migrate --run-migrations
```

For Windows users experiencing issues with `nx`, adjust the PowerShell script
execution policy:

```shell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

---

## Development Steps

Review the [WebStorm Config - Prettier & ESLint](./README/linting/README.md#webstorm-prettier-config) README.

### 1. Start the `mongo` database

Using one of the two options below, spin up an instance of the database

* #### Docker Compose
  * Set up a Docker-managed database environment with:
    ```shell
    docker compose -f docker/docker-compose.yml up -d
    ```

* #### Native App
  * You will need to figure out how to start the mongo server.

### 2. Start the `web-backend` debugger

To debug the frontend in JetBrains WebStorm using `nx` scripts:

1. Open the project in WebStorm.
2. Go to `Run` > `Edit Configurations`.
3. Add a new `Nx` configuration by choosing the `web-backend`.
4. Save the configuration.
5. Click the run icon to start the backend server. Once up, the debugger will
   attach to the running process.

### 3. Start the `web-editor` debuggers

To debug the backend in JetBrains WebStorm using `nx` scripts:

1. Open the project in WebStorm.
2. Navigate to `Run` > `Edit Configurations`.
3. Create a new `Nx` configuration for the `web-editor`.
4. Save and run the configuration.
5. Set up browser debugging
   following [WebStorm's guide](https://www.jetbrains.com/help/webstorm/debugging-javascript-in-chrome.html).

### 4. Other Targets

To debug any other build targets, or `CommonJS`, `Typescript`, or `Node.js`
packages, follow these general steps:

1. Open the project in WebStorm.
2. Go to `Run` > `Edit Configurations`.
3. Click the `+` button to add a new configuration.
4. Choose `Node.js` for CommonJS or Node.js packages, or `TypeScript` for
   TypeScript packages.
5. In the `JavaScript file` field, specify the path to the file you want to run
   or debug.
6. For Node.js applications, you can also specify environment variables, node
   parameters, and the working directory if needed.
7. Save the configuration by clicking `OK`.
8. Click the run icon to start the application or the debug icon to start
   debugging.

---

### Command Line Usage

You can always use the command line to serve or build any of the targets. `nx`
supports a wide range of commands, so be
sure to check out its documentation.

Some very basic examples include:

 - Serve packages concurrently
```shell
nx run-many -t serve --all
```

 - Serve packages individually:
```shell
nx serve web-editor
```
```shell
nx serve web-backend
```
```shell
nx serve shared-types
```

 - Run Jest unit tests and linting across the project with:
```shell
nx run-many -t test
```
 - Run ES linting across the project with:
```shell
nx run-many -t lint
```

### Installing Packages

When working within the monorepo, it's important to understand the distinction
between scoped packages and workspace-related packages.
Scoped packages are those that are specific to a particular package within the
monorepo, while the workspace package is the one defined
by the `package.json` at the repo root.

To install a new package, use the following commands:

- For scoped packages (specific to a project):
  ```shell
  pnpm --filter=<project-name> install --save-exact <package-name>
  ```
- For workspace-related packages (global to the monorepo):
  ```shell
  pnpm -w install --save-exact <package-name>
  ```

The `--save-exact` flag is enforced to ensure that the exact version of a
package is installed, which helps in maintaining consistency
and avoiding issues with minor updatesthat may introduce breaking changes.

When installing packages, you also need to decide whether to use `--save-dev`
or `--save`:

- Use `--save-dev` (or `-D`) for packages that are only needed during
  development or for building the project, such as linters, type definitions, or
  compilers.
  ```shell
  pnpm --filter=<project-name> install --save-dev --save-exact <package-name>
  ```
- Use `--save` (or no flag) for packages that are required at runtime by your
  package.
  ```shell
  pnpm --filter=<project-name> install --save --save-exact <package-name>
  ```

## Testing
For package specific testing documentation, refer to the package's corresponding
README.md file.

- [`frontend-web-editor`](packages/frontend/web-editor/README.md#Testing)

## Troubleshooting

- If dependency issues arise, check for proper camel casing in frontend
  component filenames and adjust as necessary.
- If `docker compose` fails to work, you can confirm that your configuration is
  valid by running `docker compose -f docker/docker-compose.yml config`

## License

This project is under the [GNU AGPLv3 license](LICENSE.md), which requires that
any networked use of a modified version
of the software must make the source code available. For more information,
visit [AGPL-3.0 license details](https://choosealicense.com/licenses/agpl-3.0/).
