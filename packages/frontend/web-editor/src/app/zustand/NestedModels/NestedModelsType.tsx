import { NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { InitiatingEventsType } from "./TypesHelpers/InitiatingEventsType";
import { EventSequenceDiagramsType } from "./TypesHelpers/EventSequenceDiagramsType";
import { EventSequenceAnalysisType } from "./TypesHelpers/EventSequenceAnalysisType";
import { EventTreesType } from "./TypesHelpers/EventTreesType";
import { BayesianNetworksType } from "./TypesHelpers/BayesianNetworksType";
import { FaultTree } from "shared-types/src/lib/api/NestedModelsAPI/FaultTreesApiManager";

export interface NestedModelsStateType {
  modelId: string;
  OpStateAnalysis: string[];
  InitiatingEventsAnalysis: {
    InitiatingEvents: NestedModelType[];
    HeatBalanceFaultTrees: string[];
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
    BayesianNetworks: NestedModelType[];
    MarkovChains: string[];
    FaultTrees: FaultTree[]; // <-- Use FaultTree[] here
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

export interface FaultTreesType {
  SetFaultTrees: (modelId: string) => Promise<void>;
  AddFaultTree: (data: Omit<FaultTree, "id">) => Promise<void>;
  EditFaultTree: (id: string, data: Partial<FaultTree>) => Promise<void>;
  DeleteFaultTree: (id: string) => Promise<void>;
}

export interface NestedModelsType {
  NestedModels: NestedModelsStateType;
}

export type NestedModelActionsType = BayesianNetworksType &
  InitiatingEventsType &
  EventSequenceDiagramsType &
  EventSequenceAnalysisType &
  EventTreesType &
  FaultTreesType;