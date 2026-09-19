import { z } from "zod";
import type { InternalFirePRA } from "../../internal-fire/internal-fire-pra";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { HazardConditionedMethodModelsSchema, createEmptyHazardConditionedMethodModels } from "../hazard-conditioned-models";
import {
  InternalFireAnalysisRecordSchema,
  InternalFireInvestigationSchema,
  InternalFireModelUncertaintySchema,
  InternalFirePraInterfaceRecordSchema,
  InternalFirePraSubelementSchema,
  InternalFirePreOperationalAssumptionSchema,
  InternalFireProcessDocumentationSchema,
  InternalFireScreeningDecisionSchema,
} from "./internal-fire-pra-common";

export const InternalFirePraApplicationSchema = InternalFireAnalysisRecordSchema.extend({
  purpose: z.string(),
  decisionContext: z.string(),
  supportedRiskMetrics: z.array(z.string()),
  consumingElementRefs: z.array(z.string()),
  configurationBasis: z.string(),
  limitations: z.array(z.string()),
});

export const InternalFirePraEvidenceRecordSchema = InternalFireAnalysisRecordSchema.extend({
  evidenceType: z.enum(["DRAWING", "CALCULATION", "PROCEDURE", "DATA", "MODEL", "WALKDOWN", "INTERVIEW", "FIRE_EVENT", "REVIEW", "OTHER"]),
  sourceReference: z.string(),
  revision: z.string().optional(),
  effectiveDate: z.string().optional(),
  applicableSubelements: z.array(InternalFirePraSubelementSchema),
  applicability: z.string(),
  qualityAndLimitations: z.string(),
  fileReference: z.string().optional(),
  supersedesEvidenceRef: z.string().optional(),
  controlled: z.boolean(),
});

export const InternalFireBaselinePraRecordTreatmentSchema = InternalFireAnalysisRecordSchema.extend({
  technicalArea: z.enum(["PLANT_OPERATING_STATES", "INITIATING_EVENTS", "EVENT_SEQUENCES", "SUCCESS_CRITERIA", "SYSTEMS", "DATA", "HUMAN_RELIABILITY", "RISK_INTEGRATION"]),
  sourceRecordRefs: z.array(z.string()),
  treatment: z.enum(["REUSED", "MODIFIED", "NEW", "NOT_APPLICABLE"]),
  internalFireChange: z.string(),
  unresolvedItems: z.array(z.string()),
});

export const InternalFireBaselinePraDefinitionSchema = z.object({
  modelName: z.string(),
  modelReference: z.string(),
  revision: z.string(),
  freezeDate: z.string(),
  freezeStatus: z.enum(["WORKING", "FROZEN", "REFERENCE_ONLY"]),
  modelBoundary: z.string(),
  plantOperatingStateRefs: z.array(z.string()),
  reactorUnitRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()),
  recordTreatments: z.array(InternalFireBaselinePraRecordTreatmentSchema),
  unresolvedInterfaces: z.array(z.string()),
});

export const FireGlobalAnalysisBoundarySchema = InternalFireAnalysisRecordSchema.extend({
  includedLocationRefs: z.array(z.string()),
  excludedLocations: z.array(z.object({ uuid: z.string(), location: z.string(), exclusionBasis: z.string(), evidenceRefs: z.array(z.string()) })),
  licenseeControlledAreaDescription: z.string(),
  reactorUnitRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()),
  atPowerOperatingStateRefs: z.array(z.string()),
  multiUnitOrMultiSourceLocations: z.array(z.string()),
});

export const FirePartitioningElementSchema = InternalFireAnalysisRecordSchema.extend({
  elementType: z.enum(["RATED_WALL", "NONRATED_WALL", "RATED_DOOR", "ACTIVE_BARRIER", "FLOOR_CEILING", "SPATIAL_SEPARATION", "OTHER"]),
  fromPauRef: z.string(),
  toPauRef: z.string().optional(),
  fireResistanceRatingMinutes: z.number().optional(),
  credited: z.boolean(),
  maintainedByFireProtectionProgram: z.boolean(),
  condition: z.string(),
  containmentBasis: z.string(),
});

export const FirePhysicalAnalysisUnitSchema = InternalFireAnalysisRecordSchema.extend({
  fireArea: z.string(),
  fireCompartment: z.string(),
  building: z.string(),
  rooms: z.array(z.string()),
  elevation: z.string(),
  volumeCubicMetres: z.number(),
  boundaryElementRefs: z.array(z.string()),
  adjacentPauRefs: z.array(z.string()),
  ventilationZones: z.array(z.string()),
  reactorUnitRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()),
  fixedIgnitionSourceRefs: z.array(z.string()),
  transientCombustibleZones: z.array(z.string()),
  creditedBarrierRefs: z.array(z.string()),
  fireProtectionFeatures: z.array(z.string()),
});

export const FirePartitioningCoverageCheckSchema = InternalFireAnalysisRecordSchema.extend({
  complete: z.boolean(),
  nonOverlapping: z.boolean(),
  unassignedLocations: z.array(z.string()),
  overlappingPauPairs: z.array(z.array(z.string())),
  excludedLocationRefs: z.array(z.string()),
  reconciliationMethod: z.string(),
});

export const InternalFirePlantBoundaryAndPartitioningSchema = z.object({
  globalBoundary: FireGlobalAnalysisBoundarySchema,
  physicalAnalysisUnits: z.array(FirePhysicalAnalysisUnitSchema),
  partitioningElements: z.array(FirePartitioningElementSchema),
  coverageChecks: z.array(FirePartitioningCoverageCheckSchema),
  investigations: z.array(InternalFireInvestigationSchema),
  modelUncertainties: z.array(InternalFireModelUncertaintySchema),
  preOperationalAssumptions: z.array(InternalFirePreOperationalAssumptionSchema),
  documentation: InternalFireProcessDocumentationSchema,
});

