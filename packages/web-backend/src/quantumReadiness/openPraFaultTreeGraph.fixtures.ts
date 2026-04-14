export const openPraNormalizedCase1 = {
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

export const openPraNormalizedCase2UnsupportedNot = {
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

export const openPraNormalizedCase1NoTopNodeIdMetadata = {
  id: "openpra_graph_case_1_no_top_id_metadata",
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
          isTopEvent: true,
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

export const openPraNormalizedCase1NoTopNodeIdStructural = {
  id: "openpra_graph_case_1_no_top_id_structural",
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

export function cloneOpenPraFixture<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
