#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO_ROOT = path.resolve(__dirname, "..");
const WORK_BASE = path.join(REPO_ROOT, "_work", "openpra_phase4_clqubo_exports_v1");

function utcStamp() {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}Z`;
}

function isoUtcNow() {
  return new Date().toISOString();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function writeShaSidecar(filePath) {
  const sidecar = `${filePath}.sha256.txt`;
  fs.writeFileSync(sidecar, `${sha256File(filePath)}  ${filePath}\n`, "utf8");
  return sidecar;
}

function basic(id, label) {
  return {
    id,
    kind: "basicEvent",
    label,
  };
}

function gate(id, gateType, children, label) {
  return {
    id,
    kind: "gate",
    gateType,
    children,
    label,
  };
}

function buildCase3A5() {
  return {
    id: "synthetic_topology_a_n5_case",
    name: "Synthetic Topology A N5 Verification Case",
    topNodeId: "TOP",
    sourceFormat: "normalized",
    nodes: {
      TOP: gate("TOP", "or", ["G1", "G2", "E"], "Top Gate"),
      G1: gate("G1", "and", ["A", "B"], "Gate 1"),
      G2: gate("G2", "and", ["C", "D"], "Gate 2"),
      A: basic("A", "Basic Event A"),
      B: basic("B", "Basic Event B"),
      C: basic("C", "Basic Event C"),
      D: basic("D", "Basic Event D"),
      E: basic("E", "Basic Event E"),
    },
  };
}

function buildCase4B6() {
  return {
    id: "synthetic_topology_b_n6_case",
    name: "Synthetic Topology B N6 Verification Case",
    topNodeId: "TOP",
    sourceFormat: "normalized",
    nodes: {
      TOP: gate("TOP", "or", ["G1", "G2", "G3"], "Top Gate"),
      G1: gate("G1", "and", ["A", "B"], "Gate 1"),
      G2: gate("G2", "and", ["C", "D"], "Gate 2"),
      G3: gate("G3", "and", ["E", "F"], "Gate 3"),
      A: basic("A", "Basic Event A"),
      B: basic("B", "Basic Event B"),
      C: basic("C", "Basic Event C"),
      D: basic("D", "Basic Event D"),
      E: basic("E", "Basic Event E"),
      F: basic("F", "Basic Event F"),
    },
  };
}

function buildCase5C8() {
  return {
    id: "synthetic_topology_c_n8_case",
    name: "Synthetic Topology C N8 Verification Case",
    topNodeId: "TOP",
    sourceFormat: "normalized",
    nodes: {
      TOP: gate("TOP", "or", ["G1", "G2", "G3", "G4"], "Top Gate"),
      G1: gate("G1", "and", ["A", "B"], "Gate 1"),
      G2: gate("G2", "and", ["C", "D"], "Gate 2"),
      G3: gate("G3", "and", ["E", "F"], "Gate 3"),
      G4: gate("G4", "and", ["G", "H"], "Gate 4"),
      A: basic("A", "Basic Event A"),
      B: basic("B", "Basic Event B"),
      C: basic("C", "Basic Event C"),
      D: basic("D", "Basic Event D"),
      E: basic("E", "Basic Event E"),
      F: basic("F", "Basic Event F"),
      G: basic("G", "Basic Event G"),
      H: basic("H", "Basic Event H"),
    },
  };
}

function buildCase6D8() {
  return {
    id: "synthetic_topology_d_n8_case",
    name: "Synthetic Topology D N8 Verification Case",
    topNodeId: "TOP",
    sourceFormat: "normalized",
    nodes: {
      TOP: gate("TOP", "or", ["G1", "G2", "G3"], "Top Gate"),
      G1: gate("G1", "and", ["A", "B"], "Gate 1"),
      G2: gate("G2", "and", ["C", "D"], "Gate 2"),
      G3: gate("G3", "or", ["E", "F", "G", "H"], "Gate 3"),
      A: basic("A", "Basic Event A"),
      B: basic("B", "Basic Event B"),
      C: basic("C", "Basic Event C"),
      D: basic("D", "Basic Event D"),
      E: basic("E", "Basic Event E"),
      F: basic("F", "Basic Event F"),
      G: basic("G", "Basic Event G"),
      H: basic("H", "Basic Event H"),
    },
  };
}

const CASES = [
  {
    caseId: "case3",
    tree: buildCase3A5(),
    exportFile: "30_case3_clqubo_export.json",
  },
  {
    caseId: "case4",
    tree: buildCase4B6(),
    exportFile: "40_case4_clqubo_export.json",
  },
  {
    caseId: "case5",
    tree: buildCase5C8(),
    exportFile: "50_case5_clqubo_export.json",
  },
  {
    caseId: "case6",
    tree: buildCase6D8(),
    exportFile: "60_case6_clqubo_export.json",
  },
];

function configureTsNodeEnvironment() {
  process.env.TS_NODE_TRANSPILE_ONLY = "true";
  process.env.TS_NODE_SKIP_PROJECT = "true";
  process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
    module: "NodeNext",
    moduleResolution: "NodeNext",
    target: "ES2022",
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
  });
}

function tryLoadFromTsSource() {
  configureTsNodeEnvironment();

  const tsRegisterCandidates = ["ts-node/register/transpile-only", "ts-node/register"];

  const registerErrors = [];

  for (const candidate of tsRegisterCandidates) {
    try {
      require(candidate);

      const sourcePath = path.join(REPO_ROOT, "packages", "quantum-readiness", "src", "lib", "quantum-preparation.ts");

      const loaded = require(sourcePath);
      if (typeof loaded.analyzeFaultTreeQuantumPreparationClQuboExport === "function") {
        return { ok: true, loaded };
      }

      registerErrors.push(
        `Loaded ${sourcePath} via ${candidate} but analyzeFaultTreeQuantumPreparationClQuboExport was not exported.`,
      );
    } catch (error) {
      registerErrors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    ok: false,
    error: registerErrors.join(" | "),
  };
}

function tryLoadFromWorkspacePackage() {
  try {
    const loaded = require("quantum-readiness");
    if (typeof loaded.analyzeFaultTreeQuantumPreparationClQuboExport === "function") {
      return { ok: true, loaded };
    }

    return {
      ok: false,
      error:
        "Workspace package quantum-readiness loaded but analyzeFaultTreeQuantumPreparationClQuboExport was not exported.",
    };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to load workspace package quantum-readiness: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function tryLoadFromDistCandidates() {
  const candidates = [
    path.join(REPO_ROOT, "dist", "packages", "quantum-readiness", "src", "lib", "quantum-preparation.js"),
    path.join(REPO_ROOT, "dist", "packages", "quantum-readiness", "lib", "quantum-preparation.js"),
    path.join(REPO_ROOT, "dist", "packages", "quantum-readiness", "index.js"),
  ];

  const errors = [];

  for (const candidatePath of candidates) {
    try {
      if (!fs.existsSync(candidatePath)) {
        errors.push(`Not found: ${candidatePath}`);
        continue;
      }

      const loaded = require(candidatePath);
      if (typeof loaded.analyzeFaultTreeQuantumPreparationClQuboExport === "function") {
        return { ok: true, loaded };
      }

      errors.push(`Loaded ${candidatePath} but analyzeFaultTreeQuantumPreparationClQuboExport was not exported.`);
    } catch (error) {
      errors.push(`Failed to load ${candidatePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    ok: false,
    error: errors.join(" | "),
  };
}

