import NormalEdge from "./normalEdge";
import FunctionalEdge from "./functionalEdge";

/**
 * Represents the types of edges of event sequence diagram
 */
export const edgeTypes = {
  normal: NormalEdge,
  functional: FunctionalEdge,
};

export default edgeTypes;
