#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = process.cwd();
const EXAMPLES_ROOT = path.join(REPO_ROOT, "_work", "openpra_quantum_ws5_ws6_contract_examples_v1");
const OUT_ROOT = path.join(REPO_ROOT, "_work", "openpra_quantum_ws5_ws6_service_stub_outputs_v1");

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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const latestExamplesDir = latestDir(EXAMPLES_ROOT);
  const outDir = path.join(OUT_ROOT, new Date().toISOString().replace(/[:.]/g, "_"));
  fs.mkdirSync(outDir, { recursive: true });

  const { buildOpenPraQuantumBoundedImportanceServiceStub } = requireBuiltModule(
    "openpra-quantum-bounded-importance-service-stub.js",
  );

  const { buildOpenPraQuantumExecutionRecordServiceStub } = requireBuiltModule(
    "openpra-quantum-execution-record-service-stub.js",
  );

  const ws5Examples = JSON.parse(
    fs.readFileSync(path.join(latestExamplesDir, "ws5_importance_response_examples_v1.json"), "utf8"),
  ).examples;

  const ws6Examples = JSON.parse(
    fs.readFileSync(path.join(latestExamplesDir, "ws6_execution_examples_v1.json"), "utf8"),
  ).examples;

  const ws5Results = ws5Examples.map((example) =>
    buildOpenPraQuantumBoundedImportanceServiceStub({
      ...example,
      expectedResponse: example,
    }),
  );

  const ws6ArtifactsRoot = path.join(outDir, "ws6_execution_artifacts");
  const ws6Results = ws6Examples.map((example) =>
    buildOpenPraQuantumExecutionRecordServiceStub({
      rootDirectoryPath: ws6ArtifactsRoot,
      executionRecord: example.executionRecord,
      executionResult: example.executionResult,
      inputArtifactPaths: [],
      scriptVersion: "openpra-quantum-materialize-ws5-ws6-service-stub-outputs-v1",
    }),
  );

  writeJson(path.join(outDir, "ws5_service_stub_results_v1.json"), { results: ws5Results });
  writeJson(path.join(outDir, "ws6_service_stub_results_v1.json"), { results: ws6Results });

  const summary = {
    generatedAtUtc: new Date().toISOString(),
    latestExamplesDir,
    ws5ServiceStubResultCount: ws5Results.length,
    ws6ServiceStubResultCount: ws6Results.length,
  };

  writeJson(path.join(outDir, "ws5_ws6_service_stub_outputs_summary_v1.json"), summary);

  fs.writeFileSync(
    path.join(outDir, "OPENPRA_QUANTUM_WS5_WS6_SERVICE_STUB_OUTPUTS_MEMO_v1.txt"),
    [
      "OpenPRA Quantum WS5 WS6 Service Stub Outputs Memo v1",
      "",
      `Generated at UTC: ${summary.generatedAtUtc}`,
      `Latest examples directory: ${summary.latestExamplesDir}`,
      `WS5 service stub result count: ${summary.ws5ServiceStubResultCount}`,
      `WS6 service stub result count: ${summary.ws6ServiceStubResultCount}`,
      "",
      "Artifacts written",
      "- ws5_service_stub_results_v1.json",
      "- ws6_service_stub_results_v1.json",
      "- ws5_ws6_service_stub_outputs_summary_v1.json",
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(outDir);
  console.log(path.join(outDir, "OPENPRA_QUANTUM_WS5_WS6_SERVICE_STUB_OUTPUTS_MEMO_v1.txt"));
  console.log(path.join(outDir, "ws5_ws6_service_stub_outputs_summary_v1.json"));
}

main();
