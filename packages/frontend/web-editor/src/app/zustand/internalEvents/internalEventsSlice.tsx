import { StateCreator } from "zustand";
import { SliceResetFns, storeType } from "../Store";
import { InternalEventsType } from "./internalEventsTypes";
import { internalEventsState } from "./internalEventsState";
import {
  addInternalEvent,
  deleteInternalEvent,
  editInternalEvent,
  setInternalEvents,
} from "./internalEventsActions";

const internalEventsSlice: StateCreator<
  storeType,
  [],
  [],
  InternalEventsType
> = (set) => {
  SliceResetFns.add(() => {
    set(internalEventsState);
  });
  return {
    internalEvents: internalEventsState.internalEvents,
    setInternalEvents: setInternalEvents,
    addInternalEvent: addInternalEvent,
    editInternalEvent: editInternalEvent,
    deleteInternalEvent: deleteInternalEvent,
  };
};

export { internalEventsSlice };
