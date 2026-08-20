#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, relative } from 'path';
const ROOT = process.cwd();
const TS_DOCS_DIR = join(ROOT, 'apps/docs-md/api/ts');
const TS_ALLOWED_FOLDERS = new Set([
    'web-frontend',
    'shared-types',
    'web-backend',
    'praetor',
    'scram-node',
]);
function hasText(arr) {
    if (!Array.isArray(arr))
        return false;
    return arr.some((c) => typeof c.text === 'string' && c.text.trim().length > 0);
}
function hasComment(node) {
    const c = node && node.comment;
    if (!c)
        return false;
    if (hasText(c.summary))
        return true;
    if (Array.isArray(c.blockTags) && c.blockTags.length > 0)
        return true;
    return false;
}
function anyDescendantHasComment(node) {
    if (!node || typeof node !== 'object')
        return false;
    if (hasComment(node))
        return true;
    const stack = [];
    if (Array.isArray(node.children))
        stack.push(...node.children);
    if (Array.isArray(node.signatures))
        stack.push(...node.signatures);
    if (Array.isArray(node.getters))
        stack.push(...node.getters);
    if (Array.isArray(node.setters))
        stack.push(...node.setters);
    while (stack.length) {
        const n = stack.pop();
        if (hasComment(n))
            return true;
        if (Array.isArray(n?.children))
            stack.push(...n.children);
        if (Array.isArray(n?.signatures))
            stack.push(...n.signatures);
        if (Array.isArray(n?.getters))
            stack.push(...n.getters);
        if (Array.isArray(n?.setters))
            stack.push(...n.setters);
    }
    return false;
}
function symbolName(node) {
    return node?.name || '(anonymous)';
}
function firstSource(node) {
    const src = node?.sources?.[0];
    if (!src)
        return undefined;
    return {
        fileName: src.fileName,
        line: src.line,
    };
}
function collectMissingForPackage(pkgName, model) {
    const missing = {
        package: pkgName,
        symbolsWithoutDoc: [],
        signaturesWithoutReturns: [],
        parametersWithoutDoc: [],
    };
    if (!model || !Array.isArray(model.children))
        return missing;
    for (const child of model.children) {
        if (!anyDescendantHasComment(child)) {
            missing.symbolsWithoutDoc.push({
                name: symbolName(child),
                source: firstSource(child),
                kind: child.kindString,
            });
        }
        const stack = [child];
        while (stack.length) {
            const node = stack.pop();
            if (Array.isArray(node?.signatures)) {
                for (const sig of node.signatures) {
                    if (!hasComment(sig)) {
                        missing.signaturesWithoutReturns.push({
                            of: symbolName(node),
                            source: firstSource(sig) || firstSource(node),
                            kind: node.kindString,
                        });
                    }
                    if (Array.isArray(sig.parameters)) {
                        for (const p of sig.parameters) {
                            if (!hasComment(p)) {
                                missing.parametersWithoutDoc.push({
                                    of: symbolName(node),
                                    param: p.name,
                                    source: firstSource(p) || firstSource(sig) || firstSource(node),
                                    kind: node.kindString,
                                });
                            }
                        }
                    }
                }
            }
            if (Array.isArray(node?.children))
                stack.push(...node.children);
            if (Array.isArray(node?.getters))
                stack.push(...node.getters);
            if (Array.isArray(node?.setters))
                stack.push(...node.setters);
        }
    }
    return missing;
}
function main() {
    const report = { generatedAt: new Date().toISOString(), packages: [] };
    for (const pkg of TS_ALLOWED_FOLDERS) {
        try {
            const jsonPath = join(TS_DOCS_DIR, pkg, 'typedoc.json');
            const model = JSON.parse(readFileSync(jsonPath, 'utf8'));
            report.packages.push(collectMissingForPackage(pkg, model));
        }
        catch {
        }
    }
    try {
        mkdirSync(TS_DOCS_DIR, { recursive: true });
        writeFileSync(join(TS_DOCS_DIR, 'missing.json'), JSON.stringify(report, null, 2));
    }
    catch { }
    const failing = new Set(['praetor', 'shared-types', 'web-backend', 'web-frontend']);
    for (const pkg of report.packages) {
        if (!failing.has(pkg.package))
            continue;
        console.log(`\n[missing] ${pkg.package}`);
        if (pkg.symbolsWithoutDoc.length) {
            console.log('  symbols without doc:');
            for (const s of pkg.symbolsWithoutDoc.slice(0, 30)) {
                const loc = s.source ? `${s.source.fileName}:${s.source.line}` : '(unknown)';
                console.log(`   - ${s.name}  (${loc})`);
            }
            if (pkg.symbolsWithoutDoc.length > 30)
                console.log(`   … and ${pkg.symbolsWithoutDoc.length - 30} more`);
        }
        if (pkg.signaturesWithoutReturns.length) {
            console.log('  signatures without @returns (missing signature comment):');
            for (const s of pkg.signaturesWithoutReturns.slice(0, 50)) {
                const loc = s.source ? `${s.source.fileName}:${s.source.line}` : '(unknown)';
                console.log(`   - ${s.of}  (${loc})`);
            }
            if (pkg.signaturesWithoutReturns.length > 50)
                console.log(`   … and ${pkg.signaturesWithoutReturns.length - 50} more`);
        }
        if (pkg.parametersWithoutDoc.length) {
            console.log('  parameters without @param:');
            for (const p of pkg.parametersWithoutDoc.slice(0, 50)) {
                const loc = p.source ? `${p.source.fileName}:${p.source.line}` : '(unknown)';
                console.log(`   - ${p.of} (param: ${p.param})  (${loc})`);
            }
            if (pkg.parametersWithoutDoc.length > 50)
                console.log(`   … and ${pkg.parametersWithoutDoc.length - 50} more`);
        }
    }
}
main();
