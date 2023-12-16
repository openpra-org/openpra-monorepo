import { AxiosResponse } from "axios";
import TreeProps from "../props/TreeProps";
import { TreeTypes } from "../types/TreeTypes";
import { FaultTreeMxGraphJSON } from "../types/mxGraph/FaultTreeMxGraphJSON";
import EventTreeMxGraphJSON from "../types/mxGraph/EventTreeMxGraphJSON";
import { BayesianNetworkMxGraphJSON } from "../types/mxGraph/BayesianNetworkMxGraphJSON";
import ApiManager from "./ApiManager";

// request interface
export type PaginationQueryOptions = {
  limit?: number;
  offset?: number;
};

export type DataAnalysisViewQueryParams = {
  model_id?: number;
  tree_id?: number;
  house_events?: boolean;
  basic_events?: boolean;
  gates?: boolean;
};

export function GetTreeWithMetaData(
  treeId: number,
  onSuccess: (response: AxiosResponse) => void,
): void {
  this.get(`${ENDPOINT}/tree/${treeId}/?include_tree_data=true`, onSuccess);
}

const ENDPOINT = `${ApiManager.API_ENDPOINT}/hcl`;

export function PatchHclTreeDataOnlyJson(
  treeId: number,
  type: TreeTypes,
  data:
    | FaultTreeMxGraphJSON
    | EventTreeMxGraphJSON
    | BayesianNetworkMxGraphJSON,
): Promise<Response> {
  const payload = JSON.stringify({
    tree_type: type,
    tree_data: data,
  });
  return ApiManager.patch(`${ENDPOINT}/tree/${treeId}/`, payload);
}

export function PatchHclTreeMetadata(
  treeId: number,
  data: TreeProps,
): Promise<Response> {
  return ApiManager.patch(`${ENDPOINT}/tree/${treeId}/`, JSON.stringify(data));
}

export function GetHclTreeWithMetadata(treeId: number): Promise<Response> {
  return ApiManager.getWithOptions(
    `${ENDPOINT}/tree/${treeId}/?include_tree_data=true`,
  );
}

export function GetHCLOverviewTreeData(modelId: number): Promise<Response> {
  return ApiManager.getWithOptions(
    `${ENDPOINT}/model/${modelId}/overview_tree/`,
  );
}

export function GetQuantificationResultsForModelWithId(
  modeId: number,
  limit: number,
  offset: number,
): Promise<Response> {
  return ApiManager.getWithOptions(
    `${ENDPOINT}/model/${modeId}/quantification/?limit=${limit}&offset=${offset}`,
  );
}

export function GetHclTreeMetadataOnly(treeId: number): Promise<Response> {
  return ApiManager.getWithOptions(`${ENDPOINT}/tree/${treeId}/`);
}

export function GetHclTreesMetadataOnlyForModelWithId(
  modelId: number,
  limit?: number,
  offset?: number,
): Promise<Response> {
  if (limit) {
    return ApiManager.getWithOptions(
      `${ENDPOINT}/model/${modelId}/tree/&limit=${limit}&offset=${offset}`,
    );
  }
  return ApiManager.getWithOptions(`${ENDPOINT}/model/${modelId}/tree/`);
}

export function GetHclTreesMetadataOnlyForModelWithIdForType(
  type: TreeTypes,
  modelId: number,
  limit: number,
  offset: number,
): Promise<Response> {
  if (limit) {
    return ApiManager.getWithOptions(
      `${ENDPOINT}/model/${modelId}/tree/?type=${type}&limit=${limit}&offset=${offset}`,
    );
  }
  return ApiManager.getWithOptions(
    `${ENDPOINT}/model/${modelId}/tree/?type=${type}`,
  );
}

export function DeleteHclTreeWithId(treeId: number): Promise<Response> {
  return ApiManager.delete(`${ENDPOINT}/tree/${treeId}/`);
}

export function GetModels(limit: number, offset: number): Promise<Response> {
  return ApiManager.getModelsForType("hcl", limit, offset);
}

