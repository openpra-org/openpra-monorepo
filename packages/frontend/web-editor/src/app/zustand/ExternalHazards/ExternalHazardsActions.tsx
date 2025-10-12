import {
  DeleteExternalHazard as DeleteExternalHazardAPI,
  GetExternalHazards,
  PatchExternalHazard,
  PostExternalHazard,
} from "shared-sdk/lib/api/TypedModelApiManager";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";
import { ExternalHazardsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { UseGlobalStore } from "../Store";

export const SetExternalHazards = async (): Promise<void> => {
  try {
    const externalHazardsList: ExternalHazardsModelType[] = await GetExternalHazards(
      ApiManager.getCurrentUser().user_id,
    );
    UseGlobalStore.setState({
      ExternalHazards: externalHazardsList,
    });
  } catch (error) {}
};

export const AddExternalHazard = async (data: Partial<TypedModelJSON>): Promise<void> => {
  try {
    const ehr: ExternalHazardsModelType = await PostExternalHazard(data);
    UseGlobalStore.setState((state) => ({
      ExternalHazards: [...state.ExternalHazards, ehr],
    }));
  } catch (error) {}
};

export const EditExternalHazard = async (
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<void> => {
  try {
    const ehr: ExternalHazardsModelType = await PatchExternalHazard(modelId, userId, data);
    UseGlobalStore.setState((state) => ({
      ExternalHazards: state.ExternalHazards.map((eh: ExternalHazardsModelType) => {
        if (eh.id === modelId) {
          return ehr;
        } else {
          return eh;
        }
      }),
    }));
  } catch (error) {}
};

export const DeleteExternalHazard = async (id: number): Promise<void> => {
  try {
    await DeleteExternalHazardAPI(id);

    UseGlobalStore.setState((state) => ({
      ExternalHazards: state.ExternalHazards.filter((eh: ExternalHazardsModelType) => eh.id !== id),
    }));
  } catch (error) {}
};
