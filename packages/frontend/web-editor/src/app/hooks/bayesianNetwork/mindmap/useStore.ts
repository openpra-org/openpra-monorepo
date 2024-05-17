import {
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  XYPosition,
  MarkerType,
  getMarkerEnd,
} from "reactflow";
import { create } from "zustand";
import { nanoid } from "nanoid";

export interface RFState {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  addChildNode: (parentNode: Node, position: XYPosition) => void;
  updateNodeLabel: (nodeId: string, newLabel: string) => void;
  getParentLabel: (nodeId: string) => string;
  getChildrenLabels: (nodeId: string) => string[];
  addNode: (position: XYPosition) => void;
  addEdge: (newEdge: Edge) => void;
  getParent: (nodeId: string) => string | undefined;
  getChildren: (nodeId: string) => string[];
}

const useStore = create<RFState>((set, get) => ({
  nodes: [
    {
      id: "root",
      type: "mindmap",
      data: { label: "React Flow Mind Map" },
      position: { x: 100, y: 100 },
    },
  ],

  edges: [],

  addChildNode: (parentNode: Node, position: XYPosition) => {
    const newNode = {
      id: nanoid(),
      type: "mindmap",
      data: { label: "New Node" },
      position,
      parentNode: parentNode.id,
    };

    const newEdge = {
      id: nanoid(),
      source: parentNode.id,
      target: newNode.id,
      type: "mindmap",
    };

    set({
      nodes: [...get().nodes, newNode],
      edges: [...get().edges, newEdge],
    });
  },

  updateNodeLabel: (nodeId: string, label: string) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === nodeId) {
          // it's important to create a new object here, to inform React Flow about the changes
          node.data = { ...node.data, label };
        }
        return node;
      }),
    });
  },

  getParentLabel: (nodeId: string) => {
    const edge = get().edges.find((e) => e.target === nodeId);
    const parentNode = get().nodes.find((n) => n.id === edge?.source);
    return parentNode?.data.label;
  },

  getChildrenLabels: (nodeId: string) =>
    get()
      .edges.filter((e) => e.source === nodeId)
      .map((e) => {
        const childNode = get().nodes.find((n) => n.id === e.target);
        return childNode?.data.label || "Unknown"; // Fallback to 'Unknown' if label is not found
      }),

  addNode: (position: XYPosition) => {
    const newNode = {
      id: nanoid(),
      type: "mindmap", // or your preferred node type
      data: { label: "New Node" },
      position,
    };

    set((state) => ({
      nodes: [...state.nodes, newNode],
    }));
  },

  addEdge: (newEdge: Edge) => {
    set((state) => ({
      ...state,
      edges: [...state.edges, newEdge],
    }));
  },

  // Get the parent of the node
  getParent: (nodeId: string) => {
    const edge = get().edges.find((e) => e.target === nodeId);
    return edge?.source;
  },

  // Get the children of the node
  getChildren: (nodeId: string) =>
    get()
      .edges.filter((e) => e.source === nodeId)
      .map((e) => e.target),

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
}));

export default useStore;
