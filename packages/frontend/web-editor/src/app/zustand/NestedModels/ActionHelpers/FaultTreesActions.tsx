import {
  getFaultTrees,
  createFaultTree,
  updateFaultTreeMetadata,
  deleteFaultTree,
} from "shared-types/src/lib/api/NestedModelsAPI/FaultTreesApiManager";
import { FaultTree } from "shared-types/src/lib/api/NestedModelsAPI/FaultTreesApiManager";
import { produce } from "immer";
import { StoreStateType, UseGlobalStore } from "../../Store";
import { GenerateUUID } from "../../../../utils/treeUtils";
import { allToasts } from "../../../../utils/faultTreeData";

export const SetFaultTrees = async (
  modelId: string,
  addToast: (toast: any) => void
): Promise<void> => {
  try {
    const faultTrees = await getFaultTrees(modelId);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.modelId = modelId;
        state.NestedModels.SystemAnalysis.FaultTrees = faultTrees;
      }),
    );
  } catch (error) {
    addToast({
      id: GenerateUUID(),
      ...allToasts.find((t) => t.type === "error")!,
      title: "Failed to load fault trees",
      text: error instanceof Error ? error.message : String(error),
    });
  }
};

export const AddFaultTree = async (
  data: Omit<FaultTree, "id">,
  addToast: (toast: any) => void
): Promise<void> => {
  try {
    const faultTree: FaultTree = await createFaultTree(data);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.SystemAnalysis.FaultTrees.push(faultTree);
      }),
    );
  } catch (error) {
    addToast({
      id: GenerateUUID(),
      ...allToasts.find((t) => t.type === "error")!,
      title: "Failed to create fault tree",
      text: error instanceof Error ? error.message : String(error),
    });
  }
};

export const EditFaultTree = async (
  id: string,
  data: Partial<Pick<FaultTree, "name" | "description">>,
  addToast: (toast: any) => void
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
    addToast({
      id: GenerateUUID(),
      ...allToasts.find((t) => t.type === "error")!,
      title: "Failed to update fault tree",
      text: error instanceof Error ? error.message : String(error),
    });
  }
};

export const DeleteFaultTree = async (
  id: string,
  addToast: (toast: any) => void
): Promise<void> => {
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
    addToast({
      id: GenerateUUID(),
      ...allToasts.find((t) => t.type === "error")!,
      title: "Failed to delete fault tree",
      text: error instanceof Error ? error.message : String(error),
    });
  }
};