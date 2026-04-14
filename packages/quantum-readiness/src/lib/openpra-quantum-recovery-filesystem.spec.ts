import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildOpenpraQuantumRecoveryBatchRollupFromBatchRoot,
  buildOpenpraQuantumRecoveryFromCandidateDir,
  discoverOpenpraCandidateDirsInBatchRoot,
  loadOpenpraPackageRecoveryResultFromCandidateDir,
  loadOpenpraQuantumRecoveryArtifactBundleFromCandidateDir,
  loadOpenpraQuantumRecoveryBatchArtifactBundleFromBatchRoot,
} from "./openpra-quantum-recovery-filesystem";

describe("openpra-quantum-recovery-filesystem", () => {
  function writeJson(filePath: string, value: unknown): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
  }

  function makeCandidateArtifacts(candidateDir: string): void {
    writeJson(path.join(candidateDir, "package_metadata.json"), {
      model_id: "phase2b_row_test",
      candidate_root_node_id: "G:GTEST",
      topology_class: "A",
      basic_event_count: 3,
      required_qubits: 3,
    });

    writeJson(path.join(candidateDir, "raw_counts.json"), {
      model_id: "phase2b_row_test",
      candidate_root_node_id: "G:GTEST",
      topology_class: "A",
      basic_event_count: 3,
      required_qubits: 3,
      ordered_basic_event_ids: ["A", "B", "C"],
      bitstring_convention: "declared_order",
      counts: {
        "100": 50,
        "011": 30,
        "000": 20,
      },
      shots_total: 100,
    });

    writeJson(path.join(candidateDir, "classical_reference_mcs.json"), {
      model_id: "phase2b_row_test",
      candidate_root_node_id: "G:GTEST",
      frozen_mcs_reference: {
        minimalCutSetCount: 2,
        basicEventIdSets: [["A"], ["B", "C"]],
        bitstrings: ["100", "011"],
      },
    });
  }

  function makePackageRecoveryResult(candidateDir: string): void {
    writeJson(path.join(candidateDir, "openpra_package_recovery_result_v1.json"), {
      generatedAt: "2026-04-12T00:00:00.000Z",
      modelId: "phase2b_row_test",
      candidateRootNodeId: "G:GTEST",
      topologyClass: "A",
      basicEventCount: 3,
      requiredQubits: 3,
      shotsTotal: 100,
      bitstringConventionDeclaredInRawCounts: "declared_order",
      orderedBasicEventIds: ["A", "B", "C"],
      referenceCutSetCount: 2,
      referenceBitstrings: ["100", "011"],
      referenceBasicEventIdSets: [["A"], ["B", "C"]],
      recoveryTier1ExactHardware: {
        orderName: "declared_order",
        shotsTotal: 100,
        exactFraction: 0.8,
        supersetFraction: 0,
        neitherFraction: 0.2,
        recoveredExactCutSetCount: 2,
        exactRefCounts: { "100": 50, "011": 30 },
        recoveredBasicEventIdSets: [["A"], ["B", "C"]],
        exactSupportRows: [],
        missingReferenceBitstrings: [],
        missingReferenceEventSets: [],
        nearMissAnalysis: {},
      },
      recoveryTier2AlternateOrientation: {
        orderName: "reversed_order",
        shotsTotal: 100,
        exactFraction: 0.8,
        supersetFraction: 0,
        neitherFraction: 0.2,
        recoveredExactCutSetCount: 2,
        exactRefCounts: { "100": 50, "011": 30 },
        recoveredBasicEventIdSets: [["A"], ["B", "C"]],
        exactSupportRows: [],
        missingReferenceBitstrings: [],
        missingReferenceEventSets: [],
        nearMissAnalysis: {},
      },
      recoveryTier3UnionSensitivity: {
        unionRecoveredCount: 2,
        referenceCount: 2,
        allRecoveredInUnion: true,
        perReference: [],
        unionMissing: [],
        unionBasicEventIdSets: [["A"], ["B", "C"]],
        unionSupportRows: [],
      },
      recoveryTier4NearMissAdvisory: {},
      integrationRecommendation: {
        primaryMode: "exact_hardware_recovery",
        requiresOperatorAttention: false,
        recommendedBasicEventIdSets: [["A"], ["B", "C"]],
        recommendedSupportRows: [],
        summary: "Declared-order exact recovery is complete.",
      },
      recommendedOpenpraRecoveryLadder: [],
    });
  }

  function makeLegacyValidatedRecoveryResult(candidateDir: string): void {
    writeJson(path.join(candidateDir, "openpra_recovery_ladder_result_v1.json"), {
      legacy: true,
    });
  }

  it("loads candidate artifacts and builds a recovery result from a real directory seam", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qr-fs-"));
    const candidateDir = path.join(tempRoot, "0001_phase2b_row_test");
    fs.mkdirSync(candidateDir, { recursive: true });
    makeCandidateArtifacts(candidateDir);

    const bundle = loadOpenpraQuantumRecoveryArtifactBundleFromCandidateDir(candidateDir);
    expect(bundle.rawCounts.model_id).toBe("phase2b_row_test");

    const result = buildOpenpraQuantumRecoveryFromCandidateDir(candidateDir);
    expect(result.modelId).toBe("phase2b_row_test");
    expect(result.integrationRecommendation.primaryMode).toBe("exact_hardware_recovery");
    expect(result.recoveryTier1ExactHardware.recoveredExactCutSetCount).toBe(2);
  });

  it("discovers candidate dirs in a batch root and loads package recovery results", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qr-batch-"));
    const candidateA = path.join(tempRoot, "0002_phase2b_row_b");
    const candidateB = path.join(tempRoot, "0001_phase2b_row_a");
    const noiseDir = path.join(tempRoot, "misc_notes");
    fs.mkdirSync(candidateA, { recursive: true });
    fs.mkdirSync(candidateB, { recursive: true });
    fs.mkdirSync(noiseDir, { recursive: true });

    makeCandidateArtifacts(candidateA);
    makeCandidateArtifacts(candidateB);
    makePackageRecoveryResult(candidateA);
    makePackageRecoveryResult(candidateB);
    fs.writeFileSync(path.join(noiseDir, "README.txt"), "not a candidate\n", "utf8");

    const discovered = discoverOpenpraCandidateDirsInBatchRoot(tempRoot);
    expect(discovered.map((dir) => path.basename(dir))).toEqual(["0001_phase2b_row_a", "0002_phase2b_row_b"]);

    const loaded = loadOpenpraPackageRecoveryResultFromCandidateDir(candidateA);
    expect(loaded.integrationRecommendation.primaryMode).toBe("exact_hardware_recovery");

    const batchBundle = loadOpenpraQuantumRecoveryBatchArtifactBundleFromBatchRoot(tempRoot);
    expect(batchBundle.cases).toHaveLength(2);
    expect(batchBundle.cases.map((row) => row.label)).toEqual(["0001_phase2b_row_a", "0002_phase2b_row_b"]);
  });

  it("supports executed-case discovery filters", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qr-filter-"));
    const candidateA = path.join(tempRoot, "0001_phase2b_row_a");
    const candidateB = path.join(tempRoot, "0002_phase2b_row_b");
    const candidateC = path.join(tempRoot, "0003_phase2b_row_c");
    fs.mkdirSync(candidateA, { recursive: true });
    fs.mkdirSync(candidateB, { recursive: true });
    fs.mkdirSync(candidateC, { recursive: true });

    makeCandidateArtifacts(candidateA);
    makeCandidateArtifacts(candidateB);
    makeCandidateArtifacts(candidateC);

    makePackageRecoveryResult(candidateA);
    makePackageRecoveryResult(candidateB);
    makeLegacyValidatedRecoveryResult(candidateA);

    expect(
      discoverOpenpraCandidateDirsInBatchRoot(tempRoot, "all_candidate_dirs").map((dir) => path.basename(dir)),
    ).toEqual(["0001_phase2b_row_a", "0002_phase2b_row_b", "0003_phase2b_row_c"]);

    expect(
      discoverOpenpraCandidateDirsInBatchRoot(tempRoot, "package_result_only").map((dir) => path.basename(dir)),
    ).toEqual(["0001_phase2b_row_a", "0002_phase2b_row_b"]);

    expect(
      discoverOpenpraCandidateDirsInBatchRoot(tempRoot, "legacy_validated_only").map((dir) => path.basename(dir)),
    ).toEqual(["0001_phase2b_row_a"]);
  });

  it("builds a batch rollup directly from a batch root", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qr-rollup-"));
    const candidateA = path.join(tempRoot, "0001_phase2b_row_a");
    const candidateB = path.join(tempRoot, "0002_phase2b_row_b");
    fs.mkdirSync(candidateA, { recursive: true });
    fs.mkdirSync(candidateB, { recursive: true });

    makeCandidateArtifacts(candidateA);
    makeCandidateArtifacts(candidateB);
    makePackageRecoveryResult(candidateA);
    makePackageRecoveryResult(candidateB);

    const rollup = buildOpenpraQuantumRecoveryBatchRollupFromBatchRoot(tempRoot, undefined, "package_result_only");
    expect(rollup.caseCount).toBe(2);
    expect(rollup.exactHardwareRecoveryCaseCount).toBe(2);
    expect(rollup.unionSensitivityRecoveryCaseCount).toBe(0);
    expect(rollup.operatorAttentionRequiredCaseCount).toBe(0);
  });
});
