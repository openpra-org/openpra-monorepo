import { InternalHazardsModelType } from 'shared-types/src/lib/types/modelTypes/largeModels/internalHazardsModel';

/**
 * Initial Zustand slice state for Internal Hazards models.
 * Holds the loaded list of InternalHazards for the current user/context.
 */
export const InternalHazardsState = {
  InternalHazards: [] as InternalHazardsModelType[],
};
