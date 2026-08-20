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
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: `${base}favicon.svg` }],
    ["link", { rel: "alternate icon", href: `${base}favicon.ico` }],
    ["link", { rel: "apple-touch-icon", href: `${base}apple-touch-icon.png` }],
    ["meta", { name: "theme-color", content: "#8F4EC7" }],
    ["meta", { property: "og:image", content: `${base}brand/social-card-light.png` }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
  ],
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
    logo: {
      light: "/brand/lockup-primary.svg",
      dark: "/brand/lockup-dark.svg",
      alt: "OpenPRA",
    },
    siteTitle: "Documentation",
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
          { text: "MEF Types", link: "/mef-elements/ts/README.html" },
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
          items: [
            { text: "Overview", link: "/mef-elements/index.html" },
            {
              text: "Plant Operating States Analysis",
              link: "/mef-elements/ts/pos/plant-operating-state-analysis/README.html",
            },
            {
              text: "Initiating Event Analysis",
              link: "/mef-elements/ts/ie/initiating-event-analysis/README.html",
            },
            { text: "Event Sequence Analysis", link: "/mef-elements/ts/es/event-sequence-analysis/README.html" },
            { text: "Success Criteria", link: "/mef-elements/ts/sc/success-criteria-development/README.html" },
            { text: "Systems Analysis", link: "/mef-elements/ts/sy/systems-analysis/README.html" },
            {
              text: "Human Reliability Analysis",
              link: "/mef-elements/ts/hr/human-reliability-analysis/README.html",
            },
            { text: "Data Analysis", link: "/mef-elements/ts/da/data-analysis/README.html" },
            {
              text: "Event Sequence Quantification",
              link: "/mef-elements/ts/esq/event-sequence-quantification/README.html",
            },
            {
              text: "Mechanistic Source Term Analysis",
              link: "/mef-elements/ts/ms/mechanistic-source-term-analysis/README.html",
            },
            {
              text: "Radiological Consequence Analysis",
              link: "/mef-elements/ts/rc/radiological-consequence-analysis/README.html",
            },
            { text: "Risk Integration", link: "/mef-elements/ts/ri/risk-integration/README.html" },
          ],
        },
        {
          text: "Reference",
          items: [
            { text: "All TypeScript modules", link: "/mef-elements/ts/README.html" },
            { text: "All Zod modules", link: "/mef-elements/zod/README.html" },
          ],
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
      "/api/rust/praxis/": (() => {
        const dirOf = path.dirname(fileURLToPath(import.meta.url));
        const root = path.resolve(dirOf, "../../..", "packages/docs-md/api/rust/praxis");
        const items: Array<{
          text: string;
          link: string;
        }> = [{ text: "Overview", link: "/api/rust/praxis/index.html" }];
        if (fs.existsSync(root)) {
          for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
            if (entry.isDirectory()) {
              if (fs.existsSync(path.resolve(root, entry.name, "index.md"))) {
                items.push({ text: entry.name, link: `/api/rust/praxis/${entry.name}/index.html` });
              }
            } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "index.md") {
              const base = entry.name.slice(0, -3);
              items.push({ text: base, link: `/api/rust/praxis/${base}.html` });
            }
          }
        }
        return [{ text: "PRAXIS (Rust)", items }];
      })(),
      "/api/python/pracciolini/": (() => {
        const dirOf = path.dirname(fileURLToPath(import.meta.url));
        const root = path.resolve(dirOf, "../../..", "packages/docs-md/api/python/pracciolini");
        const items: Array<{
          text: string;
          link: string;
        }> = [{ text: "Overview", link: "/api/python/pracciolini/index.html" }];
        if (fs.existsSync(root)) {
          for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
            if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "index.md") {
              const base = entry.name.slice(0, -3);
              items.push({ text: base, link: `/api/python/pracciolini/${base}.html` });
            }
          }
        }
        return [{ text: "pracciolini (Python)", items }];
      })(),
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
