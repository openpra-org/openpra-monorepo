import { StateCreator } from "zustand";
import { immer } from "zustand/middleware/immer";
import { SliceResetFns, StoreType } from "../Store";
import { NestedModelsState } from "./NestedModelsState";
import { NestedModelsTypes } from "./NestedModelsTypes";
import {
  AddInitiatingEvent,
  DeleteInitiatingEvent,
  EditInitiatingEvent,
  SetInitiatingEvents,
} from "./NestedModelsActions";

const NestedModelsSlice: StateCreator<
  StoreType,
  [],
  [["zustand/immer", never]],
  NestedModelsTypes
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
