import { NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";

export const NestedModelsState = {
  NestedModels: {
    parentId: "",
    OpStateAnalysis: [] as string[],
    InitiatingEventsAnalysis: {
      InitiatingEvents: [] as NestedModelType[],
      HeatBalanceFaultTrees: [] as string[],
    },
    EventSequenceAnalysis: {
      EventSequenceAnalysisList: [] as string[],
      EventSequenceDiagrams: [] as NestedModelType[],
      EventTrees: [] as string[],
    },
    SuccessCriteriaDevelopment: {
      SuccessCriteria: [] as string[],
      FunctionalEvents: [] as string[],
    },
    SystemAnalysis: {
      SystemAnalysisList: [] as string[],
      FaultTrees: [] as string[],
      BayesianNetworks: [] as string[],
      MarkovChains: [] as string[],
    },
    HumanReliabilityAnalysis: {
      HumanReliabilityAnalysisList: [] as string[],
    },
    DataAnalysis: {
      DataAnalysisList: [] as string[],
      BayesianEstimation: [] as string[],
      WeibullAnalysis: [] as string[],
    },
    InternalFloodPRA: null,
    InternalFirePRA: null,
    SeismicPRA: null,
    HazardsScreeningPRA: null,
    HighWindsPRA: null,
    ExternalFloodingPRA: null,
    OtherHazardsPRA: null,
    EventSequenceQuantification: {
      EventSequenceQuantificationDiagram: [] as string[],
    },
    MechanisticSourceTermAnalysis: {
      MechanisticSourceTerms: [] as string[],
    },
    RadiologicalConsequenceAnalysis: {
      RadiologicalConsequenceAnalysisList: [] as string[],
    },
    RiskIntegration: {
      RiskIntegrationList: [] as string[],
    },
  },
};
