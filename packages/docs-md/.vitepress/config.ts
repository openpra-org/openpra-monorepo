import { defineConfig } from "vitepress";

// Allow setting a custom base path for GitHub Pages deployments
// Example: VITEPRESS_BASE="/openpra-monorepo/"
const base = (() => {
  const b = process.env.VITEPRESS_BASE || "/";
  if (!b.startsWith("/")) return `/${b}`;
  return b.endsWith("/") ? b : `${b}/`;
})();

// Ensure all top-nav and sidebar links are base-aware in the generated HTML
const withBase = (p: string) => `${base}${p.replace(/^\//, "")}`;

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
    nav: [
      {
        text: "TS API",
        items: [
          { text: "Web Editor Utils", link: withBase("/api/ts/web-editor/README.html") },
          { text: "Shared SDK", link: withBase("/api/ts/shared-sdk/README.html") },
          { text: "Shared Types", link: withBase("/api/ts/shared-types/README.html") },
          { text: "MEF Types", link: withBase("/api/ts/mef-types/README.html") },
          { text: "MEF Schema", link: withBase("/api/ts/mef-schema/README.html") },
          { text: "Model Generator", link: withBase("/api/ts/model-generator/README.html") },
          { text: "Web Backend (NestJS)", link: withBase("/api/ts/web-backend/README.html") },
          { text: "Job Broker (microservice)", link: withBase("/api/ts/job-broker/README.html") },
        ],
      },
      { text: "C++ API (Doxybook2)", link: withBase("/api/cpp-doxybook2/index_files.html") },
    ],
    sidebar: {
      "/api/ts/web-editor/": [
        {
          text: "Web Editor Utils",
          items: [
            { text: "Index", link: withBase("/api/ts/web-editor/README.html") },
            { text: "Modules", link: withBase("/api/ts/modules.html") },
          ],
        },
      ],
      "/api/ts/shared-sdk/": [
        {
          text: "Shared SDK",
          items: [
            { text: "Index", link: withBase("/api/ts/shared-sdk/README.html") },
            { text: "Globals", link: withBase("/api/ts/shared-sdk/globals.html") },
          ],
        },
      ],
      "/api/ts/shared-types/": [
        {
          text: "Shared Types",
          items: [
            { text: "Index", link: withBase("/api/ts/shared-types/README.html") },
            { text: "Globals", link: withBase("/api/ts/shared-types/globals.html") },
          ],
        },
      ],
      "/api/ts/mef-types/": [
        {
          text: "MEF Types",
          items: [
            { text: "Index", link: withBase("/api/ts/mef-types/README.html") },
            { text: "Globals", link: withBase("/api/ts/mef-types/globals.html") },
          ],
        },
      ],
      "/api/ts/mef-schema/": [
        {
          text: "MEF Schema",
          items: [
            { text: "Index", link: withBase("/api/ts/mef-schema/README.html") },
            { text: "Globals", link: withBase("/api/ts/mef-schema/globals.html") },
          ],
        },
      ],
      "/api/ts/model-generator/": [
        {
          text: "Model Generator",
          items: [
            { text: "Index", link: withBase("/api/ts/model-generator/README.html") },
            { text: "Globals", link: withBase("/api/ts/model-generator/globals.html") },
          ],
        },
      ],
      "/api/ts/web-backend/": [
        {
          text: "Web Backend (NestJS)",
          items: [
            { text: "Index", link: withBase("/api/ts/web-backend/README.html") },
            { text: "Globals", link: withBase("/api/ts/web-backend/globals.html") },
          ],
        },
      ],
      "/api/ts/job-broker/": [
        {
          text: "Job Broker",
          items: [
            { text: "Index", link: withBase("/api/ts/job-broker/README.html") },
            { text: "Globals", link: withBase("/api/ts/job-broker/globals.html") },
          ],
        },
      ],
      "/api/cpp-doxybook2/": [
        {
          text: "C++ (Doxybook2)",
          items: [
            { text: "Files", link: withBase("/api/cpp-doxybook2/index_files.html") },
            { text: "Classes", link: withBase("/api/cpp-doxybook2/index_classes.html") },
            { text: "Namespaces", link: withBase("/api/cpp-doxybook2/index_namespaces.html") },
          ],
        },
      ],
    },
  },
  vite: {
    server: { host: true },
  },
});
