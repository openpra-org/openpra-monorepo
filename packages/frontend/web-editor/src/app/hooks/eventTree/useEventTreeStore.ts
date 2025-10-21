import { create } from "zustand";
import { Node, Edge } from "reactflow";
import { getInitials } from "./useTreeData";

interface EventTreeNodeData {
  label: string;
  isSequenceId?: boolean;
}

// Define store type
interface EventTreeState {
  nodes: Node<EventTreeNodeData>[];
  edges: Edge[];
  firstColumnLabel: string;
  setFirstColumnLabel: (label: string, final?: boolean) => void;
  probability: number;
  frequency: number;
  setNodes: (nodes: Node<EventTreeNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNode: (id: string, newData: Partial<Node<EventTreeNodeData>["data"]>) => void;
}

// Create Zustand store
export const useEventTreeStore = create<EventTreeState>((set) => ({
  nodes: [],
  edges: [],
  firstColumnLabel: "Initiating Event",
  probability: 1.0,
  frequency: 0.0,

  setFirstColumnLabel: (label: string, final = false): void => {
    set((state: EventTreeState): Partial<EventTreeState> => {
      const initials = getInitials(label);

      if (!final) {
        return { firstColumnLabel: label };
      }

      // Get all sequence nodes sorted by their position (ensures correct order)
      const sequenceNodes = state.nodes
        .filter((node) => node.data.isSequenceId)
        .sort((a, b) => a.position.y - b.position.y);

      // Update each node's label to be unique and sequential
      const updatedNodes = state.nodes.map((node) => {
        if (node.data.isSequenceId) {
          const seqIndex = sequenceNodes.findIndex((n) => n.id === node.id); // Get correct index
          return {
            ...node,
            data: {
              ...node.data,
              label: `${initials}-${String(seqIndex + 1)}`, // Assign correct sequence ID
            },
          };
        }
        return node;
      });

      return {
        firstColumnLabel: label,
        nodes: updatedNodes,
      };
    });
  },

  setNodes: (nodes: Node<EventTreeNodeData>[]): void => {
    set({ nodes });
  },

  setEdges: (edges: Edge[]): void => {
    set({ edges });
  },

  updateNode: (id: string, _newData: Partial<Node<EventTreeNodeData>["data"]>): void => {
    set((state: EventTreeState): Partial<EventTreeState> => {
      const initials = getInitials(state.firstColumnLabel); // Always use the latest column name

      // Get all sequence nodes sorted to maintain correct numbering
      const sequenceNodes = state.nodes
        .filter((node) => node.data.isSequenceId)
        .sort((a, b) => a.position.y - b.position.y);

      const maxIndex = sequenceNodes.length; // The next available index

      const updatedNodes = state.nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              label: `${initials}-${String(maxIndex + 1)}`, // Assign new node correctly
            },
          };
        }
        return node;
      });

      return { nodes: updatedNodes };
    });
  },
}));
