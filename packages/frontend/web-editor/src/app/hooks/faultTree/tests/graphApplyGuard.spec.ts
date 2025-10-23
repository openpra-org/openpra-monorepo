import { getGraphSignature, shouldApplyGraph } from "../graphApplyGuard";
import type { Node, Edge } from "reactflow";

const n = (id: string, x = 0, y = 0, type = "basicEvent"): Node => ({ id, position: { x, y }, data: {}, type });
const e = (id: string, s: string, t: string, type = "workflow"): Edge => ({ id, source: s, target: t, data: {}, type });

describe("graphApplyGuard", () => {
  it("returns same signature for identical graphs (order-insensitive)", () => {
    const nodes1 = [n("1", 0, 0), n("2", 10, 0)];
    const edges1 = [e("1->2", "1", "2")];
    const nodes2 = [n("2", 10, 0), n("1", 0, 0)];
    const edges2 = [e("1->2", "1", "2")];

    const sig1 = getGraphSignature(nodes1, edges1);
    const sig2 = getGraphSignature(nodes2, edges2);

    expect(sig1).toEqual(sig2);
    expect(shouldApplyGraph(sig1, sig2)).toBe(false);
  });

  it("detects meaningful changes and recommends apply", () => {
    const nodesA = [n("1", 0, 0), n("2", 10, 0)];
    const edgesA = [e("1->2", "1", "2")];
    const nodesB = [n("1", 0, 0), n("2", 10, 10)]; // moved node 2
    const edgesB = [e("1->2", "1", "2")];

    const sigA = getGraphSignature(nodesA, edgesA);
    const sigB = getGraphSignature(nodesB, edgesB);

    expect(sigA).not.toEqual(sigB);
    expect(shouldApplyGraph(sigA, sigB)).toBe(true);
  });
});
