import { buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport } from "./openpra-quantum-preparation-artifacts";
import { buildOpenpraQuantumExecutionInputFromPreparationArtifactWithLocalSimulator } from "./openpra-quantum-simulator-provider";
import { buildQuantumPreparationClQuboExport } from "./quantum-preparation";
import { analyzeFaultTreeReadiness } from "./quantum-readiness";
import type { NormalizedFaultTree } from "./types";

describe("openpra-quantum-simulator-provider", () => {
  function buildProofTree(): NormalizedFaultTree {
    return {
      id: "sim-provider-proof",
      name: "Simulator Provider Proof Tree",
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

  function buildTopPreparationArtifact() {
    const tree = buildProofTree();
    const report = analyzeFaultTreeReadiness(tree, {
      includeRequirementsMatrix: true,
    });
    const clQuboExport = buildQuantumPreparationClQuboExport(tree, report);
    const bundle = buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(clQuboExport, {
      createdBy: "jest:test",
    });

    const artifact = bundle.preparationArtifacts.find((row) => row.rootGateId === "TOP");

    if (!artifact) {
      throw new Error("Expected TOP preparation artifact.");
    }

    return artifact;
  }

  it("builds deterministic synthetic exact MCS counts from a preparation artifact", () => {
    const preparationArtifact = buildTopPreparationArtifact();

    const result = buildOpenpraQuantumExecutionInputFromPreparationArtifactWithLocalSimulator({
      preparationArtifact,
      shots: 7,
      samplingMode: "synthetic_exact_mcs",
    });

    expect(result.executionInput.providerType).toBe("simulator");
    expect(result.executionInput.sourcePreparationArtifactId).toBe(preparationArtifact.artifactId);
    expect(result.executionInput.rawCounts).toEqual({
      "001": 4,
      "110": 3,
    });
    expect(result.simulatorMetadata.parameterSource).toBe("artifact_default");
    expect(result.simulatorMetadata.beta).toBe(0.2);
    expect(result.simulatorMetadata.gamma).toBe(0.2);
  });

  it("uses feasible basis support when synthetic feasible uniform sampling is requested", () => {
    const preparationArtifact = buildTopPreparationArtifact();

    const result = buildOpenpraQuantumExecutionInputFromPreparationArtifactWithLocalSimulator({
      preparationArtifact,
      shots: 5,
      samplingMode: "synthetic_feasible_uniform",
    });

    expect(Object.values(result.executionInput.rawCounts).reduce((sum, value) => sum + value, 0)).toBe(5);
    expect(Object.keys(result.executionInput.rawCounts).sort()).toEqual(["001", "011", "101", "110", "111"]);
    expect(result.simulatorMetadata.supportCount).toBe(5);
  });

  it("requires explicit beta and gamma when parameter provenance is labeled explicit", () => {
    const preparationArtifact = buildTopPreparationArtifact();

    expect(() =>
      buildOpenpraQuantumExecutionInputFromPreparationArtifactWithLocalSimulator({
        preparationArtifact,
        shots: 4,
        samplingMode: "synthetic_exact_mcs",
        parameterSource: "explicit",
      }),
    ).toThrow("requires explicit numeric beta and gamma values");
  });
});
