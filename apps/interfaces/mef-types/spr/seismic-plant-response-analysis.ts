import { ParameterDistribution } from "../core/events";
import { BaseModelUncertaintyDocumentation, PreOperationalAssumption } from "../core/documentation";
import { Named, Unique } from "../core/meta";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";
import { ImportanceLevel, SensitivityStudy } from "../core/shared-patterns";
import { SeismicEquipmentListEntry } from "../seismic/seismic-pra-common";

export type SeismicInitiatorOrigin = "DIRECT_GROUND_MOTION" | "SECONDARY_HAZARD" | "INDUSTRY_EXPERIENCE" | "COMBINED_EVENT";

export type RetainedSeismicHazardModelType = "INTERNAL_FLOOD" | "INTERNAL_FIRE" | "EXTERNAL_FLOOD" | "OTHER_SECONDARY_HAZARD";

export interface SeismicInitiatingEvent extends Unique, Named {
  origin: SeismicInitiatorOrigin;
  description: string;
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  directGroundMotionFailureRefs?: string[];
  secondaryHazardRef?: string;
  industryExperienceRefs: string[];
  internalEventsInitiatingEventRef?: string;
  combinedEventComponents?: string[];
  automaticOrManualTrip: boolean;
  affectedSscRefs: string[];
  eventSequenceRefs: string[];
  riskSignificant: boolean;
  screeningOrSubsumingBasis?: string;
  retained: boolean;
  implementsSrs: SRReference[];
}

export interface InitiatingEventIdentification {
  systematicProcess: string;
  plantOperatingStateRefs: string[];
  directInitiators: SeismicInitiatingEvent[];
  secondaryHazardInitiators: SeismicInitiatingEvent[];
  industryExperienceSources: string[];
  multiReactorAndMultiSourceEvaluation: string;
  completenessReview: string;
  riskSignificanceEvaluationMethod: string;
  retainedInitiatingEventRefs: string[];
  implementsSrs: SRReference[];
}

export interface PeerReviewFindingResolution extends Unique, Named {
  sourcePraElement: string;
  sourcePeerReviewRef: string;
  findingRef: string;
  relevanceToSeismicPra: string;
  potentialAmplificationInSeismicModel: string;
  resolutionStatus: "OPEN" | "RESOLVED" | "NOT_APPLICABLE";
  resolution: string;
  incorporatedModelRefs: string[];
  evidenceRefs: string[];
  implementsSrs: SRReference[];
}

export interface SeismicallyInducedFailureModel extends Unique, Named {
  sscRef: string;
  seismicEquipmentListEntryRef: string;
  systemsFailureModeRef: string;
  fragilityEvaluationRef: string;
  systemsBasicEventRef: string;
  failureEffect: string;
  correlationGroupRefs: string[];
  causalDependencyRefs: string[];
  eventSequenceRefs: string[];
  modelImplementation: string;
  implementsSrs: SRReference[];
}

export interface FragilityThresholdDefinition extends Unique, Named {
  groundMotionParameterRef: string;
  controlPointRef: string;
  thresholdCapacity: number;
  capacityUnits: string;
  hazardCurveRef: string;
  cumulativeSscCount: number;
  correlationAndGroupingBasis: string;
  integratedAnnualFrequency: number;
  screeningCriterion: "SCR-2";
  criterionLimit: number;
  satisfiesCriterion: boolean;
  eventSequenceFamilyApplicability: string[];
  finalModelConfirmation: string;
  sensitivityStudyRefs: string[];
  implementsSrs: SRReference[];
}

export interface ContactChatterModel extends Unique, Named {
  deviceSscRef: string;
  fragilityEvaluationRef: string;
  affectedSscRefs: string[];
  chatterEffect: "UNAVAILABILITY" | "SPURIOUS_ACTUATION" | "ACCEPTABLE_CHATTER";
  systemsLogicRefs: string[];
  riskSignificant: boolean;
  exclusionByDesignBasis?: string;
  implementsSrs: SRReference[];
}

export interface SeismicMissionTimeAssessment extends Unique, Named {
  eventSequenceRef: string;
  successCriteriaRef: string;
  assumedMissionTimeHours: number;
  sustainedAccessibilityImpact: string;
  emergencyResponseCapabilityImpact: string;
  seismicEnvironmentDuration: string;
  missionTimeValid: boolean;
  revisedMissionTimeHours?: number;
  capabilityCategoryApplied: "CC-I" | "CC-II";
  basis: string;
  implementsSrs: SRReference[];
}

