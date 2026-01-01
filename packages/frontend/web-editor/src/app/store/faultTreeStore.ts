import { create } from "zustand";
import {
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  NodeProps,
} from "reactflow";
import { initialEdges, initialNodes } from "../../utils/faultTreeData";
import { FaultTreeNodeProps } from "../components/treeNodes/faultTreeNodes/faultTreeNodeType";

/**
 * React Flow editor state for the Fault Tree editor.
 */
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

/**
 * A single undo/redo snapshot of the graph.
 */
export type HistoryItem =
  | {
      nodes: Node[];
      edges: Edge[];
    }
  | undefined;

/**
 * Zustand store for the Fault Tree editor.
 *
 * @returns The state and store functions for the editor.
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
