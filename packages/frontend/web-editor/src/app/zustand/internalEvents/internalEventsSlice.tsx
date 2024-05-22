import { StateCreator } from "zustand";
import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
import { InternalEventsActionsType, InternalEventsType } from "./internalEventsTypes";
import { internalEventsState } from "./internalEventsState";
import { addInternalEvent, deleteInternalEvent, editInternalEvent, setInternalEvents } from "./internalEventsActions";

const internalEventsSlice: StateCreator<
  StoreStateType & StoreActionType,
  [],
  [],
  InternalEventsType & InternalEventsActionsType
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
