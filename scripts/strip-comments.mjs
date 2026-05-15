import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const TARGET_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const SKIP_DIRS = new Set(["node_modules", "dist", "build", "target", ".nx", ".git"]);

const SKIP_FILE_PATTERNS = [".d.ts"];

const ROOTS = ["apps", "packages"];

function shouldSkipFile(filePath) {
  return SKIP_FILE_PATTERNS.some((p) => filePath.endsWith(p));
}

function collectFiles(dir, results = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectFiles(full, results);
    } else if (TARGET_EXTENSIONS.has(extname(entry)) && !shouldSkipFile(full)) {
      results.push(full);
    }
  }
  return results;
}

function removeComments(source, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const printer = ts.createPrinter({ removeComments: true });
  return printer.printFile(sourceFile);
}

const cwd = process.cwd();
const files = ROOTS.flatMap((root) => collectFiles(join(cwd, root)));

let modified = 0;

for (const file of files) {
  const original = readFileSync(file, "utf-8");
  let result;
  try {
    result = removeComments(original, file);
  } catch {
    process.stderr.write(`skip (parse error): ${file}\n`);
    continue;
  }
  if (result !== original) {
    writeFileSync(file, result, "utf-8");
    modified++;
    process.stdout.write(`stripped: ${file}\n`);
  }
}

process.stdout.write(`done: ${modified} files modified\n`);
