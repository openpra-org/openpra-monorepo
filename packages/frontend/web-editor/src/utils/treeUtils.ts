import {Node, Edge} from "reactflow";
import {GraphNode} from "shared-types/src/lib/types/faultTreeGraph/GraphNode";
import {GraphEdge} from "shared-types/src/lib/types/faultTreeGraph/GraphEdge";
import {FaultTreeGraph} from "shared-types/src/lib/types/faultTreeGraph/Graph";

export const generateUUID = (): string =>
  new Date().getTime().toString(36) + Math.random().toString(36).slice(2);

export interface FaultTreeState {
  faultTreeId: string,
  nodes: Node[],
  edges: Edge[]
}

export const state = ({ faultTreeId, nodes, edges}: FaultTreeState): FaultTreeGraph => {
  return {
    faultTreeId: faultTreeId,
    nodes: nodes.map((node) => {
      return {
        id: node.id,
        data: node.data,
        position: node.position,
        type: node.type
      } as GraphNode
    }),
    edges: edges.map((edge) => {
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type
      } as GraphEdge
    })
  }
}
