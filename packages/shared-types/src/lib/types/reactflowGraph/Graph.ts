import { GraphNode } from "./GraphNode";
import { GraphEdge } from "./GraphEdge";
import { EventTreeData } from "./graphData/EventTreeData";
import type { FaultTreeNode } from "mef-types/lib/systems-analysis/systems-analysis";
import type { FunctionalEvent, EventTreeSequence } from "mef-types/lib/event-sequence-analysis/event-sequence-analysis";
export interface Graph {
  nodes: GraphNode<object>[];
  edges: GraphEdge<object>[];
}
export type EventSequenceGraph = {
  eventSequenceId: string;
} & Graph;
export interface FaultTreeGraph {
  faultTreeId: string;
  topEventId: string;
  nodes: Record<string, FaultTreeNode>;
}
export interface EventTreeGraph {
  eventTreeId: string;
  initiatingEventId?: string;
  initiatingEventFrequency?: number;
  functionalEvents?: Record<string, FunctionalEvent>;
  sequences?: Record<string, EventTreeSequence>;
  nodes: GraphNode<EventTreeData>[];
  edges: GraphEdge<EventTreeData>[];
}
