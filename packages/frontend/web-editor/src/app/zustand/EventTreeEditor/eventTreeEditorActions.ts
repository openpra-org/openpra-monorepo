import { SetState } from "zustand";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { Node } from "reactflow";
import { useCallback } from "react";
import _ from "lodash";
import { edgeData, nodeData } from "../../../utils/EventTreeData";
import useTreeData from "../../hooks/eventTree/useTreeData";
import { layoutNodes } from "../../hooks/eventTree/useLayout";
import {
  EventTreeEditorState,
  EventTreeEditorType,
} from "./eventTreeEditorType";

const addSnapshot = (state: EventTreeEditorState): EventTreeEditorState => {
  const snapshot = { nodes: [...state.nodes], edges: [...state.edges] };
  return {
    ...state,
    undoStack: [...state.undoStack, snapshot],
    redoStack: [], // Clear the redo stack on new action
  };
};

const undo = (state: EventTreeEditorState): EventTreeEditorState => {
  if (state.undoStack.length === 0) return state;
  const lastSnapshot = state.undoStack.pop()!;

  return {
    ...state,
    nodes: lastSnapshot.nodes,
    edges: lastSnapshot.edges,
    redoStack: [...state.redoStack, { nodes: state.nodes, edges: state.edges }],
  };
};

const redo = (state: EventTreeEditorState): EventTreeEditorState => {
  if (state.redoStack.length === 0) return state;
  const nextSnapshot = state.redoStack.pop()!;
  return {
    ...state,
    nodes: nextSnapshot.nodes,
    edges: nextSnapshot.edges,
    undoStack: [...state.undoStack, { nodes: state.nodes, edges: state.edges }],
  };
};

const loadGraph = (eventTreeId: string) => async () => {
  try {
    const response = await GraphApiManager.getEventTree(eventTreeId);
    if (response) {
      // Prepare the data to update the store
      return {
        nodes: response.nodes.length !== 0 ? response.nodes : nodeData,
        edges: response.edges.length !== 0 ? response.edges : edgeData,
      };
    }
  } catch (error) {
    console.error(
      "Failed to load graph data for event tree ID:",
      eventTreeId,
      error,
    );
  }
};

const onNodeDataChange = (nodeId: string, newData: any, nodes: Node[]) => {
  nodes = nodes.map((node) =>
    node.id === nodeId ? { ...node, data: newData } : node,
  );
  return { nodes: nodes };
};
const onAllColumnHeightChange = (
  newHeight: number,
  isIncreaseHeight: boolean,
  nodes: Node[],
) => {
  nodes = nodes.map((node) =>
    node.type === "columnNode"
      ? {
          ...node,
          position: {
            ...node.position,
            y: isIncreaseHeight ? node.position.y - 14 : node.position.y + 14,
          },
          data: { ...node.data, height: newHeight },
        }
      : node,
  );
  return { nodes: nodes };
};

export {
  addSnapshot,
  undo,
  redo,
  loadGraph,
  onNodeDataChange,
  onAllColumnHeightChange,
};
