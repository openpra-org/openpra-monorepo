#!/usr/bin/env node
/*
  Deep parameter documentation gap report for TypeScript packages.
  - Reads TypeDoc JSON v2 from packages/docs-md/api/ts/<pkg>/typedoc.json
  - Finds signatures whose parameters lack any comment summary
  - Outputs Markdown + JSON under packages/docs-md/api/ts/gaps-params.*
*/
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const TS_DOCS_DIR = join(ROOT, 'packages/docs-md/api/ts');

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

function hasText(contentArr) {
  if (!Array.isArray(contentArr)) return false;
  return contentArr.some((c) => typeof c.text === 'string' && c.text.trim().length > 0);
}

function hasComment(r) {
  const c = r && r.comment;
  if (!c) return false;
  if (hasText(c.summary)) return true;
  if (Array.isArray(c.blockTags) && c.blockTags.length > 0) return true;
  return false;
}

function gatherParamGaps(model, pkg) {
  const entries = [];
  let totalParams = 0;
  let documentedParams = 0;

  function pathOf(node) {
    const names = [];
    for (let cur = node; cur; cur = cur.__parent) {
      if (typeof cur.name === 'string' && cur.name) names.push(cur.name);
    }
    return names.reverse().join('.');
  }

  function annotateParents(node, parent) {
    if (!node || typeof node !== 'object') return;
    Object.defineProperty(node, '__parent', { value: parent || null, enumerable: false, configurable: true });
    if (Array.isArray(node.children)) node.children.forEach((c) => annotateParents(c, node));
    if (Array.isArray(node.signatures)) node.signatures.forEach((s) => annotateParents(s, node));
    if (Array.isArray(node.getters)) node.getters.forEach((g) => annotateParents(g, node));
    if (Array.isArray(node.setters)) node.setters.forEach((s) => annotateParents(s, node));
    if (Array.isArray(node.parameters)) node.parameters.forEach((p) => annotateParents(p, node));
  }

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.signatures)) {
      for (const sig of node.signatures) {
        const params = Array.isArray(sig.parameters) ? sig.parameters : [];
        for (const p of params) {
          totalParams += 1;
          if (hasComment(p)) {
            documentedParams += 1;
          } else {
            const src = Array.isArray(p.sources) && p.sources.length > 0 ? p.sources[0] : null;
            entries.push({
              package: pkg.name,
              symbol: pathOf(node),
              signature: sig.name || node.name || '(signature)',
              parameter: p.name,
              sourceFile: src ? src.fileName : null,
              sourceLine: src ? src.line : null,
            });
          }
        }
      }
    }
    if (Array.isArray(node.children)) {
      for (const ch of node.children) walk(ch);
    }
    if (Array.isArray(node.getters)) {
      for (const g of node.getters) walk(g);
    }
    if (Array.isArray(node.setters)) {
      for (const s of node.setters) walk(s);
    }
  }

  if (model && Array.isArray(model.children)) {
    model.children.forEach((c) => annotateParents(c, model));
    model.children.forEach((c) => walk(c));
  }

  return { entries, totalParams, documentedParams };
}

function main() {
  const pkgDirs = listDirs(TS_DOCS_DIR).filter((d) => TS_ALLOWED_FOLDERS.has(d.name));
  const allEntries = [];
  const perPkg = new Map();

  for (const pkg of pkgDirs) {
    const jsonPath = join(pkg.path, 'typedoc.json');
    let model = null;
    try { model = JSON.parse(readFileSync(jsonPath, 'utf8')); } catch {}
    if (!model) continue;

    const { entries, totalParams, documentedParams } = gatherParamGaps(model, pkg);
    allEntries.push(...entries);
    perPkg.set(pkg.name, { totalParams, documentedParams, missing: Math.max(totalParams - documentedParams, 0), path: relative(TS_DOCS_DIR, pkg.path) });
  }

  // Aggregate by symbol for hotspots
  const bySymbol = new Map();
  for (const e of allEntries) {
    const key = `${e.package}::${e.symbol}`;
    const cur = bySymbol.get(key) || { pkg: e.package, symbol: e.symbol, missing: 0, sampleFile: e.sourceFile, sampleLine: e.sourceLine };
    cur.missing += 1;
    if (!cur.sampleFile && e.sourceFile) {
      cur.sampleFile = e.sourceFile;
      cur.sampleLine = e.sourceLine;
    }
    bySymbol.set(key, cur);
  }
  const topSymbols = Array.from(bySymbol.values()).sort((a, b) => b.missing - a.missing).slice(0, 20);

  // Render Markdown
  const md = [];
  md.push('# Parameter documentation gaps');
  md.push('');
  md.push('This report highlights signatures with undocumented parameters across TypeScript packages.');
  md.push('');
  md.push('## Summary by package');
  md.push('');
  md.push('| package | total params | documented | missing | params% |');
  md.push('|---|---:|---:|---:|---:|');
  for (const [name, v] of Array.from(perPkg.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const pct = v.totalParams ? Math.round((v.documentedParams / v.totalParams) * 100) : 0;
    md.push(`| ${name} | ${v.totalParams} | ${v.documentedParams} | ${v.missing} | ${pct}% |`);
  }
  md.push('');
  md.push('## Top symbols by missing param docs');
  md.push('');
  md.push('| package | symbol | missing params | source (sample) |');
  md.push('|---|---|---:|---|');
  for (const s of topSymbols) {
    const src = s.sampleFile ? `${s.sampleFile}${s.sampleLine ? `:${s.sampleLine}` : ''}` : '';
    md.push(`| ${s.pkg} | ${s.symbol} | ${s.missing} | ${src} |`);
  }
  md.push('');
  md.push('## Detailed missing parameters (first 200)');
  md.push('');
  md.push('| package | symbol | signature | parameter | source |');
  md.push('|---|---|---|---|---|');
  for (const e of allEntries.slice(0, 200)) {
    const src = e.sourceFile ? `${e.sourceFile}${e.sourceLine ? `:${e.sourceLine}` : ''}` : '';
    md.push(`| ${e.package} | ${e.symbol} | ${e.signature} | ${e.parameter} | ${src} |`);
  }
  md.push('');
  md.push('> Note: This report is generated from TypeDoc JSON v2. A parameter is considered documented if it has any comment summary.');
  md.push('');

  try {
    mkdirSync(TS_DOCS_DIR, { recursive: true });
    writeFileSync(join(TS_DOCS_DIR, 'gaps-params.md'), md.join('\n'));
    writeFileSync(
      join(TS_DOCS_DIR, 'gaps-params.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), perPackage: Object.fromEntries(perPkg), topSymbols, entries: allEntries.slice(0, 200) }, null, 2)
    );
  } catch (e) {
    console.warn('[param-gaps] Failed to write artifacts:', e?.message || e);
  }
}

main();
