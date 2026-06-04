import { Delete, Get, FAULT_TREES_ENDPOINT, Patch, Post } from "../NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { LabelJSON } from "shared-types/src/lib/types/Label";
export async function GetFaultTrees(id: string): Promise<NestedModelType[]> {
  try {
    const response = await Get(`${FAULT_TREES_ENDPOINT}/?id=${id}`);
    return (await response.json()) as Promise<NestedModelType[]>;
  } catch (error) {
    console.error("Failed to fetch fault trees:", error);
    throw error;
  }
}
export async function PostFaultTree(data: NestedModelJSON, typedModel: string): Promise<NestedModelType> {
  try {
    const response = await Post(`${FAULT_TREES_ENDPOINT}/`, data, typedModel);
    return (await response.json()) as Promise<NestedModelType>;
  } catch (error) {
    console.error("Failed to post fault tree:", error);
    throw error;
  }
}
export async function PatchFaultTreeLabel(id: string, data: LabelJSON): Promise<NestedModelType> {
  try {
    const response = await Patch(`${FAULT_TREES_ENDPOINT}/${id}`, data);
    return (await response.json()) as Promise<NestedModelType>;
  } catch (error) {
    console.error("Failed to patch fault tree:", error);
    throw error;
  }
}
export async function DeleteFaultTree(id: string, type: string): Promise<void> {
  try {
    await Delete(`${FAULT_TREES_ENDPOINT}/?id=${id}&type=${type}`);
  } catch (error) {
    console.error("Failed to delete fault tree:", error);
    throw error;
  }
}
