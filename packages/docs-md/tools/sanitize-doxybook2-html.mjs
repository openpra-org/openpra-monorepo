#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT = path.resolve(process.cwd(), 'packages/docs-md');
const TARGET_DIR = path.join(ROOT, 'api/cpp-doxybook2');
function sanitizeLine(line) {
    let out = line
        .replace(/<(\/?)([A-Za-z][A-Za-z0-9-]*)\b/g, '&lt;$1$2')
        .replace(/<\//g, '&lt;/')
        .replace(/([A-Za-z0-9_-])>(?!\])/g, '$1&gt;');
    return out;
}
async function* walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            yield* walk(p);
        }
        else if (e.isFile() && e.name.endsWith('.md')) {
            yield p;
        }
    }
}
function processContent(content) {
    const lines = content.split('\n');
    const out = [];
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^```/.test(line)) {
            inFence = !inFence;
            out.push(line);
            continue;
        }
        if (inFence) {
            out.push(line);
            continue;
        }
        const parts = line.split(/(`[^`]*`)/g);
        for (let j = 0; j < parts.length; j++) {
            if (j % 2 === 0) {
                parts[j] = sanitizeLine(parts[j]);
            }
        }
        out.push(parts.join(''));
    }
    return out.join('\n');
}
async function main() {
    let processed = 0;
    for await (const file of walk(TARGET_DIR)) {
        const content = await fs.readFile(file, 'utf8');
        const updated = processContent(content);
        if (updated !== content) {
            await fs.writeFile(file, updated);
            processed++;
        }
    }
    console.log(`[sanitize-html] Escaped HTML-like sequences in ${processed} Markdown files under api/cpp-doxybook2`);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