export const FireInitiatingEventSelectionSchema = InternalFireAnalysisRecordSchema.extend({
  initiatingEventRef: z.string(),
  sourceTechnicalElementRef: z.string(),
  selectionType: z.enum(["BASELINE_INCLUDED", "BASELINE_SCREENED_RECONSIDERED", "FIRE_UNIQUE"]),
  fireCausingEquipmentRefs: z.array(z.string()),
  spuriousOperationCombinations: z.array(z.array(z.string())),
  affectedReactorUnitRefs: z.array(z.string()),
  affectedRadioactiveMaterialSourceRefs: z.array(z.string()),
  disposition: z.enum(["INCLUDE", "EXCLUDE"]),
  exclusionCriterion: z.enum(["SCR-2", "SCR-3"]).optional(),
});

export const FireEquipmentSelectionRecordSchema = InternalFireAnalysisRecordSchema.extend({
  equipmentRef: z.string(),
  systemRef: z.string(),
  equipmentType: z.string(),
  creditedFunctions: z.array(z.string()),
  selectionBasis: z.array(z.enum(["INITIATING_EVENT", "MITIGATION", "SAFE_SHUTDOWN", "CONTAINMENT", "MULTI_UNIT", "HUMAN_ACTION_SUPPORT"])),
  fireFailureModes: z.array(z.enum(["LOSS_OF_FUNCTION", "SPURIOUS_OPERATION", "SPURIOUS_INDICATION", "LOSS_OF_SIGNAL", "ERRONEOUS_SIGNAL"])),
  affectedInitiatingEventRefs: z.array(z.string()),
  affectedSuccessCriterionRefs: z.array(z.string()),
  physicalAnalysisUnitRefs: z.array(z.string()),
  cableRefs: z.array(z.string()),
  modelBasicEventRefs: z.array(z.string()),
  disposition: z.enum(["INCLUDE", "EXCLUDE"]),
  exclusionCriterion: z.enum(["SCR-2", "SCR-3"]).optional(),
});

export const FireInstrumentationSelectionRecordSchema = InternalFireAnalysisRecordSchema.extend({
  instrumentRef: z.string(),
  monitoredParameter: z.string(),
  supportedHumanActionRefs: z.array(z.string()),
  credibleFailureModes: z.array(z.enum(["LOSS_OF_SIGNAL", "SPURIOUS_INDICATION", "ERRONEOUS_INDICATION"])),
  undesirableOperatorResponse: z.string(),
  physicalAnalysisUnitRefs: z.array(z.string()),
  cableRefs: z.array(z.string()),
  disposition: z.enum(["INCLUDE", "EXCLUDE"]),
});

export const InternalFireEquipmentSelectionSchema = z.object({
  initiatingEventSelections: z.array(FireInitiatingEventSelectionSchema),
  equipmentSelections: z.array(FireEquipmentSelectionRecordSchema),
  instrumentationSelections: z.array(FireInstrumentationSelectionRecordSchema),
  modelUncertainties: z.array(InternalFireModelUncertaintySchema),
  preOperationalAssumptions: z.array(InternalFirePreOperationalAssumptionSchema),
  documentation: InternalFireProcessDocumentationSchema,
});

export const FireRacewayRecordSchema = InternalFireAnalysisRecordSchema.extend({
  racewayId: z.string(),
  racewayType: z.enum(["CABLE_TRAY", "CONDUIT", "CABLE_DUCT", "CABLE_TUNNEL", "PENETRATION", "OTHER"]),
  physicalAnalysisUnitRef: z.string(),
  routeDescription: z.string(),
  elevation: z.string(),
  fireBarrierProtectionRefs: z.array(z.string()),
  cableRefs: z.array(z.string()),
  materialAndConfiguration: z.string(),
  sourceDocumentRefs: z.array(z.string()),
});

export const FireCableSelectionRecordSchema = InternalFireAnalysisRecordSchema.extend({
  cableId: z.string(),
  equipmentRef: z.string(),
  function: z.string(),
  cableType: z.enum(["POWER", "CONTROL", "INSTRUMENTATION", "COMMUNICATION", "OTHER"]),
  voltageClass: z.string(),
  fromTermination: z.string(),
  toTermination: z.string(),
  physicalAnalysisUnitRefs: z.array(z.string()),
  racewayRefs: z.array(z.string()),
  associatedFailureModes: z.array(z.string()),
  modelBasicEventRefs: z.array(z.string()),
  routingStatus: z.enum(["EXACT", "ASSUMED", "NOT_ROUTED"]),
  routingBasis: z.string(),
  riskSignificant: z.boolean(),
});

export const FireAssumedCableRoutingSchema = InternalFireAnalysisRecordSchema.extend({
  cableRefs: z.array(z.string()),
  assumedPauRefs: z.array(z.string()),
  assumedRacewayRefs: z.array(z.string()),
  scopeAndExtent: z.string(),
  conservatism: z.string(),
  closureAction: z.string(),
});

export const FireOvercurrentProtectionAssessmentSchema = InternalFireAnalysisRecordSchema.extend({
  distributionBusRef: z.string(),
  protectiveDeviceRefs: z.array(z.string()),
  coordinationDocumentRef: z.string(),
  coordinationAdequate: z.boolean(),
  additionalCircuitRefs: z.array(z.string()),
  challengeDescription: z.string(),
  modelTreatment: z.string(),
});

export const InternalFireCableSelectionAndLocationSchema = z.object({
  raceways: z.array(FireRacewayRecordSchema),
  cables: z.array(FireCableSelectionRecordSchema),
  assumedRouting: z.array(FireAssumedCableRoutingSchema),
  overcurrentProtectionAssessments: z.array(FireOvercurrentProtectionAssessmentSchema),
  modelUncertainties: z.array(InternalFireModelUncertaintySchema),
  preOperationalAssumptions: z.array(InternalFirePreOperationalAssumptionSchema),
  documentation: InternalFireProcessDocumentationSchema,
});

