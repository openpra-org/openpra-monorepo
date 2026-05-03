import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  writeOpenpraQuantumExecutionArtifactBundleToFilesystem,
  writeOpenpraQuantumPreparationArtifactBundleToFilesystem,
} from "./openpra-quantum-artifact-filesystem";
import { buildOpenpraQuantumExecutionArtifactBundleFromRawCounts } from "./openpra-quantum-execution-artifacts";
import { buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport } from "./openpra-quantum-preparation-artifacts";
import { buildQuantumPreparationClQuboExport } from "./quantum-preparation";
import { analyzeFaultTreeReadiness } from "./quantum-readiness";
import type { NormalizedFaultTree } from "./types";

describe("openpra-quantum-artifact-filesystem", () => {
  function buildProofTree(): NormalizedFaultTree {
    return {
      id: "prep-artifact-proof",
      name: "Preparation Artifact Proof Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["G1", "E"],
        },
        G1: {
          id: "G1",
          kind: "gate",
          gateType: "and",
          children: ["A", "B"],
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
        E: { id: "E", kind: "basicEvent" },
      },
    };
  }

  it("writes preparation artifact bundle and per-artifact files", () => {
    const tree = buildProofTree();
    const report = analyzeFaultTreeReadiness(tree, {
      includeRequirementsMatrix: true,
    });
    const clQuboExport = buildQuantumPreparationClQuboExport(tree, report);
    const bundle = buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(clQuboExport, {
      createdBy: "jest:test",
    });
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-prep-write-"));

    const result = writeOpenpraQuantumPreparationArtifactBundleToFilesystem(bundle, outputDir);

    expect(fs.existsSync(result.bundlePath)).toBe(true);
    expect(result.artifactPaths.length).toBe(bundle.preparationArtifacts.length);
    expect(result.artifactPaths.every((artifactPath) => fs.existsSync(artifactPath))).toBe(true);
  });

  it("writes execution artifact and provenance manifest files", () => {
    const bundle = buildOpenpraQuantumExecutionArtifactBundleFromRawCounts(
      {
        modelId: "phase2b_row_0001",
        subtreeId: "TOP",
        sourcePreparationArtifactId: "preparation:phase2b_row_0001:TOP:abc",
        providerType: "simulator",
        providerName: "qiskit-aer",
        backendName: "aer_simulator",
        executionMode: "counts_only",
        shots: 100,
        rawCounts: {
          "000": 10,
          "011": 30,
          "100": 60,
        },
      },
      {
        createdBy: "jest:test",
      },
    );

    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-exec-write-"));

    const result = writeOpenpraQuantumExecutionArtifactBundleToFilesystem(bundle, outputDir);

    expect(fs.existsSync(result.executionArtifactPath)).toBe(true);
    expect(fs.existsSync(result.provenanceManifestPath)).toBe(true);
  });
});
