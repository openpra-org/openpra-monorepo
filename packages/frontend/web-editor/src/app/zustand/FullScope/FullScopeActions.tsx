import {
  DeleteFullScope as DeleteFullScopeAPI,
  GetFullScopeModels,
  PatchFullScope,
  PostFullScope,
} from 'shared-sdk/lib/api/TypedModelApiManager';
import { ApiManager } from 'shared-sdk/lib/api/ApiManager';
import { FullScopeModelType } from 'shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel';
import { TypedModelJSON } from 'shared-types/src/lib/types/modelTypes/largeModels/typedModel';
import { UseGlobalStore } from '../Store';

/**
 * Loads all Full Scope models for the current user into the store.
 */
export const SetFullScope = async (): Promise<void> => {
  try {
    const fullScopeList: FullScopeModelType[] = await GetFullScopeModels(
      ApiManager.getCurrentUser().user_id,
    );
    UseGlobalStore.setState({
      FullScope: fullScopeList,
    });
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Creates a new Full Scope model and appends it to the store.
 * @param data - Partial model payload
 */
export const AddFullScope = async (
  data: Partial<TypedModelJSON>,
): Promise<void> => {
  try {
    const fsr: FullScopeModelType = await PostFullScope(data);
    UseGlobalStore.setState((state) => ({
      FullScope: [...state.FullScope, fsr],
    }));
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Updates a Full Scope model.
 * @param modelId - Model identifier
 * @param userId - Current user id
 * @param data - Partial update payload
 */
export const EditFullScope = async (
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<void> => {
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
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Deletes a Full Scope model.
 * @param id - Model identifier
 */
export const DeleteFullScope = async (id: number): Promise<void> => {
  try {
    await DeleteFullScopeAPI(id);

    UseGlobalStore.setState((state) => ({
      FullScope: state.FullScope.filter(
        (fs: FullScopeModelType) => fs.id !== id,
      ),
    }));
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};
