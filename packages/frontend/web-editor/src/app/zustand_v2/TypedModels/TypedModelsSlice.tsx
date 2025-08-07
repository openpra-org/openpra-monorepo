import { StateCreator } from "zustand";
import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
import { TypedModelActionsType, TypedModelStateType } from "./TypedModelTypes";
import { TypedModelState } from "./TypedModelState";
import { AddTypedModel, DeleteTypedModel, EditTypedModel, SetTypedModels } from "./TypedModelActions";

export const TypedModelsSlice: StateCreator<
  StoreStateType & StoreActionType,
  [],
  [],
  TypedModelStateType & TypedModelActionsType
> = (set) => {
  SliceResetFns.add(() => {
    set(TypedModelState);
  });
  return {
    typedModelName: TypedModelState.typedModelName,
    typedModels: TypedModelState.typedModels,
    SetTypedModels: SetTypedModels,
    AddTypedModel: AddTypedModel,
    EditTypedModel: EditTypedModel,
    DeleteTypedModel: DeleteTypedModel,
  };
};
