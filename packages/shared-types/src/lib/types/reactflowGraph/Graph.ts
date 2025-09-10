import { Node, Edge } from "reactflow";
import { EventTreeData } from "./graphData/EventTreeData";

/**
 * Graph type with list of GraphNodes and GraphEdges
 */
export interface Graph {
  nodes: Node<object>[];
  edges: Edge<object>[];
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
  nodes: Node<EventTreeData>[];
  edges: Edge<EventTreeData>[];
};
