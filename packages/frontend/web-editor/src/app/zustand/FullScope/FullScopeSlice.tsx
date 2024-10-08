import { StateCreator } from "zustand";
import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
import { FullScopeActionsType, FullScopeType } from "./FullScopeTypes";
import { FullScopeState } from "./FullScopeState";
import { AddFullScope, DeleteFullScope, EditFullScope, SetFullScope } from "./FullScopeActions";

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
