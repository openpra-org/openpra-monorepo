import {
  DeleteFullScope,
  GetFullScopeModels,
  PatchFullScope,
  PostFullScope,
} from "shared-types/src/lib/api/TypedModelApiManager";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { FullScopeModelType } from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { UseGlobalStore } from "../Store";

export const setFullScope = async (): Promise<void> => {
  try {
    const fullScopeList: FullScopeModelType[] = await GetFullScopeModels(ApiManager.getCurrentUser().user_id);
    UseGlobalStore.setState({
      fullScope: fullScopeList,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

export const addFullScope = async (data: Partial<TypedModelJSON>): Promise<void> => {
  try {
    const fsr: FullScopeModelType = await PostFullScope(data);
    UseGlobalStore.setState((state) => ({
      fullScope: [...state.fullScope, fsr],
    }));
  } catch (error) {
    console.error("Error adding full scope:", error);
  }
};

export const editFullScope = async (modelId: number, userId: number, data: Partial<TypedModelJSON>): Promise<void> => {
  try {
    const fsr: FullScopeModelType = await PatchFullScope(modelId, userId, data);
    UseGlobalStore.setState((state) => ({
      fullScope: state.fullScope.map((fs: FullScopeModelType) => {
        if (fs.id === modelId) {
          return fsr;
        } else {
          return fs;
        }
      }),
    }));
  } catch (error) {
    console.error("Error adding full scope:", error);
  }
};

export const deleteFullScope = async (id: number): Promise<void> => {
  try {
    await DeleteFullScope(id);

    UseGlobalStore.setState((state) => ({
      fullScope: state.fullScope.filter((fs: FullScopeModelType) => fs.id !== id),
    }));
  } catch (error) {
    console.error("Error deleting full scope:", error);
  }
};
