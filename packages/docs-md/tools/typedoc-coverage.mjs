#!/usr/bin/env node
/*
  Lightweight docs coverage snapshot for TypeScript packages.
  - Scans packages/docs-md/api/ts/<pkg> for Markdown files
  - Reports counts and a rough "contentful" ratio (files containing at least one secondary heading)
  - Always exits 0 (informational only)
*/
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname, relative } from 'path';

const ROOT = process.cwd();
const TS_DOCS_DIR = join(ROOT, 'packages/docs-md/api/ts');
const CPP_DOCS_DIR = join(ROOT, 'packages/docs-md/api/cpp-doxybook2');

// Only include actual Nx TS packages we generate docs for.
// Keep this list in sync with docs nav and ts:markdown targets in project.json
const TS_ALLOWED_FOLDERS = new Set([
  'web-editor',
  'shared-sdk',
  'shared-types',
  'mef-types',
  'mef-schema',
  'model-generator',
  'web-backend',
  'job-broker',
]);

function listDirs(dir) {
  try {
    return readdirSync(dir)
      .map((name) => ({ name, path: join(dir, name) }))
      .filter((e) => {
        try { return statSync(e.path).isDirectory(); } catch { return false; }
      });
  } catch {
    return [];
  }
}

function listFilesRecursive(dir, predicate) {
  const out = [];
  function walk(d) {
    let entries = [];
    try { entries = readdirSync(d); } catch { return; }
    for (const name of entries) {
      const p = join(d, name);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p);
      else if (!predicate || predicate(p)) out.push(p);
    }
  }
  walk(dir);
  return out;
}

function isMarkdown(p) { return extname(p).toLowerCase() === '.md'; }

function contentfulScore(mdText) {
  // Count occurrences of h2/h3 headings as a proxy for documented content
  // Ignore frontmatter-like blocks and consider files with >0 secondary headings as contentful
  const lines = mdText.split(/\r?\n/);
  let score = 0;
  for (const ln of lines) {
    const s = ln.trim();
    if (s.startsWith('---')) continue; // ignore potential frontmatter
    if (s.startsWith('## ')) score++;
    else if (s.startsWith('### ')) score++;
  }
  return score;
}

function summarizeTsCoverage() {
  const pkgDirs = listDirs(TS_DOCS_DIR).filter((d) => TS_ALLOWED_FOLDERS.has(d.name));
  if (pkgDirs.length === 0) {
    console.log('[coverage] No TypeScript docs found under api/ts');
    return { rows: [] };
  }
  console.log('[coverage] TypeScript docs coverage (heuristic)');
  console.log('package, files, contentful, ratio');

  const rows = [];
  for (const pkg of pkgDirs) {
    const files = listFilesRecursive(pkg.path, isMarkdown);
    let contentful = 0;
    for (const f of files) {
      let txt = '';
      try { txt = readFileSync(f, 'utf8'); } catch { /* ignore */ }
      if (txt && contentfulScore(txt) > 0) contentful++;
    }
    const filesCount = files.length;
    const ratio = filesCount > 0 ? (contentful / filesCount) : 0;
    const ratioPct = Math.round(ratio * 100);
    console.log(`${pkg.name}, ${filesCount}, ${contentful}, ${ratioPct}%`);
    rows.push({
      package: pkg.name,
      files: filesCount,
      contentful,
      ratio,
      ratioPercent: ratioPct,
      path: relative(TS_DOCS_DIR, pkg.path),
    });
  }
  return { rows };
}

function summarizeCppCoverage() {
  // Group by top-level categories for Doxybook2 output (e.g., Classes, Files, Namespaces, Pages, etc.)
  let cats = [];
  try {
    cats = listDirs(CPP_DOCS_DIR);
  } catch {
    // ignore
  }
  if (!cats || cats.length === 0) return { categories: [] };

  console.log('\n[coverage] C++ docs coverage (heuristic, Doxybook2)');
  console.log('category, files, contentful, ratio');

  const categories = [];
  for (const cat of cats) {
    const files = listFilesRecursive(cat.path, isMarkdown);
    let contentful = 0;
    for (const f of files) {
      let txt = '';
      try { txt = readFileSync(f, 'utf8'); } catch { /* ignore */ }
      if (txt && contentfulScore(txt) > 0) contentful++;
    }
    const filesCount = files.length;
    const ratio = filesCount > 0 ? (contentful / filesCount) : 0;
    const ratioPct = Math.round(ratio * 100);
    console.log(`${cat.name}, ${filesCount}, ${contentful}, ${ratioPct}%`);
    categories.push({
      category: cat.name,
      files: filesCount,
      contentful,
      ratio,
      ratioPercent: ratioPct,
      path: relative(CPP_DOCS_DIR, cat.path),
    });
  }
  return { categories };
}

function main() {
  const ts = summarizeTsCoverage();
  const cpp = summarizeCppCoverage();

  console.log('\n[coverage] This is informational only. Thresholds can be enforced later.');

  // Write machine-readable JSON and Markdown report
  try {
    mkdirSync(TS_DOCS_DIR, { recursive: true });

    const jsonPath = join(TS_DOCS_DIR, 'coverage.json');
    writeFileSync(
      jsonPath,
      JSON.stringify({ generatedAt: new Date().toISOString(), ts, cpp }, null, 2)
    );

    const mdLines = [
      '# Documentation coverage',
      '',
      'Heuristic snapshot of documentation density across the codebase.',
      '',
      '## TypeScript (TypeDoc)',
      '',
      '“Contentful” counts files with at least one secondary heading (##/###).',
      '',
      '| package | files | contentful | ratio |',
      '|---|---:|---:|---:|',
      ...(ts.rows ?? []).map(r => `| ${r.package} | ${r.files} | ${r.contentful} | ${r.ratioPercent}% |`),
      '',
      '## C++ (Doxybook2)',
      '',
      'Grouped by top-level category folders produced by Doxybook2.',
      '',
      '| category | files | contentful | ratio |',
      '|---|---:|---:|---:|',
      ...(cpp.categories ?? []).map(c => `| ${c.category} | ${c.files} | ${c.contentful} | ${c.ratioPercent}% |`),
      '',
      '> This report is informational only. Thresholds can be enforced later in CI.',
      '',
    ];
    const mdPath = join(TS_DOCS_DIR, 'coverage.md');
    writeFileSync(mdPath, mdLines.join('\n'));
  } catch (e) {
    console.warn('[coverage] Failed to write coverage artifacts:', e?.message || e);
  }
  process.exit(0);
}

main();
