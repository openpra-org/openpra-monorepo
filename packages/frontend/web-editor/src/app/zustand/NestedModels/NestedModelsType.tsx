import { NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { InitiatingEventsType } from "./TypesHelpers/InitiatingEventsType";
import { EventSequenceDiagramsType } from "./TypesHelpers/EventSequenceDiagramsType";
import { EventSequenceAnalysisType } from "./TypesHelpers/EventSequenceAnalysisType";
import { EventTreesType } from "./TypesHelpers/EventTreesType";
import { BayesianNetworksType } from "./TypesHelpers/BayesianNetworksType";
import { FaultTreesType } from "./TypesHelpers/FaultTreesType";
import { MasterLogicDiagramsType } from "./TypesHelpers/MasterLogicDiagramType";

export interface NestedModelsStateType {
  parentId: string;
  // TODO:: Table of values
  OpStateAnalysis: string[];
  InitiatingEventsAnalysis: {
    InitiatingEvents: NestedModelType[];
    HeatBalanceFaultTrees: string[];
    MasterLogicDiagrams: NestedModelType[];
  };
  EventSequenceAnalysis: {
    EventSequenceAnalysisList: NestedModelType[];
    EventSequenceDiagrams: NestedModelType[];
    EventTrees: NestedModelType[];
  };
  SuccessCriteriaDevelopment: {
    SuccessCriteria: string[];
    FunctionalEvents: string[];
  };
  SystemAnalysis: {
    SystemAnalysisList: string[];
    FaultTrees: NestedModelType[];
    BayesianNetworks: NestedModelType[];
    MarkovChains: string[];
  };
  HumanReliabilityAnalysis: {
    HumanReliabilityAnalysisList: string[];
  };
  DataAnalysis: {
    DataAnalysisList: string[];
    BayesianEstimation: string[];
    WeibullAnalysis: string[];
  };
  InternalFloodPRA: null;
  InternalFirePRA: null;
  SeismicPRA: null;
  HazardsScreeningPRA: null;
  HighWindsPRA: null;
  ExternalFloodingPRA: null;
  OtherHazardsPRA: null;
  EventSequenceQuantification: {
    EventSequenceQuantificationDiagram: string[];
  };
  MechanisticSourceTermAnalysis: {
    MechanisticSourceTerms: string[];
  };
  RadiologicalConsequenceAnalysis: {
    RadiologicalConsequenceAnalysisList: string[];
  };
  RiskIntegration: {
    RiskIntegrationList: string[];
  };
}

export interface NestedModelsType {
  NestedModels: NestedModelsStateType;
}

export type NestedModelActionsType = BayesianNetworksType &
  InitiatingEventsType &
  EventSequenceDiagramsType &
  EventSequenceAnalysisType &
  EventTreesType &
  FaultTreesType &
  MasterLogicDiagramsType;
