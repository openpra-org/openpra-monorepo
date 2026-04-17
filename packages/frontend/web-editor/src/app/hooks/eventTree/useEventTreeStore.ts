import { create } from "zustand";
import { Node, Edge } from "reactflow";
import { getInitials } from "./useTreeData";
import type { FunctionalEvent } from "mef-types/lib/event-sequence-analysis/event-sequence-analysis";

interface EventTreeNodeData {
  label: string;
  isSequenceId?: boolean;
}

interface EventTreeState {
  nodes: Node<EventTreeNodeData>[];
  edges: Edge[];
  firstColumnLabel: string;
  setFirstColumnLabel: (label: string, final?: boolean) => void;
  functionalEvents: Record<string, FunctionalEvent>;
  setNodes: (nodes: Node<EventTreeNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNode: (id: string, newData: Partial<Node<EventTreeNodeData>["data"]>) => void;
  setFunctionalEvent: (nodeId: string, fe: FunctionalEvent) => void;
  setFunctionalEvents: (fes: Record<string, FunctionalEvent>) => void;
}

/**
 * Global event tree store for the Event Tree editor.
 *
 * @remarks
 * Provides node/edge state, column label management and helpers to update
 * sequence labels consistently. Backed by Zustand.
 */
export const useEventTreeStore = create<EventTreeState>((set) => ({
  nodes: [],
  edges: [],
  firstColumnLabel: "Initiating Event",
  functionalEvents: {},

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
      const initials = getInitials(state.firstColumnLabel);

      const sequenceNodes = state.nodes
        .filter((node) => node.data.isSequenceId)
        .sort((a, b) => a.position.y - b.position.y);

      const maxIndex = sequenceNodes.length;

      const updatedNodes = state.nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              label: `${initials}-${String(maxIndex + 1)}`,
            },
          };
        }
        return node;
      });

      return { nodes: updatedNodes };
    });
  },

  setFunctionalEvent: (nodeId: string, fe: FunctionalEvent): void => {
    set(
      (state: EventTreeState): Partial<EventTreeState> => ({
        functionalEvents: { ...state.functionalEvents, [nodeId]: fe },
      }),
    );
  },

  setFunctionalEvents: (fes: Record<string, FunctionalEvent>): void => {
    set({ functionalEvents: fes });
  },
}));
