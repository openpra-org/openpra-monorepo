#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const BASE_DIR =
  "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/openpra_phase4_clqubo_exports_v1/20260408_221348Z";

const FILES = [
  "30_case3_clqubo_export.json",
  "40_case4_clqubo_export.json",
  "50_case5_clqubo_export.json",
  "60_case6_clqubo_export.json",
];

function main() {
  const repoRoot = process.cwd();
  const qr = loadQuantumReadinessModule(repoRoot);
  const { buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport } = qr;

  for (const fileName of FILES) {
    const fullPath = path.join(BASE_DIR, fileName);
    const payload = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    const bundle = buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(payload, {
      createdBy: "list-synthetic-preparation-artifacts-v1",
    });

    console.log(`=== ${fileName} ===`);
    console.log(`modelId=${payload.modelId}`);
    console.log(`artifactCount=${bundle.preparationArtifacts.length}`);

    bundle.preparationArtifacts.forEach((artifact, index) => {
      const mcsCount = artifact?.clQuboEncoding?.frozenMcsReference?.minimalCutSetCount ?? "NA";
      const beCount = Array.isArray(artifact?.orderedBasicEventIds) ? artifact.orderedBasicEventIds.length : "NA";

      console.log(
        [
          index,
          artifact.artifactId ?? "NA",
          artifact.subtreeId ?? "NA",
          artifact.rootGateId ?? "NA",
          artifact.topologyClass ?? "NA",
          beCount,
          mcsCount,
        ].join("\t"),
      );
    });

    console.log("");
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

main();
