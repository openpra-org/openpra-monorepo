import { Label } from "../modelTypes/Label";
import { TypedModel } from "../modelTypes/largeModels/TypedModel";
import { NestedModelName } from "./NestedModelRequests";
import { TYPED_MODEL_NAMES } from "./Constants";

export type TypedModelName = (typeof TYPED_MODEL_NAMES)[keyof typeof TYPED_MODEL_NAMES];

export type TypedModelGetRequest = {
  typedModelName: TypedModelName;
  userId: number;
};

export type TypedModelPostRequest = {
  typedModelName: TypedModelName;
  label: Label;
  users: number[];
};

export type TypedModelPatchRequest = {
  typedModelName: TypedModelName;
  typedModel: Partial<TypedModel>;
  userId: number;
};

export type TypedModelNestedPatchRequest = {
  typedModelName: TypedModelName;
  nestedModelId: string;
  nestedModelType: NestedModelName;
  userId: number;
};

export type TypedModelDeleteRequest = {
  typedModelName: TypedModelName;
  userId: number;
};

export type TypedModelNestedDeleteRequest = TypedModelNestedPatchRequest;
