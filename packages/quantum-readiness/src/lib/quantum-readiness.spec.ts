import {
  analyzeFaultTreeReadiness,
  buildReadinessSummary,
  extractCandidateSubtrees
} from "./quantum-readiness";
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
          children: ["G1", "C"]
        },
        G1: {
          id: "G1",
          kind: "gate",
          gateType: "and",
          children: ["A", "B"]
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
        C: { id: "C", kind: "basicEvent" }
      }
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
          children: ["A"]
        },
        A: { id: "A", kind: "basicEvent" }
      }
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
          children: ["A", "B"]
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" }
      }
    };

    const report = analyzeFaultTreeReadiness(tree);
    const summary = buildReadinessSummary(report);

    expect(summary).toContain("# Quantum Readiness Summary");
    expect(summary).toContain("Model ID: ft-summary");
    expect(summary).toContain("Quantum Tractable Candidates: 1");
  });
});
