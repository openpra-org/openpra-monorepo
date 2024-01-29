import {
  EventSequenceGraph,
  FaultTreeGraph,
} from "shared-types/src/lib/types/reactflowGraph/Graph";
import { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";
import { GraphEdge } from "shared-types/src/lib/types/reactflowGraph/GraphEdge";
import { Node, Edge } from "reactflow";

/**
 * Function to generate a new & random UUID
 */
export const GenerateUUID = (): string =>
  new Date().getTime().toString(36) + Math.random().toString(36).slice(2);

/**
 * Event Sequence state to store the event sequence id and list of nodes & edges
 */
export type EventSequenceStateType = {
  eventSequenceId: string;
} & BaseGraphState;

/**
 * Fault Tree state to store the fault tree id and list of nodes & edges
 */
export type FaultTreeStateType = {
  faultTreeId: string;
} & BaseGraphState;

/**
 * Base Graph state to store the list of nodes & edges
 */
export type BaseGraphState = {
  nodes: Node[];
  edges: Edge[];
};

/**
 * Generate the event sequence state with the provided list of nodes and edges, for a particular event sequence id
 * @param eventSequenceId - event sequence id
 * @param nodes - list of nodes
 * @param edges - list of edges
 */
export const EventSequenceState = ({
  eventSequenceId,
  nodes,
  edges,
}: EventSequenceStateType): EventSequenceGraph => ({
  eventSequenceId: eventSequenceId,
  nodes: getNodes(nodes),
  edges: getEdges(edges),
});

/**
 * Generate the fault tree state with the provided list of nodes and edges, for a particular fault tree id
 * @param faultTreeId - fault tree id
 * @param nodes - list of nodes
 * @param edges - list of edges
 */
export const FaultTreeState = ({
  faultTreeId,
  nodes,
  edges,
}: FaultTreeStateType): FaultTreeGraph => ({
  faultTreeId: faultTreeId,
  nodes: getNodes(nodes),
  edges: getEdges(edges),
});

/**
 * Map Node[] to GraphNode[]
 * @param nodes - List of Nodes
 * @returns List of GraphNodes
 */
function getNodes(nodes: Node[]): GraphNode[] {
  return nodes.map(
    (node: Node<object>) =>
      ({
        id: node.id,
        data: node.data,
        position: node.position,
        type: node.type,
      }) as GraphNode,
  );
}

/**
 * Map Edge[] to GraphEdge[]
 * @param edges - List of Edges
 * @returns List of GraphEdges
 */
function getEdges(edges: Edge[]): GraphEdge[] {
  return edges.map(
    (edge) =>
      ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
      }) as GraphEdge,
  );
}
