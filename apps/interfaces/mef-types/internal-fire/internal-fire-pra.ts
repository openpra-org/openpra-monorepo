import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import type { HazardConditionedMethodModels } from "../hazard-conditioned-models";
import {
  createInternalFireSrCatalog,
  InternalFireAnalysisRecord,
  InternalFireInvestigation,
  InternalFireModelUncertainty,
  InternalFirePraInterfaceRecord,
  InternalFirePreOperationalAssumption,
  InternalFireProcessDocumentation,
  InternalFireScreeningDecision,
  InternalFireSrCatalogEntry,
} from "./internal-fire-pra-common";

export * from "./internal-fire-pra-common";

export interface InternalFirePraApplication extends InternalFireAnalysisRecord {
  purpose: string;
  decisionContext: string;
  supportedRiskMetrics: string[];
  consumingElementRefs: string[];
  configurationBasis: string;
  limitations: string[];
}

export interface InternalFirePraEvidenceRecord extends InternalFireAnalysisRecord {
  evidenceType: "DRAWING" | "CALCULATION" | "PROCEDURE" | "DATA" | "MODEL" | "WALKDOWN" | "INTERVIEW" | "FIRE_EVENT" | "REVIEW" | "OTHER";
  sourceReference: string;
  revision?: string;
  effectiveDate?: string;
  applicableSubelements: ("FPP" | "FES" | "FCS" | "FQLS" | "FPRM" | "FSS" | "FIGN" | "FCF" | "FHR" | "FESQ")[];
  applicability: string;
  qualityAndLimitations: string;
  fileReference?: string;
  supersedesEvidenceRef?: string;
  controlled: boolean;
}

export interface InternalFireBaselinePraRecordTreatment extends InternalFireAnalysisRecord {
  technicalArea: "PLANT_OPERATING_STATES" | "INITIATING_EVENTS" | "EVENT_SEQUENCES" | "SUCCESS_CRITERIA" | "SYSTEMS" | "DATA" | "HUMAN_RELIABILITY" | "RISK_INTEGRATION";
  sourceRecordRefs: string[];
  treatment: "REUSED" | "MODIFIED" | "NEW" | "NOT_APPLICABLE";
  internalFireChange: string;
  unresolvedItems: string[];
}

export interface InternalFireBaselinePraDefinition {
  modelName: string;
  modelReference: string;
  revision: string;
  freezeDate: string;
  freezeStatus: "WORKING" | "FROZEN" | "REFERENCE_ONLY";
  modelBoundary: string;
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  recordTreatments: InternalFireBaselinePraRecordTreatment[];
  unresolvedInterfaces: string[];
}

export interface FireGlobalAnalysisBoundary extends InternalFireAnalysisRecord {
  includedLocationRefs: string[];
  excludedLocations: { uuid: string; location: string; exclusionBasis: string; evidenceRefs: string[] }[];
  licenseeControlledAreaDescription: string;
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  atPowerOperatingStateRefs: string[];
  multiUnitOrMultiSourceLocations: string[];
}

export interface FirePartitioningElement extends InternalFireAnalysisRecord {
  elementType: "RATED_WALL" | "NONRATED_WALL" | "RATED_DOOR" | "ACTIVE_BARRIER" | "FLOOR_CEILING" | "SPATIAL_SEPARATION" | "OTHER";
  fromPauRef: string;
  toPauRef?: string;
  fireResistanceRatingMinutes?: number;
  credited: boolean;
  maintainedByFireProtectionProgram: boolean;
  condition: string;
  containmentBasis: string;
}

export interface FirePhysicalAnalysisUnit extends InternalFireAnalysisRecord {
  fireArea: string;
  fireCompartment: string;
  building: string;
  rooms: string[];
  elevation: string;
  volumeCubicMetres: number;
  boundaryElementRefs: string[];
  adjacentPauRefs: string[];
  ventilationZones: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  fixedIgnitionSourceRefs: string[];
  transientCombustibleZones: string[];
  creditedBarrierRefs: string[];
  fireProtectionFeatures: string[];
}

export interface FirePartitioningCoverageCheck extends InternalFireAnalysisRecord {
  complete: boolean;
  nonOverlapping: boolean;
  unassignedLocations: string[];
  overlappingPauPairs: string[][];
  excludedLocationRefs: string[];
  reconciliationMethod: string;
}

export interface InternalFirePlantBoundaryAndPartitioning {
  globalBoundary: FireGlobalAnalysisBoundary;
  physicalAnalysisUnits: FirePhysicalAnalysisUnit[];
  partitioningElements: FirePartitioningElement[];
  coverageChecks: FirePartitioningCoverageCheck[];
  investigations: InternalFireInvestigation[];
  modelUncertainties: InternalFireModelUncertainty[];
  preOperationalAssumptions: InternalFirePreOperationalAssumption[];
  documentation: InternalFireProcessDocumentation;
}

export interface FireInitiatingEventSelection extends InternalFireAnalysisRecord {
  initiatingEventRef: string;
  sourceTechnicalElementRef: string;
  selectionType: "BASELINE_INCLUDED" | "BASELINE_SCREENED_RECONSIDERED" | "FIRE_UNIQUE";
  fireCausingEquipmentRefs: string[];
  spuriousOperationCombinations: string[][];
  affectedReactorUnitRefs: string[];
  affectedRadioactiveMaterialSourceRefs: string[];
  disposition: "INCLUDE" | "EXCLUDE";
  exclusionCriterion?: "SCR-2" | "SCR-3";
}

export interface FireEquipmentSelectionRecord extends InternalFireAnalysisRecord {
  equipmentRef: string;
  systemRef: string;
  equipmentType: string;
  creditedFunctions: string[];
  selectionBasis: ("INITIATING_EVENT" | "MITIGATION" | "SAFE_SHUTDOWN" | "CONTAINMENT" | "MULTI_UNIT" | "HUMAN_ACTION_SUPPORT")[];
  fireFailureModes: ("LOSS_OF_FUNCTION" | "SPURIOUS_OPERATION" | "SPURIOUS_INDICATION" | "LOSS_OF_SIGNAL" | "ERRONEOUS_SIGNAL")[];
  affectedInitiatingEventRefs: string[];
  affectedSuccessCriterionRefs: string[];
  physicalAnalysisUnitRefs: string[];
  cableRefs: string[];
  modelBasicEventRefs: string[];
  disposition: "INCLUDE" | "EXCLUDE";
  exclusionCriterion?: "SCR-2" | "SCR-3";
}

export interface FireInstrumentationSelectionRecord extends InternalFireAnalysisRecord {
  instrumentRef: string;
  monitoredParameter: string;
  supportedHumanActionRefs: string[];
  credibleFailureModes: ("LOSS_OF_SIGNAL" | "SPURIOUS_INDICATION" | "ERRONEOUS_INDICATION")[];
  undesirableOperatorResponse: string;
  physicalAnalysisUnitRefs: string[];
  cableRefs: string[];
  disposition: "INCLUDE" | "EXCLUDE";
}

export interface InternalFireEquipmentSelection {
  initiatingEventSelections: FireInitiatingEventSelection[];
  equipmentSelections: FireEquipmentSelectionRecord[];
  instrumentationSelections: FireInstrumentationSelectionRecord[];
  modelUncertainties: InternalFireModelUncertainty[];
  preOperationalAssumptions: InternalFirePreOperationalAssumption[];
  documentation: InternalFireProcessDocumentation;
}

export interface FireRacewayRecord extends InternalFireAnalysisRecord {
  racewayId: string;
  racewayType: "CABLE_TRAY" | "CONDUIT" | "CABLE_DUCT" | "CABLE_TUNNEL" | "PENETRATION" | "OTHER";
  physicalAnalysisUnitRef: string;
  routeDescription: string;
  elevation: string;
  fireBarrierProtectionRefs: string[];
  cableRefs: string[];
  materialAndConfiguration: string;
  sourceDocumentRefs: string[];
}

