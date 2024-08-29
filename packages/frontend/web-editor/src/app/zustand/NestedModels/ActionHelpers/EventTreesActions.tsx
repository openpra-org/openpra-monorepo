import {
  GetEventTrees,
  PostEventTree,
  PatchEventTreeLabel,
  DeleteEventTree as DeleteEventTreeAPI,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { produce } from "immer";
import { StoreStateType, UseGlobalStore } from "../../Store";
import { AddToParentModel, GetTypedModelName, RemoveFromParentModel } from "../Helper";

export const SetEventTrees = async (parentId: string): Promise<void> => {
  try {
    const EventTrees = await GetEventTrees(parentId);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.parentId = parentId;
        state.NestedModels.EventSequenceAnalysis.EventTrees = EventTrees;
      }),
    );
  } catch (error) {}
};

export const AddEventTree = async (data: NestedModelJSON): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    const EventTree: NestedModelType = await PostEventTree(data, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.EventSequenceAnalysis.EventTrees.push(EventTree);

        state[typedModelName] = AddToParentModel(state, EventTree._id, EventTree.parentIds);
      }),
    );
  } catch (error) {}
};

export const EditEventTree = async (modelId: string, data: Partial<NestedModelJSON>): Promise<void> => {
  if (!data.label) {
    return;
  }

  try {
    const etr: NestedModelType = await PatchEventTreeLabel(modelId, data.label);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.EventSequenceAnalysis.EventTrees = state.NestedModels.EventSequenceAnalysis.EventTrees.map(
          (et: NestedModelType) => (et._id === modelId ? etr : et),
        );
      }),
    );
  } catch (error) {}
};

export const DeleteEventTree = async (id: string): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    await DeleteEventTreeAPI(id, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        const parentIds =
          state.NestedModels.EventSequenceAnalysis.EventTrees.find((et) => et._id === id)?.parentIds ?? [];

        state.NestedModels.EventSequenceAnalysis.EventTrees =
          state.NestedModels.EventSequenceAnalysis.EventTrees.filter((et: NestedModelType) => et._id !== id);

        state[typedModelName] = RemoveFromParentModel(state, id, parentIds);
      }),
    );
  } catch (error) {}
};