export const InternalFireQualitativeScreeningSchema = z.object({
  screeningCriteria: z.array(InternalFireAnalysisRecordSchema),
  screeningDecisions: z.array(InternalFireScreeningDecisionSchema),
  retainedPauRefs: z.array(z.string()),
  screenedPauRefs: z.array(z.string()),
  modelUncertainties: z.array(InternalFireModelUncertaintySchema),
  preOperationalAssumptions: z.array(InternalFirePreOperationalAssumptionSchema),
  documentation: InternalFireProcessDocumentationSchema,
});

export const FirePeerReviewDispositionSchema = InternalFireAnalysisRecordSchema.extend({
  sourcePeerReviewRef: z.string(),
  findingRef: z.string(),
  applicability: z.string(),
  disposition: z.string(),
  incorporated: z.boolean(),
  verificationRefs: z.array(z.string()),
});

export const FireInitiatingEventModelSchema = InternalFireAnalysisRecordSchema.extend({
  initiatingEventRef: z.string(),
  sourceSelectionRef: z.string(),
  eventTreeRef: z.string(),
  fireScenarioRefs: z.array(z.string()),
  affectedUnitRefs: z.array(z.string()),
  plantResponseModelTreatment: z.enum(["REUSED", "MODIFIED", "NEW"]),
});

export const FireEventSequenceModelSchema = InternalFireAnalysisRecordSchema.extend({
  initiatingEventRef: z.string(),
  baselineEventSequenceRef: z.string().optional(),
  fireScenarioRefs: z.array(z.string()),
  topEvents: z.array(z.string()),
  endStates: z.array(z.string()),
  fireProcedureRefs: z.array(z.string()),
  eventSequenceFamilyRefs: z.array(z.string()),
  modelTreatment: z.enum(["REUSED", "MODIFIED", "NEW"]),
});

export const FireSuccessCriterionSchema = InternalFireAnalysisRecordSchema.extend({
  function: z.string(),
  baselineSuccessCriterionRef: z.string().optional(),
  successDefinition: z.string(),
  missionTimeHours: z.number(),
  requiredSystemTrainRefs: z.array(z.string()),
  fireSpecificConditions: z.array(z.string()),
  analysisRef: z.string(),
  modelTreatment: z.enum(["REUSED", "MODIFIED", "NEW"]),
});

export const FireSystemModelModificationSchema = InternalFireAnalysisRecordSchema.extend({
  systemRef: z.string(),
  baselineModelRef: z.string(),
  affectedBasicEventRefs: z.array(z.string()),
  fireEquipmentRefs: z.array(z.string()),
  cableRefs: z.array(z.string()),
  spuriousOperationRefs: z.array(z.string()),
  humanFailureEventRefs: z.array(z.string()),
  splitFractionRefs: z.array(z.string()),
  modelChange: z.string(),
});

export const FireProbabilityDataParameterSchema = InternalFireAnalysisRecordSchema.extend({
  parameterRef: z.string(),
  parameterType: z.enum(["RANDOM_FAILURE", "UNAVAILABILITY", "COMMON_CAUSE", "FIRE_CONTEXT_OTHER"]),
  baselineValue: z.number().optional(),
  fireContextValue: z.number(),
  uncertaintyDistribution: z.string(),
  sourceDataRef: z.string(),
  reanalysisRequired: z.boolean(),
});

export const InternalFirePlantResponseModelSchema = z.object({
  peerReviewDispositions: z.array(FirePeerReviewDispositionSchema),
  initiatingEventModels: z.array(FireInitiatingEventModelSchema),
  eventSequenceModels: z.array(FireEventSequenceModelSchema),
  successCriteria: z.array(FireSuccessCriterionSchema),
  systemModelModifications: z.array(FireSystemModelModificationSchema),
  probabilityDataParameters: z.array(FireProbabilityDataParameterSchema),
  modelUncertainties: z.array(InternalFireModelUncertaintySchema),
  preOperationalAssumptions: z.array(InternalFirePreOperationalAssumptionSchema),
  documentation: InternalFireProcessDocumentationSchema,
});

export const FireIgnitionSourceSchema = InternalFireAnalysisRecordSchema.extend({
  physicalAnalysisUnitRef: z.string(),
  sourceType: z.enum(["ELECTRICAL_CABINET", "SWITCHGEAR", "TRANSFORMER", "PUMP", "MOTOR", "TURBINE", "CABLE", "WELDING", "TRANSIENT_COMBUSTIBLE", "HIGH_ENERGY_ARC", "OTHER"]),
  mobility: z.enum(["FIXED", "TRANSIENT"]),
  locationDescription: z.string(),
  fuelDescription: z.string(),
  ignitionFrequencyGroupRef: z.string(),
  heatReleaseRateProfileRef: z.string(),
  secondaryCombustibleRefs: z.array(z.string()),
  highHazard: z.boolean(),
  structuralSteelExposureRefs: z.array(z.string()),
});

export const FireDamageTargetSetSchema = InternalFireAnalysisRecordSchema.extend({
  physicalAnalysisUnitRefs: z.array(z.string()),
  equipmentRefs: z.array(z.string()),
  cableRefs: z.array(z.string()),
  racewayRefs: z.array(z.string()),
  failureModes: z.array(z.string()),
  damageMechanisms: z.array(z.enum(["THERMAL", "FLAME_IMPINGEMENT", "SMOKE", "HOT_GAS_LAYER", "STRUCTURAL_COLLAPSE", "OTHER"])),
  damageThresholds: z.array(z.object({ uuid: z.string(), targetRef: z.string(), parameter: z.string(), value: z.number(), unit: z.string(), sourceRef: z.string() })),
  modelBasicEventRefs: z.array(z.string()),
});

