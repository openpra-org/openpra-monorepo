import {
  applyEdgeChanges,
  applyNodeChanges,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  NodeProps,
  OnEdgesChange,
  OnNodesChange,
} from "reactflow";
import { create } from "zustand";

import { initialEdges, initialNodes } from "../../utils/faultTreeData";
import { FaultTreeNodeProps } from "../components/treeNodes/faultTreeNodes/faultTreeNodeType";

export interface RFState {
  nodes: Node<FaultTreeNodeProps>[];
  edges: Edge<FaultTreeNodeProps>[];
  focusNodeId: NodeProps["id"] | undefined;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  setFocusNodeId: (focusNodeId: NodeProps["id"]) => void;
  resetFocusNodeId: () => void;
  setNodes: (nodes: Node<FaultTreeNodeProps>[]) => void;
  setEdges: (edges: Edge<FaultTreeNodeProps>[]) => void;
  past: HistoryItem[];
  future: HistoryItem[];
  setPast: (past: HistoryItem[]) => void;
  setFuture: (future: HistoryItem[]) => void;
}

export type HistoryItem =
  | {
      nodes: Node[];
      edges: Edge[];
    }
  | undefined;

/**
 * This is our useStore hook that we can use in our components to get parts of the store and call actions
 * @returns - The state and store functions
 */

const useStore = create<RFState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  past: [],
  future: [],
  focusNodeId: undefined,
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
  setFocusNodeId: (focusNodeId: NodeProps["id"]): void => {
    set({ focusNodeId });
  },
  resetFocusNodeId: (): void => {
    set({ focusNodeId: undefined });
  },
  setNodes: (nodes: Node<FaultTreeNodeProps>[]): void => {
    set({ nodes });
  },
  setEdges: (edges: Edge<FaultTreeNodeProps>[]): void => {
    set({ edges });
  },
  setPast: (past: HistoryItem[]): void => {
    set({ past });
  },
  setFuture: (future: HistoryItem[]): void => {
    set({ future });
  },
}));

export { useStore };