export interface SeismicLogicRequirementCompliance {
  requirementGroup:
    | "HLR-ES-A"
    | "HLR-ES-B"
    | "HLR-SC-A"
    | "HLR-SC-B"
    | "HLR-SY-A"
    | "HLR-SY-B"
    | "HLR-DA-A"
    | "HLR-DA-B"
    | "HLR-DA-C"
    | "HLR-DA-D"
    | "HLR-HR-D";
  applicable: boolean;
  capabilityCategory: "CC-I" | "CC-II";
  status: "MET" | "PARTIAL" | "NOT_MET" | "NOT_APPLICABLE";
  satisfiedByRefs: string[];
  evidence: string;
}

export interface NewSeismicLogic extends Unique, Named {
  logicType: "SYSTEM_MODEL" | "EVENT_SEQUENCE" | "SUCCESS_CRITERION" | "DATA_PARAMETER" | "HUMAN_ACTION";
  reasonNeeded: string;
  baseInternalEventsModelRef?: string;
  modelRefs: string[];
  requirementCompliance: SeismicLogicRequirementCompliance[];
  verificationAndValidation: string;
  implementsSrs: SRReference[];
}

export interface RetainedHazardRequirementCompliance {
  requirementGroup: string;
  capabilityCategory: "CC-I" | "CC-II";
  applicable: boolean;
  status: "MET" | "PARTIAL" | "NOT_MET" | "NOT_APPLICABLE";
  satisfiedByRefs: string[];
  evidence: string;
}

export interface RetainedSeismicHazardModel extends Unique, Named {
  hazardType: RetainedSeismicHazardModelType;
  hazardAnalysisRef: string;
  initiatingEventRefs: string[];
  sourceSscRefs: string[];
  affectedSscRefs: string[];
  fragilityRefs: string[];
  plantResponseModelRefs: string[];
  requirementCompliance: RetainedHazardRequirementCompliance[];
  integrationBasis: string;
  implementsSrs: SRReference[];
}

export interface MultiReactorImpactModel extends Unique, Named {
  applicable: boolean;
  reactorUnitRefs: string[];
  sharedSscRefs: string[];
  sharedHazardAndDependencyDescription: string;
  concurrentInitiatingEventRefs: string[];
  multiUnitEventSequenceRefs: string[];
  sharedHumanActionRefs: string[];
  sharedRadioactiveSourceRefs: string[];
  modelImplementation: string;
  exclusionBasis?: string;
  implementsSrs: SRReference[];
}

export interface SeismicPlantResponseModel {
  baseInternalEventsModelRefs: string[];
  baseNonSeismicHazardModelRefs: string[];
  eventSequenceRefs: string[];
  systemsLogicModelRefs: string[];
  peerReviewFindingResolutions: PeerReviewFindingResolution[];
  inducedFailures: SeismicallyInducedFailureModel[];
  nonSeismicFailureRefs: string[];
  unavailabilityRefs: string[];
  humanErrorRefs: string[];
  plantOperatingStateRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  fragilityThresholds: FragilityThresholdDefinition[];
  contactChatterModels: ContactChatterModel[];
  missionTimeAssessments: SeismicMissionTimeAssessment[];
  newSeismicLogic: NewSeismicLogic[];
  retainedHazardModels: RetainedSeismicHazardModel[];
  multiReactorModels: MultiReactorImpactModel[];
  modificationsFromBaseModel: string[];
  completenessAndConsistencyReview: string;
  implementsSrs: SRReference[];
}

export interface SeismicEquipmentListDevelopment {
  internalEventsSystemsModelRef: string;
  additionalSeismicSystemRefs: string[];
  equipment: SeismicEquipmentListEntry[];
  internalFloodSourceRefs: string[];
  internalFireIgnitionSourceRefs: string[];
  secondaryHazardSscRefs: string[];
  additionalStructuresAndPassiveSscRefs: string[];
  failureModeIdentificationProcess: string;
  systemsFragilityAnalystCoordination: string;
  completenessChecks: string[];
  revisionBasis: string;
  implementsSrs: SRReference[];
}

