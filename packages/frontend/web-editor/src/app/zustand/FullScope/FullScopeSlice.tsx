import { StateCreator } from "zustand";

import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
import { AddFullScope, DeleteFullScope, EditFullScope, SetFullScope } from "./FullScopeActions";
import { FullScopeState } from "./FullScopeState";
import { FullScopeActionsType, FullScopeType } from "./FullScopeTypes";

const FullScopeSlice: StateCreator<StoreStateType & StoreActionType, [], [], FullScopeType & FullScopeActionsType> = (
  set,
) => {
  SliceResetFns.add(() => {
    set(FullScopeState);
  });
  return {
    FullScope: FullScopeState.FullScope,
    SetFullScope: SetFullScope,
    AddFullScope: AddFullScope,
    EditFullScope: EditFullScope,
    DeleteFullScope: DeleteFullScope,
  };
};

export { FullScopeSlice };
