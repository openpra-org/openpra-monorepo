#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SCRIPT_VERSION = "openpra-phase5-validate-package-recovery-on-real-candidates-v1";
const REPO_ROOT = "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo";
const DIST_ENTRY = path.join(
  REPO_ROOT,
  "dist/packages/quantum-readiness/src/lib/index.js"
);
const OUTPUT_ROOT = path.join(
  REPO_ROOT,
  "_work/openpra_phase5_validate_package_recovery_on_real_candidates_v1"
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

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeForStructuralComparison(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeForStructuralComparison);
  }

  if (isObject(value)) {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (key === "generatedAt" || key === "generated_at") {
        continue;
      }
      out[key] = normalizeForStructuralComparison(value[key]);
    }
    return out;
  }

  return value;
}

function deepEqualCanonical(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sortNestedStringSets(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => Array.isArray(row) ? [...row].sort() : row)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function sortStringArray(value) {
  return Array.isArray(value) ? [...value].sort() : [];
}

function canonicalizeBuilt(result) {
  return {
    modelId: result.modelId,
    candidateRootNodeId: result.candidateRootNodeId,
    topologyClass: result.topologyClass ?? null,
    basicEventCount: result.basicEventCount ?? null,
    requiredQubits: result.requiredQubits ?? null,
    shotsTotal: result.shotsTotal,
    primaryMode: result.integrationRecommendation.primaryMode,
    requiresOperatorAttention: result.integrationRecommendation.requiresOperatorAttention,
    referenceCutSetCount: result.referenceCutSetCount,
    tier1RecoveredExactCutSetCount:
      result.recoveryTier1ExactHardware.recoveredExactCutSetCount,
    tier1MissingReferenceBitstrings: sortStringArray(
      result.recoveryTier1ExactHardware.missingReferenceBitstrings
    ),
    tier1RecoveredBasicEventIdSets: sortNestedStringSets(
      result.recoveryTier1ExactHardware.recoveredBasicEventIdSets
    ),
    unionRecoveredCount:
      result.recoveryTier3UnionSensitivity.unionRecoveredCount,
    unionAllRecovered:
      result.recoveryTier3UnionSensitivity.allRecoveredInUnion,
    unionBasicEventIdSets: sortNestedStringSets(
      result.recoveryTier3UnionSensitivity.unionBasicEventIdSets
    ),
    supplementalUnionOnlyBasicEventIdSets: sortNestedStringSets(
      result.integrationRecommendation.supplementalUnionOnlyBasicEventIdSets ?? []
    )
  };
}

function canonicalizeExpected(result) {
  const integrationRecommendation =
    result.integrationRecommendation ?? result.integration_recommendation ?? {};

  const tier1 =
    result.recoveryTier1ExactHardware ?? result.recovery_tier_1_exact_hardware ?? {};

  const unionTier =
    result.recoveryTier3UnionSensitivity ?? result.recovery_tier_3_union_sensitivity ?? {};

  return {
    modelId: result.modelId ?? result.model_id,
    candidateRootNodeId: result.candidateRootNodeId ?? result.candidate_root_node_id,
    topologyClass: result.topologyClass ?? result.topology_class ?? null,
    basicEventCount: result.basicEventCount ?? result.basic_event_count ?? null,
    requiredQubits: result.requiredQubits ?? result.required_qubits ?? null,
    shotsTotal: result.shotsTotal ?? result.shots_total,
    primaryMode: integrationRecommendation.primaryMode ?? integrationRecommendation.primary_mode,
    requiresOperatorAttention:
      integrationRecommendation.requiresOperatorAttention ??
      integrationRecommendation.requires_operator_attention,
    referenceCutSetCount: result.referenceCutSetCount ?? result.reference_cut_set_count,
    tier1RecoveredExactCutSetCount:
      tier1.recoveredExactCutSetCount ?? tier1.recovered_exact_cut_set_count,
    tier1MissingReferenceBitstrings: sortStringArray(
      tier1.missingReferenceBitstrings ?? tier1.missing_reference_bitstrings ?? []
    ),
    tier1RecoveredBasicEventIdSets: sortNestedStringSets(
      tier1.recoveredBasicEventIdSets ?? tier1.recovered_basicEventIdSets ?? []
    ),
    unionRecoveredCount:
      unionTier.unionRecoveredCount ?? unionTier.union_recovered_count,
    unionAllRecovered:
      unionTier.allRecoveredInUnion ?? unionTier.all_recovered_in_union,
    unionBasicEventIdSets: sortNestedStringSets(
      unionTier.unionBasicEventIdSets ?? unionTier.union_basicEventIdSets ?? []
    ),
    supplementalUnionOnlyBasicEventIdSets: sortNestedStringSets(
      integrationRecommendation.supplementalUnionOnlyBasicEventIdSets ??
      integrationRecommendation.supplemental_union_only_basicEventIdSets ??
      []
    )
  };
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
    throw new Error("buildOpenpraQuantumRecoveryFromArtifacts export not found in built package.");
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

  const results = [];
  for (const candidate of candidates) {
    const ladderPath = path.join(candidate.candidateDir, "openpra_recovery_ladder_result_v1.json");
    if (!fs.existsSync(ladderPath)) {
      throw new Error(`Missing candidate recovery artifact: ${ladderPath}`);
    }

    const bundle = buildBundle(candidate.candidateDir);
    const builtResult = pkg.buildOpenpraQuantumRecoveryFromArtifacts(bundle);
    const expectedResult = readJson(ladderPath);

    const structuralMatchIgnoringGeneratedAt = deepEqualCanonical(
      normalizeForStructuralComparison(builtResult),
      normalizeForStructuralComparison(expectedResult)
    );

    const semanticBuilt = canonicalizeBuilt(builtResult);
    const semanticExpected = canonicalizeExpected(expectedResult);
    const semanticParityMatch = deepEqualCanonical(semanticBuilt, semanticExpected);

    const caseOutDir = path.join(outDir, candidate.label);
    fs.mkdirSync(caseOutDir, { recursive: true });

    writeJson(path.join(caseOutDir, "built_from_package.json"), builtResult);
    writeJson(path.join(caseOutDir, "expected_candidate_artifact.json"), expectedResult);
    writeJson(path.join(caseOutDir, "semantic_built.json"), semanticBuilt);
    writeJson(path.join(caseOutDir, "semantic_expected.json"), semanticExpected);

    const summary = {
      label: candidate.label,
      modelId: builtResult.modelId,
      candidateRootNodeId: builtResult.candidateRootNodeId,
      primaryMode: builtResult.integrationRecommendation.primaryMode,
      requiresOperatorAttention: builtResult.integrationRecommendation.requiresOperatorAttention,
      tier1RecoveredExactCutSetCount:
        builtResult.recoveryTier1ExactHardware.recoveredExactCutSetCount,
      unionRecoveredCount:
        builtResult.recoveryTier3UnionSensitivity.unionRecoveredCount,
      referenceCount: builtResult.referenceCutSetCount,
      structuralMatchIgnoringGeneratedAt,
      semanticParityMatch,
      builtSha256: sha256File(path.join(caseOutDir, "built_from_package.json")),
      expectedSha256: sha256File(path.join(caseOutDir, "expected_candidate_artifact.json")),
      semanticBuiltSha256: sha256File(path.join(caseOutDir, "semantic_built.json")),
      semanticExpectedSha256: sha256File(path.join(caseOutDir, "semantic_expected.json"))
    };

    writeJson(path.join(caseOutDir, "comparison_summary.json"), summary);
    results.push(summary);
  }

  const rollup = {
    generatedAt: utcNowIso(),
    scriptVersion: SCRIPT_VERSION,
    distEntry: DIST_ENTRY,
    caseCount: results.length,
    allCasesStructuralMatchIgnoringGeneratedAt: results.every(
      (r) => r.structuralMatchIgnoringGeneratedAt
    ),
    allCasesSemanticParityMatch: results.every((r) => r.semanticParityMatch),
    cases: results
  };

  writeJson(path.join(outDir, "validation_rollup.json"), rollup);

  const txt = [];
  txt.push("OpenPRA Phase 5 package recovery validation on real candidates");
  txt.push("");
  txt.push(`generated_at: ${rollup.generatedAt}`);
  txt.push(`dist_entry: ${DIST_ENTRY}`);
  txt.push(`case_count: ${rollup.caseCount}`);
  txt.push(
    `all_cases_structural_match_ignoring_generated_at: ${rollup.allCasesStructuralMatchIgnoringGeneratedAt}`
  );
  txt.push(`all_cases_semantic_parity_match: ${rollup.allCasesSemanticParityMatch}`);
  txt.push("");
  for (const row of results) {
    txt.push(
      `${row.label}  model=${row.modelId}  primary_mode=${row.primaryMode}  ` +
      `tier1=${row.tier1RecoveredExactCutSetCount}/${row.referenceCount}  ` +
      `union=${row.unionRecoveredCount}/${row.referenceCount}  ` +
      `structural_match=${row.structuralMatchIgnoringGeneratedAt}  ` +
      `semantic_match=${row.semanticParityMatch}`
    );
  }
  txt.push("");
  writeText(path.join(outDir, "validation_rollup.txt"), txt.join("\n"));

  writeManifest(outDir);

  console.log(`OUTDIR=${outDir}`);
  console.log(`ROLLUP_JSON=${path.join(outDir, "validation_rollup.json")}`);
  console.log(`ROLLUP_TXT=${path.join(outDir, "validation_rollup.txt")}`);
  console.log(`MANIFEST=${path.join(outDir, "00_manifest.json")}`);
  console.log(`SHA256=${path.join(outDir, "SHA256SUMS.txt")}`);
}

main();
