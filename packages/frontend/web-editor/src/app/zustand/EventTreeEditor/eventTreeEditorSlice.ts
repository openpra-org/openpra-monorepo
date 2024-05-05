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
      console.log(nodes);
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
      set({ ...update, loading: false }); // Update the state with the prepared data
    },
    loading: false,
    createColClick: (clickedNodeId: string) => {
      const nodes = get().nodes;
      const edges = get().edges;
      const update = useCreateColClick(clickedNodeId, nodes, edges) ?? {
        newNodes: [],
        newEdges: [],
      };
      set({ nodes: update.newNodes, edges: update.newEdges });
    },
    createNodeClick: (clickedNodeId: string) => {},
    deleteColClick: (clickedNodeId: string) => {},
    deleteNodeClick: (clickedNodeId: string) => {},
  };
};

export { eventTreeEditorSlice };
