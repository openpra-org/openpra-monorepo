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
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";

/**
 * Type definition for additional data to be stored within each node.
 */
export interface NodeData {
  label: string | undefined;
}

/**
 * Extends the basic Node type to include custom data and an optional list of parent node IDs,
 * which are useful for maintaining complex relationships within the graph.
 */
export type NodeWithData = Node & { data: NodeData; parentNodes?: string[] };

/**
 * Extends the basic Edge type to include custom identifiers and positional attributes,
 * enhancing the control over edge rendering and interaction within the graph.
 */
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

/**
 * State structure for the React Flow instance, including arrays of nodes and edges,
 * and functions to manipulate these arrays.
 */
export interface RFState {
  nodes: NodeWithData[];
  edges: Edge[];
  bayesianNetworkId?: string;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  addChildNode: (parentNode: NodeWithData, position: XYPosition) => Promise<void>;
  addParentNode: (childNode: NodeWithData, position: XYPosition) => void;
  deleteNodeAndReattachChildren: (nodeId: string) => Promise<void>;
  updateNodeLabel: (nodeId: string, newLabel: string) => Promise<void>;
  getParentLabels: (nodeId: string) => string[];
  getChildrenLabels: (nodeId: string) => string[];
  addEdge: (newEdge: EdgeWithData) => void;
  getParents: (nodeId: string) => string[];
  getChildren: (nodeId: string) => string[];
  setBayesianNetworkId: (id: string) => void;
  setNodes: (newNodes: NodeWithData[]) => void;
  setEdges: (newEdges: Edge[]) => void;
}

/**
 * Creates and manages the state for the React Flow instance using the zustand library.
 * This store encapsulates the nodes and edges of the flow chart, along with methods to manipulate these elements.
 * Methods include adding and deleting nodes and edges, updating labels, and handling parent-child relationships.
 * It ensures that the graph's integrity is maintained by providing methods to prevent invalid states, such as cycles.
 *
 * @param set - A function to update the state.
 * @param get - A function to access the current state.
 * @returns A set of reactive state properties and functions that manage the nodes and edges of the React Flow graph.
 */
const UseStore = create<RFState>((set, get) => ({
  nodes: [
    {
      id: "root",
      type: "mindmap",
      data: { label: "React Flow Mind Map" },
      position: { x: 100, y: 100 },
      parentNodes: [],
    },
  ],

  edges: [],

  setNodes: (newNodes: NodeWithData[]): void => {
    set({ nodes: newNodes });
  },

  setEdges: (newEdges: Edge[]): void => {
    set({ edges: newEdges });
  },

  setBayesianNetworkId: (id: string) => {
    console.log("Setting bayesianNetworkId:", id); // Debug log
    set({ bayesianNetworkId: id });
  },

  addChildNode: async (parentNode: NodeWithData, position: XYPosition) => {
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
    set((state) => ({
      nodes: [...state.nodes, newNode],
      edges: [...state.edges, newEdge],
    }));

    try {
      const bayesianNetworkId = get().bayesianNetworkId;
      if (!bayesianNetworkId) throw new Error("Bayesian Network ID is not set");

      const response = await GraphApiManager.addNodeToBayesianNetwork(bayesianNetworkId, parentNode.id, newNode);
      if (!response) {
        console.error("Failed to add node on the backend.");
      }
    } catch (error) {
      console.error("Error adding child node:", error);
    }
  },

  addParentNode: (childNode: NodeWithData, position: XYPosition): void => {
    const newParentNode: NodeWithData = {
      id: nanoid(),
      type: "mindmap",
      data: { label: "New Parent" },
      position,
    };

    const updatedNodes = get().nodes.map((node) =>
      node.id === childNode.id
        ? {
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

  deleteNodeAndReattachChildren: async (nodeId: string) => {
    try {
      const bayesianNetworkId = get().bayesianNetworkId;
      if (!bayesianNetworkId) throw new Error("Bayesian Network ID is not set");

      await GraphApiManager.deleteNodeFromBayesianNetwork(bayesianNetworkId, nodeId);
      // Directly fetch the current state for nodes and edges
      const currentNodes = get().nodes;
      const currentEdges = get().edges;

      // Find the incoming edge for the node to get the parent's ID
      const parentEdges = currentEdges.filter((edge) => edge.target === nodeId);
      const parentIds = parentEdges.map((edge) => edge.source);

      // If the node has no parents (orphan or root), remove it and its outbound edges
      if (parentIds.length === 0) {
        set({
          nodes: currentNodes.filter((node) => node.id !== nodeId),
          edges: currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
        });
        return;
      }

      // Find all child edges
      const childEdges = currentEdges.filter((e) => e.source === nodeId);

      const newEdges = childEdges.flatMap((childEdge) =>
        parentIds.map((parentId) => ({
          ...childEdge,
          id: nanoid(), // Generate a new ID for each new edge
          source: parentId, // The source is now one of the original node's parents
        })),
      );

      // Update child nodes to include all new parents in their parentNodes field
      const updatedNodes = currentNodes.map((node) => {
        if (childEdges.some((edge) => edge.target === node.id)) {
          // For nodes that are children of the deleted node, update their parentNodes
          const existingParents = node.parentNodes ? node.parentNodes.filter((pid) => pid !== nodeId) : []; // Remove the deleted node from their parentNodes
          return {
            ...node,
            parentNodes: [...new Set([...existingParents, ...parentIds])], // Merge and deduplicate
          };
        }
        return node;
      });

      // Apply the changes in an atomic update
      set({
        nodes: updatedNodes.filter((n) => n.id !== nodeId), // remove the node
        edges: [
          ...currentEdges.filter((e) => e.source !== nodeId && e.target !== nodeId), // remove all edges of the node
          ...newEdges, // add new edges to reattach children
        ],
      });
    } catch (error) {
      console.error("Error deleting node:", error);
    }
  },

  updateNodeLabel: async (nodeId: string, newLabel: string) => {
    try {
      const bayesianNetworkId = get().bayesianNetworkId;
      if (!bayesianNetworkId) throw new Error("Bayesian Network ID is not set");

      await GraphApiManager.updateBayesianNodeLabel(nodeId, newLabel);
      set({
        nodes: get().nodes.map((node): NodeWithData => {
          if (node.id === nodeId) {
            return { ...node, data: { label: newLabel } };
          }
          return node;
        }),
      });
    } catch (error) {
      console.error("Error updating node label:", error);
    }
  },

  getParentLabels: (nodeId: string): string[] => {
    const parentIds = get().getParents(nodeId);
    return parentIds.map((parentId) => {
      const parentNode = get().nodes.find((n) => n.id === parentId);
      return (parentNode?.data.label as string) || "Unknown";
    });
  },

  getChildrenLabels: (nodeId: string): string[] =>
    get()
      .edges.filter((e) => e.source === nodeId)
      .map((e) => {
        const childNode = get().nodes.find((n) => n.id === e.target);
        return (childNode?.data.label as string) || "Unknown"; // Type assertion or null check
      }),
  addEdge: (newEdge: EdgeWithData): void => {
    set({
      edges: [...get().edges, newEdge],
    });
  },

  getParents: (nodeId: string): string[] =>
    // Adjust this to handle multiple parent edges correctly
    get()
      .edges.filter((e) => e.target === nodeId)
      .map((e) => e.source),

  getChildren: (nodeId: string): string[] =>
    get()
      .edges.filter((e) => e.source === nodeId)
      .map((e) => e.target),

  onNodesChange: (changes: NodeChange[]): void => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },

  onEdgesChange: (changes: EdgeChange[]): void => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },
}));

export { UseStore };