export const FireDetectionSuppressionAssessmentSchema = InternalFireAnalysisRecordSchema.extend({
  physicalAnalysisUnitRef: z.string(),
  fireScenarioRef: z.string(),
  detectionSystemRefs: z.array(z.string()),
  automaticSuppressionSystemRefs: z.array(z.string()),
  manualSuppressionCredited: z.boolean(),
  timeToDetectionMinutes: z.number(),
  timeAvailableBeforeDamageMinutes: z.number(),
  nonsuppressionProbability: z.number(),
  fifthPercentile: z.number().optional(),
  ninetyFifthPercentile: z.number().optional(),
  dependencies: z.array(z.string()),
  effectivenessBasis: z.string(),
});

export const FireBarrierAssessmentSchema = InternalFireAnalysisRecordSchema.extend({
  barrierRef: z.string(),
  affectedPauRefs: z.array(z.string()),
  fireResistanceRatingMinutes: z.number().optional(),
  rated: z.boolean(),
  active: z.boolean(),
  reliability: z.number(),
  availability: z.number(),
  qualificationOrTestRef: z.string().optional(),
  failureScenarioRefs: z.array(z.string()),
  effectivenessBasis: z.string(),
});

export const FireModelAnalysisSchema = InternalFireAnalysisRecordSchema.extend({
  fireScenarioRef: z.string(),
  toolName: z.string(),
  toolVersion: z.string(),
  modelType: z.enum(["ANALYTICAL", "EMPIRICAL", "STATISTICAL", "COMPUTATIONAL", "EXPERT_JUDGMENT"]),
  applicabilityLimits: z.array(z.string()),
  inputValues: z.array(z.object({ uuid: z.string(), parameter: z.string(), value: z.number(), unit: z.string(), sourceRef: z.string() })),
  peakHeatReleaseRateKw: z.number(),
  growthTimeMinutes: z.number(),
  steadyBurnMinutes: z.number(),
  decayTimeMinutes: z.number(),
  targetDamageTimesMinutes: z.array(z.object({ uuid: z.string(), targetRef: z.string(), damageTimeMinutes: z.number(), mechanism: z.string() })),
  severityFactor: z.number(),
  conditionalTargetDamageProbability: z.number(),
  uncertaintyTreatment: z.string(),
  withinApplicabilityLimits: z.boolean(),
});

export const FireScenarioSchema = InternalFireAnalysisRecordSchema.extend({
  physicalAnalysisUnitRefs: z.array(z.string()),
  ignitionSourceRefs: z.array(z.string()),
  damageTargetSetRef: z.string(),
  fireModelAnalysisRef: z.string(),
  detectionSuppressionAssessmentRef: z.string(),
  barrierAssessmentRefs: z.array(z.string()),
  initiatingEventRefs: z.array(z.string()),
  plantOperatingStateRefs: z.array(z.string()),
  reactorUnitRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()),
  scenarioType: z.enum(["SINGLE_COMPARTMENT", "MULTI_COMPARTMENT", "CONTROL_ROOM_ABANDONMENT", "STRUCTURAL_STEEL"]),
  commandAndControlTransferRequired: z.boolean(),
  structuralSteelFailureEvaluated: z.boolean(),
  smokeDamageEvaluation: z.string(),
  secondaryCombustibleTreatment: z.string(),
  disposition: z.enum(["SCREENED", "RETAINED", "QUANTIFIED"]),
});

export const InternalFireScenarioSelectionAndAnalysisSchema = z.object({
  ignitionSources: z.array(FireIgnitionSourceSchema),
  damageTargetSets: z.array(FireDamageTargetSetSchema),
  fireScenarios: z.array(FireScenarioSchema),
  fireModelAnalyses: z.array(FireModelAnalysisSchema),
  detectionSuppressionAssessments: z.array(FireDetectionSuppressionAssessmentSchema),
  barrierAssessments: z.array(FireBarrierAssessmentSchema),
  screeningDecisions: z.array(InternalFireScreeningDecisionSchema),
  investigations: z.array(InternalFireInvestigationSchema),
  modelUncertainties: z.array(InternalFireModelUncertaintySchema),
  preOperationalAssumptions: z.array(InternalFirePreOperationalAssumptionSchema),
  documentation: InternalFireProcessDocumentationSchema,
});

export const FireEventDataSourceSchema = InternalFireAnalysisRecordSchema.extend({
  sourceType: z.enum(["NUCLEAR_INDUSTRY", "NONNUCLEAR_INDUSTRY", "PLANT_SPECIFIC", "EXPERT_JUDGMENT"]),
  reference: z.string(),
  eventCount: z.number(),
  exposurePlantYears: z.number(),
  applicableTechnology: z.string(),
  inclusionCriteria: z.array(z.string()),
  exclusionCriteria: z.array(z.string()),
  applicabilityAssessment: z.string(),
  availableForReview: z.boolean(),
});

export const FireIgnitionFrequencyGroupSchema = InternalFireAnalysisRecordSchema.extend({
  sourceCategory: z.string(),
  eventDataSourceRefs: z.array(z.string()),
  genericFrequencyPerPlantYear: z.number(),
  updatedFrequencyPerPlantYear: z.number().optional(),
  updateMethod: z.enum(["GENERIC", "BAYESIAN", "EQUIVALENT_STATISTICAL", "EXPERT_JUDGMENT"]),
  plantAvailabilityFactor: z.number(),
  uncertaintyDistribution: z.string(),
  parameterDependencies: z.array(z.string()),
});

export const FirePlantExperienceReviewSchema = InternalFireAnalysisRecordSchema.extend({
  reviewPeriod: z.string(),
  plantYears: z.number(),
  fireEventRefs: z.array(z.string()),
  outlierDetected: z.boolean(),
  outlierBasis: z.string(),
  frequencyUpdateRequired: z.boolean(),
});

