import {
  buildOpenpraQuantumRecoveryBatchRollupFromArtifacts,
  normalizeOpenpraQuantumRecoveryBatchArtifacts,
} from "./openpra-quantum-recovery-batch-artifacts";
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
      summary: "test",
    },
    recommendedOpenpraRecoveryLadder: [],
  };
}

describe("openpra-quantum-recovery-batch-artifacts", () => {
  it("normalizes batch artifact bundles into rollup case inputs", () => {
    const normalized = normalizeOpenpraQuantumRecoveryBatchArtifacts({
      batchRoot: "/tmp/batch",
      cases: [
        {
          label: "1037",
          candidateDir: "/tmp/1037",
          resultPath: "/tmp/1037/openpra_package_recovery_result_v1.json",
          resultSha256: "sha1037",
          result: makeResult("phase2b_row_1037", "G:G348", "A", 5, 5, "exact_hardware_recovery", false, 3, 3, 3),
        },
      ],
    });

    expect(normalized.batchRoot).toBe("/tmp/batch");
    expect(normalized.caseInputs).toHaveLength(1);
    expect(normalized.caseInputs[0]?.label).toBe("1037");
    expect(normalized.caseInputs[0]?.candidateDir).toBe("/tmp/1037");
  });

  it("builds a batch rollup from already-materialized package recovery results", () => {
    const rollup = buildOpenpraQuantumRecoveryBatchRollupFromArtifacts({
      batchRoot: "/tmp/batch",
      cases: [
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
      ],
    });

    expect(rollup.batchRoot).toBe("/tmp/batch");
    expect(rollup.caseCount).toBe(2);
    expect(rollup.exactHardwareRecoveryCaseCount).toBe(1);
    expect(rollup.unionSensitivityRecoveryCaseCount).toBe(1);
    expect(rollup.operatorAttentionRequiredCaseCount).toBe(1);
    expect(rollup.cases.map((row) => row.label)).toEqual(["0905", "1037"]);
  });

  it("throws when a batch artifact case is missing required recovery structure", () => {
    expect(() =>
      normalizeOpenpraQuantumRecoveryBatchArtifacts({
        batchRoot: "/tmp/batch",
        cases: [
          {
            label: "bad",
            result: {} as QuantumRecoveryLadderResult,
          },
        ],
      }),
    ).toThrow(
      /modelId|candidateRootNodeId|integrationRecommendation|recoveryTier1ExactHardware|recoveryTier3UnionSensitivity/,
    );
  });
});
