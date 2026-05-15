import { Delete, Get, EVENT_SEQUENCE_ANALYSIS_ENDPOINT, Patch, Post } from "../NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { LabelJSON } from "shared-types/src/lib/types/Label";
export async function GetEventSequenceAnalysis(id: string): Promise<NestedModelType[]> {
  try {
    const response = await Get(`${EVENT_SEQUENCE_ANALYSIS_ENDPOINT}/?id=${id}`);
    return (await response.json()) as Promise<NestedModelType[]>;
  } catch (error) {
    console.error("Failed to fetch event sequence analysis:", error);
    throw error;
  }
}
export async function PostEventSequenceAnalysis(data: NestedModelJSON, typedModel: string): Promise<NestedModelType> {
  try {
    console.log(data);
    console.log(typedModel);
    const response = await Post(`${EVENT_SEQUENCE_ANALYSIS_ENDPOINT}/`, data, typedModel);
    return (await response.json()) as Promise<NestedModelType>;
  } catch (error) {
    console.error("Failed to post event sequence analysis:", error);
    throw error;
  }
}
export async function PatchEventSequenceAnalysisLabel(id: string, data: LabelJSON): Promise<NestedModelType> {
  try {
    const response = await Patch(`${EVENT_SEQUENCE_ANALYSIS_ENDPOINT}/${id}`, data);
    return (await response.json()) as Promise<NestedModelType>;
  } catch (error) {
    console.error("Failed to patch event sequence analysis:", error);
    throw error;
  }
}
export async function DeleteEventSequenceAnalysis(id: string, type: string): Promise<void> {
  try {
    await Delete(`${EVENT_SEQUENCE_ANALYSIS_ENDPOINT}/?id=${id}&type=${type}`);
  } catch (error) {
    console.error("Failed to delete event sequence analysis:", error);
    throw error;
  }
}
