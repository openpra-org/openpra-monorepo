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
