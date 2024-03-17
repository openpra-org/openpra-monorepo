import { GraphNode } from "./GraphNode";
import { GraphEdge } from "./GraphEdge";

/**
 * Graph type with list of GraphNodes and GraphEdges
 */
export type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

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