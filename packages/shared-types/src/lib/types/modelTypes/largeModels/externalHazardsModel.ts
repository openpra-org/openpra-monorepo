import TypedModel, { typedModelType } from './typedModel';

/**
 * external hazards models do the same thing as a typed model
 */
export class ExternalHazardsModel extends TypedModel {}

/** Persisted document shape for an External Hazards model. */
export type ExternalHazardsModelType = typedModelType;
