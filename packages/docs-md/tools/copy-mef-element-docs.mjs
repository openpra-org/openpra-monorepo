#!/usr/bin/env node
/**
 * Copy MEF technical element authored Markdown docs from mef-types into docs-md.
 *
 * - Scans packages/mef-types/src/lib/* for .md files under each technical element directory
 * - Copies them into packages/docs-md/stack/mef-elements/<element>/
 * - Generates an index at packages/docs-md/stack/mef-elements/index.md with links
 * - Idempotent: clears the output folder before writing
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, 'packages/mef-types/src/lib');
const OUT_ROOT = path.join(ROOT, 'packages/docs-md/stack/mef-elements');

/** Return true if p is a directory. */
function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Return a slug-friendly display name from a folder segment. */
function toTitleCase(seg) {
  return seg
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Copy a file, ensuring destination folder exists. */
function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const buf = fs.readFileSync(src);
  fs.writeFileSync(dst, buf);
}

/** Encode a relative href for Markdown links (preserve ./ and ../). */
function encodeHref(relPath) {
  const parts = relPath.split('/').map((seg) => encodeURIComponent(seg));
  return parts.join('/');
}

function main() {
  if (!isDir(SRC_ROOT)) {
    console.error(`[mef:elements] Source not found: ${SRC_ROOT}`);
    process.exit(1);
  }

  // Clean output directory for idempotent runs
  fs.rmSync(OUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(OUT_ROOT, { recursive: true });

  const entries = fs.readdirSync(SRC_ROOT);
  /** @type {Array<{ element: string; title: string; files: Array<{name: string; outRel: string;}> }>} */
  const catalog = [];

  for (const entry of entries) {
    const srcDir = path.join(SRC_ROOT, entry);
    if (!isDir(srcDir)) continue;

    // Only consider subfolders (technical elements); skip core/integration unless they have docs
    const mdFiles = fs
      .readdirSync(srcDir)
      .filter((f) => f.toLowerCase().endsWith('.md'))
      // Skip noisy or generic READMEs in element folders only if they are clearly placeholders
      .filter((f) => true);

    if (mdFiles.length === 0) continue;

    const outDir = path.join(OUT_ROOT, entry);
    fs.mkdirSync(outDir, { recursive: true });

    const collected = [];
    for (const file of mdFiles) {
      const src = path.join(srcDir, file);
      const dst = path.join(outDir, file);
      copyFile(src, dst);
      collected.push({ name: file, outRel: `./${encodeHref(`${entry}/${file}`)}` });
    }

    catalog.push({ element: entry, title: toTitleCase(entry), files: collected });
  }

  // Write an index page linking to all copied files
  const lines = [
    '# MEF Technical Element Docs',
    '',
    'Authored documentation for each technical element copied from `mef-types/src/lib/*`.',
    '',
    '> Links are relative so deployments under a base path work without changes.',
    '',
  ];

  // Stable sort by element name
  catalog.sort((a, b) => a.element.localeCompare(b.element));
  for (const entry of catalog) {
    lines.push(`## ${entry.title}`);
    lines.push('');
    for (const f of entry.files) {
      lines.push(`- [${f.name}](${f.outRel.replace(/\.md$/i, '.html')})`);
    }
    lines.push('');
  }

  fs.writeFileSync(path.join(OUT_ROOT, 'index.md'), lines.join('\n'));
  console.log(`[mef:elements] Copied docs for ${catalog.length} element folder(s) to ${OUT_ROOT}`);
}

main();
