import { StateCreator } from "zustand";
import { immer } from "zustand/middleware/immer";
import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
import { NestedModelsState } from "./NestedModelsState";
import { NestedModelActionsType, NestedModelsType } from "./NestedModelsType";
import {
  AddEventSequenceAnalysis,
  AddEventSequenceDiagram,
  AddEventTree,
  AddInitiatingEvent,
  DeleteEventSequenceAnalysis,
  DeleteEventSequenceDiagram,
  DeleteEventTree,
  DeleteInitiatingEvent,
  EditEventSequenceAnalysis,
  EditEventSequenceDiagram,
  EditEventTree,
  EditInitiatingEvent,
  SetEventSequenceAnalysis,
  SetEventSequenceDiagrams,
  SetEventTrees,
  SetInitiatingEvents,
} from "./NestedModelsActions";

const NestedModelsSlice: StateCreator<
  StoreStateType & StoreActionType,
  [],
  [["zustand/immer", never]],
  NestedModelsType & NestedModelActionsType
> = immer((set) => {
  SliceResetFns.add(() => {
    set(NestedModelsState);
  });
  return {
    NestedModels: NestedModelsState.NestedModels,

    // Initiating Events
    SetInitiatingEvents: SetInitiatingEvents,
    AddInitiatingEvent: AddInitiatingEvent,
    EditInitiatingEvent: EditInitiatingEvent,
    DeleteInitiatingEvent: DeleteInitiatingEvent,

    // Event Sequence Diagrams
    SetEventSequenceDiagrams: SetEventSequenceDiagrams,
    AddEventSequenceDiagram: AddEventSequenceDiagram,
    EditEventSequenceDiagram: EditEventSequenceDiagram,
    DeleteEventSequenceDiagram: DeleteEventSequenceDiagram,

    // Event Sequence Analysis
    SetEventSequenceAnalysis: SetEventSequenceAnalysis,
    AddEventSequenceAnalysis: AddEventSequenceAnalysis,
    EditEventSequenceAnalysis: EditEventSequenceAnalysis,
    DeleteEventSequenceAnalysis: DeleteEventSequenceAnalysis,

    // Event Trees
    SetEventTrees: SetEventTrees,
    AddEventTree: AddEventTree,
    EditEventTree: EditEventTree,
    DeleteEventTree: DeleteEventTree,
  };
});

export { NestedModelsSlice };
