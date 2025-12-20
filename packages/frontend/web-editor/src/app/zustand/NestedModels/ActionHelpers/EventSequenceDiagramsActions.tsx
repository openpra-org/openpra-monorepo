import {
  GetEventSequenceDiagrams,
  PostEventSequenceDiagram,
  PatchEventSequenceDiagramLabel,
  DeleteEventSequenceDiagram as DeleteEventSequenceDiagramAPI,
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
 * Fetches Event Sequence Diagrams for a given parent and updates store state.
 * @param parentId - The parent model identifier
 */
export const SetEventSequenceDiagrams = async (
  parentId: string,
): Promise<void> => {
  try {
    const EventSequenceDiagrams = await GetEventSequenceDiagrams(parentId);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.parentId = parentId;
        state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams =
          EventSequenceDiagrams;
      }),
    );
  } catch (_error: unknown) {
    // Intentionally ignore: no local state impact on failure
  }
};

/**
 * Creates a new Event Sequence Diagram and links it to its parent models in state.
 * @param data - New model payload
 */
export const AddEventSequenceDiagram = async (
  data: NestedModelJSON,
): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    const EventSequenceDiagram: NestedModelType =
      await PostEventSequenceDiagram(data, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams.push(
          EventSequenceDiagram,
        );

        state[typedModelName] = AddToParentModel(
          state,
          EventSequenceDiagram._id,
          EventSequenceDiagram.parentIds,
        );
      }),
    );
  } catch (_error: unknown) {
    // Intentionally ignore: no local state impact on failure
  }
};

/**
 * Updates the label of an Event Sequence Diagram.
 * @param modelId - Target model id
 * @param data - Partial payload containing the new label
 */
export const EditEventSequenceDiagram = async (
  modelId: string,
  data: Partial<NestedModelJSON>,
): Promise<void> => {
  if (!data.label) {
    return;
  }

  try {
    const esdr: NestedModelType = await PatchEventSequenceDiagramLabel(
      modelId,
      data.label,
    );
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams =
          state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams.map(
            (esd: NestedModelType) => (esd._id === modelId ? esdr : esd),
          );
      }),
    );
  } catch (_error: unknown) {
    // Intentionally ignore: no local state impact on failure
  }
};

/**
 * Deletes an Event Sequence Diagram and removes cross-references from parent models.
 * @param id - Target model id
 */
export const DeleteEventSequenceDiagram = async (id: string): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    await DeleteEventSequenceDiagramAPI(id, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        const parentIds =
          state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams.find(
            (esd) => esd._id === id,
          )?.parentIds ?? [];

        state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams =
          state.NestedModels.EventSequenceAnalysis.EventSequenceDiagrams.filter(
            (esd: NestedModelType) => esd._id !== id,
          );

        state[typedModelName] = RemoveFromParentModel(state, id, parentIds);
      }),
    );
  } catch (_error: unknown) {
    // Intentionally ignore: no local state impact on failure
  }
};
