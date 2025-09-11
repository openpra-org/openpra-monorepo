import {
  getFaultTrees,
  createFaultTree,
  updateFaultTreeMetadata,
  deleteFaultTree,
} from "shared-types/src/lib/api/NestedModelsAPI/FaultTreesApiManager";
import { FaultTree } from "shared-types/src/lib/api/NestedModelsAPI/FaultTreesApiManager";
import { produce } from "immer";
import { StoreStateType, UseGlobalStore } from "../../Store";

export const SetFaultTrees = async (modelId: string): Promise<void> => {
  try {
    const faultTrees = await getFaultTrees(modelId);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.modelId = modelId;
        state.NestedModels.SystemAnalysis.FaultTrees = faultTrees;
      }),
    );
  } catch (error) {
    console.error("Failed to load fault trees:", error);
  }
};

export const AddFaultTree = async (data: Omit<FaultTree, "id">): Promise<void> => {
  try {
    const faultTree: FaultTree = await createFaultTree(data);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.SystemAnalysis.FaultTrees.push(faultTree);
      }),
    );
  } catch (error) {
    console.error("Failed to create fault tree:", error);
  }
};

export const EditFaultTree = async (
  id: string,
  data: Partial<Pick<FaultTree, "name" | "description">>
): Promise<void> => {
  try {
    const updatedTree: FaultTree = await updateFaultTreeMetadata(id, data);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.SystemAnalysis.FaultTrees = state.NestedModels.SystemAnalysis.FaultTrees.map(
          (ft: FaultTree) => (ft.id === id ? updatedTree : ft),
        );
      }),
    );
  } catch (error) {
    console.error("Failed to update fault tree:", error);
  }
};

export const DeleteFaultTree = async (id: string): Promise<void> => {
  try {
    await deleteFaultTree(id);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.SystemAnalysis.FaultTrees = state.NestedModels.SystemAnalysis.FaultTrees.filter(
          (ft: FaultTree) => ft.id !== id,
        );
      }),
    );
  } catch (error) {
    console.error("Failed to delete fault tree:", error);
  }
};