export interface FireCableSelectionRecord extends InternalFireAnalysisRecord {
  cableId: string;
  equipmentRef: string;
  function: string;
  cableType: "POWER" | "CONTROL" | "INSTRUMENTATION" | "COMMUNICATION" | "OTHER";
  voltageClass: string;
  fromTermination: string;
  toTermination: string;
  physicalAnalysisUnitRefs: string[];
  racewayRefs: string[];
  associatedFailureModes: string[];
  modelBasicEventRefs: string[];
  routingStatus: "EXACT" | "ASSUMED" | "NOT_ROUTED";
  routingBasis: string;
  riskSignificant: boolean;
}

export interface FireAssumedCableRouting extends InternalFireAnalysisRecord {
  cableRefs: string[];
  assumedPauRefs: string[];
  assumedRacewayRefs: string[];
  scopeAndExtent: string;
  conservatism: string;
  closureAction: string;
}

export interface FireOvercurrentProtectionAssessment extends InternalFireAnalysisRecord {
  distributionBusRef: string;
  protectiveDeviceRefs: string[];
  coordinationDocumentRef: string;
  coordinationAdequate: boolean;
  additionalCircuitRefs: string[];
  challengeDescription: string;
  modelTreatment: string;
}

export interface InternalFireCableSelectionAndLocation {
  raceways: FireRacewayRecord[];
  cables: FireCableSelectionRecord[];
  assumedRouting: FireAssumedCableRouting[];
  overcurrentProtectionAssessments: FireOvercurrentProtectionAssessment[];
  modelUncertainties: InternalFireModelUncertainty[];
  preOperationalAssumptions: InternalFirePreOperationalAssumption[];
  documentation: InternalFireProcessDocumentation;
}

export interface InternalFireQualitativeScreening {
  screeningCriteria: InternalFireAnalysisRecord[];
  screeningDecisions: InternalFireScreeningDecision[];
  retainedPauRefs: string[];
  screenedPauRefs: string[];
  modelUncertainties: InternalFireModelUncertainty[];
  preOperationalAssumptions: InternalFirePreOperationalAssumption[];
  documentation: InternalFireProcessDocumentation;
}

export interface FirePeerReviewDisposition extends InternalFireAnalysisRecord {
  sourcePeerReviewRef: string;
  findingRef: string;
  applicability: string;
  disposition: string;
  incorporated: boolean;
  verificationRefs: string[];
}

export interface FireInitiatingEventModel extends InternalFireAnalysisRecord {
  initiatingEventRef: string;
  sourceSelectionRef: string;
  eventTreeRef: string;
  fireScenarioRefs: string[];
  affectedUnitRefs: string[];
  plantResponseModelTreatment: "REUSED" | "MODIFIED" | "NEW";
}

export interface FireEventSequenceModel extends InternalFireAnalysisRecord {
  initiatingEventRef: string;
  baselineEventSequenceRef?: string;
  fireScenarioRefs: string[];
  topEvents: string[];
  endStates: string[];
  fireProcedureRefs: string[];
  eventSequenceFamilyRefs: string[];
  modelTreatment: "REUSED" | "MODIFIED" | "NEW";
}

export interface FireSuccessCriterion extends InternalFireAnalysisRecord {
  function: string;
  baselineSuccessCriterionRef?: string;
  successDefinition: string;
  missionTimeHours: number;
  requiredSystemTrainRefs: string[];
  fireSpecificConditions: string[];
  analysisRef: string;
  modelTreatment: "REUSED" | "MODIFIED" | "NEW";
}

export interface FireSystemModelModification extends InternalFireAnalysisRecord {
  systemRef: string;
  baselineModelRef: string;
  affectedBasicEventRefs: string[];
  fireEquipmentRefs: string[];
  cableRefs: string[];
  spuriousOperationRefs: string[];
  humanFailureEventRefs: string[];
  splitFractionRefs: string[];
  modelChange: string;
}

export interface FireProbabilityDataParameter extends InternalFireAnalysisRecord {
  parameterRef: string;
  parameterType: "RANDOM_FAILURE" | "UNAVAILABILITY" | "COMMON_CAUSE" | "FIRE_CONTEXT_OTHER";
  baselineValue?: number;
  fireContextValue: number;
  uncertaintyDistribution: string;
  sourceDataRef: string;
  reanalysisRequired: boolean;
}

export interface InternalFirePlantResponseModel {
  peerReviewDispositions: FirePeerReviewDisposition[];
  initiatingEventModels: FireInitiatingEventModel[];
  eventSequenceModels: FireEventSequenceModel[];
  successCriteria: FireSuccessCriterion[];
  systemModelModifications: FireSystemModelModification[];
  probabilityDataParameters: FireProbabilityDataParameter[];
  modelUncertainties: InternalFireModelUncertainty[];
  preOperationalAssumptions: InternalFirePreOperationalAssumption[];
  documentation: InternalFireProcessDocumentation;
}

export interface FireIgnitionSource extends InternalFireAnalysisRecord {
  physicalAnalysisUnitRef: string;
  sourceType: "ELECTRICAL_CABINET" | "SWITCHGEAR" | "TRANSFORMER" | "PUMP" | "MOTOR" | "TURBINE" | "CABLE" | "WELDING" | "TRANSIENT_COMBUSTIBLE" | "HIGH_ENERGY_ARC" | "OTHER";
  mobility: "FIXED" | "TRANSIENT";
  locationDescription: string;
  fuelDescription: string;
  ignitionFrequencyGroupRef: string;
  heatReleaseRateProfileRef: string;
  secondaryCombustibleRefs: string[];
  highHazard: boolean;
  structuralSteelExposureRefs: string[];
}

export interface FireDamageTargetSet extends InternalFireAnalysisRecord {
  physicalAnalysisUnitRefs: string[];
  equipmentRefs: string[];
  cableRefs: string[];
  racewayRefs: string[];
  failureModes: string[];
  damageMechanisms: ("THERMAL" | "FLAME_IMPINGEMENT" | "SMOKE" | "HOT_GAS_LAYER" | "STRUCTURAL_COLLAPSE" | "OTHER")[];
  damageThresholds: { uuid: string; targetRef: string; parameter: string; value: number; unit: string; sourceRef: string }[];
  modelBasicEventRefs: string[];
}

export interface FireDetectionSuppressionAssessment extends InternalFireAnalysisRecord {
  physicalAnalysisUnitRef: string;
  fireScenarioRef: string;
  detectionSystemRefs: string[];
  automaticSuppressionSystemRefs: string[];
  manualSuppressionCredited: boolean;
  timeToDetectionMinutes: number;
  timeAvailableBeforeDamageMinutes: number;
  nonsuppressionProbability: number;
  fifthPercentile?: number;
  ninetyFifthPercentile?: number;
  dependencies: string[];
  effectivenessBasis: string;
}

export interface FireBarrierAssessment extends InternalFireAnalysisRecord {
  barrierRef: string;
  affectedPauRefs: string[];
  fireResistanceRatingMinutes?: number;
  rated: boolean;
  active: boolean;
  reliability: number;
  availability: number;
  qualificationOrTestRef?: string;
  failureScenarioRefs: string[];
  effectivenessBasis: string;
}

export interface FireModelAnalysis extends InternalFireAnalysisRecord {
  fireScenarioRef: string;
  toolName: string;
  toolVersion: string;
  modelType: "ANALYTICAL" | "EMPIRICAL" | "STATISTICAL" | "COMPUTATIONAL" | "EXPERT_JUDGMENT";
  applicabilityLimits: string[];
  inputValues: { uuid: string; parameter: string; value: number; unit: string; sourceRef: string }[];
  peakHeatReleaseRateKw: number;
  growthTimeMinutes: number;
  steadyBurnMinutes: number;
  decayTimeMinutes: number;
  targetDamageTimesMinutes: { uuid: string; targetRef: string; damageTimeMinutes: number; mechanism: string }[];
  severityFactor: number;
  conditionalTargetDamageProbability: number;
  uncertaintyTreatment: string;
  withinApplicabilityLimits: boolean;
}

