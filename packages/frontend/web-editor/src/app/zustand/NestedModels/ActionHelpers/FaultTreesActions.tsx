import {
  GetFaultTrees,
  PostFaultTree,
  PatchFaultTreeLabel,
  DeleteFaultTree as DeleteFaultTreeAPI,
} from "shared-sdk/lib/api/NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { produce } from "immer";
import { StoreStateType, UseGlobalStore } from "../../Store";
import { AddToParentModel, GetTypedModelName, RemoveFromParentModel } from "../Helper";

export const SetFaultTrees = async (parentId: string): Promise<void> => {
  try {
    const FaultTrees = await GetFaultTrees(parentId);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.parentId = parentId;
        state.NestedModels.SystemAnalysis.FaultTrees = FaultTrees;
      }),
    );
  } catch (error) {}
};

export const AddFaultTree = async (data: NestedModelJSON): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    const FaultTree: NestedModelType = await PostFaultTree(data, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.SystemAnalysis.FaultTrees.push(FaultTree);

        state[typedModelName] = AddToParentModel(state, FaultTree._id, FaultTree.parentIds);
      }),
    );
  } catch (error) {}
};

export const EditFaultTree = async (modelId: string, data: Partial<NestedModelJSON>): Promise<void> => {
  if (!data.label) {
    return;
  }

  try {
    const ftr: NestedModelType = await PatchFaultTreeLabel(modelId, data.label);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.SystemAnalysis.FaultTrees = state.NestedModels.SystemAnalysis.FaultTrees.map(
          (ft: NestedModelType) => (ft._id === modelId ? ftr : ft),
        );
      }),
    );
  } catch (error) {}
};

export const DeleteFaultTree = async (id: string): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    await DeleteFaultTreeAPI(id, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        const parentIds = state.NestedModels.SystemAnalysis.FaultTrees.find((ft) => ft._id === id)?.parentIds ?? [];

        state.NestedModels.SystemAnalysis.FaultTrees = state.NestedModels.SystemAnalysis.FaultTrees.filter(
          (ft: NestedModelType) => ft._id !== id,
        );

        state[typedModelName] = RemoveFromParentModel(state, id, parentIds);
      }),
    );
  } catch (error) {}
};
