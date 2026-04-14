#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO_ROOT = path.resolve(__dirname, "..");
const WORK_BASE = path.join(REPO_ROOT, "_work", "openpra_phase4_real_bounded_cohort_exports_v1");

const DEFAULT_WORKING_SET_CSV =
  "/mnt/storage_array/projects/RESS_QUBO_EQUIVALENCE_REVISION_v1/Authoritative_paper_bundle_v1_20260318_004416Z/06_reactor_relevance_support/extracted_key_artifacts/PAPERB_PHASE2B_FULL_REVIEW_BUNDLE_v2_20260221_021115Z/extracted/phase2B/subtree_extract_v1/derived/WORKING_SET_subtrees_v1.csv";

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

function parseArgs(argv) {
  const options = {
    csvPath: DEFAULT_WORKING_SET_CSV,
    limit: 20,
    maxScan: 500,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--csv" && argv[i + 1]) {
      options.csvPath = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--limit" && argv[i + 1]) {
      options.limit = Number(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === "--max-scan" && argv[i + 1]) {
      options.maxScan = Number(argv[i + 1]);
      i += 1;
      continue;
    }
  }

  if (!Number.isInteger(options.limit) || options.limit <= 0) {
    throw new Error(`Invalid --limit value: ${options.limit}`);
  }

  if (!Number.isInteger(options.maxScan) || options.maxScan <= 0) {
    throw new Error(`Invalid --max-scan value: ${options.maxScan}`);
  }

  return options;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = i + 1 < line.length ? line[i + 1] : "";

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  values.push(current);
  return values;
}

function readCsvRows(csvPath) {
  const text = fs.readFileSync(csvPath, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error(`CSV has no data rows: ${csvPath}`);
  }

  const header = parseCsvLine(lines[0]);
  const rows = [];

  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCsvLine(lines[index]);
    const row = {};

    for (let col = 0; col < header.length; col += 1) {
      row[header[col]] = values[col] ?? "";
    }

    rows.push(row);
  }

  return rows;
}

function normalizeRootGateId(rootGate, graphNodesById) {
  if (graphNodesById.has(rootGate)) {
    return rootGate;
  }

  const prefixed = `G:${rootGate}`;
  if (graphNodesById.has(prefixed)) {
    return prefixed;
  }

  throw new Error(`Unable to resolve root gate '${rootGate}' in graph nodes.`);
}

function graphNodeToNormalizedNode(node, childMap, rootNodeId, row) {
  const rawType = String(node.type ?? "").trim();
  const upperType = rawType.toUpperCase();

  if (upperType.startsWith("GATE:")) {
    const gateType = rawType.split(":").slice(1).join(":").trim().toLowerCase();
    return {
      id: node.id,
      label: node.id,
      kind: "gate",
      gateType,
      children: [...(childMap.get(node.id) ?? [])].sort((a, b) => a.localeCompare(b)),
      metadata: {
        sourceGraphType: rawType,
        sourceRowId: row.row_id,
        isTop: node.id === rootNodeId,
      },
    };
  }

  if (upperType === "BASIC" || upperType === "HOUSE") {
    return {
      id: node.id,
      label: node.id,
      kind: "basicEvent",
      metadata: {
        sourceGraphType: rawType,
        sourceRowId: row.row_id,
      },
    };
  }

  throw new Error(`Unsupported graph_v1 node type '${rawType}' for row ${row.row_id} at node ${node.id}.`);
}

function graphJsonToNormalizedFaultTree(graphPayload, row) {
  if (!Array.isArray(graphPayload.nodes) || !Array.isArray(graphPayload.edges)) {
    throw new Error(`graph_v1.json for row ${row.row_id} is missing nodes or edges arrays.`);
  }

  const graphNodesById = new Map();
  for (const node of graphPayload.nodes) {
    graphNodesById.set(node.id, node);
  }

  const rootNodeId = normalizeRootGateId(String(graphPayload.root_gate ?? ""), graphNodesById);

  const childMap = new Map();
  for (const node of graphPayload.nodes) {
    childMap.set(node.id, []);
  }

  for (const edge of graphPayload.edges) {
    const parent = edge.parent;
    const child = edge.child;

    if (!graphNodesById.has(parent)) {
      throw new Error(`Edge parent '${parent}' missing from nodes for row ${row.row_id}.`);
    }

    if (!graphNodesById.has(child)) {
      throw new Error(`Edge child '${child}' missing from nodes for row ${row.row_id}.`);
    }

    childMap.get(parent).push(child);
  }

  const normalizedNodes = {};
  for (const node of graphPayload.nodes) {
    normalizedNodes[node.id] = graphNodeToNormalizedNode(node, childMap, rootNodeId, row);
  }

  return {
    id: `phase2b_row_${row.row_id}`,
    name: `Phase2B Row ${row.row_id} ${row.hazard_full}`,
    topNodeId: rootNodeId,
    sourceFormat: "normalized",
    nodes: normalizedNodes,
  };
}

