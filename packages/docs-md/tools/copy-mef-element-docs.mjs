#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, 'packages/mef-types/src/lib');
const OUT_ROOT = path.join(ROOT, 'packages/docs-md/mef-elements');
function isDir(p) {
    try {
        return fs.statSync(p).isDirectory();
    }
    catch {
        return false;
    }
}
function toTitleCase(seg) {
    return seg
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase());
}
function copyFile(src, dst) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const buf = fs.readFileSync(src);
    fs.writeFileSync(dst, buf);
}
function encodeHref(relPath) {
    const parts = relPath.split('/').map((seg) => encodeURIComponent(seg));
    return parts.join('/');
}
function main() {
    if (!isDir(SRC_ROOT)) {
        console.error(`[mef:elements] Source not found: ${SRC_ROOT}`);
        process.exit(1);
    }
    fs.rmSync(OUT_ROOT, { recursive: true, force: true });
    fs.mkdirSync(OUT_ROOT, { recursive: true });
    const entries = fs.readdirSync(SRC_ROOT);
    const catalog = [];
    for (const entry of entries) {
        const srcDir = path.join(SRC_ROOT, entry);
        if (!isDir(srcDir))
            continue;
        const mdFiles = fs
            .readdirSync(srcDir)
            .filter((f) => f.toLowerCase().endsWith('.md'))
            .filter((f) => true);
        if (mdFiles.length === 0)
            continue;
        const outDir = path.join(OUT_ROOT, entry);
        fs.mkdirSync(outDir, { recursive: true });
        const collected = [];
        for (const file of mdFiles) {
            const src = path.join(srcDir, file);
            const dst = path.join(outDir, file);
            copyFile(src, dst);
            collected.push({ name: file, outRel: `./${encodeHref(`${entry}/${file}`)}` });
        }
        const lc = (s) => s.toLowerCase();
        const primary = collected.find((f) => lc(f.name) === "readme.md")?.name ||
            collected.find((f) => /documentation/i.test(f.name))?.name ||
            (collected[0] && collected[0].name);
        if (primary) {
            const primarySrc = path.join(outDir, primary);
            const primaryContent = fs.readFileSync(primarySrc, "utf-8");
            fs.writeFileSync(path.join(outDir, "index.md"), primaryContent);
        }
        catalog.push({ element: entry, title: toTitleCase(entry), files: collected });
    }
    const lines = [
        '# MEF Technical Element Docs',
        '',
        'Authored documentation for each technical element',
        '',
    ];
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
        if (found)
            ordered.push(found);
    }
    const remaining = catalog.filter(c => !preferredOrder.includes(c.element));
    remaining.sort((a, b) => a.element.localeCompare(b.element));
    ordered.push(...remaining);
    for (const entry of ordered) {
        lines.push(`## ${entry.title}`);
        lines.push('');
        lines.push(`- [See ${entry.title}](${encodeHref(`./${entry.element}/index.html`)})`);
        lines.push('');
    }
    fs.writeFileSync(path.join(OUT_ROOT, 'index.md'), lines.join('\n'));
    console.log(`[mef:elements] Copied docs for ${catalog.length} element folder(s) to ${OUT_ROOT}`);
}
main();
