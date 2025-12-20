#!/usr/bin/env node
/*
  sanitize-doxybook2-html.mjs
  Escapes raw HTML-like angle bracket sequences in generated C++ Markdown that can confuse Vite/Vue SFC parsing,
  while leaving code fences and inline code intact. Operates only under api/cpp-doxybook2/**.
*/
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'packages/docs-md');
const TARGET_DIR = path.join(ROOT, 'api/cpp-doxybook2');

/**
 * Very conservative escape strategy:
 * - Skip fenced code blocks (``` ... ```)
 * - Skip inline backtick spans (`...`)
 * - For remaining lines, replace occurrences of `<` followed by a letter or `/` with `&lt;`
 *   and `>` not part of markdown syntax with `&gt;`.
 * - Also neutralize sequences like `</` and `/>` outside code.
 */
function sanitizeLine(line) {
  // Replace HTML tag-like openings and closings
  let out = line
    // Avoid touching markdown tables/separators or headings
    .replace(/<(\/?)([A-Za-z][A-Za-z0-9-]*)\b/g, '&lt;$1$2')
    // Angle bracket with slash (like \/>)
    .replace(/<\//g, '&lt;/')
    // Or stray > that could close a tag when preceded by word char
    .replace(/([A-Za-z0-9_-])>(?!\])/g, '$1&gt;');
  return out;
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(p);
    } else if (e.isFile() && e.name.endsWith('.md')) {
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
    // toggle fence status: triple backticks fence
    if (/^```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    // Preserve inline code spans by splitting and sanitizing only outside backticks
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
