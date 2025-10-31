import { defineConfig } from "vitepress";

// Allow setting a custom base path for GitHub Pages deployments
// Example: VITEPRESS_BASE="/openpra-monorepo/"
const base = (() => {
  const b = process.env.VITEPRESS_BASE || "/";
  if (!b.startsWith("/")) return `/${b}`;
  return b.endsWith("/") ? b : `${b}/`;
})();

// Default-on explorer: allow disabling with DOCS_ENABLE_SRC_EXPLORER=0 or false
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Node-style env at build time
const explorerEnabled = !(
  process.env.DOCS_ENABLE_SRC_EXPLORER === "0" || process.env.DOCS_ENABLE_SRC_EXPLORER === "false"
);

export default defineConfig({
  base,
  title: "OpenPRA Documentation",
  description: "Unified docs for OpenPRA (TypeScript + C++)",
  srcDir: ".",
  outDir: ".vitepress/dist",
  ignoreDeadLinks: true,
  markdown: {
    // Disable raw HTML in Markdown to avoid Vue compile errors from generated docs
    config: (md) => {
      md.set({ html: false });
    },
  },
  themeConfig: {
    // Feature flags (build-time)
    // Enable an additional "Explore source" section per TS package
    // to navigate by top-level src/ folders.
    // Set DOCS_ENABLE_SRC_EXPLORER=true to activate.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Node-style env at build time
    exploreEnabled: explorerEnabled,
    nav: [
      {
        text: "Stack Overview",
        items: [
          { text: "Overview", link: "/stack-overview/index.html" },
          { text: "Frontend", link: "/stack-overview/frontend-overview.html" },
          { text: "Backend", link: "/stack-overview/backend-overview.html" },
          { text: "Engine", link: "/stack-overview/engine-overview.html" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "Dev Container", link: "/guides/dev-container.html" },
          { text: "Building", link: "/guides/building.html" },
          { text: "Testing", link: "/guides/testing.html" },
          { text: "Contributing", link: "/guides/contributing.html" },
        ],
      },
      {
        text: "TS API",
        items: [
          { text: "Web Editor Utils", link: "/api/ts/web-editor/README.html" },
          { text: "Shared SDK", link: "/api/ts/shared-sdk/README.html" },
          { text: "Shared Types", link: "/api/ts/shared-types/README.html" },
          { text: "MEF Types", link: "/api/ts/mef-types/README.html" },
          { text: "MEF Schema", link: "/api/ts/mef-schema/README.html" },
          { text: "Model Generator", link: "/api/ts/model-generator/README.html" },
          { text: "Engine scram-node (TS)", link: "/api/ts/scram-node/README.html" },
          { text: "Web Backend (NestJS)", link: "/api/ts/web-backend/README.html" },
          { text: "Job Broker (microservice)", link: "/api/ts/job-broker/README.html" },
          { text: "Coverage", link: "/api/ts/coverage.html" },
        ],
      },
      {
        text: "C++ API",
        items: [
          { text: "Classes", link: "/api/cpp-doxybook2/index_classes.html" },
          { text: "Namespaces", link: "/api/cpp-doxybook2/index_namespaces.html" },
          { text: "Coverage", link: "/api/cpp-doxybook2/coverage.html" },
        ],
      },
    ],
    sidebar: {
      "/stack-overview/": [
        {
          text: "Stack Overview",
          items: [
            { text: "Overview", link: "/stack-overview/index.html" },
            { text: "MEF Technical Elements", link: "/stack-overview/mef-technical-elements.html" },
            { text: "Frontend", link: "/stack-overview/frontend-overview.html" },
            { text: "Backend", link: "/stack-overview/backend-overview.html" },
            { text: "Engine", link: "/stack-overview/engine-overview.html" },
          ],
        },
      ],
      "/guides/": [
        {
          text: "Guides",
          items: [
            { text: "Dev Container", link: "/guides/dev-container.html" },
            { text: "Building", link: "/guides/building.html" },
            { text: "Testing", link: "/guides/testing.html" },
            { text: "Contributing", link: "/guides/contributing.html" },
          ],
        },
      ],
      "/api/ts/web-editor/": [
        {
          text: "Web Editor Utils",
          items: [
            { text: "Index", link: "/api/ts/web-editor/README.html" },
            { text: "Modules", link: "/api/ts/web-editor/modules.html" },
            // @ts-ignore injected at runtime via env
            ...(explorerEnabled ?
              [{ text: "Explore src/ (by folder)", link: "/api/ts/web-editor/_explore/index.html" }]
            : []),
          ],
        },
      ],
      "/api/ts/shared-sdk/": [
        {
          text: "Shared SDK",
          items: [
            { text: "Index", link: "/api/ts/shared-sdk/README.html" },
            { text: "Modules", link: "/api/ts/shared-sdk/modules.html" },
            ...(explorerEnabled ?
              [{ text: "Explore src/ (by folder)", link: "/api/ts/shared-sdk/_explore/index.html" }]
            : []),
          ],
        },
      ],
      "/api/ts/shared-types/": [
        {
          text: "Shared Types",
          items: [
            { text: "Index", link: "/api/ts/shared-types/README.html" },
            { text: "Modules", link: "/api/ts/shared-types/modules.html" },
            ...(explorerEnabled ?
              [{ text: "Explore src/ (by folder)", link: "/api/ts/shared-types/_explore/index.html" }]
            : []),
          ],
        },
      ],
      "/api/ts/mef-types/": [
        {
          text: "MEF Types",
          items: [
            { text: "Index", link: "/api/ts/mef-types/README.html" },
            { text: "Modules", link: "/api/ts/mef-types/modules.html" },
            ...(explorerEnabled ?
              [{ text: "Explore src/ (by folder)", link: "/api/ts/mef-types/_explore/index.html" }]
            : []),
          ],
        },
      ],
      "/api/mef/openpra-mef/": [
        {
          text: "MEF Technical Elements (Schemas)",
          items: [{ text: "Index", link: "/api/mef/openpra-mef/index.html" }],
        },
      ],
      "/api/ts/mef-schema/": [
        {
          text: "MEF Schema",
          items: [
            { text: "Index", link: "/api/ts/mef-schema/README.html" },
            { text: "Modules", link: "/api/ts/mef-schema/modules.html" },
            ...(explorerEnabled ?
              [{ text: "Explore src/ (by folder)", link: "/api/ts/mef-schema/_explore/index.html" }]
            : []),
          ],
        },
      ],
      "/api/ts/model-generator/": [
        {
          text: "Model Generator",
          items: [
            { text: "Index", link: "/api/ts/model-generator/README.html" },
            { text: "Modules", link: "/api/ts/model-generator/modules.html" },
            ...(explorerEnabled ?
              [{ text: "Explore src/ (by folder)", link: "/api/ts/model-generator/_explore/index.html" }]
            : []),
          ],
        },
      ],
      "/api/ts/scram-node/": [
        {
          text: "Engine scram-node (TS)",
          items: [
            { text: "Index", link: "/api/ts/scram-node/README.html" },
            { text: "Globals", link: "/api/ts/scram-node/globals.html" },
          ],
        },
      ],
      "/api/ts/web-backend/": [
        {
          text: "Web Backend (NestJS)",
          items: [
            { text: "Index", link: "/api/ts/web-backend/README.html" },
            { text: "Modules", link: "/api/ts/web-backend/modules.html" },
            ...(explorerEnabled ?
              [{ text: "Explore src/ (by folder)", link: "/api/ts/web-backend/_explore/index.html" }]
            : []),
          ],
        },
      ],
      "/api/ts/job-broker/": [
        {
          text: "Job Broker",
          items: [
            { text: "Index", link: "/api/ts/job-broker/README.html" },
            { text: "Modules", link: "/api/ts/job-broker/modules.html" },
            ...(explorerEnabled ?
              [{ text: "Explore src/ (by folder)", link: "/api/ts/job-broker/_explore/index.html" }]
            : []),
          ],
        },
      ],
      "/api/cpp-doxybook2/": [
        {
          text: "C++ API",
          items: [
            { text: "Classes", link: "/api/cpp-doxybook2/index_classes.html" },
            { text: "Namespaces", link: "/api/cpp-doxybook2/index_namespaces.html" },
            { text: "Coverage", link: "/api/cpp-doxybook2/coverage.html" },
          ],
        },
      ],
    },
  },
  vite: {
    server: { host: true },
  },
});
