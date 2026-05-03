#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SCRIPT_VERSION = "openpra-phase5-package-single-candidate-cli-v1";
const REPO_ROOT = "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo";
const DIST_ENTRY = path.join(
  REPO_ROOT,
  "dist/packages/quantum-readiness/src/lib/index.js"
);
const DEFAULT_OUTPUT_ROOT = path.join(
  REPO_ROOT,
  "_work/openpra_phase5_package_single_candidate_cli_v1"
);

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
    candidateDir: null,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    writeBack: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--candidate-dir") {
      out.candidateDir = argv[++i];
      continue;
    }

    if (arg === "--output-root") {
      out.outputRoot = argv[++i];
      continue;
    }

    if (arg === "--no-write-back") {
      out.writeBack = false;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!out.candidateDir) {
    throw new Error("--candidate-dir is required.");
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

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(DIST_ENTRY)) {
    throw new Error(`Missing dist entry: ${DIST_ENTRY}`);
  }

  const pkg = require(DIST_ENTRY);
  if (typeof pkg.buildOpenpraQuantumRecoveryFromCandidateDir !== "function") {
    throw new Error("buildOpenpraQuantumRecoveryFromCandidateDir export not found.");
  }

  const candidateDir = path.resolve(args.candidateDir);
  if (!fs.existsSync(candidateDir) || !fs.statSync(candidateDir).isDirectory()) {
    throw new Error(`Candidate dir does not exist or is not a directory: ${candidateDir}`);
  }

  const result = pkg.buildOpenpraQuantumRecoveryFromCandidateDir(candidateDir);
  const outDir = path.join(
    path.resolve(args.outputRoot),
    `${utcStamp()}_${path.basename(candidateDir)}`
  );
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "openpra_package_recovery_result_v1.json");
  const txtPath = path.join(outDir, "openpra_package_recovery_result_v1.txt");

  writeJson(jsonPath, result);
  writeText(txtPath, buildResultText(result));

  let candidateJsonPath = null;
  let candidateTxtPath = null;

  if (args.writeBack) {
    candidateJsonPath = path.join(candidateDir, "openpra_package_recovery_result_v1.json");
    candidateTxtPath = path.join(candidateDir, "openpra_package_recovery_result_v1.txt");
    writeJson(candidateJsonPath, result);
    writeText(candidateTxtPath, buildResultText(result));
  }

  const summary = {
    generatedAt: utcNowIso(),
    scriptVersion: SCRIPT_VERSION,
    distEntry: DIST_ENTRY,
    candidateDir,
    primaryMode: result.integrationRecommendation.primaryMode,
    requiresOperatorAttention: result.integrationRecommendation.requiresOperatorAttention,
    tier1RecoveredExactCutSetCount: result.recoveryTier1ExactHardware.recoveredExactCutSetCount,
    referenceCutSetCount: result.referenceCutSetCount,
    unionRecoveredCount: result.recoveryTier3UnionSensitivity.unionRecoveredCount,
    unionAllRecovered: result.recoveryTier3UnionSensitivity.allRecoveredInUnion,
    outputJsonPath: jsonPath,
    outputTxtPath: txtPath,
    outputJsonSha256: sha256File(jsonPath),
    ...(candidateJsonPath
      ? {
          candidateJsonPath,
          candidateTxtPath,
          candidateJsonSha256: sha256File(candidateJsonPath)
        }
      : {})
  };

  writeJson(path.join(outDir, "summary.json"), summary);
  writeManifest(outDir);

  console.log(`OUTDIR=${outDir}`);
  console.log(`RESULT_JSON=${jsonPath}`);
  console.log(`RESULT_TXT=${txtPath}`);
  if (candidateJsonPath) {
    console.log(`CANDIDATE_JSON=${candidateJsonPath}`);
    console.log(`CANDIDATE_TXT=${candidateTxtPath}`);
  }
  console.log(`MANIFEST=${path.join(outDir, "00_manifest.json")}`);
  console.log(`SHA256=${path.join(outDir, "SHA256SUMS.txt")}`);
}

main();
