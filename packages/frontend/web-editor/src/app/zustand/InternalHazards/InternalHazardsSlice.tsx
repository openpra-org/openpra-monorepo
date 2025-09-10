import { StateCreator } from "zustand";
import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
import { InternalHazardsActionsType, InternalHazardsType } from "./InternalHazardsType";
import {
  AddInternalHazard,
  DeleteInternalHazard,
  EditInternalHazard,
  SetInternalHazards,
} from "./InternalHazardsActions";
import { InternalHazardsState } from "./InternalHazardsState";

const InternalHazardsSlice: StateCreator<
  StoreStateType & StoreActionType,
  [],
  [],
  InternalHazardsType & InternalHazardsActionsType
> = (set) => {
  SliceResetFns.add(() => {
    set(InternalHazardsState);
  });
  return {
    InternalHazards: InternalHazardsState.InternalHazards,
    SetInternalHazards: SetInternalHazards,
    AddInternalHazard: AddInternalHazard,
    EditInternalHazard: EditInternalHazard,
    DeleteInternalHazard: DeleteInternalHazard,
  };
};

export { InternalHazardsSlice };