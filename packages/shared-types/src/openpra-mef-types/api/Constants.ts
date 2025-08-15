export const NESTED_MODEL_NAMES = {
  INITIATING_EVENTS: "initiatingEvents",
  EVENT_SEQUENCE_DIAGRAMS: "eventSequenceDiagrams",
  EVENT_SEQUENCE_ANALYSIS: "eventSequenceAnalysis",
  FUNCTIONAL_EVENTS: "functionalEvents",
  EVENT_TREES: "eventTrees",
  FAULT_TREES: "faultTrees",
  BAYESIAN_NETWORKS: "bayesianNetworks",
  MARKOV_CHAINS: "markovChains",
  BAYESIAN_ESTIMATIONS: "bayesianEstimations",
  WEIBULL_ANALYSIS: "weibullAnalysis",
} as const;

export const TYPED_MODEL_NAMES = {
  INTERNAL_EVENTS: "internal-events",
  INTERNAL_HAZARDS: "internal-hazards",
  EXTERNAL_HAZARDS: "external-hazards",
  FULL_SCOPE: "full-scope",
} as const;
