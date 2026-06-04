import {
  GetFaultTrees,
  PostFaultTree,
  PatchFaultTreeLabel,
  DeleteFaultTree as DeleteFaultTreeAPI,
} from "shared-sdk/lib/api/NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { produce } from "immer";
import { StoreStateType, UseGlobalStore } from "../../Store";
import { GetTypedModelName } from "../Helper";
export const SetFaultTrees = async (parentId: string): Promise<void> => {
  try {
    const FaultTrees = await GetFaultTrees(parentId);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.parentId = parentId;
        state.NestedModels.SystemAnalysis.FaultTrees = FaultTrees;
      }),
    );
  } catch (_error: unknown) {}
};
export const AddFaultTree = async (data: NestedModelJSON): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    const FaultTree: NestedModelType = await PostFaultTree(data, typedModelName);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.SystemAnalysis.FaultTrees.push(FaultTree);
      }),
    );
  } catch (_error: unknown) {}
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
  } catch (_error: unknown) {}
};
export const DeleteFaultTree = async (id: string): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    await DeleteFaultTreeAPI(id, typedModelName);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.SystemAnalysis.FaultTrees = state.NestedModels.SystemAnalysis.FaultTrees.filter(
          (ft: NestedModelType) => ft._id !== id,
        );
      }),
    );
  } catch (_error: unknown) {}
};
