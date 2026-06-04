#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(scriptDir, '../../..');
const srcDir = path.join(repoRoot, 'packages', 'mef-types', 'src');
const outDir = path.join(repoRoot, 'packages', 'docs-md', '.tmp', 'typedoc-sanitized', 'mef-types');
function ensureDirSync(dir) {
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
}
function transformJsdoc(content) {
    return content.replace(/\/\*\*[\s\S]*?\*\//g, (block) => {
        let b = block;
        b = b.replace(/(^|\n)\s*\*\s*@description\b(.*)/g, (_m, p1, p2) => `${p1} *${p2}`);
        b = b.replace(/(^|\n)\s*\*\s*@note\b(.*)/g, (_m, p1, p2) => `${p1} * Note${p2}`);
        b = b.replace(/(^|\n)\s*\*\s*@implements\b(.*)/g, (_m, p1, p2) => `${p1} * Implements${p2}`);
        b = b.replace(/(^|\n)\s*\*\s*@preferred\b.*(?=\n|\*\/)/g, (_m, p1) => `${p1} *`);
        b = b.replace(/(^|\n)\s*\*\s*@const\b(.*)/g, (_m, p1, p2) => `${p1} *${p2}`);
        b = b.replace(/(^|\n)\s*\*\s*@todo\b(.*)/g, (_m, p1, p2) => `${p1} * TODO${p2}`);
        b = b.replace(/(^|\n)\s*\*\s*@annotation\b(.*)/g, (_m, p1, p2) => `${p1} * Annotation${p2}`);
        b = b.replace(/(^|\n)\s*\*\s*@memberof\b(.*)/g, (_m, p1, p2) => `${p1} * Member of${p2}`);
        b = b.replace(/(^|\n)\s*\*\s*@minimum\b(.*)/g, (_m, p1, p2) => `${p1} * Minimum${p2}`);
        b = b.replace(/(^|\n)\s*\*\s*@format\b(.*)/g, (_m, p1, p2) => `${p1} * Format${p2}`);
        return b;
    });
}
function copyAndSanitize(src, dest) {
    const stat = fs.statSync(src);
    const rel = path.relative(srcDir, src);
    const relParts = rel.split(path.sep);
    if (relParts.length >= 2 && relParts[0] === 'openpra-mef' && relParts[1] === 'identifier') {
        return;
    }
    if (relParts.length >= 2 && relParts[0] === 'openpra-mef' && relParts[1] === 'technical-elements') {
        return;
    }
    if (stat.isDirectory()) {
        if (path.basename(src) === 'node_modules') {
            return;
        }
        ensureDirSync(dest);
        for (const entry of fs.readdirSync(src)) {
            copyAndSanitize(path.join(src, entry), path.join(dest, entry));
        }
    }
    else {
        if (src.endsWith('.ts') || src.endsWith('.d.ts')) {
            const raw = fs.readFileSync(src, 'utf8');
            const out = transformJsdoc(raw);
            fs.writeFileSync(dest, out, 'utf8');
        }
        else {
            ensureDirSync(path.dirname(dest));
            fs.copyFileSync(src, dest);
        }
    }
}
function main() {
    if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
    }
    ensureDirSync(outDir);
    copyAndSanitize(srcDir, outDir);
    console.log(`[sanitize-jsdoc] Sanitized mef-types into ${outDir}`);
}
main();
