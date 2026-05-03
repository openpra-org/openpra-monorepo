import { adaptFaultTreeGraphInput } from "./openPraFaultTreeGraph.adapter";

describe("openPraFaultTreeGraph adapter", () => {
  it("passes through shared fault tree graph input unchanged", () => {
    const input = {
      faultTreeId: "shared_ft_1",
      nodes: [
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
          position: { x: 0, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          animated: false,
          data: { label: "" },
        },
      ],
    };

    const result = adaptFaultTreeGraphInput(input);

    expect(result.faultTreeId).toBe("shared_ft_1");
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.nodes[0].id).toBe("TOP");
  });

  it("returns fallback empty graph when input is unsupported", () => {
    const result = adaptFaultTreeGraphInput({ hello: "world" }, "fallback_ft");

    expect(result.faultTreeId).toBe("fallback_ft");
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("converts normalized graph with explicit topNodeId", () => {
    const input = {
      id: "normalized_ft_explicit",
      topNodeId: "TOP",
      nodes: {
        TOP: {
          id: "TOP",
          label: "Top Gate",
          kind: "gate",
          gateType: "OR",
          children: ["A", "B"],
        },
        A: {
          id: "A",
          label: "Basic Event A",
          kind: "basicEvent",
        },
        B: {
          id: "B",
          label: "Basic Event B",
          kind: "basicEvent",
        },
      },
    };

    const result = adaptFaultTreeGraphInput(input);

    expect(result.faultTreeId).toBe("normalized_ft_explicit");
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);

    const topNode = result.nodes.find((n) => n.id === "TOP");
    expect(topNode?.data?.isTop).toBe(true);
    expect(topNode?.data?.gateType).toBe("or");
  });

  it("infers top node from metadata markers when topNodeId is missing", () => {
    const input = {
      id: "normalized_ft_metadata",
      nodes: {
        TOP: {
          id: "TOP",
          label: { name: "Top Gate" },
          kind: "gate",
          gateType: "OR",
          children: ["A"],
          metadata: {
            sourceNodeData: {
              isTopEvent: true,
            },
          },
        },
        A: {
          id: "A",
          label: "Basic Event A",
          kind: "basicEvent",
        },
      },
    };

    const result = adaptFaultTreeGraphInput(input);

    const topNode = result.nodes.find((n) => n.id === "TOP");
    expect(result.faultTreeId).toBe("normalized_ft_metadata");
    expect(topNode?.data?.isTop).toBe(true);
    expect(result.edges).toHaveLength(1);
  });

  it("infers top node from unique root gate when markers are missing", () => {
    const input = {
      id: "normalized_ft_structural",
      nodes: {
        TOP: {
          id: "TOP",
          label: "Root Gate",
          kind: "gate",
          gateType: "AND",
          children: ["G1", "A"],
        },
        G1: {
          id: "G1",
          label: "Intermediate Gate",
          kind: "gate",
          gateType: "OR",
          children: ["B", "C"],
        },
        A: {
          id: "A",
          label: "Basic Event A",
          kind: "basicEvent",
        },
        B: {
          id: "B",
          label: "Basic Event B",
          kind: "basicEvent",
        },
        C: {
          id: "C",
          label: "Basic Event C",
          kind: "basicEvent",
        },
      },
    };

    const result = adaptFaultTreeGraphInput(input);

    const topNode = result.nodes.find((n) => n.id === "TOP");
    expect(topNode?.data?.isTop).toBe(true);
    expect(result.edges).toHaveLength(4);
  });

  it("infers top node from label fallback when root detection is ambiguous", () => {
    const input = {
      id: "normalized_ft_label",
      nodes: {
        TOP: {
          id: "TOP",
          label: "Top Gate",
          kind: "gate",
          gateType: "OR",
          children: [{ id: "A" }],
        },
        ALT: {
          id: "ALT",
          label: "Aux Gate",
          kind: "gate",
          gateType: "AND",
          children: [{ id: "B" }],
        },
        A: {
          id: "A",
          label: "Basic Event A",
          kind: "basicEvent",
        },
        B: {
          id: "B",
          label: "Basic Event B",
          kind: "basicEvent",
        },
      },
    };

    const result = adaptFaultTreeGraphInput(input);

    const topNode = result.nodes.find((n) => n.id === "TOP");
    const altNode = result.nodes.find((n) => n.id === "ALT");

    expect(topNode?.data?.isTop).toBe(true);
    expect(altNode?.data?.isTop).toBe(false);
    expect(result.edges).toHaveLength(2);
  });

  it("uses fallback faultTreeId when normalized input has no id", () => {
    const input = {
      nodes: {
        TOP: {
          id: "TOP",
          label: "Top Gate",
          kind: "gate",
          gateType: "OR",
          children: [],
        },
      },
    };

    const result = adaptFaultTreeGraphInput(input, "fallback_from_callsite");

    expect(result.faultTreeId).toBe("fallback_from_callsite");
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });
});