export interface FireScenario extends InternalFireAnalysisRecord {
  physicalAnalysisUnitRefs: string[];
  ignitionSourceRefs: string[];
  damageTargetSetRef: string;
  fireModelAnalysisRef: string;
  detectionSuppressionAssessmentRef: string;
  barrierAssessmentRefs: string[];
  initiatingEventRefs: string[];
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  scenarioType: "SINGLE_COMPARTMENT" | "MULTI_COMPARTMENT" | "CONTROL_ROOM_ABANDONMENT" | "STRUCTURAL_STEEL";
  commandAndControlTransferRequired: boolean;
  structuralSteelFailureEvaluated: boolean;
  smokeDamageEvaluation: string;
  secondaryCombustibleTreatment: string;
  disposition: "SCREENED" | "RETAINED" | "QUANTIFIED";
}

export interface InternalFireScenarioSelectionAndAnalysis {
  ignitionSources: FireIgnitionSource[];
  damageTargetSets: FireDamageTargetSet[];
  fireScenarios: FireScenario[];
  fireModelAnalyses: FireModelAnalysis[];
  detectionSuppressionAssessments: FireDetectionSuppressionAssessment[];
  barrierAssessments: FireBarrierAssessment[];
  screeningDecisions: InternalFireScreeningDecision[];
  investigations: InternalFireInvestigation[];
  modelUncertainties: InternalFireModelUncertainty[];
  preOperationalAssumptions: InternalFirePreOperationalAssumption[];
  documentation: InternalFireProcessDocumentation;
}

export interface FireEventDataSource extends InternalFireAnalysisRecord {
  sourceType: "NUCLEAR_INDUSTRY" | "NONNUCLEAR_INDUSTRY" | "PLANT_SPECIFIC" | "EXPERT_JUDGMENT";
  reference: string;
  eventCount: number;
  exposurePlantYears: number;
  applicableTechnology: string;
  inclusionCriteria: string[];
  exclusionCriteria: string[];
  applicabilityAssessment: string;
  availableForReview: boolean;
}

export interface FireIgnitionFrequencyGroup extends InternalFireAnalysisRecord {
  sourceCategory: string;
  eventDataSourceRefs: string[];
  genericFrequencyPerPlantYear: number;
  updatedFrequencyPerPlantYear?: number;
  updateMethod: "GENERIC" | "BAYESIAN" | "EQUIVALENT_STATISTICAL" | "EXPERT_JUDGMENT";
  plantAvailabilityFactor: number;
  uncertaintyDistribution: string;
  parameterDependencies: string[];
}

export interface FirePlantExperienceReview extends InternalFireAnalysisRecord {
  reviewPeriod: string;
  plantYears: number;
  fireEventRefs: string[];
  outlierDetected: boolean;
  outlierBasis: string;
  frequencyUpdateRequired: boolean;
}

export interface FireIgnitionFrequencyEstimate extends InternalFireAnalysisRecord {
  ignitionSourceRef: string;
  physicalAnalysisUnitRef: string;
  frequencyGroupRef: string;
  apportionmentFactors: { uuid: string; factorName: string; value: number; basis: string }[];
  meanFrequencyPerPlantYear: number;
  fifthPercentile?: number;
  ninetyFifthPercentile?: number;
  uncertaintyDistribution: string;
  preservesPlantWideFrequency: boolean;
}

export interface InternalFireIgnitionFrequency {
  eventDataSources: FireEventDataSource[];
  frequencyGroups: FireIgnitionFrequencyGroup[];
  plantExperienceReviews: FirePlantExperienceReview[];
  frequencyEstimates: FireIgnitionFrequencyEstimate[];
  reconciliationChecks: InternalFireAnalysisRecord[];
  modelUncertainties: InternalFireModelUncertainty[];
  preOperationalAssumptions: InternalFirePreOperationalAssumption[];
  documentation: InternalFireProcessDocumentation;
}

export interface FireCircuitRecord extends InternalFireAnalysisRecord {
  circuitId: string;
  cableRefs: string[];
  equipmentRef: string;
  circuitFunction: string;
  powerSupplyRef: string;
  protectiveDeviceRefs: string[];
  physicalAnalysisUnitRefs: string[];
  circuitConfiguration: string;
}

export interface FireCircuitFailureModeEvaluation extends InternalFireAnalysisRecord {
  circuitRef: string;
  fireScenarioRefs: string[];
  cableRefs: string[];
  equipmentFailureMode: "LOSS_OF_FUNCTION" | "SPURIOUS_OPERATION" | "SPURIOUS_INDICATION" | "ERRONEOUS_SIGNAL";
  circuitFailureMode: "OPEN_CIRCUIT" | "SHORT_TO_GROUND" | "CONDUCTOR_TO_CONDUCTOR_HOT_SHORT" | "SHORT_BETWEEN_CABLES" | "GROUND_FAULT" | "OTHER";
  hotShortDurationCredited: boolean;
  hotShortDurationSeconds?: number;
  modelBasicEventRefs: string[];
  scenarioSpecificCharacteristics: string[];
}

export interface FireCircuitFailureProbability extends InternalFireAnalysisRecord {
  failureModeEvaluationRef: string;
  fireScenarioRefs: string[];
  meanProbability: number;
  fifthPercentile?: number;
  ninetyFifthPercentile?: number;
  durationProbability?: number;
  uncertaintyDistribution: string;
  genericDataRef: string;
  scenarioSpecificAdjustment: string;
  bounding: boolean;
}

export interface InternalFireCircuitFailureAnalysis {
  circuits: FireCircuitRecord[];
  failureModeEvaluations: FireCircuitFailureModeEvaluation[];
  failureProbabilities: FireCircuitFailureProbability[];
  modelUncertainties: InternalFireModelUncertainty[];
  preOperationalAssumptions: InternalFirePreOperationalAssumption[];
  documentation: InternalFireProcessDocumentation;
}

export interface FireHumanAction extends InternalFireAnalysisRecord {
  actionType: "BASELINE_RETAINED" | "BASELINE_MODIFIED" | "FIRE_SAFE_SHUTDOWN" | "CONTROL_ROOM_ABANDONMENT" | "RECOVERY" | "UNDESIRED_RESPONSE";
  procedureRefs: string[];
  fireScenarioRefs: string[];
  eventSequenceRefs: string[];
  requiredLocation: string;
  cuesAndIndications: string[];
  availableTimeMinutes: number;
  executionTimeMinutes: number;
  accessRoute: string;
  requiredEquipment: string[];
  crew: string;
}

export interface FireHumanFailureEvent extends InternalFireAnalysisRecord {
  humanActionRef: string;
  basicEventRef: string;
  failureDefinition: string;
  fireScenarioRefs: string[];
  affectedEventSequenceRefs: string[];
  physicalAnalysisUnitRefs: string[];
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
}

export interface FireHumanPerformanceContext extends InternalFireAnalysisRecord {
  humanFailureEventRef: string;
  fireScenarioRef: string;
  smokeAndHeatConditions: string;
  lightingAndVisibility: string;
  alarmAndCueReliability: string;
  spuriousIndicationEffects: string;
  accessAndHabitability: string;
  workloadAndStress: string;
  communications: string;
  procedureQuality: string;
  staffingAndTraining: string;
}

