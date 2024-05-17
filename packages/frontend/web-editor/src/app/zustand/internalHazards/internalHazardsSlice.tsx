import { StateCreator } from "zustand";
import { SliceResetFns, StoreType } from "../Store";
import { InternalHazardsType } from "./internalHazardsType";
import {
  addInternalHazard,
  deleteInternalHazard,
  editInternalHazard,
  setInternalHazards,
} from "./internalHazardsActions";
import { internalHazardsState } from "./internalHazardsState";

const internalHazardsSlice: StateCreator<StoreType, [], [], InternalHazardsType> = (set) => {
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
