import { InternalFloodAnalysisRecord, InternalFloodInvestigation, InternalFloodModelUncertainty, InternalFloodPreOperationalAssumption, InternalFloodProcessDocumentation, createInternalFloodSrCatalog } from "../internal-flood/internal-flood-pra-common";

export interface InternalFloodHumanAction extends InternalFloodAnalysisRecord {
  actionType: "PRE_INITIATOR" | "POST_INITIATOR" | "RECOVERY" | "UNDESIRED_ACTION";
  baselineHumanActionRef?: string;
  floodScenarioGroupRefs: string[];
  eventSequenceRefs: string[];
  procedureRefs: string[];
  crew: string;
  actionLocation: string;
  equipmentRefs: string[];
  cues: string[];
  floodInducedCueFailures: string[];
  requiredOutcome: string;
  retained: boolean;
}

export interface InternalFloodHumanFailureEvent extends InternalFloodAnalysisRecord {
  humanActionRef: string;
  basicEventRef: string;
  failureDefinition: string;
  scenarioContext: string;
  affectedEventSequenceRefs: string[];
  floodAreaRefs: string[];
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
}

export interface InternalFloodHumanPerformanceContext extends InternalFloodAnalysisRecord {
  humanFailureEventRef: string;
  diagnosisComplexity: "LOW" | "MODERATE" | "HIGH";
  cueQuality: "CLEAR" | "DEGRADED" | "FAILED";
  procedureQuality: "GOOD" | "ADEQUATE" | "POOR";
  trainingAndExperience: string;
  staffingAndWorkload: string;
  communication: string;
  accessRouteRefs: string[];
  maximumRouteWaterDepthMetres: number;
  sprayExposure: string;
  ambientTemperatureCelsius: number;
  lighting: string;
  personalProtectiveEquipment: string;
  stressAndTimePressure: string;
  otherPerformanceShapingFactors: string[];
}

export interface InternalFloodHumanActionTiming extends InternalFloodAnalysisRecord {
  humanFailureEventRef: string;
  cueAvailableMinutes: number;
  damageOrDeadlineMinutes: number;
  diagnosisMinutes: number;
  travelMinutes: number;
  executionMinutes: number;
  contingencyMinutes: number;
  totalRequiredMinutes: number;
  marginMinutes: number;
  feasible: boolean;
  feasibilityInvestigationRef?: string;
  routeAndExecutionBasis: string;
}

export interface InternalFloodHepEstimate extends InternalFloodAnalysisRecord {
  humanFailureEventRef: string;
  method: string;
  nominalHep: number;
  meanHep: number;
  fifthPercentileHep: number;
  ninetyFifthPercentileHep: number;
  timingAssessmentRef: string;
  performanceContextRef: string;
  recoveryCredit: boolean;
  recoveryActionRef?: string;
  quantificationInputs: Record<string, number>;
  calculationRef: string;
}

export interface InternalFloodHumanDependencyGroup extends InternalFloodAnalysisRecord {
  humanFailureEventRefs: string[];
  dependencyLevel: "ZERO" | "LOW" | "MODERATE" | "HIGH" | "COMPLETE";
  commonCrew: boolean;
  commonCue: boolean;
  commonProcedure: boolean;
  commonLocationOrRoute: boolean;
  timeSeparationMinutes: number;
  dependencyBasis: string;
  jointFailureProbability: number;
  quantificationTreatment: string;
}

export interface InternalFloodHumanReliabilityAnalysis {
  humanActions: InternalFloodHumanAction[];
  humanFailureEvents: InternalFloodHumanFailureEvent[];
  performanceContexts: InternalFloodHumanPerformanceContext[];
  timingAssessments: InternalFloodHumanActionTiming[];
  hepEstimates: InternalFloodHepEstimate[];
  dependencyGroups: InternalFloodHumanDependencyGroup[];
  investigations: InternalFloodInvestigation[];
  modelUncertainties: InternalFloodModelUncertainty[];
  preOperationalAssumptions: InternalFloodPreOperationalAssumption[];
  documentation: InternalFloodProcessDocumentation;
}

export const FLHR_SR_CATALOG = createInternalFloodSrCatalog(
  "FLHR",
  {
    A: [
      "Review baseline post-initiator human actions for applicability and feasibility under flood-specific scenario conditions.",
      "Identify new flood-response actions and credible undesired actions caused by failed or misleading indicators, annunciators, procedures, or equipment.",
    ],
    B: [
      "Retain or modify applicable baseline human failure events to represent flood-specific conditions.",
      "Define new human failure events for flood-specific operator actions and undesired responses.",
      "Provide complete human-failure-event definitions including cues, procedures, timing, locations, equipment, crews, and flood context.",
    ],
    C: [
      "Quantify flood-specific HEPs by accounting for altered cues, timing, access, environment, workload, procedures, communications, and other performance shaping factors.",
    ],
    D: [
      "Demonstrate the feasibility of credited recovery actions and quantify their HEPs using flood-specific timing and access information.",
      "Identify human-reliability model uncertainty, related assumptions, reasonable alternatives, and potential risk impact.",
      "Identify pre-operational assumptions caused by unavailable as-built and as-operated human-reliability information.",
    ],
    E: [
      "Document action identification, HFE definitions, performance contexts, timing, feasibility, HEPs, recovery, dependencies, and results.",
      "Document human-reliability model uncertainty, related assumptions, and reasonable alternatives.",
      "Document pre-operational HRA assumptions and limitations caused by unavailable as-built and as-operated information.",
    ],
  },
  {
    "FLHR-D3": ["PRE_OPERATIONAL"],
    "FLHR-E3": ["PRE_OPERATIONAL"],
  },
);
