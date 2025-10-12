import {
  DeleteFullScope as DeleteFullScopeAPI,
  GetFullScopeModels,
  PatchFullScope,
  PostFullScope,
} from "shared-sdk/lib/api/TypedModelApiManager";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";
import { FullScopeModelType } from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { UseGlobalStore } from "../Store";

export const SetFullScope = async (): Promise<void> => {
  try {
    const fullScopeList: FullScopeModelType[] = await GetFullScopeModels(ApiManager.getCurrentUser().user_id);
    UseGlobalStore.setState({
      FullScope: fullScopeList,
    });
  } catch (error) {}
};

export const AddFullScope = async (data: Partial<TypedModelJSON>): Promise<void> => {
  try {
    const fsr: FullScopeModelType = await PostFullScope(data);
    UseGlobalStore.setState((state) => ({
      FullScope: [...state.FullScope, fsr],
    }));
  } catch (error) {}
};

export const EditFullScope = async (modelId: number, userId: number, data: Partial<TypedModelJSON>): Promise<void> => {
  try {
    const fsr: FullScopeModelType = await PatchFullScope(modelId, userId, data);
    UseGlobalStore.setState((state) => ({
      FullScope: state.FullScope.map((fs: FullScopeModelType) => {
        if (fs.id === modelId) {
          return fsr;
        } else {
          return fs;
        }
      }),
    }));
  } catch (error) {}
};

export const DeleteFullScope = async (id: number): Promise<void> => {
  try {
    await DeleteFullScopeAPI(id);

    UseGlobalStore.setState((state) => ({
      FullScope: state.FullScope.filter((fs: FullScopeModelType) => fs.id !== id),
    }));
  } catch (error) {}
};
