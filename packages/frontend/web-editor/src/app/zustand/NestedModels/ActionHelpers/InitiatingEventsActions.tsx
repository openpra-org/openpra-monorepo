import {
  GetInitiatingEvents,
  PostInitiatingEvent,
  PatchInitiatingEventLabel,
  DeleteInitiatingEvent as DeleteInitiatingEventApi,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { produce } from "immer";
import { typedModelType } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { StoreType, UseGlobalStore } from "../../Store";
import { NestedModelsTypes } from "../NestedModelsTypes";
import { GetTypedModelName } from "../Helper";

export const SetInitiatingEvents = async (parentId: string): Promise<void> => {
  try {
    const InitiatingEvents = await GetInitiatingEvents(parentId);
    UseGlobalStore.setState(
      produce((state: NestedModelsTypes) => {
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
    const typedModelName = GetTypedModelName();
    const InitiatingEvent: NestedModelType = await PostInitiatingEvent(data, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreType) => {
        state.NestedModels.InitiatingEventsAnalysis.InitiatingEvents.push(InitiatingEvent);

        UpdateTypedModel(state, typedModelName, InitiatingEvent.parentIds, InitiatingEvent._id, "post");
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
      produce((state: NestedModelsTypes) => {
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
    const typedModelName = GetTypedModelName();
    await DeleteInitiatingEventApi(id, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreType) => {
        const parentIds =
          state.NestedModels.InitiatingEventsAnalysis.InitiatingEvents.find((ie) => ie._id === id)?.parentIds ?? [];

        state.NestedModels.InitiatingEventsAnalysis.InitiatingEvents =
          state.NestedModels.InitiatingEventsAnalysis.InitiatingEvents.filter((ie: NestedModelType) => ie._id !== id);

        UpdateTypedModel(state, typedModelName, parentIds, id, "delete");
      }),
    );
  } catch (error) {
    console.error("Error deleting initiating event:", error);
  }
};

const UpdateTypedModel = (
  state: StoreType,
  typedModelName: string,
  parentIds: string[],
  id: string,
  method: "post" | "delete",
): void => {
  let OldState = null;

  switch (typedModelName) {
    case "internalEvents":
      OldState = state.internalEvents;
      break;
    case "internalHazards":
      OldState = state.internalHazards;
      break;
    case "externalHazards":
      OldState = state.externalHazards;
      break;
    case "fullScope":
      OldState = state.fullScope;
      break;
  }

  if (OldState && method === "post") {
    OldState = OldState.map((ie: typedModelType) => {
      if (parentIds.includes(ie._id)) {
        ie.initiatingEvents.push(id);
      }
      return ie;
    });
  }

  if (OldState && method === "delete") {
    OldState = OldState.map((tm: typedModelType) => {
      if (parentIds.includes(tm._id)) {
        return {
          ...tm,
          initiatingEvents: tm.initiatingEvents.filter((ie: string) => ie !== id),
        };
      } else {
        return tm;
      }
    });

    switch (typedModelName) {
      case "internalEvents":
        state.internalEvents = OldState;
        break;
      case "internalHazards":
        state.internalHazards = OldState;
        break;
      case "externalHazards":
        state.externalHazards = OldState;
        break;
      case "fullScope":
        OldState = state.fullScope = OldState;
        break;
    }
  }
};
