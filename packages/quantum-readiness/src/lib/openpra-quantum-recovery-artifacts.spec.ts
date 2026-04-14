import {
  buildOpenpraQuantumRecoveryFromArtifacts,
  normalizeOpenpraQuantumRecoveryArtifacts,
} from "./openpra-quantum-recovery-artifacts";
import type { OpenpraQuantumRecoveryArtifactBundle } from "./openpra-quantum-recovery-artifacts";

describe("openpra-quantum-recovery-artifacts", () => {
  it("builds an exact recovery result from aligned candidate artifacts", () => {
    const bundle: OpenpraQuantumRecoveryArtifactBundle = {
      packageMetadata: {
        modelId: "case-exact",
        candidateRootNodeId: "TOP",
        topologyClass: "A",
        basicEventCount: 3,
        requiredQubits: 3,
      },
      rawCounts: {
        modelId: "case-exact",
        candidateRootNodeId: "TOP",
        orderedBasicEventIds: ["A", "B", "C"],
        bitstringConvention: "declared_order",
        counts: {
          "100": 50,
          "011": 30,
          "000": 20,
        },
        shotsTotal: 100,
      },
      classicalReferenceMcs: {
        modelId: "case-exact",
        candidateRootNodeId: "TOP",
        frozenMcsReference: {
          minimalCutSetCount: 2,
          basicEventIdSets: [["A"], ["B", "C"]],
          bitstrings: ["100", "011"],
        },
      },
    };

    const result = buildOpenpraQuantumRecoveryFromArtifacts(bundle);

    expect(result.modelId).toBe("case-exact");
    expect(result.candidateRootNodeId).toBe("TOP");
    expect(result.topologyClass).toBe("A");
    expect(result.requiredQubits).toBe(3);
    expect(result.integrationRecommendation.primaryMode).toBe("exact_hardware_recovery");
    expect(result.integrationRecommendation.requiresOperatorAttention).toBe(false);
    expect(result.recoveryTier1ExactHardware.recoveredExactCutSetCount).toBe(2);
  });

  it("uses package metadata as fallback for optional recovery fields", () => {
    const bundle: OpenpraQuantumRecoveryArtifactBundle = {
      packageMetadata: {
        modelId: "case-fallback",
        candidateRootNodeId: "TOP",
        topologyClass: "C",
        basicEventCount: 4,
        requiredQubits: 4,
      },
      rawCounts: {
        modelId: "case-fallback",
        candidateRootNodeId: "TOP",
        orderedBasicEventIds: ["A", "B", "C", "D"],
        bitstringConvention: "declared_order",
        counts: {
          "1000": 40,
          "0000": 60,
        },
        shotsTotal: 100,
      },
      classicalReferenceMcs: {
        modelId: "case-fallback",
        candidateRootNodeId: "TOP",
        frozenMcsReference: {
          minimalCutSetCount: 2,
          basicEventIdSets: [["A"], ["D"]],
          bitstrings: ["1000", "0001"],
        },
      },
    };

    const normalized = normalizeOpenpraQuantumRecoveryArtifacts(bundle);

    expect(normalized.rawCountsInput.topologyClass).toBe("C");
    expect(normalized.rawCountsInput.basicEventCount).toBe(4);
    expect(normalized.rawCountsInput.requiredQubits).toBe(4);
  });

  it("throws when artifact identities do not match", () => {
    const bundle: OpenpraQuantumRecoveryArtifactBundle = {
      rawCounts: {
        modelId: "case-one",
        candidateRootNodeId: "TOP-1",
        orderedBasicEventIds: ["A"],
        bitstringConvention: "declared_order",
        counts: {
          "1": 1,
        },
        shotsTotal: 1,
      },
      classicalReferenceMcs: {
        modelId: "case-two",
        candidateRootNodeId: "TOP-2",
        frozenMcsReference: {
          minimalCutSetCount: 1,
          basicEventIdSets: [["A"]],
          bitstrings: ["1"],
        },
      },
    };

    expect(() => buildOpenpraQuantumRecoveryFromArtifacts(bundle)).toThrow(
      /Artifact modelId mismatch|Artifact candidateRootNodeId mismatch/,
    );
  });
});
