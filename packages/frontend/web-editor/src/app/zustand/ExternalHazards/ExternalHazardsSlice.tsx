import { StateCreator } from "zustand";

import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
import {
  AddExternalHazard,
  DeleteExternalHazard,
  EditExternalHazard,
  SetExternalHazards,
} from "./ExternalHazardsActions";
import { ExternalHazardsState } from "./ExternalHazardsState";
import { ExternalHazardsActionsType, ExternalHazardsType } from "./ExternalHazardsType";

const ExternalHazardsSlice: StateCreator<
  StoreStateType & StoreActionType,
  [],
  [],
  ExternalHazardsType & ExternalHazardsActionsType
> = (set) => {
  SliceResetFns.add(() => {
    set(ExternalHazardsState);
  });
  return {
    ExternalHazards: ExternalHazardsState.ExternalHazards,
    SetExternalHazards: SetExternalHazards,
    AddExternalHazard: AddExternalHazard,
    EditExternalHazard: EditExternalHazard,
    DeleteExternalHazard: DeleteExternalHazard,
  };
};

export { ExternalHazardsSlice };
