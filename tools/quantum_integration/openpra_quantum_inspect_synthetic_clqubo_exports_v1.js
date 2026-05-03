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

const OUT_DIR =
  "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/openpra_synthetic_export_inspection_v1";

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const rows = [];

  for (const fileName of FILES) {
    const fullPath = path.join(BASE_DIR, fileName);
    const payload = JSON.parse(fs.readFileSync(fullPath, "utf8"));

    const candidates = Array.isArray(payload.clQuboCandidates) ? payload.clQuboCandidates : [];
    const first = candidates[0] ?? null;

    rows.push({
      fileName,
      fullPath,
      modelId: payload.modelId ?? null,
      modelName: payload.modelName ?? null,
      totalCandidateSubtrees: payload.totalCandidateSubtrees ?? null,
      totalQuantumTractableCandidates: payload.totalQuantumTractableCandidates ?? null,
      candidateCount: candidates.length,
      firstCandidateKeys: first ? Object.keys(first).sort() : [],
      firstCandidateRootGateId: first?.rootGateId ?? first?.subtreeId ?? first?.rootNodeId ?? null,
      firstCandidateTopologyClass: first?.topologyClass ?? first?.topology?.class ?? null,
      firstCandidateOrderedBasicEventCount:
        Array.isArray(first?.orderedBasicEventIds) ? first.orderedBasicEventIds.length
        : Array.isArray(first?.basicEventIds) ? first.basicEventIds.length
        : null,
      firstCandidateFrozenMinimalCutSetCount:
        first?.frozenMcsReference?.minimalCutSetCount ??
        first?.clQuboEncoding?.frozenMcsReference?.minimalCutSetCount ??
        null,
      firstCandidatePreview: first,
    });
  }

  const outPath = path.join(OUT_DIR, "openpra_quantum_inspect_synthetic_clqubo_exports_v1.json");

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAtUtc: new Date().toISOString(),
        rows,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(outPath);
  for (const row of rows) {
    console.log(
      [
        row.fileName,
        row.modelId ?? "NA",
        row.totalCandidateSubtrees ?? "NA",
        row.totalQuantumTractableCandidates ?? "NA",
        row.candidateCount ?? "NA",
        row.firstCandidateRootGateId ?? "NA",
        row.firstCandidateTopologyClass ?? "NA",
        row.firstCandidateOrderedBasicEventCount ?? "NA",
        row.firstCandidateFrozenMinimalCutSetCount ?? "NA",
      ].join("\t"),
    );
  }
}

main();
