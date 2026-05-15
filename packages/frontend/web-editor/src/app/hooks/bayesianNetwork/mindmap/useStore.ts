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
} from "reactflow";
import { create } from "zustand";
import { nanoid } from "nanoid";
interface NodeData {
  label: string | undefined;
}
type NodeWithData = Node<NodeData> & {
  parentNodes?: string[];
};
type EdgeWithData = Edge & {
  id: string;
  source: string;
  target: string;
  type?: string;
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
  sourcePosition?: XYPosition;
  targetPosition?: XYPosition;
};
export interface RFState {
  nodes: NodeWithData[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  addChildNode: (parentNode: NodeWithData, position: XYPosition) => void;
  addParentNode: (childNode: NodeWithData, position: XYPosition) => void;
  deleteNodeAndReattachChildren: (nodeId: string) => void;
  updateNodeLabel: (nodeId: string, newLabel: string | undefined) => void;
  getParentLabels: (nodeId: string) => string[];
  getChildrenLabels: (nodeId: string) => string[];
  addEdge: (newEdge: EdgeWithData) => void;
  getParents: (nodeId: string) => string[];
  getChildren: (nodeId: string) => string[];
}
const UseStore = create<RFState>((set, get) => ({
  nodes: [
    {
      id: "root",
      type: "mindmap",
      data: { label: "New Node" },
      position: { x: 100, y: 100 },
      parentNodes: [],
    },
  ],
  edges: [],
  addChildNode: (parentNode: NodeWithData, position: XYPosition): void => {
    const newNode: NodeWithData = {
      id: nanoid(),
      type: "mindmap",
      data: { label: "New Node" },
      position,
      parentNodes: [parentNode.id],
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
  addParentNode: (childNode: NodeWithData, position: XYPosition): void => {
    const newParentNode: NodeWithData = {
      id: nanoid(),
      type: "mindmap",
      data: { label: "New Parent" },
      position,
    };
    const updatedNodes = get().nodes.map((node) =>
      node.id === childNode.id ?
        {
          ...node,
          parentNodes: node.parentNodes ? [...node.parentNodes, newParentNode.id] : [newParentNode.id],
        }
      : node,
    );
    const newEdge = {
      id: nanoid(),
      source: newParentNode.id,
      target: childNode.id,
      type: "mindmap",
    };
    set({
      nodes: [...updatedNodes, newParentNode],
      edges: [...get().edges, newEdge],
    });
  },
  deleteNodeAndReattachChildren: (nodeId: string): void => {
    const currentNodes = get().nodes;
    const currentEdges = get().edges;
    const parentEdges = currentEdges.filter((edge) => edge.target === nodeId);
    const parentIds = parentEdges.map((edge) => edge.source);
    if (parentIds.length === 0) {
      set({
        nodes: currentNodes.filter((node) => node.id !== nodeId),
        edges: currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      });
      return;
    }
    const childEdges = currentEdges.filter((e) => e.source === nodeId);
    const newEdges = childEdges.flatMap((childEdge) =>
      parentIds.map((parentId) => ({
        ...childEdge,
        id: nanoid(),
        source: parentId,
      })),
    );
    const updatedNodes = currentNodes.map((node) => {
      if (childEdges.some((edge) => edge.target === node.id)) {
        const existingParents = node.parentNodes ? node.parentNodes.filter((pid) => pid !== nodeId) : [];
        return {
          ...node,
          parentNodes: [...new Set([...existingParents, ...parentIds])],
        };
      }
      return node;
    });
    set({
      nodes: updatedNodes.filter((n) => n.id !== nodeId),
      edges: [...currentEdges.filter((e) => e.source !== nodeId && e.target !== nodeId), ...newEdges],
    });
  },
  updateNodeLabel: (nodeId: string, newLabel: string | undefined): void => {
    set({
      nodes: get().nodes.map((node): NodeWithData => {
        if (node.id === nodeId) {
          return { ...node, data: { label: newLabel } };
        }
        return node;
      }),
    });
  },
  getParentLabels: (nodeId: string): string[] => {
    const parentIds = get().getParents(nodeId);
    return parentIds.map((parentId) => {
      const parentNode = get().nodes.find((n) => n.id === parentId);
      return parentNode?.data.label ?? "Unknown";
    });
  },
  getChildrenLabels: (nodeId: string): string[] =>
    get()
      .edges.filter((e) => e.source === nodeId)
      .map((e) => {
        const childNode = get().nodes.find((n) => n.id === e.target);
        return childNode?.data.label ?? "Unknown";
      }),
  addEdge: (newEdge: EdgeWithData): void => {
    set({
      edges: [...get().edges, newEdge],
    });
  },
  getParents: (nodeId: string): string[] =>
    get()
      .edges.filter((e) => e.target === nodeId)
      .map((e) => e.source),
  getChildren: (nodeId: string): string[] =>
    get()
      .edges.filter((e) => e.source === nodeId)
      .map((e) => e.target),
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
}));
export { UseStore };
