# Engine Overview

This guide provides a quick orientation to the solver engines and how their docs are organized.

## Projects

- PRAXIS (Rust): primary probabilistic risk analysis solver
  - Docs: [PRAXIS API](/api/rust/praxis/index.html)
- SCRAM (C++): fault tree analysis engine with Node.js bindings
  - Docs (C++): [Classes index](/api/cpp-doxybook2/index_classes.html)
  - Docs (C++): [Files index](/api/cpp-doxybook2/index_files.html)
  - Docs (C++): [Namespaces index](/api/cpp-doxybook2/index_namespaces.html)
  - Docs (TS bindings): [scram-node API](/api/ts/scram-node/README.html)

## Tech stack

- PRAXIS: Rust (nightly), compiled to a native binary
- SCRAM: C++ engine with Node.js bindings via node-addon-api and cmake-js
- Nx for orchestration; pnpm for package management

## Conventions

- C++ docs focus on the public API; internal and third-party namespaces are excluded from navigation.
- PRAXIS API docs are generated with cargo-docs-md from rustdoc JSON output.
- Source for SCRAM lives under `apps/solvers/scram`; PRAXIS lives under `apps/solvers/praxis`.