export const FireIgnitionFrequencyEstimateSchema = InternalFireAnalysisRecordSchema.extend({
  ignitionSourceRef: z.string(),
  physicalAnalysisUnitRef: z.string(),
  frequencyGroupRef: z.string(),
  apportionmentFactors: z.array(z.object({ uuid: z.string(), factorName: z.string(), value: z.number(), basis: z.string() })),
  meanFrequencyPerPlantYear: z.number(),
  fifthPercentile: z.number().optional(),
  ninetyFifthPercentile: z.number().optional(),
  uncertaintyDistribution: z.string(),
  preservesPlantWideFrequency: z.boolean(),
});

export const InternalFireIgnitionFrequencySchema = z.object({
  eventDataSources: z.array(FireEventDataSourceSchema),
  frequencyGroups: z.array(FireIgnitionFrequencyGroupSchema),
  plantExperienceReviews: z.array(FirePlantExperienceReviewSchema),
  frequencyEstimates: z.array(FireIgnitionFrequencyEstimateSchema),
  reconciliationChecks: z.array(InternalFireAnalysisRecordSchema),
  modelUncertainties: z.array(InternalFireModelUncertaintySchema),
  preOperationalAssumptions: z.array(InternalFirePreOperationalAssumptionSchema),
  documentation: InternalFireProcessDocumentationSchema,
});

export const FireCircuitRecordSchema = InternalFireAnalysisRecordSchema.extend({
  circuitId: z.string(),
  cableRefs: z.array(z.string()),
  equipmentRef: z.string(),
  circuitFunction: z.string(),
  powerSupplyRef: z.string(),
  protectiveDeviceRefs: z.array(z.string()),
  physicalAnalysisUnitRefs: z.array(z.string()),
  circuitConfiguration: z.string(),
});

export const FireCircuitFailureModeEvaluationSchema = InternalFireAnalysisRecordSchema.extend({
  circuitRef: z.string(),
  fireScenarioRefs: z.array(z.string()),
  cableRefs: z.array(z.string()),
  equipmentFailureMode: z.enum(["LOSS_OF_FUNCTION", "SPURIOUS_OPERATION", "SPURIOUS_INDICATION", "ERRONEOUS_SIGNAL"]),
  circuitFailureMode: z.enum(["OPEN_CIRCUIT", "SHORT_TO_GROUND", "CONDUCTOR_TO_CONDUCTOR_HOT_SHORT", "SHORT_BETWEEN_CABLES", "GROUND_FAULT", "OTHER"]),
  hotShortDurationCredited: z.boolean(),
  hotShortDurationSeconds: z.number().optional(),
  modelBasicEventRefs: z.array(z.string()),
  scenarioSpecificCharacteristics: z.array(z.string()),
});

export const FireCircuitFailureProbabilitySchema = InternalFireAnalysisRecordSchema.extend({
  failureModeEvaluationRef: z.string(),
  fireScenarioRefs: z.array(z.string()),
  meanProbability: z.number(),
  fifthPercentile: z.number().optional(),
  ninetyFifthPercentile: z.number().optional(),
  durationProbability: z.number().optional(),
  uncertaintyDistribution: z.string(),
  genericDataRef: z.string(),
  scenarioSpecificAdjustment: z.string(),
  bounding: z.boolean(),
});

export const InternalFireCircuitFailureAnalysisSchema = z.object({
  circuits: z.array(FireCircuitRecordSchema),
  failureModeEvaluations: z.array(FireCircuitFailureModeEvaluationSchema),
  failureProbabilities: z.array(FireCircuitFailureProbabilitySchema),
  modelUncertainties: z.array(InternalFireModelUncertaintySchema),
  preOperationalAssumptions: z.array(InternalFirePreOperationalAssumptionSchema),
  documentation: InternalFireProcessDocumentationSchema,
});

export const FireHumanActionSchema = InternalFireAnalysisRecordSchema.extend({
  actionType: z.enum(["BASELINE_RETAINED", "BASELINE_MODIFIED", "FIRE_SAFE_SHUTDOWN", "CONTROL_ROOM_ABANDONMENT", "RECOVERY", "UNDESIRED_RESPONSE"]),
  procedureRefs: z.array(z.string()),
  fireScenarioRefs: z.array(z.string()),
  eventSequenceRefs: z.array(z.string()),
  requiredLocation: z.string(),
  cuesAndIndications: z.array(z.string()),
  availableTimeMinutes: z.number(),
  executionTimeMinutes: z.number(),
  accessRoute: z.string(),
  requiredEquipment: z.array(z.string()),
  crew: z.string(),
});

export const FireHumanFailureEventSchema = InternalFireAnalysisRecordSchema.extend({
  humanActionRef: z.string(),
  basicEventRef: z.string(),
  failureDefinition: z.string(),
  fireScenarioRefs: z.array(z.string()),
  affectedEventSequenceRefs: z.array(z.string()),
  physicalAnalysisUnitRefs: z.array(z.string()),
  plantOperatingStateRefs: z.array(z.string()),
  reactorUnitRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()),
});

export const FireHumanPerformanceContextSchema = InternalFireAnalysisRecordSchema.extend({
  humanFailureEventRef: z.string(),
  fireScenarioRef: z.string(),
  smokeAndHeatConditions: z.string(),
  lightingAndVisibility: z.string(),
  alarmAndCueReliability: z.string(),
  spuriousIndicationEffects: z.string(),
  accessAndHabitability: z.string(),
  workloadAndStress: z.string(),
  communications: z.string(),
  procedureQuality: z.string(),
  staffingAndTraining: z.string(),
});

export const FireHepEstimateSchema = InternalFireAnalysisRecordSchema.extend({
  humanFailureEventRef: z.string(),
  performanceContextRef: z.string(),
  method: z.string(),
  screeningValueUsed: z.boolean(),
  meanHep: z.number(),
  fifthPercentile: z.number().optional(),
  ninetyFifthPercentile: z.number().optional(),
  uncertaintyDistribution: z.string(),
  dependencyGroupRefs: z.array(z.string()),
  recoveryCredited: z.boolean(),
  feasibilityDemonstrated: z.boolean(),
});

