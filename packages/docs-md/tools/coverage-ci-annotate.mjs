#!/usr/bin/env node
/**
 * Emit CI-friendly annotations for docs coverage.
 * - Reads packages/docs-md/api/ts/coverage.json (from typedoc-coverage.mjs) which includes both TS and C++ summaries
 * - Optionally reads tools/coverage-thresholds.json to determine which packages to flag
 * - Writes a Markdown summary to $GITHUB_STEP_SUMMARY when available
 * - Prints ::notice:: annotations for TS packages under the symbol coverage threshold
 * - Always exits 0 (non-blocking)
 */
import { readFileSync, appendFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const COVERAGE_JSON = join(ROOT, 'packages/docs-md/api/ts/coverage.json');
const THRESHOLDS_JSON = join(ROOT, 'packages/docs-md/tools/coverage-thresholds.json');

function loadJson(path, optional = false) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    if (!optional) {
      console.warn(`[coverage:ci] Could not read ${path}:`, e?.message || e);
    }
    return null;
  }
}

function pct(v) {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

function main() {
  const cov = loadJson(COVERAGE_JSON);
  if (!cov) {
    console.log('[coverage:ci] No coverage.json found — skip annotations');
    return process.exit(0);
  }
  const thr = loadJson(THRESHOLDS_JSON, true) || {};
  const global = thr.global || { symbolDocPct: 60 };
  const perTs = thr.ts || {};

  const tsRows = (cov?.ts?.rows ?? []).filter((r) => !r.fallback);
  const cppCats = cov?.cpp?.categories ?? [];
  const hasAny = (tsRows.length > 0) || (cppCats.length > 0);
  if (!hasAny) {
    console.log('[coverage:ci] No docs coverage content — skip');
    return process.exit(0);
  }

  // Build Markdown summary table
  const mdLines = [];
  if (tsRows.length > 0) {
    mdLines.push(
      '## TypeScript docs coverage (symbol-level)',
      '',
      '| package | doc% | params% | returns% | symbols | documented |',
      '|---|---:|---:|---:|---:|---:|',
      ...tsRows.map((r) => `| ${r.package} | ${pct(r.symbolsPercent)}% | ${pct(r.paramsPercent)}% | ${pct(r.returnsPercent)}% | ${r.symbols ?? 0} | ${r.symbolsDocumented ?? 0} |`),
      '',
    );
  }
  if (cppCats.length > 0) {
    mdLines.push(
      '## C++ docs coverage (heuristic, Doxybook2)',
      '',
      '| category | files | contentful | ratio |',
      '|---|---:|---:|---:|',
      ...cppCats.map((c) => `| ${c.category} | ${c.files ?? 0} | ${c.contentful ?? 0} | ${pct(c.ratioPercent)}% |`),
      '',
    );
  }
  mdLines.push('_This signal is non-blocking. Thresholds may be enforced later._', '');

  try {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      // Append to the job summary
      appendFileSync(summaryPath, mdLines.join('\n'));
      console.log('[coverage:ci] Wrote docs coverage summary to $GITHUB_STEP_SUMMARY');
    } else {
      console.log(mdLines.join('\n'));
    }
  } catch (e) {
    console.warn('[coverage:ci] Failed to write job summary:', e?.message || e);
  }

  // Emit warnings for packages under threshold (symbol coverage)
  for (const r of tsRows) {
    const rule = perTs[r.package] || {};
    if (rule.exclude) continue;
    const wantSymbols = typeof rule.symbolDocPct === 'number' ? rule.symbolDocPct : global.symbolDocPct;
    const gotSymbols = pct(r.symbolsPercent);
    if (typeof wantSymbols === 'number' && gotSymbols < wantSymbols) {
      // GitHub Actions notice annotation (non-blocking signal)
      console.log(`::notice title=Docs coverage::${r.package} symbol docs ${gotSymbols}% < target ${wantSymbols}%`);
    }
  }

  process.exit(0);
}

main();
