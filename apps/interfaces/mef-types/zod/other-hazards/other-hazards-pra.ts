import { z } from "zod";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { SRReferenceSchema } from "../core/pra-common";
import { HazardConditionedMethodModelsSchema, createEmptyHazardConditionedMethodModels } from "../hazard-conditioned-models";

const stringArray = z.array(z.string());

export const OtherHazardsPraSubelementSchema = z.enum(["OHA", "OFR", "OPR"]);
export const OtherHazardsRecordStatusSchema = z.enum(["DRAFT", "READY", "REVIEWED", "APPROVED", "SCREENED", "RETAINED", "OPEN", "CLOSED"]);
export const OtherHazardCategorySchema = z.enum([
  "METEOROLOGICAL",
  "HYDROLOGICAL_OTHER",
  "GEOLOGICAL_OTHER",
  "BIOLOGICAL",
  "EXTRATERRESTRIAL",
  "HUMAN_INDUCED_EXTERNAL",
  "INTERNAL_MECHANICAL",
  "INTERNAL_CHEMICAL",
  "SITE_INFRASTRUCTURE",
  "OTHER",
]);
export const OtherHazardEffectSchema = z.enum([
  "IMPACT",
  "PRESSURE",
  "THERMAL",
  "VIBRATION",
  "TOXIC_ASPHYXIANT",
  "CORROSIVE",
  "BLOCKAGE_FOULING",
  "TEMPERATURE",
  "HUMIDITY_MOISTURE",
  "ELECTROMAGNETIC",
  "LOSS_OF_SUPPORT",
  "ACCESS_HABITABILITY",
  "FIRE",
  "FLOODING",
  "MISSILE",
  "RADIOLOGICAL_RELEASE",
  "OTHER",
]);

export const OtherHazardsAnalysisRecordSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  code: z.string(),
  description: z.string(),
  basis: z.string(),
  owner: z.string(),
  status: OtherHazardsRecordStatusSchema,
  evidenceRefs: stringArray,
  relatedRefs: stringArray,
  assumptionRefs: stringArray,
  implementsSrs: z.array(SRReferenceSchema),
});

export const OtherHazardsModelUncertaintySchema = OtherHazardsAnalysisRecordSchema.extend({
  sourceSubelement: OtherHazardsPraSubelementSchema,
  uncertaintyType: z.enum(["PARAMETER", "MODEL", "ASSUMPTION"]),
  hazardGroupRefs: stringArray,
  affectedRecordRefs: stringArray,
  potentialImpact: z.string(),
  reasonableAlternatives: stringArray,
  treatment: z.string(),
  sensitivityStudyRefs: stringArray,
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export const OtherHazardsPreOperationalAssumptionSchema = OtherHazardsAnalysisRecordSchema.extend({
  affectedRecordRefs: stringArray,
  missingDesignInformation: stringArray,
  limitation: z.string(),
  closureAction: z.string(),
  closurePhase: z.string(),
  closureStatus: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});

export const OtherHazardsProcessDocumentationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  processDescription: z.string(),
  inputsDescription: z.string(),
  methodsDescription: z.string(),
  resultsDescription: z.string(),
  limitations: stringArray,
  supportingDocumentRefs: stringArray,
  traceabilityLinks: z.array(z.object({
    uuid: z.string(),
    requirementRef: z.string(),
    inputRefs: stringArray,
    modelRefs: stringArray,
    resultRefs: stringArray,
    documentationRefs: stringArray,
  })),
});

const commonSectionShape = {
  modelUncertainties: z.array(OtherHazardsModelUncertaintySchema),
  preOperationalAssumptions: z.array(OtherHazardsPreOperationalAssumptionSchema),
  documentation: OtherHazardsProcessDocumentationSchema,
};

export const OtherHazardsInvestigationSchema = OtherHazardsAnalysisRecordSchema.extend({
  investigationType: z.enum(["WALKDOWN", "INTERVIEW", "TALK_THROUGH", "TABLETOP", "COMPUTERIZED_WALKDOWN", "DOCUMENT_REVIEW", "SITE_RECONNAISSANCE", "SURVEY"]),
  scope: z.string(),
  hazardGroupRefs: stringArray,
  plantOperatingStateRefs: stringArray,
  locations: stringArray,
  participants: stringArray,
  performedDate: z.string(),
  observations: stringArray,
  findingRefs: stringArray,
  confirmedRecordRefs: stringArray,
});

export const OtherHazardsScreeningDecisionSchema = OtherHazardsAnalysisRecordSchema.extend({
  screenedObjectType: z.enum(["SSC", "HAZARD_EFFECT", "FAILURE_MODE", "SCENARIO", "EVENT_SEQUENCE_FAMILY"]),
  screenedObjectRefs: stringArray,
  hazardGroupRefs: stringArray,
  hazardEffects: z.array(OtherHazardEffectSchema),
  criterion: z.enum(["SCR-1", "SCR-2", "SCR-3", "APPROVED_ALTERNATE", "RETAINED"]),
  disposition: z.enum(["SCREENED", "RETAINED"]),
  conservativeAssumptions: stringArray,
  quantitativeValue: z.number().optional(),
  quantitativeUnit: z.string().optional(),
  threshold: z.number().optional(),
  aggregateFrequencyPerPlantYear: z.number().optional(),
  investigationRefs: stringArray,
  affectedEventSequenceFamilyRefs: stringArray,
});

const interfaceCodeSchema = z.enum(["HS", "POS", "IE", "ES", "SC", "SY", "HR", "DA", "ESQ", "MS", "RC", "RI", "S", "F", "FL", "W", "XF", "CC"]);
export const OtherHazardsPraInterfaceRecordSchema = OtherHazardsAnalysisRecordSchema.extend({
  technicalElementCode: interfaceCodeSchema,
  technicalElementName: z.string(),
  direction: z.enum(["INPUT", "OUTPUT"]),
  role: z.string(),
  producer: z.union([interfaceCodeSchema, z.literal("O")]),
  consumer: z.union([interfaceCodeSchema, z.literal("O")]),
  payloadType: z.enum([
    "HAZARD_SCREENING_RESULT", "OPERATING_STATE", "INITIATING_EVENT", "EVENT_SEQUENCE", "SUCCESS_CRITERION",
    "SYSTEM_MODEL", "HUMAN_FAILURE_EVENT", "DATA_PARAMETER", "HAZARD_CURVE", "FRAGILITY",
    "OTHER_HAZARDS_SSC_LIST", "SECONDARY_HAZARD", "SEQUENCE_FAMILY_RESULT", "PLANT_DAMAGE_STATE",
    "RELEASE_CATEGORY", "RISK_CONTRIBUTOR", "CONFIGURATION_BASELINE",
  ]),
  columns: stringArray,
  transferItems: z.array(z.object({
    uuid: z.string(),
    name: z.string(),
    recordRef: z.string(),
    sourceModelRef: z.string(),
    destinationRefs: stringArray,
    values: stringArray,
    evidenceRefs: stringArray,
    status: z.enum(["CONTROLLED", "WORKING", "OPEN"]),
  })),
  producerRefs: stringArray,
  consumerRefs: stringArray,
  consistencyChecks: stringArray,
  consistent: z.boolean(),
  openItems: stringArray,
});

const applicationSchema = OtherHazardsAnalysisRecordSchema.extend({
  purpose: z.string(),
  decisionContext: z.string(),
  supportedRiskMetrics: stringArray,
  consumingElementRefs: stringArray,
  configurationBasis: z.string(),
  limitations: stringArray,
});