export interface FireHepEstimate extends InternalFireAnalysisRecord {
  humanFailureEventRef: string;
  performanceContextRef: string;
  method: string;
  screeningValueUsed: boolean;
  meanHep: number;
  fifthPercentile?: number;
  ninetyFifthPercentile?: number;
  uncertaintyDistribution: string;
  dependencyGroupRefs: string[];
  recoveryCredited: boolean;
  feasibilityDemonstrated: boolean;
}

export interface FireHumanDependencyAssessment extends InternalFireAnalysisRecord {
  humanFailureEventRefs: string[];
  sharedCrew: boolean;
  sharedCues: boolean;
  sharedLocation: boolean;
  temporalRelationship: string;
  dependencyLevel: "ZERO" | "LOW" | "MODERATE" | "HIGH" | "COMPLETE";
  jointHep: number;
}

export interface FireHumanActionConfirmation extends InternalFireAnalysisRecord {
  humanActionRefs: string[];
  confirmationType: "PROCEDURE_REVIEW" | "TALK_THROUGH" | "SIMULATOR" | "WALKDOWN" | "DESIGNER_INTERVIEW";
  participants: string[];
  performedDate: string;
  findings: string[];
  feasible: boolean;
}

export interface InternalFireHumanReliabilityAnalysis {
  humanActions: FireHumanAction[];
  humanFailureEvents: FireHumanFailureEvent[];
  performanceContexts: FireHumanPerformanceContext[];
  hepEstimates: FireHepEstimate[];
  dependencyAssessments: FireHumanDependencyAssessment[];
  confirmations: FireHumanActionConfirmation[];
  modelUncertainties: InternalFireModelUncertainty[];
  preOperationalAssumptions: InternalFirePreOperationalAssumption[];
  documentation: InternalFireProcessDocumentation;
}

export interface FireQuantificationRun extends InternalFireAnalysisRecord {
  modelVersion: string;
  calculationDate: string;
  software: string;
  softwareVersion: string;
  truncationLevel: number;
  lowerTruncationCheck: number;
  convergenceMetric: number;
  convergenceCriterion: number;
  converged: boolean;
  includedFireScenarioRefs: string[];
  excludedFireScenarioRefs: string[];
  dependencyTreatment: string;
  methodLimitations: string[];
}

export interface FireScenarioQuantificationResult extends InternalFireAnalysisRecord {
  quantificationRunRef: string;
  fireScenarioRef: string;
  initiatingEventRef: string;
  ignitionFrequencyRef: string;
  conditionalDamageProbability: number;
  circuitFailureProbabilityRefs: string[];
  humanFailureEventRefs: string[];
  conditionalSequenceProbability: number;
  meanFrequencyPerPlantYear: number;
  fifthPercentile?: number;
  ninetyFifthPercentile?: number;
  eventSequenceFamilyRefs: string[];
  releaseCategoryRefs: string[];
  screened: boolean;
}

export interface FireEventSequenceFamilyResult extends InternalFireAnalysisRecord {
  quantificationRunRef: string;
  eventSequenceFamilyRef: string;
  fireScenarioRefs: string[];
  initiatingEventRefs: string[];
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  releaseCategoryRef: string;
  meanFrequencyPerPlantYear: number;
  medianFrequencyPerPlantYear: number;
  fifthPercentileFrequencyPerPlantYear: number;
  ninetyFifthPercentileFrequencyPerPlantYear: number;
  dominantCutsetRefs: string[];
}

export interface FireRiskContributor extends InternalFireAnalysisRecord {
  contributorType: "PAU" | "IGNITION_SOURCE" | "FIRE_SCENARIO" | "EQUIPMENT" | "CABLE" | "CIRCUIT_FAILURE" | "HFE" | "EVENT_SEQUENCE_FAMILY";
  contributorRef: string;
  meanFrequencyContributionPerPlantYear: number;
  fractionalContribution: number;
  fussellVesely?: number;
  riskAchievementWorth?: number;
  rank: number;
}

export interface FireUncertaintyResult extends InternalFireAnalysisRecord {
  quantificationRunRef: string;
  resultRef: string;
  uncertaintySourceRefs: string[];
  propagationMethod: string;
  sampleCount: number;
  mean: number;
  median: number;
  fifthPercentile: number;
  ninetyFifthPercentile: number;
  modelUncertaintySensitivityRefs: string[];
}

export interface FireQuantificationReview extends InternalFireAnalysisRecord {
  quantificationRunRef: string;
  reviewType: "CORRECTNESS" | "COMPLETENESS" | "CONSISTENCY" | "CONVERGENCE" | "TRACEABILITY";
  checksPerformed: string[];
  result: "PASS" | "OPEN" | "FAIL";
  openItems: string[];
}

export interface InternalFireEventSequenceQuantification {
  quantificationRuns: FireQuantificationRun[];
  scenarioResults: FireScenarioQuantificationResult[];
  eventSequenceFamilyResults: FireEventSequenceFamilyResult[];
  riskContributors: FireRiskContributor[];
  uncertaintyResults: FireUncertaintyResult[];
  reviews: FireQuantificationReview[];
  screeningDecisions: InternalFireScreeningDecision[];
  integratedModelUncertainties: InternalFireModelUncertainty[];
  preOperationalAssumptions: InternalFirePreOperationalAssumption[];
  documentation: InternalFireProcessDocumentation;
}

export interface InternalFireConsistencyCheck extends InternalFireAnalysisRecord {
  checkType: "PAU_SOURCE" | "EQUIPMENT_CABLE" | "CABLE_RACEWAY" | "SCENARIO_TARGET" | "SCENARIO_FREQUENCY" | "CIRCUIT_MODEL" | "HFE_CONTEXT" | "FREQUENCY_RECONCILIATION" | "TRACEABILITY" | "OTHER";
  subelements: ("FPP" | "FES" | "FCS" | "FQLS" | "FPRM" | "FSS" | "FIGN" | "FCF" | "FHR" | "FESQ")[];
  comparedRefs: string[];
  method: string;
  result: "PASS" | "OPEN" | "FAIL" | "NOT_APPLICABLE";
  openItems: string[];
}

export interface InternalFirePraIntegration {
  interfaces: InternalFirePraInterfaceRecord[];
  consistencyChecks: InternalFireConsistencyCheck[];
  selectedPauRefs: string[];
  selectedEquipmentRefs: string[];
  selectedCableRefs: string[];
  retainedFireScenarioRefs: string[];
  ignitionFrequencyRefs: string[];
  circuitFailureResultRefs: string[];
  humanFailureEventRefs: string[];
  quantificationResultRefs: string[];
  unresolvedInterfaces: string[];
  integrationMethod: string;
}

export interface InternalFireRiskInsight extends InternalFireAnalysisRecord {
  insightType: "DOMINANT_CONTRIBUTOR" | "DEFENSE_IN_DEPTH" | "MODEL_LIMITATION" | "UNCERTAINTY" | "DESIGN_OPPORTUNITY";
  contributorRefs: string[];
  affectedRiskMetric: string;
  fractionalContribution?: number;
  decisionImplication: string;
}

export interface InternalFireModelRefinement extends InternalFireAnalysisRecord {
  technicalArea: "EVIDENCE" | "PARTITIONING" | "EQUIPMENT" | "CABLE" | "SCENARIO" | "FREQUENCY" | "CIRCUIT" | "PLANT_RESPONSE" | "HRA" | "QUANTIFICATION";
  driverRefs: string[];
  affectedRecordRefs: string[];
  refinement: string;
  expectedEffect: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  refinementStatus: "PROPOSED" | "IN_PROGRESS" | "REQUANTIFIED" | "CLOSED";
  quantificationIterationRef?: string;
  result: string;
  decisionBasis: string;
}

