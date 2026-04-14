import type { GraphEdge } from "shared-types/src/lib/types/reactflowGraph/GraphEdge";
import type { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";

import { analyzeLikelyOpenPraFaultTreeGraphReadiness } from "./openpra-fault-tree-readiness";

describe("openpra fault tree readiness facade", () => {
  it("runs end to end from likely OpenPRA graph to readiness outputs", () => {
    const nodes: GraphNode<object>[] = [
      {
        id: "TOP",
        type: "gate",
        position: { x: 0, y: 0 },
        data: {
          label: { name: "Top Gate" },
          gateType: "OR",
          isTop: true,
        },
      },
      {
        id: "G1",
        type: "gate",
        position: { x: 0, y: 100 },
        data: {
          label: { name: "Intermediate Gate" },
          gateType: "AND",
        },
      },
      {
        id: "A",
        type: "basicEvent",
        position: { x: -100, y: 200 },
        data: {
          label: { name: "Basic Event A" },
        },
      },
      {
        id: "B",
        type: "basicEvent",
        position: { x: 100, y: 200 },
        data: {
          label: { name: "Basic Event B" },
        },
      },
    ];

    const edges: GraphEdge<object>[] = [
      {
        id: "e1",
        source: "TOP",
        target: "G1",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e2",
        source: "G1",
        target: "A",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e3",
        source: "G1",
        target: "B",
        type: "default",
        data: {},
        animated: false,
      },
    ];

    const result = analyzeLikelyOpenPraFaultTreeGraphReadiness({
      faultTreeId: "facade_ft_1",
      modelName: "Facade Test Graph",
      nodes,
      edges,
    });

    expect(result.normalizedFaultTree.id).toBe("facade_ft_1");
    expect(result.normalizedFaultTree.topNodeId).toBe("TOP");

    expect(result.report.summary.totalCandidateSubtrees).toBe(2);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(2);

    expect(result.summaryMarkdown).toContain("# Quantum Readiness Summary");
    expect(result.summaryMarkdown).toContain("Model ID: facade_ft_1");
  });

  it("allows analysis options to tighten tractability", () => {
    const nodes: GraphNode<object>[] = [
      {
        id: "TOP",
        type: "gate",
        position: { x: 0, y: 0 },
        data: {
          label: { name: "Top Gate" },
          gateType: "OR",
          isTop: true,
        },
      },
      {
        id: "A",
        type: "basicEvent",
        position: { x: -100, y: 100 },
        data: {
          label: { name: "Basic Event A" },
        },
      },
      {
        id: "B",
        type: "basicEvent",
        position: { x: 0, y: 100 },
        data: {
          label: { name: "Basic Event B" },
        },
      },
      {
        id: "C",
        type: "basicEvent",
        position: { x: 100, y: 100 },
        data: {
          label: { name: "Basic Event C" },
        },
      },
    ];

    const edges: GraphEdge<object>[] = [
      {
        id: "e1",
        source: "TOP",
        target: "A",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e2",
        source: "TOP",
        target: "B",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e3",
        source: "TOP",
        target: "C",
        type: "default",
        data: {},
        animated: false,
      },
    ];

    const result = analyzeLikelyOpenPraFaultTreeGraphReadiness(
      {
        faultTreeId: "facade_ft_2",
        modelName: "Facade Tight Limit Test",
        nodes,
        edges,
      },
      {
        analysis: {
          maxBasicEvents: 2,
        },
      },
    );

    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(0);
    expect(result.report.candidates[0]?.quantumTractable).toBe(false);
  });

  it("surfaces bounded topology classification through the facade when enabled", () => {
    const nodes: GraphNode<object>[] = [
      {
        id: "TOP",
        type: "gate",
        position: { x: 0, y: 0 },
        data: {
          label: { name: "Top Gate" },
          gateType: "OR",
          isTop: true,
        },
      },
      {
        id: "G1",
        type: "gate",
        position: { x: -150, y: 100 },
        data: {
          label: { name: "Gate 1" },
          gateType: "AND",
        },
      },
      {
        id: "G2",
        type: "gate",
        position: { x: 0, y: 100 },
        data: {
          label: { name: "Gate 2" },
          gateType: "AND",
        },
      },
      {
        id: "E",
        type: "basicEvent",
        position: { x: 150, y: 100 },
        data: {
          label: { name: "Basic Event E" },
        },
      },
      {
        id: "A",
        type: "basicEvent",
        position: { x: -200, y: 200 },
        data: {
          label: { name: "Basic Event A" },
        },
      },
      {
        id: "B",
        type: "basicEvent",
        position: { x: -100, y: 200 },
        data: {
          label: { name: "Basic Event B" },
        },
      },
      {
        id: "C",
        type: "basicEvent",
        position: { x: -50, y: 200 },
        data: {
          label: { name: "Basic Event C" },
        },
      },
      {
        id: "D",
        type: "basicEvent",
        position: { x: 50, y: 200 },
        data: {
          label: { name: "Basic Event D" },
        },
      },
    ];

    const edges: GraphEdge<object>[] = [
      {
        id: "e1",
        source: "TOP",
        target: "G1",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e2",
        source: "TOP",
        target: "G2",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e3",
        source: "TOP",
        target: "E",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e4",
        source: "G1",
        target: "A",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e5",
        source: "G1",
        target: "B",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e6",
        source: "G2",
        target: "C",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e7",
        source: "G2",
        target: "D",
        type: "default",
        data: {},
        animated: false,
      },
    ];

    const result = analyzeLikelyOpenPraFaultTreeGraphReadiness(
      {
        faultTreeId: "facade_ft_topology_a",
        modelName: "Facade Topology A Graph",
        nodes,
        edges,
      },
      {
        analysis: {
          includeTopologyClassification: true,
        },
      },
    );

    const topCandidate = result.report.candidates.find((candidate) => candidate.rootNodeId === "TOP");

    expect(result.report.summary.topologyClassCounts).toEqual({
      A: 1,
      B: 0,
      C: 0,
      D: 0,
      unclassified: 2,
    });
    expect(topCandidate?.topologyClassification?.topologyClass).toBe("A");
    expect(result.summaryMarkdown).toContain("Topology Class Counts:");
    expect(result.summaryMarkdown).toContain("A=1, B=0, C=0, D=0, unclassified=2");
  });

  it("surfaces requirements matrix lookup and hardware compatibility through the facade when enabled", () => {
    const nodes: GraphNode<object>[] = [
      {
        id: "TOP",
        type: "gate",
        position: { x: 0, y: 0 },
        data: {
          label: { name: "Top Gate" },
          gateType: "OR",
          isTop: true,
        },
      },
      {
        id: "G1",
        type: "gate",
        position: { x: -150, y: 100 },
        data: {
          label: { name: "Gate 1" },
          gateType: "AND",
        },
      },
      {
        id: "G2",
        type: "gate",
        position: { x: 0, y: 100 },
        data: {
          label: { name: "Gate 2" },
          gateType: "AND",
        },
      },
      {
        id: "E",
        type: "basicEvent",
        position: { x: 150, y: 100 },
        data: {
          label: { name: "Basic Event E" },
        },
      },
      {
        id: "A",
        type: "basicEvent",
        position: { x: -200, y: 200 },
        data: {
          label: { name: "Basic Event A" },
        },
      },
      {
        id: "B",
        type: "basicEvent",
        position: { x: -100, y: 200 },
        data: {
          label: { name: "Basic Event B" },
        },
      },
      {
        id: "C",
        type: "basicEvent",
        position: { x: -50, y: 200 },
        data: {
          label: { name: "Basic Event C" },
        },
      },
      {
        id: "D",
        type: "basicEvent",
        position: { x: 50, y: 200 },
        data: {
          label: { name: "Basic Event D" },
        },
      },
    ];

    const edges: GraphEdge<object>[] = [
      {
        id: "e1",
        source: "TOP",
        target: "G1",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e2",
        source: "TOP",
        target: "G2",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e3",
        source: "TOP",
        target: "E",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e4",
        source: "G1",
        target: "A",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e5",
        source: "G1",
        target: "B",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e6",
        source: "G2",
        target: "C",
        type: "default",
        data: {},
        animated: false,
      },
      {
        id: "e7",
        source: "G2",
        target: "D",
        type: "default",
        data: {},
        animated: false,
      },
    ];

    const result = analyzeLikelyOpenPraFaultTreeGraphReadiness(
      {
        faultTreeId: "facade_ft_requirements_a5",
        modelName: "Facade Requirements A5 Graph",
        nodes,
        edges,
      },
      {
        analysis: {
          includeRequirementsMatrix: true,
        },
      },
    );

    const topCandidate = result.report.candidates.find((candidate) => candidate.rootNodeId === "TOP");

    expect(result.report.summary.requirementsMatrixMatchedCandidateIds).toEqual(["TOP"]);
    expect(result.report.summary.recommendedExecutionPriorityCandidateIds).toEqual(["TOP"]);
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
    expect(topCandidate?.requirementsAssessment?.hardwareCompatibility).toHaveLength(4);
    expect(result.summaryMarkdown).toContain("Requirements Matrix Matched Candidate Ids: TOP");
    expect(result.summaryMarkdown).toContain("Recommended Execution Priority Candidate Ids: TOP");
  });
});
