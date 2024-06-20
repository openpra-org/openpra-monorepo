import {
  GetEventSequenceAnalysis,
  PostEventSequenceAnalysis,
  PatchEventSequenceAnalysisLabel,
  DeleteEventSequenceAnalysis as DeleteEventSequenceAnalysisAPI,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { produce } from "immer";
import { StoreStateType, UseGlobalStore } from "../../Store";
import { AddToParentModel, GetTypedModelName, RemoveFromParentModel } from "../Helper";

export const SetEventSequenceAnalysis = async (parentId: string): Promise<void> => {
  try {
    const EventSequenceAnalysis = await GetEventSequenceAnalysis(parentId);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.parentId = parentId;
        state.NestedModels.EventSequenceAnalysis.EventSequenceAnalysisList = EventSequenceAnalysis;
      }),
    );
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

export const AddEventSequenceAnalysis = async (data: NestedModelJSON): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    const EventSequenceAnalysis: NestedModelType = await PostEventSequenceAnalysis(data, typedModelName);

    console.log(EventSequenceAnalysis)
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.EventSequenceAnalysis.EventSequenceAnalysisList.push(EventSequenceAnalysis);

        state[typedModelName] = AddToParentModel(state, EventSequenceAnalysis._id, EventSequenceAnalysis.parentIds);
      }),
    );
  } catch (error) {
    console.error("Error adding event sequence analysis:", error);
  }
};

export const EditEventSequenceAnalysis = async (modelId: string, data: Partial<NestedModelJSON>): Promise<void> => {
  if (!data.label) {
    return;
  }

  try {
    const esar: NestedModelType = await PatchEventSequenceAnalysisLabel(modelId, data.label);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.EventSequenceAnalysis.EventSequenceAnalysisList =
          state.NestedModels.EventSequenceAnalysis.EventSequenceAnalysisList.map((esa: NestedModelType) =>
            esa._id === modelId ? esar : esa,
          );
      }),
    );
  } catch (error) {
    console.error("Error editing event sequence analysis:", error);
  }
};

export const DeleteEventSequenceAnalysis = async (id: string): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    await DeleteEventSequenceAnalysisAPI(id, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        const parentIds =
          state.NestedModels.EventSequenceAnalysis.EventSequenceAnalysisList.find((esa) => esa._id === id)?.parentIds ??
          [];

        state.NestedModels.EventSequenceAnalysis.EventSequenceAnalysisList =
          state.NestedModels.EventSequenceAnalysis.EventSequenceAnalysisList.filter(
            (esa: NestedModelType) => esa._id !== id,
          );

        state[typedModelName] = RemoveFromParentModel(state, id, parentIds);
      }),
    );
  } catch (error) {
    console.error("Error deleting event sequence analysis:", error);
  }
};
