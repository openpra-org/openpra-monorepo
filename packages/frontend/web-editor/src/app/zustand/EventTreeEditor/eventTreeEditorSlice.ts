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
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import _ from "lodash";
import { SliceResetFns, storeType } from "../Store";
import useCreateColClick from "../../hooks/eventTree/useCreateColClick";
import useCreateNodeClick from "../../hooks/eventTree/useCreateNodeClick";
import useDeleteColClick from "../../hooks/eventTree/useDeleteColClick";
import useDeleteNodeClick from "../../hooks/eventTree/useDeleteNodeClick";
import { EventTreeState, FaultTreeState } from "../../../utils/treeUtils";
import { EventTreeEditorType } from "./eventTreeEditorType";
import { eventTreeEditorState } from "./eventTreeEditorState";
import {
  addSnapshot,
  undo,
  redo,
  loadGraph,
  onNodeDataChange,
  onAllColumnHeightChange,
} from "./eventTreeEditorActions";

const eventTreeEditorSlice: StateCreator<EventTreeEditorType> = (set, get) => {
  SliceResetFns.add(() => {
    set(eventTreeEditorState); // Reset to initial state
  });
  return {
    ...eventTreeEditorState, // Spread the initial state
    setEventTreeId: (eventTreeId: string) => {
      set({ eventTreeId: eventTreeId });
    },
    resetSlice: () => {
      set(eventTreeEditorState);
    },
    addSnapshot: () => {
      set((state) => addSnapshot(state));
    },
    undo: () => {
      set((state) => undo(state));
      get().saveGraph();
    },
    redo: () => {
      set((state) => redo(state));
      get().saveGraph();
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
      set({ nodes: nodes });
    },
    setEdges: (edges: Edge[]) => {
      set({ edges: edges });
    },
    loadGraph: async (eventTreeId: string) => {
      const update = (await loadGraph(eventTreeId)()) ?? {
        nodes: [],
        edges: [],
      };

      set({
        nodes: [...update.nodes],
        edges: [...update.edges],
        eventTreeId: eventTreeId,
        loading: false,
        undoStack: [],
        redoStack: [],
      }); // Update the state with the prepared data
    },
    saveGraph: _.debounce(() => {
      void GraphApiManager.storeEventTree(
        EventTreeState({
          eventTreeId: get().eventTreeId,
          nodes: get().nodes,
          edges: get().edges,
        }),
      ).then((r: any) => {
        set({ saved: true });
        console.log(r);
      });
    }, 3000),
    setSaved: (saved: boolean) => {
      set({ saved: saved });
    },
    setLoading: (loading: boolean) => {
      set({ loading });
    },
    onNodeDataChange: (nodeId: string, newData: any) => {
      const update = onNodeDataChange(nodeId, newData, get().nodes);
      set(update);
      get().saveGraph();
    },
    onAllColumnHeightChange: (newHeight: number, isIncreaseHeight: boolean) => {
      const update = onAllColumnHeightChange(
        newHeight,
        isIncreaseHeight,
        get().nodes,
      );
      set(update);
      get().saveGraph();
    },
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
      get().saveGraph();
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
      get().saveGraph();
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
      get().saveGraph();
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
      get().saveGraph();
    },
  };
};

export { eventTreeEditorSlice };
