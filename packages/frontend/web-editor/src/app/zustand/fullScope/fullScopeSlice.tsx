import { StateCreator } from "zustand";
import { SliceResetFns, storeType } from "../Store";
import { FullScopeType } from "./fullScopeTypes";
import { fullScopeState } from "./fullScopeState";
import {
  addFullScope,
  deleteFullScope,
  editFullScope,
  setFullScope,
} from "./fullScopeActions";

const fullScopeSlice: StateCreator<storeType, [], [], FullScopeType> = (
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