export const FireHumanDependencyAssessmentSchema = InternalFireAnalysisRecordSchema.extend({
  humanFailureEventRefs: z.array(z.string()),
  sharedCrew: z.boolean(),
  sharedCues: z.boolean(),
  sharedLocation: z.boolean(),
  temporalRelationship: z.string(),
  dependencyLevel: z.enum(["ZERO", "LOW", "MODERATE", "HIGH", "COMPLETE"]),
  jointHep: z.number(),
});

export const FireHumanActionConfirmationSchema = InternalFireAnalysisRecordSchema.extend({
  humanActionRefs: z.array(z.string()),
  confirmationType: z.enum(["PROCEDURE_REVIEW", "TALK_THROUGH", "SIMULATOR", "WALKDOWN", "DESIGNER_INTERVIEW"]),
  participants: z.array(z.string()),
  performedDate: z.string(),
  findings: z.array(z.string()),
  feasible: z.boolean(),
});

export const InternalFireHumanReliabilityAnalysisSchema = z.object({
  humanActions: z.array(FireHumanActionSchema),
  humanFailureEvents: z.array(FireHumanFailureEventSchema),
  performanceContexts: z.array(FireHumanPerformanceContextSchema),
  hepEstimates: z.array(FireHepEstimateSchema),
  dependencyAssessments: z.array(FireHumanDependencyAssessmentSchema),
  confirmations: z.array(FireHumanActionConfirmationSchema),
  modelUncertainties: z.array(InternalFireModelUncertaintySchema),
  preOperationalAssumptions: z.array(InternalFirePreOperationalAssumptionSchema),
  documentation: InternalFireProcessDocumentationSchema,
});

export const FireQuantificationRunSchema = InternalFireAnalysisRecordSchema.extend({
  modelVersion: z.string(),
  calculationDate: z.string(),
  software: z.string(),
  softwareVersion: z.string(),
  truncationLevel: z.number(),
  lowerTruncationCheck: z.number(),
  convergenceMetric: z.number(),
  convergenceCriterion: z.number(),
  converged: z.boolean(),
  includedFireScenarioRefs: z.array(z.string()),
  excludedFireScenarioRefs: z.array(z.string()),
  dependencyTreatment: z.string(),
  methodLimitations: z.array(z.string()),
});

export const FireScenarioQuantificationResultSchema = InternalFireAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(),
  fireScenarioRef: z.string(),
  initiatingEventRef: z.string(),
  ignitionFrequencyRef: z.string(),
  conditionalDamageProbability: z.number(),
  circuitFailureProbabilityRefs: z.array(z.string()),
  humanFailureEventRefs: z.array(z.string()),
  conditionalSequenceProbability: z.number(),
  meanFrequencyPerPlantYear: z.number(),
  fifthPercentile: z.number().optional(),
  ninetyFifthPercentile: z.number().optional(),
  eventSequenceFamilyRefs: z.array(z.string()),
  releaseCategoryRefs: z.array(z.string()),
  screened: z.boolean(),
});

export const FireEventSequenceFamilyResultSchema = InternalFireAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(),
  eventSequenceFamilyRef: z.string(),
  fireScenarioRefs: z.array(z.string()),
  initiatingEventRefs: z.array(z.string()),
  plantOperatingStateRefs: z.array(z.string()),
  reactorUnitRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()),
  releaseCategoryRef: z.string(),
  meanFrequencyPerPlantYear: z.number(),
  medianFrequencyPerPlantYear: z.number(),
  fifthPercentileFrequencyPerPlantYear: z.number(),
  ninetyFifthPercentileFrequencyPerPlantYear: z.number(),
  dominantCutsetRefs: z.array(z.string()),
});

export const FireRiskContributorSchema = InternalFireAnalysisRecordSchema.extend({
  contributorType: z.enum(["PAU", "IGNITION_SOURCE", "FIRE_SCENARIO", "EQUIPMENT", "CABLE", "CIRCUIT_FAILURE", "HFE", "EVENT_SEQUENCE_FAMILY"]),
  contributorRef: z.string(),
  meanFrequencyContributionPerPlantYear: z.number(),
  fractionalContribution: z.number(),
  fussellVesely: z.number().optional(),
  riskAchievementWorth: z.number().optional(),
  rank: z.number(),
});

export const FireUncertaintyResultSchema = InternalFireAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(),
  resultRef: z.string(),
  uncertaintySourceRefs: z.array(z.string()),
  propagationMethod: z.string(),
  sampleCount: z.number(),
  mean: z.number(),
  median: z.number(),
  fifthPercentile: z.number(),
  ninetyFifthPercentile: z.number(),
  modelUncertaintySensitivityRefs: z.array(z.string()),
});

export const FireQuantificationReviewSchema = InternalFireAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(),
  reviewType: z.enum(["CORRECTNESS", "COMPLETENESS", "CONSISTENCY", "CONVERGENCE", "TRACEABILITY"]),
  checksPerformed: z.array(z.string()),
  result: z.enum(["PASS", "OPEN", "FAIL"]),
  openItems: z.array(z.string()),
});

export const InternalFireEventSequenceQuantificationSchema = z.object({
  quantificationRuns: z.array(FireQuantificationRunSchema),
  scenarioResults: z.array(FireScenarioQuantificationResultSchema),
  eventSequenceFamilyResults: z.array(FireEventSequenceFamilyResultSchema),
  riskContributors: z.array(FireRiskContributorSchema),
  uncertaintyResults: z.array(FireUncertaintyResultSchema),
  reviews: z.array(FireQuantificationReviewSchema),
  screeningDecisions: z.array(InternalFireScreeningDecisionSchema),
  integratedModelUncertainties: z.array(InternalFireModelUncertaintySchema),
  preOperationalAssumptions: z.array(InternalFirePreOperationalAssumptionSchema),
  documentation: InternalFireProcessDocumentationSchema,
});