export function GetModelsWithKeyWord(
  limit: number,
  offset: number,
  filterKey: string,
): Promise<Response> {
  return ApiManager.searchCollabModelsForType(filterKey, "hcl", limit, offset);
}

export function PostNewModel(data: string): Promise<Response> {
  return ApiManager.postNewModel("hcl", data);
}

export function DeleteModel(modelId: number): Promise<Response> {
  return ApiManager.deleteModel(modelId);
}

export function CopyTree(treeId: number, params: string): Promise<Response> {
  return ApiManager.post(`${ENDPOINT}/tree/${treeId}/copy/${params}`, treeId);
}

export function MoveTreesToModel(data: any, params?: any): Promise<Response> {
  const payload = JSON.stringify(data);
  const moveParams = params !== null ? `?${params}` : "";
  return ApiManager.patch(`${ENDPOINT}/tree/move/${moveParams}`, payload);
}

export function GetDataAnalysis(
  queryParams?: DataAnalysisViewQueryParams,
): Promise<Response> {
  let query = queryParams ? "?" : "";
  query = queryParams?.model_id
    ? `${query}model_id=${queryParams.model_id}&`
    : query;
  query = queryParams?.tree_id
    ? `${query}tree_id=${queryParams.tree_id}&`
    : query;
  query = queryParams?.basic_events ? `${query}basic_events=true&` : query;
  query = queryParams?.house_events ? `${query}house_events=true&` : query;
  query = queryParams?.gates ? `${query}gates=true&` : query;
  return ApiManager.getWithOptions(`${ENDPOINT}/data/${query}`);
}

export function GetGateAnalysisData(
  modelId?: number,
  treeId?: number,
): Promise<Response> {
  let query = modelId || treeId ? "?" : "";
  query = treeId ? `${query}tree_id=${treeId}&` : query;
  query = modelId ? `${query}model_id=${modelId}` : query;
  return ApiManager.getWithOptions(`${ENDPOINT}/data/gates${query}`);
}

export function GetBasicEvents(
  queryOptions?: Partial<PaginationQueryOptions>,
): Promise<Response> {
  const query = queryOptions
    ? `?limit=${queryOptions.limit}&offset=${queryOptions.offset}/`
    : "";
  return ApiManager.getWithOptions(`${ENDPOINT}/basic-event/${query}`);
}

export function GetHouseEvents(
  queryOptions?: Partial<PaginationQueryOptions>,
): Promise<Response> {
  const query = queryOptions
    ? `?limit=${queryOptions.limit}&offset=${queryOptions.offset}/`
    : "";
  return ApiManager.getWithOptions(`${ENDPOINT}/house-event/${query}`);
}

export function GetGates(
  queryOptions?: Partial<PaginationQueryOptions>,
): Promise<Response> {
  const query = queryOptions
    ? `?limit=${queryOptions.limit}&offset=${queryOptions.offset}/`
    : "";
  return ApiManager.getWithOptions(`${ENDPOINT}/gate/${query}`);
}

export function CreateGlobalParameter(
  data: unknown,
  modelId: number,
): Promise<Response> {
  const payload = JSON.stringify(data);
  return ApiManager.post(`${ENDPOINT}/model/${modelId}/parameter/`, payload);
}

export function DeleteGlobalParameter(
  modelId: number,
  parameterId: number,
): Promise<Response> {
  return ApiManager.delete(
    `${ENDPOINT}/model/${modelId}/parameter/${parameterId}/`,
  );
}

export function UpdateGlobalParameter(
  data: unknown,
  modelId: number,
  parameterId: number,
): Promise<Response> {
  const payload = JSON.stringify(data);
  return ApiManager.patch(
    `${ENDPOINT}/model/${modelId}/parameter/${parameterId}/`,
    payload,
  );
}

export function GetGlobalParameters(modelId: number): Promise<Response> {
  return ApiManager.get(`/hcl/model/${modelId}/parameter/`);
}
