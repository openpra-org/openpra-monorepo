import TypedModel, { typedModelType } from './typedModel';

/**
 * internal hazards models do the same things as a typed model
 */
export class InternalHazardsModel extends TypedModel {}

/** Persisted document shape for an Internal Hazards model. */
export type InternalHazardsModelType = typedModelType;
