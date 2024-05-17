import {
  DeleteExternalHazard,
  GetExternalHazards,
  PatchExternalHazard,
  PostExternalHazard,
} from "shared-types/src/lib/api/TypedModelApiManager";
import ApiManager from "shared-types/src/lib/api/ApiManager";
import { ExternalHazardsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { UseGlobalStore } from "../Store";

export const setExternalHazards = async (): Promise<void> => {
  try {
    const externalHazardsList: ExternalHazardsModelType[] = await GetExternalHazards(
      ApiManager.getCurrentUser().user_id,
    );
    UseGlobalStore.setState({
      externalHazards: externalHazardsList,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

export const addExternalHazard = async (data: Partial<TypedModelJSON>): Promise<void> => {
  try {
    const ehr: ExternalHazardsModelType = await PostExternalHazard(data);
    UseGlobalStore.setState((state) => ({
      externalHazards: [...state.externalHazards, ehr],
    }));
  } catch (error) {
    console.error("Error adding external hazard:", error);
  }
};

export const editExternalHazard = async (
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<void> => {
  try {
    const ehr: ExternalHazardsModelType = await PatchExternalHazard(modelId, userId, data);
    UseGlobalStore.setState((state) => ({
      externalHazards: state.externalHazards.map((eh: ExternalHazardsModelType) => {
        if (eh.id === modelId) {
          return ehr;
        } else {
          return eh;
        }
      }),
    }));
  } catch (error) {
    console.error("Error adding external hazard:", error);
  }
};

export const deleteExternalHazard = async (id: number): Promise<void> => {
  try {
    await DeleteExternalHazard(id);

    UseGlobalStore.setState((state) => ({
      externalHazards: state.externalHazards.filter((eh: ExternalHazardsModelType) => eh.id !== id),
    }));
  } catch (error) {
    console.error("Error deleting external hazard:", error);
  }
};