function loadQuantumPreparationModule() {
  const attempts = [
    { label: "ts_source", result: tryLoadFromTsSource() },
    { label: "workspace_package", result: tryLoadFromWorkspacePackage() },
    { label: "dist_candidates", result: tryLoadFromDistCandidates() },
  ];

  for (const attempt of attempts) {
    if (attempt.result.ok) {
      return {
        loaded: attempt.result.loaded,
        source: attempt.label,
      };
    }
  }

  throw new Error(
    `Unable to load analyzeFaultTreeQuantumPreparationClQuboExport from any source. Details: ${attempts
      .map((attempt) => `${attempt.label}: ${attempt.result.error}`)
      .join(" || ")}`,
  );
}

function extractTopCandidateSummary(exportPayload, caseId) {
  const top = exportPayload.clQuboCandidates.find((candidate) => candidate.candidateRootNodeId === "TOP");

  if (!top) {
    throw new Error(`TOP candidate not found in CL-QUBO export for ${caseId}`);
  }

  return {
    case_id: caseId,
    model_id: exportPayload.modelId,
    topology_class: top.topologyClassification?.topologyClass ?? "missing",
    matrix_entry_matched: Boolean(top.requirementsAssessment?.matrixEntryMatched),
    execution_priority: top.requirementsAssessment?.executionPriority ?? "missing",
    required_qubits: top.requirementsAssessment?.requiredQubits ?? null,
    minimal_cut_set_count: top.frozenMcsReference.minimalCutSetCount,
    mcs_bitstrings: [...top.frozenMcsReference.bitstrings],
    feasible_basis_state_count: top.mixerSpecification.feasibleBasisStateCount,
    statevector_verification_eligible: Boolean(top.statevectorVerificationPlan.eligible),
  };
}

