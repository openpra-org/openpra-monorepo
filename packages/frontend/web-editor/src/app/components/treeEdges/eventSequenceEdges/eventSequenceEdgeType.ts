import { EdgeTypes } from "reactflow";
import { EventSequenceEdge } from "./eventSequenceEdge";

/**
 * Represents the types of edges of event sequence diagram
 */
const ESEdgeTypes: EdgeTypes = {
  normal: EventSequenceEdge("normal"),
  functional: EventSequenceEdge("functional"),
};

/**
 * Optional editing flags and metadata for Event Sequence edges.
 */
export interface EventSequenceEdgeProps {
  tentative?: boolean;
  label?: string;
  order?: number;
  branchId?: string;
}

export { ESEdgeTypes };
