import { StateCreator } from "zustand";
import { SliceResetFns, StoreType } from "../Store";
import { ExternalHazardsType } from "./externalHazardsType";
import {
  addExternalHazard,
  deleteExternalHazard,
  editExternalHazard,
  setExternalHazards,
} from "./externalHazardsActions";
import { externalHazardsState } from "./externalHazardsState";

const externalHazardsSlice: StateCreator<
  StoreType,
  [],
  [],
  ExternalHazardsType
> = (set) => {
  SliceResetFns.add(() => {
    set(externalHazardsState);
  });
  return {
    externalHazards: externalHazardsState.externalHazards,
    setExternalHazards: setExternalHazards,
    addExternalHazard: addExternalHazard,
    editExternalHazard: editExternalHazard,
    deleteExternalHazard: deleteExternalHazard,
  };
};

export { externalHazardsSlice };