export const InternalFireConsistencyCheckSchema = InternalFireAnalysisRecordSchema.extend({
  checkType: z.enum(["PAU_SOURCE", "EQUIPMENT_CABLE", "CABLE_RACEWAY", "SCENARIO_TARGET", "SCENARIO_FREQUENCY", "CIRCUIT_MODEL", "HFE_CONTEXT", "FREQUENCY_RECONCILIATION", "TRACEABILITY", "OTHER"]),
  subelements: z.array(InternalFirePraSubelementSchema),
  comparedRefs: z.array(z.string()),
  method: z.string(),
  result: z.enum(["PASS", "OPEN", "FAIL", "NOT_APPLICABLE"]),
  openItems: z.array(z.string()),
});

export const InternalFirePraIntegrationSchema = z.object({
  interfaces: z.array(InternalFirePraInterfaceRecordSchema),
  consistencyChecks: z.array(InternalFireConsistencyCheckSchema),
  selectedPauRefs: z.array(z.string()),
  selectedEquipmentRefs: z.array(z.string()),
  selectedCableRefs: z.array(z.string()),
  retainedFireScenarioRefs: z.array(z.string()),
  ignitionFrequencyRefs: z.array(z.string()),
  circuitFailureResultRefs: z.array(z.string()),
  humanFailureEventRefs: z.array(z.string()),
  quantificationResultRefs: z.array(z.string()),
  unresolvedInterfaces: z.array(z.string()),
  integrationMethod: z.string(),
});

export const InternalFireRiskInsightSchema = InternalFireAnalysisRecordSchema.extend({
  insightType: z.enum(["DOMINANT_CONTRIBUTOR", "DEFENSE_IN_DEPTH", "MODEL_LIMITATION", "UNCERTAINTY", "DESIGN_OPPORTUNITY"]),
  contributorRefs: z.array(z.string()),
  affectedRiskMetric: z.string(),
  fractionalContribution: z.number().optional(),
  decisionImplication: z.string(),
});

export const InternalFireModelRefinementSchema = InternalFireAnalysisRecordSchema.extend({
  technicalArea: z.enum(["EVIDENCE", "PARTITIONING", "EQUIPMENT", "CABLE", "SCENARIO", "FREQUENCY", "CIRCUIT", "PLANT_RESPONSE", "HRA", "QUANTIFICATION"]),
  driverRefs: z.array(z.string()),
  affectedRecordRefs: z.array(z.string()),
  refinement: z.string(),
  expectedEffect: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  refinementStatus: z.enum(["PROPOSED", "IN_PROGRESS", "REQUANTIFIED", "CLOSED"]),
  quantificationIterationRef: z.string().optional(),
  result: z.string(),
  decisionBasis: z.string(),
});

export const InternalFireRefinementIterationSchema = InternalFireAnalysisRecordSchema.extend({
  modelVersion: z.string(),
  calculationDate: z.string(),
  refinementActionRefs: z.array(z.string()),
  aggregateMeanFrequencyPerPlantYear: z.number(),
  previousAggregateMeanFrequencyPerPlantYear: z.number().optional(),
  relativeChange: z.number().optional(),
  maximumFamilyRelativeChange: z.number().optional(),
  topContributorRefs: z.array(z.string()),
  contributorRankingStable: z.boolean(),
  newRiskSignificantContributorRefs: z.array(z.string()),
  decision: z.enum(["CONTINUE_REFINEMENT", "ACCEPT_STABLE"]),
});

export const InternalFireRiskInterpretationSchema = z.object({
  riskInsights: z.array(InternalFireRiskInsightSchema),
  refinementActions: z.array(InternalFireModelRefinementSchema),
  quantificationIterations: z.array(InternalFireRefinementIterationSchema),
  stoppingCriteria: z.object({
    maximumAggregateFrequencyChange: z.number(),
    maximumFamilyFrequencyChange: z.number(),
    maximumContributorRankShift: z.number(),
    requiredStableIterations: z.number(),
    requireNoNewRiskSignificantContributors: z.boolean(),
    basis: z.string(),
  }),
});

export const InternalFireRiskIntegrationResultSchema = InternalFireAnalysisRecordSchema.extend({
  modelVersion: z.string(),
  plantOperatingStateRefs: z.array(z.string()),
  reactorUnitRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()),
  eventSequenceFamilyRefs: z.array(z.string()),
  releaseCategoryRefs: z.array(z.string()),
  aggregateMeanFrequencyPerPlantYear: z.number(),
  fifthPercentileFrequencyPerPlantYear: z.number(),
  ninetyFifthPercentileFrequencyPerPlantYear: z.number(),
  otherHazardRiskRefs: z.array(z.string()),
  overlapTreatment: z.string(),
  dominantContributorRefs: z.array(z.string()),
  integrationStatus: z.enum(["DRAFT", "READY_FOR_RISK_INTEGRATION", "ACCEPTED_BY_RISK_INTEGRATION"]),
});

export const InternalFireRiskDecisionSchema = InternalFireAnalysisRecordSchema.extend({
  decisionType: z.enum(["DESIGN", "FIRE_PROTECTION_PROGRAM", "CONFIGURATION_CONTROL", "PROCEDURE", "MONITORING", "DATA_COLLECTION", "MODEL_CONTROL"]),
  driverRefs: z.array(z.string()),
  affectedSscRefs: z.array(z.string()),
  action: z.string(),
  duePhase: z.string(),
  disposition: z.enum(["IMPLEMENT", "MONITOR", "CONFIRM_PRE_OPERATIONAL", "RETAIN_CURRENT_BASIS", "FORWARD_TO_PLANT_PROCESS"]),
  verificationRefs: z.array(z.string()),
  reanalysisRequired: z.boolean(),
  riskIntegrationResultRef: z.string(),
});

