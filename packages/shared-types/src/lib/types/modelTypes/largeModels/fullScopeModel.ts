import TypedModel, { typedModelType } from "./typedModel";

/**
 * full scope models do what a typed model does and nothing else
 */
export class FullScopeModel extends TypedModel {}

export type FullScopeModelType = typedModelType;
