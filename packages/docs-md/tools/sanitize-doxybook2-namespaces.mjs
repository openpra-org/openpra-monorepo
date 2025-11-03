#!/usr/bin/env node
/**
 * Post-process Doxybook2 output to clean up Namespaces/Classes indexes:
 * - Remove anonymous namespace pages (…::@NN) produced by Doxygen
 * - Remove top-level hash-only namespaces like @79
 * - Drop namespace bullets from index_classes.md to keep it class-focused
 * - Strip corresponding entries from index_namespaces.md
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'packages/docs-md/api/cpp-doxybook2');
const NAMESPACES_DIR = path.join(ROOT, 'Namespaces');
const INDEX_NAMESPACES = path.join(ROOT, 'index_namespaces.md');
const INDEX_CLASSES = path.join(ROOT, 'index_classes.md');
const INDEX_FILES = path.join(ROOT, 'index_files.md');

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function removeAnonymousNamespacePages() {
  if (!exists(NAMESPACES_DIR)) return { removed: 0 };
  const files = fs.readdirSync(NAMESPACES_DIR);
  let removed = 0;
  for (const f of files) {
    // Matches: namespace_0d79.md, namespacescram_1_1mef_1_1_0d21.md, etc.
    if (/^namespace.*_0d[0-9a-f]+\.md$/i.test(f)) {
      fs.rmSync(path.join(NAMESPACES_DIR, f), { force: true });
      removed++;
    }
  }
  return { removed };
}

function sanitizeIndexNamespaces() {
  if (!exists(INDEX_NAMESPACES)) return { changed: false };
  const original = fs.readFileSync(INDEX_NAMESPACES, 'utf8');
  const lines = original.split(/\r?\n/);
  const cleaned = lines.filter((line) => {
    // Drop bullets for anonymous namespace entries like "namespace scram::mef::@21" or "namespace [@79]"
    if (/^\s*\*\s+\*\*namespace\s+\[[^\]]*::@\d+\]\(Namespaces\/[\w\-\.]+\)\s*\*\*/i.test(line)) return false;
    if (/^\s*\*\s+\*\*namespace\s+\[@\d+\]\(Namespaces\/namespace_0d[0-9a-f]+\.md\)\s*\*\*/i.test(line)) return false;
    // Optionally drop explicitly excluded third-party top-level namespaces if they leaked
    if (/\*\s+\*\*namespace\s+\[(Napi|boost|ext|ScramCLI)\]/.test(line)) return false;
    // Hide std from the Namespaces index (keep the page, just remove from index)
    if (/^\s*\*\s+\*\*namespace\s+\[std\]\(Namespaces\/namespacestd\.md\)\s*\*\*/.test(line)) return false;
    return true;
  }).join('\n');
  if (cleaned !== original) {
    fs.writeFileSync(INDEX_NAMESPACES, cleaned, 'utf8');
    return { changed: true };
  }
  return { changed: false };
}

function sanitizeIndexClasses() {
  if (!exists(INDEX_CLASSES)) return { changed: false };
  const original = fs.readFileSync(INDEX_CLASSES, 'utf8');
  // Replace HTML <br> tags with Markdown line breaks to avoid raw HTML in lists
  const withMdBreaks = original.replace(/<br\s*\/?>(\s*)/gi, '  \n$1  ');
  const lines = withMdBreaks.split(/\r?\n/);
  const cleaned = lines.filter((line) => {
    // Remove lines that are namespace bullets in the classes index
    // Examples:
    // * **namespace [scram](Namespaces/namespacescram.md)**
    //     * **namespace [core](Namespaces/namespacescram_1_1core.md)**
    return !(/^\s*\*\s+\*\*namespace\s+\[/.test(line));
  }).join('\n');
  if (cleaned !== original) {
    fs.writeFileSync(INDEX_CLASSES, cleaned, 'utf8');
    return { changed: true };
  }
  return { changed: false };
}

function sanitizeIndexFiles() {
  if (!exists(INDEX_FILES)) return { changed: false };
  const original = fs.readFileSync(INDEX_FILES, 'utf8');
  // Replace HTML <br> tags with Markdown line breaks for file entries
  const cleaned = original.replace(/<br\s*\/?>(\s*)/gi, '  \\n$1  ');
  if (cleaned !== original) {
    fs.writeFileSync(INDEX_FILES, cleaned, 'utf8');
    return { changed: true };
  }
  return { changed: false };
}

function main() {
  if (!exists(ROOT)) {
    console.log('[sanitize-namespaces] Skipping: directory not found:', ROOT);
    return;
  }
  const { removed } = removeAnonymousNamespacePages();
  const ns = sanitizeIndexNamespaces();
  const cls = sanitizeIndexClasses();
  const files = sanitizeIndexFiles();
  console.log(`[sanitize-namespaces] Removed anon namespace pages: ${removed}; index changes — namespaces: ${ns.changed}, classes: ${cls.changed}, files: ${files.changed}`);
}

main();
