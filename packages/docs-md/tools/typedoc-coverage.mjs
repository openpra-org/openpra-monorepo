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
  'model-generator',
  'web-backend',
  'raptor',
  'scram-node',
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
  console.log('[coverage] TypeScript docs coverage (symbol-level)');
  console.log('package, symbols, documented, doc%, params%, returns%');

  const rows = [];
  for (const pkg of pkgDirs) {
    const jsonPath = join(pkg.path, 'typedoc.json');
    let model = null;
    try { model = JSON.parse(readFileSync(jsonPath, 'utf8')); } catch {}

    if (!model) {
      // Fallback to heuristic based on Markdown headings
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
      rows.push({ package: pkg.name, fallback: true, files: filesCount, contentful, ratio, ratioPercent: ratioPct, path: relative(TS_DOCS_DIR, pkg.path) });
      continue;
    }
    // Compute symbol-level metrics from TypeDoc JSON
    let symbolsTotal = 0, symbolsDoc = 0;
    let paramsTotal = 0, paramsDoc = 0;
    let returnsTotal = 0, returnsDoc = 0;

    function hasText(contentArr) {
      if (!Array.isArray(contentArr)) return false;
      return contentArr.some((c) => typeof c.text === 'string' && c.text.trim().length > 0);
    }

    function hasComment(r) {
      const c = r && r.comment;
      if (!c) return false;
      if (hasText(c.summary)) return true;
      // Older JSON format may use blockTags
      if (Array.isArray(c.blockTags) && c.blockTags.length > 0) return true;
      return false;
    }

    function anyDescendantHasComment(node) {
      if (!node || typeof node !== 'object') return false;
      if (hasComment(node)) return true;
      const stacks = [];
      if (Array.isArray(node.children)) stacks.push(...node.children);
      if (Array.isArray(node.signatures)) stacks.push(...node.signatures);
      if (Array.isArray(node.getters)) stacks.push(...node.getters);
      if (Array.isArray(node.setters)) stacks.push(...node.setters);
      while (stacks.length > 0) {
        const n = stacks.pop();
        if (hasComment(n)) return true;
        if (Array.isArray(n?.children)) stacks.push(...n.children);
        if (Array.isArray(n?.signatures)) stacks.push(...n.signatures);
        if (Array.isArray(n?.getters)) stacks.push(...n.getters);
        if (Array.isArray(n?.setters)) stacks.push(...n.setters);
      }
      return false;
    }

    function collectSignatureMetrics(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node.signatures)) {
        for (const sig of node.signatures) {
          // Returns: count one per signature, consider documented if signature has any comment
          returnsTotal += 1;
          if (hasComment(sig)) returnsDoc += 1;
          // Params: count parameters present; documented if parameter has any comment
          if (Array.isArray(sig.parameters)) {
            for (const p of sig.parameters) {
              paramsTotal += 1;
              if (hasComment(p)) paramsDoc += 1;
            }
          }
        }
      }
      if (Array.isArray(node.children)) {
        for (const ch of node.children) collectSignatureMetrics(ch);
      }
      if (Array.isArray(node.getters)) {
        for (const g of node.getters) collectSignatureMetrics(g);
      }
      if (Array.isArray(node.setters)) {
        for (const s of node.setters) collectSignatureMetrics(s);
      }
    }

    // TypeDoc v2 JSON: count top-level exported declarations as symbols
    if (model && Array.isArray(model.children)) {
      for (const child of model.children) {
        // Count every exported top-level child as one symbol
        symbolsTotal += 1;
        // Treat a symbol as documented if it or any of its descendants has a comment.
        if (anyDescendantHasComment(child)) symbolsDoc += 1;
        // Collect metrics from nested members and signatures
        collectSignatureMetrics(child);
      }
    } else {
      // Older JSON (pre v2): walk tree and use kindString when available
      const kindsTop = new Set(['Class', 'Interface', 'Enum', 'Function', 'Type alias', 'Variable']);

      function incParamsAndReturns(signature) {
        if (!signature) return;
        const params = Array.isArray(signature.parameters) ? signature.parameters.length : 0;
        paramsTotal += params;
        const c = signature.comment;
        if (c && Array.isArray(c.blockTags)) {
          const paramTags = c.blockTags.filter((t) => t.tag === '@param');
          paramsDoc += Math.min(paramTags.length, params);
          const returnsTags = c.blockTags.filter((t) => t.tag === '@returns' || t.tag === '@return');
          returnsTotal += 1;
          if (returnsTags.length > 0) returnsDoc += 1;
        } else {
          // No tags
          returnsTotal += 1;
        }
      }

      function walk(r) {
        if (!r || typeof r !== 'object') return;
        const kind = r.kindString || '';
        if (kindsTop.has(kind)) {
          symbolsTotal += 1;
          if (hasComment(r)) symbolsDoc += 1;
        }
        if (Array.isArray(r.signatures)) {
          for (const sig of r.signatures) {
            if (hasComment(sig) && !hasComment(r)) {
              if (kindsTop.has(kind)) symbolsDoc += 1;
            }
            incParamsAndReturns(sig);
          }
        }
        if (Array.isArray(r.children)) {
          for (const ch of r.children) walk(ch);
        }
        if (Array.isArray(r.getters)) {
          for (const g of r.getters) walk(g);
        }
        if (Array.isArray(r.setters)) {
          for (const s of r.setters) walk(s);
        }
      }

      walk(model);
    }

    const docPct = symbolsTotal ? Math.round((symbolsDoc / symbolsTotal) * 100) : 0;
    const paramPct = paramsTotal ? Math.round((paramsDoc / paramsTotal) * 100) : 0;
    const returnsPct = returnsTotal ? Math.round((returnsDoc / returnsTotal) * 100) : 0;
    console.log(`${pkg.name}, ${symbolsDoc}/${symbolsTotal}, ${docPct}%, ${paramPct}%, ${returnsPct}%`);
    rows.push({
      package: pkg.name,
      symbols: symbolsTotal,
      symbolsDocumented: symbolsDoc,
      symbolsPercent: docPct,
      paramsTotal,
      paramsDocumented: paramsDoc,
      paramsPercent: paramPct,
      returnsTotal,
      returnsDocumented: returnsDoc,
      returnsPercent: returnsPct,
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

  // Write machine-readable JSON and separate Markdown reports (TS and C++)
  try {
    mkdirSync(TS_DOCS_DIR, { recursive: true });
    mkdirSync(CPP_DOCS_DIR, { recursive: true });

    const jsonPath = join(TS_DOCS_DIR, 'coverage.json');
    writeFileSync(
      jsonPath,
      JSON.stringify({ generatedAt: new Date().toISOString(), ts, cpp }, null, 2)
    );

    // TS-only Markdown report
    const mdTsLines = [
      '# Documentation coverage',
      '',
      'Symbol-level snapshot of documentation density for TypeScript packages.',
      '',
      '> Metrics definitions',
      '> - symbols: top-level exported declarations in each TS package (from TypeDoc JSON v2).',
      '> - documented: a symbol is counted as documented if it has a declaration comment summary or any signature has a comment.',
      '> - params%: across all function/method signatures, percent of parameters with any comment summary.',
      '> - returns%: percent of signatures with any comment (proxy for returns doc under TypeDoc v2 JSON).',
      '',
      '| package | documented symbols | total symbols | doc% | params% | returns% |',
      '|---|---:|---:|---:|---:|---:|',
      ...(ts.rows ?? []).map(r => r.fallback
        ? `| ${r.package} | n/a | n/a | ${r.ratioPercent}% (heuristic) | n/a | n/a |`
        : `| ${r.package} | ${r.symbolsDocumented} | ${r.symbols} | ${r.symbolsPercent}% | ${r.paramsPercent}% | ${r.returnsPercent}% |`
      ),
      '',
      '> This report is informational only. Thresholds can be enforced later in CI.',
      '',
    ];
    const mdTsPath = join(TS_DOCS_DIR, 'coverage.md');
    writeFileSync(mdTsPath, mdTsLines.join('\n'));

    // C++-only Markdown report
    const mdCppLines = [
      '# Documentation coverage',
      '',
      'Heuristic snapshot of documentation density for C++ (Doxybook2 output).',
      '',
      'Grouped by top-level category folders produced by Doxybook2. “Contentful” approximates presence of headings beyond titles.',
      '',
      '| category | files | contentful | ratio |',
      '|---|---:|---:|---:|',
      ...(cpp.categories ?? []).map(c => `| ${c.category} | ${c.files} | ${c.contentful} | ${c.ratioPercent}% |`),
      '',
      '> This report is informational only. Thresholds can be enforced later in CI.',
      '',
    ];
    const mdCppPath = join(CPP_DOCS_DIR, 'coverage.md');
    writeFileSync(mdCppPath, mdCppLines.join('\n'));

    // Optional: C++-only JSON for convenience
    const jsonCppPath = join(CPP_DOCS_DIR, 'coverage.json');
    writeFileSync(
      jsonCppPath,
      JSON.stringify({ generatedAt: new Date().toISOString(), cpp }, null, 2)
    );
  } catch (e) {
    console.warn('[coverage] Failed to write coverage artifacts:', e?.message || e);
  }
  process.exit(0);
}

main();
