# Engine Overview

<script setup>
import rootPkg from '../../../package.json'
import enPkg from '../../engine/scram-node/package.json'
const nxVersion = rootPkg.devDependencies?.nx ?? 'N/A'
const cmakeJs = enPkg.dependencies?.['cmake-js'] ?? 'N/A'
const nodeAddonApi = enPkg.dependencies?.['node-addon-api'] ?? 'N/A'
</script>

This guide provides a quick orientation to the engine and how its docs are organized.

## Projects

- Engine scram-node: Node.js wrappers around the SCRAM probabilistic risk analysis engine (C++)
  - Docs (C++): [Classes index](api/cpp-doxybook2/index_classes.html)
  - Docs (C++): [Files index](api/cpp-doxybook2/index_files.html)
  - Docs (C++): [Namespaces index](api/cpp-doxybook2/index_namespaces.html)

## Tech stack

- C++ SCRAM engine with Node.js bindings (scram-node)
- CMake (system)
- cmake-js {{ cmakeJs }}
- node-addon-api {{ nodeAddonApi }}
- Nx {{ nxVersion }} for orchestration; pnpm for package management

## Conventions

- C++ docs focus on the public API; internal and third-party namespaces are excluded from navigation.
- Source lives under the monorepo `packages/engine/scram-node` wrapper; underlying engine components are documented via C++ API pages.
