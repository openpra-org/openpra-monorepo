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
          isTop: true
        }
      },
      {
        id: "G1",
        type: "gate",
        position: { x: 0, y: 100 },
        data: {
          label: { name: "Intermediate Gate" },
          gateType: "AND"
        }
      },
      {
        id: "A",
        type: "basicEvent",
        position: { x: -100, y: 200 },
        data: {
          label: { name: "Basic Event A" }
        }
      },
      {
        id: "B",
        type: "basicEvent",
        position: { x: 100, y: 200 },
        data: {
          label: { name: "Basic Event B" }
        }
      }
    ];

    const edges: GraphEdge<object>[] = [
      {
        id: "e1",
        source: "TOP",
        target: "G1",
        type: "default",
        data: {},
        animated: false
      },
      {
        id: "e2",
        source: "G1",
        target: "A",
        type: "default",
        data: {},
        animated: false
      },
      {
        id: "e3",
        source: "G1",
        target: "B",
        type: "default",
        data: {},
        animated: false
      }
    ];

    const result = analyzeLikelyOpenPraFaultTreeGraphReadiness({
      faultTreeId: "facade_ft_1",
      modelName: "Facade Test Graph",
      nodes,
      edges
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
          isTop: true
        }
      },
      {
        id: "A",
        type: "basicEvent",
        position: { x: -100, y: 100 },
        data: {
          label: { name: "Basic Event A" }
        }
      },
      {
        id: "B",
        type: "basicEvent",
        position: { x: 0, y: 100 },
        data: {
          label: { name: "Basic Event B" }
        }
      },
      {
        id: "C",
        type: "basicEvent",
        position: { x: 100, y: 100 },
        data: {
          label: { name: "Basic Event C" }
        }
      }
    ];

    const edges: GraphEdge<object>[] = [
      {
        id: "e1",
        source: "TOP",
        target: "A",
        type: "default",
        data: {},
        animated: false
      },
      {
        id: "e2",
        source: "TOP",
        target: "B",
        type: "default",
        data: {},
        animated: false
      },
      {
        id: "e3",
        source: "TOP",
        target: "C",
        type: "default",
        data: {},
        animated: false
      }
    ];

    const result = analyzeLikelyOpenPraFaultTreeGraphReadiness(
      {
        faultTreeId: "facade_ft_2",
        modelName: "Facade Tight Limit Test",
        nodes,
        edges
      },
      {
        analysis: {
          maxBasicEvents: 2
        }
      }
    );

    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(0);
    expect(result.report.candidates[0]?.quantumTractable).toBe(false);
  });
});
