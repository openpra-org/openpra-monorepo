import {
  DeleteInternalHazard as DeleteInternalHazardAPI,
  GetInternalHazards,
  PatchInternalHazard,
  PostInternalHazard,
} from "shared-sdk/lib/api/TypedModelApiManager";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";
import { InternalHazardsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalHazardsModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { UseGlobalStore } from "../Store";

/**
 * Load and set Internal Hazards for the current user.
 */
export const SetInternalHazards = async (): Promise<void> => {
  try {
    const internalHazardsList: InternalHazardsModelType[] = await GetInternalHazards(
      ApiManager.getCurrentUser().user_id,
    );
    UseGlobalStore.setState({
      InternalHazards: internalHazardsList,
    });
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Create a new Internal Hazard and append it to the store.
 *
 * @param data - Partial typed model payload for creation.
 */
export const AddInternalHazard = async (data: Partial<TypedModelJSON>): Promise<void> => {
  try {
    const ihr: InternalHazardsModelType = await PostInternalHazard(data);
    UseGlobalStore.setState((state) => ({
      InternalHazards: [...state.InternalHazards, ihr],
    }));
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Update an existing Internal Hazard and replace it in the store.
 *
 * @param modelId - Internal hazard id to update.
 * @param userId - Acting user id (audit/ownership).
 * @param data - Patch payload.
 */
export const EditInternalHazard = async (
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<void> => {
  try {
    const ihr: InternalHazardsModelType = await PatchInternalHazard(modelId, userId, data);
    UseGlobalStore.setState((state) => ({
      InternalHazards: state.InternalHazards.map((ih: InternalHazardsModelType) => {
        if (ih.id === modelId) {
          return ihr;
        } else {
          return ih;
        }
      }),
    }));
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Delete an Internal Hazard and remove it from the store.
 *
 * @param id - Internal hazard id to delete.
 */
export const DeleteInternalHazard = async (id: number): Promise<void> => {
  try {
    await DeleteInternalHazardAPI(id);

    UseGlobalStore.setState((state) => ({
      InternalHazards: state.InternalHazards.filter((ih: InternalHazardsModelType) => ih.id !== id),
    }));
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};
