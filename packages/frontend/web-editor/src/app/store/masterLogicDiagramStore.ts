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
import { initialEdges, initialNodes } from "../../utils/masterLogicDiagramData";
import { MasterLogicDiagramNodeProps } from "../components/treeNodes/masterLogicDiagramNodes/masterLogicDiagramNodeType";

export interface RFState {
  nodes: Node<MasterLogicDiagramNodeProps>[];
  edges: Edge<MasterLogicDiagramNodeProps>[];
  focusNodeId: NodeProps["id"] | undefined;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  setFocusNodeId: (focusNodeId: NodeProps["id"]) => void;
  resetFocusNodeId: () => void;
  setNodes: (nodes: Node<MasterLogicDiagramNodeProps>[]) => void;
  setEdges: (edges: Edge<MasterLogicDiagramNodeProps>[]) => void;
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
  setNodes: (nodes: Node<MasterLogicDiagramNodeProps>[]): void => {
    set({ nodes });
  },
  setEdges: (edges: Edge<MasterLogicDiagramNodeProps>[]): void => {
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
