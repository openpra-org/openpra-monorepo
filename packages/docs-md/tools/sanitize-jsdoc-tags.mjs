#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(scriptDir, '../../..');
const srcDir = path.join(repoRoot, 'packages', 'mef-types', 'src');
const outDir = path.join(repoRoot, 'packages', 'docs-md', '.tmp', 'typedoc-sanitized', 'mef-types');

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function transformJsdoc(content) {
  // Only operate inside JSDoc comment blocks
  return content.replace(/\/\*\*[\s\S]*?\*\//g, (block) => {
    let b = block;
    // @description -> plain text (preserve content)
    b = b.replace(/(^|\n)\s*\*\s*@description\b(.*)/g, (_m, p1, p2) => `${p1} *${p2}`);
    // @note -> plain text to avoid duplicate @remarks warnings
    b = b.replace(/(^|\n)\s*\*\s*@note\b(.*)/g, (_m, p1, p2) => `${p1} * Note${p2}`);
    // @implements -> plain text to avoid duplicate @remarks warnings
    b = b.replace(/(^|\n)\s*\*\s*@implements\b(.*)/g, (_m, p1, p2) => `${p1} * Implements${p2}`);
    // @preferred -> drop the tag line (leave a blank comment line)
    b = b.replace(/(^|\n)\s*\*\s*@preferred\b.*(?=\n|\*\/)/g, (_m, p1) => `${p1} *`);
    // @const -> plain text
    b = b.replace(/(^|\n)\s*\*\s*@const\b(.*)/g, (_m, p1, p2) => `${p1} *${p2}`);
    // @todo -> plain text TODO
    b = b.replace(/(^|\n)\s*\*\s*@todo\b(.*)/g, (_m, p1, p2) => `${p1} * TODO${p2}`);
    // @annotation -> plain text Annotation
    b = b.replace(/(^|\n)\s*\*\s*@annotation\b(.*)/g, (_m, p1, p2) => `${p1} * Annotation${p2}`);
    // @memberof -> plain text Member of
    b = b.replace(/(^|\n)\s*\*\s*@memberof\b(.*)/g, (_m, p1, p2) => `${p1} * Member of${p2}`);
    // @minimum -> plain text Minimum
    b = b.replace(/(^|\n)\s*\*\s*@minimum\b(.*)/g, (_m, p1, p2) => `${p1} * Minimum${p2}`);
    // @format -> plain text Format
    b = b.replace(/(^|\n)\s*\*\s*@format\b(.*)/g, (_m, p1, p2) => `${p1} * Format${p2}`);
    return b;
  });
}

function copyAndSanitize(src, dest) {
  const stat = fs.statSync(src);
  // Skip legacy identifier module paths that we no longer document
  const rel = path.relative(srcDir, src);
  const relParts = rel.split(path.sep);
  // Skip legacy subtrees we no longer document
  if (relParts.length >= 2 && relParts[0] === 'openpra-mef' && relParts[1] === 'identifier') {
    return;
  }
  if (relParts.length >= 2 && relParts[0] === 'openpra-mef' && relParts[1] === 'technical-elements') {
    return;
  }
  if (stat.isDirectory()) {
    // Skip any nested node_modules directories inside source tree
    if (path.basename(src) === 'node_modules') {
      return;
    }
    ensureDirSync(dest);
    for (const entry of fs.readdirSync(src)) {
      copyAndSanitize(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    // Only process TypeScript files
    if (src.endsWith('.ts') || src.endsWith('.d.ts')) {
      const raw = fs.readFileSync(src, 'utf8');
      const out = transformJsdoc(raw);
      fs.writeFileSync(dest, out, 'utf8');
    } else {
      // Copy other files verbatim
      ensureDirSync(path.dirname(dest));
      fs.copyFileSync(src, dest);
    }
  }
}

function main() {
  // Clean output directory to avoid stale files when sources are removed
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  ensureDirSync(outDir);
  copyAndSanitize(srcDir, outDir);
  console.log(`[sanitize-jsdoc] Sanitized mef-types into ${outDir}`);
}

main();
