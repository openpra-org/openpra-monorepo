import {
  GetInitiatingEvents,
  PostInitiatingEvent,
  PatchInitiatingEventLabel,
  DeleteInitiatingEvent as DeleteInitiatingEventAPI,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { produce } from "immer";
import { StoreStateType, UseGlobalStore } from "../../Store";
import { AddToParentModel, GetTypedModelName, RemoveFromParentModel } from "../Helper";

export const SetInitiatingEvents = async (parentId: string): Promise<void> => {
  try {
    const InitiatingEvents = await GetInitiatingEvents(parentId);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.parentId = parentId;
        state.NestedModels.InitiatingEventsAnalysis.InitiatingEvents = InitiatingEvents;
      }),
    );
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

export const AddInitiatingEvent = async (data: NestedModelJSON): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    const InitiatingEvent: NestedModelType = await PostInitiatingEvent(data, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.InitiatingEventsAnalysis.InitiatingEvents.push(InitiatingEvent);

        state[typedModelName] = AddToParentModel(state, InitiatingEvent._id, InitiatingEvent.parentIds);
      }),
    );
  } catch (error) {
    console.error("Error adding initiating event:", error);
  }
};

export const EditInitiatingEvent = async (modelId: string, data: Partial<NestedModelJSON>): Promise<void> => {
  if (!data.label) {
    return;
  }

  try {
    const ier: NestedModelType = await PatchInitiatingEventLabel(modelId, data.label);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.InitiatingEventsAnalysis.InitiatingEvents =
          state.NestedModels.InitiatingEventsAnalysis.InitiatingEvents.map((ie: NestedModelType) =>
            ie._id === modelId ? ier : ie,
          );
      }),
    );
  } catch (error) {
    console.error("Error adding initiating event:", error);
  }
};

export const DeleteInitiatingEvent = async (id: string): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    await DeleteInitiatingEventAPI(id, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        const parentIds =
          state.NestedModels.InitiatingEventsAnalysis.InitiatingEvents.find((ie) => ie._id === id)?.parentIds ?? [];

        state.NestedModels.InitiatingEventsAnalysis.InitiatingEvents =
          state.NestedModels.InitiatingEventsAnalysis.InitiatingEvents.filter((ie: NestedModelType) => ie._id !== id);

        state[typedModelName] = RemoveFromParentModel(state, id, parentIds);
      }),
    );
  } catch (error) {
    console.error("Error deleting initiating event:", error);
  }
};
