import { defineConfig } from "vitepress";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const base = (() => {
  const b = process.env.VITEPRESS_BASE || "/";
  if (!b.startsWith("/")) return `/${b}`;
  return b.endsWith("/") ? b : `${b}/`;
})();
const explorerEnabled = !(
  process.env.DOCS_ENABLE_SRC_EXPLORER === "0" || process.env.DOCS_ENABLE_SRC_EXPLORER === "false"
);
export default defineConfig({
  base,
  title: "OpenPRA Documentation",
  description: "Unified docs for OpenPRA (TypeScript + C++ + Rust + Python)",
  srcDir: ".",
  outDir: ".vitepress/dist",
  lastUpdated: true,
  appearance: "force-auto",
  head: [["link", { rel: "icon", type: "image/png", href: `${base}openpra-logo.png` }]],
  srcExclude: [
    "api/ts/coverage.md",
    "api/ts/gaps-params.md",
    "api/cpp-doxybook2/coverage.md",
    "stack-overview/**",
    "stack/mef-technical-elements.md",
  ],
  ignoreDeadLinks: true,
  markdown: {
    config: (md) => {
      md.set({ html: false });
    },
  },
  themeConfig: {
    logo: { src: "/openpra-logo.png", alt: "OpenPRA" },
    socialLinks: [{ icon: "github", link: "https://github.com/openpra-org/openpra-monorepo" }],
    footer: {
      message:
        'Released under the <a href="https://github.com/openpra-org/openpra-monorepo/blob/main/LICENSE">MIT License</a>.',
      copyright: 'Copyright © 2019-present <a href="https://openpra.org">OpenPRA ORG Inc.</a>',
    },
    exploreEnabled: explorerEnabled,
    search: {
      provider: "local",
    },
    nav: [
      {
        text: "MEF Technical Elements",
        link: "/mef-elements/index.html",
      },
      {
        text: "Stack",
        items: [
          { text: "Overview", link: "/stack/index.html" },
          { text: "Frontend", link: "/stack/frontend-overview.html" },
          { text: "Backend", link: "/stack/backend-overview.html" },
          { text: "Engine", link: "/stack/engine-overview.html" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "Building", link: "/guides/building.html" },
          { text: "Testing", link: "/guides/testing.html" },
          { text: "Contributing", link: "/guides/contributing.html" },
        ],
      },
      {
        text: "TS API",
        items: [
          { text: "Shared Types", link: "/api/ts/shared-types/README.html" },
          { text: "MEF Types", link: "/api/ts/mef-types/README.html" },
          { text: "Web Backend (NestJS)", link: "/api/ts/web-backend/README.html" },
          { text: "Web Frontend", link: "/api/ts/web-frontend/README.html" },
          { text: "Praetor", link: "/api/ts/praetor/README.html" },
          { text: "Engine scram-node (TS)", link: "/api/ts/scram-node/README.html" },
        ],
      },
      {
        text: "C++ API",
        items: [
          { text: "Classes", link: "/api/cpp-doxybook2/index_classes.html" },
          { text: "Files", link: "/api/cpp-doxybook2/index_files.html" },
          { text: "Namespaces", link: "/api/cpp-doxybook2/index_namespaces.html" },
        ],
      },
      { text: "Rust API", link: "/api/rust/praxis/index.html" },
      { text: "Python API", link: "/api/python/pracciolini/index.html" },
    ],
    sidebar: {
      "/stack/": [
        {
          text: "Stack",
          items: [
            { text: "Overview", link: "/stack/index.html" },
            { text: "Frontend", link: "/stack/frontend-overview.html" },
            { text: "Backend", link: "/stack/backend-overview.html" },
            { text: "Engine", link: "/stack/engine-overview.html" },
          ],
        },
      ],
      "/mef-elements/": [
        {
          text: "MEF Technical Elements",
          items: (() => {
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const repoRoot = path.resolve(__dirname, "../../..");
            const mefRoot = path.resolve(repoRoot, "packages/docs-md/mef-elements");
            const order: Array<{
              slug: string;
              text: string;
            }> = [
              { slug: "plant-operating-states-analysis", text: "Plant Operating States Analysis" },
              { slug: "initiating-event-analysis", text: "Initiating Event Analysis" },
              { slug: "event-sequence-analysis", text: "Event Sequence Analysis" },
              { slug: "success-criteria", text: "Success Criteria" },
              { slug: "systems-analysis", text: "Systems Analysis" },
              { slug: "data-analysis", text: "Data Analysis" },
              { slug: "event-sequence-quantification", text: "Event Sequence Quantification" },
              { slug: "mechanistic-source-term", text: "Mechanistic Source Term Analysis" },
              { slug: "radiological-consequence-analysis", text: "Radiological Consequence Analysis" },
              { slug: "risk-integration", text: "Risk Integration" },
            ];
            const encodeSeg = (s: string) => encodeURIComponent(s);
            const items: Array<{
              text: string;
              link: string;
            }> = [];
            for (const { slug, text } of order) {
              const dir = path.resolve(mefRoot, slug);
              if (!fs.existsSync(dir)) continue;
              const link = `/mef-elements/${encodeSeg(slug)}/index.html`;
              items.push({ text, link });
            }
            if (items.length === 0) {
              items.push({ text: "Index", link: "/mef-elements/index.html" });
            }
            return items;
          })(),
        },
      ],
      "/guides/": [
        {
          text: "Guides",
          items: [
            { text: "Building", link: "/guides/building.html" },
            { text: "Testing", link: "/guides/testing.html" },
            { text: "Contributing", link: "/guides/contributing.html" },
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
      "/api/ts/web-frontend/": [
        {
          text: "Web Frontend",
          items: [
            { text: "Index", link: "/api/ts/web-frontend/README.html" },
            { text: "Modules", link: "/api/ts/web-frontend/modules.html" },
            ...(explorerEnabled ?
              [{ text: "Explore src/ (by folder)", link: "/api/ts/web-frontend/_explore/index.html" }]
            : []),
          ],
        },
      ],
      "/api/ts/praetor/": [
        {
          text: "Praetor",
          items: [
            { text: "Index", link: "/api/ts/praetor/README.html" },
            { text: "Modules", link: "/api/ts/praetor/modules.html" },
            ...(explorerEnabled ?
              [{ text: "Explore src/ (by folder)", link: "/api/ts/praetor/_explore/index.html" }]
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
      "/api/cpp-doxybook2/": [
        {
          text: "C++ API",
          items: [
            { text: "Classes", link: "/api/cpp-doxybook2/index_classes.html" },
            { text: "Files", link: "/api/cpp-doxybook2/index_files.html" },
            { text: "Namespaces", link: "/api/cpp-doxybook2/index_namespaces.html" },
          ],
        },
      ],
      "/api/rust/praxis/": [
        {
          text: "PRAXIS (Rust)",
          items: [{ text: "Index", link: "/api/rust/praxis/index.html" }],
        },
      ],
      "/api/python/pracciolini/": [
        {
          text: "pracciolini (Python)",
          items: [{ text: "Index", link: "/api/python/pracciolini/index.html" }],
        },
      ],
    },
  },
  vite: {
    server: { host: true },
    plugins: [
      {
        name: "inject-stack-versions",
        enforce: "pre",
        transform(code, id) {
          if (!id.endsWith(".md")) return null;
          const idPosix = id.replace(/\\/g, "/");
          if (!/\/stack\/(frontend-overview|backend-overview|engine-overview)\.md$/.test(idPosix)) {
            return null;
          }
          const __dirname = path.dirname(fileURLToPath(import.meta.url));
          const repoRoot = path.resolve(__dirname, "../../..");
          const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf-8"));
          const rootPkgPath = path.resolve(repoRoot, "package.json");
          const rootPkg = fs.existsSync(rootPkgPath) ? readJson(rootPkgPath) : {};
          const replacements: Record<string, string> = {};
          if (idPosix.endsWith("/stack/frontend-overview.md")) {
            const fePkgPath = path.resolve(repoRoot, "apps/frontends/web-frontend/package.json");
            const fePkg = fs.existsSync(fePkgPath) ? readJson(fePkgPath) : {};
            replacements["react"] = fePkg?.dependencies?.react ?? "N/A";
            replacements["typescript"] = rootPkg?.devDependencies?.typescript ?? "N/A";
            replacements["reactRouter"] = fePkg?.dependencies?.["react-router-dom"] ?? "N/A";
            replacements["zustand"] = fePkg?.dependencies?.zustand ?? "N/A";
            replacements["zod"] = fePkg?.dependencies?.zod ?? "N/A";
            replacements["nxVersion"] = rootPkg?.devDependencies?.nx ?? "N/A";
          } else if (idPosix.endsWith("/stack/backend-overview.md")) {
            const bePkgPath = path.resolve(repoRoot, "apps/backends/web-backend/package.json");
            const bePkg = fs.existsSync(bePkgPath) ? readJson(bePkgPath) : {};
            replacements["nest"] =
              bePkg?.dependencies?.["@nestjs/core"] ?? bePkg?.dependencies?.["@nestjs/common"] ?? "N/A";
            replacements["mongoose"] = bePkg?.dependencies?.mongoose ?? "N/A";
            replacements["typescript"] = rootPkg?.devDependencies?.typescript ?? "N/A";
            replacements["nxVersion"] = rootPkg?.devDependencies?.nx ?? "N/A";
          }
          let next = code.replace(/<script\s+setup>[^]*?<\/script>\s*/g, "");
          for (const [key, val] of Object.entries(replacements)) {
            const re = new RegExp(String.raw`\{\{\s*${key}\s*\}\}`, "g");
            next = next.replace(re, String(val));
          }
          return { code: next, map: null };
        },
      },
    ],
  },
});
