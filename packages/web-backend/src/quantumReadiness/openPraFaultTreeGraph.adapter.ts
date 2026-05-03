import type { FaultTreeGraph } from "shared-types";
import { GraphEdge } from "shared-types/src/lib/types/reactflowGraph/GraphEdge";
import { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";

type NormalizedOpenPraNode = {
  id?: string;
  label?: unknown;
  kind?: unknown;
  gateType?: unknown;
  children?: unknown;
  metadata?: unknown;
  isTop?: unknown;
  isTopEvent?: unknown;
};

type NormalizedOpenPraGraph = {
  faultTreeId?: unknown;
  id?: unknown;
  topNodeId?: unknown;
  nodes: Record<string, NormalizedOpenPraNode>;
};

export function adaptFaultTreeGraphInput(
  input: FaultTreeGraph | Record<string, unknown>,
  fallbackFaultTreeId?: string,
): FaultTreeGraph {
  if (isSharedFaultTreeGraph(input)) {
    return {
      faultTreeId: getString(input.faultTreeId) ?? fallbackFaultTreeId ?? "fault_tree",
      nodes: input.nodes,
      edges: input.edges ?? [],
    };
  }

  if (isNormalizedOpenPraGraph(input)) {
    return convertNormalizedOpenPraGraph(input, fallbackFaultTreeId);
  }

  return {
    faultTreeId: fallbackFaultTreeId ?? "fault_tree",
    nodes: [],
    edges: [],
  };
}

function isSharedFaultTreeGraph(input: unknown): input is FaultTreeGraph {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as { nodes?: unknown };
  return Array.isArray(candidate.nodes);
}

function isNormalizedOpenPraGraph(input: unknown): input is NormalizedOpenPraGraph {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as { nodes?: unknown };
  return !!candidate.nodes && !Array.isArray(candidate.nodes) && typeof candidate.nodes === "object";
}

function convertNormalizedOpenPraGraph(graph: NormalizedOpenPraGraph, fallbackFaultTreeId?: string): FaultTreeGraph {
  const inferredTopNodeId = inferNormalizedOpenPraTopNodeId(graph);
  const faultTreeId = getString(graph.faultTreeId) ?? getString(graph.id) ?? fallbackFaultTreeId ?? "fault_tree";

  const nodes: GraphNode<object>[] = [];
  const edges: GraphEdge<object>[] = [];

  for (const [nodeId, rawNode] of Object.entries(graph.nodes)) {
    const effectiveId = getString(rawNode?.id) ?? nodeId;
    const childIds = getChildIds(rawNode?.children);

    nodes.push({
      id: effectiveId,
      type: "node",
      position: { x: 0, y: 0 },
      data: {
        label: getLabelValue(rawNode?.label),
        gateType: normalizeGateType(rawNode?.gateType),
        nodeType: getString(rawNode?.kind),
        isTop: effectiveId === inferredTopNodeId || nodeId === inferredTopNodeId,
        metadata: isPlainObject(rawNode?.metadata) ? rawNode.metadata : {},
      },
    });

    for (const childId of childIds) {
      edges.push({
        id: `${effectiveId}__${childId}`,
        source: effectiveId,
        target: childId,
        type: "default",
        animated: false,
        data: { label: "" },
      });
    }
  }

  return {
    faultTreeId,
    nodes: nodes as FaultTreeGraph["nodes"],
    edges: edges as FaultTreeGraph["edges"],
  };
}

function inferNormalizedOpenPraTopNodeId(graph: NormalizedOpenPraGraph): string | undefined {
  const explicitTopNodeId = getString(graph.topNodeId);
  if (explicitTopNodeId) {
    return explicitTopNodeId;
  }

  const flaggedIds: string[] = [];

  for (const [nodeId, rawNode] of Object.entries(graph.nodes)) {
    const effectiveId = getString(rawNode?.id) ?? nodeId;
    if (hasTopMarker(rawNode)) {
      flaggedIds.push(effectiveId);
    }
  }

  if (flaggedIds.length === 1) {
    return flaggedIds[0];
  }

  const referencedChildIds = new Set<string>();
  for (const rawNode of Object.values(graph.nodes)) {
    for (const childId of getChildIds(rawNode?.children)) {
      referencedChildIds.add(childId);
    }
  }

  const rootGateIds: string[] = [];
  const rootIds: string[] = [];

  for (const [nodeId, rawNode] of Object.entries(graph.nodes)) {
    const effectiveId = getString(rawNode?.id) ?? nodeId;
    if (!referencedChildIds.has(effectiveId)) {
      rootIds.push(effectiveId);
      if (getString(rawNode?.kind)?.toLowerCase() === "gate") {
        rootGateIds.push(effectiveId);
      }
    }
  }

  if (rootGateIds.length === 1) {
    return rootGateIds[0];
  }

  if (rootIds.length === 1) {
    return rootIds[0];
  }

  const labelMarkedIds: string[] = [];
  for (const [nodeId, rawNode] of Object.entries(graph.nodes)) {
    const effectiveId = getString(rawNode?.id) ?? nodeId;
    const label = getLabelText(rawNode?.label);
    if (label && /top/i.test(label)) {
      labelMarkedIds.push(effectiveId);
    }
  }

  if (labelMarkedIds.length === 1) {
    return labelMarkedIds[0];
  }

  return undefined;
}

function hasTopMarker(rawNode: NormalizedOpenPraNode | undefined): boolean {
  if (!rawNode) {
    return false;
  }

  if (getBoolean(rawNode.isTop) || getBoolean(rawNode.isTopEvent)) {
    return true;
  }

  if (!isPlainObject(rawNode.metadata)) {
    return false;
  }

  if (getBoolean(rawNode.metadata.isTop) || getBoolean(rawNode.metadata.isTopEvent)) {
    return true;
  }

  if (!isPlainObject(rawNode.metadata.sourceNodeData)) {
    return false;
  }

  return (
    getBoolean(rawNode.metadata.sourceNodeData.isTop) || getBoolean(rawNode.metadata.sourceNodeData.isTopEvent) || false
  );
}

function getChildIds(children: unknown): string[] {
  if (!Array.isArray(children)) {
    return [];
  }

  const out: string[] = [];

  for (const child of children) {
    if (typeof child === "string") {
      out.push(child);
      continue;
    }

    if (isPlainObject(child)) {
      const childId = getString(child.id);
      if (childId) {
        out.push(childId);
      }
    }
  }

  return out;
}

function normalizeGateType(value: unknown): string | undefined {
  const gateType = getString(value);
  return gateType ? gateType.toLowerCase() : undefined;
}

function getLabelValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value;
  }

  if (isPlainObject(value)) {
    const nestedName = getString(value.name);
    if (nestedName) {
      return nestedName;
    }
  }

  return value;
}

function getLabelText(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (isPlainObject(value)) {
    return getString(value.name);
  }

  return undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
