import { defineConfig } from "vitepress";

// Allow setting a custom base path for GitHub Pages deployments
// Example: VITEPRESS_BASE="/openpra-monorepo/"
const base = (() => {
  const b = process.env.VITEPRESS_BASE || "/";
  if (!b.startsWith("/")) return `/${b}`;
  return b.endsWith("/") ? b : `${b}/`;
})();

export default defineConfig({
  base,
  title: "OpenPRA Documentation",
  description: "Unified docs for OpenPRA (TypeScript + C++)",
  srcDir: ".",
  outDir: ".vitepress/dist",
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      {
        text: "TS API",
        items: [
          { text: "Web Editor Utils", link: "/api/ts/web-editor/README.html" },
          { text: "Shared SDK", link: "/api/ts/shared-sdk/README.html" },
          { text: "Shared Types", link: "/api/ts/shared-types/README.html" },
          { text: "MEF Types", link: "/api/ts/mef-types/README.html" },
          { text: "MEF Schema", link: "/api/ts/mef-schema/README.html" },
          { text: "Model Generator", link: "/api/ts/model-generator/README.html" },
          { text: "Web Backend (NestJS)", link: "/api/ts/web-backend/README.html" },
          { text: "Job Broker (microservice)", link: "/api/ts/job-broker/README.html" },
        ],
      },
      { text: "C++ API (Doxybook2)", link: "/api/cpp-doxybook2/index_files.html" },
    ],
    sidebar: {
      "/api/ts/web-editor/": [
        { text: "Web Editor Utils", items: [{ text: "Index", link: "/api/ts/web-editor/README.html" }] },
      ],
      "/api/ts/shared-sdk/": [
        { text: "Shared SDK", items: [{ text: "Index", link: "/api/ts/shared-sdk/README.html" }] },
      ],
      "/api/ts/shared-types/": [
        { text: "Shared Types", items: [{ text: "Index", link: "/api/ts/shared-types/README.html" }] },
      ],
      "/api/ts/mef-types/": [{ text: "MEF Types", items: [{ text: "Index", link: "/api/ts/mef-types/README.html" }] }],
      "/api/ts/mef-schema/": [
        { text: "MEF Schema", items: [{ text: "Index", link: "/api/ts/mef-schema/README.html" }] },
      ],
      "/api/ts/model-generator/": [
        { text: "Model Generator", items: [{ text: "Index", link: "/api/ts/model-generator/README.html" }] },
      ],
      "/api/ts/web-backend/": [
        { text: "Web Backend (NestJS)", items: [{ text: "Index", link: "/api/ts/web-backend/README.html" }] },
      ],
      "/api/ts/job-broker/": [
        { text: "Job Broker", items: [{ text: "Index", link: "/api/ts/job-broker/README.html" }] },
      ],
      "/api/cpp-doxybook2/": [
        {
          text: "C++ (Doxybook2)",
          items: [
            { text: "Files", link: "/api/cpp-doxybook2/index_files.html" },
            { text: "Classes", link: "/api/cpp-doxybook2/index_classes.html" },
            { text: "Namespaces", link: "/api/cpp-doxybook2/index_namespaces.html" },
          ],
        },
      ],
    },
  },
  vite: {
    server: { host: true },
  },
});