export interface InternalFireRefinementIteration extends InternalFireAnalysisRecord {
  modelVersion: string;
  calculationDate: string;
  refinementActionRefs: string[];
  aggregateMeanFrequencyPerPlantYear: number;
  previousAggregateMeanFrequencyPerPlantYear?: number;
  relativeChange?: number;
  maximumFamilyRelativeChange?: number;
  topContributorRefs: string[];
  contributorRankingStable: boolean;
  newRiskSignificantContributorRefs: string[];
  decision: "CONTINUE_REFINEMENT" | "ACCEPT_STABLE";
}

export interface InternalFireRiskInterpretation {
  riskInsights: InternalFireRiskInsight[];
  refinementActions: InternalFireModelRefinement[];
  quantificationIterations: InternalFireRefinementIteration[];
  stoppingCriteria: {
    maximumAggregateFrequencyChange: number;
    maximumFamilyFrequencyChange: number;
    maximumContributorRankShift: number;
    requiredStableIterations: number;
    requireNoNewRiskSignificantContributors: boolean;
    basis: string;
  };
}

export interface InternalFireRiskIntegrationResult extends InternalFireAnalysisRecord {
  modelVersion: string;
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  eventSequenceFamilyRefs: string[];
  releaseCategoryRefs: string[];
  aggregateMeanFrequencyPerPlantYear: number;
  fifthPercentileFrequencyPerPlantYear: number;
  ninetyFifthPercentileFrequencyPerPlantYear: number;
  otherHazardRiskRefs: string[];
  overlapTreatment: string;
  dominantContributorRefs: string[];
  integrationStatus: "DRAFT" | "READY_FOR_RISK_INTEGRATION" | "ACCEPTED_BY_RISK_INTEGRATION";
}

export interface InternalFireRiskDecision extends InternalFireAnalysisRecord {
  decisionType: "DESIGN" | "FIRE_PROTECTION_PROGRAM" | "CONFIGURATION_CONTROL" | "PROCEDURE" | "MONITORING" | "DATA_COLLECTION" | "MODEL_CONTROL";
  driverRefs: string[];
  affectedSscRefs: string[];
  action: string;
  duePhase: string;
  disposition: "IMPLEMENT" | "MONITOR" | "CONFIRM_PRE_OPERATIONAL" | "RETAIN_CURRENT_BASIS" | "FORWARD_TO_PLANT_PROCESS";
  verificationRefs: string[];
  reanalysisRequired: boolean;
  riskIntegrationResultRef: string;
}

export interface InternalFireRiskTraceabilityPath extends InternalFireAnalysisRecord {
  evidenceRefs: string[];
  physicalAnalysisUnitRefs: string[];
  ignitionSourceRefs: string[];
  fireScenarioRefs: string[];
  equipmentRefs: string[];
  cableRefs: string[];
  circuitFailureRefs: string[];
  initiatingEventRefs: string[];
  humanFailureEventRefs: string[];
  eventSequenceFamilyRefs: string[];
  resultRefs: string[];
  decisionRefs: string[];
  complete: boolean;
}

export interface InternalFireControlledBaseline extends InternalFireAnalysisRecord {
  modelVersion: string;
  quantificationRunRef: string;
  reportRef: string;
  configurationControlRecordId: string;
  peerReviewRef: string;
  packageManifestRefs: string[];
  unresolvedLimitations: string[];
  releaseStatus: "WORKING" | "CONTROLLED" | "SUPERSEDED";
}

export interface InternalFireRiskIntegrationBaseline {
  results: InternalFireRiskIntegrationResult[];
  decisions: InternalFireRiskDecision[];
  traceabilityPaths: InternalFireRiskTraceabilityPath[];
  controlledBaselines: InternalFireControlledBaseline[];
}

export interface InternalFireWorkflowRecord extends InternalFireAnalysisRecord {
  workflowRecordType: "REPORT_SECTION" | "QUALITY_CHECK" | "REVIEW_ASSIGNMENT" | "REVIEW_FINDING" | "APPROVAL_READINESS" | "APPROVAL_SIGNATURE";
  discipline: string;
  assignee: string;
  dueDate?: string;
  result: string;
  verificationRefs: string[];
}

export interface InternalFirePraWorkflow {
  reportSections: InternalFireWorkflowRecord[];
  draftQualityChecks: InternalFireWorkflowRecord[];
  reviewAssignments: InternalFireWorkflowRecord[];
  reviewFindings: InternalFireWorkflowRecord[];
  approvalReadiness: InternalFireWorkflowRecord[];
  approvalSignatures: InternalFireWorkflowRecord[];
}

export interface InternalFirePraDocumentation {
  overallProcessDescription: string;
  partitioningSummary: string;
  equipmentSelectionSummary: string;
  cableSelectionSummary: string;
  qualitativeScreeningSummary: string;
  plantResponseSummary: string;
  scenarioAnalysisSummary: string;
  ignitionFrequencySummary: string;
  circuitFailureSummary: string;
  humanReliabilitySummary: string;
  quantificationSummary: string;
  riskInsights: string;
  uncertaintySummary: string;
  configurationControlDescription: string;
  peerReviewScope: string;
  supportingDocumentRefs: string[];
}

export interface InternalFirePraExampleDocument {
  id: string;
  name: string;
  kind: "doc" | "sheet" | "image";
  sizeLabel: string;
  uploadedLabel: string;
  extracted: string;
  linked: number;
  url?: string;
}

export interface InternalFirePRA extends TechnicalElement<TechnicalElementTypes.INTERNAL_FIRE_PRA> {
  praScope: string;
  hazardConditionedModels: HazardConditionedMethodModels;
  applications: InternalFirePraApplication[];
  evidenceRegister: InternalFirePraEvidenceRecord[];
  baselinePra?: InternalFireBaselinePraDefinition;
  plantBoundaryAndPartitioning: InternalFirePlantBoundaryAndPartitioning;
  equipmentSelection: InternalFireEquipmentSelection;
  cableSelectionAndLocation: InternalFireCableSelectionAndLocation;
  qualitativeScreening: InternalFireQualitativeScreening;
  plantResponseModel: InternalFirePlantResponseModel;
  scenarioSelectionAndAnalysis: InternalFireScenarioSelectionAndAnalysis;
  ignitionFrequency: InternalFireIgnitionFrequency;
  circuitFailureAnalysis: InternalFireCircuitFailureAnalysis;
  humanReliabilityAnalysis: InternalFireHumanReliabilityAnalysis;
  eventSequenceQuantification: InternalFireEventSequenceQuantification;
  integration: InternalFirePraIntegration;
  integratedUncertainties: InternalFireModelUncertainty[];
  riskInterpretation: InternalFireRiskInterpretation;
  riskIntegrationBaseline: InternalFireRiskIntegrationBaseline;
  workflow: InternalFirePraWorkflow;
  documentation: InternalFirePraDocumentation;
  configurationControlRecordId?: string;
  exampleDocuments?: InternalFirePraExampleDocument[];
  newlyDevelopedMethodIds?: string[];
}

export type InternalFireWorkbookSubelement = "INTEGRATED" | "FPP" | "FES" | "FCS" | "FQLS" | "FPRM" | "FSS" | "FIGN" | "FCF" | "FHR" | "FESQ" | "WORKFLOW";

export interface InternalFireStepDefinition {
  id: string;
  number: string;
  label: string;
  title: string;
  subtitle: string;
  subelement: InternalFireWorkbookSubelement;
}

