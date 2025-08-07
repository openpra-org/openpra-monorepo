import { StringID } from "../modelTypes/BasicModel";
import { Label } from "../modelTypes/Label";
import { TypedModel } from "../modelTypes/largeModels/TypedModel";
import { NestedModelName } from "./NestedModelRequests";

export const TYPED_MODEL_NAMES = {
  INTERNAL_EVENTS: "internal-events",
  INTERNAL_HAZARDS: "internal-hazards",
  EXTERNAL_HAZARDS: "external-hazards",
  FULL_SCOPE: "full-scope",
} as const;

export type TypedModelName = (typeof TYPED_MODEL_NAMES)[keyof typeof TYPED_MODEL_NAMES];

export type TypedModelGetRequest = {
  typeName: TypedModelName;
  userId: StringID;
};

export type TypedModelPostRequest = {
  typeName: TypedModelName;
  label: Label;
  users: StringID[];
};

export type TypedModelPatchRequest = {
  typeName: TypedModelName;
  typedModel: Partial<TypedModel>;
  userId: StringID;
};

export type TypedModelNestedPatchRequest = {
  typeName: TypedModelName;
  nestedModelId: StringID;
  nestedModelType: NestedModelName;
  userId: StringID;
};

export type TypedModelDeleteRequest = {
  typeName: TypedModelName;
  userId: StringID;
};

export type TypedModelNestedDeleteRequest = TypedModelNestedPatchRequest;
