#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(process.cwd(), 'packages/docs-md/api/cpp-doxybook2');
const NAMESPACES_DIR = path.join(ROOT, 'Namespaces');
const INDEX_NAMESPACES = path.join(ROOT, 'index_namespaces.md');
const INDEX_CLASSES = path.join(ROOT, 'index_classes.md');
const INDEX_FILES = path.join(ROOT, 'index_files.md');
function exists(p) {
    try {
        fs.accessSync(p);
        return true;
    }
    catch {
        return false;
    }
}
function removeAnonymousNamespacePages() {
    if (!exists(NAMESPACES_DIR))
        return { removed: 0 };
    const files = fs.readdirSync(NAMESPACES_DIR);
    let removed = 0;
    for (const f of files) {
        if (/^namespace.*_0d[0-9a-f]+\.md$/i.test(f)) {
            fs.rmSync(path.join(NAMESPACES_DIR, f), { force: true });
            removed++;
        }
    }
    return { removed };
}
function sanitizeIndexNamespaces() {
    if (!exists(INDEX_NAMESPACES))
        return { changed: false };
    const original = fs.readFileSync(INDEX_NAMESPACES, 'utf8');
    const lines = original.split(/\r?\n/);
    const cleaned = lines.filter((line) => {
        if (/^\s*\*\s+\*\*namespace\s+\[[^\]]*::@\d+\]\(Namespaces\/[\w\-\.]+\)\s*\*\*/i.test(line))
            return false;
        if (/^\s*\*\s+\*\*namespace\s+\[@\d+\]\(Namespaces\/namespace_0d[0-9a-f]+\.md\)\s*\*\*/i.test(line))
            return false;
        if (/\*\s+\*\*namespace\s+\[(Napi|boost|ext|ScramCLI)\]/.test(line))
            return false;
        if (/^\s*\*\s+\*\*namespace\s+\[std\]\(Namespaces\/namespacestd\.md\)\s*\*\*/.test(line))
            return false;
        return true;
    }).join('\n');
    if (cleaned !== original) {
        fs.writeFileSync(INDEX_NAMESPACES, cleaned, 'utf8');
        return { changed: true };
    }
    return { changed: false };
}
function sanitizeIndexClasses() {
    if (!exists(INDEX_CLASSES))
        return { changed: false };
    const original = fs.readFileSync(INDEX_CLASSES, 'utf8');
    const withMdBreaks = original.replace(/<br\s*\/?>(\s*)/gi, '  \n$1  ');
    const lines = withMdBreaks.split(/\r?\n/);
    const cleaned = lines.filter((line) => {
        return !(/^\s*\*\s+\*\*namespace\s+\[/.test(line));
    }).join('\n');
    if (cleaned !== original) {
        fs.writeFileSync(INDEX_CLASSES, cleaned, 'utf8');
        return { changed: true };
    }
    return { changed: false };
}
function sanitizeIndexFiles() {
    if (!exists(INDEX_FILES))
        return { changed: false };
    const original = fs.readFileSync(INDEX_FILES, 'utf8');
    let text = original.replace(/<br\s*\/?>(\s*)/gi, '  \n$1  ');
    const descriptions = new Map([
        ['AsyncRunScramCli_8h.md', 'N-API wrapper to run the SCRAM CLI asynchronously from Node.js.'],
        ['AsyncScramWorker_8cpp.md', 'Asynchronous worker implementation that executes the SCRAM engine.'],
        ['AsyncScramWorker_8h.md', 'Declaration of the asynchronous SCRAM engine worker.'],
        ['InitModule_8cpp.md', 'N-API module initialization for the scram-node addon.'],
        ['RunScramCli_8h.md', 'Helper to invoke the SCRAM CLI from Node.js code.'],
        ['ScramWorker_8cpp.md', 'Synchronous worker implementation for executing SCRAM tasks.'],
        ['ScramWorker_8h.md', 'Declaration of the synchronous SCRAM engine worker.'],
        ['targets_2scram-cli_2main_8cpp.md', 'Entry point for the scram-cli executable target.'],
        ['RunScram_8h.md', 'Helper to run the SCRAM engine from the CLI utilities.'],
        ['ConstructOptions_8h.md', 'CLI construct options.'],
        ['ConstructSettings_8h.md', 'CLI construct settings.'],
        ['ParseArguments_8h.md', 'CLI argument parsing helpers.'],
        ['XmlLogger_8h.md', 'XML logger utilities for CLI.'],
        ['stub__scram-cli-utils_8cpp.md', 'Stub implementations for scram-cli utilities.'],
    ]);
    const lines = text.split(/\r?\n/);
    const out = [];
    for (const line of lines) {
        const m = line.match(/^(\s*\*\s+\*\*file\s+\[[^\]]+\]\(Files\/(.+?)#file-[^\)]+\)\*\*)(\s*)$/);
        if (m) {
            const before = m[1];
            const filename = m[2];
            const desc = descriptions.get(filename);
            if (desc) {
                out.push(`${before}  `);
                out.push(`  ${desc}`);
                continue;
            }
        }
        out.push(line);
    }
    const cleaned = out.join('\n');
    if (cleaned !== original) {
        fs.writeFileSync(INDEX_FILES, cleaned, 'utf8');
        return { changed: true };
    }
    return { changed: false };
}
function main() {
    if (!exists(ROOT)) {
        console.log('[sanitize-namespaces] Skipping: directory not found:', ROOT);
        return;
    }
    const { removed } = removeAnonymousNamespacePages();
    const ns = sanitizeIndexNamespaces();
    const cls = sanitizeIndexClasses();
    const files = sanitizeIndexFiles();
    console.log(`[sanitize-namespaces] Removed anon namespace pages: ${removed}; index changes — namespaces: ${ns.changed}, classes: ${cls.changed}, files: ${files.changed}`);
}
main();
