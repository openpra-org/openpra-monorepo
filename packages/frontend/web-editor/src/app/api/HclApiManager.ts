import ApiManager from './ApiManager';
// import TreeProps from '@openpra/hcla-web-frontend-primitives/app/Props/TreeProps';
import { AxiosResponse } from 'axios';
// import { TreeTypes } from '../components/Model/ModelView/TreeView/Tools/TreeDictionaries';
// import { EventTreeMxGraphJSON } from '../mxGraph/HCLTreeMxGraph/ESDMxGraph';
// import { FaultTreeMxGraphJSON } from '../mxGraph/HCLTreeMxGraph/FaultTreeMxGraph';
// import { BayesianNetworkMxGraphJSON } from '../mxGraph/HCLTreeMxGraph/BayesianNetworkMxGraph';

// request interface
export interface PaginationQueryOptions {
  limit?: number;
  offset?: number;
}

export interface DataAnalysisViewQueryParams {
  model_id?: number;
  tree_id?: number;
  house_events?: boolean;
  basic_events?: boolean;
  gates?: boolean;
}

class HclApiManager extends ApiManager {
  getTreeWithMetaData(treeId: number, onSuccess: (response: AxiosResponse) => void): void {
    this.get(`${HclApiManager.ENDPOINT}/tree/${treeId}/?include_tree_data=true`, onSuccess);
  }

  public static ENDPOINT = `${ApiManager.API_ENDPOINT}/hcl`;

  public static patchHclTreeDataOnlyJson(treeId: number, type: TreeTypes, data: FaultTreeMxGraphJSON | EventTreeMxGraphJSON | BayesianNetworkMxGraphJSON) {
    const payload = JSON.stringify({
      tree_type: type,
      tree_data: data,
    });
    return ApiManager.patch(`${HclApiManager.ENDPOINT}/tree/${treeId}/`, payload);
  }

  public static patchHclTreeMetadata(treeId: number, data: TreeProps) {
    return ApiManager.patch(`${HclApiManager.ENDPOINT}/tree/${treeId}/`, JSON.stringify(data));
  }

  public static getHclTreeWithMetadata(treeId: number) {
    return ApiManager.getWithOptions(`${HclApiManager.ENDPOINT}/tree/${treeId}/?include_tree_data=true`);
  }

  public static getHCLOverviewTreeData(modelId: number) {
    return ApiManager.getWithOptions(`${HclApiManager.ENDPOINT}/model/${modelId}/overview_tree/`);
  }

  public static getQuantificationResultsForModelWithId(modeId: number, limit: number, offset: number) {
    return ApiManager.getWithOptions(`${HclApiManager.ENDPOINT}/model/${modeId}/quantification/?limit=${limit}&offset=${offset}`);
  }

  public static getHclTreeMetadataOnly(treeId: number) {
    return ApiManager.getWithOptions(`${HclApiManager.ENDPOINT}/tree/${treeId}/`);
  }

  public static getHclTreesMetadataOnlyForModelWithId(modelId: number, limit?: number, offset?: number) {
    if (limit) {
      return ApiManager.getWithOptions(`${HclApiManager.ENDPOINT}/model/${modelId}/tree/&limit=${limit}&offset=${offset}`);
    }
    return ApiManager.getWithOptions(`${HclApiManager.ENDPOINT}/model/${modelId}/tree/`);
  }

  public static getHclTreesMetadataOnlyForModelWithIdForType(type: TreeTypes, modelId: number, limit: number, offset: number) {
    if (limit) {
      return ApiManager.getWithOptions(`${HclApiManager.ENDPOINT}/model/${modelId}/tree/?type=${type}&limit=${limit}&offset=${offset}`);
    }
    return ApiManager.getWithOptions(`${HclApiManager.ENDPOINT}/model/${modelId}/tree/?type=${type}`);
  }

  public static deleteHclTreeWithId(treeId: number) {
    return ApiManager.delete(`${HclApiManager.ENDPOINT}/tree/${treeId}/`);
  }

  public static getModels(limit: number, offset: number) {
    return ApiManager.getModelsForType('hcl', limit, offset);
  }