function findTopCandidate(exportPayload, normalizedFaultTree) {
  const exact = exportPayload.clQuboCandidates.find(
    (candidate) => candidate.candidateRootNodeId === normalizedFaultTree.topNodeId,
  );

  if (exact) {
    return exact;
  }

  const matched = exportPayload.clQuboCandidates.find(
    (candidate) => candidate.requirementsAssessment?.matrixEntryMatched === true,
  );

  if (matched) {
    return matched;
  }

  throw new Error(
    `Unable to identify top candidate for model ${exportPayload.modelId} with topNodeId ${normalizedFaultTree.topNodeId}.`,
  );
}

function extractTopCandidateSummary(exportPayload, normalizedFaultTree, row, graphPayload) {
  const top = findTopCandidate(exportPayload, normalizedFaultTree);

  return {
    row_id: row.row_id,
    source_xml_path: row.source_xml_path,
    root_gate_id_csv: row.root_gate_id,
    root_gate_id_graph: graphPayload.root_gate,
    candidate_root_node_id: top.candidateRootNodeId,
    subtree_dir: row.subtree_dir,
    hazard_full: row.hazard_full,
    hazard_family: row.hazard_family,
    topology_class: top.topologyClassification?.topologyClass ?? "missing",
    matrix_entry_matched: Boolean(top.requirementsAssessment?.matrixEntryMatched),
    execution_priority: top.requirementsAssessment?.executionPriority ?? "missing",
    required_qubits: top.requirementsAssessment?.requiredQubits ?? null,
    basic_event_count: top.orderedBasicEventIds.length,
    minimal_cut_set_count: top.frozenMcsReference.minimalCutSetCount,
    feasible_basis_state_count: top.mixerSpecification.feasibleBasisStateCount,
    statevector_verification_eligible: Boolean(top.statevectorVerificationPlan.eligible),
  };
}

function buildReadme(runDir, summaryPayload) {
  const lines = [];

  lines.push("# OpenPRA Phase 4 Real Bounded Cohort CL-QUBO Export Run");
  lines.push("");
  lines.push(`Run directory: ${runDir}`);
  lines.push(`Generated at: ${summaryPayload.generated_at}`);
  lines.push(`Module load source: ${summaryPayload.module_load_source}`);
  lines.push(`Working set CSV: ${summaryPayload.working_set_csv}`);
  lines.push("");
  lines.push("Purpose");
  lines.push("");
  lines.push(
    "Export the first real bounded reactor-scale Phase 4 cohort by bridging Phase2B per-subtree graph_v1.json artifacts into the existing normalized CL-QUBO export seam.",
  );
  lines.push("");
  lines.push("Scan results");
  lines.push("");
  lines.push(`- bounded rows scanned: ${summaryPayload.bounded_rows_scanned}`);
  lines.push(`- candidate graph directories attempted: ${summaryPayload.graph_dirs_attempted}`);
  lines.push(`- selected count: ${summaryPayload.selected_count}`);
  lines.push(`- selection limit: ${summaryPayload.selection_limit}`);
  lines.push(`- max scan: ${summaryPayload.max_scan}`);
  lines.push("");

  if (summaryPayload.selected_candidates.length > 0) {
    lines.push("Selected real bounded cohort");
    lines.push("");

    for (const row of summaryPayload.selected_candidates) {
      lines.push(
        `- row ${row.row_id}: topology=${row.topology_class}, matrix_match=${row.matrix_entry_matched ? "yes" : "no"}, priority=${row.execution_priority}, qubits=${row.required_qubits}, n=${row.basic_event_count}, mcs_count=${row.minimal_cut_set_count}, subtree_dir=${row.subtree_dir}`,
      );
    }

    lines.push("");
  } else {
    lines.push("Selected real bounded cohort");
    lines.push("");
    lines.push("- none");
    lines.push("");
  }

  lines.push("Rejected counts");
  lines.push("");
  for (const [key, value] of Object.entries(summaryPayload.rejected_counts)) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push("");

  lines.push("Interpretation");
  lines.push("");
  if (summaryPayload.selected_count > 0) {
    lines.push(
      "A real bounded reactor-scale cohort has now been exported through the live package seam and is ready for Qiskit materialization and statevector verification.",
    );
  } else {
    lines.push(
      "No real bounded matrix-matched cohort was found within the configured scan window. Increase --max-scan or inspect rejected rows.",
    );
  }
  lines.push("");

  return lines.join("\n");
}

function incrementRejected(rejectedCounts, key) {
  rejectedCounts[key] = (rejectedCounts[key] ?? 0) + 1;
}