export const INTERNAL_FIRE_STEP_DEFINITIONS: InternalFireStepDefinition[] = [
  { id: "analysis-basis", number: "01", label: "Analysis basis", subelement: "INTEGRATED", title: "Analysis basis and at-power scope", subtitle: "Define the intended application, capability category, at-power scope, plant coverage, risk measures, and analysis boundaries." },
  { id: "evidence-base", number: "02", label: "Evidence base", subelement: "INTEGRATED", title: "Qualified evidence base and investigations", subtitle: "Control drawings, fire-protection records, equipment and cable data, procedures, calculations, operating experience, and plant investigations." },
  { id: "baseline-pra", number: "03", label: "Baseline and interfaces", subelement: "INTEGRATED", title: "Baseline PRA and technical interfaces", subtitle: "Freeze the internal-events PRA basis and control inputs from and outputs to other PRA technical elements." },
  { id: "plant-partitioning", number: "04", label: "Plant partitioning", subelement: "FPP", title: "Plant boundary and PAU partitioning", subtitle: "Define the complete analysis boundary and nonoverlapping physical analysis units." },
  { id: "equipment-selection", number: "05", label: "Equipment selection", subelement: "FES", title: "Fire equipment and instrumentation selection", subtitle: "Select initiating-event, mitigating, safe-shutdown, and operator-support equipment and failure modes." },
  { id: "cable-selection", number: "06", label: "Cables and raceways", subelement: "FCS", title: "Cable selection, routing, and raceways", subtitle: "Locate modeled cables, endpoints, raceways, assumed routes, and overcurrent-protection concerns." },
  { id: "qualitative-screening", number: "07", label: "Qualitative screening", subelement: "FQLS", title: "PAU qualitative screening", subtitle: "Apply consistent qualitative criteria to every PAU and justify each retained or screened disposition." },
  { id: "plant-response", number: "08", label: "Plant response", subelement: "FPRM", title: "Internal Fire plant-response model", subtitle: "Adapt initiating events, event sequences, success criteria, systems logic, HFEs, and data to fire conditions." },
  { id: "fire-scenarios", number: "09", label: "Fire scenarios", subelement: "FSS", title: "Fire scenario selection and analysis", subtitle: "Model ignition sources, target sets, fire growth, damage, suppression, abandonment, structural effects, and multi-compartment fires." },
  { id: "ignition-frequency", number: "10", label: "Ignition frequency", subelement: "FIGN", title: "Fire ignition frequency", subtitle: "Develop generic and plant-specific frequency groups, apportion them to sources and PAUs, and characterize uncertainty." },
  { id: "circuit-failure", number: "11", label: "Circuit failure", subelement: "FCF", title: "Circuit failure analysis", subtitle: "Evaluate loss of function, hot shorts, spurious operations, duration effects, and failure-mode probabilities." },
  { id: "human-reliability", number: "12", label: "Human response", subelement: "FHR", title: "Human reliability under fire conditions", subtitle: "Define fire-specific actions, contexts, timing, feasibility, HEPs, recovery, and dependencies." },
  { id: "quantification", number: "13", label: "Annual risk", subelement: "FESQ", title: "Event-sequence quantification and uncertainty", subtitle: "Quantify retained fire scenarios and sequence families, dependencies, uncertainty, contributors, convergence, and traceability." },
  { id: "risk-interpretation", number: "14", label: "Risk interpretation", subelement: "INTEGRATED", title: "Risk interpretation and model refinement", subtitle: "Rank contributors, identify design and defense-in-depth insights, refine the model, and demonstrate stable results." },
  { id: "risk-integration", number: "15", label: "Risk integration", subelement: "INTEGRATED", title: "Risk integration and controlled baseline", subtitle: "Transfer controlled results, avoid cross-hazard overlap, record decisions, and establish the approved baseline." },
  { id: "draft", number: "16", label: "Draft", subelement: "WORKFLOW", title: "Produce the draft", subtitle: "Generate and verify the controlled Internal Fire PRA report and supporting package." },
  { id: "review", number: "17", label: "Review", subelement: "WORKFLOW", title: "Technical and peer review", subtitle: "Review every Internal Fire subelement and resolve findings with traceable evidence." },
  { id: "approval", number: "18", label: "Approval", subelement: "WORKFLOW", title: "Approve and control the baseline", subtitle: "Confirm readiness, obtain approval, and release the configuration-controlled Internal Fire PRA baseline." },
];

export const FPP_SR_CATALOG = createInternalFireSrCatalog("FPP", {
  A: [
    "Include every plant location where a fire could adversely affect modeled equipment or cables, including multi-reactor or multi-source locations.",
  ],
  B: [
    "Define and justify PAUs that represent plant physical characteristics, fire hazards, and credible fire-damage extent.",
    "Justify any nonrated physical feature credited as a PAU partitioning element.",
    "Do not credit localized cable or equipment protection as a PAU partitioning element.",
    "Demonstrate that PAUs completely cover the analysis boundary without overlap.",
    "Confirm credited barriers outside the fire-protection maintenance program through investigation.",
    "Justify every location excluded from the global analysis boundary.",
    "Identify PAU-partitioning model uncertainty, assumptions, alternatives, and potential risk impact.",
    "Identify pre-operational PAU assumptions caused by unavailable as-built or as-operated information.",
  ],
  C: [
    "Document the partitioning process, inputs, methods, exclusions, PAUs, partitioning features, investigations, and results.",
    "Document PAU-partitioning model uncertainty, assumptions, and reasonable alternatives.",
    "Document pre-operational PAU assumptions and limitations caused by unavailable as-built or as-operated information.",
  ],
}, {
  "FPP-B5": ["OPERATIONAL"],
  "FPP-B8": ["PRE_OPERATIONAL"],
  "FPP-C3": ["PRE_OPERATIONAL"],
});

export const FES_SR_CATALOG = createInternalFireSrCatalog("FES", {
  A: [
    "Include or justify exclusion of every initiating event considered by the internal-events PRA.",
    "Identify equipment whose fire-induced loss of function would cause an included initiating event.",
    "Systematically identify unique fire-induced initiating events and the equipment failures or spurious operations that cause them.",
    "Identify equipment whose single spurious operation alone could cause an initiating event.",
    "Identify equipment whose spurious operation combined with fire-induced loss-of-function failures could cause an initiating event.",
    "Identify combinations of spurious operations and loss-of-function failures that could cause an initiating event with containment bypass.",
    "Include identified initiating-event equipment in the model or justify exclusion using applicable screening criteria.",
  ],
  B: [
    "Identify fire-vulnerable equipment whose failure could compromise modeled mitigating systems.",
    "Systematically identify loss-of-function and spurious-operation failures that could prevent each modeled train from meeting success criteria.",
    "Include identified mitigating equipment in the model or justify exclusion using applicable screening criteria.",
  ],
  C: [
    "Identify instrumentation whose fire-induced loss, spurious indication, or erroneous indication affects modeled human actions.",
    "Identify equipment-selection model uncertainty, assumptions, alternatives, and potential risk impact.",
    "Identify pre-operational equipment-selection assumptions caused by unavailable as-built or as-operated information.",
  ],
  D: [
    "Document initiating-event and equipment-selection inputs, methods, equipment, failure modes, spurious operations, and results.",
    "Document equipment-selection model uncertainty, assumptions, and reasonable alternatives.",
    "Document pre-operational equipment-selection assumptions and limitations caused by unavailable as-built or as-operated information.",
  ],
}, {
  "FES-C3": ["PRE_OPERATIONAL"],
  "FES-D3": ["PRE_OPERATIONAL"],
});

export const FCS_SR_CATALOG = createInternalFireSrCatalog("FCS", {
  A: [
    "Systematically identify cables whose fire-induced failure could adversely affect selected equipment or modeled functions.",
    "Identify equipment without completed cable selection or routing and justify that the gap does not affect risk-significant insights.",
    "Identify each modeled cable and its terminal locations in every PAU through which it passes, including raceways for risk-significant scenarios.",
    "Specify the scope, extent, and basis of any assumed cable routing.",
  ],
  B: [
    "Assess overcurrent protective-device coordination for modeled electrical distribution buses.",
    "Identify additional circuits or cables whose fire failure could challenge power availability through inadequate overcurrent coordination.",
    "Identify pre-operational assumptions concerning overcurrent protection.",
  ],
  C: [
    "Document cable selection, locations, source traceability, assumed routing, and overcurrent-protection review.",
    "Document cable-selection and routing model uncertainty, assumptions, and reasonable alternatives.",
    "Document pre-operational cable and routing assumptions and limitations caused by unavailable as-built or as-operated information.",
  ],
}, {
  "FCS-B3": ["PRE_OPERATIONAL"],
  "FCS-C3": ["PRE_OPERATIONAL"],
});

