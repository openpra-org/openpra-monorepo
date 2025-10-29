import { defineConfig } from "vitepress";

export default defineConfig({
  title: "OpenPRA Docs (MD Spike)",
  description: "Unified Markdown docs spike using VitePress",
  srcDir: ".",
  outDir: ".vitepress/dist",
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      { text: "TS API", link: "/api/ts/README.html" },
      { text: "C++ API (Doxybook2)", link: "/api/cpp-doxybook2/README.html" },
      { text: "C++ API (Moxygen)", link: "/api/cpp-moxygen/README.html" },
      { text: "Converter Report", link: "/report.html" },
    ],
    sidebar: {
      "/api/ts/": [{ text: "TypeScript API", items: [{ text: "Index", link: "/api/ts/README.html" }] }],
      "/api/cpp-doxybook2/": [
        { text: "C++ (Doxybook2)", items: [{ text: "Index", link: "/api/cpp-doxybook2/README.html" }] },
      ],
      "/api/cpp-moxygen/": [
        { text: "C++ (Moxygen)", items: [{ text: "Index", link: "/api/cpp-moxygen/README.html" }] },
      ],
    },
  },
  vite: {
    server: { host: true },
  },
});
