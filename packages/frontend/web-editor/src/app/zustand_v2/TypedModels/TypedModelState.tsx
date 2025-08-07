import { TYPED_MODEL_NAMES } from "packages/shared-types/src/openpra-mef-types/api/TypedModelRequest";
import { TypedModelStateType } from "./TypedModelTypes";
import { TypedModel } from "packages/shared-types/src/openpra-mef-types/modelTypes/largeModels/TypedModel";

export const TypedModelState: TypedModelStateType = {
  typedModelName: TYPED_MODEL_NAMES.INTERNAL_EVENTS,
  typedModels: [] as TypedModel[],
};
