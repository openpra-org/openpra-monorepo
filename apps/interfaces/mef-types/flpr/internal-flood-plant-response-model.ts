import { InternalFloodAnalysisRecord, InternalFloodModelUncertainty, InternalFloodPreOperationalAssumption, InternalFloodProcessDocumentation, createInternalFloodSrCatalog } from "../internal-flood/internal-flood-pra-common";

export interface InternalFloodPlantResponseResult extends InternalFloodAnalysisRecord {
  floodScenarioGroupRef: string;
  eventSequenceFamilyRefs: string[];
  conditionalSequenceFamilyProbability: number;
  annualSequenceFamilyFrequency: number;
  releaseCategoryRefs: string[];
  riskSignificantContributorRefs: string[];
  quantificationRef: string;
}

export interface InternalFloodEventSequenceModel extends InternalFloodAnalysisRecord {
  initiatingEventRef: string;
  baselineEventSequenceRefs: string[];
  modelTreatment: "REUSED" | "MODIFIED" | "NEW";
  sequenceFamilyRefs: string[];
  floodScenarioGroupRefs: string[];
  affectedReactorUnitRefs: string[];
  affectedRadioactiveMaterialSourceRefs: string[];
  topEvents: { uuid: string; name: string; successBranch: string; failureBranch: string; modelRef: string }[];
  endStates: { name: string; releaseCategoryRef: string; disposition: string }[];
  multiUnitOrSourceLogic: string;
}

export interface InternalFloodSuccessCriterion extends InternalFloodAnalysisRecord {
  function: string;
  initiatingEventRefs: string[];
  eventSequenceRefs: string[];
  requiredSystemTrainRefs: string[];
  requiredSscRefs: string[];
  requiredOperatorActionRefs: string[];
  successDefinition: string;
  analysisMethod: string;
  analysisRef: string;
  plantOperatingStateRefs: string[];
  missionTimeHours: number;
}

export interface InternalFloodSystemModelModification extends InternalFloodAnalysisRecord {
  systemRef: string;
  baselineModelRef: string;
  treatment: "REUSED" | "MODIFIED" | "NEW";
  floodScenarioGroupRefs: string[];
  floodFailedSscRefs: string[];
  addedBasicEvents: { uuid: string; name: string; probability: number; failureMechanism: string; sourceRef: string }[];
  modifiedLogic: string;
  isolationAndRecoveryLogic: string;
  sharedDependencyRefs: string[];
  consequentialHazardRefs: string[];
  verification: string;
}

export interface InternalFloodMissionTimeAssessment extends InternalFloodAnalysisRecord {
  successCriterionRef: string;
  systemModelRef: string;
  baselineMissionTimeHours: number;
  floodMissionTimeHours: number;
  timingDriver: string;
  thermalHydraulicOrProcessBasis: string;
  adequate: boolean;
  modelChangeRefs: string[];
}

export interface InternalFloodPeerReviewFindingDisposition extends InternalFloodAnalysisRecord {
  sourceReviewRef: string;
  findingId: string;
  affectedBaselineModelRefs: string[];
  internalFloodImpact: string;
  disposition: "NO_IMPACT" | "MODEL_UPDATED" | "OPEN";
  modelChangeRefs: string[];
  closureEvidenceRefs: string[];
}

export interface InternalFloodPlantResponseModel {
  plantResponseResults: InternalFloodPlantResponseResult[];
  eventSequenceModels: InternalFloodEventSequenceModel[];
  successCriteria: InternalFloodSuccessCriterion[];
  systemModelModifications: InternalFloodSystemModelModification[];
  missionTimeAssessments: InternalFloodMissionTimeAssessment[];
  peerReviewFindingDispositions: InternalFloodPeerReviewFindingDisposition[];
  modelUncertainties: InternalFloodModelUncertainty[];
  preOperationalAssumptions: InternalFloodPreOperationalAssumption[];
  documentation: InternalFloodProcessDocumentation;
}

export const FLPR_SR_CATALOG = createInternalFloodSrCatalog(
  "FLPR",
  {
    A: [
      "Calculate the conditional probability of each modeled flood-induced event sequence or event-sequence family.",
      "Combine the conditional plant-response result with initiating-event frequency to calculate annual sequence or family frequency.",
      "Identify risk-significant plant-response contributors, including systems, equipment failures, human actions, areas, sources, and scenarios.",
    ],
    B: [
      "Use applicable baseline initiating-event, event-sequence, and systems logic and add multi-reactor or multi-source sequences where required.",
      "Review applicable internal-events PRA peer-review findings and disposition their impact on the Internal Flood PRA.",
      "Review, modify, or create event-sequence models to represent flood initiators, failed targets, dependencies, and outcomes.",
      "Model new initiating events for retained flood scenarios that are not represented by the baseline PRA.",
      "Identify success criteria that are new or modified by flood conditions.",
      "Define and model flood-specific success criteria using applicable engineering analysis.",
      "Modify or create systems models to represent flood-induced failures, operator actions, isolation, mitigation, and shared dependencies.",
      "Review and revise mission times when flood conditions change the required duration of mitigating functions.",
      "Identify plant-response model uncertainty, related assumptions, reasonable alternatives, and potential risk impact.",
      "Identify pre-operational assumptions caused by unavailable as-built and as-operated plant-response information.",
    ],
    C: [
      "Document plant-response inputs, methods, event sequences, systems changes, success criteria, mission times, calculations, and results.",
      "Document plant-response model uncertainty, related assumptions, and reasonable alternatives.",
      "Document pre-operational plant-response assumptions and limitations caused by unavailable as-built and as-operated information.",
    ],
  },
  {
    "FLPR-B10": ["PRE_OPERATIONAL"],
    "FLPR-C3": ["PRE_OPERATIONAL"],
  },
);
