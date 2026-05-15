import { Delete, Get, EVENT_TREES_ENDPOINT, Patch, Post } from "../NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { LabelJSON } from "shared-types/src/lib/types/Label";
export async function GetEventTrees(id: string): Promise<NestedModelType[]> {
  try {
    const response = await Get(`${EVENT_TREES_ENDPOINT}/?id=${id}`);
    return (await response.json()) as Promise<NestedModelType[]>;
  } catch (error) {
    console.error("Failed to fetch event trees:", error);
    throw error;
  }
}
export async function PostEventTree(data: NestedModelJSON, typedModel: string): Promise<NestedModelType> {
  try {
    const response = await Post(`${EVENT_TREES_ENDPOINT}/`, data, typedModel);
    return (await response.json()) as Promise<NestedModelType>;
  } catch (error) {
    console.error("Failed to post event tree:", error);
    throw error;
  }
}
export async function PatchEventTreeLabel(id: string, data: LabelJSON): Promise<NestedModelType> {
  try {
    const response = await Patch(`${EVENT_TREES_ENDPOINT}/${id}`, data);
    return (await response.json()) as Promise<NestedModelType>;
  } catch (error) {
    console.error("Failed to patch event tree:", error);
    throw error;
  }
}
export async function DeleteEventTree(id: string, type: string): Promise<void> {
  try {
    await Delete(`${EVENT_TREES_ENDPOINT}/?id=${id}&type=${type}`);
  } catch (error) {
    console.error("Failed to delete event tree:", error);
    throw error;
  }
}
