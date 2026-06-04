import { Delete, Get, INITIATING_EVENTS_ENDPOINT, Patch, Post } from "../NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { LabelJSON } from "shared-types/src/lib/types/Label";
export async function GetInitiatingEvents(id: string): Promise<NestedModelType[]> {
  try {
    const response = await Get(`${INITIATING_EVENTS_ENDPOINT}/?id=${id}`);
    return (await response.json()) as Promise<NestedModelType[]>;
  } catch (error) {
    console.error("Failed to fetch initiating events:", error);
    throw error;
  }
}
export async function PostInitiatingEvent(data: NestedModelJSON, typedModel: string): Promise<NestedModelType> {
  try {
    const response = await Post(`${INITIATING_EVENTS_ENDPOINT}/`, data, typedModel);
    return (await response.json()) as Promise<NestedModelType>;
  } catch (error) {
    console.error("Failed to post initiating event:", error);
    throw error;
  }
}
export async function PatchInitiatingEventLabel(id: string, data: LabelJSON): Promise<NestedModelType> {
  try {
    const response = await Patch(`${INITIATING_EVENTS_ENDPOINT}/${id}`, data);
    return (await response.json()) as Promise<NestedModelType>;
  } catch (error) {
    console.error("Failed to patch initiating event:", error);
    throw error;
  }
}
export async function DeleteInitiatingEvent(id: string, type: string): Promise<void> {
  try {
    await Delete(`${INITIATING_EVENTS_ENDPOINT}/?id=${id}&type=${type}`);
  } catch (error) {
    console.error("Failed to delete initiating event:", error);
    throw error;
  }
}
