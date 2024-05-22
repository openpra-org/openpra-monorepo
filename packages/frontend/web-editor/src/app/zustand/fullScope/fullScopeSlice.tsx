import { StateCreator } from "zustand";
import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
import { FullScopeActionsType, FullScopeType } from "./fullScopeTypes";
import { fullScopeState } from "./fullScopeState";
import { addFullScope, deleteFullScope, editFullScope, setFullScope } from "./fullScopeActions";

const fullScopeSlice: StateCreator<StoreStateType & StoreActionType, [], [], FullScopeType & FullScopeActionsType> = (
  set,
) => {
  SliceResetFns.add(() => {
    set(fullScopeState);
  });
  return {
    fullScope: fullScopeState.fullScope,
    setFullScope: setFullScope,
    addFullScope: addFullScope,
    editFullScope: editFullScope,
    deleteFullScope: deleteFullScope,
  };
};

export { fullScopeSlice };
