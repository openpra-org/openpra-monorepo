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
import { FaultTreeNodeProps } from "../components/treeNodes/faultTreeNodes/faultTreeNodeType";

export type RFState = {
  nodes: Node<FaultTreeNodeProps>[];
  edges: Edge<FaultTreeNodeProps>[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node<FaultTreeNodeProps>[]) => void;
  setEdges: (edges: Edge<FaultTreeNodeProps>[]) => void;
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
  setNodes: (nodes: Node<FaultTreeNodeProps>[]): void => {
    set({ nodes });
  },
  setEdges: (edges: Edge<FaultTreeNodeProps>[]): void => {
    set({ edges });
  },
}));

export { useStore };
