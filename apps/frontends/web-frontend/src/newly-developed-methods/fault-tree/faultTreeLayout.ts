import { type FtNode, type FtEdge, type FtNodeData } from "./faultTreeTypes";

const COL = 320;
const ROW = 170;
const EVENT_DX = 120;
const CLEAR = 24;
const EVENT_GAP = 16;
const BASE_H = 82;

/**
 * Estimated rendered height of a node. Basic events carry IE-code badges that
 * wrap onto extra rows; the column spacing is derived from this so a tall node
 * never gets covered by the next one. Two badges per row is pessimistic (three
 * actually fit), which keeps a margin rather than guessing the wrap exactly.
 */
function nodeHeight(data: FtNodeData): number {
  const n = data.badges?.length ?? 0;
  if (n === 0) return BASE_H;
  const rows = Math.ceil(n / 2);
  return BASE_H + 5 + rows * 14 + (rows - 1) * 3;
}

/**
 * Hybrid layout. The gate hierarchy is top-down: a gate's gate-children spread
 * horizontally below it. A gate's basic-event (leaf) children do not spread;
 * they stack into a vertical column just below and to the right of the gate,
 * spaced by each node's own height so the IE codes stay clear.
 */
export function layoutFaultTree(nodes: FtNode[], edges: FtEdge[]): FtNode[] {
  if (nodes.length === 0) return nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    const arr = children.get(e.source) ?? [];
    arr.push(e.target);
    children.set(e.source, arr);
    hasParent.add(e.target);
  }
  const isGate = (id: string): boolean => byId.get(id)?.data.type === "GATE";
  const pos = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();
  let leafCol = 0;

  function place(id: string, depth: number): void {
    if (visited.has(id)) return;
    visited.add(id);
    const kids = children.get(id) ?? [];
    const gateKids = kids.filter((k) => isGate(k));
    const eventKids = kids.filter((k) => !isGate(k));
    let gx: number;
    if (gateKids.length > 0) {
      const xs: number[] = [];
      for (const gk of gateKids) {
        place(gk, depth + 1);
        xs.push(pos.get(gk)?.x ?? 0);
      }
      gx = (xs[0] + xs[xs.length - 1]) / 2;
    } else {
      gx = leafCol * COL;
      leafCol += 1;
    }
    const gy = depth * ROW;
    pos.set(id, { x: gx, y: gy });
    let cursor = gy + nodeHeight(byId.get(id)?.data ?? ({} as FtNodeData)) + CLEAR;
    for (const ek of eventKids) {
      pos.set(ek, { x: gx + EVENT_DX, y: cursor });
      visited.add(ek);
      cursor += nodeHeight(byId.get(ek)?.data ?? ({} as FtNodeData)) + EVENT_GAP;
    }
  }

  for (const n of nodes) {
    if (!hasParent.has(n.id) && isGate(n.id)) place(n.id, 0);
  }
  for (const n of nodes) {
    if (!visited.has(n.id)) place(n.id, 0);
  }

  return nodes.map((n) => {
    const p = pos.get(n.id);
    return p !== undefined ? { ...n, position: p } : n;
  });
}
