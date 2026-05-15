import { Delete, Get, EVENT_SEQUENCE_DIAGRAMS_ENDPOINT, Patch, Post } from "../NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { LabelJSON } from "shared-types/src/lib/types/Label";
export async function GetEventSequenceDiagrams(id: string): Promise<NestedModelType[]> {
  try {
    const response = await Get(`${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/?id=${id}`);
    return (await response.json()) as Promise<NestedModelType[]>;
  } catch (error) {
    console.error("Failed to fetch event sequence diagrams:", error);
    throw error;
  }
}
export async function PostEventSequenceDiagram(data: NestedModelJSON, typedModel: string): Promise<NestedModelType> {
  try {
    const response = await Post(`${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/`, data, typedModel);
    return (await response.json()) as Promise<NestedModelType>;
  } catch (error) {
    console.error("Failed to post event sequence diagram:", error);
    throw error;
  }
}
export async function PatchEventSequenceDiagramLabel(id: string, data: LabelJSON): Promise<NestedModelType> {
  try {
    const response = await Patch(`${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/${id}`, data);
    return (await response.json()) as Promise<NestedModelType>;
  } catch (error) {
    console.error("Failed to patch event sequence diagram:", error);
    throw error;
  }
}
export async function DeleteEventSequenceDiagram(id: string, type: string): Promise<void> {
  try {
    await Delete(`${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/?id=${id}&type=${type}`);
  } catch (error) {
    console.error("Failed to delete event sequence diagram:", error);
    throw error;
  }
}
