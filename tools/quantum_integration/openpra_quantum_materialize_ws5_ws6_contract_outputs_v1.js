#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = process.cwd();
const EXAMPLES_ROOT = path.join(REPO_ROOT, "_work", "openpra_quantum_ws5_ws6_contract_examples_v1");
const OUT_ROOT = path.join(REPO_ROOT, "_work", "openpra_quantum_ws5_ws6_contract_outputs_v1");

function latestDir(root) {
  const dirs = fs
    .readdirSync(root)
    .map((name) => path.join(root, name))
    .filter((p) => fs.statSync(p).isDirectory())
    .sort();
  if (dirs.length === 0) {
    throw new Error(`No example directories found under ${root}`);
  }
  return dirs[dirs.length - 1];
}

function requireBuiltModule(relativePath) {
  const full = path.join(REPO_ROOT, "dist", "packages", "quantum-readiness", "src", "lib", relativePath);
  return require(full);
}

function main() {
  const latestExamplesDir = latestDir(EXAMPLES_ROOT);
  const outDir = path.join(OUT_ROOT, new Date().toISOString().replace(/[:.]/g, "_"));
  fs.mkdirSync(outDir, { recursive: true });

  const { buildOpenPraQuantumBoundedImportanceParityResult } = requireBuiltModule(
    "openpra-quantum-bounded-importance-parity-harness.js",
  );

  const { persistOpenPraQuantumExecutionArtifacts } = requireBuiltModule("openpra-quantum-execution-artifact-store.js");

  const ws5Examples = JSON.parse(
    fs.readFileSync(path.join(latestExamplesDir, "ws5_importance_response_examples_v1.json"), "utf8"),
  ).examples;

  const ws6Examples = JSON.parse(
    fs.readFileSync(path.join(latestExamplesDir, "ws6_execution_examples_v1.json"), "utf8"),
  ).examples;

  const ws5ParityResults = ws5Examples.map((example) =>
    buildOpenPraQuantumBoundedImportanceParityResult(example, example),
  );

  const ws6PersistResults = ws6Examples.map((example) =>
    persistOpenPraQuantumExecutionArtifacts({
      rootDirectoryPath: path.join(outDir, "ws6_execution_artifacts"),
      executionRecord: example.executionRecord,
      executionResult: example.executionResult,
      inputArtifactPaths: [],
      scriptVersion: "openpra-quantum-materialize-ws5-ws6-contract-outputs-v1",
    }),
  );

  fs.writeFileSync(
    path.join(outDir, "ws5_parity_results_v1.json"),
    `${JSON.stringify({ results: ws5ParityResults }, null, 2)}\n`,
    "utf8",
  );

  fs.writeFileSync(
    path.join(outDir, "ws6_persist_results_v1.json"),
    `${JSON.stringify({ results: ws6PersistResults }, null, 2)}\n`,
    "utf8",
  );

  const summary = {
    generatedAtUtc: new Date().toISOString(),
    latestExamplesDir,
    ws5ParityResultCount: ws5ParityResults.length,
    ws6PersistResultCount: ws6PersistResults.length,
  };

  fs.writeFileSync(
    path.join(outDir, "ws5_ws6_contract_outputs_summary_v1.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );

  fs.writeFileSync(
    path.join(outDir, "OPENPRA_QUANTUM_WS5_WS6_CONTRACT_OUTPUTS_MEMO_v1.txt"),
    [
      "OpenPRA Quantum WS5 WS6 Contract Outputs Memo v1",
      "",
      `Generated at UTC: ${summary.generatedAtUtc}`,
      `Latest examples directory: ${summary.latestExamplesDir}`,
      `WS5 parity result count: ${summary.ws5ParityResultCount}`,
      `WS6 persist result count: ${summary.ws6PersistResultCount}`,
      "",
      "Artifacts written",
      "- ws5_parity_results_v1.json",
      "- ws6_persist_results_v1.json",
      "- ws5_ws6_contract_outputs_summary_v1.json",
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(outDir);
  console.log(path.join(outDir, "OPENPRA_QUANTUM_WS5_WS6_CONTRACT_OUTPUTS_MEMO_v1.txt"));
  console.log(path.join(outDir, "ws5_ws6_contract_outputs_summary_v1.json"));
}

main();
