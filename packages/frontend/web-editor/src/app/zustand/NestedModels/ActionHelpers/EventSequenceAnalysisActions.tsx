import {
  GetEventSequenceAnalysis,
  PostEventSequenceAnalysis,
  PatchEventSequenceAnalysisLabel,
  DeleteEventSequenceAnalysis as DeleteEventSequenceAnalysisAPI,
} from 'shared-sdk/lib/api/NestedModelApiManager';
import {
  NestedModelJSON,
  NestedModelType,
} from 'shared-types/src/lib/types/modelTypes/innerModels/nestedModel';
import { produce } from 'immer';
import { StoreStateType, UseGlobalStore } from '../../Store';
import {
  AddToParentModel,
  GetTypedModelName,
  RemoveFromParentModel,
} from '../Helper';

/**
 * Fetches Event Sequence Analysis items for a given parent and updates store state.
 * @param parentId - The parent model identifier
 */
export const SetEventSequenceAnalysis = async (
  parentId: string,
): Promise<void> => {
  try {
    const EventSequenceAnalysis = await GetEventSequenceAnalysis(parentId);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.parentId = parentId;
        state.NestedModels.EventSequenceAnalysis.EventSequenceAnalysisList =
          EventSequenceAnalysis;
      }),
    );
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Creates a new Event Sequence Analysis item and links it to its parent models in state.
 * @param data - New model payload
 */
export const AddEventSequenceAnalysis = async (
  data: NestedModelJSON,
): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    const EventSequenceAnalysis: NestedModelType =
      await PostEventSequenceAnalysis(data, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.EventSequenceAnalysis.EventSequenceAnalysisList.push(
          EventSequenceAnalysis,
        );

        state[typedModelName] = AddToParentModel(
          state,
          EventSequenceAnalysis._id,
          EventSequenceAnalysis.parentIds,
        );
      }),
    );
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Updates the label of an Event Sequence Analysis item.
 * @param modelId - Target model id
 * @param data - Partial payload containing the new label
 */
export const EditEventSequenceAnalysis = async (
  modelId: string,
  data: Partial<NestedModelJSON>,
): Promise<void> => {
  if (!data.label) {
    return;
  }

  try {
    const esar: NestedModelType = await PatchEventSequenceAnalysisLabel(
      modelId,
      data.label,
    );
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.EventSequenceAnalysis.EventSequenceAnalysisList =
          state.NestedModels.EventSequenceAnalysis.EventSequenceAnalysisList.map(
            (esa: NestedModelType) => (esa._id === modelId ? esar : esa),
          );
      }),
    );
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};

/**
 * Deletes an Event Sequence Analysis item and removes cross-references from parent models.
 * @param id - Target model id
 */
export const DeleteEventSequenceAnalysis = async (
  id: string,
): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    await DeleteEventSequenceAnalysisAPI(id, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        const parentIds =
          state.NestedModels.EventSequenceAnalysis.EventSequenceAnalysisList.find(
            (esa) => esa._id === id,
          )?.parentIds ?? [];

        state.NestedModels.EventSequenceAnalysis.EventSequenceAnalysisList =
          state.NestedModels.EventSequenceAnalysis.EventSequenceAnalysisList.filter(
            (esa: NestedModelType) => esa._id !== id,
          );

        state[typedModelName] = RemoveFromParentModel(state, id, parentIds);
      }),
    );
  } catch (_error: unknown) {
    // Intentionally ignore: state remains unchanged on failure
  }
};