  public static getModelsWithKeyWord(limit: number, offset: number, filterKey: string) {
    return ApiManager.searchCollabModelsForType(filterKey, 'hcl', limit, offset);
  }

  public postNewModel(data: string) {
    // @ts-ignore
    return ApiManager.postNewModel('hcl', data);
  }

  public static deleteModel(modelId: number) {
    // @ts-ignore
    return ApiManager.deleteModel(modelId);
  }

  public static copyTree(treeId: number, params?: any) {
    const copyParams = params !== null ? `?${params}` : '';
    // @ts-ignore
    return ApiManager.post(`${HclApiManager.ENDPOINT}/tree/${treeId}/copy/${copyParams}`);
  }

  public static moveTreesToModel(data: any, params?: any) {
    const payload = JSON.stringify(data);
    const moveParams = params !== null ? `?${params}` : '';
    return ApiManager.patch(`${HclApiManager.ENDPOINT}/tree/move/${moveParams}`, payload);
  }

  public static getDataAnalysis(queryParams?: DataAnalysisViewQueryParams) {
    let query = queryParams ? "?" : "";
    query = queryParams?.model_id ? `${query}model_id=${queryParams?.model_id}&` : query;
    query = queryParams?.tree_id ? `${query}tree_id=${queryParams?.tree_id}&` : query;
    query = queryParams?.basic_events ? `${query}basic_events=true&` : query;
    query = queryParams?.house_events ? `${query}house_events=true&` : query;
    query = queryParams?.gates ? `${query}gates=true&` : query;
    return ApiManager.getWithOptions(`${HclApiManager.ENDPOINT}/data/${query}`);
  }

  public static getGateAnalysisData(modelId?: number, treeId?: number) {
    let query = modelId || treeId ? '?' : '';
    query = treeId ? `${query}tree_id=${treeId}&` : query;
    query = modelId ? `${query}model_id=${modelId}` : query;
    return ApiManager.getWithOptions(`${HclApiManager.ENDPOINT}/data/gates${query}`);
  }

  public static getBasicEvents(queryOptions?: Partial<PaginationQueryOptions>) {
    const query = queryOptions ? `?limit=${queryOptions?.limit}&offset=${queryOptions?.offset}/` : '';
    return ApiManager.getWithOptions(`${HclApiManager.ENDPOINT}/basic-event/${query}`);
  }

  public static getHouseEvents(queryOptions?: Partial<PaginationQueryOptions>) {
    const query = queryOptions ? `?limit=${queryOptions?.limit}&offset=${queryOptions?.offset}/` : '';
    return ApiManager.getWithOptions(`${HclApiManager.ENDPOINT}/house-event/${query}`);
  }

  public static getGates(queryOptions?: Partial<PaginationQueryOptions>) {
    const query = queryOptions ? `?limit=${queryOptions?.limit}&offset=${queryOptions?.offset}/` : '';
    return ApiManager.getWithOptions(`${HclApiManager.ENDPOINT}/gate/${query}`);
  }

  public static getGates(queryOptions?: Partial<PaginationQueryOptions>) {
    const query = queryOptions ? `?limit=${queryOptions?.limit}&offset=${queryOptions?.offset}/` : '';
    return ApiManager.getWithOptions(`${HclApiManager.ENDPOINT}/gate/${query}`);
  }

  public static createGlobalParameter(data: any, modelId: number) {
    const payload = JSON.stringify(data);
    return ApiManager.post(`${HclApiManager.ENDPOINT}/model/${modelId}/parameter/`, payload);
  }

  public static deleteGlobalParameter(modelId: number, parameterId: number) {
    return ApiManager.delete(`${HclApiManager.ENDPOINT}/model/${modelId}/parameter/${parameterId}/`);
  }

  public static updateGlobalParameter(data: any, modelId: number, parameterId: number) {
    const payload = JSON.stringify(data);
    return ApiManager.patch(`${HclApiManager.ENDPOINT}/model/${modelId}/parameter/${parameterId}/`, payload);
  }

  public static getGlobalParameters(modelId: number) {
    return ApiManager.get(`/hcl/model/${modelId}/parameter/`);
  }
}

export default HclApiManager;
