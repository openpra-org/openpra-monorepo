#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SCRIPT_VERSION = "openpra-phase5-materialize-package-recovery-artifacts-v1";
const REPO_ROOT = "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo";
const DIST_ENTRY = path.join(
  REPO_ROOT,
  "dist/packages/quantum-readiness/src/lib/index.js"
);
const OUTPUT_ROOT = path.join(
  REPO_ROOT,
  "_work/openpra_phase5_materialize_package_recovery_artifacts_v1"
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

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function writeText(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, "utf8");
}

function sha256File(p) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(p));
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

function buildBundle(candidateDir) {
  return {
    packageMetadata: readJson(path.join(candidateDir, "package_metadata.json")),
    rawCounts: readJson(path.join(candidateDir, "raw_counts.json")),
    classicalReferenceMcs: readJson(path.join(candidateDir, "classical_reference_mcs.json"))
  };
}

function main() {
  if (!fs.existsSync(DIST_ENTRY)) {
    throw new Error(`Missing dist entry: ${DIST_ENTRY}`);
  }

  const pkg = require(DIST_ENTRY);
  if (typeof pkg.buildOpenpraQuantumRecoveryFromArtifacts !== "function") {
    throw new Error("buildOpenpraQuantumRecoveryFromArtifacts export not found.");
  }

  const candidates = [
    {
      label: "1037",
      candidateDir: path.join(
        REPO_ROOT,
        "_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z/0001_phase2b_row_1037"
      )
    },
    {
      label: "0698",
      candidateDir: path.join(
        REPO_ROOT,
        "_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z/0002_phase2b_row_0698"
      )
    },
    {
      label: "0905",
      candidateDir: path.join(
        REPO_ROOT,
        "_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z/0020_phase2b_row_0905"
      )
    }
  ];

  const outDir = path.join(OUTPUT_ROOT, utcStamp());
  fs.mkdirSync(outDir, { recursive: true });

  const rollup = {
    generatedAt: utcNowIso(),
    scriptVersion: SCRIPT_VERSION,
    distEntry: DIST_ENTRY,
    cases: []
  };

  for (const candidate of candidates) {
    const bundle = buildBundle(candidate.candidateDir);
    const result = pkg.buildOpenpraQuantumRecoveryFromArtifacts(bundle);

    const caseOutDir = path.join(outDir, candidate.label);
    fs.mkdirSync(caseOutDir, { recursive: true });

    const batchCopyPath = path.join(
      candidate.candidateDir,
      "openpra_package_recovery_result_v1.json"
    );
    const batchTxtPath = path.join(
      candidate.candidateDir,
      "openpra_package_recovery_result_v1.txt"
    );

    writeJson(path.join(caseOutDir, "openpra_package_recovery_result_v1.json"), result);
    writeJson(batchCopyPath, result);

    const txt = [
      `generated_at: ${result.generatedAt}`,
      `model_id: ${result.modelId}`,
      `candidate_root_node_id: ${result.candidateRootNodeId}`,
      `topology_class: ${result.topologyClass ?? "unknown"}`,
      `shots_total: ${result.shotsTotal}`,
      `primary_mode: ${result.integrationRecommendation.primaryMode}`,
      `requires_operator_attention: ${result.integrationRecommendation.requiresOperatorAttention}`,
      `tier1_recovered_exact_cut_set_count: ${result.recoveryTier1ExactHardware.recoveredExactCutSetCount}`,
      `reference_cut_set_count: ${result.referenceCutSetCount}`,
      `union_recovered_count: ${result.recoveryTier3UnionSensitivity.unionRecoveredCount}`,
      `union_all_recovered: ${result.recoveryTier3UnionSensitivity.allRecoveredInUnion}`
    ].join("\n") + "\n";

    writeText(path.join(caseOutDir, "openpra_package_recovery_result_v1.txt"), txt);
    writeText(batchTxtPath, txt);

    rollup.cases.push({
      label: candidate.label,
      modelId: result.modelId,
      candidateRootNodeId: result.candidateRootNodeId,
      topologyClass: result.topologyClass ?? null,
      primaryMode: result.integrationRecommendation.primaryMode,
      requiresOperatorAttention: result.integrationRecommendation.requiresOperatorAttention,
      tier1RecoveredExactCutSetCount:
        result.recoveryTier1ExactHardware.recoveredExactCutSetCount,
      referenceCutSetCount: result.referenceCutSetCount,
      unionRecoveredCount:
        result.recoveryTier3UnionSensitivity.unionRecoveredCount,
      unionAllRecovered:
        result.recoveryTier3UnionSensitivity.allRecoveredInUnion,
      batchCopyPath,
      batchTxtPath,
      jsonSha256: sha256File(batchCopyPath)
    });
  }

  writeJson(path.join(outDir, "materialization_rollup.json"), rollup);

  const txtLines = [];
  txtLines.push("OpenPRA Phase 5 package recovery materialization");
  txtLines.push("");
  txtLines.push(`generated_at: ${rollup.generatedAt}`);
  txtLines.push(`dist_entry: ${DIST_ENTRY}`);
  txtLines.push("");
  for (const row of rollup.cases) {
    txtLines.push(
      `${row.label}  model=${row.modelId}  primary_mode=${row.primaryMode}  ` +
      `tier1=${row.tier1RecoveredExactCutSetCount}/${row.referenceCutSetCount}  ` +
      `union=${row.unionRecoveredCount}/${row.referenceCutSetCount}  ` +
      `attention=${row.requiresOperatorAttention}`
    );
  }
  txtLines.push("");
  writeText(path.join(outDir, "materialization_rollup.txt"), txtLines.join("\n"));

  writeManifest(outDir);

  console.log(`OUTDIR=${outDir}`);
  console.log(`ROLLUP_JSON=${path.join(outDir, "materialization_rollup.json")}`);
  console.log(`ROLLUP_TXT=${path.join(outDir, "materialization_rollup.txt")}`);
  console.log(`MANIFEST=${path.join(outDir, "00_manifest.json")}`);
  console.log(`SHA256=${path.join(outDir, "SHA256SUMS.txt")}`);
}

main();
