import { InternalFloodAnalysisRecord, InternalFloodModelUncertainty, InternalFloodPreOperationalAssumption, InternalFloodProcessDocumentation, InternalFloodScreeningDecision, createInternalFloodSrCatalog } from "../internal-flood/internal-flood-pra-common";

export interface InternalFloodScenarioGroup extends InternalFloodAnalysisRecord {
  floodScenarioRefs: string[];
  groupingBasis: "SIMILAR_PLANT_RESPONSE" | "COMMON_SUCCESS_CRITERIA" | "SIMILAR_TIMING" | "COMMON_TARGET_SET" | "BOUNDING_CONSEQUENCE" | "OTHER";
  boundingScenarioRef?: string;
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  commonInitiatingEventRef?: string;
  commonFailureAndHumanEffects: string;
  groupingValidityChecks: string[];
}

export interface InternalFloodInitiatingEvent extends InternalFloodAnalysisRecord {
  scenarioGroupRef: string;
  baselineInitiatingEventRef?: string;
  initiatingEventType: "TRANSIENT" | "LOSS_OF_COOLING" | "LOSS_OF_POWER" | "LOSS_OF_HEAT_SINK" | "REACTIVITY_EVENT" | "MULTI_UNIT_EVENT" | "NEW_FLOOD_INITIATOR" | "OTHER";
  newInitiatingEventRequired: boolean;
  initiatingEventDefinition: string;
  affectedPlantOperatingStateRefs: string[];
  affectedReactorUnitRefs: string[];
  affectedRadioactiveMaterialSourceRefs: string[];
  floodFailedSscRefs: string[];
  affectedEventSequenceRefs: string[];
}

export interface InternalFloodFrequencyDataSet extends InternalFloodAnalysisRecord {
  dataType: "GENERIC_PIPE_FAILURE" | "PLANT_SPECIFIC_EVENT" | "DESIGN_SPECIFIC_EVENT" | "MAINTENANCE_EVENT" | "MITIGATION_FAILURE" | "OTHER";
  sourcePopulation: string;
  applicableSystemRefs: string[];
  applicableFailureMechanisms: string[];
  eventCount: number;
  exposure: number;
  exposureUnit: "COMPONENT_YEAR" | "WELD_YEAR" | "PLANT_YEAR" | "MAINTENANCE_HOUR" | "DEMAND";
  ageAdjustmentModel?: string;
  meanRate: number;
  rateUnit: string;
  distribution: "BETA" | "GAMMA" | "LOGNORMAL" | "POINT_ESTIMATE" | "EMPIRICAL";
  distributionParameters: Record<string, number>;
  applicabilityAssessment: string;
}

export interface InternalFloodMitigationFailureProbability extends InternalFloodAnalysisRecord {
  mitigationFeatureRef: string;
  failureMode: string;
  demandContext: string;
  failureProbability: number;
  lowerBound: number;
  upperBound: number;
  dataSetRefs: string[];
  systemModelBasicEventRef?: string;
  humanFailureEventRef?: string;
  dependencyTreatment: string;
}

export interface InternalFloodFrequencyEstimate extends InternalFloodAnalysisRecord {
  floodScenarioGroupRef: string;
  initiatingEventRef: string;
  sourceFailureRatePerYear: number;
  operatingStateExposureFraction: number;
  locationAllocationFactor: number;
  breakSizeAllocationFactor: number;
  maintenanceContributionPerYear: number;
  mitigationFailureProbabilityRefs: string[];
  scenarioSpecificHepRefs: string[];
  meanFrequencyPerPlantYear: number;
  fifthPercentileFrequencyPerPlantYear: number;
  ninetyFifthPercentileFrequencyPerPlantYear: number;
  calculationExpression: string;
  calculationRef: string;
  dataSetRefs: string[];
}

export interface InternalFloodInitiatingEvents {
  scenarioGroups: InternalFloodScenarioGroup[];
  initiatingEvents: InternalFloodInitiatingEvent[];
  frequencyDataSets: InternalFloodFrequencyDataSet[];
  mitigationFailureProbabilities: InternalFloodMitigationFailureProbability[];
  frequencyEstimates: InternalFloodFrequencyEstimate[];
  screeningDecisions: InternalFloodScreeningDecision[];
  modelUncertainties: InternalFloodModelUncertainty[];
  preOperationalAssumptions: InternalFloodPreOperationalAssumption[];
  documentation: InternalFloodProcessDocumentation;
}

export const FLEV_SR_CATALOG = createInternalFloodSrCatalog(
  "FLEV",
  {
    A: [
      "Group flood scenarios only when plant operating state, plant response, success criteria, timing, operator response, and system effects are similar or are bounded.",
      "Map each retained scenario group to an applicable internal-events initiating-event group or define a new flood-induced initiating event.",
      "Identify flood-induced initiating events that affect more than one reactor or radioactive-material source.",
      "Identify each reactor and radioactive-material-source combination affected by a multi-source initiating event.",
    ],
    B: [
      "Quantify the failure probability of credited flood-mitigation features using applicable systems and data-analysis requirements.",
      "Calculate scenario-group frequency per plant-year, including mitigation failures, scenario-specific HEPs, maintenance-induced floods, and operating-state exposure.",
      "Use applicable generic, plant-specific, and design-specific data, including age-dependent pipe-failure rates for risk-significant sources.",
      "Estimate maintenance-induced flood frequency for each applicable plant operating state.",
      "Screen a flood event or scenario group only using the applicable initiating-event or screening criteria and documented quantitative comparisons.",
      "Identify initiating-event frequency model uncertainty, related assumptions, reasonable alternatives, and potential risk impact.",
      "Identify pre-operational assumptions caused by unavailable as-built and as-operated initiating-event information.",
    ],
    C: [
      "Document initiating-event grouping, mappings, data, methods, calculations, frequencies, screening, and results.",
      "Document initiating-event frequency model uncertainty, related assumptions, and reasonable alternatives.",
      "Document pre-operational initiating-event assumptions and limitations caused by unavailable as-built and as-operated information.",
    ],
  },
  {
    "FLEV-B7": ["PRE_OPERATIONAL"],
    "FLEV-C3": ["PRE_OPERATIONAL"],
  },
);
