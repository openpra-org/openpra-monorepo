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

/**
 * Load and set Fault Trees for a given parent typed model id.
 *
 * @param parentId - Typed model id owning the Fault Trees collection.
 */
export const SetFaultTrees = async (parentId: string): Promise<void> => {
  try {
    const FaultTrees = await GetFaultTrees(parentId);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.parentId = parentId;
        state.NestedModels.SystemAnalysis.FaultTrees = FaultTrees;
      }),
    );
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Create a Fault Tree under the current typed model and update store links.
 *
 * @param data - Fault tree create payload.
 */
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
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Patch a Fault Tree's label and update it in the store.
 *
 * @param modelId - Fault tree id to update.
 * @param data - Patch payload; `label` is required.
 */
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
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Delete a Fault Tree and unlink it from its parents in the store.
 *
 * @param id - Fault tree id to delete.
 */
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
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};
