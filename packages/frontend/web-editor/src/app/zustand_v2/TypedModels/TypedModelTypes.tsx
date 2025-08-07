import { Label } from "packages/shared-types/src/openpra-mef-types/modelTypes/Label";
import { TypedModel } from "packages/shared-types/src/openpra-mef-types/modelTypes/largeModels/TypedModel";
import { TypedModelName } from "shared-types/src/openpra-mef-types/api/TypedModelRequest";

export interface TypedModelStateType {
  typedModelName: TypedModelName;
  typedModels: TypedModel[];
}

export interface TypedModelActionsType {
  SetTypedModels: (typedModelName: TypedModelName) => Promise<void>;
  AddTypedModel: (typedModelName: TypedModelName, label: Label) => Promise<void>;
  EditTypedModel: (modelId: string, typedModelName: TypedModelName, typedModel: Partial<TypedModel>) => Promise<void>;
  DeleteTypedModel: (modelId: string, typedModelName: TypedModelName) => Promise<void>;
}
