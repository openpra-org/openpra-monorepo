import {
  DeleteInternalEvent as DeleteInternalEventAPI,
  GetInternalEvents,
  PatchInternalEvent,
  PostInternalEvent,
} from "shared-sdk/lib/api/TypedModelApiManager";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";
import { InternalEventsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { UseGlobalStore } from "../Store";

export const SetInternalEvents = async (): Promise<void> => {
  try {
    const internalEventsList: InternalEventsModelType[] = await GetInternalEvents(ApiManager.getCurrentUser().user_id);
    UseGlobalStore.setState({
      InternalEvents: internalEventsList,
    });
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

export const AddInternalEvent = async (data: Partial<TypedModelJSON>): Promise<void> => {
  try {
    const ier: InternalEventsModelType = await PostInternalEvent(data);
    UseGlobalStore.setState((state) => ({
      InternalEvents: [...state.InternalEvents, ier],
    }));
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

export const EditInternalEvent = async (
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<void> => {
  try {
    const ier: InternalEventsModelType = await PatchInternalEvent(modelId, userId, data);
    UseGlobalStore.setState((state) => ({
      InternalEvents: state.InternalEvents.map((ie: InternalEventsModelType) => {
        if (ie.id === modelId) {
          return ier;
        } else {
          return ie;
        }
      }),
    }));
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

export const DeleteInternalEvent = async (id: number): Promise<void> => {
  try {
    await DeleteInternalEventAPI(id);

    UseGlobalStore.setState((state) => ({
      InternalEvents: state.InternalEvents.filter((ie: InternalEventsModelType) => ie.id !== id),
    }));
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};
