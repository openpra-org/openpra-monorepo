import { StateCreator } from "zustand";
import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
import { InternalHazardsActionsType, InternalHazardsType } from "./internalHazardsType";
import {
  addInternalHazard,
  deleteInternalHazard,
  editInternalHazard,
  setInternalHazards,
} from "./internalHazardsActions";
import { internalHazardsState } from "./internalHazardsState";

const internalHazardsSlice: StateCreator<
  StoreStateType & StoreActionType,
  [],
  [],
  InternalHazardsType & InternalHazardsActionsType
> = (set) => {
  SliceResetFns.add(() => {
    set(internalHazardsState);
  });
  return {
    internalHazards: internalHazardsState.internalHazards,
    setInternalHazards: setInternalHazards,
    addInternalHazard: addInternalHazard,
    editInternalHazard: editInternalHazard,
    deleteInternalHazard: deleteInternalHazard,
  };
};

export { internalHazardsSlice };
