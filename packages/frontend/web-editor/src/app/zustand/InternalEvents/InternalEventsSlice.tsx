import { StateCreator } from "zustand";
import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
import { InternalEventsActionsType, InternalEventsType } from "./InternalEventsTypes";
import { InternalEventsState } from "./InternalEventsState";
import { AddInternalEvent, DeleteInternalEvent, EditInternalEvent, SetInternalEvents } from "./InternalEventsActions";

const InternalEventsSlice: StateCreator<
  StoreStateType & StoreActionType,
  [],
  [],
  InternalEventsType & InternalEventsActionsType
> = (set) => {
  SliceResetFns.add(() => {
    set(InternalEventsState);
  });
  return {
    InternalEvents: InternalEventsState.InternalEvents,
    SetInternalEvents: SetInternalEvents,
    AddInternalEvent: AddInternalEvent,
    EditInternalEvent: EditInternalEvent,
    DeleteInternalEvent: DeleteInternalEvent,
  };
};

export { InternalEventsSlice };
