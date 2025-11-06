import { defineConfig } from "vitepress";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  // Keep internal reports out of the published site
  // These artifacts are still generated under packages/docs-md/api/* for local inspection and CI,
  // but should not be emitted as public pages.
  srcExclude: [
    "api/ts/coverage.md",
    "api/ts/gaps-params.md",
    "api/cpp-doxybook2/coverage.md",
    // Exclude legacy path now replaced by /stack/
    "stack-overview/**",
  ],
  ignoreDeadLinks: true,
  // Disable raw HTML in Markdown globally to prevent Vue from parsing
  // generated C++ docs that may contain angle-bracket syntax that looks
  // like HTML. Authored pages can still use Vue-in-Markdown (<script setup>)
  // because that support is handled at the SFC compile stage, not via
  // markdown-it raw HTML.
  markdown: {
    config: (md) => {
      md.set({ html: false });
    },
  },
  // Enable Vue-in-Markdown features (e.g., <script setup>) for authored pages
  themeConfig: {
    // Feature flags (build-time)
    // Enable an additional "Explore source" section per TS package
    // to navigate by top-level src/ folders.
    // Set DOCS_ENABLE_SRC_EXPLORER=true to activate.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Node-style env at build time
    exploreEnabled: explorerEnabled,
    // Built-in local search (no external services required)
    search: {
      provider: "local",
    },
    nav: [
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
          { text: "Dev Container", link: "/guides/dev-container.html" },
          { text: "Building", link: "/guides/building.html" },
          { text: "Testing", link: "/guides/testing.html" },
          { text: "Contributing", link: "/guides/contributing.html" },
        ],
      },
      {
        text: "TS API",
        items: [
          { text: "Web Editor", link: "/api/ts/web-editor/README.html" },
          { text: "Shared SDK", link: "/api/ts/shared-sdk/README.html" },
          { text: "Shared Types", link: "/api/ts/shared-types/README.html" },
          { text: "MEF Types", link: "/api/ts/mef-types/README.html" },
          // Conditionally include MEF Schema nav entry if docs exist
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore Node env
          ...((
            fs.existsSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../api/ts/mef-schema/README.md"))
          ) ?
            [{ text: "MEF Schema", link: "/api/ts/mef-schema/README.html" }]
          : []),
          { text: "Model Generator", link: "/api/ts/model-generator/README.html" },
          { text: "Engine scram-node (TS)", link: "/api/ts/scram-node/README.html" },
          { text: "Web Backend (NestJS)", link: "/api/ts/web-backend/README.html" },
          { text: "Job Broker (microservice)", link: "/api/ts/job-broker/README.html" },
          // Coverage and param-gap pages are no longer surfaced
        ],
      },
      {
        text: "C++ API",
        items: [
          { text: "Classes", link: "/api/cpp-doxybook2/index_classes.html" },
          { text: "Files", link: "/api/cpp-doxybook2/index_files.html" },
          { text: "Namespaces", link: "/api/cpp-doxybook2/index_namespaces.html" },
          // Coverage page is no longer surfaced
        ],
      },
    ],
    sidebar: {
      "/stack/": [
        {
          text: "Stack",
          items: [
            { text: "Overview", link: "/stack/index.html" },
            { text: "MEF Technical Elements", link: "/stack/mef-technical-elements.html" },
            { text: "Frontend", link: "/stack/frontend-overview.html" },
            { text: "Backend", link: "/stack/backend-overview.html" },
            { text: "Engine", link: "/stack/engine-overview.html" },
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
          text: "Web Editor",
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
      // Only add MEF Schema sidebar if its docs are present
      ...(fs.existsSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../api/ts/mef-schema/README.md")) ?
        {
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
        }
      : {}),
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
            { text: "Files", link: "/api/cpp-doxybook2/index_files.html" },
            { text: "Namespaces", link: "/api/cpp-doxybook2/index_namespaces.html" },
            // Coverage page is no longer surfaced
          ],
        },
      ],
    },
  },
  vite: {
    server: { host: true },
    plugins: [
      // Pre-render version tokens on Stack pages so we can keep markdown.html=false safely
      {
        name: "inject-stack-versions",
        enforce: "pre",
        transform(code, id) {
          if (!id.endsWith(".md")) return null;
          const idPosix = id.replace(/\\/g, "/");
          if (!/\/stack\/(frontend-overview|backend-overview|engine-overview)\.md$/.test(idPosix)) {
            return null;
          }

          // Resolve repo root relative to this config file
          const __dirname = path.dirname(fileURLToPath(import.meta.url));
          const repoRoot = path.resolve(__dirname, "../../..");
          const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf-8"));

          // Common: root package
          const rootPkgPath = path.resolve(repoRoot, "package.json");
          const rootPkg = fs.existsSync(rootPkgPath) ? readJson(rootPkgPath) : {};

          // Prepare replacements per page
          const replacements: Record<string, string> = {};
          if (idPosix.endsWith("/stack/frontend-overview.md")) {
            const fePkgPath = path.resolve(repoRoot, "packages/frontend/web-editor/package.json");
            const fePkg = fs.existsSync(fePkgPath) ? readJson(fePkgPath) : {};
            replacements["react"] = fePkg?.dependencies?.react ?? "N/A";
            replacements["typescript"] =
              rootPkg?.devDependencies?.typescript ?? fePkg?.devDependencies?.typescript ?? "N/A";
            replacements["eui"] = fePkg?.dependencies?.["@elastic/eui"] ?? "N/A";
            replacements["reactRouter"] = fePkg?.dependencies?.["react-router-dom"] ?? "N/A";
            replacements["swr"] = fePkg?.dependencies?.swr ?? "N/A";
            replacements["nxVersion"] = rootPkg?.devDependencies?.nx ?? "N/A";
          } else if (idPosix.endsWith("/stack/backend-overview.md")) {
            const bePkgPath = path.resolve(repoRoot, "packages/web-backend/package.json");
            const bePkg = fs.existsSync(bePkgPath) ? readJson(bePkgPath) : {};
            replacements["nest"] =
              bePkg?.dependencies?.["@nestjs/core"] ?? bePkg?.dependencies?.["@nestjs/common"] ?? "N/A";
            replacements["mongoose"] = bePkg?.dependencies?.mongoose ?? "N/A";
            replacements["typescript"] = rootPkg?.devDependencies?.typescript ?? "N/A";
            replacements["nxVersion"] = rootPkg?.devDependencies?.nx ?? "N/A";
          } else if (idPosix.endsWith("/stack/engine-overview.md")) {
            const enPkgPath = path.resolve(repoRoot, "packages/engine/scram-node/package.json");
            const enPkg = fs.existsSync(enPkgPath) ? readJson(enPkgPath) : {};
            replacements["cmakeJs"] = enPkg?.dependencies?.["cmake-js"] ?? "N/A";
            replacements["nodeAddonApi"] = enPkg?.dependencies?.["node-addon-api"] ?? "N/A";
            replacements["nxVersion"] = rootPkg?.devDependencies?.nx ?? "N/A";
          }

          // Remove any <script setup> blocks (they're not allowed when markdown.html=false)
          let next = code.replace(/<script\s+setup>[^]*?<\/script>\s*/g, "");

          // Replace Vue moustache tokens with static values
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
