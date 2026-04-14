import { auditQuantumRecoveryOrder, buildQuantumRecoveryLadderResult } from "./quantum-recovery";
import type { QuantumRecoveryClassicalReferenceInput, QuantumRecoveryRawCountsInput } from "./quantum-recovery";

describe("quantum-recovery", () => {
  it("returns exact_hardware_recovery when declared-order recovery is complete", () => {
    const rawCounts: QuantumRecoveryRawCountsInput = {
      modelId: "case-exact",
      candidateRootNodeId: "TOP",
      topologyClass: "A",
      basicEventCount: 3,
      requiredQubits: 3,
      orderedBasicEventIds: ["A", "B", "C"],
      bitstringConvention: "declared_order",
      counts: {
        "100": 50,
        "011": 30,
        "000": 20,
      },
      shotsTotal: 100,
    };

    const classicalReference: QuantumRecoveryClassicalReferenceInput = {
      modelId: "case-exact",
      candidateRootNodeId: "TOP",
      frozenMcsReference: {
        minimalCutSetCount: 2,
        basicEventIdSets: [["A"], ["B", "C"]],
        bitstrings: ["100", "011"],
      },
    };

    const result = buildQuantumRecoveryLadderResult(rawCounts, classicalReference);

    expect(result.integrationRecommendation.primaryMode).toBe("exact_hardware_recovery");
    expect(result.integrationRecommendation.requiresOperatorAttention).toBe(false);
    expect(result.recoveryTier1ExactHardware.recoveredExactCutSetCount).toBe(2);
    expect(result.recoveryTier3UnionSensitivity.allRecoveredInUnion).toBe(true);
    expect(result.integrationRecommendation.recommendedBasicEventIdSets).toEqual([["A"], ["B", "C"]]);
  });

  it("returns union_sensitivity_recovery when declared order is incomplete but union is complete", () => {
    const rawCounts: QuantumRecoveryRawCountsInput = {
      modelId: "case-union",
      candidateRootNodeId: "TOP",
      topologyClass: "C",
      basicEventCount: 4,
      requiredQubits: 4,
      orderedBasicEventIds: ["A", "B", "C", "D"],
      bitstringConvention: "declared_order",
      counts: {
        "1000": 40,
        "0000": 60,
      },
      shotsTotal: 100,
    };

    const classicalReference: QuantumRecoveryClassicalReferenceInput = {
      modelId: "case-union",
      candidateRootNodeId: "TOP",
      frozenMcsReference: {
        minimalCutSetCount: 2,
        basicEventIdSets: [["A"], ["D"]],
        bitstrings: ["1000", "0001"],
      },
    };

    const result = buildQuantumRecoveryLadderResult(rawCounts, classicalReference);

    expect(result.recoveryTier1ExactHardware.recoveredExactCutSetCount).toBe(1);
    expect(result.recoveryTier2AlternateOrientation.recoveredExactCutSetCount).toBe(1);
    expect(result.recoveryTier3UnionSensitivity.unionRecoveredCount).toBe(2);
    expect(result.recoveryTier3UnionSensitivity.allRecoveredInUnion).toBe(true);
    expect(result.integrationRecommendation.primaryMode).toBe("union_sensitivity_recovery");
    expect(result.integrationRecommendation.requiresOperatorAttention).toBe(true);
    expect(result.integrationRecommendation.supplementalUnionOnlyBasicEventIdSets).toEqual([["D"]]);
  });

  it("builds near-miss rows in hamming-distance order for missing declared-order cut sets", () => {
    const rawCounts: QuantumRecoveryRawCountsInput = {
      modelId: "case-near-miss",
      candidateRootNodeId: "TOP",
      orderedBasicEventIds: ["A", "B", "C", "D"],
      bitstringConvention: "declared_order",
      counts: {
        "0001": 25,
        "1001": 3,
        "0011": 10,
        "0000": 15,
      },
      shotsTotal: 53,
    };

    const classicalReference: QuantumRecoveryClassicalReferenceInput = {
      modelId: "case-near-miss",
      candidateRootNodeId: "TOP",
      frozenMcsReference: {
        minimalCutSetCount: 1,
        basicEventIdSets: [["A", "D"]],
        bitstrings: ["1001"],
      },
    };

    const declaredOrder = auditQuantumRecoveryOrder(rawCounts, classicalReference, "declared_order");

    expect(declaredOrder.recoveredExactCutSetCount).toBe(1);

    const missingRawCounts: QuantumRecoveryRawCountsInput = {
      ...rawCounts,
      counts: {
        "0001": 25,
        "0011": 10,
        "0000": 15,
      },
      shotsTotal: 50,
    };

    const missingDeclaredOrder = auditQuantumRecoveryOrder(missingRawCounts, classicalReference, "declared_order");

    expect(missingDeclaredOrder.recoveredExactCutSetCount).toBe(0);
    expect(missingDeclaredOrder.missingReferenceBitstrings).toEqual(["1001"]);
    expect(missingDeclaredOrder.nearMissAnalysis["1001"][0]).toMatchObject({
      rawBitstring: "0001",
      interpretedBitstring: "0001",
      hammingDistance: 1,
      relationToMissingReference: "subset",
      basicEventIdSet: ["D"],
    });
  });
});