const evidenceRecordSchema = OtherHazardsAnalysisRecordSchema.extend({
  evidenceType: z.enum(["STANDARD", "SITE_DATA", "REGIONAL_DATA", "GENERIC_DATA", "DRAWING", "CALCULATION", "PROCEDURE", "MODEL", "INVESTIGATION", "INTERVIEW", "OPERATING_EXPERIENCE", "TEST_DATA", "REVIEW", "OTHER"]),
  sourceReference: z.string(),
  revision: z.string().optional(),
  effectiveDate: z.string().optional(),
  applicableSubelements: z.array(OtherHazardsPraSubelementSchema),
  hazardGroupRefs: stringArray,
  applicability: z.string(),
  qualityAndLimitations: z.string(),
  fileReference: z.string().optional(),
  controlled: z.boolean(),
});

const baselineTreatmentSchema = OtherHazardsAnalysisRecordSchema.extend({
  technicalArea: z.enum(["PLANT_OPERATING_STATES", "INITIATING_EVENTS", "EVENT_SEQUENCES", "SUCCESS_CRITERIA", "SYSTEMS", "DATA", "HUMAN_RELIABILITY", "LEVEL_2", "RISK_INTEGRATION"]),
  sourceRecordRefs: stringArray,
  treatment: z.enum(["REUSED", "MODIFIED", "NEW", "NOT_APPLICABLE"]),
  otherHazardsChange: z.string(),
  unresolvedItems: stringArray,
});

const baselinePraSchema = z.object({
  modelName: z.string(),
  modelReference: z.string(),
  revision: z.string(),
  freezeDate: z.string(),
  freezeStatus: z.enum(["WORKING", "FROZEN", "REFERENCE_ONLY"]),
  modelBoundary: z.string(),
  plantOperatingStateRefs: stringArray,
  reactorUnitRefs: stringArray,
  radioactiveMaterialSourceRefs: stringArray,
  recordTreatments: z.array(baselineTreatmentSchema),
  unresolvedInterfaces: stringArray,
});

const siteBasisSchema = OtherHazardsAnalysisRecordSchema.extend({
  siteBasisType: z.enum(["SPECIFIC_SITE", "BOUNDING_SITE"]),
  siteName: z.string(),
  latitudeDegrees: z.number().optional(),
  longitudeDegrees: z.number().optional(),
  elevationMetres: z.number().optional(),
  siteSelectionStatus: z.enum(["SELECTED", "CANDIDATE", "BOUNDING_ENVELOPE"]),
  boundingSiteRefs: stringArray,
  boundingCharacteristics: stringArray,
  regionalSettingDescription: z.string(),
  terrainAndTopographyDescription: z.string(),
  nearbyFacilityAndTransportDescription: z.string(),
  licenseeControlledAreaDescription: z.string(),
  reactorUnitRefs: stringArray,
  radioactiveMaterialSourceRefs: stringArray,
  plantOperatingStateRefs: stringArray,
  multiReactorOrMultiSourceLocations: stringArray,
  analysisDateCutoff: z.string(),
});

const scopeRecordSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRefs: stringArray,
  includedPlantLocations: stringArray,
  excludedPlantLocations: stringArray,
  includedOperatingStateRefs: stringArray,
  includedReactorUnitRefs: stringArray,
  includedRadioactiveMaterialSourceRefs: stringArray,
  riskMetrics: stringArray,
  intendedCapabilityCategory: z.enum(["CC-I", "CC-II"]),
});

const siteDataRecordSchema = OtherHazardsAnalysisRecordSchema.extend({
  dataType: z.enum(["METEOROLOGY", "HYDROLOGY", "GEOLOGY", "TOPOGRAPHY", "LAND_USE", "INDUSTRIAL_ACTIVITY", "TRANSPORTATION", "PIPELINE", "AIR_TRAFFIC", "BIOLOGICAL", "PLANT_CONFIGURATION", "OTHER"]),
  sourceReference: z.string(),
  spatialCoverage: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  resolution: z.string(),
  completeness: z.number(),
  applicability: z.string(),
  limitations: stringArray,
});

const designBasisRecordSchema = OtherHazardsAnalysisRecordSchema.extend({
  informationType: z.enum(["DRAWING", "LAYOUT", "DESIGN_CRITERION", "QUALIFICATION", "PROTECTION_FEATURE", "PROCEDURE", "CALCULATION", "OTHER"]),
  sourceReference: z.string(),
  revision: z.string(),
  affectedLocations: stringArray,
  affectedSscRefs: stringArray,
  currentConfigurationConfirmed: z.boolean(),
  confirmationRef: z.string(),
});

const operatingExperienceSchema = OtherHazardsAnalysisRecordSchema.extend({
  eventDate: z.string(),
  facilityOrIndustry: z.string(),
  hazardDescription: z.string(),
  hazardEffects: z.array(OtherHazardEffectSchema),
  affectedFunctions: stringArray,
  lessonsApplied: stringArray,
  applicability: z.string(),
});

export const OtherHazardsAnalysisBasisSchema = z.object({
  siteBasis: siteBasisSchema.optional(),
  scopeRecords: z.array(scopeRecordSchema),
  applications: z.array(applicationSchema),
  evidenceRegister: z.array(evidenceRecordSchema),
  siteAndRegionalData: z.array(siteDataRecordSchema),
  designBasisRecords: z.array(designBasisRecordSchema),
  operatingExperience: z.array(operatingExperienceSchema),
  baselinePra: baselinePraSchema.optional(),
  interfaces: z.array(OtherHazardsPraInterfaceRecordSchema),
  ...commonSectionShape,
});

const retainedHazardGroupSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardCategory: OtherHazardCategorySchema,
  hazardName: z.string(),
  includedSubhazards: stringArray,
  excludedSubhazards: stringArray,
  sourceHsaRefs: stringArray,
  retainedBasis: z.string(),
  analysisBoundary: z.string(),
  primaryEffects: z.array(OtherHazardEffectSchema),
  candidateIntensityMeasures: stringArray,
  selectedIntensityMeasure: z.string(),
  intensityUnit: z.string(),
  plantOperatingStateRefs: stringArray,
  reactorUnitRefs: stringArray,
  radioactiveMaterialSourceRefs: stringArray,
  analysisStatus: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETE"]),
});

const completenessReviewSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  reviewedSubhazards: stringArray,
  screeningBoundary: z.string(),
  omittedPhenomena: stringArray,
  omissionBasis: z.string(),
  complete: z.boolean(),
});

const overlapControlSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  potentiallyOverlappingElementCodes: stringArray,
  overlapDescription: z.string(),
  retainedInOtherHazards: stringArray,
  transferredOut: stringArray,
  doubleCountingControl: z.string(),
  confirmed: z.boolean(),
});

export const OtherHazardsRetainedHazardGroupsSchema = z.object({
  hazardGroups: z.array(retainedHazardGroupSchema),
  completenessReviews: z.array(completenessReviewSchema),
  overlapControls: z.array(overlapControlSchema),
  ...commonSectionShape,
});

const hazardSourceSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  sourceType: z.enum(["NATURAL_PROCESS", "FIXED_FACILITY", "TRANSPORT_ROUTE", "PIPELINE", "AIR_TRAFFIC", "ONSITE_ACTIVITY", "PLANT_EQUIPMENT", "BIOLOGICAL_POPULATION", "EXTRATERRESTRIAL", "OTHER"]),
  sourceLocation: z.string(),
  distanceToPlantKilometres: z.number().optional(),
  sourceInventory: z.string(),
  sourceDimensions: z.string(),
  operatingOrOccurrenceState: z.string(),
  releaseOrGenerationMechanism: z.string(),
  affectedPlantLocations: stringArray,
  sourceDataRefs: stringArray,
});

const intensityMeasureSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  parameterName: z.string(),
  unit: z.string(),
  physicalMeaning: z.string(),
  sourceToSiteTransformation: z.string(),
  plantResponseRelevance: z.string(),
  fragilityCompatibility: z.string(),
  selected: z.boolean(),
});

const effectModelSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  sourceRefs: stringArray,
  hazardEffects: z.array(OtherHazardEffectSchema),
  modelName: z.string(),
  modelDescription: z.string(),
  inputParameters: stringArray,
  outputParameters: stringArray,
  affectedLocations: stringArray,
  verificationAndValidation: z.string(),
  limitations: stringArray,
});

const spatialZoneSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  zoneType: z.enum(["SOURCE_ZONE", "IMPACT_ZONE", "PLUME_ZONE", "THERMAL_ZONE", "VIBRATION_ZONE", "BLOCKAGE_ZONE", "ACCESS_ZONE", "OTHER"]),
  boundaryDescription: z.string(),
  plantLocations: stringArray,
  sscRefs: stringArray,
  intensityVariation: z.string(),
  shieldingOrAttenuation: z.string(),
});

const hazardTimelineSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  onsetType: z.enum(["SUDDEN", "DEVELOPING", "FORECASTABLE", "PERSISTENT"]),
  warningTimeHours: z.number(),
  riseTimeHours: z.number(),
  durationHours: z.number(),
  recoveryEnvironmentHours: z.number(),
  keyCues: stringArray,
  temporalDependencies: stringArray,
});

export const OtherHazardsSourceCharacterizationSchema = z.object({
  hazardSources: z.array(hazardSourceSchema),
  intensityMeasures: z.array(intensityMeasureSchema),
  effectModels: z.array(effectModelSchema),
  spatialZones: z.array(spatialZoneSchema),
  timelineModels: z.array(hazardTimelineSchema),
  ...commonSectionShape,
});

const occurrenceDataSetSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  dataSourceType: z.enum(["SITE_SPECIFIC", "REGIONAL", "GENERIC", "HISTORICAL", "EXPERIMENTAL", "SIMULATED", "EXPERT_JUDGMENT"]),
  sourceReference: z.string(),
  spatialCoverage: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  eventCount: z.number(),
  observationYears: z.number(),
  completeness: z.number(),
  biasCorrections: stringArray,
  acceptedUses: stringArray,
});

const occurrenceModelSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  dataSetRefs: stringArray,
  modelType: z.enum(["EMPIRICAL_FREQUENCY", "EXTREME_VALUE", "POISSON", "FAULT_TREE", "EVENT_TREE", "PHENOMENOLOGICAL", "MONTE_CARLO", "BAYESIAN", "OTHER"]),
  intensityMeasureRef: z.string(),
  occurrenceRatePerYear: z.number(),
  severityDistribution: z.string(),
  spatialOccurrenceModel: z.string(),
  temporalModel: z.string(),
  fittingOrCalibrationMethod: z.string(),
  goodnessOfFit: z.string(),
  extrapolationTreatment: z.string(),
});

const applicabilityAssessmentSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  dataSetRef: z.string(),
  comparisonAttributes: stringArray,
  siteValues: stringArray,
  sourceRegionValues: stringArray,
  differences: stringArray,
  adjustmentMethod: z.string(),
  conservatismAssessment: z.string(),
  applicable: z.boolean(),
});

const expertJudgmentSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  elicitationQuestion: z.string(),
  experts: stringArray,
  independenceControls: stringArray,
  briefingMaterials: stringArray,
  elicitedQuantities: stringArray,
  aggregationMethod: z.string(),
  calibrationMethod: z.string(),
  results: stringArray,
});

const frequencyResultSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  occurrenceModelRef: z.string(),
  intensityMeasureRef: z.string(),
  intensityValue: z.number(),
  intensityUnit: z.string(),
  meanAnnualExceedanceFrequency: z.number(),
  fifthPercentileFrequency: z.number(),
  medianFrequency: z.number(),
  ninetyFifthPercentileFrequency: z.number(),
  location: z.string(),
});

export const OtherHazardsFrequencyAnalysisSchema = z.object({
  occurrenceDataSets: z.array(occurrenceDataSetSchema),
  occurrenceModels: z.array(occurrenceModelSchema),
  regionalApplicabilityAssessments: z.array(applicabilityAssessmentSchema),
  expertJudgmentPanels: z.array(expertJudgmentSchema),
  frequencyResults: z.array(frequencyResultSchema),
  ...commonSectionShape,
});

const secondaryHazardScenarioSchema = OtherHazardsAnalysisRecordSchema.extend({
  primaryHazardGroupRef: z.string(),
  secondaryHazardType: z.enum(["INTERNAL_FIRE", "INTERNAL_FLOOD", "EXTERNAL_FLOOD", "EXPLOSION", "MISSILE", "TOXIC_ENVIRONMENT", "STRUCTURAL_COLLAPSE", "LOSS_OF_OFFSITE_POWER", "OTHER"]),
  generationMechanism: z.string(),
  conditionalOccurrenceProbability: z.number(),
  affectedLocations: stringArray,
  affectedSscRefs: stringArray,
  temporalRelationship: z.string(),
  analysisElementCode: z.enum(["O", "F", "FL", "XF", "IE", "OTHER"]),
  transferredRecordRefs: stringArray,
});

const combinedHazardSchema = OtherHazardsAnalysisRecordSchema.extend({
  primaryHazardGroupRef: z.string(),
  combinedHazards: stringArray,
  relationship: z.enum(["CAUSALLY_RELATED", "COINCIDENT", "SEQUENTIAL", "COMMON_CONDITION"]),
  jointFrequencyMethod: z.string(),
  dependencyTreatment: z.string(),
  combinedEffects: z.array(OtherHazardEffectSchema),
  plantResponseTreatment: z.string(),
  doubleCountingControl: z.string(),
});

const transferredAnalysisSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  destinationElementCode: z.enum(["F", "FL", "XF", "IE", "ES", "SY", "HR", "ESQ", "RI"]),
  transferredScenarioRefs: stringArray,
  transferContent: stringArray,
  receivingRecordRefs: stringArray,
  acceptanceStatus: z.enum(["PROPOSED", "ACCEPTED", "REJECTED", "CLOSED"]),
  overlapControl: z.string(),
});

export const OtherHazardsSecondaryAndCombinedHazardsSchema = z.object({
  secondaryHazardScenarios: z.array(secondaryHazardScenarioSchema),
  combinedHazardAssessments: z.array(combinedHazardSchema),
  transferredAnalyses: z.array(transferredAnalysisSchema),
  dependencyControls: z.array(OtherHazardsAnalysisRecordSchema),
  ...commonSectionShape,
});

const logicTreeBranchSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  branchType: z.enum(["DATA", "OCCURRENCE_MODEL", "SEVERITY_MODEL", "SOURCE_TO_SITE", "EFFECT_MODEL", "EXPERT_JUDGMENT", "OTHER"]),
  parentBranchRef: z.string().optional(),
  branchChoice: z.string(),
  branchWeight: z.number(),
  rationale: z.string(),
});

const curvePointSchema = z.object({
  intensity: z.number(),
  meanAnnualExceedanceFrequency: z.number(),
  fifthPercentileFrequency: z.number().optional(),
  medianFrequency: z.number().optional(),
  ninetyFifthPercentileFrequency: z.number().optional(),
});

const hazardCurveSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  intensityMeasureRef: z.string(),
  intensityUnit: z.string(),
  location: z.string(),
  logicTreeBranchRefs: stringArray,
  curvePoints: z.array(curvePointSchema),
  representsMeanCurve: z.boolean(),
  uncertaintyFamilyAvailable: z.boolean(),
  lowerAnalysisLimit: z.number(),
  upperAnalysisLimit: z.number(),
  extrapolationBasis: z.string(),
});

const hazardIntervalSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  hazardCurveRef: z.string(),
  lowerIntensity: z.number(),
  upperIntensity: z.number(),
  representativeIntensity: z.number(),
  intervalAnnualFrequency: z.number(),
  conditionalWeight: z.number(),
  upperTail: z.boolean(),
});

const convergenceStudySchema = OtherHazardsAnalysisRecordSchema.extend({
  studyType: z.enum(["HAZARD_INTERVALS", "UPPER_TAIL", "TRUNCATION", "SAMPLING", "SCENARIO_GROUPING", "OTHER"]),
  hazardGroupRefs: stringArray,
  testedValues: stringArray,
  resultValues: stringArray,
  maximumRelativeDifference: z.number(),
  acceptanceCriterion: z.number(),
  converged: z.boolean(),
});

export const OtherHazardsHazardCurveAnalysisSchema = z.object({
  logicTreeBranches: z.array(logicTreeBranchSchema),
  hazardCurves: z.array(hazardCurveSchema),
  hazardIntervals: z.array(hazardIntervalSchema),
  convergenceStudies: z.array(convergenceStudySchema),
  ...commonSectionShape,
});

const preliminaryInitiatingEventSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRefs: stringArray,
  eventType: z.enum(["DIRECT", "SECONDARY", "DEGRADED_CONDITION", "COMMON_CAUSE", "MULTI_UNIT"]),
  initiatingEventRef: z.string(),
  affectedOperatingStateRefs: stringArray,
  affectedUnitRefs: stringArray,
  affectedRadioactiveMaterialSourceRefs: stringArray,
  affectedSafetyFunctions: stringArray,
  preliminaryFrequencyBasis: z.string(),
});

const modelReviewSchema = OtherHazardsAnalysisRecordSchema.extend({
  baselineModelRef: z.string(),
  reviewType: z.enum(["SYSTEM_LOGIC", "EVENT_SEQUENCE", "SUCCESS_CRITERIA", "DATA", "HRA", "LEVEL_2", "PEER_REVIEW_FINDING"]),
  sourceRecordRefs: stringArray,
  otherHazardsGap: z.string(),
  requiredChange: z.string(),
  affectedSscRefs: stringArray,
  closureStatus: z.enum(["OPEN", "PLANNED", "INCORPORATED", "NOT_APPLICABLE"]),
});

const failureModeSchema = OtherHazardsAnalysisRecordSchema.extend({
  failureModeType: z.enum(["STRUCTURAL_FAILURE", "FUNCTIONAL_FAILURE", "IMPACT_DAMAGE", "THERMAL_DAMAGE", "ENVIRONMENTAL_EXPOSURE", "BLOCKAGE", "LOSS_OF_SUPPORT", "SPURIOUS_OPERATION", "OPERATOR_INCAPACITATION", "OTHER"]),
  hazardGroupRefs: stringArray,
  hazardEffects: z.array(OtherHazardEffectSchema),
  creditedFunction: z.string(),
  failureDefinition: z.string(),
  requiredState: z.enum(["FUNCTION_DURING_EVENT", "FUNCTION_AFTER_EVENT", "BARRIER_INTEGRITY", "SUPPORT_OPERATOR_ACTION"]),
  supportingElementRefs: stringArray,
  systemModelBasicEventRefs: stringArray,
  eventSequenceRefs: stringArray,
  fragilityRefs: stringArray,
  consequenceDescription: z.string(),
});

const sscListEntrySchema = OtherHazardsAnalysisRecordSchema.extend({
  sscRef: z.string(),
  sscName: z.string(),
  building: z.string(),
  roomOrArea: z.string(),
  elevation: z.string(),
  safetyFunctions: stringArray,
  applicableHazardGroupRefs: stringArray,
  applicableHazardEffects: z.array(OtherHazardEffectSchema),
  failureModes: z.array(failureModeSchema),
  investigationRefs: stringArray,
  disposition: z.enum(["ACTIVE", "SCREENED", "BOUNDING_GROUP", "INFORMATION_ONLY"]),
});

const functionalRequirementSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRefs: stringArray,
  safetyFunction: z.string(),
  requiredSscRefs: stringArray,
  supportingSscRefs: stringArray,
  requiredOperatorActionRefs: stringArray,
  operatingStateRefs: stringArray,
  missionTimeHours: z.number(),
});

export const OtherHazardsPreliminaryPlantResponseSchema = z.object({
  preliminaryInitiatingEvents: z.array(preliminaryInitiatingEventSchema),
  modelReviews: z.array(modelReviewSchema),
  otherHazardsSscList: z.array(sscListEntrySchema),
  functionalRequirements: z.array(functionalRequirementSchema),
  ...commonSectionShape,
});

const investigationFindingSchema = OtherHazardsAnalysisRecordSchema.extend({
  investigationRef: z.string(),
  findingType: z.enum(["CONFIGURATION", "SPATIAL_INTERACTION", "PROTECTION_FEATURE", "SOURCE_INVENTORY", "ACCESS", "PROCEDURE", "DEGRADATION", "OTHER"]),
  location: z.string(),
  affectedSscRefs: stringArray,
  affectedHazardGroupRefs: stringArray,
  condition: z.string(),
  modelImpact: z.string(),
  correctiveAction: z.string(),
  closureStatus: z.enum(["OPEN", "MODELED", "CORRECTED", "CONFIRMED"]),
});

const configurationConfirmationSchema = OtherHazardsAnalysisRecordSchema.extend({
  sourceRecordRef: z.string(),
  investigationRefs: stringArray,
  plantConditionBasis: z.enum(["AS_BUILT_AS_OPERATED", "AS_DESIGNED_AS_INTENDED"]),
  configurationItems: stringArray,
  discrepancies: stringArray,
  resolution: z.string(),
  confirmed: z.boolean(),
});

const accessRouteCheckSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRefs: stringArray,
  humanActionRefs: stringArray,
  routeDescription: z.string(),
  routeSegments: stringArray,
  hazardEffects: z.array(OtherHazardEffectSchema),
  protectiveEquipment: stringArray,
  travelTimeMinutes: z.number(),
  available: z.boolean(),
  alternateRoute: z.string(),
});

export const OtherHazardsPlantInvestigationSchema = z.object({
  investigations: z.array(OtherHazardsInvestigationSchema),
  findings: z.array(investigationFindingSchema),
  configurationConfirmations: z.array(configurationConfirmationSchema),
  accessRouteChecks: z.array(accessRouteCheckSchema),
  ...commonSectionShape,
});

const methodSelectionSchema = OtherHazardsAnalysisRecordSchema.extend({
  sscRefs: stringArray,
  failureModeRefs: stringArray,
  hazardGroupRefs: stringArray,
  methodType: z.enum(["PLANT_SPECIFIC_ANALYSIS", "TEST_DATA", "EXPERIENCE_DATA", "GENERIC_FRAGILITY", "DESIGN_CAPACITY", "SCREENING_BOUND", "HUMAN_RESPONSE_MODEL", "OTHER"]),
  intensityMeasureRef: z.string(),
  capacityModel: z.string(),
  demandModel: z.string(),
  selectedInformationRefs: stringArray,
  applicabilityJustification: z.string(),
  capabilityTreatment: z.enum(["CONSERVATIVE_CC_I", "REALISTIC_CC_II", "BOTH"]),
});

const correlationGroupSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRefs: stringArray,
  memberSscRefs: stringArray,
  commonDemandSources: stringArray,
  commonCapacitySources: stringArray,
  correlationType: z.enum(["FULL", "PARTIAL", "INDEPENDENT", "CONDITIONAL", "MIXED"]),
  correlationCoefficient: z.number().optional(),
  modelTreatment: z.string(),
});

const genericApplicabilitySchema = OtherHazardsAnalysisRecordSchema.extend({
  genericSourceRef: z.string(),
  hazardGroupRefs: stringArray,
  targetSscRefs: stringArray,
  comparedAttributes: stringArray,
  differences: stringArray,
  adjustmentFactors: stringArray,
  conservatismAssessment: z.string(),
  applicable: z.boolean(),
});

export const OtherHazardsFragilityBasisSchema = z.object({
  screeningDecisions: z.array(OtherHazardsScreeningDecisionSchema),
  methodSelections: z.array(methodSelectionSchema),
  correlationGroups: z.array(correlationGroupSchema),
  genericDataApplicability: z.array(genericApplicabilitySchema),
  ...commonSectionShape,
});

const demandModelSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  sscRefs: stringArray,
  failureModeRefs: stringArray,
  intensityMeasureRef: z.string(),
  demandQuantity: z.string(),
  demandUnit: z.string(),
  modelEquationOrCode: z.string(),
  inputParameters: stringArray,
  spatialFactors: stringArray,
  dynamicOrTemporalFactors: stringArray,
  outputRange: z.string(),
  verificationRefs: stringArray,
});

const capacityModelSchema = OtherHazardsAnalysisRecordSchema.extend({
  sscRef: z.string(),
  failureModeRef: z.string(),
  capacityQuantity: z.string(),
  capacityUnit: z.string(),
  medianCapacity: z.number(),
  randomnessBeta: z.number(),
  uncertaintyBeta: z.number(),
  informationSourceRefs: stringArray,
  agingAndConditionFactors: stringArray,
  testOrExperienceBasis: z.string(),
});

const fragilityPointSchema = z.object({ intensity: z.number(), conditionalFailureProbability: z.number() });
const fragilityCurveSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  sscRef: z.string(),
  failureModeRef: z.string(),
  methodSelectionRef: z.string(),
  demandModelRef: z.string(),
  capacityModelRef: z.string(),
  intensityMeasureRef: z.string(),
  intensityUnit: z.string(),
  medianCapacityIntensity: z.number(),
  randomnessBeta: z.number(),
  uncertaintyBeta: z.number(),
  curvePoints: z.array(fragilityPointSchema),
  hazardSpecific: z.boolean(),
  crossHazardUseJustification: z.string(),
  correlationGroupRefs: stringArray,
});

const functionalFailureModelSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRef: z.string(),
  affectedFunction: z.string(),
  physicalOrHumanMechanism: z.enum(["SSC_PHYSICAL_FAILURE", "SSC_FUNCTIONAL_FAILURE", "OPERATOR_INCAPACITATION", "LOSS_OF_ACCESS", "LOSS_OF_CUE", "PROCEDURE_UNAVAILABLE", "OTHER"]),
  intensityMeasureRef: z.string(),
  probabilityModel: z.string(),
  probabilityPoints: z.array(fragilityPointSchema),
  destinationModelRefs: stringArray,
});

const secondaryFragilitySchema = OtherHazardsAnalysisRecordSchema.extend({
  primaryHazardGroupRef: z.string(),
  secondaryHazardScenarioRef: z.string(),
  affectedSscRefs: stringArray,
  failureModeRefs: stringArray,
  conditionalFailureModel: z.string(),
  fragilityRefs: stringArray,
});

export const OtherHazardsFragilityAnalysisSchema = z.object({
  demandModels: z.array(demandModelSchema),
  capacityModels: z.array(capacityModelSchema),
  fragilityCurves: z.array(fragilityCurveSchema),
  functionalFailureModels: z.array(functionalFailureModelSchema),
  secondaryEffectFragilities: z.array(secondaryFragilitySchema),
  ...commonSectionShape,
});

const initiatingEventModelSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRefs: stringArray,
  sourceInitiatingEventRef: z.string().optional(),
  initiatingEventType: z.enum(["TRANSIENT", "LOSS_OF_POWER", "LOSS_OF_HEAT_SINK", "SYSTEM_RUPTURE", "STRUCTURAL_DAMAGE", "SUPPORT_SYSTEM_LOSS", "OPERATOR_INCAPACITATION", "MULTI_UNIT", "OTHER"]),
  eventDefinition: z.string(),
  affectedOperatingStateRefs: stringArray,
  affectedUnitRefs: stringArray,
  affectedRadioactiveMaterialSourceRefs: stringArray,
  frequencyDerivation: z.string(),
  secondaryHazardRefs: stringArray,
});

const scenarioFamilySchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRefs: stringArray,
  initiatingEventRefs: stringArray,
  scenarioDefinition: z.string(),
  sourceRefs: stringArray,
  spatialZoneRefs: stringArray,
  affectedSscRefs: stringArray,
  hazardIntervalRefs: stringArray,
  operatingStateRefs: stringArray,
  unitRefs: stringArray,
  radioactiveMaterialSourceRefs: stringArray,
  secondaryHazardScenarioRefs: stringArray,
  groupingBasis: z.string(),
});

const scenarioTimelineSchema = OtherHazardsAnalysisRecordSchema.extend({
  scenarioFamilyRef: z.string(),
  timeOrigin: z.string(),
  warningTimeHours: z.number(),
  initiatingEventTimeHours: z.number(),
  keyEquipmentFailureTimesHours: z.array(z.number()),
  operatorActionWindowsHours: z.array(z.number()),
  stableEndStateTimeHours: z.number(),
  recoveryStartTimeHours: z.number(),
  timelineBasis: z.string(),
});

const industryEventSchema = OtherHazardsAnalysisRecordSchema.extend({
  eventDate: z.string(),
  facility: z.string(),
  hazardGroupRefs: stringArray,
  eventDescription: z.string(),
  initiatingEvents: stringArray,
  equipmentFailures: stringArray,
  humanPerformanceEffects: stringArray,
  recoveryExperience: stringArray,
  modelApplications: stringArray,
});

export const OtherHazardsInitiatingEventAndScenarioSchema = z.object({
  initiatingEventModels: z.array(initiatingEventModelSchema),
  scenarioFamilies: z.array(scenarioFamilySchema),
  scenarioTimelines: z.array(scenarioTimelineSchema),
  secondaryScenarioLinks: z.array(OtherHazardsAnalysisRecordSchema),
  industryExperienceEvents: z.array(industryEventSchema),
  ...commonSectionShape,
});

const peerReviewDispositionSchema = OtherHazardsAnalysisRecordSchema.extend({
  sourcePraElement: z.string(),
  findingId: z.string(),
  findingText: z.string(),
  relevanceToOtherHazards: z.string(),
  disposition: z.string(),
  affectedModelRefs: stringArray,
  closureEvidenceRefs: stringArray,
  closureStatus: z.enum(["OPEN", "INCORPORATED", "NOT_APPLICABLE", "CLOSED"]),
});

const eventSequenceModelSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRefs: stringArray,
  scenarioFamilyRefs: stringArray,
  initiatingEventRefs: stringArray,
  sourceEventSequenceRef: z.string().optional(),
  eventSequenceFamilyRef: z.string(),
  functionalEvents: stringArray,
  successPathDefinition: z.string(),
  endStates: stringArray,
  missionTimeRef: z.string(),
  unitRefs: stringArray,
  radioactiveMaterialSourceRefs: stringArray,
  levelTwoPlantDamageStateRefs: stringArray,
});

