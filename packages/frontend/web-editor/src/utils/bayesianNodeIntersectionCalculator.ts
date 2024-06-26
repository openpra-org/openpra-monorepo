import { Node, XYPosition, Position } from "reactflow";

/**
 * Calculates the intersection point of an edge with the source node's boundaries when drawing an edge from the source node to the target node in a graph.
 *
 * @remarks
 * This function assumes that both the source and target nodes have width and height properties defined, as well as position.
 * It calculates a point on the edge of the source node that is closest to the target node.
 *
 * @param sourceNode - The source node from which the edge starts.
 * @param targetNode - The target node at which the edge ends.
 * @returns The intersection point as an XYPosition object if both nodes have dimensions and position defined, otherwise null.
 */
export function GetNodeIntersection(
  sourceNode: Node,
  targetNode: Node,
): XYPosition | null {
  if (
    !sourceNode.width ||
    !sourceNode.height ||
    !targetNode.width ||
    !targetNode.height
  ) {
    //console.log("Node properties are not fully defined");
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

/**
 * Determines the position on a node's edge where an edge should connect, based on an intersection point.
 *
 * @remarks
 * This function determines whether an edge should connect to the top, bottom, left, or right side of a node based on the intersection point provided.
 *
 * @param node - The node to which an edge is connecting.
 * @param intersectionPoint - The calculated intersection point where the edge meets the node's boundary.
 * @returns The position (Position) on the node's edge where the edge should connect, or null if the node's properties are not fully defined.
 */
export function GetEdgePosition(
  node: Node,
  intersectionPoint: XYPosition,
): Position | null {
  if (!node.width || !node.height) {
    // Handle this error case as appropriate
    //console.log("Node or intersection point properties are not fully defined");
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

/**
 * Computes the parameters needed for drawing an edge between two nodes, including the intersection points and positions on the nodes' edges.
 *
 * @remarks
 * This function uses GetNodeIntersection to find the points where an edge should intersect the source and target nodes' boundaries and uses GetEdgePosition
 * to determine the positions on the nodes' edges where the edge should connect.
 *
 * @param source - The source node from which the edge is drawn.
 * @param target - The target node to which the edge is drawn.
 * @returns An object containing the intersection points and positions for both the source and target nodes if intersection points are found, otherwise null.
 */
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
