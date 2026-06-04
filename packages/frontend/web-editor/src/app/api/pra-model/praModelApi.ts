import { apiDelete, apiGet, apiPost } from "../apiClient";
export enum PraModelType {
  INTERNAL_EVENTS = "internal-events",
  INTERNAL_HAZARDS = "internal-hazards",
  EXTERNAL_HAZARDS = "external-hazards",
  FULL_SCOPE = "full-scope",
}
export interface PraModelMeta {
  uuid: string;
  name: string;
  type: PraModelType;
  ownerId: string;
  createdAt: string;
}
export interface CreatePraModelDto {
  name: string;
  type: PraModelType;
  ownerId: string;
}
export async function getAllPraModels(): Promise<PraModelMeta[]> {
  return apiGet<PraModelMeta[]>("/models");
}
export async function getPraModel(uuid: string): Promise<PraModelMeta> {
  return apiGet<PraModelMeta>(`/models/${uuid}`);
}
export async function createPraModel(dto: CreatePraModelDto): Promise<PraModelMeta> {
  return apiPost<PraModelMeta>("/models", dto);
}
export async function deletePraModel(uuid: string): Promise<void> {
  return apiDelete(`/models/${uuid}`);
}
