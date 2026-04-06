import type { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";

import {
  adaptFaultTreeGraphToNormalizedFaultTree,
  type OpenPraFaultTreeGraphAdapterOptions,
  type OpenPraFaultTreeGraphInput
} from "./openpra-fault-tree-graph-adapter";
import type { NormalizedFaultTree, NormalizedGateType } from "./types";

type UnknownRecord = Record<string, unknown>;

/**
 * Optional overrides for the default OpenPRA graph heuristics.
 *
 * These let callers pin or replace any part of the classification logic
 * while still using the convenience wrapper.
 */
export interface LikelyOpenPraFaultTreeGraphHeuristicOverrides {
  getLabel?: (node: GraphNode<object>) => string | undefined;
  isGateNode?: (node: GraphNode<object>) => boolean;
  isBasicEventNode?: (node: GraphNode<object>) => boolean;
  getGateType?: (node: GraphNode<object>) => NormalizedGateType | undefined;
  topNodeId?: string;
}

/**
 * Adapt an OpenPRA style fault tree graph using conservative default heuristics.
 *
 * This wrapper is intentionally narrow. It uses graph node `type` and a small
 * set of likely data keys to infer gate nodes, basic event nodes, labels,
 * gate type, and top node hints.
 */
export function adaptLikelyOpenPraFaultTreeGraphToNormalizedFaultTree(
  input: OpenPraFaultTreeGraphInput,
  overrides: LikelyOpenPraFaultTreeGraphHeuristicOverrides = {}
): NormalizedFaultTree {
  const adapterOptions: OpenPraFaultTreeGraphAdapterOptions = {
    getLabel: overrides.getLabel ?? getLikelyOpenPraNodeLabel,
    isGateNode: overrides.isGateNode ?? isLikelyOpenPraGateNode,
    isBasicEventNode: overrides.isBasicEventNode ?? isLikelyOpenPraBasicEventNode,
    getGateType: overrides.getGateType ?? getLikelyOpenPraGateType,
    topNodeId: overrides.topNodeId ?? getLikelyOpenPraTopNodeId(input.nodes)
  };

  return adaptFaultTreeGraphToNormalizedFaultTree(input, adapterOptions);
}

/**
 * Return a likely label for an OpenPRA graph node.
 */
export function getLikelyOpenPraNodeLabel(node: GraphNode<object>): string | undefined {
  const directLabel = firstNonEmptyString([
    getNestedString(node.data, ["label", "name"]),
    getNestedString(node.data, ["label"]),
    getNestedString(node.data, ["name"]),
    getNestedString(node.data, ["title"]),
    getNestedString(node.data, ["text"])
  ]);

  if (directLabel) {
    return directLabel;
  }

  return undefined;
}

/**
 * Conservatively identify likely gate nodes.
 */
export function isLikelyOpenPraGateNode(node: GraphNode<object>): boolean {
  const typeValue = (node.type ?? "").toLowerCase();

  if (typeValue.includes("gate")) {
    return true;
  }

  if (typeValue === "top") {
    return true;
  }

  const gateType = getLikelyOpenPraGateType(node);
  if (gateType) {
    return true;
  }

  const nodeKind = firstNonEmptyString([
    getNestedString(node.data, ["kind"]),
    getNestedString(node.data, ["nodeType"]),
    getNestedString(node.data, ["elementType"]),
    getNestedString(node.data, ["role"]),
    getNestedString(node.data, ["category"])
  ])?.toLowerCase();

  if (!nodeKind) {
    return false;
  }

  return nodeKind.includes("gate") || nodeKind === "top";
}

/**
 * Conservatively identify likely basic event nodes.
 */
export function isLikelyOpenPraBasicEventNode(node: GraphNode<object>): boolean {
  const typeValue = (node.type ?? "").toLowerCase();

  if (typeValue.includes("basicevent") || typeValue.includes("basic-event") || typeValue.includes("basic_event")) {
    return true;
  }

  const nodeKind = firstNonEmptyString([
    getNestedString(node.data, ["kind"]),
    getNestedString(node.data, ["nodeType"]),
    getNestedString(node.data, ["elementType"]),
    getNestedString(node.data, ["role"]),
    getNestedString(node.data, ["category"])
  ])?.toLowerCase();

  if (!nodeKind) {
    return false;
  }

  return (
    nodeKind.includes("basicevent") ||
    nodeKind.includes("basic-event") ||
    nodeKind.includes("basic_event") ||
    nodeKind.includes("houseevent") ||
    nodeKind.includes("house-event") ||
    nodeKind.includes("house_event")
  );
}

/**
 * Infer a normalized gate type from likely OpenPRA node fields.
 */
export function getLikelyOpenPraGateType(node: GraphNode<object>): NormalizedGateType | undefined {
  const rawValue = firstNonEmptyString([
    getNestedString(node.data, ["gateType"]),
    getNestedString(node.data, ["gate_type"]),
    getNestedString(node.data, ["operator"]),
    getNestedString(node.data, ["type"]),
    node.type
  ]);

  if (!rawValue) {
    return undefined;
  }

  return normalizeLikelyGateType(rawValue);
}

/**
 * Infer a top node id when a node carries an explicit marker.
 */
export function getLikelyOpenPraTopNodeId(nodes: GraphNode<object>[]): string | undefined {
  const markedTopNodes = nodes
    .filter((node) => hasAnyTruthyMarker(node.data, ["isTop", "isTopEvent", "topEvent"]))
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));

  if (markedTopNodes.length === 1) {
    return markedTopNodes[0];
  }

  const roleTopNodes = nodes
    .filter((node) => {
      const roleValue = firstNonEmptyString([
        getNestedString(node.data, ["role"]),
        getNestedString(node.data, ["kind"]),
        getNestedString(node.data, ["nodeType"]),
        getNestedString(node.data, ["elementType"])
      ])?.toLowerCase();

      return roleValue === "top" || roleValue === "top-event" || roleValue === "topevent";
    })
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));

  if (roleTopNodes.length === 1) {
    return roleTopNodes[0];
  }

  return undefined;
}

function normalizeLikelyGateType(value: string): NormalizedGateType | undefined {
  const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, "-");

  switch (normalized) {
    case "and":
      return "and";
    case "or":
      return "or";
    case "not":
      return "not";
    case "xor":
      return "xor";
    case "nand":
      return "nand";
    case "nor":
      return "nor";
    case "atleast":
    case "at-least":
    case "vote":
    case "voting":
    case "k-out-of-n":
      return "atleast";
    default:
      return undefined;
  }
}

function getNestedString(value: unknown, path: string[]): string | undefined {
  let current: unknown = value;

  for (const segment of path) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }

    current = current[segment];
  }

  return typeof current === "string" && current.trim().length > 0 ? current.trim() : undefined;
}

function hasTruthyMarker(value: unknown, path: string[]): boolean {
  let current: unknown = value;

  for (const segment of path) {
    if (!isRecord(current) || !(segment in current)) {
      return false;
    }

    current = current[segment];
  }

  return current === true;
}

function hasAnyTruthyMarker(value: unknown, markerKeys: string[]): boolean {
  return markerKeys.some((markerKey) => hasTruthyMarker(value, [markerKey]));
}

function firstNonEmptyString(values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}
