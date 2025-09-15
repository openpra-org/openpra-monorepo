import { GraphNode } from "./GraphNode";
import { GraphEdge } from "./GraphEdge";
import { EventTreeData } from "./graphData/EventTreeData";

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
 * Fault Tree Graph, extending Graph type with fault tree id
 */
export type FaultTreeGraph = {
  faultTreeId: string;
} & Graph;

/**
 * Event Tree Graph, extending Graph type with event tree id
 */
export type EventTreeGraph = {
  eventTreeId: string;
} & {
  nodes: GraphNode<EventTreeData>[];
  edges: GraphEdge<EventTreeData>[];
};
