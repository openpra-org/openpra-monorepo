import { Delete, Get, BAYESIAN_NETWORKS_ENDPOINT, Patch, Post } from "../NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { LabelJSON } from "shared-types/src/lib/types/Label";
export async function GetBayesianNetworks(id: string): Promise<NestedModelType[]> {
  try {
    const response = await Get(`${BAYESIAN_NETWORKS_ENDPOINT}/?id=${id}`);
    return (await response.json()) as Promise<NestedModelType[]>;
  } catch (error) {
    console.error("Failed to fetch bayesian networks:", error);
    throw error;
  }
}
export async function PostBayesianNetwork(data: NestedModelJSON, typedModel: string): Promise<NestedModelType> {
  try {
    const response = await Post(`${BAYESIAN_NETWORKS_ENDPOINT}/`, data, typedModel);
    return (await response.json()) as Promise<NestedModelType>;
  } catch (error) {
    console.error("Failed to post bayesian network:", error);
    throw error;
  }
}
export async function PatchBayesianNetworkLabel(id: string, data: LabelJSON): Promise<NestedModelType> {
  try {
    const response = await Patch(`${BAYESIAN_NETWORKS_ENDPOINT}/${id}`, data);
    return (await response.json()) as Promise<NestedModelType>;
  } catch (error) {
    console.error("Failed to patch bayesian network:", error);
    throw error;
  }
}
export async function DeleteBayesianNetwork(id: string, type: string): Promise<void> {
  try {
    await Delete(`${BAYESIAN_NETWORKS_ENDPOINT}/?id=${id}&type=${type}`);
  } catch (error) {
    console.error("Failed to delete bayesian network:", error);
    throw error;
  }
}
