# OpenPRA Monorepo

## Packages

## Getting Started

You need `pnpm`, `nvm`, `node`, and `mongodb` installed.

### Installing PNPM

#### On Windows

```shell
winget install pnpm
```

#### On MacOS

Ensure that you have [Homebrew](https://brew.sh) installed.
If not, run this script in Terminal `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"`
Finally, install pnpm

```shell
brew install pnpm
```

#### On Linux

You don't need instructions do you big boy. DuckDuckGo it if you do.

### Installing NVM

#### On Windows

- Download and install [nvm-setup.exe](https://github.com/coreybutler/nvm/releases)
- Logout then login to add nvm and pnpm to your PowerShell `PATH`

### Installing Node

- We are sticking with `v20.2.0` since it will have [LTS support](https://nodejs.dev/en/about/releases/) `10/2023` through `06/2025`.

```shell
nvm install 20.2.0
nvm use 20.2.0
```

### Setup

```shell
pnpm setup #if this isn't working try and run "npm install -g pnpm", and then try again
pnpm install --shamefully-hoist=true
pnpm install --global nx@16.5.4 #you could also try nx@latest but ymmv
```

- On Windows, if you're unable to run `nx` post-install, set the following script execution policy in PowerShell.
- IMPORTANT!!!: You will have to run this script everytime you open a PowerShell for development.

```shell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

### For Development: Serve frontend & backend

```shell
nx serve frontend-web-editor
nx serve web-backend
```

Or, serve together

```shell
nx run-many -t serve
```

### For Deployment: Build frontend & backend

```shell
nx build frontend-web-editor
nx build web-backend
```

Or in parallel

```shell
nx run-many -t build
```

### Updating dependencies

```shell
npm i -g npm-check-updates
ncu -u
```

### Docker/Database

download docker here: https://www.docker.com/products/docker-desktop/
docker-compose up -d to spin up the database


### Fix for dependency errors

if files are already on file, make sure the files within frontend components have camelcasing on the file, rename them if they don't and it should fix

## Testing
We are using Jest and Cypress for testing.

### Jest
Jest Test Suites and Jest Tests are used together to structure your tests in a way that makes them easy to understand and manage. Here are some use cases for choosing to write a Jest Test Suite vs just Jest Tests:

1. **Grouping related tests**: Jest Test Suites (describe blocks) are used to group related tests together. This makes 
it easier to understand which parts of your code the tests are covering. If you're testing a single function or a small
piece of functionality, you might only need individual Jest Tests (it blocks). But if you're testing a larger feature or a whole module, it's helpful to group the tests into a suite.

2. **Shared setup and teardown**: If several tests need to run the same setup or teardown code, you can put that code in
beforeAll, beforeEach, afterEach, or afterAll blocks inside a test suite. This avoids repetition and keeps your tests
DRY (Don't Repeat Yourself).

3. **Scoped variables**: Variables declared in a describe block are available to all the tests and nested describe
blocks inside it. This can be useful for sharing values between tests, like instances of the objects you're testing.

4. **Nested suites**: You can nest describe blocks to create sub-groups of tests. This can be useful for testing
different aspects or sub-features of the code covered by the parent suite.

5. **Readability and organization**: Using test suites can make your test output easier to read, because Jest will print
the suite and test names in a hierarchical format. This can make it easier to see at a glance what's being tested and what the results are.

6. **Selective test running**: You can use Jest's CLI options to run only the tests in a specific suite, which can be
useful if you're working on a particular feature or if you want to isolate a failing test for debugging.
