#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SCRIPT_VERSION = "openpra-phase5-build-package-recovery-batch-rollup-v1";
const REPO_ROOT = "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo";
const BATCH_ROOT = path.join(
  REPO_ROOT,
  "_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z"
);
const OUTPUT_ROOT = path.join(
  REPO_ROOT,
  "_work/openpra_phase5_build_package_recovery_batch_rollup_v1"
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

function main() {
  const candidates = [
    {
      label: "1037",
      candidateDir: path.join(BATCH_ROOT, "0001_phase2b_row_1037")
    },
    {
      label: "0698",
      candidateDir: path.join(BATCH_ROOT, "0002_phase2b_row_0698")
    },
    {
      label: "0905",
      candidateDir: path.join(BATCH_ROOT, "0020_phase2b_row_0905")
    }
  ];

  const outDir = path.join(OUTPUT_ROOT, utcStamp());
  fs.mkdirSync(outDir, { recursive: true });

  const cases = [];
  for (const candidate of candidates) {
    const resultPath = path.join(
      candidate.candidateDir,
      "openpra_package_recovery_result_v1.json"
    );
    if (!fs.existsSync(resultPath)) {
      throw new Error(`Missing package recovery result: ${resultPath}`);
    }

    const result = readJson(resultPath);

    cases.push({
      label: candidate.label,
      modelId: result.modelId,
      candidateRootNodeId: result.candidateRootNodeId,
      topologyClass: result.topologyClass ?? null,
      basicEventCount: result.basicEventCount ?? null,
      requiredQubits: result.requiredQubits ?? null,
      primaryMode: result.integrationRecommendation.primaryMode,
      requiresOperatorAttention: result.integrationRecommendation.requiresOperatorAttention,
      referenceCutSetCount: result.referenceCutSetCount,
      tier1RecoveredExactCutSetCount:
        result.recoveryTier1ExactHardware.recoveredExactCutSetCount,
      unionRecoveredCount:
        result.recoveryTier3UnionSensitivity.unionRecoveredCount,
      unionAllRecovered:
        result.recoveryTier3UnionSensitivity.allRecoveredInUnion,
      candidateDir: candidate.candidateDir,
      resultPath,
      resultSha256: sha256File(resultPath)
    });
  }

  const rollup = {
    generatedAt: utcNowIso(),
    scriptVersion: SCRIPT_VERSION,
    batchRoot: BATCH_ROOT,
    caseCount: cases.length,
    exactHardwareRecoveryCaseCount: cases.filter(
      (row) => row.primaryMode === "exact_hardware_recovery"
    ).length,
    unionSensitivityRecoveryCaseCount: cases.filter(
      (row) => row.primaryMode === "union_sensitivity_recovery"
    ).length,
    operatorAttentionRequiredCaseCount: cases.filter(
      (row) => row.requiresOperatorAttention
    ).length,
    cases
  };

  const rollupJsonPath = path.join(outDir, "openpra_package_recovery_batch_rollup_v1.json");
  const rollupTxtPath = path.join(outDir, "openpra_package_recovery_batch_rollup_v1.txt");

  writeJson(rollupJsonPath, rollup);

  const txt = [];
  txt.push("OpenPRA Phase 5 package recovery batch rollup");
  txt.push("");
  txt.push(`generated_at: ${rollup.generatedAt}`);
  txt.push(`batch_root: ${BATCH_ROOT}`);
  txt.push(`case_count: ${rollup.caseCount}`);
  txt.push(`exact_hardware_recovery_case_count: ${rollup.exactHardwareRecoveryCaseCount}`);
  txt.push(`union_sensitivity_recovery_case_count: ${rollup.unionSensitivityRecoveryCaseCount}`);
  txt.push(`operator_attention_required_case_count: ${rollup.operatorAttentionRequiredCaseCount}`);
  txt.push("");
  for (const row of cases) {
    txt.push(
      `${row.label}  model=${row.modelId}  primary_mode=${row.primaryMode}  ` +
      `tier1=${row.tier1RecoveredExactCutSetCount}/${row.referenceCutSetCount}  ` +
      `union=${row.unionRecoveredCount}/${row.referenceCutSetCount}  ` +
      `attention=${row.requiresOperatorAttention}`
    );
  }
  txt.push("");
  writeText(rollupTxtPath, txt.join("\n"));

  const batchCopyJson = path.join(BATCH_ROOT, "openpra_package_recovery_batch_rollup_v1.json");
  const batchCopyTxt = path.join(BATCH_ROOT, "openpra_package_recovery_batch_rollup_v1.txt");
  writeJson(batchCopyJson, rollup);
  writeText(batchCopyTxt, txt.join("\n"));

  writeManifest(outDir);

  console.log(`OUTDIR=${outDir}`);
  console.log(`ROLLUP_JSON=${rollupJsonPath}`);
  console.log(`ROLLUP_TXT=${rollupTxtPath}`);
  console.log(`BATCH_COPY_JSON=${batchCopyJson}`);
  console.log(`BATCH_COPY_TXT=${batchCopyTxt}`);
  console.log(`MANIFEST=${path.join(outDir, "00_manifest.json")}`);
  console.log(`SHA256=${path.join(outDir, "SHA256SUMS.txt")}`);
}

main();
