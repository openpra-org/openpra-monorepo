import { GraphNode } from "./GraphNode";
import { GraphEdge } from "./GraphEdge";
import { EventTreeData } from "./graphData/EventTreeData";
import type { FaultTreeNode } from "mef-types/lib/systems-analysis/systems-analysis";

/**
 * Graph type with list of GraphNodes and GraphEdges
 */
export interface Graph {
  nodes: GraphNode<object>[];
  edges: GraphEdge<object>[];
}

/**
 * Event Sequence Graph, extending Graph type with event sequence id
 */
export type EventSequenceGraph = {
  eventSequenceId: string;
} & Graph;

/**
 * Fault Tree Graph stored in OpenPRA MEF format.
 * Nodes are keyed by their uuid (the same string used as the ReactFlow node id).
 * Edges are implicit: each gate node's `inputs` array lists its children's uuids.
 */
export interface FaultTreeGraph {
  /** Links this graph document to the NestedModel fault tree record */
  faultTreeId: string;
  /** uuid of the root / top-event node within `nodes` */
  topEventId: string;
  /** MEF node map: key = node uuid, value = FaultTreeNode */
  nodes: Record<string, FaultTreeNode>;
}

/**
 * Event Tree Graph, extending Graph type with event tree id
 */
export type EventTreeGraph = {
  eventTreeId: string;
} & {
  nodes: GraphNode<EventTreeData>[];
  edges: GraphEdge<EventTreeData>[];
};
