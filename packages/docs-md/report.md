## title: "C++ Doc Converter Decision: Doxybook2"

# C++ Doc Converter Decision: Doxybook2

This document records the decision to use Doxybook2 for generating C++ Markdown from Doxygen XML in our unified documentation site. We previously evaluated Moxygen; the sections below summarize the rationale and the resulting implementation.

## Decision

Adopt Doxybook2 as the C++ Doxygen→Markdown converter for the OpenPRA docs site. Remove Moxygen from the toolchain.

## Rationale (Doxybook2 vs. Moxygen)

- Output structure
  - Moxygen: Produces a single, large README.md. Simple to wire, but it does not scale well and offers limited navigation for larger codebases.
  - Doxybook2: Generates a hierarchical Markdown tree (files, classes, namespaces), enabling rich cross-linking and intuitive navigation in static sites.
- Customization and control
  - Moxygen: Minimal configuration and limited templating.
  - Doxybook2: Configuration-driven with templates and knobs for naming, layout, and index pages; better fit for long-term documentation needs.
- Site integration
  - Doxybook2’s output maps cleanly to VitePress sidebars and nav items (Files, Classes, Namespaces), improving discoverability.

## Implementation summary

- Doxygen configuration: `packages/docs-md/tools/Doxyfile.xml` (recursive over scram-node headers), emitting XML under `packages/docs-md/.tmp/doxygen/doxygen-xml`.
- Converter: Doxybook2, installed on demand via `packages/docs-md/tools/install-doxybook2.sh` (Linux x86_64 v1.5.0).
- Output: `packages/docs-md/api/cpp-doxybook2/` with indices `index_files.html`, `index_classes.html`, and `index_namespaces.html`.
- Site wiring: VitePress nav and sidebar entries point to the Doxybook2 indices.
- CI: Included in the docs build; the site is published to GitHub Pages with a dynamic base path.

## Current status

- Moxygen has been removed from the docs package.
- Doxybook2 is fully wired; local and CI builds generate the structured C++ docs alongside TypeScript API docs.
- Link checks pass; the site renders with grouped TS sections and a C++ section backed by Doxybook2.

## Maintenance notes

- Doxygen must be available on the PATH locally; CI installs it via apt. Doxybook2 is fetched by the installer script during builds.
- As the C++ surface grows, adjust Doxygen INPUT paths and, if needed, Doxybook2 configuration (`packages/docs-md/tools/doxybook2.json`).
