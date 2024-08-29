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
  } catch (error) {}
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
  } catch (error) {}
};

export const EditEventSequenceDiagram = async (modelId: string, data: Partial<NestedModelJSON>): Promise<void> => {
  if (!data.label) {
    return;
  }

  try {
    const esdr: NestedModelType = await PatchEventSequenceDiagramLabel(modelId, data.label);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams =
          state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams.map((esd: NestedModelType) =>
            esd._id === modelId ? esdr : esd,
          );
      }),
    );
  } catch (error) {}
};

export const DeleteEventSequenceDiagram = async (id: string): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    await DeleteEventSequenceDiagramAPI(id, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        const parentIds =
          state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams.find((esd) => esd._id === id)?.parentIds ?? [];

        state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams =
          state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams.filter(
            (esd: NestedModelType) => esd._id !== id,
          );

        state[typedModelName] = RemoveFromParentModel(state, id, parentIds);
      }),
    );
  } catch (error) {}
};