const successCriterionSchema = OtherHazardsAnalysisRecordSchema.extend({
  sourceSuccessCriterionRef: z.string(),
  eventSequenceRefs: stringArray,
  safetyFunction: z.string(),
  criterion: z.string(),
  hazardSpecificChanges: z.string(),
  supportingAnalysisRefs: stringArray,
  missionTimeHours: z.number(),
  validated: z.boolean(),
});

const systemModificationSchema = OtherHazardsAnalysisRecordSchema.extend({
  sourceSystemModelRef: z.string(),
  affectedBasicEventRefs: stringArray,
  addedBasicEvents: stringArray,
  hazardGroupRefs: stringArray,
  hazardFailureModeRefs: stringArray,
  fragilityRefs: stringArray,
  correlationGroupRefs: stringArray,
  logicChange: z.string(),
  verificationRefs: stringArray,
});

const missionTimeSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRefs: stringArray,
  eventSequenceRefs: stringArray,
  missionTimeHours: z.number(),
  stableEndState: z.string(),
  hazardDurationBasis: z.string(),
  recoveryModel: z.string(),
  industryExperienceRefs: stringArray,
  boundingOrRealistic: z.enum(["BOUNDING", "REALISTIC"]),
});

const dataParameterSchema = OtherHazardsAnalysisRecordSchema.extend({
  parameterType: z.enum(["BASIC_EVENT", "RECOVERY", "COMMON_CAUSE", "CORRELATION", "MISSION_TIME", "HAZARD_CONDITIONAL", "OTHER"]),
  hazardGroupRefs: stringArray,
  destinationModelRefs: stringArray,
  pointEstimate: z.number(),
  distribution: z.string(),
  parameters: z.record(z.string(), z.number()),
  units: z.string(),
  sourceDataRefs: stringArray,
});

const correlationModelSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRefs: stringArray,
  correlationGroupRef: z.string(),
  memberBasicEventRefs: stringArray,
  commonDemandModel: z.string(),
  commonCapacityModel: z.string(),
  quantificationTreatment: z.string(),
  sensitivityRefs: stringArray,
});

const multiUnitSchema = OtherHazardsAnalysisRecordSchema.extend({
  hazardGroupRefs: stringArray,
  affectedUnitRefs: stringArray,
  sharedSscRefs: stringArray,
  sharedResourceRefs: stringArray,
  sharedHumanActionRefs: stringArray,
  commonSiteConditions: stringArray,
  sequenceTreatment: z.string(),
  dependencyTreatment: z.string(),
});

const levelTwoInterfaceSchema = OtherHazardsAnalysisRecordSchema.extend({
  eventSequenceRefs: stringArray,
  plantDamageStateRefs: stringArray,
  containmentOrConfinementStatus: z.string(),
  hazardDamageAttributes: stringArray,
  releaseCategoryRefs: stringArray,
  dependentFailureTreatment: z.string(),
  acceptedByLevelTwo: z.boolean(),
});

export const OtherHazardsPlantResponseModelSchema = z.object({
  peerReviewDispositions: z.array(peerReviewDispositionSchema),
  eventSequenceModels: z.array(eventSequenceModelSchema),
  successCriteria: z.array(successCriterionSchema),
  systemModelModifications: z.array(systemModificationSchema),
  missionTimes: z.array(missionTimeSchema),
  dataParameters: z.array(dataParameterSchema),
  correlationModels: z.array(correlationModelSchema),
  multiUnitAssessments: z.array(multiUnitSchema),
  levelTwoInterfaces: z.array(levelTwoInterfaceSchema),
  ...commonSectionShape,
});

const humanActionSchema = OtherHazardsAnalysisRecordSchema.extend({
  sourceHumanActionRef: z.string().optional(),
  actionType: z.enum(["PREPARATORY", "DIAGNOSIS", "RESPONSE", "RECOVERY", "LOCAL_MANUAL", "REMOTE", "MULTI_UNIT_COORDINATION"]),
  hazardGroupRefs: stringArray,
  procedureRefs: stringArray,
  cues: stringArray,
  actionLocation: z.string(),
  destinationLocation: z.string().optional(),
  timeAvailableMinutes: z.number(),
  executionTimeMinutes: z.number(),
  requiredStaff: stringArray,
  requiredEquipment: stringArray,
  credited: z.boolean(),
});

const humanFailureEventSchema = OtherHazardsAnalysisRecordSchema.extend({
  humanActionRef: z.string(),
  failureDefinition: z.string(),
  modeledBasicEventRef: z.string(),
  affectedEventSequenceRefs: stringArray,
  affectedSafetyFunctions: stringArray,
  dependencyGroupRefs: stringArray,
});

const performanceContextSchema = OtherHazardsAnalysisRecordSchema.extend({
  humanActionRef: z.string(),
  hazardGroupRefs: stringArray,
  warningAndCues: z.string(),
  environmentalConditions: z.string(),
  toxicOrProtectiveEquipmentConditions: z.string(),
  accessAndTravel: z.string(),
  lightingAndPower: z.string(),
  communications: z.string(),
  workloadAndStaffing: z.string(),
  procedureQuality: z.string(),
  multiUnitDemands: z.string(),
  available: z.boolean(),
});

const hepEstimateSchema = OtherHazardsAnalysisRecordSchema.extend({
  humanFailureEventRef: z.string(),
  performanceContextRef: z.string(),
  method: z.string(),
  nominalHep: z.number(),
  otherHazardsHep: z.number(),
  lowerBound: z.number(),
  upperBound: z.number(),
  dependencyAdjustment: z.number(),
  recoveryCredit: z.number(),
  uncertaintyDistribution: z.string(),
});

const actionConfirmationSchema = OtherHazardsAnalysisRecordSchema.extend({
  humanActionRefs: stringArray,
  confirmationType: z.enum(["PROCEDURE_REVIEW", "INTERVIEW", "TALK_THROUGH", "TABLETOP", "SIMULATION", "WALKDOWN"]),
  participantRoles: stringArray,
  confirmedProcedureInterpretation: z.boolean(),
  confirmedTiming: z.boolean(),
  confirmedFeasibility: z.boolean(),
  findings: stringArray,
  modelChanges: stringArray,
});

const recoveryAssessmentSchema = OtherHazardsAnalysisRecordSchema.extend({
  humanActionRef: z.string(),
  sourceRecoveryModelRef: z.string(),
  hazardGroupRefs: stringArray,
  damageConstraints: stringArray,
  accessConstraints: stringArray,
  resourceConstraints: stringArray,
  earliestRecoveryTimeHours: z.number(),
  recoveryProbability: z.number(),
  remainsValidUnderOtherHazards: z.boolean(),
});

const dependencyAssessmentSchema = OtherHazardsAnalysisRecordSchema.extend({
  humanFailureEventRefs: stringArray,
  sharedCrews: stringArray,
  sharedCues: stringArray,
  sharedLocations: stringArray,
  temporalRelationship: z.string(),
  hazardConditionRelationship: z.string(),
  dependencyLevel: z.enum(["ZERO", "LOW", "MODERATE", "HIGH", "COMPLETE"]),
  jointFailureProbability: z.number(),
});

