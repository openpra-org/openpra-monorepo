import type { GraphEdge } from "shared-types/src/lib/types/reactflowGraph/GraphEdge";
import type { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";

import type { NormalizedFaultTree, NormalizedFaultTreeNode, NormalizedGateType } from "./types";

/**
 * Minimal OpenPRA fault tree graph input for the v1 adapter.
 *
 * This mirrors the currently visible shared graph contract:
 * a faultTreeId plus graph nodes and edges.
 */
export interface OpenPraFaultTreeGraphInput {
  faultTreeId: string;
  nodes: GraphNode<object>[];
  edges: GraphEdge<object>[];
  modelName?: string;
}

/**
 * Caller supplied interpretation hooks for converting generic OpenPRA graph nodes
 * into the normalized readiness format.
 *
 * We keep this explicit because GraphNode.data is currently just `object`,
 * so the adapter should not guess the internal OpenPRA node payload shape.
 */
export interface OpenPraFaultTreeGraphAdapterOptions {
  /**
   * Return a stable human readable label for a node if available.
   */
  getLabel?: (node: GraphNode<object>) => string | undefined;

  /**
   * Determine whether a node represents a gate.
   */
  isGateNode: (node: GraphNode<object>) => boolean;

  /**
   * Determine whether a node represents a basic event.
   */
  isBasicEventNode: (node: GraphNode<object>) => boolean;

  /**
   * Map a gate node to a normalized gate type.
   *
   * Required only for nodes classified as gates.
   */
  getGateType?: (node: GraphNode<object>) => NormalizedGateType | undefined;

  /**
   * Optional explicit top node identifier. If omitted, the adapter will infer
   * the top node as a node with no incoming edges when possible.
   */
  topNodeId?: string;
}

/**
 * Convert an OpenPRA style fault tree graph into the normalized readiness input.
 */
export function adaptFaultTreeGraphToNormalizedFaultTree(
  input: OpenPraFaultTreeGraphInput,
  options: OpenPraFaultTreeGraphAdapterOptions,
): NormalizedFaultTree {
  const nodeById = new Map<string, GraphNode<object>>();
  const incomingCount = new Map<string, number>();
  const childMap = new Map<string, string[]>();

  for (const node of input.nodes) {
    nodeById.set(node.id, node);
    incomingCount.set(node.id, 0);
    childMap.set(node.id, []);
  }

  for (const edge of input.edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      continue;
    }

    childMap.get(edge.source)?.push(edge.target);
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
  }

  const normalizedNodes: Record<string, NormalizedFaultTreeNode> = {};

  for (const node of input.nodes) {
    const isGate = options.isGateNode(node);
    const isBasicEvent = options.isBasicEventNode(node);

    if (isGate && isBasicEvent) {
      throw new Error(`Node ${node.id} was classified as both gate and basic event.`);
    }

    if (!isGate && !isBasicEvent) {
      throw new Error(`Node ${node.id} could not be classified as gate or basic event.`);
    }

    if (isGate) {
      const gateType = options.getGateType?.(node);
      normalizedNodes[node.id] = {
        id: node.id,
        label: options.getLabel?.(node),
        kind: "gate",
        gateType,
        children: uniqueSorted(childMap.get(node.id) ?? []),
        metadata: {
          sourceNodeType: node.type,
          sourceNodeData: node.data,
        },
      };
      continue;
    }

    normalizedNodes[node.id] = {
      id: node.id,
      label: options.getLabel?.(node),
      kind: "basicEvent",
      metadata: {
        sourceNodeType: node.type,
        sourceNodeData: node.data,
      },
    };
  }

  const topNodeId = options.topNodeId ?? inferTopNodeId(input.nodes, incomingCount);

  if (!topNodeId) {
    throw new Error("Unable to infer a top node id from the graph. Provide topNodeId explicitly.");
  }

  if (!normalizedNodes[topNodeId]) {
    throw new Error(`Top node ${topNodeId} is not present in the graph.`);
  }

  return {
    id: input.faultTreeId,
    name: input.modelName ?? `Fault Tree ${input.faultTreeId}`,
    topNodeId,
    sourceFormat: "normalized",
    nodes: normalizedNodes,
  };
}

function inferTopNodeId(nodes: GraphNode<object>[], incomingCount: Map<string, number>): string | undefined {
  const roots = nodes
    .filter((node) => (incomingCount.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));

  if (roots.length === 1) {
    return roots[0];
  }

  return undefined;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
