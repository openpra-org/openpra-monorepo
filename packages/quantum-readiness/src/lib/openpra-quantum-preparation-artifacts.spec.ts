import { buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport } from "./openpra-quantum-preparation-artifacts";
import { buildQuantumPreparationClQuboExport } from "./quantum-preparation";
import { analyzeFaultTreeReadiness } from "./quantum-readiness";
import type { NormalizedFaultTree } from "./types";

describe("openpra-quantum-preparation-artifacts", () => {
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

  it("wraps CL-QUBO preparation export into artifact-contract-shaped preparation artifacts", () => {
    const tree = buildProofTree();
    const report = analyzeFaultTreeReadiness(tree, {
      includeRequirementsMatrix: true,
    });
    const clQuboExport = buildQuantumPreparationClQuboExport(tree, report);

    const bundle = buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(clQuboExport, {
      createdBy: "jest:test",
    });

    expect(bundle.schemaVersion).toBe("1.0.0");
    expect(bundle.artifactType).toBe("preparation_bundle");
    expect(bundle.modelId).toBe("prep-artifact-proof");
    expect(bundle.totalQuantumTractableCandidates).toBe(2);
    expect(bundle.preparationArtifacts.map((row) => row.rootGateId)).toEqual(["G1", "TOP"]);

    const top = bundle.preparationArtifacts.find((row) => row.rootGateId === "TOP");
    expect(top).toBeDefined();
    expect(top?.artifactType).toBe("preparation");
    expect(top?.subtreeId).toBe("TOP");
    expect(top?.clQuboEncoding.exportSliceVersion).toBe("phase4-bounded-clqubo-v1");
    expect(top?.orderedBasicEventIds).toEqual(["A", "B", "E"]);
    expect(top?.statevectorVerificationResult.eligible).toBe(true);
    expect(top?.backendEligibility.length).toBeGreaterThanOrEqual(0);
  });
});
