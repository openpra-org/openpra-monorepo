import { FAULT_TREES_ENDPOINT, Get, Post, Patch, Delete } from "../NestedModelApiManager";
import { Graph } from "../../types/reactflowGraph/Graph";

const ApiEndpoint = "/api";
const GraphEndpoint = `${ApiEndpoint}/graph-models`;

// Unified fault tree type combining metadata and graph
export interface FaultTree {
  id: string;
  name: string;
  description?: string;
  modelId: string; // Parent model ID
  graph: Graph;
}

/**
 * Get all fault trees for a model
 * @param modelId - Parent model ID
 * @returns List of fault trees
 */
export async function getFaultTrees(modelId: string): Promise<FaultTree[]> {
  try {
    const response = await Get(`${FAULT_TREES_ENDPOINT}/?modelId=${modelId}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch fault trees:", error);
    throw error;
  }
}

/**
 * Get a single fault tree by ID
 * @param id - Fault tree ID
 * @returns Full fault tree data
 */
export async function getFaultTree(id: string): Promise<FaultTree> {
  try {
    const response = await Get(`${FAULT_TREES_ENDPOINT}/?id=${id}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch fault tree:", error);
    throw error;
  }
}

/**
 * Create a new fault tree
 * @param data - Fault tree data
 * @returns Created fault tree
 */
export async function createFaultTree(data: Omit<FaultTree, 'id'>): Promise<FaultTree> {
  try {
    const response = await Post(FAULT_TREES_ENDPOINT, data);
    return await response.json();
  } catch (error) {
    console.error("Failed to create fault tree:", error);
    throw error;
  }
}

/**
 * Update fault tree metadata
 * @param id - Fault tree ID
 * @param data - Partial metadata to update
 * @returns Updated fault tree
 */
export async function updateFaultTreeMetadata(
  id: string,
  data: Partial<Pick<FaultTree, 'name' | 'description'>>
): Promise<FaultTree> {
  try {
    const response = await Patch(`${FAULT_TREES_ENDPOINT}/metadata/?id=${id}`, data);
    return await response.json();
  } catch (error) {
    console.error("Failed to update fault tree metadata:", error);
    throw error;
  }
}

/**
 * Update fault tree graph
 * @param id - Fault tree ID
 * @param graph - Updated graph data
 * @returns Updated fault tree
 */
export async function updateFaultTreeGraph(
  id: string,
  graph: Graph
): Promise<FaultTree> {
  try {
    const response = await Patch(`${FAULT_TREES_ENDPOINT}/graph/?id=${id}`, graph);
    return await response.json();
  } catch (error) {
    console.error("Failed to update fault tree graph:", error);
    throw error;
  }
}

/**
 * Delete a fault tree
 * @param id - Fault tree ID
 */
export async function deleteFaultTree(id: string): Promise<void> {
  try {
    await Delete(`${FAULT_TREES_ENDPOINT}/?id=${id}`);
  } catch (error) {
    console.error("Failed to delete fault tree:", error);
    throw error;
  }
}
