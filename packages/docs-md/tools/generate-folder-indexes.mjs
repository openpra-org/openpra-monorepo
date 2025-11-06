#!/usr/bin/env node
/**
 * Generate shallow src/ folder index pages per TS package using TypeDoc JSON.
 *
 * Output structure (per package):
 *   api/ts/<pkg>/_explore/index.md           – landing page
 *   api/ts/<pkg>/_explore/<folder>.md        – top-level folder pages
 *
 * Links target the package's generated Modules pages:
 *   /api/ts/<pkg>/modules/<moduleName>.html
 *
 * This is additive and safe to run always; visibility is controlled by
 * VitePress via the DOCS_ENABLE_SRC_EXPLORER flag.
 */
import fs from 'fs';
import path from 'path';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(scriptDir, '../../..');
const docsRoot = path.join(repoRoot, 'packages', 'docs-md');

// Packages to process and human names for headings
const PACKAGES = [
  { id: 'web-editor', title: 'Web Editor' },
  { id: 'shared-sdk', title: 'Shared SDK' },
  { id: 'shared-types', title: 'Shared Types' },
  { id: 'mef-types', title: 'MEF Types' },
  { id: 'model-generator', title: 'Model Generator' },
  { id: 'web-backend', title: 'Web Backend (NestJS)' },
  { id: 'job-broker', title: 'Job Broker' },
  // scram-node is generated from d.ts; skip folder mapping by default
];

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(file) {
  try {
    const txt = fs.readFileSync(file, 'utf8');
    return JSON.parse(txt);
  } catch (e) {
    return null;
  }
}

function firstSourceFile(reflection) {
  if (!reflection) return undefined;
  if (Array.isArray(reflection.sources) && reflection.sources.length > 0) {
    return reflection.sources[0].fileName || reflection.sources[0].file;
  }
  return undefined;
}

function topLevelFolderFromPath(filePath) {
  // If TypeDoc didn't record a source file, treat as coming from src root
  if (!filePath) return 'root';
  // Normalize to POSIX-style
  const p = filePath.replace(/\\/g, '/');
  // Try to anchor on '/src/' if present
  const idx = p.lastIndexOf('/src/');
  if (idx !== -1) {
    const after = p.slice(idx + 5); // skip '/src/'
    const seg = after.split('/')[0];
    return seg || 'root';
  }
  // Fallback: take directory name at first level under package dir if we can infer
  const parts = p.split('/');
  const i = parts.findIndex((s) => s === 'src' || s === 'mef-types' || s === 'web-backend' || s === 'web-editor');
  if (i >= 0 && i + 1 < parts.length) return parts[i + 1];
  return 'root';
}

function collectModulesByFolder(projectJson) {
  const byFolder = new Map(); // folder -> array of { name, file }

  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.kindString === 'Module' || node.kind === 1) {
      const file = firstSourceFile(node);
      const folder = topLevelFolderFromPath(file);
      const arr = byFolder.get(folder) || [];
      // Module filename slug is its name in markdown output
      const moduleName = node.name; // e.g., "src_utils_scientificNotation"
      if (moduleName) arr.push({ name: moduleName, file });
      byFolder.set(folder, arr);
    }
    if (Array.isArray(node.children)) node.children.forEach(visit);
  }

  visit(projectJson);
  // Sort module lists alphabetically for stability
  for (const [folder, list] of byFolder.entries()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return byFolder;
}

function writeFolderPages(pkgId, pkgTitle, byFolder) {
  const outDir = path.join(docsRoot, 'api', 'ts', pkgId, '_explore');
  ensureDirSync(outDir);

  // Landing page
  const folders = [...byFolder.keys()].sort();
  const total = folders.reduce((n, f) => n + (byFolder.get(f)?.length || 0), 0);
  const displayName = (f) => (f === 'root' ? '(root)' : f);
  const indexMd = [
    `# Explore src/: ${pkgTitle}`,
    '',
    `Browse TypeDoc modules grouped by top-level src/ folders. This mirrors the source tree to make discovery easier.`,
    '',
    `Folders (${total} modules total):`,
    '',
    ...folders.map((f) => {
      const count = byFolder.get(f)?.length || 0;
      return `- [${displayName(f)}](./${encodeURIComponent(f)}.md) — ${count} module${count === 1 ? '' : 's'}`;
    }),
    '',
    `Prefer a flat view? See [All Modules](../modules.html).`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'index.md'), indexMd, 'utf8');

  // Folder pages
  for (const f of folders) {
    const list = byFolder.get(f) || [];
    const md = [
      `# ${pkgTitle} • src/${displayName(f)}`,
      '',
      `Modules defined under src/${displayName(f)}:`,
      '',
      ...list.map(({ name }) => `- [${name}](../modules/${name}.html)`),
      '',
      `Back to [Explore src/](./index.html).`,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(outDir, `${f}.md`), md, 'utf8');
  }
}

function main() {
  let wroteAny = false;
  for (const { id, title } of PACKAGES) {
    const jsonPath = path.join(docsRoot, 'api', 'ts', id, 'typedoc.json');
    const projectJson = readJsonSafe(jsonPath);
    if (!projectJson) {
      console.warn(`[folders] Skip ${id}: missing ${jsonPath}`);
      continue;
    }
    const byFolder = collectModulesByFolder(projectJson);
    if (byFolder.size === 0) {
      console.warn(`[folders] Skip ${id}: no modules found`);
      continue;
    }
    writeFolderPages(id, title, byFolder);
    wroteAny = true;
  }
  if (wroteAny) {
    console.log('[folders] Generated src/ folder indexes.');
  } else {
    console.log('[folders] Nothing to generate.');
  }
}

main();
