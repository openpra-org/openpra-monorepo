import { FaultTreeNodeType, type FaultTreeNode } from "mef-types/lib/systems-analysis/systems-analysis";
import { mefToReactFlow, reactFlowToMEF } from "./faultTreeMEFSerializer";
const basicEvent = (uuid: string, p = 0.01): FaultTreeNode => ({
  uuid,
  nodeType: FaultTreeNodeType.BASIC_EVENT,
  name: uuid,
  inputs: [],
  probability: p,
  probabilityType: "constant",
  position: { x: 0, y: 0 },
});
const gate = (uuid: string, type: FaultTreeNodeType, inputs: string[]): FaultTreeNode => ({
  uuid,
  nodeType: type,
  name: uuid,
  inputs,
  position: { x: 0, y: 0 },
});
describe("mefToReactFlow — shared basic events", () => {
  it("produces one display node per reference when a basic event is shared by two gates", () => {
    const mef: Record<string, FaultTreeNode> = {
      TOP: gate("TOP", FaultTreeNodeType.OR_GATE, ["G1", "G2"]),
      G1: gate("G1", FaultTreeNodeType.AND_GATE, ["E1", "E2"]),
      G2: gate("G2", FaultTreeNodeType.AND_GATE, ["E1", "E3"]),
      E1: basicEvent("E1"),
      E2: basicEvent("E2"),
      E3: basicEvent("E3"),
    };
    const { nodes } = mefToReactFlow(mef);
    const e1Nodes = nodes.filter((n) => n.data?.canonicalId === "E1");
    expect(e1Nodes).toHaveLength(2);
    const e1Ids = new Set(e1Nodes.map((n) => n.id));
    expect(e1Ids.size).toBe(2);
    e1Nodes.forEach((n) => {
      expect(n.type).toBe("basicEvent");
      expect(n.data?.quantification?.name).toBe("E1");
    });
  });
  it("produces a strict tree — no node is the target of more than one edge", () => {
    const mef: Record<string, FaultTreeNode> = {
      TOP: gate("TOP", FaultTreeNodeType.OR_GATE, ["G1", "G2"]),
      G1: gate("G1", FaultTreeNodeType.AND_GATE, ["E1", "E2"]),
      G2: gate("G2", FaultTreeNodeType.AND_GATE, ["E1", "E3"]),
      E1: basicEvent("E1"),
      E2: basicEvent("E2"),
      E3: basicEvent("E3"),
    };
    const { edges } = mefToReactFlow(mef);
    const targetCounts = new Map<string, number>();
    for (const edge of edges) {
      targetCounts.set(edge.target, (targetCounts.get(edge.target) ?? 0) + 1);
    }
    for (const [target, count] of targetCounts) {
      expect(count).toBe(1);
      void target;
    }
  });
  it("non-shared basic events are not cloned", () => {
    const mef: Record<string, FaultTreeNode> = {
      TOP: gate("TOP", FaultTreeNodeType.AND_GATE, ["E1", "E2"]),
      E1: basicEvent("E1"),
      E2: basicEvent("E2"),
    };
    const { nodes } = mefToReactFlow(mef);
    expect(nodes.filter((n) => n.data?.canonicalId === "E1")).toHaveLength(1);
    expect(nodes.filter((n) => n.data?.canonicalId === "E2")).toHaveLength(1);
  });
  it("clone display ID for shared leaf uses parent name + child name lowercased", () => {
    const mef: Record<string, FaultTreeNode> = {
      TOP: gate("TOP", FaultTreeNodeType.OR_GATE, ["G1", "G2"]),
      G1: gate("G1", FaultTreeNodeType.AND_GATE, ["E1", "E2"]),
      G2: gate("G2", FaultTreeNodeType.AND_GATE, ["E1", "E3"]),
      E1: basicEvent("E1"),
      E2: basicEvent("E2"),
      E3: basicEvent("E3"),
    };
    const { nodes } = mefToReactFlow(mef);
    const e1Nodes = nodes.filter((n) => n.data?.canonicalId === "E1");
    const ids = new Set(e1Nodes.map((n) => n.id));
    expect(ids.has("E1")).toBe(true);
    expect(ids.has("g2e1")).toBe(true);
  });
});
describe("mefToReactFlow — shared gate subtrees", () => {
  it("clones the shared gate and all its descendants", () => {
    const mef: Record<string, FaultTreeNode> = {
      TOP: gate("TOP", FaultTreeNodeType.OR_GATE, ["G1", "G2"]),
      G1: gate("G1", FaultTreeNodeType.AND_GATE, ["SHARED", "E1"]),
      G2: gate("G2", FaultTreeNodeType.AND_GATE, ["SHARED", "E2"]),
      SHARED: gate("SHARED", FaultTreeNodeType.AND_GATE, ["E3", "E4"]),
      E1: basicEvent("E1"),
      E2: basicEvent("E2"),
      E3: basicEvent("E3"),
      E4: basicEvent("E4"),
    };
    const { nodes, edges } = mefToReactFlow(mef);
    const sharedNodes = nodes.filter((n) => n.data?.canonicalId === "SHARED");
    expect(sharedNodes).toHaveLength(2);
    const e3Nodes = nodes.filter((n) => n.data?.canonicalId === "E3");
    expect(e3Nodes).toHaveLength(2);
    const e4Nodes = nodes.filter((n) => n.data?.canonicalId === "E4");
    expect(e4Nodes).toHaveLength(2);
    const targetCounts = new Map<string, number>();
    for (const edge of edges) {
      targetCounts.set(edge.target, (targetCounts.get(edge.target) ?? 0) + 1);
    }
    for (const [, count] of targetCounts) {
      expect(count).toBe(1);
    }
  });
  it("produces the correct total node count for a shared-gate tree", () => {
    const mef: Record<string, FaultTreeNode> = {
      TOP: gate("TOP", FaultTreeNodeType.OR_GATE, ["G1", "G2"]),
      G1: gate("G1", FaultTreeNodeType.AND_GATE, ["SHARED", "E1"]),
      G2: gate("G2", FaultTreeNodeType.AND_GATE, ["SHARED", "E2"]),
      SHARED: gate("SHARED", FaultTreeNodeType.AND_GATE, ["E3", "E4"]),
      E1: basicEvent("E1"),
      E2: basicEvent("E2"),
      E3: basicEvent("E3"),
      E4: basicEvent("E4"),
    };
    const { nodes } = mefToReactFlow(mef);
    expect(nodes).toHaveLength(11);
  });
  it("clone display IDs for shared gate use accumulated parent prefix", () => {
    const mef: Record<string, FaultTreeNode> = {
      TOP: gate("TOP", FaultTreeNodeType.OR_GATE, ["G1", "G2"]),
      G1: gate("G1", FaultTreeNodeType.AND_GATE, ["SHARED", "E1"]),
      G2: gate("G2", FaultTreeNodeType.AND_GATE, ["SHARED", "E2"]),
      SHARED: gate("SHARED", FaultTreeNodeType.AND_GATE, ["E3", "E4"]),
      E1: basicEvent("E1"),
      E2: basicEvent("E2"),
      E3: basicEvent("E3"),
      E4: basicEvent("E4"),
    };
    const { nodes } = mefToReactFlow(mef);
    const sharedIds = new Set(nodes.filter((n) => n.data?.canonicalId === "SHARED").map((n) => n.id));
    expect(sharedIds.has("SHARED")).toBe(true);
    expect(sharedIds.has("g2shared")).toBe(true);
    const e3Ids = new Set(nodes.filter((n) => n.data?.canonicalId === "E3").map((n) => n.id));
    expect(e3Ids.has("E3")).toBe(true);
    expect(e3Ids.has("g2sharede3")).toBe(true);
    const e4Ids = new Set(nodes.filter((n) => n.data?.canonicalId === "E4").map((n) => n.id));
    expect(e4Ids.has("E4")).toBe(true);
    expect(e4Ids.has("g2sharede4")).toBe(true);
  });
});
describe("reactFlowToMEF — collapse clones", () => {
  it("round-trips a shared-event MEF through mefToReactFlow then back to MEF correctly", () => {
    const original: Record<string, FaultTreeNode> = {
      TOP: gate("TOP", FaultTreeNodeType.OR_GATE, ["G1", "G2"]),
      G1: gate("G1", FaultTreeNodeType.AND_GATE, ["E1", "E2"]),
      G2: gate("G2", FaultTreeNodeType.AND_GATE, ["E1", "E3"]),
      E1: basicEvent("E1", 0.05),
      E2: basicEvent("E2", 0.02),
      E3: basicEvent("E3", 0.03),
    };
    const { nodes, edges } = mefToReactFlow(original);
    const { nodes: mefOut } = reactFlowToMEF(nodes, edges);
    expect(Object.keys(mefOut)).toHaveLength(Object.keys(original).length);
    expect(mefOut["E1"]).toBeDefined();
    expect(mefOut["E1"].probability).toBe(0.05);
    expect(mefOut["G1"].inputs).toContain("E1");
    expect(mefOut["G1"].inputs).toContain("E2");
    expect(mefOut["G2"].inputs).toContain("E1");
    expect(mefOut["G2"].inputs).toContain("E3");
  });
  it("each gate references the canonical uuid — no clone display IDs in MEF inputs", () => {
    const original: Record<string, FaultTreeNode> = {
      TOP: gate("TOP", FaultTreeNodeType.OR_GATE, ["G1", "G2"]),
      G1: gate("G1", FaultTreeNodeType.AND_GATE, ["E1", "E2"]),
      G2: gate("G2", FaultTreeNodeType.AND_GATE, ["E1", "E3"]),
      E1: basicEvent("E1"),
      E2: basicEvent("E2"),
      E3: basicEvent("E3"),
    };
    const { nodes, edges } = mefToReactFlow(original);
    const { nodes: mefOut } = reactFlowToMEF(nodes, edges);
    const canonicalKeys = new Set(Object.keys(original));
    for (const mefNode of Object.values(mefOut)) {
      for (const input of mefNode.inputs ?? []) {
        expect(canonicalKeys.has(input)).toBe(true);
      }
    }
  });
});