export const InternalFireRiskTraceabilityPathSchema = InternalFireAnalysisRecordSchema.extend({
  evidenceRefs: z.array(z.string()),
  physicalAnalysisUnitRefs: z.array(z.string()),
  ignitionSourceRefs: z.array(z.string()),
  fireScenarioRefs: z.array(z.string()),
  equipmentRefs: z.array(z.string()),
  cableRefs: z.array(z.string()),
  circuitFailureRefs: z.array(z.string()),
  initiatingEventRefs: z.array(z.string()),
  humanFailureEventRefs: z.array(z.string()),
  eventSequenceFamilyRefs: z.array(z.string()),
  resultRefs: z.array(z.string()),
  decisionRefs: z.array(z.string()),
  complete: z.boolean(),
});

export const InternalFireControlledBaselineSchema = InternalFireAnalysisRecordSchema.extend({
  modelVersion: z.string(),
  quantificationRunRef: z.string(),
  reportRef: z.string(),
  configurationControlRecordId: z.string(),
  peerReviewRef: z.string(),
  packageManifestRefs: z.array(z.string()),
  unresolvedLimitations: z.array(z.string()),
  releaseStatus: z.enum(["WORKING", "CONTROLLED", "SUPERSEDED"]),
});

export const InternalFireRiskIntegrationBaselineSchema = z.object({
  results: z.array(InternalFireRiskIntegrationResultSchema),
  decisions: z.array(InternalFireRiskDecisionSchema),
  traceabilityPaths: z.array(InternalFireRiskTraceabilityPathSchema),
  controlledBaselines: z.array(InternalFireControlledBaselineSchema),
});

export const InternalFireWorkflowRecordSchema = InternalFireAnalysisRecordSchema.extend({
  workflowRecordType: z.enum(["REPORT_SECTION", "QUALITY_CHECK", "REVIEW_ASSIGNMENT", "REVIEW_FINDING", "APPROVAL_READINESS", "APPROVAL_SIGNATURE"]),
  discipline: z.string(),
  assignee: z.string(),
  dueDate: z.string().optional(),
  result: z.string(),
  verificationRefs: z.array(z.string()),
});

export const InternalFirePraWorkflowSchema = z.object({
  reportSections: z.array(InternalFireWorkflowRecordSchema),
  draftQualityChecks: z.array(InternalFireWorkflowRecordSchema),
  reviewAssignments: z.array(InternalFireWorkflowRecordSchema),
  reviewFindings: z.array(InternalFireWorkflowRecordSchema),
  approvalReadiness: z.array(InternalFireWorkflowRecordSchema),
  approvalSignatures: z.array(InternalFireWorkflowRecordSchema),
});

export const InternalFirePraDocumentationSchema = z.object({
  overallProcessDescription: z.string(),
  partitioningSummary: z.string(),
  equipmentSelectionSummary: z.string(),
  cableSelectionSummary: z.string(),
  qualitativeScreeningSummary: z.string(),
  plantResponseSummary: z.string(),
  scenarioAnalysisSummary: z.string(),
  ignitionFrequencySummary: z.string(),
  circuitFailureSummary: z.string(),
  humanReliabilitySummary: z.string(),
  quantificationSummary: z.string(),
  riskInsights: z.string(),
  uncertaintySummary: z.string(),
  configurationControlDescription: z.string(),
  peerReviewScope: z.string(),
  supportingDocumentRefs: z.array(z.string()),
});

export const InternalFirePraExampleDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["doc", "sheet", "image"]),
  sizeLabel: z.string(),
  uploadedLabel: z.string(),
  extracted: z.string(),
  linked: z.number(),
  url: z.string().optional(),
});

export const InternalFirePRASchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.INTERNAL_FIRE_PRA).shape,
  praScope: z.string(),
  hazardConditionedModels: HazardConditionedMethodModelsSchema.default(createEmptyHazardConditionedMethodModels),
  applications: z.array(InternalFirePraApplicationSchema),
  evidenceRegister: z.array(InternalFirePraEvidenceRecordSchema),
  baselinePra: InternalFireBaselinePraDefinitionSchema.optional(),
  plantBoundaryAndPartitioning: InternalFirePlantBoundaryAndPartitioningSchema,
  equipmentSelection: InternalFireEquipmentSelectionSchema,
  cableSelectionAndLocation: InternalFireCableSelectionAndLocationSchema,
  qualitativeScreening: InternalFireQualitativeScreeningSchema,
  plantResponseModel: InternalFirePlantResponseModelSchema,
  scenarioSelectionAndAnalysis: InternalFireScenarioSelectionAndAnalysisSchema,
  ignitionFrequency: InternalFireIgnitionFrequencySchema,
  circuitFailureAnalysis: InternalFireCircuitFailureAnalysisSchema,
  humanReliabilityAnalysis: InternalFireHumanReliabilityAnalysisSchema,
  eventSequenceQuantification: InternalFireEventSequenceQuantificationSchema,
  integration: InternalFirePraIntegrationSchema,
  integratedUncertainties: z.array(InternalFireModelUncertaintySchema),
  riskInterpretation: InternalFireRiskInterpretationSchema,
  riskIntegrationBaseline: InternalFireRiskIntegrationBaselineSchema,
  workflow: InternalFirePraWorkflowSchema,
  documentation: InternalFirePraDocumentationSchema,
  configurationControlRecordId: z.string().optional(),
  exampleDocuments: z.array(InternalFirePraExampleDocumentSchema).optional(),
  newlyDevelopedMethodIds: z.array(z.string()).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _Pra = Expect<Equal<z.infer<typeof InternalFirePRASchema>, InternalFirePRA>>;