export const FQLS_SR_CATALOG = createInternalFireSrCatalog("FQLS", {
  A: [
    "Retain PAUs containing equipment or cables needed for modeled functions, including potential spurious operation.",
    "Retain PAUs where fire could require a plant trip, controlled shutdown, or Technical Specifications action.",
    "Apply the approved qualitative screening criteria to every defined PAU.",
    "Specify and justify any additional qualitative criterion as at least as protective as the required criteria.",
    "Identify qualitative-screening model uncertainty, assumptions, alternatives, and potential risk impact.",
    "Identify pre-operational qualitative-screening assumptions caused by unavailable as-built or as-operated information.",
  ],
  B: [
    "Document screening criteria, every PAU disposition, and the basis for each screened-out PAU.",
    "Document qualitative-screening model uncertainty, assumptions, and reasonable alternatives.",
    "Document pre-operational screening assumptions and limitations caused by unavailable as-built or as-operated information.",
  ],
}, {
  "FQLS-A6": ["PRE_OPERATIONAL"],
  "FQLS-B3": ["PRE_OPERATIONAL"],
});

export const FPRM_SR_CATALOG = createInternalFireSrCatalog("FPRM", {
  A: [
    "Construct the fire plant-response model to determine conditional probabilities for modeled fire-induced sequences and sequence families.",
    "Construct the model to determine annual fire-induced sequence and sequence-family frequencies when ignition frequencies are applied.",
    "Construct the model to identify risk-significant fire contributors.",
  ],
  B: [
    "Use internal-events event sequences and systems logic as the basis and add fire-specific multi-reactor or multi-source sequences as needed.",
    "Resolve and incorporate relevant internal-events and other-hazard peer-review findings.",
    "For operating plants, model cable-damage effects on selected equipment.",
    "For pre-operational PRAs, model cable-damage effects using justified assumed routing where exact information is unavailable.",
    "Develop new fire-induced initiating events using the applicable Initiating Event Analysis requirements.",
    "Review baseline event sequences and identify modifications or additions required by fire-response procedures and conditions.",
    "Model fire-induced event sequences using applicable Event Sequence Analysis requirements and fire-response procedures.",
    "Identify new or modified success criteria required by fire conditions.",
    "Define fire-specific success criteria using applicable Success Criteria requirements.",
    "Modify or create systems models and split fractions for fire equipment failures, spurious operations, and fire-specific human actions.",
    "Conservatively fail potentially fire-vulnerable equipment when cable routing has neither been established nor assumed.",
    "Identify probability inputs that require fire-context reanalysis or are absent from the baseline PRA.",
    "Perform applicable Data Analysis for fire-context probability inputs.",
    "Identify new event sequences applicable to Internal Fire PRA but absent from internal-events models.",
    "Model new event sequences to determine fire-induced sequences and sequence families with applicable fire-specific requirements.",
    "Identify plant-response model uncertainty, assumptions, alternatives, and potential risk impact.",
    "Identify pre-operational plant-response assumptions caused by unavailable as-built or as-operated information.",
  ],
  C: [
    "Document plant-response inputs, methods, peer-review dispositions, initiating events, model changes, and results.",
    "Document initiating events, event sequences, success criteria, systems, data, and circuit-failure treatments using applicable requirements.",
    "Document plant-response model uncertainty, assumptions, and reasonable alternatives.",
    "Document pre-operational plant-response assumptions and limitations caused by unavailable as-built or as-operated information.",
  ],
}, {
  "FPRM-B3": ["OPERATIONAL"],
  "FPRM-B4": ["PRE_OPERATIONAL"],
  "FPRM-B17": ["PRE_OPERATIONAL"],
  "FPRM-C4": ["PRE_OPERATIONAL"],
});

export const FSS_SR_CATALOG = createInternalFireSrCatalog("FSS", {
  A: [
    "Identify fixed and transient ignition sources capable of damaging at least one modeled target in every retained PAU.",
    "Identify risk-relevant equipment and cable target sets in every retained PAU.",
    "Conservatively fail cables with unresolved routing when a scenario damages any raceway from which the cable cannot be excluded.",
    "Select sufficient ignition-source and target-set combinations to characterize each retained PAU and risk-significant contributor.",
  ],
  B: [
    "Specify and justify conditions requiring transfer of primary command and control outside the main control room.",
    "Select sufficient control-room-abandonment scenarios to bound or characterize their fire-risk contribution.",
  ],
  C: [
    "Assign justified ignition-source intensity and duration, including probabilistic representations for risk-significant scenarios where supported.",
    "Use representative time-dependent fire growth for risk-significant scenarios and conservative peak intensity where appropriate.",
    "Characterize total heat-release-rate profiles, secondary combustibles, growth, steady burning, and decay.",
    "Apply independent, consistently based severity factors and document their derivation.",
    "Use damage criteria representative of each fire-scenario target.",
    "Determine target damage when thresholds are exceeded and calculate thermal response where it materially affects risk.",
    "Justify credited localized fire barriers and include scenarios involving their failure.",
  ],
  D: [
    "Use fire-modeling tools capable of the conditions of interest and within their applicability limits.",
    "Use conservative analysis to bound PAU risk or sufficient fire analysis to characterize retained scenarios.",
    "Specify the basis for fire-model input values in each scenario context.",
    "Use plant-specific fire-model parameters when available and applicable generic information otherwise.",
    "Use analogous data with adjustment or qualified expert judgment when direct parameter information is unavailable.",
    "Specify the basis for statistical models used in fire-scenario analysis.",
    "Specify the basis and applicability of empirical fire models.",
    "Evaluate smoke damage qualitatively and include the assessment in target-set definitions.",
    "Confirm selected source-target combinations and plant conditions through investigation.",
    "For operating plants, confirm risk-significant scenario characteristics, targets, combustibles, barriers, suppression, and PAU conditions through investigation.",
    "For pre-operational PRAs, confirm risk-significant scenario assumptions through designer or knowledgeable-personnel interviews.",
  ],
  E: [
    "Use justified detection and suppression unavailability and model dependencies among credited suppression paths.",
    "For pre-operational PRAs, confirm generic suppression-system unavailability assumptions with knowledgeable design personnel.",
    "Assess detection and suppression effectiveness for each scenario, including time, obstructions, coverage, and source suitability.",
    "Calculate nonsuppression probability and characterize uncertainty for risk-significant scenarios.",
    "Use fire-frequency and nonsuppression data consistently to prevent double counting.",
  ],
  F: [
    "Identify locations containing both exposed structural steel and a high-hazard ignition source and select relevant scenarios.",
    "Assess the risk of fire-induced structural-steel damage or collapse at the required capability level.",
  ],
  G: [
    "Apply the single-PAU fire-characterization requirements to multi-compartment scenarios where applicable.",
    "Apply quantitative screening criteria to all PAUs involved in potential multi-compartment fires.",
    "Select sufficient multi-compartment scenarios for every retained PAU combination.",
    "Credit rated passive barriers consistently with qualification and quantify failure where required.",
    "Specify the basis for crediting nonrated passive barriers and quantify failure where required.",
    "Assess or quantify active-barrier reliability, availability, and scenario effectiveness.",
    "Assess or calculate the risk contribution of selected multi-compartment scenarios.",
    "Identify fire-scenario model uncertainty, assumptions, alternatives, and potential risk impact.",
    "Identify pre-operational fire-scenario assumptions caused by unavailable as-built or as-operated information.",
  ],
  H: [
    "Document scenario-selection inputs, methods, damage criteria, tools, suppression credit, structural-steel treatment, multi-compartment method, investigations, and results.",
    "Document each scenario's ignition source, target set, severity factor, nonsuppression probability, model inputs, outputs, and uncertainty.",
    "Document fire-scenario model uncertainty, assumptions, and reasonable alternatives.",
    "Document pre-operational fire-scenario assumptions and limitations caused by unavailable as-built or as-operated information.",
  ],
}, {
  "FSS-D10": ["OPERATIONAL"],
  "FSS-D11": ["PRE_OPERATIONAL"],
  "FSS-E2": ["PRE_OPERATIONAL"],
  "FSS-G9": ["PRE_OPERATIONAL"],
  "FSS-H4": ["PRE_OPERATIONAL"],
});

