import { StateCreator } from "zustand";
import { immer } from "zustand/middleware/immer";
import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
import { NestedModelsState } from "./NestedModelsState";
import { NestedModelActionsType, NestedModelsType } from "./NestedModelsType";
import {
  AddInitiatingEvent,
  DeleteInitiatingEvent,
  EditInitiatingEvent,
  SetInitiatingEvents,
} from "./NestedModelsActions";

const NestedModelsSlice: StateCreator<
  StoreStateType & StoreActionType,
  [],
  [["zustand/immer", never]],
  NestedModelsType & NestedModelActionsType
> = immer((set) => {
  SliceResetFns.add(() => {
    set(NestedModelsState);
  });
  return {
    NestedModels: NestedModelsState.NestedModels,
    SetInitiatingEvents: SetInitiatingEvents,
    AddInitiatingEvent: AddInitiatingEvent,
    EditInitiatingEvent: EditInitiatingEvent,
    DeleteInitiatingEvent: DeleteInitiatingEvent,
  };
});

export { NestedModelsSlice };
