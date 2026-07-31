import { z } from "zod";
import type { SeismicPlantResponseAnalysis } from "../../spr/seismic-plant-response-analysis";
import { ParameterDistributionSchema } from "../core/events";
import { BaseModelUncertaintyDocumentationSchema, PreOperationalAssumptionSchema } from "../core/documentation";
import { ImportanceLevelSchema, SensitivityStudySchema } from "../core/shared-patterns";
import { SRReferenceSchema } from "../core/pra-common";
import { SeismicEquipmentListEntrySchema } from "../seismic/seismic-pra-common";

export const SeismicInitiatorOriginSchema = z.enum([
  "DIRECT_GROUND_MOTION",
  "SECONDARY_HAZARD",
  "INDUSTRY_EXPERIENCE",
  "COMBINED_EVENT",
]);

export const RetainedSeismicHazardModelTypeSchema = z.enum([
  "INTERNAL_FLOOD",
  "INTERNAL_FIRE",
  "EXTERNAL_FLOOD",
  "OTHER_SECONDARY_HAZARD",
]);

export const SeismicInitiatingEventSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  origin: SeismicInitiatorOriginSchema,
  description: z.string(),
  plantOperatingStateRefs: z.array(z.string()),
  reactorUnitRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()),
  directGroundMotionFailureRefs: z.array(z.string()).optional(),
  secondaryHazardRef: z.string().optional(),
  industryExperienceRefs: z.array(z.string()),
  internalEventsInitiatingEventRef: z.string().optional(),
  combinedEventComponents: z.array(z.string()).optional(),
  automaticOrManualTrip: z.boolean(),
  affectedSscRefs: z.array(z.string()),
  eventSequenceRefs: z.array(z.string()),
  riskSignificant: z.boolean(),
  screeningOrSubsumingBasis: z.string().optional(),
  retained: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const InitiatingEventIdentificationSchema = z.object({
  systematicProcess: z.string(),
  plantOperatingStateRefs: z.array(z.string()),
  directInitiators: z.array(SeismicInitiatingEventSchema),
  secondaryHazardInitiators: z.array(SeismicInitiatingEventSchema),
  industryExperienceSources: z.array(z.string()),
  multiReactorAndMultiSourceEvaluation: z.string(),
  completenessReview: z.string(),
  riskSignificanceEvaluationMethod: z.string(),
  retainedInitiatingEventRefs: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PeerReviewFindingResolutionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  sourcePraElement: z.string(),
  sourcePeerReviewRef: z.string(),
  findingRef: z.string(),
  relevanceToSeismicPra: z.string(),
  potentialAmplificationInSeismicModel: z.string(),
  resolutionStatus: z.enum(["OPEN", "RESOLVED", "NOT_APPLICABLE"]),
  resolution: z.string(),
  incorporatedModelRefs: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicallyInducedFailureModelSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  sscRef: z.string(),
  seismicEquipmentListEntryRef: z.string(),
  systemsFailureModeRef: z.string(),
  fragilityEvaluationRef: z.string(),
  systemsBasicEventRef: z.string(),
  failureEffect: z.string(),
  correlationGroupRefs: z.array(z.string()),
  causalDependencyRefs: z.array(z.string()),
  eventSequenceRefs: z.array(z.string()),
  modelImplementation: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const FragilityThresholdDefinitionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  groundMotionParameterRef: z.string(),
  controlPointRef: z.string(),
  thresholdCapacity: z.number(),
  capacityUnits: z.string(),
  hazardCurveRef: z.string(),
  cumulativeSscCount: z.number(),
  correlationAndGroupingBasis: z.string(),
  integratedAnnualFrequency: z.number(),
  screeningCriterion: z.literal("SCR-2"),
  criterionLimit: z.number(),
  satisfiesCriterion: z.boolean(),
  eventSequenceFamilyApplicability: z.array(z.string()),
  finalModelConfirmation: z.string(),
  sensitivityStudyRefs: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ContactChatterModelSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  deviceSscRef: z.string(),
  fragilityEvaluationRef: z.string(),
  affectedSscRefs: z.array(z.string()),
  chatterEffect: z.enum(["UNAVAILABILITY", "SPURIOUS_ACTUATION", "ACCEPTABLE_CHATTER"]),
  systemsLogicRefs: z.array(z.string()),
  riskSignificant: z.boolean(),
  exclusionByDesignBasis: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicMissionTimeAssessmentSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  eventSequenceRef: z.string(),
  successCriteriaRef: z.string(),
  assumedMissionTimeHours: z.number(),
  sustainedAccessibilityImpact: z.string(),
  emergencyResponseCapabilityImpact: z.string(),
  seismicEnvironmentDuration: z.string(),
  missionTimeValid: z.boolean(),
  revisedMissionTimeHours: z.number().optional(),
  capabilityCategoryApplied: z.enum(["CC-I", "CC-II"]),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicLogicRequirementComplianceSchema = z.object({
  requirementGroup: z.enum([
    "HLR-ES-A",
    "HLR-ES-B",
    "HLR-SC-A",
    "HLR-SC-B",
    "HLR-SY-A",
    "HLR-SY-B",
    "HLR-DA-A",
    "HLR-DA-B",
    "HLR-DA-C",
    "HLR-DA-D",
    "HLR-HR-D",
  ]),
  applicable: z.boolean(),
  capabilityCategory: z.enum(["CC-I", "CC-II"]),
  status: z.enum(["MET", "PARTIAL", "NOT_MET", "NOT_APPLICABLE"]),
  satisfiedByRefs: z.array(z.string()),
  evidence: z.string(),
});

export const NewSeismicLogicSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  logicType: z.enum(["SYSTEM_MODEL", "EVENT_SEQUENCE", "SUCCESS_CRITERION", "DATA_PARAMETER", "HUMAN_ACTION"]),
  reasonNeeded: z.string(),
  baseInternalEventsModelRef: z.string().optional(),
  modelRefs: z.array(z.string()),
  requirementCompliance: z.array(SeismicLogicRequirementComplianceSchema),
  verificationAndValidation: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RetainedHazardRequirementComplianceSchema = z.object({
  requirementGroup: z.string(),
  capabilityCategory: z.enum(["CC-I", "CC-II"]),
  applicable: z.boolean(),
  status: z.enum(["MET", "PARTIAL", "NOT_MET", "NOT_APPLICABLE"]),
  satisfiedByRefs: z.array(z.string()),
  evidence: z.string(),
});

export const RetainedSeismicHazardModelSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  hazardType: RetainedSeismicHazardModelTypeSchema,
  hazardAnalysisRef: z.string(),
  initiatingEventRefs: z.array(z.string()),
  sourceSscRefs: z.array(z.string()),
  affectedSscRefs: z.array(z.string()),
  fragilityRefs: z.array(z.string()),
  plantResponseModelRefs: z.array(z.string()),
  requirementCompliance: z.array(RetainedHazardRequirementComplianceSchema),
  integrationBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MultiReactorImpactModelSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  applicable: z.boolean(),
  reactorUnitRefs: z.array(z.string()),
  sharedSscRefs: z.array(z.string()),
  sharedHazardAndDependencyDescription: z.string(),
  concurrentInitiatingEventRefs: z.array(z.string()),
  multiUnitEventSequenceRefs: z.array(z.string()),
  sharedHumanActionRefs: z.array(z.string()),
  sharedRadioactiveSourceRefs: z.array(z.string()),
  modelImplementation: z.string(),
  exclusionBasis: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicPlantResponseModelSchema = z.object({
  baseInternalEventsModelRefs: z.array(z.string()),
  baseNonSeismicHazardModelRefs: z.array(z.string()),
  eventSequenceRefs: z.array(z.string()),
  systemsLogicModelRefs: z.array(z.string()),
  peerReviewFindingResolutions: z.array(PeerReviewFindingResolutionSchema),
  inducedFailures: z.array(SeismicallyInducedFailureModelSchema),
  nonSeismicFailureRefs: z.array(z.string()),
  unavailabilityRefs: z.array(z.string()),
  humanErrorRefs: z.array(z.string()),
  plantOperatingStateRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()),
  fragilityThresholds: z.array(FragilityThresholdDefinitionSchema),
  contactChatterModels: z.array(ContactChatterModelSchema),
  missionTimeAssessments: z.array(SeismicMissionTimeAssessmentSchema),
  newSeismicLogic: z.array(NewSeismicLogicSchema),
  retainedHazardModels: z.array(RetainedSeismicHazardModelSchema),
  multiReactorModels: z.array(MultiReactorImpactModelSchema),
  modificationsFromBaseModel: z.array(z.string()),
  completenessAndConsistencyReview: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicEquipmentListDevelopmentSchema = z.object({
  internalEventsSystemsModelRef: z.string(),
  additionalSeismicSystemRefs: z.array(z.string()),
  equipment: z.array(SeismicEquipmentListEntrySchema),
  internalFloodSourceRefs: z.array(z.string()),
  internalFireIgnitionSourceRefs: z.array(z.string()),
  secondaryHazardSscRefs: z.array(z.string()),
  additionalStructuresAndPassiveSscRefs: z.array(z.string()),
  failureModeIdentificationProcess: z.string(),
  systemsFragilityAnalystCoordination: z.string(),
  completenessChecks: z.array(z.string()),
  revisionBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicHumanActionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  humanFailureEventRef: z.string(),
  recoveryAction: z.boolean(),
  sourceInternalEventsHfeRef: z.string().optional(),
  eventSequenceRefs: z.array(z.string()),
  controlRoomOrExControlRoom: z.enum(["CONTROL_ROOM", "EX_CONTROL_ROOM", "BOTH"]),
  seismicSpecificChallenges: z.object({
    trainingAndProcedures: z.string(),
    workloadAndStress: z.string(),
    mitigationImpact: z.string(),
    timingAndAccessibility: z.string(),
    physicalHazards: z.string(),
    jobAidsAndTraining: z.string(),
  }),
  availableTime: z.number(),
  requiredTime: z.number(),
  timeUnits: z.string(),
  humanErrorProbability: z.number(),
  probabilityDistribution: ParameterDistributionSchema.optional(),
  dependencyRefs: z.array(z.string()),
  feasibilityBasis: z.string(),
  humanReliabilityAnalysisRef: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicHumanReliabilityModelSchema = z.object({
  relevantInternalEventsHfeRefs: z.array(z.string()),
  humanActions: z.array(SeismicHumanActionSchema),
  responseActionRequirementCompliance: z.string(),
  hfeDefinitionRequirementCompliance: z.string(),
  recoveryRequirementCompliance: z.string(),
  quantificationRequirementCompliance: z.string(),
  seismicInfluenceIntegration: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HazardDiscretizationBinSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  hazardCurveRef: z.string(),
  lowerGroundMotion: z.number(),
  upperGroundMotion: z.number(),
  representativeGroundMotion: z.number(),
  groundMotionUnits: z.string(),
  annualFrequency: z.number(),
  conditionalFrequencyMethod: z.string(),
  fragilityEvaluationRefs: z.array(z.string()),
  eventSequenceFamilyRefs: z.array(z.string()),
  contributionToRiskMetric: z.number().optional(),
});

export const HazardDiscretizationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  hazardCurveRefs: z.array(z.string()),
  bins: z.array(HazardDiscretizationBinSchema),
  numericalMethod: z.string(),
  convergenceMetric: z.string(),
  convergenceTolerance: z.number(),
  convergenceStudies: z.array(
    z.object({
      binCount: z.number(),
      metricValue: z.number(),
      relativeChange: z.number(),
    }),
  ),
  converged: z.boolean(),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RareEventApproximationAssessmentSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  affectedModelRef: z.string(),
  approximationMethod: z.string(),
  fragilityRefsApproachingUnity: z.array(z.string()),
  overestimationMechanism: z.string(),
  uncorrectedResult: z.number().optional(),
  correctedResult: z.number().optional(),
  correctionMethod: z.string(),
  impactAssessment: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EsqRequirementComplianceSchema = z.object({
  requirement: z.string(),
  applicable: z.boolean(),
  status: z.enum(["MET", "PARTIAL", "NOT_MET", "NOT_APPLICABLE"]),
  satisfiedByRefs: z.array(z.string()),
  evidence: z.string(),
});

export const SeismicEventSequenceFamilyQuantificationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  eventSequenceFamilyRef: z.string(),
  initiatingEventRefs: z.array(z.string()),
  eventSequenceRefs: z.array(z.string()),
  releaseCategoryRef: z.string().optional(),
  sourceTermRef: z.string().optional(),
  hazardDiscretizationRef: z.string(),
  meanHazardUsed: z.boolean(),
  meanFragilitiesUsed: z.boolean(),
  pointEstimateFrequency: z.number(),
  meanFrequency: z.number().optional(),
  frequencyUnit: z.literal("PER_PLANT_YEAR"),
  frequencyDistribution: ParameterDistributionSchema.optional(),
  hazardBinContributions: z.array(
    z.object({
      binRef: z.string(),
      frequencyContribution: z.number(),
    }),
  ),
  uncertaintyContributions: z.array(
    z.object({
      sourceType: z.enum(["HAZARD", "FRAGILITY", "SYSTEMS"]),
      sourceRef: z.string(),
      contributionDescription: z.string(),
    }),
  ),
  truncationAndScreeningTreatment: z.string(),
  quantificationMethod: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicRiskContributorSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  contributorType: z.enum(["INITIATING_EVENT", "EVENT_SEQUENCE", "EVENT_SEQUENCE_FAMILY", "BASIC_EVENT", "SSC", "HUMAN_ACTION", "HAZARD_BIN"]),
  contributorRef: z.string(),
  affectedEventSequenceFamilyRefs: z.array(z.string()),
  contributionValue: z.number().optional(),
  contributionMetric: z.string(),
  importance: ImportanceLevelSchema,
  designOperationMaintenanceContext: z.string(),
  riskInsight: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicSignificantCutsetSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  eventSequenceFamilyRef: z.string(),
  eventSequenceRef: z.string(),
  initiatingEventRef: z.string(),
  dominantHazardBinRef: z.string(),
  basicEventRefs: z.array(z.string()),
  humanFailureEventRefs: z.array(z.string()),
  meanFrequency: z.number(),
  contributionFraction: z.number(),
  reviewStatus: z.enum(["VERIFIED", "OPEN"]),
  reviewBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PlantResponseUncertaintySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  sourceArea: z.enum(["HAZARD_INTERFACE", "FRAGILITY_INTERFACE", "SYSTEMS_MODEL", "HUMAN_RELIABILITY", "QUANTIFICATION"]),
  uncertaintyType: z.enum(["PARAMETER", "MODEL"]),
  description: z.string(),
  affectedModelRefs: z.array(z.string()),
  affectedEventSequenceFamilyRefs: z.array(z.string()),
  relatedAssumptions: z.array(z.string()),
  reasonableAlternatives: z.array(z.string()),
  treatment: z.string(),
  propagated: z.boolean(),
  sensitivityStudyRefs: z.array(z.string()),
  importance: ImportanceLevelSchema.optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicPlantResponseQuantificationSchema = z.object({
  hazardDiscretizations: z.array(HazardDiscretizationSchema),
  rareEventApproximationAssessments: z.array(RareEventApproximationAssessmentSchema),
  esqRequirementCompliance: z.array(EsqRequirementComplianceSchema),
  eventSequenceFamilyQuantifications: z.array(SeismicEventSequenceFamilyQuantificationSchema),
  resultType: z.enum(["POINT_ESTIMATES", "MEANS_WITH_PROPAGATED_PARAMETER_UNCERTAINTY"]),
  integratedHazardFragilitySystemsMethod: z.string(),
  parameterUncertaintyPropagationMethod: z.string().optional(),
  modelUncertainties: z.array(PlantResponseUncertaintySchema),
  combinedAssumptionEvaluation: z.string(),
  sensitivityStudies: z.array(SensitivityStudySchema),
  significantCutsets: z.array(SeismicSignificantCutsetSchema).default([]),
  riskSignificantContributors: z.array(SeismicRiskContributorSchema),
  outputQualityChecks: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicPlantResponseDocumentationSchema = z.object({
  processDescription: z.string(),
  inputsDescription: z.string(),
  seismicEquipmentListDevelopment: z.string(),
  baseModelModifications: z.string(),
  seismicHumanReliabilityInfluences: z.string(),
  quantificationMethods: z.string(),
  eventSequenceFamilyResults: z.string(),
  sensitivityStudyResults: z.string(),
  riskSignificantContributors: z.string(),
  modelUncertaintiesAndAlternatives: z.string(),
  preOperationalLimitations: z.string().optional(),
  quantificationLimitations: z.array(z.string()),
  dataModelAndCalculationRefs: z.array(z.string()),
  traceability: z.array(
    z.object({
      initiatingEventRef: z.string(),
      eventSequenceRefs: z.array(z.string()),
      equipmentRefs: z.array(z.string()),
      fragilityRefs: z.array(z.string()),
      hazardRefs: z.array(z.string()),
      quantificationRef: z.string(),
    }),
  ),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicPlantResponseAnalysisSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  praScope: z.string(),
  initiatingEventIdentification: InitiatingEventIdentificationSchema,
  plantResponseModel: SeismicPlantResponseModelSchema,
  seismicEquipmentListDevelopment: SeismicEquipmentListDevelopmentSchema,
  humanReliabilityModel: SeismicHumanReliabilityModelSchema,
  quantification: SeismicPlantResponseQuantificationSchema,
  modelUncertainty: BaseModelUncertaintyDocumentationSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  documentation: SeismicPlantResponseDocumentationSchema,
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertSprMirrorsType = Expect<Equal<z.infer<typeof SeismicPlantResponseAnalysisSchema>, SeismicPlantResponseAnalysis>>;
