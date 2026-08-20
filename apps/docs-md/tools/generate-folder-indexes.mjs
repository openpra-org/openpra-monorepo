#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const docsRoot = path.join(repoRoot, 'apps', 'docs-md');
const PACKAGES = [
    { id: 'web-frontend', title: 'Web Frontend' },
    { id: 'shared-types', title: 'Shared Types' },
    { id: 'web-backend', title: 'Web Backend (NestJS)' },
    { id: 'praetor', title: 'Praetor' },
    { id: 'scram-node', title: 'SCRAM Node Addon' },
];
function ensureDirSync(dir) {
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
}
function readJsonSafe(file) {
    try {
        const txt = fs.readFileSync(file, 'utf8');
        return JSON.parse(txt);
    }
    catch (e) {
        return null;
    }
}
function firstSourceFile(reflection) {
    if (!reflection)
        return undefined;
    if (Array.isArray(reflection.sources) && reflection.sources.length > 0) {
        return reflection.sources[0].fileName || reflection.sources[0].file;
    }
    return undefined;
}
function topLevelFolderFromPath(filePath) {
    if (!filePath)
        return 'root';
    const p = filePath.replace(/\\/g, '/');
    const idx = p.lastIndexOf('/src/');
    if (idx !== -1) {
        const after = p.slice(idx + 5);
        const seg = after.split('/')[0];
        return seg || 'root';
    }
    const parts = p.split('/');
    const i = parts.findIndex((s) => s === 'src' || s === 'shared-types' || s === 'web-backend' || s === 'web-frontend' || s === 'praetor' || s === 'scram-node');
    if (i >= 0 && i + 1 < parts.length)
        return parts[i + 1];
    return 'root';
}
function collectModulesByFolder(projectJson) {
    const byFolder = new Map();
    function visit(node) {
        if (!node || typeof node !== 'object')
            return;
        if (node.kindString === 'Module' || node.kind === 1) {
            const file = firstSourceFile(node);
            const folder = topLevelFolderFromPath(file);
            const arr = byFolder.get(folder) || [];
            const moduleName = node.name;
            if (moduleName)
                arr.push({ name: moduleName, file });
            byFolder.set(folder, arr);
        }
        if (Array.isArray(node.children))
            node.children.forEach(visit);
    }
    visit(projectJson);
    for (const [folder, list] of byFolder.entries()) {
        list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return byFolder;
}
function writeFolderPages(pkgId, pkgTitle, byFolder) {
    const outDir = path.join(docsRoot, 'api', 'ts', pkgId, '_explore');
    ensureDirSync(outDir);
    const folders = [...byFolder.keys()].sort();
    const total = folders.reduce((n, f) => n + (byFolder.get(f)?.length || 0), 0);
    const displayName = (f) => (f === 'root' ? '(root)' : f);
    const indexMd = [
        `# Explore src/: ${pkgTitle}`,
        '',
        `Browse TypeDoc modules grouped by top-level src/ folders. This mirrors the source tree to make discovery easier.`,
        '',
        `Folders (${total} modules total):`,
        '',
        ...folders.map((f) => {
            const count = byFolder.get(f)?.length || 0;
            return `- [${displayName(f)}](./${encodeURIComponent(f)}.md) — ${count} module${count === 1 ? '' : 's'}`;
        }),
        '',
        `Prefer a flat view? See [All Modules](../modules.html).`,
        '',
    ].join('\n');
    fs.writeFileSync(path.join(outDir, 'index.md'), indexMd, 'utf8');
    for (const f of folders) {
        const list = byFolder.get(f) || [];
        const md = [
            `# ${pkgTitle} • src/${displayName(f)}`,
            '',
            `Modules defined under src/${displayName(f)}:`,
            '',
            ...list.map(({ name }) => `- [${name}](../modules/${name}.html)`),
            '',
            `Back to [Explore src/](./index.html).`,
            '',
        ].join('\n');
        fs.writeFileSync(path.join(outDir, `${f}.md`), md, 'utf8');
    }
}
function main() {
    let wroteAny = false;
    for (const { id, title } of PACKAGES) {
        const jsonPath = path.join(docsRoot, 'api', 'ts', id, 'typedoc.json');
        const projectJson = readJsonSafe(jsonPath);
        if (!projectJson) {
            console.warn(`[folders] Skip ${id}: missing ${jsonPath}`);
            continue;
        }
        const byFolder = collectModulesByFolder(projectJson);
        if (byFolder.size === 0) {
            console.warn(`[folders] Skip ${id}: no modules found`);
            continue;
        }
        writeFolderPages(id, title, byFolder);
        wroteAny = true;
    }
    if (wroteAny) {
        console.log('[folders] Generated src/ folder indexes.');
    }
    else {
        console.log('[folders] Nothing to generate.');
    }
}
main();
