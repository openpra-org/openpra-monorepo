import { buildOpenpraQuantumRecoveryBatchRollup } from "./openpra-quantum-recovery-rollup";
import type { QuantumRecoveryLadderResult } from "./quantum-recovery";

function makeResult(
  modelId: string,
  candidateRootNodeId: string,
  topologyClass: string,
  basicEventCount: number,
  requiredQubits: number,
  primaryMode: "exact_hardware_recovery" | "union_sensitivity_recovery",
  requiresOperatorAttention: boolean,
  referenceCutSetCount: number,
  tier1RecoveredExactCutSetCount: number,
  unionRecoveredCount: number,
): QuantumRecoveryLadderResult {
  return {
    generatedAt: "2026-04-12T00:00:00.000Z",
    modelId,
    candidateRootNodeId,
    topologyClass,
    basicEventCount,
    requiredQubits,
    shotsTotal: 8192,
    bitstringConventionDeclaredInRawCounts: "declared_order",
    orderedBasicEventIds: [],
    referenceCutSetCount,
    referenceBitstrings: [],
    referenceBasicEventIdSets: [],
    recoveryTier1ExactHardware: {
      orderName: "declared_order",
      shotsTotal: 8192,
      exactFraction: 0,
      supersetFraction: 0,
      neitherFraction: 0,
      recoveredExactCutSetCount: tier1RecoveredExactCutSetCount,
      exactRefCounts: {},
      recoveredBasicEventIdSets: [],
      exactSupportRows: [],
      missingReferenceBitstrings: [],
      missingReferenceEventSets: [],
      nearMissAnalysis: {},
    },
    recoveryTier2AlternateOrientation: {
      orderName: "reversed_order",
      shotsTotal: 8192,
      exactFraction: 0,
      supersetFraction: 0,
      neitherFraction: 0,
      recoveredExactCutSetCount: tier1RecoveredExactCutSetCount,
      exactRefCounts: {},
      recoveredBasicEventIdSets: [],
      exactSupportRows: [],
      missingReferenceBitstrings: [],
      missingReferenceEventSets: [],
      nearMissAnalysis: {},
    },
    recoveryTier3UnionSensitivity: {
      unionRecoveredCount,
      referenceCount: referenceCutSetCount,
      allRecoveredInUnion: unionRecoveredCount === referenceCutSetCount,
      perReference: [],
      unionMissing: [],
      unionBasicEventIdSets: [],
      unionSupportRows: [],
    },
    recoveryTier4NearMissAdvisory: {},
    integrationRecommendation: {
      primaryMode,
      requiresOperatorAttention,
      recommendedBasicEventIdSets: [],
      recommendedSupportRows: [],
      ...(primaryMode === "union_sensitivity_recovery" ?
        {
          supplementalUnionOnlyBasicEventIdSets: [["X", "Y"]],
        }
      : {}),
      summary: "test",
    },
    recommendedOpenpraRecoveryLadder: [],
  };
}

describe("openpra-quantum-recovery-rollup", () => {
  it("builds deterministic batch counts from package recovery results", () => {
    const rollup = buildOpenpraQuantumRecoveryBatchRollup("/tmp/batch", [
      {
        label: "0905",
        candidateDir: "/tmp/0905",
        resultPath: "/tmp/0905/openpra_package_recovery_result_v1.json",
        resultSha256: "sha0905",
        result: makeResult("phase2b_row_0905", "G:G939", "C", 8, 8, "union_sensitivity_recovery", true, 4, 3, 4),
      },
      {
        label: "1037",
        candidateDir: "/tmp/1037",
        resultPath: "/tmp/1037/openpra_package_recovery_result_v1.json",
        resultSha256: "sha1037",
        result: makeResult("phase2b_row_1037", "G:G348", "A", 5, 5, "exact_hardware_recovery", false, 3, 3, 3),
      },
      {
        label: "0698",
        candidateDir: "/tmp/0698",
        resultPath: "/tmp/0698/openpra_package_recovery_result_v1.json",
        resultSha256: "sha0698",
        result: makeResult("phase2b_row_0698", "G:G348", "A", 5, 5, "exact_hardware_recovery", false, 3, 3, 3),
      },
    ]);

    expect(rollup.batchRoot).toBe("/tmp/batch");
    expect(rollup.caseCount).toBe(3);
    expect(rollup.exactHardwareRecoveryCaseCount).toBe(2);
    expect(rollup.unionSensitivityRecoveryCaseCount).toBe(1);
    expect(rollup.operatorAttentionRequiredCaseCount).toBe(1);
    expect(rollup.cases.map((row) => row.label)).toEqual(["0698", "0905", "1037"]);
  });

  it("normalizes missing optional fields to null", () => {
    const rollup = buildOpenpraQuantumRecoveryBatchRollup("/tmp/batch", [
      {
        label: "x",
        result: makeResult("m", "r", "", Number.NaN, Number.NaN, "exact_hardware_recovery", false, 1, 1, 1),
      },
    ]);

    expect(rollup.cases[0]?.topologyClass).toBeNull();
    expect(rollup.cases[0]?.basicEventCount).toBeNull();
    expect(rollup.cases[0]?.requiredQubits).toBeNull();
  });
});
