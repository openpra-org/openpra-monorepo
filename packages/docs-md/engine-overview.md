# Engine Overview

This guide provides a quick orientation to the engine and how its docs are organized.

## Projects

- Engine scram-node: Node.js wrappers around the SCRAM probabilistic risk analysis engine (C++)
  - Docs (C++): [Classes index](api/cpp-doxybook2/index_classes.html)
  - Docs (C++): [Namespaces index](api/cpp-doxybook2/index_namespaces.html)
  - Coverage: [api/cpp-doxybook2/coverage.html](api/cpp-doxybook2/coverage.html)

## Tech stack

- C++ SCRAM engine with Node.js bindings (scram-node)
- Doxygen + Doxybook2 for C++ doc extraction and Markdown generation
- VitePress for the docs site
- Nx for orchestration, pnpm for package management

## Conventions

- C++ docs focus on the public API; internal and third-party namespaces are excluded from navigation.
- Doxybook2 generates Markdown categories (Classes, Namespaces). YAML frontmatter is sanitized before VitePress build.
- Source lives under the monorepo `packages/engine/scram-node` wrapper; underlying engine components are documented via C++ API pages.

## Building docs

- C++ API docs are generated with Doxygen and converted to Markdown with Doxybook2; the site is built with VitePress.
- See the C++ API section in the site navigation for entry points.

Links

- C++ Classes: [api/cpp-doxybook2/index_classes.html](api/cpp-doxybook2/index_classes.html)
- C++ Namespaces: [api/cpp-doxybook2/index_namespaces.html](api/cpp-doxybook2/index_namespaces.html)
- C++ Coverage: [api/cpp-doxybook2/coverage.html](api/cpp-doxybook2/coverage.html)