function buildReadme(runDir, summaries, moduleLoadSource) {
  const lines = [];

  lines.push("# OpenPRA Phase 4 CL-QUBO Export Run");
  lines.push("");
  lines.push(`Run directory: ${runDir}`);
  lines.push(`Generated at: ${isoUtcNow()}`);
  lines.push(`Module load source: ${moduleLoadSource}`);
  lines.push("");
  lines.push("Purpose");
  lines.push("");
  lines.push(
    "Generate bounded package-level Phase 4 CL-QUBO export artifacts for the synthetic A, B, C, and D proof cases.",
  );
  lines.push("");
  lines.push("Key results");
  lines.push("");

  for (const row of summaries) {
    lines.push(
      `- ${row.case_id}: topology=${row.topology_class}, matrix_match=${row.matrix_entry_matched ? "yes" : "no"}, execution_priority=${row.execution_priority}, required_qubits=${row.required_qubits}, mcs_count=${row.minimal_cut_set_count}, statevector_eligible=${row.statevector_verification_eligible ? "yes" : "no"}`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

function main() {
  const moduleLoad = loadQuantumPreparationModule();
  const { analyzeFaultTreeQuantumPreparationClQuboExport } = moduleLoad.loaded;

  const runDir = path.join(WORK_BASE, utcStamp());
  ensureDir(runDir);

  const caseSummaries = [];

  for (const entry of CASES) {
    const exportPayload = analyzeFaultTreeQuantumPreparationClQuboExport(entry.tree, {
      includeRequirementsMatrix: true,
    });

    const exportPath = path.join(runDir, entry.exportFile);
    writeJson(exportPath, exportPayload);
    writeShaSidecar(exportPath);

    caseSummaries.push(extractTopCandidateSummary(exportPayload, entry.caseId));
  }

  caseSummaries.sort((left, right) => left.case_id.localeCompare(right.case_id));

  const summaryPayload = {
    generated_at: isoUtcNow(),
    run_dir: runDir,
    export_slice: "phase4-bounded-clqubo-v1",
    module_load_source: moduleLoad.source,
    top_candidate_summaries: caseSummaries,
  };

  const manifestPayload = {
    generated_at: isoUtcNow(),
    repo_root: REPO_ROOT,
    run_dir: runDir,
    source: "package_level_clqubo_export",
    module_load_source: moduleLoad.source,
    cases: CASES.map((entry) => ({
      case_id: entry.caseId,
      model_id: entry.tree.id,
      model_name: entry.tree.name,
      export_file: entry.exportFile,
    })),
    summary_file: "90_phase4_summary.json",
    readme_file: "README.txt",
  };

  const summaryPath = path.join(runDir, "90_phase4_summary.json");
  const manifestPath = path.join(runDir, "00_manifest.json");
  const readmePath = path.join(runDir, "README.txt");

  writeJson(summaryPath, summaryPayload);
  writeJson(manifestPath, manifestPayload);
  writeText(readmePath, buildReadme(runDir, caseSummaries, moduleLoad.source));

  writeShaSidecar(summaryPath);
  writeShaSidecar(manifestPath);
  writeShaSidecar(readmePath);

  console.log(`RUN_DIR=${runDir}`);
  console.log(`MANIFEST=${manifestPath}`);
  console.log(`SUMMARY=${summaryPath}`);
  console.log(`README=${readmePath}`);
  console.log(`MODULE_LOAD_SOURCE=${moduleLoad.source}`);
  for (const entry of CASES) {
    console.log(`${entry.caseId}=${path.join(runDir, entry.exportFile)}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
