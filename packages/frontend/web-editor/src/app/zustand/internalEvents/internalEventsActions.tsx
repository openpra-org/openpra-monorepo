import {
  DeleteInternalEvent,
  GetInternalEvents,
  PatchInternalEvent,
  PostInternalEvent,
} from "shared-types/src/lib/api/TypedModelApiManager";
import ApiManager from "shared-types/src/lib/api/ApiManager";
import { InternalEventsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { UseGlobalStore } from "../Store";

export const setInternalEvents = async (): Promise<void> => {
  try {
    const internalEventsList: InternalEventsModelType[] = await GetInternalEvents(ApiManager.getCurrentUser().user_id);
    UseGlobalStore.setState({
      internalEvents: internalEventsList,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

export const addInternalEvent = async (data: Partial<TypedModelJSON>): Promise<void> => {
  try {
    const ier: InternalEventsModelType = await PostInternalEvent(data);
    UseGlobalStore.setState((state) => ({
      internalEvents: [...state.internalEvents, ier],
    }));
  } catch (error) {
    console.error("Error adding internal event:", error);
  }
};

export const editInternalEvent = async (
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<void> => {
  try {
    const ier: InternalEventsModelType = await PatchInternalEvent(modelId, userId, data);
    UseGlobalStore.setState((state) => ({
      internalEvents: state.internalEvents.map((ie: InternalEventsModelType) => {
        if (ie.id === modelId) {
          return ier;
        } else {
          return ie;
        }
      }),
    }));
  } catch (error) {
    console.error("Error adding internal event:", error);
  }
};

export const deleteInternalEvent = async (id: number): Promise<void> => {
  try {
    await DeleteInternalEvent(id);

    UseGlobalStore.setState((state) => ({
      internalEvents: state.internalEvents.filter((ie: InternalEventsModelType) => ie.id !== id),
    }));
  } catch (error) {
    console.error("Error deleting internal event:", error);
  }
};
