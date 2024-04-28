import { EdgeTypes } from "reactflow";
import { EventSequenceEdge } from "./eventSequenceEdge";

/**
 * Represents the types of edges of event sequence diagram
 */
const ESEdgeTypes: EdgeTypes = {
  normal: EventSequenceEdge("normal"),
  functional: EventSequenceEdge("functional"),
};

export type EventSequenceEdgeProps = {
  tentative?: boolean;
  label?: string;
  order?: number;
  branchId?: string;
};

export { ESEdgeTypes };
