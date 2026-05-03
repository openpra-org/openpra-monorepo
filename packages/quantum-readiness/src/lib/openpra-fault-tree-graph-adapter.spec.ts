import type { GraphEdge } from "shared-types/src/lib/types/reactflowGraph/GraphEdge";
import type { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";

import { adaptFaultTreeGraphToNormalizedFaultTree } from "./openpra-fault-tree-graph-adapter";

describe("openpra fault tree graph adapter", () => {
  it("adapts a simple graph into a normalized fault tree", () => {
    const nodes: GraphNode<object>[] = [
      {
        id: "TOP",
        type: "gate",
        position: { x: 0, y: 0 },
        data: { label: "Top Gate", gateType: "or" }
      },
      {
        id: "G1",
        type: "gate",
        position: { x: 0, y: 100 },
        data: { label: "Intermediate Gate", gateType: "and" }
      },
      {
        id: "A",
        type: "basicEvent",
        position: { x: -100, y: 200 },
        data: { label: "Basic Event A" }
      },
      {
        id: "B",
        type: "basicEvent",
        position: { x: 100, y: 200 },
        data: { label: "Basic Event B" }
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

    const normalized = adaptFaultTreeGraphToNormalizedFaultTree(
      {
        faultTreeId: "ft_graph_1",
        modelName: "Graph Adapter Test",
        nodes,
        edges
      },
      {
        getLabel: (node) => ((node.data as { label?: string }).label),
        isGateNode: (node) => node.type === "gate",
        isBasicEventNode: (node) => node.type === "basicEvent",
        getGateType: (node) => (node.data as { gateType?: "and" | "or" }).gateType
      }
    );

    expect(normalized.id).toBe("ft_graph_1");
    expect(normalized.name).toBe("Graph Adapter Test");
    expect(normalized.topNodeId).toBe("TOP");

    expect(normalized.nodes.TOP?.kind).toBe("gate");
    expect(normalized.nodes.TOP?.children).toEqual(["G1"]);

    expect(normalized.nodes.G1?.kind).toBe("gate");
    expect(normalized.nodes.G1?.children).toEqual(["A", "B"]);

    expect(normalized.nodes.A?.kind).toBe("basicEvent");
    expect(normalized.nodes.B?.kind).toBe("basicEvent");
  });

  it("throws when a node cannot be classified", () => {
    const nodes: GraphNode<object>[] = [
      {
        id: "TOP",
        type: "mystery",
        position: { x: 0, y: 0 },
        data: {}
      }
    ];

    const edges: GraphEdge<object>[] = [];

    expect(() =>
      adaptFaultTreeGraphToNormalizedFaultTree(
        {
          faultTreeId: "ft_graph_2",
          nodes,
          edges
        },
        {
          isGateNode: () => false,
          isBasicEventNode: () => false
        }
      )
    ).toThrow("could not be classified");
  });

  it("throws when top node cannot be inferred and is not provided", () => {
    const nodes: GraphNode<object>[] = [
      {
        id: "A",
        type: "gate",
        position: { x: 0, y: 0 },
        data: {}
      },
      {
        id: "B",
        type: "gate",
        position: { x: 100, y: 0 },
        data: {}
      }
    ];

    const edges: GraphEdge<object>[] = [];

    expect(() =>
      adaptFaultTreeGraphToNormalizedFaultTree(
        {
          faultTreeId: "ft_graph_3",
          nodes,
          edges
        },
        {
          isGateNode: () => true,
          isBasicEventNode: () => false,
          getGateType: () => "or"
        }
      )
    ).toThrow("Unable to infer a top node id");
  });
});
