import { Node, XYPosition, Position } from "reactflow";
export function GetNodeIntersection(sourceNode: Node, targetNode: Node): XYPosition | null {
  if (!sourceNode.width || !sourceNode.height || !targetNode.width || !targetNode.height) {
    return null;
  }
  const w = sourceNode.width / 2;
  const h = sourceNode.height / 2;
  const xx1 =
    (targetNode.position.x - sourceNode.position.x) / (2 * w) -
    (targetNode.position.y - sourceNode.position.y) / (2 * h);
  const yy1 =
    (targetNode.position.x - sourceNode.position.x) / (2 * w) +
    (targetNode.position.y - sourceNode.position.y) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1));
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + sourceNode.position.x;
  const y = h * (-xx3 + yy3) + sourceNode.position.y;
  return { x, y };
}
export function GetEdgePosition(node: Node, intersectionPoint: XYPosition): Position | null {
  if (!node.width || !node.height) {
    return null;
  }
  const n = { ...node.position, ...node };
  const nx = Math.round(n.x);
  const ny = Math.round(n.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);
  if (px <= nx) {
    return Position.Left;
  }
  if (px >= nx + node.width) {
    return Position.Right;
  }
  if (py <= ny) {
    return Position.Top;
  }
  if (py >= ny + node.height) {
    return Position.Bottom;
  }
  return Position.Top;
}
export function GetEdgeParams(
  source: Node,
  target: Node,
): {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourcePos: Position | null;
  targetPos: Position | null;
} {
  const sourceIntersectionPoint = GetNodeIntersection(source, target);
  const targetIntersectionPoint = GetNodeIntersection(target, source);
  if (!sourceIntersectionPoint || !targetIntersectionPoint) {
    return {
      sx: 0,
      sy: 0,
      tx: 0,
      ty: 0,
      sourcePos: null,
      targetPos: null,
    };
  }
  const sourcePos = GetEdgePosition(source, sourceIntersectionPoint);
  const targetPos = GetEdgePosition(target, targetIntersectionPoint);
  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos,
    targetPos,
  };
}
