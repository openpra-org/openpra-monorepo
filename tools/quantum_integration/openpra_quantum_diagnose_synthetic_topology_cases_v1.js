#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const SCRIPT_VERSION = "openpra-quantum-diagnose-synthetic-topology-cases-v1";

function main() {
  const repoRoot = process.cwd();
  const qr = loadQuantumReadinessModule(repoRoot);
  const { buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport } = qr;

  requireFunction(
    buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport,
    "buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport",
  );

  const baseDir =
    "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/openpra_phase4_clqubo_exports_v1/20260408_221348Z";

  const cases = [
    "30_case3_clqubo_export.json",
    "40_case4_clqubo_export.json",
    "50_case5_clqubo_export.json",
    "60_case6_clqubo_export.json",
  ];

  const outDir =
    "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/openpra_topology_classifier_diagnosis_v1";
  fs.mkdirSync(outDir, { recursive: true });

  const rows = [];

  for (const fileName of cases) {
    const fullPath = path.join(baseDir, fileName);
    const payload = JSON.parse(fs.readFileSync(fullPath, "utf8"));

    let artifact = null;
    let error = null;

    try {
      const bundle = buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(payload, {
        createdBy: SCRIPT_VERSION,
      });
      artifact = bundle.preparationArtifacts?.[0] ?? null;
    } catch (err) {
      error = String(err && err.message ? err.message : err);
    }

    rows.push({
      fileName,
      fullPath,
      sourceModelId: payload.modelId ?? payload.id ?? null,
      payloadTopKeys: Object.keys(payload).sort(),
      artifactProduced: Boolean(artifact),
      artifactId: artifact?.artifactId ?? null,
      modelId: artifact?.modelId ?? null,
      subtreeId: artifact?.subtreeId ?? null,
      rootGateId: artifact?.rootGateId ?? null,
      topologyClass: artifact?.topologyClass ?? null,
      orderedBasicEventCount:
        Array.isArray(artifact?.orderedBasicEventIds) ? artifact.orderedBasicEventIds.length : null,
      frozenMinimalCutSetCount: artifact?.clQuboEncoding?.frozenMcsReference?.minimalCutSetCount ?? null,
      error,
    });
  }

  const summary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion: SCRIPT_VERSION,
    rows,
  };

  const summaryPath = path.join(outDir, "openpra_quantum_diagnose_synthetic_topology_cases_v1.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n", "utf8");

  console.log(summaryPath);
  for (const row of rows) {
    console.log(
      [
        row.fileName,
        row.sourceModelId ?? "NA",
        row.modelId ?? "NA",
        row.rootGateId ?? "NA",
        row.topologyClass ?? "NA",
        row.orderedBasicEventCount ?? "NA",
        row.frozenMinimalCutSetCount ?? "NA",
        row.error ?? "",
      ].join("\t"),
    );
  }
}

function loadQuantumReadinessModule(repoRoot) {
  const candidates = [
    path.join(repoRoot, "dist/packages/quantum-readiness/src/index.js"),
    path.join(repoRoot, "dist/packages/quantum-readiness/index.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  throw new Error("Could not load built quantum-readiness module.");
}

function requireFunction(value, name) {
  if (typeof value !== "function") {
    throw new Error(`Required quantum-readiness export is unavailable: ${name}`);
  }
}

main();