export const FIGN_SR_CATALOG = createInternalFireSrCatalog("FIGN", {
  A: [
    "Use applicable current nuclear-industry fire-event experience from similar plants and justify exclusions.",
    "Use nonnuclear industry data only when similar nuclear experience is unavailable and demonstrate full applicability and reviewability.",
    "Use qualified expert judgment when neither nuclear nor nonnuclear data are available.",
    "For operating plants, review plant-specific fire experience for outliers and update frequency when required.",
    "For operating plants, estimate ignition frequencies per plant-year and account for at-power availability.",
    "For pre-operational PRAs, estimate generic fire-ignition frequencies per plant-year.",
    "Combine generic, technology, and plant evidence using Bayesian or equivalent statistical updating.",
    "Use a plant-wide consistent method to apportion fixed and transient ignition frequencies to PAUs or sources.",
    "Assign a nonzero ignition frequency to every PAU retained after qualitative screening.",
    "Calculate required point or mean ignition-frequency estimates and characterize uncertainty for risk-significant scenarios.",
    "Identify ignition-frequency model uncertainty, assumptions, alternatives, and potential risk impact.",
    "Identify pre-operational ignition-frequency assumptions caused by unavailable as-built or as-operated information.",
  ],
  B: [
    "Document fire-event sources, ignition-frequency methods, apportionment, plant-specific updates, Bayesian analysis, and results.",
    "Document ignition-frequency model uncertainty, assumptions, and reasonable alternatives.",
    "Document pre-operational ignition-frequency assumptions and limitations caused by unavailable as-built or as-operated information.",
  ],
}, {
  "FIGN-A4": ["OPERATIONAL"],
  "FIGN-A5": ["OPERATIONAL"],
  "FIGN-A6": ["PRE_OPERATIONAL"],
  "FIGN-A12": ["PRE_OPERATIONAL"],
  "FIGN-B3": ["PRE_OPERATIONAL"],
});

export const FCF_SR_CATALOG = createInternalFireSrCatalog("FCF", {
  A: [
    "Assign circuit failure-mode probabilities consistent with generic data, damaged cables, circuit characteristics, and hot-short duration where applicable.",
    "Calculate required circuit failure-mode and duration probabilities and characterize their uncertainty.",
    "Identify circuit-failure model uncertainty, assumptions, alternatives, and potential risk impact.",
    "Identify pre-operational circuit-failure assumptions caused by unavailable as-built or as-operated information.",
  ],
  B: [
    "Document circuit-failure inputs, methods, probability bases, hot-short duration credit, uncertainty, and results.",
    "Document circuit-failure model uncertainty, assumptions, and reasonable alternatives.",
    "Document pre-operational circuit-failure assumptions and limitations caused by unavailable as-built or as-operated information.",
  ],
}, {
  "FCF-A4": ["PRE_OPERATIONAL"],
  "FCF-B3": ["PRE_OPERATIONAL"],
});

export const FHR_SR_CATALOG = createInternalFireSrCatalog("FHR", {
  A: [
    "Identify new fire-specific safe-shutdown actions and undesirable responses caused by fire-induced indications.",
    "For operating plants, confirm procedure interpretation with operations and training personnel through review or talk-through.",
    "For pre-operational PRAs, confirm operating-philosophy and procedure assumptions with design personnel through review or talk-through.",
  ],
  B: [
    "Include new fire-related safe-shutdown HFEs in the fire plant-response model.",
    "Define retained, modified, and new Internal Fire PRA HFEs with complete scenario context.",
  ],
  C: [
    "Quantify HEPs using fire-specific performance factors, timing, dependencies, detailed analysis for significant contributors, and conservative values otherwise.",
  ],
  D: [
    "Credit fire-specific recovery only when plausible and feasible and quantify corresponding HEPs with fire effects.",
    "Identify fire-HRA model uncertainty, assumptions, alternatives, and potential risk impact.",
    "Identify pre-operational fire-HRA assumptions caused by unavailable as-built or as-operated information.",
  ],
  E: [
    "Document fire-HRA inputs, methods, contexts, actions, HFEs, HEPs, recovery, dependencies, and results.",
    "Document fire-HRA model uncertainty, assumptions, and reasonable alternatives.",
    "Document pre-operational fire-HRA assumptions and limitations caused by unavailable as-built or as-operated information.",
  ],
}, {
  "FHR-A2": ["OPERATIONAL"],
  "FHR-A3": ["PRE_OPERATIONAL"],
  "FHR-D3": ["PRE_OPERATIONAL"],
  "FHR-E3": ["PRE_OPERATIONAL"],
});

export const FESQ_SR_CATALOG = createInternalFireSrCatalog("FESQ", {
  A: [
    "Apply applicable quantitative screening criteria to fire scenarios and event-sequence families.",
    "Model scenario-specific equipment and cable failures as basic events or impacts on existing basic events.",
    "Identify and justify the initiating event associated with each quantified fire scenario.",
    "Include scenario-specific circuit-failure, HRA, damage, and initiating-event quantification factors in the plant-response model.",
    "Calculate fire-induced risk using ignition frequencies, conditional damage, circuit failures, human actions, and applicable quantification requirements.",
  ],
  B: [
    "Use appropriate models and codes, demonstrate convergence at a sufficiently low truncation level, and address method limitations.",
  ],
  C: [
    "Include equipment, cable, spatial, functional, common-cause, operator, suppression, and other dependencies in quantification.",
  ],
  D: [
    "Identify risk-significant PAUs, scenarios, ignition sources, equipment, HFEs, failure modes, sequences, and results.",
    "Identify quantification model uncertainty and assumptions for integrated uncertainty analysis.",
    "Identify pre-operational quantification assumptions caused by unavailable as-built or as-operated information.",
  ],
  E: [
    "Integrate model uncertainties and assumptions identified across all Internal Fire technical subelements.",
    "Perform parametric and model uncertainty analysis for Internal Fire PRA results.",
  ],
  F: [
    "Document quantification inputs, methods, results, significant PAUs and scenarios, and applicable sequence-family information.",
    "Document quantification model uncertainty, assumptions, and reasonable alternatives.",
    "Document pre-operational quantification assumptions and limitations caused by unavailable as-built or as-operated information.",
    "Document quantification-process limitations that could affect PRA applications.",
  ],
}, {
  "FESQ-D3": ["PRE_OPERATIONAL"],
  "FESQ-F3": ["PRE_OPERATIONAL"],
});

export const INTERNAL_FIRE_PRA_SR_CATALOG: Record<string, InternalFireSrCatalogEntry> = {
  ...FPP_SR_CATALOG,
  ...FES_SR_CATALOG,
  ...FCS_SR_CATALOG,
  ...FQLS_SR_CATALOG,
  ...FPRM_SR_CATALOG,
  ...FSS_SR_CATALOG,
  ...FIGN_SR_CATALOG,
  ...FCF_SR_CATALOG,
  ...FHR_SR_CATALOG,
  ...FESQ_SR_CATALOG,
};
