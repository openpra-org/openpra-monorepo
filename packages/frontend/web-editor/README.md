# frontend-web-editor

This is the `frontend-web-editor` package within the OpenPRA MonoRepo. It is a
React v18 and TypeScript-based frontend UI for the OpenPRA application suite.

## Features

- React v18 for building user interfaces
- TypeScript for type-safe code
- Integration with the OpenPRA backend services
- Jest for unit testing
- ESLint for code linting
- Webpack for bundling

## Installation

This package is part of the OpenPRA MonoRepo, and it should be managed with the
tools and commands provided by the monorepo's root `README.md`. Please refer to
the main [README.md](../../README.md) for installation instructions.

## Usage

To serve the `frontend-web-editor` package, you can use the following command
from the root of the monorepo:

```shell
nx serve frontend-web-editor
```

## Development

### Running the Development Server

To start the development server with hot module replacement (HMR), run:

```shell
nx serve frontend-web-editor
```

### Building the Package

To build the package for production, run:

```shell
nx build frontend-web-editor --configuration=production
```

For a development build, you can omit the `--configuration` flag.

### Running Tests

To execute the unit tests via [Jest](https://jestjs.io/), run:

```shell
nx test frontend-web-editor
```

### Linting

To lint the package, run:

```shell
nx lint frontend-web-editor
```

## Configuration

The package uses several configuration files for its operations:

- `jest.config.ts` for Jest configuration
- `tsconfig.app.json` and `tsconfig.spec.json` for TypeScript compiler options
- `webpack.config.js` for Webpack configuration
- `proxy.conf.json` for development server proxy configuration
