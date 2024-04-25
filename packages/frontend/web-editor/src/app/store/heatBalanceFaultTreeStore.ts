import { create } from "zustand";
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
} from "reactflow";
import { initialEdges, initialNodes } from "../../utils/faultTreeData";
import { HeatBalanceFaultTreeNodeProps } from "../components/treeNodes/heatBalancefaultTreeNodes/heatBalanceFaultTreeNodeType";

export type RFState = {
  nodes: Node<HeatBalanceFaultTreeNodeProps>[];
  edges: Edge<HeatBalanceFaultTreeNodeProps>[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node<HeatBalanceFaultTreeNodeProps>[]) => void;
  setEdges: (edges: Edge<HeatBalanceFaultTreeNodeProps>[]) => void;
};
/**
 * This is our useStore hook that we can use in our components to get parts of the store and call actions
 * @returns - The state and store functions
 */

const useStore = create<RFState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  onNodesChange: (changes: NodeChange[]): void => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes: EdgeChange[]): void => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection: Connection): void => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },
  setNodes: (nodes: Node<HeatBalanceFaultTreeNodeProps>[]): void => {
    set({ nodes });
  },
  setEdges: (edges: Edge<HeatBalanceFaultTreeNodeProps>[]): void => {
    set({ edges });
  },
}));

export { useStore };
