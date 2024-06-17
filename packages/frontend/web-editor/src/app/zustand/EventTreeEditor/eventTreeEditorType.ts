import { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from "reactflow";

export type GraphSnapshot = {
  nodes: Node[];
  edges: Edge[];
};

export type EventTreeEditorState = {
  eventTreeId: string;
  nodes: Node[];
  edges: Edge[];
  undoStack: GraphSnapshot[];
  redoStack: GraphSnapshot[];
  loading: boolean;
  saved: boolean;
};

export type EventTreeEditorType = {
  eventTreeId: string;
  setEventTreeId: (eventTreeId: string) => void;
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
  saveGraph: () => void;
  loading: boolean;
  saved: boolean;
  setSaved: (saved: boolean) => void;
  setLoading: (loading: boolean) => void;
  createColClick: (clickedNodeId: string) => void;
  createNodeClick: (clickedNodeId: string) => void;
  deleteColClick: (clickedNodeId: string) => void;
  deleteNodeClick: (clickedNodeId: string) => void;
  onNodeDataChange: (nodeId: string, newData: any) => void;
  onAllColumnHeightChange: (
    newHeight: number,
    isIncreaseHeight: boolean,
  ) => void;
  resetSlice: () => void;
  //useLayout: () => void;
};
