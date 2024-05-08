import { StateCreator } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  Node,
  EdgeChange,
  NodeChange,
} from "reactflow";
import { SliceResetFns, storeType } from "../Store";
import useCreateColClick from "../../hooks/eventTree/useCreateColClick";
import useCreateNodeClick from "../../hooks/eventTree/useCreateNodeClick";
import useDeleteColClick from "../../hooks/eventTree/useDeleteColClick";
import useDeleteNodeClick from "../../hooks/eventTree/useDeleteNodeClick";
import { EventTreeEditorType } from "./eventTreeEditorType";
import { eventTreeEditorState } from "./eventTreeEditorState";
import { addSnapshot, undo, redo, loadGraph } from "./eventTreeEditorActions";

const eventTreeEditorSlice: StateCreator<
  storeType,
  [],
  [],
  EventTreeEditorType
> = (set, get) => {
  SliceResetFns.add(() => {
    set(eventTreeEditorState); // Reset to initial state
  });
  return {
    ...eventTreeEditorState, // Spread the initial state
    addSnapshot: () => {
      set((state) => addSnapshot(state));
    },
    undo: () => {
      set((state) => undo(state));
    },
    redo: () => {
      set((state) => redo(state));
    },
    onNodesChange: (changes: NodeChange[]) => {
      set({
        nodes: applyNodeChanges(changes, get().nodes),
      });
    },
    onEdgesChange: (changes: EdgeChange[]) => {
      set({
        edges: applyEdgeChanges(changes, get().edges),
      });
    },
    onConnect: (connection: Connection) => {
      set({
        edges: addEdge(connection, get().edges),
      });
    },
    setNodes: (nodes: Node[]) => {
      set({ nodes });
    },
    setEdges: (edges: Edge[]) => {
      set({ edges });
    },
    loadGraph: async (eventTreeId: string) => {
      const update = (await loadGraph(eventTreeId)()) ?? {
        nodes: [],
        edges: [],
      };
      set({ ...update, loading: false, undoStack: [], redoStack: [] }); // Update the state with the prepared data
    },
    loading: false,

    createColClick: (clickedNodeId: string) => {
      const update = useCreateColClick(
        clickedNodeId,
        get().nodes,
        get().edges,
      ) ?? {
        newNodes: [],
        newEdges: [],
      };
      set({
        nodes: update.newNodes,
        edges: update.newEdges,
      });
    },
    createNodeClick: (clickedNodeId: string) => {
      const update = useCreateNodeClick(
        clickedNodeId,
        get().nodes,
        get().edges,
      ) ?? {
        newNodes: [],
        newEdges: [],
      };
      set({
        nodes: update.newNodes,
        edges: update.newEdges,
      });
    },
    deleteColClick: (clickedNodeId: string) => {
      const update = useDeleteColClick(
        clickedNodeId,
        get().nodes,
        get().edges,
      ) ?? {
        newNodes: [],
        newEdges: [],
      };
      set({
        nodes: update.newNodes,
        edges: update.newEdges,
      });
    },
    deleteNodeClick: (clickedNodeId: string) => {
      const update = useDeleteNodeClick(
        clickedNodeId,
        get().nodes,
        get().edges,
      ) ?? {
        newNodes: [],
        newEdges: [],
      };
      set({
        nodes: update.newNodes,
        edges: update.newEdges,
      });
    },
  };
};

export { eventTreeEditorSlice };
