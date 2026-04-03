import { plant_operating_states_analysis } from "mef-types";
import { apiDelete, apiGet, apiPatch, apiPost } from "../apiClient";

type PlantOperatingStatesAnalysis = plant_operating_states_analysis.PlantOperatingStatesAnalysis;

const path = (modelId: string, uuid?: string): string =>
  uuid ? `/models/${modelId}/pos/${uuid}` : `/models/${modelId}/pos`;

export async function getAllPos(modelId: string): Promise<PlantOperatingStatesAnalysis[]> {
  return apiGet<PlantOperatingStatesAnalysis[]>(path(modelId));
}

export async function getPos(modelId: string, uuid: string): Promise<PlantOperatingStatesAnalysis> {
  return apiGet<PlantOperatingStatesAnalysis>(path(modelId, uuid));
}

export async function createPos(
  modelId: string,
  data: PlantOperatingStatesAnalysis,
): Promise<PlantOperatingStatesAnalysis> {
  return apiPost<PlantOperatingStatesAnalysis>(path(modelId), data);
}

export async function updatePos(
  modelId: string,
  uuid: string,
  data: PlantOperatingStatesAnalysis,
): Promise<PlantOperatingStatesAnalysis> {
  return apiPatch<PlantOperatingStatesAnalysis>(path(modelId, uuid), data);
}

export async function deletePos(modelId: string, uuid: string): Promise<void> {
  return apiDelete(path(modelId, uuid));
}
