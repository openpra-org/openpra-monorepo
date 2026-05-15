import type { Edge, Node } from "reactflow";
export function getGraphSignature(nodes: Node[], edges: Edge[]): string {
  const n = nodes
    .map((x) => ({ id: x.id, t: x.type, x: Math.round(x.position.x), y: Math.round(x.position.y) }))
    .sort((a, b) =>
      a.id < b.id ? -1
      : a.id > b.id ? 1
      : 0,
    );
  const e = edges
    .map((x) => ({ id: x.id, s: x.source, t: x.target, ty: x.type }))
    .sort((a, b) =>
      a.id < b.id ? -1
      : a.id > b.id ? 1
      : 0,
    );
  return JSON.stringify({ n, e });
}
export function shouldApplyGraph(prevSig: string | undefined, nextSig: string): boolean {
  if (!prevSig) return true;
  return prevSig !== nextSig;
}
