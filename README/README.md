# Extended README

## Additional Documentation

- [Docker Configurations](../docker/README.md)
- [Linting](linting/README.md)
- [Scripts](../scripts/README.md)
- [Mongo Backups](mongo-backup/README.md)

### Nx Migrations [Admin Only]

```shell
nx migrate 19.6.2
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
and avoiding issues with minor updates that may introduce breaking changes.

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
