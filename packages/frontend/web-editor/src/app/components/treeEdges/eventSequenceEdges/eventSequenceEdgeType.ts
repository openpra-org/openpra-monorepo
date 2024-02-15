import { NormalEdge } from "./normalEdge";
import { FunctionalEdge } from "./functionalEdge";

/**
 * Represents the types of edges of event sequence diagram
 */
const ESEdgeTypes = {
  normal: NormalEdge,
  functional: FunctionalEdge,
};

export { ESEdgeTypes };
