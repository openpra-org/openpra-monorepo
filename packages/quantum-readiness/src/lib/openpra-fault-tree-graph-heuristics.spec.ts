import type { GraphEdge } from "shared-types/src/lib/types/reactflowGraph/GraphEdge";
import type { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";

import {
  adaptLikelyOpenPraFaultTreeGraphToNormalizedFaultTree,
  getLikelyOpenPraGateType,
  getLikelyOpenPraNodeLabel,
  getLikelyOpenPraTopNodeId,
  isLikelyOpenPraBasicEventNode,
  isLikelyOpenPraGateNode
} from "./openpra-fault-tree-graph-heuristics";

describe("openpra fault tree graph heuristics", () => {
  it("extracts a likely label from nested label.name", () => {
    const node: GraphNode<object> = {
      id: "N1",
      type: "gate",
      position: { x: 0, y: 0 },
      data: {
        label: {
          name: "Top Gate"
        }
      }
    };

    expect(getLikelyOpenPraNodeLabel(node)).toBe("Top Gate");
  });

  it("recognizes gate type from node data", () => {
    const node: GraphNode<object> = {
      id: "N1",
      type: "unknown",
      position: { x: 0, y: 0 },
      data: {
        gateType: "OR"
      }
    };

    expect(getLikelyOpenPraGateType(node)).toBe("or");
    expect(isLikelyOpenPraGateNode(node)).toBe(true);
  });

  it("recognizes a likely basic event node", () => {
    const node: GraphNode<object> = {
      id: "BE1",
      type: "basicEvent",
      position: { x: 0, y: 0 },
      data: {
        label: "Pump Fail"
      }
    };

    expect(isLikelyOpenPraBasicEventNode(node)).toBe(true);
    expect(isLikelyOpenPraGateNode(node)).toBe(false);
  });

  it("recognizes an explicit top node marker", () => {
    const nodes: GraphNode<object>[] = [
      {
        id: "TOP",
        type: "gate",
        position: { x: 0, y: 0 },
        data: {
          isTop: true
        }
      },
      {
        id: "A",
        type: "basicEvent",
        position: { x: 0, y: 100 },
        data: {}
      }
    ];

    expect(getLikelyOpenPraTopNodeId(nodes)).toBe("TOP");
  });

  it("adapts a likely OpenPRA graph using default heuristics", () => {
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
        position: { x: -50, y: 100 },
        data: {
          label: { name: "Basic Event A" }
        }
      },
      {
        id: "B",
        type: "basicEvent",
        position: { x: 50, y: 100 },
        data: {
          label: { name: "Basic Event B" }
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
      }
    ];

    const normalized = adaptLikelyOpenPraFaultTreeGraphToNormalizedFaultTree({
      faultTreeId: "heuristic_ft_1",
      modelName: "Heuristic Graph",
      nodes,
      edges
    });

    expect(normalized.id).toBe("heuristic_ft_1");
    expect(normalized.topNodeId).toBe("TOP");
    expect(normalized.nodes.TOP?.kind).toBe("gate");
    expect(normalized.nodes.TOP?.gateType).toBe("or");
    expect(normalized.nodes.TOP?.children).toEqual(["A", "B"]);
    expect(normalized.nodes.A?.kind).toBe("basicEvent");
    expect(normalized.nodes.B?.kind).toBe("basicEvent");
  });
});
