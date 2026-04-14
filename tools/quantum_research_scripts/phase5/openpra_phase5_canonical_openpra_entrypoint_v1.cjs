#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SCRIPT_VERSION = "openpra-phase5-canonical-openpra-entrypoint-v1";
const REPO_ROOT = "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo";
const DIST_ENTRY = path.join(
  REPO_ROOT,
  "dist/packages/quantum-readiness/src/lib/index.js"
);
const DEFAULT_BATCH_ROOT = path.join(
  REPO_ROOT,
  "_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z"
);
const DEFAULT_OUTPUT_ROOT = path.join(
  REPO_ROOT,
  "_work/openpra_phase5_canonical_openpra_entrypoint_v1"
);
const DEFAULT_SELECTION_MODE = "legacy_validated_only";

function utcNowIso() {
  return new Date().toISOString();
}

function utcStamp() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}Z`;
}

function parseArgs(argv) {
  const out = {
    batchRoot: DEFAULT_BATCH_ROOT,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    selectionMode: DEFAULT_SELECTION_MODE
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--batch-root") {
      out.batchRoot = argv[++i];
      continue;
    }

    if (arg === "--output-root") {
      out.outputRoot = argv[++i];
      continue;
    }

    if (arg === "--selection-mode") {
      out.selectionMode = argv[++i];
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!["all_candidate_dirs", "package_result_only", "legacy_validated_only"].includes(out.selectionMode)) {
    throw new Error(
      `Invalid --selection-mode: ${out.selectionMode}. Expected one of all_candidate_dirs, package_result_only, legacy_validated_only.`
    );
  }

  return out;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

function sha256File(filePath) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(filePath));
  return h.digest("hex");
}

function writeManifest(rootDir) {
  const files = [];

  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile()) {
        files.push(full);
      }
    }
  }

  walk(rootDir);
  files.sort();

  const lines = [];
  for (const file of files) {
    const rel = path.relative(rootDir, file);
    lines.push(`${sha256File(file)}  ${rel}`);
  }

  const shaPath = path.join(rootDir, "SHA256SUMS.txt");
  fs.writeFileSync(shaPath, lines.join("\n") + "\n", "utf8");

  const manifest = {};
  for (const file of files) {
    const rel = path.relative(rootDir, file);
    manifest[rel] = sha256File(file);
  }
  manifest["SHA256SUMS.txt"] = sha256File(shaPath);

  writeJson(path.join(rootDir, "00_manifest.json"), manifest);
}

function buildResultText(result) {
  return [
    `generated_at: ${result.generatedAt}`,
    `model_id: ${result.modelId}`,
    `candidate_root_node_id: ${result.candidateRootNodeId}`,
    `topology_class: ${result.topologyClass ?? "unknown"}`,
    `basic_event_count: ${result.basicEventCount ?? "unknown"}`,
    `required_qubits: ${result.requiredQubits ?? "unknown"}`,
    `shots_total: ${result.shotsTotal}`,
    `primary_mode: ${result.integrationRecommendation.primaryMode}`,
    `requires_operator_attention: ${result.integrationRecommendation.requiresOperatorAttention}`,
    `tier1_recovered_exact_cut_set_count: ${result.recoveryTier1ExactHardware.recoveredExactCutSetCount}`,
    `reference_cut_set_count: ${result.referenceCutSetCount}`,
    `union_recovered_count: ${result.recoveryTier3UnionSensitivity.unionRecoveredCount}`,
    `union_all_recovered: ${result.recoveryTier3UnionSensitivity.allRecoveredInUnion}`
  ].join("\n") + "\n";
}

function buildRollupText(rollup) {
  const lines = [];
  lines.push("OpenPRA Phase 5 canonical package caller rollup");
  lines.push("");
  lines.push(`generated_at: ${rollup.generatedAt}`);
  lines.push(`batch_root: ${rollup.batchRoot}`);
  lines.push(`case_count: ${rollup.caseCount}`);
  lines.push(`exact_hardware_recovery_case_count: ${rollup.exactHardwareRecoveryCaseCount}`);
  lines.push(`union_sensitivity_recovery_case_count: ${rollup.unionSensitivityRecoveryCaseCount}`);
  lines.push(`operator_attention_required_case_count: ${rollup.operatorAttentionRequiredCaseCount}`);
  lines.push("");

  for (const row of rollup.cases) {
    lines.push(
      `${row.label}  model=${row.modelId}  primary_mode=${row.primaryMode}  ` +
      `tier1=${row.tier1RecoveredExactCutSetCount}/${row.referenceCutSetCount}  ` +
      `union=${row.unionRecoveredCount}/${row.referenceCutSetCount}  ` +
      `attention=${row.requiresOperatorAttention}`
    );
  }

  lines.push("");
  return lines.join("\n");
}

function deriveLabel(candidateDir) {
  const base = path.basename(candidateDir);
  const match = base.match(/phase2b_row_(\d+)/);
  return match ? match[1] : base;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(DIST_ENTRY)) {
    throw new Error(`Missing dist entry: ${DIST_ENTRY}`);
  }

  const pkg = require(DIST_ENTRY);

  const requiredExports = [
    "discoverOpenpraCandidateDirsInBatchRoot",
    "buildOpenpraQuantumRecoveryFromCandidateDir",
    "buildOpenpraQuantumRecoveryBatchRollup"
  ];

  for (const name of requiredExports) {
    if (typeof pkg[name] !== "function") {
      throw new Error(`${name} export not found.`);
    }
  }

  const batchRoot = path.resolve(args.batchRoot);
  if (!fs.existsSync(batchRoot) || !fs.statSync(batchRoot).isDirectory()) {
    throw new Error(`Batch root does not exist or is not a directory: ${batchRoot}`);
  }

  const candidateDirs = pkg.discoverOpenpraCandidateDirsInBatchRoot(
    batchRoot,
    args.selectionMode
  );

  const outDir = path.join(path.resolve(args.outputRoot), utcStamp());
  fs.mkdirSync(outDir, { recursive: true });

  const caseInputs = [];
  const caseCopies = [];

  for (const candidateDir of candidateDirs) {
    const result = pkg.buildOpenpraQuantumRecoveryFromCandidateDir(candidateDir);
    const label = deriveLabel(candidateDir);

    const candidateJsonPath = path.join(candidateDir, "openpra_package_recovery_result_v1.json");
    const candidateTxtPath = path.join(candidateDir, "openpra_package_recovery_result_v1.txt");

    writeJson(candidateJsonPath, result);
    writeText(candidateTxtPath, buildResultText(result));

    const caseOutDir = path.join(outDir, label);
    fs.mkdirSync(caseOutDir, { recursive: true });

    const caseJsonPath = path.join(caseOutDir, "openpra_package_recovery_result_v1.json");
    const caseTxtPath = path.join(caseOutDir, "openpra_package_recovery_result_v1.txt");

    writeJson(caseJsonPath, result);
    writeText(caseTxtPath, buildResultText(result));

    caseInputs.push({
      label,
      candidateDir,
      resultPath: candidateJsonPath,
      resultSha256: sha256File(candidateJsonPath),
      result
    });

    caseCopies.push({
      label,
      candidateDir,
      candidateJsonPath,
      candidateTxtPath,
      caseJsonPath,
      caseTxtPath
    });
  }

  const rollup = pkg.buildOpenpraQuantumRecoveryBatchRollup(
    batchRoot,
    caseInputs
  );

  const rollupJsonPath = path.join(outDir, "canonical_rollup.json");
  const rollupTxtPath = path.join(outDir, "canonical_rollup.txt");
  writeJson(rollupJsonPath, rollup);
  writeText(rollupTxtPath, buildRollupText(rollup));

  const summary = {
    generatedAt: utcNowIso(),
    scriptVersion: SCRIPT_VERSION,
    distEntry: DIST_ENTRY,
    batchRoot,
    selectionMode: args.selectionMode,
    caseCount: rollup.caseCount,
    exactHardwareRecoveryCaseCount: rollup.exactHardwareRecoveryCaseCount,
    unionSensitivityRecoveryCaseCount: rollup.unionSensitivityRecoveryCaseCount,
    operatorAttentionRequiredCaseCount: rollup.operatorAttentionRequiredCaseCount,
    rollupJsonPath,
    rollupTxtPath,
    cases: rollup.cases,
    caseCopies
  };

  writeJson(path.join(outDir, "canonical_entrypoint_summary.json"), summary);
  writeManifest(outDir);

  console.log(`OUTDIR=${outDir}`);
  console.log(`SUMMARY_JSON=${path.join(outDir, "canonical_entrypoint_summary.json")}`);
  console.log(`ROLLUP_JSON=${rollupJsonPath}`);
  console.log(`ROLLUP_TXT=${rollupTxtPath}`);
  console.log(`MANIFEST=${path.join(outDir, "00_manifest.json")}`);
  console.log(`SHA256=${path.join(outDir, "SHA256SUMS.txt")}`);
}

main();
