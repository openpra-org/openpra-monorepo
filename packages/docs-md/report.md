## title: "C++ Doc Converters: Doxybook2 vs Moxygen (Spike)"

# C++ Doc Converters: Doxybook2 vs Moxygen (Spike)

This short report summarizes a quick spike comparing two Doxygen→Markdown converters for our unified docs pipeline.

Scope: Convert a subset of scram-node headers via Doxygen XML and render in VitePress alongside TypeScript API docs.

## Summary

- Moxygen works out of the box via npm (0.8.0). It produces a single consolidated README.md. Easy to wire, minimal structure.
- Doxybook2 typically generates a structured Markdown tree that mirrors code entities, better for browsing. It’s a native binary; not installed in this spike, so we left a placeholder. Installing it will allow a true content comparison.

## Comparison

- Output structure:
  - Moxygen: One large README.md (flat). Simple, low navigation depth, but can become unwieldy for large codebases.
  - Doxybook2: Hierarchical Markdown files (namespaces, classes, files). Better cross-links and sidebars in static sites.
- Linking/anchors:
  - Moxygen: Generates headings with anchors; fewer pages means fewer relative-link pitfalls, but long pages can be slow to scan.
  - Doxybook2: Rich cross-linking across pages; integrates well with SSG navs. Requires ensuring generated paths match site routing.
- Customization/templating:
  - Moxygen: Limited customization; focused on a readable README output.
  - Doxybook2: Configuration-driven output with templates; more knobs to tune structure and naming.
- Performance:
  - Both are fast for our current subset. In our runs, VitePress build was ~5.5s total with both TS and C++ content.
- Maintenance:
  - Moxygen: Minimal moving parts—good for a quick win or small C++ surface.
  - Doxybook2: Better long-term ergonomics if we want per-symbol pages and richer navigation.

## Current Spike Artifacts

- Doxygen XML: `packages/docs-md/.tmp/doxygen/doxygen-xml`
- Moxygen Markdown: `packages/docs-md/api/cpp-moxygen/README.md`
- Doxybook2: Placeholder at `packages/docs-md/api/cpp-doxybook2/README.md`
- TS Markdown (subset): `packages/docs-md/api/ts/README.md` plus module pages
- Site build output: `packages/docs-md/.vitepress/dist`

## Metrics (local, Node 20, Debian bookworm)

- VitePress build: ~5.5s
- Link check (linkinator): 12 links scanned, 0 broken
- TypeDoc run: 0 errors, 1 warning (external README path)

## Recommendation

- Keep both converters wired during the spike. Install doxybook2 locally to generate its real output for an apples-to-apples structure review.
- If we prefer a quick path: Moxygen is acceptable for small C++ docs, but it scales poorly.
- For long-term unified docs: Doxybook2 is likely the better fit due to structured output and navigation.

## Next Steps

1. Install `doxybook2` locally (or via CI image) and generate under `api/cpp-doxybook2`.
2. Expand Doxygen input to broader scram-node headers; reassess build time and navigation.
3. Tune VitePress sidebar generation for Doxybook2 output.
4. Decide on converter and promote the spike into a proper docs pipeline.