export interface SeismicHumanAction extends Unique, Named {
  humanFailureEventRef: string;
  recoveryAction: boolean;
  sourceInternalEventsHfeRef?: string;
  eventSequenceRefs: string[];
  controlRoomOrExControlRoom: "CONTROL_ROOM" | "EX_CONTROL_ROOM" | "BOTH";
  seismicSpecificChallenges: {
    trainingAndProcedures: string;
    workloadAndStress: string;
    mitigationImpact: string;
    timingAndAccessibility: string;
    physicalHazards: string;
    jobAidsAndTraining: string;
  };
  availableTime: number;
  requiredTime: number;
  timeUnits: string;
  humanErrorProbability: number;
  probabilityDistribution?: ParameterDistribution;
  dependencyRefs: string[];
  feasibilityBasis: string;
  humanReliabilityAnalysisRef: string;
  implementsSrs: SRReference[];
}

export interface SeismicHumanReliabilityModel {
  relevantInternalEventsHfeRefs: string[];
  humanActions: SeismicHumanAction[];
  responseActionRequirementCompliance: string;
  hfeDefinitionRequirementCompliance: string;
  recoveryRequirementCompliance: string;
  quantificationRequirementCompliance: string;
  seismicInfluenceIntegration: string;
  implementsSrs: SRReference[];
}

export interface HazardDiscretizationBin extends Unique, Named {
  hazardCurveRef: string;
  lowerGroundMotion: number;
  upperGroundMotion: number;
  representativeGroundMotion: number;
  groundMotionUnits: string;
  annualFrequency: number;
  conditionalFrequencyMethod: string;
  fragilityEvaluationRefs: string[];
  eventSequenceFamilyRefs: string[];
  contributionToRiskMetric?: number;
}

export interface HazardDiscretization extends Unique, Named {
  hazardCurveRefs: string[];
  bins: HazardDiscretizationBin[];
  numericalMethod: string;
  convergenceMetric: string;
  convergenceTolerance: number;
  convergenceStudies: {
    binCount: number;
    metricValue: number;
    relativeChange: number;
  }[];
  converged: boolean;
  basis: string;
  implementsSrs: SRReference[];
}

export interface RareEventApproximationAssessment extends Unique, Named {
  affectedModelRef: string;
  approximationMethod: string;
  fragilityRefsApproachingUnity: string[];
  overestimationMechanism: string;
  uncorrectedResult?: number;
  correctedResult?: number;
  correctionMethod: string;
  impactAssessment: string;
  implementsSrs: SRReference[];
}

export interface EsqRequirementCompliance {
  requirement: string;
  applicable: boolean;
  status: "MET" | "PARTIAL" | "NOT_MET" | "NOT_APPLICABLE";
  satisfiedByRefs: string[];
  evidence: string;
}

export interface SeismicEventSequenceFamilyQuantification extends Unique, Named {
  eventSequenceFamilyRef: string;
  initiatingEventRefs: string[];
  eventSequenceRefs: string[];
  releaseCategoryRef?: string;
  sourceTermRef?: string;
  hazardDiscretizationRef: string;
  meanHazardUsed: boolean;
  meanFragilitiesUsed: boolean;
  pointEstimateFrequency: number;
  meanFrequency?: number;
  frequencyUnit: "PER_PLANT_YEAR";
  frequencyDistribution?: ParameterDistribution;
  hazardBinContributions: {
    binRef: string;
    frequencyContribution: number;
  }[];
  uncertaintyContributions: {
    sourceType: "HAZARD" | "FRAGILITY" | "SYSTEMS";
    sourceRef: string;
    contributionDescription: string;
  }[];
  truncationAndScreeningTreatment: string;
  quantificationMethod: string;
  implementsSrs: SRReference[];
}

export interface SeismicRiskContributor extends Unique, Named {
  contributorType: "INITIATING_EVENT" | "EVENT_SEQUENCE" | "EVENT_SEQUENCE_FAMILY" | "BASIC_EVENT" | "SSC" | "HUMAN_ACTION" | "HAZARD_BIN";
  contributorRef: string;
  affectedEventSequenceFamilyRefs: string[];
  contributionValue?: number;
  contributionMetric: string;
  importance: ImportanceLevel;
  designOperationMaintenanceContext: string;
  riskInsight: string;
  implementsSrs: SRReference[];
}

export interface PlantResponseUncertainty extends Unique, Named {
  sourceArea: "HAZARD_INTERFACE" | "FRAGILITY_INTERFACE" | "SYSTEMS_MODEL" | "HUMAN_RELIABILITY" | "QUANTIFICATION";
  uncertaintyType: "PARAMETER" | "MODEL";
  description: string;
  affectedModelRefs: string[];
  affectedEventSequenceFamilyRefs: string[];
  relatedAssumptions: string[];
  reasonableAlternatives: string[];
  treatment: string;
  propagated: boolean;
  sensitivityStudyRefs: string[];
  importance?: ImportanceLevel;
  implementsSrs: SRReference[];
}

