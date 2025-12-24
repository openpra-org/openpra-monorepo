import {
  DeleteExternalHazard as DeleteExternalHazardAPI,
  GetExternalHazards,
  PatchExternalHazard,
  PostExternalHazard,
} from 'shared-sdk/lib/api/TypedModelApiManager';
import { ApiManager } from 'shared-sdk/lib/api/ApiManager';
import { ExternalHazardsModelType } from 'shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel';
import { TypedModelJSON } from 'shared-types/src/lib/types/modelTypes/largeModels/typedModel';
import { UseGlobalStore } from '../Store';

/**
 * Load and set External Hazards for the current user.
 */
export const SetExternalHazards = async (): Promise<void> => {
  try {
    const externalHazardsList: ExternalHazardsModelType[] =
      await GetExternalHazards(ApiManager.getCurrentUser().user_id);
    UseGlobalStore.setState({
      ExternalHazards: externalHazardsList,
    });
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Create a new External Hazard and append it to the store.
 *
 * @param data - Partial typed model payload for creation.
 */
export const AddExternalHazard = async (
  data: Partial<TypedModelJSON>,
): Promise<void> => {
  try {
    const ehr: ExternalHazardsModelType = await PostExternalHazard(data);
    UseGlobalStore.setState((state) => ({
      ExternalHazards: [...state.ExternalHazards, ehr],
    }));
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Update an existing External Hazard and replace it in the store.
 *
 * @param modelId - External hazard id to update.
 * @param userId - Acting user id (audit/ownership).
 * @param data - Patch payload.
 */
export const EditExternalHazard = async (
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<void> => {
  try {
    const ehr: ExternalHazardsModelType = await PatchExternalHazard(
      modelId,
      userId,
      data,
    );
    UseGlobalStore.setState((state) => ({
      ExternalHazards: state.ExternalHazards.map(
        (eh: ExternalHazardsModelType) => {
          if (eh.id === modelId) {
            return ehr;
          } else {
            return eh;
          }
        },
      ),
    }));
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Delete an External Hazard and remove it from the store.
 *
 * @param id - External hazard id to delete.
 */
export const DeleteExternalHazard = async (id: number): Promise<void> => {
  try {
    await DeleteExternalHazardAPI(id);

    UseGlobalStore.setState((state) => ({
      ExternalHazards: state.ExternalHazards.filter(
        (eh: ExternalHazardsModelType) => eh.id !== id,
      ),
    }));
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};
