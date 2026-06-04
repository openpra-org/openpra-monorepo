#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.cwd(), 'packages/docs-md/api/cpp-doxybook2');
function walk(dir, predicate, acc = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, predicate, acc);
        }
        else if (predicate(full)) {
            acc.push(full);
        }
    }
    return acc;
}
function stripFrontmatter(md) {
    if (!md.startsWith('---'))
        return md;
    const lines = md.split(/\r?\n/);
    if (lines.length === 0 || lines[0].trim() !== '---')
        return md;
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            endIndex = i;
            break;
        }
    }
    if (endIndex === -1)
        return md;
    const rest = lines.slice(endIndex + 1).join('\n');
    return rest.startsWith('\n') ? rest : `\n${rest}`;
}
if (!fs.existsSync(root)) {
    console.log(`[sanitize] Skipping: directory not found: ${root}`);
    process.exit(0);
}
const files = walk(root, (p) => p.endsWith('.md'));
let changed = 0;
for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    const sanitized = stripFrontmatter(original);
    if (sanitized !== original) {
        fs.writeFileSync(file, sanitized, 'utf8');
        changed++;
    }
}
console.log(`[sanitize] Processed ${files.length} Markdown files; stripped frontmatter from ${changed}.`);
