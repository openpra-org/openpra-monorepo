import {
  GetEventSequenceDiagrams,
  PostEventSequenceDiagram,
  PatchEventSequenceDiagramLabel,
  DeleteEventSequenceDiagram as DeleteEventSequenceDiagramAPI,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { produce } from "immer";
import { StoreStateType, UseGlobalStore } from "../../Store";
import { AddToParentModel, GetTypedModelName, RemoveFromParentModel } from "../Helper";

export const SetEventSequenceDiagrams = async (parentId: string): Promise<void> => {
  try {
    const EventSequenceDiagrams = await GetEventSequenceDiagrams(parentId);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.parentId = parentId;
        state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams = EventSequenceDiagrams;
      }),
    );
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

export const AddEventSequenceDiagram = async (data: NestedModelJSON): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    const EventSequenceDiagram: NestedModelType = await PostEventSequenceDiagram(data, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams.push(EventSequenceDiagram);

        state[typedModelName] = AddToParentModel(state, EventSequenceDiagram._id, EventSequenceDiagram.parentIds);
      }),
    );
  } catch (error) {
    console.error("Error adding initiating event:", error);
  }
};

export const EditEventSequenceDiagram = async (modelId: string, data: Partial<NestedModelJSON>): Promise<void> => {
  if (!data.label) {
    return;
  }

  try {
    const ier: NestedModelType = await PatchEventSequenceDiagramLabel(modelId, data.label);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams =
          state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams.map((ie: NestedModelType) =>
            ie._id === modelId ? ier : ie,
          );
      }),
    );
  } catch (error) {
    console.error("Error adding initiating event:", error);
  }
};

export const DeleteEventSequenceDiagram = async (id: string): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    await DeleteEventSequenceDiagramAPI(id, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        const parentIds =
          state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams.find((ie) => ie._id === id)?.parentIds ?? [];

        state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams =
          state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams.filter((ie: NestedModelType) => ie._id !== id);

        state[typedModelName] = RemoveFromParentModel(state, id, parentIds);
      }),
    );
  } catch (error) {
    console.error("Error deleting initiating event:", error);
  }
};