export interface SeismicPlantResponseQuantification {
  hazardDiscretizations: HazardDiscretization[];
  rareEventApproximationAssessments: RareEventApproximationAssessment[];
  esqRequirementCompliance: EsqRequirementCompliance[];
  eventSequenceFamilyQuantifications: SeismicEventSequenceFamilyQuantification[];
  resultType: "POINT_ESTIMATES" | "MEANS_WITH_PROPAGATED_PARAMETER_UNCERTAINTY";
  integratedHazardFragilitySystemsMethod: string;
  parameterUncertaintyPropagationMethod?: string;
  modelUncertainties: PlantResponseUncertainty[];
  combinedAssumptionEvaluation: string;
  sensitivityStudies: SensitivityStudy[];
  riskSignificantContributors: SeismicRiskContributor[];
  outputQualityChecks: string[];
  implementsSrs: SRReference[];
}

export interface SeismicPlantResponseDocumentation {
  processDescription: string;
  inputsDescription: string;
  seismicEquipmentListDevelopment: string;
  baseModelModifications: string;
  seismicHumanReliabilityInfluences: string;
  quantificationMethods: string;
  eventSequenceFamilyResults: string;
  sensitivityStudyResults: string;
  riskSignificantContributors: string;
  modelUncertaintiesAndAlternatives: string;
  preOperationalLimitations?: string;
  quantificationLimitations: string[];
  dataModelAndCalculationRefs: string[];
  traceability: {
    initiatingEventRef: string;
    eventSequenceRefs: string[];
    equipmentRefs: string[];
    fragilityRefs: string[];
    hazardRefs: string[];
    quantificationRef: string;
  }[];
  implementsSrs: SRReference[];
}

export interface SeismicPlantResponseAnalysis extends Unique, Named {
  praScope: string;
  initiatingEventIdentification: InitiatingEventIdentification;
  plantResponseModel: SeismicPlantResponseModel;
  seismicEquipmentListDevelopment: SeismicEquipmentListDevelopment;
  humanReliabilityModel: SeismicHumanReliabilityModel;
  quantification: SeismicPlantResponseQuantification;
  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];
  documentation: SeismicPlantResponseDocumentation;
}

const ALL_PLANT_STAGES: PlantStage[] = ["OPERATIONAL", "PRE_OPERATIONAL"];

export const SPR_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  "SPR-A1": { hlr: "A", stages: ALL_PLANT_STAGES },
  "SPR-A2": { hlr: "A", stages: ALL_PLANT_STAGES },
  "SPR-A3": { hlr: "A", stages: ALL_PLANT_STAGES },
  "SPR-A4": { hlr: "A", stages: ALL_PLANT_STAGES },
  "SPR-B1": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SPR-B2": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SPR-B3": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SPR-B4": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SPR-B5": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SPR-B6": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SPR-B7": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SPR-B8": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SPR-B9": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SPR-B10": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SPR-B11": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SPR-B12": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SPR-B13": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SPR-C1": { hlr: "C", stages: ALL_PLANT_STAGES },
  "SPR-C2": { hlr: "C", stages: ALL_PLANT_STAGES },
  "SPR-C3": { hlr: "C", stages: ALL_PLANT_STAGES },
  "SPR-C4": { hlr: "C", stages: ALL_PLANT_STAGES },
  "SPR-C5": { hlr: "C", stages: ALL_PLANT_STAGES },
  "SPR-C6": { hlr: "C", stages: ALL_PLANT_STAGES },
  "SPR-D1": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SPR-D2": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SPR-D3": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SPR-D4": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SPR-D5": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SPR-E1": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SPR-E2": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SPR-E3": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SPR-E4": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SPR-E5": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SPR-E6": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SPR-E7": { hlr: "E", stages: ["PRE_OPERATIONAL"] },
  "SPR-E8": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SPR-F1": { hlr: "F", stages: ALL_PLANT_STAGES },
  "SPR-F2": { hlr: "F", stages: ALL_PLANT_STAGES },
  "SPR-F3": { hlr: "F", stages: ALL_PLANT_STAGES },
  "SPR-F4": { hlr: "F", stages: ["PRE_OPERATIONAL"] },
  "SPR-F5": { hlr: "F", stages: ALL_PLANT_STAGES },
};
