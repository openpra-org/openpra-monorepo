import { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from "reactflow";

export type GraphSnapshot = {
  nodes: Node[];
  edges: Edge[];
};

export type EventTreeEditorState = {
  nodes: Node[];
  edges: Edge[];
  undoStack: GraphSnapshot[];
  redoStack: GraphSnapshot[];
};

export type EventTreeEditorType = {
  nodes: Node[];
  edges: Edge[];
  undoStack: GraphSnapshot[];
  redoStack: GraphSnapshot[];
  addSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  loadGraph: (eventTreeId: string) => Promise<void>;
  loading: boolean;
  createColClick: (clickedNodeId: string) => void;
  createNodeClick: (clickedNodeId: string) => void;
  deleteColClick: (clickedNodeId: string) => void;
  deleteNodeClick: (clickedNodeId: string) => void;
};
