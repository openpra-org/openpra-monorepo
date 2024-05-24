import {
  DeleteInternalHazard,
  GetInternalHazards,
  PatchInternalHazard,
  PostInternalHazard,
} from "shared-types/src/lib/api/TypedModelApiManager";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { InternalHazardsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalHazardsModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { UseGlobalStore } from "../Store";

export const setInternalHazards = async (): Promise<void> => {
  try {
    const internalHazardsList: InternalHazardsModelType[] = await GetInternalHazards(
      ApiManager.getCurrentUser().user_id,
    );
    UseGlobalStore.setState({
      internalHazards: internalHazardsList,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

export const addInternalHazard = async (data: Partial<TypedModelJSON>): Promise<void> => {
  try {
    const ihr: InternalHazardsModelType = await PostInternalHazard(data);
    UseGlobalStore.setState((state) => ({
      internalHazards: [...state.internalHazards, ihr],
    }));
  } catch (error) {
    console.error("Error adding internal hazard:", error);
  }
};

export const editInternalHazard = async (
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<void> => {
  try {
    const ihr: InternalHazardsModelType = await PatchInternalHazard(modelId, userId, data);
    UseGlobalStore.setState((state) => ({
      internalHazards: state.internalHazards.map((ih: InternalHazardsModelType) => {
        if (ih.id === modelId) {
          return ihr;
        } else {
          return ih;
        }
      }),
    }));
  } catch (error) {
    console.error("Error adding internal hazard:", error);
  }
};

export const deleteInternalHazard = async (id: number): Promise<void> => {
  try {
    await DeleteInternalHazard(id);

    UseGlobalStore.setState((state) => ({
      internalHazards: state.internalHazards.filter((ih: InternalHazardsModelType) => ih.id !== id),
    }));
  } catch (error) {
    console.error("Error deleting internal hazard:", error);
  }
};
