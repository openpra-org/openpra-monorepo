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
const OUT_ROOT = path.join(ROOT, 'packages/docs-md/mef-elements');

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

    // Create a canonical index.md per element for stable URLs (/mef-elements/<slug>/index.html)
    // Heuristic to pick a primary file: README.md > *Documentation*.md > first .md
    const lc = (s) => s.toLowerCase();
    const primary =
      collected.find((f) => lc(f.name) === "readme.md")?.name ||
      collected.find((f) => /documentation/i.test(f.name))?.name ||
      (collected[0] && collected[0].name);
    if (primary) {
      const primarySrc = path.join(outDir, primary);
      const primaryContent = fs.readFileSync(primarySrc, "utf-8");
      // Write content verbatim to index.md so sidebar can target a canonical page
      fs.writeFileSync(path.join(outDir, "index.md"), primaryContent);
    }

    catalog.push({ element: entry, title: toTitleCase(entry), files: collected });
  }

  // Write an index page linking to all copied files
  const lines = [
    '# MEF Technical Element Docs',
    '',
    'Authored documentation for each technical element',
    '',
  ];

  // Custom preferred ordering for technical elements (remaining will follow alphabetically):
  const preferredOrder = [
    'plant-operating-states-analysis',
    'initiating-event-analysis',
    'event-sequence-analysis',
    'success-criteria',
    'systems-analysis',
    'data-analysis',
    'event-sequence-quantification',
    'mechanistic-source-term',
    'radiological-consequence-analysis',
    'risk-integration',
  ];

  const catalogMap = new Map(catalog.map(c => [c.element, c]));
  const ordered = [];
  for (const key of preferredOrder) {
    const found = catalogMap.get(key);
    if (found) ordered.push(found);
  }
  // Append any remaining elements not explicitly ordered
  const remaining = catalog.filter(c => !preferredOrder.includes(c.element));
  remaining.sort((a, b) => a.element.localeCompare(b.element));
  ordered.push(...remaining);

  for (const entry of ordered) {
    lines.push(`## ${entry.title}`);
    lines.push('');
    // Link to the canonical element page (index.html) using a relative path so base paths work
    lines.push(`- [See ${entry.title}](${encodeHref(`./${entry.element}/index.html`)})`);
    lines.push('');
  }

  fs.writeFileSync(path.join(OUT_ROOT, 'index.md'), lines.join('\n'));
  console.log(`[mef:elements] Copied docs for ${catalog.length} element folder(s) to ${OUT_ROOT}`);
}

main();
