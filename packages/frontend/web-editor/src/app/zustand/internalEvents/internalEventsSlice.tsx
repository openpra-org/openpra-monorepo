import { StateCreator } from "zustand";
import { SliceResetFns, StoreType } from "../Store";
import { InternalEventsType } from "./internalEventsTypes";
import { internalEventsState } from "./internalEventsState";
import { addInternalEvent, deleteInternalEvent, editInternalEvent, setInternalEvents } from "./internalEventsActions";

const internalEventsSlice: StateCreator<StoreType, [], [], InternalEventsType> = (set) => {
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