export const OtherHazardsHumanReliabilitySchema = z.object({
  humanActions: z.array(humanActionSchema),
  humanFailureEvents: z.array(humanFailureEventSchema),
  performanceContexts: z.array(performanceContextSchema),
  hepEstimates: z.array(hepEstimateSchema),
  confirmations: z.array(actionConfirmationSchema),
  recoveryAssessments: z.array(recoveryAssessmentSchema),
  dependencyAssessments: z.array(dependencyAssessmentSchema),
  ...commonSectionShape,
});

const quantificationRunSchema = OtherHazardsAnalysisRecordSchema.extend({
  modelVersion: z.string(),
  hazardGroupRefs: stringArray,
  hazardCurveRefs: stringArray,
  hazardIntervalRefs: stringArray,
  fragilityRefs: stringArray,
  eventSequenceRefs: stringArray,
  humanFailureEventRefs: stringArray,
  successStateTreatment: z.string(),
  rareEventApproximationTreatment: z.string(),
  highFailureProbabilityTreatment: z.string(),
  truncationLimit: z.number(),
  uncertaintySampleCount: z.number(),
  randomSeedReference: z.string(),
  softwareAndVersion: z.string(),
  runDate: z.string(),
});

const intervalResultSchema = OtherHazardsAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(),
  hazardGroupRef: z.string(),
  hazardIntervalRef: z.string(),
  eventSequenceFamilyRef: z.string(),
  conditionalSequenceProbability: z.number(),
  intervalAnnualFrequency: z.number(),
  sequenceFrequencyPerPlantYear: z.number(),
  dominantFragilityRefs: stringArray,
  dominantBasicEventRefs: stringArray,
});

const familyResultSchema = OtherHazardsAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(),
  eventSequenceFamilyRef: z.string(),
  hazardGroupRefs: stringArray,
  operatingStateRefs: stringArray,
  unitRefs: stringArray,
  radioactiveMaterialSourceRefs: stringArray,
  plantDamageStateRefs: stringArray,
  releaseCategoryRefs: stringArray,
  pointEstimateFrequencyPerPlantYear: z.number(),
  meanFrequencyPerPlantYear: z.number(),
  fifthPercentileFrequencyPerPlantYear: z.number(),
  medianFrequencyPerPlantYear: z.number(),
  ninetyFifthPercentileFrequencyPerPlantYear: z.number(),
});

const uncertaintyResultSchema = OtherHazardsAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(),
  riskMetric: z.string(),
  meanValue: z.number(),
  fifthPercentile: z.number(),
  median: z.number(),
  ninetyFifthPercentile: z.number(),
  units: z.string(),
  propagatedUncertaintyRefs: stringArray,
});

const riskContributorSchema = OtherHazardsAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(),
  contributorType: z.enum(["HAZARD_GROUP", "HAZARD_INTERVAL", "SSC", "FAILURE_MODE", "HUMAN_FAILURE_EVENT", "SCENARIO", "EVENT_SEQUENCE_FAMILY", "UNCERTAINTY"]),
  contributorRef: z.string(),
  riskMetric: z.string(),
  absoluteContribution: z.number(),
  fractionalContribution: z.number(),
  rank: z.number(),
});

export const OtherHazardsEventSequenceQuantificationSchema = z.object({
  quantificationRuns: z.array(quantificationRunSchema),
  hazardIntervalResults: z.array(intervalResultSchema),
  eventSequenceFamilyResults: z.array(familyResultSchema),
  convergenceStudies: z.array(convergenceStudySchema),
  uncertaintyResults: z.array(uncertaintyResultSchema),
  riskContributors: z.array(riskContributorSchema),
  screeningDecisions: z.array(OtherHazardsScreeningDecisionSchema),
  ...commonSectionShape,
});

const sensitivityStudySchema = OtherHazardsAnalysisRecordSchema.extend({
  studyType: z.enum(["HAZARD_MODEL", "FRAGILITY", "CORRELATION", "HRA", "SUCCESS_STATE", "SCREENING", "RECOVERY", "NUMERICAL", "OTHER"]),
  baseCaseRef: z.string(),
  variedInputs: stringArray,
  alternateValues: stringArray,
  riskMetric: z.string(),
  baseResult: z.number(),
  alternateResult: z.number(),
  relativeChange: z.number(),
  conclusion: z.string(),
});

const riskInsightSchema = OtherHazardsAnalysisRecordSchema.extend({
  insightType: z.enum(["DOMINANT_HAZARD", "DOMINANT_SCENARIO", "SSC_VULNERABILITY", "HUMAN_ACTION", "DEPENDENCY", "UNCERTAINTY", "DEFENSE_IN_DEPTH", "RISK_REDUCTION"]),
  hazardGroupRefs: stringArray,
  contributorRefs: stringArray,
  affectedRiskMetric: z.string(),
  insight: z.string(),
  decisionImplication: z.string(),
});

