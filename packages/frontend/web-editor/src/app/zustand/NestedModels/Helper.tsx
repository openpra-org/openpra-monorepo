import { GetCurrentModelType } from 'shared-sdk/lib/api/TypedModelApiManager';
import { produce } from 'immer';
import { typedModelType } from 'packages/shared-types/src/lib/types/modelTypes/largeModels/typedModel';
import { GetCurrentNestedModelType } from 'shared-sdk/lib/api/NestedModelApiManager';
import { StoreStateType } from '../Store';

/**
 * Allowed typed-model slice names in the global store.
 */
export type TypedModelNames =
  | 'InternalEvents'
  | 'InternalHazards'
  | 'ExternalHazards'
  | 'FullScope';
/**
 * Allowed nested-model collection names in the global store.
 */
export type NestedModelNames =
  | 'initiatingEvents'
  | 'eventSequenceDiagrams'
  | 'eventSequenceAnalysis'
  | 'eventTrees'
  | 'bayesianNetworks'
  | 'faultTrees';

/**
 * Resolves the currently active typed-model slice name from API context.
 */
export const GetTypedModelName = (): TypedModelNames => {
  const typedModel = GetCurrentModelType();

  switch (typedModel) {
    case 'internal-events':
      return 'InternalEvents';
    case 'internal-hazards':
      return 'InternalHazards';
    case 'external-hazards':
      return 'ExternalHazards';
    case 'full-scope':
      return 'FullScope';
  }

  return 'InternalEvents';
};

/**
 * Resolves the currently active nested-model collection name from API context.
 */
export const GetNestedModelName = (): NestedModelNames => {
  const nestedModel = GetCurrentNestedModelType();

  switch (nestedModel) {
    case 'initiating-events':
      return 'initiatingEvents';
    case 'event-sequence-diagrams':
      return 'eventSequenceDiagrams';
    case 'event-sequence-analysis':
      return 'eventSequenceAnalysis';
    case 'event-trees':
      return 'eventTrees';
    case 'bayesian-networks':
      return 'bayesianNetworks';
    case 'fault-trees':
      return 'faultTrees';
  }

  return 'initiatingEvents';
};

/**
 * Adds a nested model id to all parent typed models that reference it.
 * @param state - The current global store state
 * @param nestedModelId - The nested model identifier to add
 * @param parentIds - List of parent typed model ids
 */
export const AddToParentModel = (
  state: StoreStateType,
  nestedModelId: string,
  parentIds: string[],
): typedModelType[] => {
  const typedModelName: keyof StoreStateType = GetTypedModelName();
  const nestedModelName: keyof typedModelType = GetNestedModelName();

  return state[typedModelName].map(
    produce((tm: typedModelType) => {
      if (parentIds.includes(tm._id)) {
        tm[nestedModelName].push(nestedModelId);
      }
    }),
  );
};

/**
 * Removes a nested model id from all parent typed models that reference it.
 * @param state - The current global store state
 * @param nestedModelId - The nested model identifier to remove
 * @param parentIds - List of parent typed model ids
 */
export const RemoveFromParentModel = (
  state: StoreStateType,
  nestedModelId: string,
  parentIds: string[],
): typedModelType[] => {
  const typedModelName: keyof StoreStateType = GetTypedModelName();
  const nestedModelName: keyof typedModelType = GetNestedModelName();

  return state[typedModelName].map(
    produce((tm: typedModelType) => {
      if (parentIds.includes(tm._id)) {
        tm[nestedModelName] = tm[nestedModelName].filter(
          (ie: string) => ie !== nestedModelId,
        );
      }
    }),
  );
};
