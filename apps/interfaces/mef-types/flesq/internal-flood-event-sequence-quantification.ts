import { InternalFloodAnalysisRecord, InternalFloodModelUncertainty, InternalFloodPreOperationalAssumption, InternalFloodProcessDocumentation, createInternalFloodSrCatalog } from "../internal-flood/internal-flood-pra-common";

export interface InternalFloodQuantificationRun extends InternalFloodAnalysisRecord {
  modelVersion: string;
  calculationDate: string;
  initiatingEventRefs: string[];
  eventSequenceModelRefs: string[];
  humanFailureEventRefs: string[];
  mitigationFailureRefs: string[];
  independentFailureModelRef: string;
  commonCauseFailureModelRef: string;
  maintenanceUnavailabilityModelRef: string;
  modelOrCode: string;
  solverVersion: string;
  truncationLimitPerPlantYear: number;
  sampleCount: number;
  randomSeed?: number;
  convergenceMetric: number;
  convergenceCriterion: number;
  converged: boolean;
  verificationChecks: string[];
}

export interface InternalFloodEventSequenceFamilyResult extends InternalFloodAnalysisRecord {
  quantificationRunRef: string;
  eventSequenceFamilyRef: string;
  initiatingEventRef: string;
  floodScenarioGroupRefs: string[];
  releaseCategoryRef: string;
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  meanFrequencyPerPlantYear: number;
  medianFrequencyPerPlantYear: number;
  fifthPercentileFrequencyPerPlantYear: number;
  ninetyFifthPercentileFrequencyPerPlantYear: number;
  conditionalSequenceProbability: number;
  dominantCutsetRefs: string[];
  screened: boolean;
  screeningDecisionRef?: string;
}

export interface InternalFloodQuantificationDependency extends InternalFloodAnalysisRecord {
  quantificationRunRef: string;
  dependencyType: "SPATIAL" | "FUNCTIONAL" | "COMMON_CAUSE" | "HUMAN" | "MAINTENANCE" | "SHARED_SUPPORT" | "OTHER";
  dependentEventRefs: string[];
  affectedScenarioGroupRefs: string[];
  treatment: string;
  correlationCoefficient?: number;
  jointProbability?: number;
  modelImplementationRef: string;
  verification: string;
}

export interface InternalFloodRiskContributor extends InternalFloodAnalysisRecord {
  quantificationRunRef: string;
  contributorType: "PLANT_OPERATING_STATE" | "INITIATING_EVENT" | "EVENT_SEQUENCE" | "BASIC_EVENT" | "FLOOD_AREA" | "FLOOD_SOURCE" | "FLOOD_SCENARIO" | "FLOOD_PHENOMENON" | "SSC" | "HUMAN_ACTION" | "OTHER";
  contributorRef: string;
  affectedEventSequenceFamilyRefs: string[];
  absoluteFrequencyContributionPerPlantYear: number;
  fractionalContribution: number;
  fussellVesely?: number;
  riskAchievementWorth?: number;
  riskReductionWorth?: number;
  riskSignificant: boolean;
  ranking: number;
}

export interface InternalFloodQuantificationUncertaintyResult extends InternalFloodAnalysisRecord {
  quantificationRunRef: string;
  uncertaintySourceRefs: string[];
  affectedEventSequenceFamilyRefs: string[];
  propagationMethod: string;
  distributionSummary: string;
  meanFrequencyPerPlantYear: number;
  fifthPercentileFrequencyPerPlantYear: number;
  ninetyFifthPercentileFrequencyPerPlantYear: number;
  dependencyAndCorrelationTreatment: string;
  operatingStateChangeImpact: string;
}

export interface InternalFloodSensitivityStudy extends InternalFloodAnalysisRecord {
  quantificationRunRef: string;
  variedInputRefs: string[];
  alternativeModel: string;
  baselineFrequencyPerPlantYear: number;
  sensitivityFrequencyPerPlantYear: number;
  relativeChange: number;
  changedContributorRankings: string[];
  conclusion: string;
}

export interface InternalFloodQuantificationTraceability extends InternalFloodAnalysisRecord {
  evidenceRefs: string[];
  floodAreaRefs: string[];
  floodSourceRefs: string[];
  floodScenarioRefs: string[];
  initiatingEventRefs: string[];
  plantModelRefs: string[];
  humanFailureEventRefs: string[];
  eventSequenceFamilyRefs: string[];
  quantificationResultRefs: string[];
  riskContributorRefs: string[];
  complete: boolean;
}

export interface InternalFloodEventSequenceQuantification {
  quantificationRuns: InternalFloodQuantificationRun[];
  eventSequenceFamilyResults: InternalFloodEventSequenceFamilyResult[];
  dependencies: InternalFloodQuantificationDependency[];
  riskContributors: InternalFloodRiskContributor[];
  uncertaintyResults: InternalFloodQuantificationUncertaintyResult[];
  sensitivityStudies: InternalFloodSensitivityStudy[];
  traceability: InternalFloodQuantificationTraceability[];
  modelUncertainties: InternalFloodModelUncertainty[];
  preOperationalAssumptions: InternalFloodPreOperationalAssumption[];
  documentation: InternalFloodProcessDocumentation;
}

export const FLESQ_SR_CATALOG = createInternalFloodSrCatalog(
  "FLESQ",
  {
    A: [
      "Include flood-caused failures and independent equipment failures, maintenance unavailability, common-cause failures, and other credible causes in sequence quantification.",
      "Include direct source effects and spatial effects such as submergence, spray, harsh environment, jet impingement, pipe whip, temperature, and pressure.",
      "Perform additional data analysis needed for flood-sequence quantification using the applicable data-analysis requirements.",
      "Calculate each flood-induced event-sequence-family frequency per plant-year, including scenario-specific HEPs and other conditional factors.",
      "Retain flood scenarios in the PRA unless the affected event-sequence families satisfy the applicable screening criteria.",
      "Collect engineering, HRA, spray-impact, and screening inputs from plant or design sources and confirm their accuracy through investigations.",
      "Identify quantification model uncertainty, related assumptions, reasonable alternatives, and potential risk impact.",
      "Identify pre-operational assumptions caused by unavailable as-built and as-operated quantification information.",
    ],
    B: [
      "Use appropriate models and codes, demonstrate convergence at a sufficiently low truncation level, and address method-specific limitations and features.",
    ],
    C: [
      "Include equipment, spatial, functional, common-cause, maintenance, shared-support, and operator-action dependencies in model quantification.",
    ],
    D: [
      "Review quantification for correctness, completeness, and consistency and identify traceable risk-significant contributors, including flood areas and scenarios.",
    ],
    E: [
      "Integrate the model uncertainties and assumptions identified across FLPP, FLSO, FLSN, FLEV, FLPR, FLHR, and FLESQ.",
      "Propagate parametric uncertainty and evaluate model uncertainty for flood-induced event-sequence families using the applicable quantification requirements.",
    ],
    F: [
      "Document the quantification process, screening, results, importance measures, uncertainty distributions, and operating-state effects.",
      "Document risk-significant initiating events, sequences, cutsets, areas, sources, SSCs, and operator actions and describe significant event sequences.",
      "Document quantification model uncertainty, related assumptions, and reasonable alternatives.",
      "Document pre-operational quantification assumptions and limitations caused by unavailable as-built and as-operated information.",
      "Document quantification-process limitations that could affect PRA applications.",
    ],
  },
  {
    "FLESQ-A8": ["PRE_OPERATIONAL"],
    "FLESQ-F4": ["PRE_OPERATIONAL"],
  },
);
