#!/usr/bin/env node
/**
 * Generate MEF Technical Elements docs landing page.
 * - Writes packages/docs-md/api/mef/openpra-mef/index.md
 * - Keeps content minimal and base-path agnostic (relative links in content)
 * - Idempotent: safe to run multiple times.
 */
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'packages/docs-md/api/mef/openpra-mef');
const OUT_FILE = join(OUT_DIR, 'index.md');

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const hasSchemaTypings = existsSync(join(ROOT, 'packages/docs-md/api/ts/mef-schema/README.md'));
  const md = [
    '# MEF Technical Elements',
    '',
    'Generated landing page for OpenPRA MEF schemas and related types.',
    '',
    'Resources',
    '',
    ...(hasSchemaTypings ? ['- TypeScript MEF schema typings: ../../ts/mef-schema/README.html'] : []),
    '- TypeScript MEF technical element types: ../../ts/mef-types/README.html',
    '',
    'Notes',
    '',
    '- Links are relative to support deployments under a base path (e.g., GitHub Pages).',
    '',
  ].join('\n');
  writeFileSync(OUT_FILE, md);
  console.log(`[mef:openpra] Wrote ${OUT_FILE}`);
}

main();
