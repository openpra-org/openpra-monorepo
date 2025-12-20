import {
  DeleteInternalEvent as DeleteInternalEventAPI,
  GetInternalEvents,
  PatchInternalEvent,
  PostInternalEvent,
} from 'shared-sdk/lib/api/TypedModelApiManager';
import { ApiManager } from 'shared-sdk/lib/api/ApiManager';
import { InternalEventsModelType } from 'shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel';
import { TypedModelJSON } from 'shared-types/src/lib/types/modelTypes/largeModels/typedModel';
import { UseGlobalStore } from '../Store';

/**
 * Load and set Internal Events for the current user.
 */
export const SetInternalEvents = async (): Promise<void> => {
  try {
    const internalEventsList: InternalEventsModelType[] =
      await GetInternalEvents(ApiManager.getCurrentUser().user_id);
    UseGlobalStore.setState({
      InternalEvents: internalEventsList,
    });
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Create a new Internal Event and append it to the store.
 *
 * @param data - Partial typed model payload for creation.
 */
export const AddInternalEvent = async (
  data: Partial<TypedModelJSON>,
): Promise<void> => {
  try {
    const ier: InternalEventsModelType = await PostInternalEvent(data);
    UseGlobalStore.setState((state) => ({
      InternalEvents: [...state.InternalEvents, ier],
    }));
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Update an Internal Event and replace it in the store.
 *
 * @param modelId - Internal event id to update.
 * @param userId - Acting user id (audit/ownership).
 * @param data - Patch payload.
 */
export const EditInternalEvent = async (
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<void> => {
  try {
    const ier: InternalEventsModelType = await PatchInternalEvent(
      modelId,
      userId,
      data,
    );
    UseGlobalStore.setState((state) => ({
      InternalEvents: state.InternalEvents.map(
        (ie: InternalEventsModelType) => {
          if (ie.id === modelId) {
            return ier;
          } else {
            return ie;
          }
        },
      ),
    }));
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Delete an Internal Event and remove it from the store.
 *
 * @param id - Internal event id to delete.
 */
export const DeleteInternalEvent = async (id: number): Promise<void> => {
  try {
    await DeleteInternalEventAPI(id);

    UseGlobalStore.setState((state) => ({
      InternalEvents: state.InternalEvents.filter(
        (ie: InternalEventsModelType) => ie.id !== id,
      ),
    }));
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};
