import TypedModel, { typedModelType } from './typedModel';

/**
 * full scope models do what a typed model does and nothing else
 */
export class FullScopeModel extends TypedModel {}

/** Persisted document shape for a Full Scope model. */
export type FullScopeModelType = typedModelType;
