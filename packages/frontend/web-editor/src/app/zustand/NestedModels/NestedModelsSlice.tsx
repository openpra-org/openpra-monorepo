import { StateCreator } from "zustand";
import { immer } from "zustand/middleware/immer";
import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
import { NestedModelsState } from "./NestedModelsState";
import { NestedModelActionsType, NestedModelsType } from "./NestedModelsType";
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
    SetInitiatingEvents: SetInitiatingEvents,
    AddInitiatingEvent: AddInitiatingEvent,
    EditInitiatingEvent: EditInitiatingEvent,
    DeleteInitiatingEvent: DeleteInitiatingEvent,
    SetEventSequenceDiagrams: SetEventSequenceDiagrams,
    AddEventSequenceDiagram: AddEventSequenceDiagram,
    EditEventSequenceDiagram: EditEventSequenceDiagram,
    DeleteEventSequenceDiagram: DeleteEventSequenceDiagram,
    SetEventSequenceAnalysis: SetEventSequenceAnalysis,
    AddEventSequenceAnalysis: AddEventSequenceAnalysis,
    EditEventSequenceAnalysis: EditEventSequenceAnalysis,
    DeleteEventSequenceAnalysis: DeleteEventSequenceAnalysis,
    SetEventTrees: SetEventTrees,
    AddEventTree: AddEventTree,
    EditEventTree: EditEventTree,
    DeleteEventTree: DeleteEventTree,
    SetBayesianNetworks: SetBayesianNetworks,
    AddBayesianNetwork: AddBayesianNetwork,
    EditBayesianNetwork: EditBayesianNetwork,
    DeleteBayesianNetwork: DeleteBayesianNetwork,
    SetFaultTrees: SetFaultTrees,
    AddFaultTree: AddFaultTree,
    EditFaultTree: EditFaultTree,
    DeleteFaultTree: DeleteFaultTree,
  };
});
export { NestedModelsSlice };