function main() {
  const options = parseArgs(process.argv);

  if (!fs.existsSync(options.csvPath)) {
    throw new Error(`Working set CSV does not exist: ${options.csvPath}`);
  }

  const moduleLoad = loadQuantumPreparationModule();
  const { analyzeFaultTreeQuantumPreparationClQuboExport } = moduleLoad.loaded;

  const runDir = path.join(WORK_BASE, utcStamp());
  ensureDir(runDir);

  const rows = readCsvRows(options.csvPath);
  const rejectedCounts = {};
  const selectedCandidates = [];

  let boundedRowsScanned = 0;
  let graphDirsAttempted = 0;

  for (const row of rows) {
    if (String(row.status) !== "OK") {
      continue;
    }

    const basicCount = Number(row.subtree_basic_count);
    if (!Number.isInteger(basicCount) || basicCount > 8) {
      continue;
    }

    boundedRowsScanned += 1;
    if (boundedRowsScanned > options.maxScan) {
      break;
    }

    const graphPath = path.join(row.subtree_dir, "graph_v1.json");
    if (!fs.existsSync(graphPath)) {
      incrementRejected(rejectedCounts, "missing_graph_v1_json");
      continue;
    }

    graphDirsAttempted += 1;

    let graphPayload;
    let normalizedFaultTree;
    let exportPayload;
    let summary;

    try {
      graphPayload = JSON.parse(fs.readFileSync(graphPath, "utf8"));
      normalizedFaultTree = graphJsonToNormalizedFaultTree(graphPayload, row);
      exportPayload = analyzeFaultTreeQuantumPreparationClQuboExport(normalizedFaultTree, {
        includeRequirementsMatrix: true,
      });
      summary = extractTopCandidateSummary(exportPayload, normalizedFaultTree, row, graphPayload);
    } catch (error) {
      incrementRejected(rejectedCounts, "bridge_or_export_error");
      continue;
    }

    if (!summary.matrix_entry_matched) {
      incrementRejected(rejectedCounts, "not_matrix_matched");
      continue;
    }

    if (!["A", "B", "C", "D"].includes(summary.topology_class)) {
      incrementRejected(rejectedCounts, "topology_not_bounded_abcd");
      continue;
    }

    const rank = selectedCandidates.length + 1;
    const exportFile = `${String(rank).padStart(4, "0")}_real_case_row${String(row.row_id).padStart(4, "0")}_clqubo_export.json`;
    const sourceRowFile = `${String(rank).padStart(4, "0")}_real_case_row${String(row.row_id).padStart(4, "0")}_source_row.json`;
    const graphCopyFile = `${String(rank).padStart(4, "0")}_real_case_row${String(row.row_id).padStart(4, "0")}_graph_v1.json`;

    const exportPath = path.join(runDir, exportFile);
    const sourceRowPath = path.join(runDir, sourceRowFile);
    const graphCopyPath = path.join(runDir, graphCopyFile);

    writeJson(exportPath, exportPayload);
    writeJson(sourceRowPath, row);
    writeJson(graphCopyPath, graphPayload);

    writeShaSidecar(exportPath);
    writeShaSidecar(sourceRowPath);
    writeShaSidecar(graphCopyPath);

    selectedCandidates.push({
      selection_rank: rank,
      export_file: exportFile,
      source_row_file: sourceRowFile,
      graph_copy_file: graphCopyFile,
      ...summary,
    });

    if (selectedCandidates.length >= options.limit) {
      break;
    }
  }

  const summaryPayload = {
    generated_at: isoUtcNow(),
    run_dir: runDir,
    export_slice: "phase4-bounded-clqubo-v1",
    cohort_type: "real_bounded_phase2b_first_match",
    module_load_source: moduleLoad.source,
    working_set_csv: options.csvPath,
    selection_limit: options.limit,
    max_scan: options.maxScan,
    bounded_rows_scanned: boundedRowsScanned,
    graph_dirs_attempted: graphDirsAttempted,
    selected_count: selectedCandidates.length,
    selected_candidates: selectedCandidates,
    rejected_counts: rejectedCounts,
  };

  const manifestPayload = {
    generated_at: isoUtcNow(),
    repo_root: REPO_ROOT,
    run_dir: runDir,
    source: "phase2b_graph_v1_real_bounded_cohort_export",
    module_load_source: moduleLoad.source,
    working_set_csv: options.csvPath,
    selection_limit: options.limit,
    max_scan: options.maxScan,
    selected_count: selectedCandidates.length,
    summary_file: "90_phase4_real_bounded_summary.json",
    readme_file: "README.txt",
  };

  const summaryPath = path.join(runDir, "90_phase4_real_bounded_summary.json");
  const manifestPath = path.join(runDir, "00_manifest.json");
  const readmePath = path.join(runDir, "README.txt");

  writeJson(summaryPath, summaryPayload);
  writeJson(manifestPath, manifestPayload);
  writeText(readmePath, buildReadme(runDir, summaryPayload));

  writeShaSidecar(summaryPath);
  writeShaSidecar(manifestPath);
  writeShaSidecar(readmePath);

  console.log(`RUN_DIR=${runDir}`);
  console.log(`MANIFEST=${manifestPath}`);
  console.log(`SUMMARY=${summaryPath}`);
  console.log(`README=${readmePath}`);
  console.log(`MODULE_LOAD_SOURCE=${moduleLoad.source}`);
  console.log(`SELECTED_COUNT=${selectedCandidates.length}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
