#!/usr/bin/env node
/*
  Simple TSDoc coverage analyzer.
  Counts exported declarations and how many have TSDoc (/** ... * /) immediately above.
  Excludes spec/e2e-spec and declaration files.
*/
const fs = require("fs");
const path = require("path");

const PACKAGES = [
  { name: "shared-types", roots: ["packages/shared-types/src"] },
  { name: "shared-sdk", roots: ["packages/shared-sdk/src"] },
  { name: "model-generator", roots: ["packages/model-generator/src"] },
  { name: "microservice-job-broker", roots: ["packages/microservice/job-broker/src"] },
  { name: "web-backend", roots: ["packages/web-backend/src"] },
  // Optional: mef technical elements (large) – include limited path to avoid noise
  { name: "mef-technical-elements", roots: ["packages/mef-types/src/lib"] },
  // Frontend: focus coverage on utils/hooks/state to avoid UI-heavy areas
  {
    name: "frontend-web-editor",
    roots: [
      "packages/frontend/web-editor/src/utils",
      "packages/frontend/web-editor/src/app/hooks",
      "packages/frontend/web-editor/src/app/zustand",
      "packages/frontend/web-editor/src/app/store",
    ],
  },
  // scram-node N-API declarations are in .d.ts; include them explicitly
  {
    name: "scram-node-napi",
    roots: ["packages/engine/scram-node/targets/scram-node/lib"],
    includeDts: true,
  },
];

const excludePatterns = [/\.spec\.(ts|tsx)$/i, /\.e2e-spec\.(ts|tsx)$/i, /node_modules\//];

function walk(dir, opts = { includeDts: false }) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === "build") continue;
      out.push(...walk(full, opts));
    } else if (st.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx"))) {
      if (excludePatterns.some((re) => re.test(full))) continue;
      if (/\.d\.ts$/i.test(full) && !opts.includeDts) continue;
      out.push(full);
    }
  }
  return out;
}

function analyzeFile(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const lines = src.split(/\r?\n/);
  let total = 0;
  let documented = 0;

  // Simple state machine: look for export declarations and check if a TSDoc block precedes within 2 lines
  const exportDecl = /^(export\s+(default\s+)?)(abstract\s+)?(class|interface|type|function|const|let|var|enum)\b/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (exportDecl.test(line.trim())) {
      total++;
      // Look back skipping blank lines and decorators
      let j = i - 1;
      let hasDoc = false;
      let steps = 0;
      while (j >= 0 && steps < 5) {
        const prev = lines[j].trim();
        if (prev === "") {
          j--;
          steps++;
          continue;
        }
        if (prev.startsWith("@")) {
          j--;
          steps++;
          continue;
        } // decorator line
        if (prev.endsWith("*/")) {
          // Walk back to find beginning of block
          while (j >= 0 && !lines[j].includes("/**")) j--;
          if (j >= 0 && /\/\*\*/.test(lines[j])) {
            hasDoc = true;
          }
        }
        break;
      }
      if (hasDoc) documented++;
    }
  }
  return { total, documented };
}

function pct(n, d) {
  return d === 0 ? 100 : Math.round((n / d) * 1000) / 10;
}

const results = [];
for (const pkg of PACKAGES) {
  const roots = Array.isArray(pkg.roots) ? pkg.roots : [pkg.root];
  let files = [];
  for (const r of roots) {
    files.push(...walk(r, { includeDts: !!pkg.includeDts }));
  }
  let total = 0,
    documented = 0;
  for (const f of files) {
    const res = analyzeFile(f);
    total += res.total;
    documented += res.documented;
  }
  results.push({ name: pkg.name, total, documented, coverage: pct(documented, total) });
}

results.sort((a, b) => a.coverage - b.coverage);

const col = (s, w) => String(s).padEnd(w);
console.log("\nTSDoc coverage by package (exported declarations with TSDoc)");
console.log(col("Package", 30), col("Documented", 12), col("Total", 8), "Coverage");
for (const r of results) {
  console.log(col(r.name, 30), col(r.documented, 12), col(r.total, 8), r.coverage + "%");
}

// Flag low coverage packages
const low = results.filter((r) => r.coverage < 60 && r.total > 0);
if (low.length) {
  console.log("\nPackages below 60% coverage:");
  for (const r of low) console.log(` - ${r.name}: ${r.coverage}% (${r.documented}/${r.total})`);
}

console.log("\nTips to improve:");
console.log("- Ensure all exported classes/functions/types have a TSDoc block (/** ... */) with a one-line summary.");
console.log(
  "- Add @param and @returns where applicable; use @public for intended public APIs and mark internals @internal.",
);
console.log("- Re-export intended surface from index.ts to curate public API; keep internals unexported.");
console.log("- Avoid documenting specs by excluding *.spec.ts from TypeDoc (done for backend and job-broker).");
