import { GraphModelService } from "./graphModel.service";

class MockFaultTreeGraphModel {
  static findOne = jest.fn();
  static lastInstance: MockFaultTreeGraphModel | null = null;

  id?: string;
  _id?: unknown;
  faultTreeId?: string;
  nodes: any[];
  edges: any[];
  save: jest.Mock;

  constructor(body: any) {
    Object.assign(this, body);
    this.nodes = body?.nodes ?? [];
    this.edges = body?.edges ?? [];
    this.save = jest.fn().mockResolvedValue(this);
    MockFaultTreeGraphModel.lastInstance = this;
  }
}

describe("GraphModelService normalized OpenPRA persistence", () => {
  let service: GraphModelService;

  const normalizedCase1 = {
    id: "openpra_graph_case_1",
    topNodeId: "TOP",
    nodes: {
      TOP: {
        id: "TOP",
        label: "Top Gate",
        kind: "gate",
        gateType: "OR",
        children: ["C", "G1"],
        metadata: {
          sourceNodeType: "gate",
          sourceNodeData: {
            label: { name: "Top Gate" },
            gateType: "OR",
            isTop: true,
          },
        },
      },
      G1: {
        id: "G1",
        label: "Intermediate Gate",
        kind: "gate",
        gateType: "AND",
        children: ["A", "B"],
        metadata: {
          sourceNodeType: "gate",
          sourceNodeData: {
            label: { name: "Intermediate Gate" },
            gateType: "AND",
          },
        },
      },
      A: {
        id: "A",
        label: "Basic Event A",
        kind: "basicEvent",
        metadata: {
          sourceNodeType: "basicEvent",
          sourceNodeData: {
            label: { name: "Basic Event A" },
          },
        },
      },
      B: {
        id: "B",
        label: "Basic Event B",
        kind: "basicEvent",
        metadata: {
          sourceNodeType: "basicEvent",
          sourceNodeData: {
            label: { name: "Basic Event B" },
          },
        },
      },
      C: {
        id: "C",
        label: "Basic Event C",
        kind: "basicEvent",
        metadata: {
          sourceNodeType: "basicEvent",
          sourceNodeData: {
            label: { name: "Basic Event C" },
          },
        },
      },
    },
  };

  const normalizedCase2 = {
    id: "openpra_graph_case_2",
    topNodeId: "TOP",
    nodes: {
      TOP: {
        id: "TOP",
        label: "Top Gate",
        kind: "gate",
        gateType: "NOT",
        children: ["A"],
        metadata: {
          sourceNodeType: "gate",
          sourceNodeData: {
            label: { name: "Top Gate" },
            gateType: "NOT",
            isTopEvent: true,
          },
        },
      },
      A: {
        id: "A",
        label: "Basic Event A",
        kind: "basicEvent",
        metadata: {
          sourceNodeType: "basicEvent",
          sourceNodeData: {
            label: { name: "Basic Event A" },
          },
        },
      },
    },
  };

  beforeEach(() => {
    MockFaultTreeGraphModel.findOne.mockReset();
    MockFaultTreeGraphModel.lastInstance = null;

    service = new GraphModelService({} as never, MockFaultTreeGraphModel as never, {} as never);
  });

  it("converts normalized OpenPRA input when updating an existing stored fault tree graph", async () => {
    const existingGraph = {
      faultTreeId: "openpra_graph_case_1",
      nodes: [],
      edges: [],
      save: jest.fn().mockResolvedValue(true),
    };

    MockFaultTreeGraphModel.findOne.mockResolvedValue(existingGraph);

    const result = await service.saveFaultTreeGraph(normalizedCase1 as never);

    expect(result).toBe(true);
    expect(MockFaultTreeGraphModel.findOne).toHaveBeenCalledWith({
      faultTreeId: "openpra_graph_case_1",
    });
    expect(existingGraph.save).toHaveBeenCalled();

    expect(existingGraph.nodes).toHaveLength(5);
    expect(existingGraph.edges).toHaveLength(4);

    const topNode = existingGraph.nodes.find((n: any) => n.id === "TOP");
    const g1Node = existingGraph.nodes.find((n: any) => n.id === "G1");

    expect(topNode.data.gateType).toBe("or");
    expect(topNode.data.isTop).toBe(true);
    expect(g1Node.data.gateType).toBe("and");
  });

  it("converts normalized OpenPRA input when creating a new stored fault tree graph", async () => {
    MockFaultTreeGraphModel.findOne.mockResolvedValue(null);

    const result = await service.saveFaultTreeGraph(normalizedCase2 as never);

    expect(result).toBe(true);
    expect(MockFaultTreeGraphModel.findOne).toHaveBeenCalledWith({
      faultTreeId: "openpra_graph_case_2",
    });

    const created = MockFaultTreeGraphModel.lastInstance;
    expect(created).not.toBeNull();
    expect(created?.save).toHaveBeenCalled();

    expect(created?.faultTreeId).toBe("openpra_graph_case_2");
    expect(created?.nodes).toHaveLength(2);
    expect(created?.edges).toHaveLength(1);

    const topNode = created?.nodes.find((n: any) => n.id === "TOP");
    expect(topNode.data.gateType).toBe("not");
    expect(topNode.data.isTop).toBe(true);
  });
});
