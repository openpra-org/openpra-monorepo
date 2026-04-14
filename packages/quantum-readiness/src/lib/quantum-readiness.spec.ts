import { analyzeFaultTreeReadiness, buildReadinessSummary, extractCandidateSubtrees } from "./quantum-readiness";
import type { NormalizedFaultTree } from "./types";

describe("quantum-readiness", () => {
  it("identifies gate rooted candidates in a simple OR of AND structure", () => {
    const tree: NormalizedFaultTree = {
      id: "ft-simple",
      name: "Simple Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["G1", "C"],
        },
        G1: {
          id: "G1",
          kind: "gate",
          gateType: "and",
          children: ["A", "B"],
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
        C: { id: "C", kind: "basicEvent" },
      },
    };

    const candidates = extractCandidateSubtrees(tree);

    expect(candidates).toHaveLength(2);

    const topCandidate = candidates.find((candidate) => candidate.rootNodeId === "TOP");
    const g1Candidate = candidates.find((candidate) => candidate.rootNodeId === "G1");

    expect(topCandidate).toBeDefined();
    expect(g1Candidate).toBeDefined();

    expect(topCandidate?.basicEventCount).toBe(3);
    expect(topCandidate?.quantumTractable).toBe(true);

    expect(g1Candidate?.basicEventCount).toBe(2);
    expect(g1Candidate?.quantumTractable).toBe(true);
  });

  it("flags unsupported gate types as excluded in version 1", () => {
    const tree: NormalizedFaultTree = {
      id: "ft-not",
      name: "NOT Gate Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "not",
          children: ["A"],
        },
        A: { id: "A", kind: "basicEvent" },
      },
    };

    const report = analyzeFaultTreeReadiness(tree);

    expect(report.summary.totalCandidateSubtrees).toBe(1);
    expect(report.summary.totalQuantumTractableCandidates).toBe(0);
    expect(report.candidates[0]?.unsupportedGateTypesFound).toContain("not");
    expect(report.candidates[0]?.quantumTractable).toBe(false);
  });

  it("builds a readable summary string", () => {
    const tree: NormalizedFaultTree = {
      id: "ft-summary",
      name: "Summary Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["A", "B"],
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
      },
    };

    const report = analyzeFaultTreeReadiness(tree);
    const summary = buildReadinessSummary(report);

    expect(summary).toContain("# Quantum Readiness Summary");
    expect(summary).toContain("Model ID: ft-summary");
    expect(summary).toContain("Quantum Tractable Candidates: 1");
  });

  it("classifies bounded topology class A when enabled", () => {
    const tree: NormalizedFaultTree = {
      id: "ft-topology-a",
      name: "Topology A Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["G1", "G2", "E"],
        },
        G1: {
          id: "G1",
          kind: "gate",
          gateType: "and",
          children: ["A", "B"],
        },
        G2: {
          id: "G2",
          kind: "gate",
          gateType: "and",
          children: ["C", "D"],
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
        C: { id: "C", kind: "basicEvent" },
        D: { id: "D", kind: "basicEvent" },
        E: { id: "E", kind: "basicEvent" },
      },
    };

    const report = analyzeFaultTreeReadiness(tree, {
      includeTopologyClassification: true,
    });

    const topCandidate = report.candidates.find((candidate) => candidate.rootNodeId === "TOP");

    expect(topCandidate?.topologyClassification?.topologyClass).toBe("A");
    expect(topCandidate?.topologyClassification?.classificationRuleVersion).toBe("phase3-bounded-v1");
    expect(topCandidate?.topologyClassification?.rootChildBasicEventCount).toBe(1);
    expect(topCandidate?.topologyClassification?.rootChildAndGateCount).toBe(2);
    expect(report.summary.topologyClassCounts).toEqual({
      A: 1,
      B: 0,
      C: 0,
      D: 0,
      unclassified: 2,
    });
  });

  it("classifies bounded topology class B when enabled", () => {
    const tree: NormalizedFaultTree = {
      id: "ft-topology-b",
      name: "Topology B Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["G1", "G2", "G3"],
        },
        G1: {
          id: "G1",
          kind: "gate",
          gateType: "and",
          children: ["A", "B"],
        },
        G2: {
          id: "G2",
          kind: "gate",
          gateType: "and",
          children: ["C", "D"],
        },
        G3: {
          id: "G3",
          kind: "gate",
          gateType: "and",
          children: ["E", "F"],
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
        C: { id: "C", kind: "basicEvent" },
        D: { id: "D", kind: "basicEvent" },
        E: { id: "E", kind: "basicEvent" },
        F: { id: "F", kind: "basicEvent" },
      },
    };

    const report = analyzeFaultTreeReadiness(tree, {
      includeTopologyClassification: true,
    });

    const topCandidate = report.candidates.find((candidate) => candidate.rootNodeId === "TOP");

    expect(topCandidate?.topologyClassification?.topologyClass).toBe("B");
    expect(topCandidate?.topologyClassification?.rootChildBasicEventCount).toBe(0);
    expect(topCandidate?.topologyClassification?.rootChildAndGateCount).toBe(3);
    expect(topCandidate?.topologyClassification?.rootChildOrGateCount).toBe(0);
  });

  it("classifies bounded topology class C when enabled", () => {
    const tree: NormalizedFaultTree = {
      id: "ft-topology-c",
      name: "Topology C Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["G1", "G2", "G3", "G4"],
        },
        G1: {
          id: "G1",
          kind: "gate",
          gateType: "and",
          children: ["A", "B"],
        },
        G2: {
          id: "G2",
          kind: "gate",
          gateType: "and",
          children: ["C", "D"],
        },
        G3: {
          id: "G3",
          kind: "gate",
          gateType: "and",
          children: ["E", "F"],
        },
        G4: {
          id: "G4",
          kind: "gate",
          gateType: "and",
          children: ["G", "H"],
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
        C: { id: "C", kind: "basicEvent" },
        D: { id: "D", kind: "basicEvent" },
        E: { id: "E", kind: "basicEvent" },
        F: { id: "F", kind: "basicEvent" },
        G: { id: "G", kind: "basicEvent" },
        H: { id: "H", kind: "basicEvent" },
      },
    };

    const report = analyzeFaultTreeReadiness(tree, {
      includeTopologyClassification: true,
    });

    const topCandidate = report.candidates.find((candidate) => candidate.rootNodeId === "TOP");

    expect(topCandidate?.topologyClassification?.topologyClass).toBe("C");
    expect(topCandidate?.topologyClassification?.rootChildAndGateCount).toBe(4);
    expect(topCandidate?.topologyClassification?.rootChildOrGateCount).toBe(0);
  });

  it("classifies bounded topology class D when enabled", () => {
    const tree: NormalizedFaultTree = {
      id: "ft-topology-d",
      name: "Topology D Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["G1", "G2", "G3"],
        },
        G1: {
          id: "G1",
          kind: "gate",
          gateType: "and",
          children: ["A", "B"],
        },
        G2: {
          id: "G2",
          kind: "gate",
          gateType: "and",
          children: ["C", "D"],
        },
        G3: {
          id: "G3",
          kind: "gate",
          gateType: "or",
          children: ["E", "F", "G", "H"],
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
        C: { id: "C", kind: "basicEvent" },
        D: { id: "D", kind: "basicEvent" },
        E: { id: "E", kind: "basicEvent" },
        F: { id: "F", kind: "basicEvent" },
        G: { id: "G", kind: "basicEvent" },
        H: { id: "H", kind: "basicEvent" },
      },
    };

    const report = analyzeFaultTreeReadiness(tree, {
      includeTopologyClassification: true,
    });

    const topCandidate = report.candidates.find((candidate) => candidate.rootNodeId === "TOP");

    expect(topCandidate?.topologyClassification?.topologyClass).toBe("D");
    expect(topCandidate?.topologyClassification?.rootChildAndGateCount).toBe(2);
    expect(topCandidate?.topologyClassification?.rootChildOrGateCount).toBe(1);
  });

  it("marks candidates unclassified when topology classification is enabled but no bounded rule matches", () => {
    const tree: NormalizedFaultTree = {
      id: "ft-topology-unclassified",
      name: "Unclassified Topology Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "and",
          children: ["A", "B"],
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
      },
    };

    const report = analyzeFaultTreeReadiness(tree, {
      includeTopologyClassification: true,
    });

    expect(report.candidates[0]?.topologyClassification?.topologyClass).toBe("unclassified");
    expect(report.summary.topologyClassCounts).toEqual({
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      unclassified: 1,
    });

    const summary = buildReadinessSummary(report);
    expect(summary).toContain("Topology Class Counts:");
    expect(summary).toContain("A=0, B=0, C=0, D=0, unclassified=1");
  });

  it("returns the exact frozen Phase C requirements matrix entry and public hardware screen for Class A n = 5", () => {
    const tree: NormalizedFaultTree = {
      id: "ft-requirements-a5",
      name: "Requirements Matrix A5 Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["G1", "G2", "E"],
        },
        G1: {
          id: "G1",
          kind: "gate",
          gateType: "and",
          children: ["A", "B"],
        },
        G2: {
          id: "G2",
          kind: "gate",
          gateType: "and",
          children: ["C", "D"],
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
        C: { id: "C", kind: "basicEvent" },
        D: { id: "D", kind: "basicEvent" },
        E: { id: "E", kind: "basicEvent" },
      },
    };

    const report = analyzeFaultTreeReadiness(tree, {
      includeRequirementsMatrix: true,
    });

    const topCandidate = report.candidates.find((candidate) => candidate.rootNodeId === "TOP");
    expect(topCandidate?.topologyClassification?.topologyClass).toBe("A");
    expect(topCandidate?.requirementsAssessment?.matrixEntryMatched).toBe(true);
    expect(topCandidate?.requirementsAssessment?.matrixEntry).toEqual({
      topologyClass: "A",
      nBasic: 5,
      requiredQubits: 5,
      estimatedDepthP1: 305,
      estimatedDepthP2: 514,
      thresholdStatus: "favorable",
      evidenceTier: "projected",
    });
    expect(topCandidate?.requirementsAssessment?.preferredDepthP).toBe(1);
    expect(topCandidate?.requirementsAssessment?.avoidRL1).toBe(true);
    expect(topCandidate?.requirementsAssessment?.preferredAlgorithm).toBe("QAOA+");
    expect(topCandidate?.requirementsAssessment?.executionPriority).toBe("high");
    expect(topCandidate?.requirementsAssessment?.hardwareCompatibility).toHaveLength(4);
    for (const row of topCandidate?.requirementsAssessment?.hardwareCompatibility ?? []) {
      expect(row.qubitFit).toBe(true);
    }

    expect(report.summary.requirementsMatrixMatchedCandidateIds).toEqual(["TOP"]);
    expect(report.summary.recommendedExecutionPriorityCandidateIds).toEqual(["TOP"]);

    const summary = buildReadinessSummary(report);
    expect(summary).toContain("Requirements Matrix Matched Candidate Ids: TOP");
    expect(summary).toContain("Recommended Execution Priority Candidate Ids: TOP");
    expect(summary).toContain(
      "Requirements Matrix: class A, n=5, qubits=5, depth p=1=305, depth p=2=514, threshold=favorable, tier=projected",
    );
  });

  it("returns no matrix row but still builds the public hardware screen for an unclassified candidate", () => {
    const tree: NormalizedFaultTree = {
      id: "ft-requirements-unclassified",
      name: "Requirements Matrix Unclassified Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["A", "B"],
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
      },
    };

    const report = analyzeFaultTreeReadiness(tree, {
      includeRequirementsMatrix: true,
    });

    const topCandidate = report.candidates.find((candidate) => candidate.rootNodeId === "TOP");
    expect(topCandidate?.topologyClassification?.topologyClass).toBe("unclassified");
    expect(topCandidate?.requirementsAssessment?.requiredQubits).toBe(2);
    expect(topCandidate?.requirementsAssessment?.matrixEntryMatched).toBe(false);
    expect(topCandidate?.requirementsAssessment?.matrixEntry).toBeUndefined();
    expect(topCandidate?.requirementsAssessment?.executionPriority).toBe("unknown");
    expect(topCandidate?.requirementsAssessment?.hardwareCompatibility).toHaveLength(4);
    for (const row of topCandidate?.requirementsAssessment?.hardwareCompatibility ?? []) {
      expect(row.qubitFit).toBe(true);
    }

    expect(report.summary.requirementsMatrixMatchedCandidateIds).toEqual([]);
    expect(report.summary.recommendedExecutionPriorityCandidateIds).toEqual([]);
  });
});
