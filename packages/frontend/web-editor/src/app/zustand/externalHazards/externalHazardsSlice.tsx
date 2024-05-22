import { StateCreator } from "zustand";
import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
import { ExternalHazardsActionsType, ExternalHazardsType } from "./externalHazardsType";
import {
  addExternalHazard,
  deleteExternalHazard,
  editExternalHazard,
  setExternalHazards,
} from "./externalHazardsActions";
import { externalHazardsState } from "./externalHazardsState";

const externalHazardsSlice: StateCreator<
  StoreStateType & StoreActionType,
  [],
  [],
  ExternalHazardsType & ExternalHazardsActionsType
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
