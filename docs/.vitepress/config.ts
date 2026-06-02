import { defineConfig, DefaultTheme } from "vitepress";
import fs from "node:fs";
import path from "node:path";

const srcRoot = process.cwd();

function buildSidebar(dir: string, urlBase: string): DefaultTheme.SidebarItem[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => {
    const rank = (n: string) => n === "modules.md" ? 0 : (n === "index.md" || n === "README.md") ? 1 : 2;
    const dr = rank(a.name) - rank(b.name);
    if (dr !== 0) return dr;
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  const items: DefaultTheme.SidebarItem[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const slug = entry.name.replace(/\.md$/, "");
      if (slug === "index" || slug === "README") {
        items.push({ text: "Overview", link: `${urlBase}/` });
      } else if (slug === "modules") {
        items.push({ text: "All Modules", link: `${urlBase}/modules` });
      } else {
        items.push({ text: slug, link: `${urlBase}/${slug}` });
      }
    } else if (entry.isDirectory()) {
      const sub = buildSidebar(path.join(dir, entry.name), `${urlBase}/${entry.name}`);
      if (sub.length > 0) items.push({ text: entry.name, collapsed: true, items: sub });
    }
  }
  return items;
}

function typeDocSidebar(pkgName: string, displayName: string): DefaultTheme.SidebarItem[] {
  const dir = path.resolve(srcRoot, `api/ts/${pkgName}`);
  const items = buildSidebar(dir, `/api/ts/${pkgName}`);
  if (items.length === 0) return [{ text: displayName, items: [{ text: "Not yet generated — run pnpm generate:ts:" + pkgName, link: "/" }] }];
  return [{ text: displayName, items }];
}


export default defineConfig({
  base: "/documentation/",
  title: "OpenPRA Documentation",
  description: "Full API documentation for the OpenPRA apps — generated from source",
  srcDir: ".",
  outDir: ".vitepress/dist",
  lastUpdated: true,
  appearance: "force-auto",
  ignoreDeadLinks: true,
  head: [["link", { rel: "icon", type: "image/png", href: "/documentation/openpra-logo.png" }]],
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
    search: { provider: "local" },
    nav: [
      { text: "Architecture", link: "/Architecture" },
      {
        text: "TypeScript",
        items: [
          { text: "MEF Types", link: "/api/ts/mef-types/modules" },
          { text: "Shared Types", link: "/api/ts/shared-types/modules" },
          { text: "Web Backend", link: "/api/ts/web-backend/modules" },
          { text: "Web Frontend", link: "/api/ts/web-frontend/modules" },
          { text: "Praetor", link: "/api/ts/praetor/modules" },
        ],
      },
      { text: "C++ (SCRAM)", link: "/api/cpp/scram/index.html", target: "_blank" },
      { text: "Rust (PRAXIS)", link: "/api/rust/praxis/praxis/index.html", target: "_blank" },
      {
        text: "Tooling",
        items: [
          { text: "Pracciolini", link: "/api/python/pracciolini/src.html", target: "_blank" },
          { text: "Benchmarking", link: "/utilities/benchmarking/" },
          { text: "Pracciolini — Knowledge Base", link: "/utilities/pracciolini/knowledge-base" },
        ],
      },
    ],
    sidebar: {
      "/api/ts/mef-types/": typeDocSidebar("mef-types", "MEF Types"),
      "/api/ts/shared-types/": typeDocSidebar("shared-types", "Shared Types"),
      "/api/ts/web-backend/": typeDocSidebar("web-backend", "Web Backend"),
      "/api/ts/web-frontend/": typeDocSidebar("web-frontend", "Web Frontend"),
      "/api/ts/praetor/": typeDocSidebar("praetor", "Praetor"),
      "/backends/": [
        {
          text: "Backends",
          items: [{ text: "web-backend", items: [{ text: "Auth", link: "/backends/web-backend/auth" }] }],
        },
      ],
      "/frontends/": [
        {
          text: "Frontends",
          items: [{ text: "web-frontend", items: [{ text: "Auth", link: "/frontends/web-frontend/auth" }] }],
        },
      ],
      "/utilities/": [
        {
          text: "Utilities",
          items: [
            { text: "Benchmarking", link: "/utilities/benchmarking/" },
            { text: "Pracciolini — Knowledge Base", link: "/utilities/pracciolini/knowledge-base" },
          ],
        },
      ],
    },
  },
});
