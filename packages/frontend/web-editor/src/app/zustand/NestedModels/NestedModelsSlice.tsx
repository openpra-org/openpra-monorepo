import { StateCreator } from "zustand";
import { immer } from "zustand/middleware/immer";

import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
import {
  AddBayesianNetwork,
  AddEventSequenceAnalysis,
  AddEventSequenceDiagram,
  AddEventTree,
  AddFaultTree,
  AddInitiatingEvent,
  DeleteBayesianNetwork,
  DeleteEventSequenceAnalysis,
  DeleteEventSequenceDiagram,
  DeleteEventTree,
  DeleteFaultTree,
  DeleteInitiatingEvent,
  EditBayesianNetwork,
  EditEventSequenceAnalysis,
  EditEventSequenceDiagram,
  EditEventTree,
  EditFaultTree,
  EditInitiatingEvent,
  SetBayesianNetworks,
  SetEventSequenceAnalysis,
  SetEventSequenceDiagrams,
  SetEventTrees,
  SetFaultTrees,
  SetInitiatingEvents,
} from "./NestedModelsActions";
import { NestedModelsState } from "./NestedModelsState";
import { NestedModelActionsType, NestedModelsType } from "./NestedModelsType";

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

    // Bayesian Networks
    SetBayesianNetworks: SetBayesianNetworks,
    AddBayesianNetwork: AddBayesianNetwork,
    EditBayesianNetwork: EditBayesianNetwork,
    DeleteBayesianNetwork: DeleteBayesianNetwork,

    // Fault Trees
    SetFaultTrees: SetFaultTrees,
    AddFaultTree: AddFaultTree,
    EditFaultTree: EditFaultTree,
    DeleteFaultTree: DeleteFaultTree,
  };
});

export { NestedModelsSlice };
