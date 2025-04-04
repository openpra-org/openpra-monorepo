import {
  GetMasterLogicDiagrams,
  PostMasterLogicDiagram,
  PatchMasterlogicDiagramLabel,
  DeleteMasterLogicDiagram as DeleteMasterLogicDiagramAPI,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { produce } from "immer";
import { StoreStateType, UseGlobalStore } from "../../Store";
import { AddToParentModel, GetTypedModelName, RemoveFromParentModel } from "../Helper";

export const SetMasterLogicDiagrams = async (parentId: string): Promise<void> => {
  try {
    const MasterLogicDiagrams = await GetMasterLogicDiagrams(parentId);
    console.log(MasterLogicDiagrams);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.parentId = parentId;
        state.NestedModels.InitiatingEventsAnalysis.MasterLogicDiagrams = MasterLogicDiagrams;
      }),
    );
  } catch (error) {}
};

export const AddMasterLogicDiagram = async (data: NestedModelJSON): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    console.log(data, typedModelName);
    const MasterLogicDiagram: NestedModelType = await PostMasterLogicDiagram(data, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.InitiatingEventsAnalysis.MasterLogicDiagrams.push(MasterLogicDiagram);

        state[typedModelName] = AddToParentModel(state, MasterLogicDiagram._id, MasterLogicDiagram.parentIds);
      }),
    );
  } catch (error) {}
};

export const EditMasterLogicDiagram = async (modelId: string, data: Partial<NestedModelJSON>): Promise<void> => {
  if (!data.label) {
    return;
  }

  try {
    const ier: NestedModelType = await PatchMasterlogicDiagramLabel(modelId, data.label);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.InitiatingEventsAnalysis.MasterLogicDiagrams =
          state.NestedModels.InitiatingEventsAnalysis.MasterLogicDiagrams.map((ie: NestedModelType) =>
            ie._id === modelId ? ier : ie,
          );
      }),
    );
  } catch (error) {}
};

export const DeleteMasterLogicDiagram = async (id: string): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    await DeleteMasterLogicDiagramAPI(id, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        const parentIds =
          state.NestedModels.InitiatingEventsAnalysis.MasterLogicDiagrams.find((ie) => ie._id === id)?.parentIds ?? [];

        state.NestedModels.InitiatingEventsAnalysis.MasterLogicDiagrams =
          state.NestedModels.InitiatingEventsAnalysis.MasterLogicDiagrams.filter(
            (ie: NestedModelType) => ie._id !== id,
          );

        state[typedModelName] = RemoveFromParentModel(state, id, parentIds);
      }),
    );
  } catch (error) {}
};