const refinementActionSchema = OtherHazardsAnalysisRecordSchema.extend({
  technicalArea: z.enum(["HAZARD", "SOURCE_MODEL", "INVESTIGATION", "FRAGILITY", "PLANT_RESPONSE", "HRA", "QUANTIFICATION", "DOCUMENTATION"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  driverRefs: stringArray,
  refinement: z.string(),
  expectedRiskEffect: z.string(),
  ownerDiscipline: z.string(),
  refinementStatus: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETE", "DEFERRED"]),
});

const refinementIterationSchema = OtherHazardsAnalysisRecordSchema.extend({
  modelVersion: z.string(),
  priorModelVersion: z.string(),
  changeSummary: stringArray,
  aggregateMeanFrequencyPerPlantYear: z.number(),
  maximumFamilyFrequencyChange: z.number(),
  contributorRankChanges: stringArray,
  newRiskSignificantContributors: stringArray,
  decision: z.enum(["CONTINUE_REFINEMENT", "ACCEPT_STABLE", "ACCEPT_WITH_LIMITATION"]),
});

const integrationResultSchema = OtherHazardsAnalysisRecordSchema.extend({
  modelVersion: z.string(),
  hazardGroupRefs: stringArray,
  operatingStateRefs: stringArray,
  unitRefs: stringArray,
  radioactiveMaterialSourceRefs: stringArray,
  eventSequenceFamilyRefs: stringArray,
  meanFrequencyPerPlantYear: z.number(),
  fifthPercentileFrequencyPerPlantYear: z.number(),
  ninetyFifthPercentileFrequencyPerPlantYear: z.number(),
  plantDamageStateRefs: stringArray,
  releaseCategoryRefs: stringArray,
  overlapTreatment: z.string(),
  integrationStatus: z.enum(["DRAFT", "READY_FOR_RISK_INTEGRATION", "ACCEPTED_BY_RISK_INTEGRATION"]),
});

const riskDecisionSchema = OtherHazardsAnalysisRecordSchema.extend({
  decisionType: z.enum(["DESIGN", "PROCEDURE", "CONFIGURATION_CONTROL", "MONITORING", "DATA_COLLECTION", "MODEL_CONTROL", "EMERGENCY_PREPAREDNESS"]),
  driverRefs: stringArray,
  affectedSscRefs: stringArray,
  action: z.string(),
  duePhase: z.string(),
  disposition: z.enum(["IMPLEMENT", "MONITOR", "CONFIRM_PRE_OPERATIONAL", "RETAIN_CURRENT_BASIS", "FORWARD_TO_PLANT_PROCESS"]),
  verificationRefs: stringArray,
  reanalysisRequired: z.boolean(),
  riskIntegrationResultRef: z.string(),
});

const traceabilityPathSchema = OtherHazardsAnalysisRecordSchema.extend({
  evidenceRefs: stringArray,
  hazardGroupRefs: stringArray,
  sourceModelRefs: stringArray,
  hazardCurveRefs: stringArray,
  sscListRefs: stringArray,
  investigationRefs: stringArray,
  fragilityRefs: stringArray,
  initiatingEventRefs: stringArray,
  humanFailureEventRefs: stringArray,
  eventSequenceFamilyRefs: stringArray,
  resultRefs: stringArray,
  decisionRefs: stringArray,
  complete: z.boolean(),
});

const controlledBaselineSchema = OtherHazardsAnalysisRecordSchema.extend({
  modelVersion: z.string(),
  quantificationRunRef: z.string(),
  reportRef: z.string(),
  configurationControlRecordId: z.string(),
  peerReviewRef: z.string(),
  packageManifestRefs: stringArray,
  unresolvedLimitations: stringArray,
  releaseStatus: z.enum(["WORKING", "CONTROLLED", "SUPERSEDED"]),
});

export const OtherHazardsRiskInterpretationSchema = z.object({
  sensitivityStudies: z.array(sensitivityStudySchema),
  riskInsights: z.array(riskInsightSchema),
  refinementActions: z.array(refinementActionSchema),
  quantificationIterations: z.array(refinementIterationSchema),
  integrationResults: z.array(integrationResultSchema),
  overlapControls: z.array(overlapControlSchema),
  riskDecisions: z.array(riskDecisionSchema),
  traceabilityPaths: z.array(traceabilityPathSchema),
  controlledBaselines: z.array(controlledBaselineSchema),
  stoppingCriteria: z.object({
    maximumAggregateFrequencyChange: z.number(),
    maximumFamilyFrequencyChange: z.number(),
    maximumContributorRankShift: z.number(),
    requiredStableIterations: z.number(),
    requireNoNewRiskSignificantContributors: z.boolean(),
    basis: z.string(),
  }),
});

const peerReviewTeamSchema = OtherHazardsAnalysisRecordSchema.extend({
  role: z.enum(["TEAM_LEAD", "SYSTEMS_ENGINEER", "HAZARD_SPECIALIST", "FRAGILITY_SPECIALIST", "HRA_SPECIALIST", "QUANTIFICATION_SPECIALIST", "LEVEL_2_SPECIALIST", "OTHER"]),
  organization: z.string(),
  independenceStatement: z.string(),
  qualifications: stringArray,
  experience: stringArray,
  hazardGroupExperience: stringArray,
  reviewScope: stringArray,
});

const peerReviewFindingSchema = OtherHazardsAnalysisRecordSchema.extend({
  reviewArea: z.enum(["OHA", "OFR", "OPR", "INVESTIGATION", "QUANTIFICATION", "DOCUMENTATION"]),
  requirementRefs: stringArray,
  findingCategory: z.enum(["FACT_AND_OBSERVATION", "SUGGESTION", "BEST_PRACTICE", "COMMENT"]),
  significance: z.enum(["LOW", "MEDIUM", "HIGH"]),
  condition: z.string(),
  consequence: z.string(),
  recommendation: z.string(),
  resolution: z.string(),
  closureEvidenceRefs: stringArray,
  closureStatus: z.enum(["OPEN", "PROPOSED_RESOLUTION", "CLOSED"]),
});

export const OtherHazardsTechnicalClosureSchema = z.object({
  conformanceReviews: z.array(OtherHazardsAnalysisRecordSchema),
  documentationChecks: z.array(OtherHazardsAnalysisRecordSchema),
  interfaceClosureChecks: z.array(OtherHazardsAnalysisRecordSchema),
  peerReviewTeam: z.array(peerReviewTeamSchema),
  peerReviewFindings: z.array(peerReviewFindingSchema),
  readinessChecks: z.array(OtherHazardsAnalysisRecordSchema),
  ...commonSectionShape,
});

const workflowRecordSchema = OtherHazardsAnalysisRecordSchema.extend({
  workflowRecordType: z.enum(["REPORT_SECTION", "QUALITY_CHECK", "REVIEW_ASSIGNMENT", "REVIEW_FINDING", "APPROVAL_READINESS", "APPROVAL_SIGNATURE"]),
  discipline: z.string(),
  assignee: z.string(),
  dueDate: z.string().optional(),
  result: z.string(),
  verificationRefs: stringArray,
});

export const OtherHazardsPraWorkflowSchema = z.object({
  reportSections: z.array(workflowRecordSchema),
  draftQualityChecks: z.array(workflowRecordSchema),
  reviewAssignments: z.array(workflowRecordSchema),
  reviewFindings: z.array(workflowRecordSchema),
  approvalReadiness: z.array(workflowRecordSchema),
  approvalSignatures: z.array(workflowRecordSchema),
});

export const OtherHazardsPraDocumentationSchema = z.object({
  overallProcessDescription: z.string(),
  analysisBasisSummary: z.string(),
  siteAndEvidenceSummary: z.string(),
  retainedHazardsSummary: z.string(),
  sourceCharacterizationSummary: z.string(),
  frequencyAnalysisSummary: z.string(),
  secondaryHazardsSummary: z.string(),
  hazardCurveSummary: z.string(),
  sscScopeSummary: z.string(),
  investigationSummary: z.string(),
  fragilitySummary: z.string(),
  scenarioSummary: z.string(),
  plantResponseSummary: z.string(),
  humanReliabilitySummary: z.string(),
  quantificationSummary: z.string(),
  riskInsights: z.string(),
  uncertaintySummary: z.string(),
  configurationControlDescription: z.string(),
  peerReviewScope: z.string(),
  supportingDocumentRefs: stringArray,
});

const exampleDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["doc", "sheet", "image"]),
  sizeLabel: z.string(),
  uploadedLabel: z.string(),
  extracted: z.string(),
  linked: z.number(),
  url: z.string().optional(),
});

export const OtherHazardsPRASchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.OTHER_HAZARDS_PRA).shape,
  praScope: z.string(),
  hazardConditionedModels: HazardConditionedMethodModelsSchema.default(createEmptyHazardConditionedMethodModels),
  analysisBasis: OtherHazardsAnalysisBasisSchema,
  retainedHazardGroups: OtherHazardsRetainedHazardGroupsSchema,
  hazardSourceCharacterization: OtherHazardsSourceCharacterizationSchema,
  hazardFrequencyAnalysis: OtherHazardsFrequencyAnalysisSchema,
  secondaryAndCombinedHazards: OtherHazardsSecondaryAndCombinedHazardsSchema,
  hazardCurveAnalysis: OtherHazardsHazardCurveAnalysisSchema,
  preliminaryPlantResponse: OtherHazardsPreliminaryPlantResponseSchema,
  plantInvestigation: OtherHazardsPlantInvestigationSchema,
  fragilityBasis: OtherHazardsFragilityBasisSchema,
  fragilityAnalysis: OtherHazardsFragilityAnalysisSchema,
  initiatingEventAndScenarioDevelopment: OtherHazardsInitiatingEventAndScenarioSchema,
  plantResponseModel: OtherHazardsPlantResponseModelSchema,
  humanReliabilityAnalysis: OtherHazardsHumanReliabilitySchema,
  eventSequenceQuantification: OtherHazardsEventSequenceQuantificationSchema,
  integratedUncertainties: z.array(OtherHazardsModelUncertaintySchema),
  riskInterpretation: OtherHazardsRiskInterpretationSchema,
  technicalClosure: OtherHazardsTechnicalClosureSchema,
  workflow: OtherHazardsPraWorkflowSchema,
  documentation: OtherHazardsPraDocumentationSchema,
  configurationControlRecordId: z.string().optional(),
  exampleDocuments: z.array(exampleDocumentSchema).optional(),
  newlyDevelopedMethodIds: stringArray.optional(),
});
