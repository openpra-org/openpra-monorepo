import { z } from "zod";
import type { HighWindsPRA } from "../../high-winds/high-winds-pra";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { HazardConditionedMethodModelsSchema, createEmptyHazardConditionedMethodModels } from "../hazard-conditioned-models";
import {
  HighWindsAnalysisRecordSchema,
  HighWindsEffectTypeSchema,
  HighWindsHazardTypeSchema,
  HighWindsInvestigationSchema,
  HighWindsModelUncertaintySchema,
  HighWindsPraInterfaceRecordSchema,
  HighWindsPreOperationalAssumptionSchema,
  HighWindsProcessDocumentationSchema,
  HighWindsScreeningDecisionSchema,
} from "./high-winds-pra-common";

const stringArray = z.array(z.string());
const numberRecord = z.record(z.string(), z.number());

export const HighWindsPraApplicationSchema = HighWindsAnalysisRecordSchema.extend({
  purpose: z.string(),
  decisionContext: z.string(),
  supportedRiskMetrics: stringArray,
  consumingElementRefs: stringArray,
  configurationBasis: z.string(),
  limitations: stringArray,
});

export const HighWindsPraEvidenceRecordSchema = HighWindsAnalysisRecordSchema.extend({
  evidenceType: z.enum(["STANDARD", "METEOROLOGICAL_DATA", "DRAWING", "CALCULATION", "PROCEDURE", "MODEL", "WALKDOWN", "MISSILE_SURVEY", "INTERVIEW", "OPERATING_EXPERIENCE", "REVIEW", "OTHER"]),
  sourceReference: z.string(),
  revision: z.string().optional(),
  effectiveDate: z.string().optional(),
  applicableSubelements: z.array(z.enum(["WHA", "WFR", "WPR"])),
  applicability: z.string(),
  qualityAndLimitations: z.string(),
  fileReference: z.string().optional(),
  supersedesEvidenceRef: z.string().optional(),
  controlled: z.boolean(),
});

export const HighWindsBaselinePraRecordTreatmentSchema = HighWindsAnalysisRecordSchema.extend({
  technicalArea: z.enum(["PLANT_OPERATING_STATES", "INITIATING_EVENTS", "EVENT_SEQUENCES", "SUCCESS_CRITERIA", "SYSTEMS", "DATA", "HUMAN_RELIABILITY", "RISK_INTEGRATION"]),
  sourceRecordRefs: stringArray,
  treatment: z.enum(["REUSED", "MODIFIED", "NEW", "NOT_APPLICABLE"]),
  highWindsChange: z.string(),
  unresolvedItems: stringArray,
});

export const HighWindsBaselinePraDefinitionSchema = z.object({
  modelName: z.string(),
  modelReference: z.string(),
  revision: z.string(),
  freezeDate: z.string(),
  freezeStatus: z.enum(["WORKING", "FROZEN", "REFERENCE_ONLY"]),
  modelBoundary: z.string(),
  plantOperatingStateRefs: stringArray,
  reactorUnitRefs: stringArray,
  radioactiveMaterialSourceRefs: stringArray,
  recordTreatments: z.array(HighWindsBaselinePraRecordTreatmentSchema),
  unresolvedInterfaces: stringArray,
});

export const HighWindsSiteBasisSchema = HighWindsAnalysisRecordSchema.extend({
  siteBasisType: z.enum(["SPECIFIC_SITE", "BOUNDING_SITE"]),
  siteName: z.string(),
  latitudeDegrees: z.number().optional(),
  longitudeDegrees: z.number().optional(),
  elevationMetres: z.number().optional(),
  siteSelectionStatus: z.enum(["SELECTED", "CANDIDATE", "BOUNDING_ENVELOPE"]),
  boundingSiteRefs: stringArray,
  boundingCharacteristics: stringArray,
  regionalClimateDescription: z.string(),
  terrainAndTopographyDescription: z.string(),
  licenseeControlledAreaDescription: z.string(),
  reactorUnitRefs: stringArray,
  radioactiveMaterialSourceRefs: stringArray,
  plantOperatingStateRefs: stringArray,
  multiReactorOrMultiSourceLocations: stringArray,
  analysisDateCutoff: z.string(),
});

export const HighWindsAnalysisScopeRecordSchema = HighWindsAnalysisRecordSchema.extend({
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  windEffects: z.array(HighWindsEffectTypeSchema),
  includedPlantLocations: stringArray,
  excludedPlantLocations: stringArray,
  includedOperatingStateRefs: stringArray,
  includedReactorUnitRefs: stringArray,
  includedRadioactiveMaterialSourceRefs: stringArray,
  riskMetrics: stringArray,
  intendedCapabilityCategory: z.enum(["CC-I", "CC-II"]),
});

export const HighWindsAnalysisBasisSchema = z.object({
  siteBasis: HighWindsSiteBasisSchema.optional(),
  scopeRecords: z.array(HighWindsAnalysisScopeRecordSchema),
  applications: z.array(HighWindsPraApplicationSchema),
  evidenceRegister: z.array(HighWindsPraEvidenceRecordSchema),
  baselinePra: HighWindsBaselinePraDefinitionSchema.optional(),
  interfaces: z.array(HighWindsPraInterfaceRecordSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const HighWindsHazardCandidateSchema = HighWindsAnalysisRecordSchema.extend({
  hazardType: HighWindsHazardTypeSchema,
  applicableWindPhenomena: stringArray,
  regionalIndicators: stringArray,
  siteCharacteristics: stringArray,
  plantCharacteristics: stringArray,
  potentialWindEffects: z.array(HighWindsEffectTypeSchema),
  coexistentHazardRefs: stringArray,
  sourceHazardScreeningRefs: stringArray,
  disposition: z.enum(["RETAINED", "SCREENED"]),
});

export const HighWindsHazardCombinationSchema = HighWindsAnalysisRecordSchema.extend({
  primaryHazardType: HighWindsHazardTypeSchema,
  combinedHazards: stringArray,
  commonCauseDescription: z.string(),
  temporalRelationship: z.enum(["COINCIDENT", "CAUSALLY_RELATED", "SEQUENTIAL", "INDEPENDENT"]),
  affectedPlantLocations: stringArray,
  affectedSscRefs: stringArray,
  plantResponseTreatment: z.string(),
  disposition: z.enum(["RETAINED", "SCREENED", "TRANSFERRED"]),
  destinationElementRefs: stringArray,
});

export const HighWindsScreeningConfirmationSchema = HighWindsAnalysisRecordSchema.extend({
  screeningDecisionRef: z.string(),
  investigationRefs: stringArray,
  hazardsScreeningRequirementRefs: stringArray,
  plantConditionBasis: z.enum(["AS_BUILT_AS_OPERATED", "AS_DESIGNED_AS_INTENDED"]),
  confirmed: z.boolean(),
  discrepancies: stringArray,
  resolution: z.string(),
});

export const HighWindsHazardScreeningSchema = z.object({
  hazardCandidates: z.array(HighWindsHazardCandidateSchema),
  hazardCombinations: z.array(HighWindsHazardCombinationSchema),
  screeningDecisions: z.array(HighWindsScreeningDecisionSchema),
  aggregateScreeningChecks: z.array(HighWindsScreeningDecisionSchema),
  confirmations: z.array(HighWindsScreeningConfirmationSchema),
  investigations: z.array(HighWindsInvestigationSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const WindDataSourceSchema = HighWindsAnalysisRecordSchema.extend({
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  sourceType: z.enum(["ANEMOMETER_STATION", "STORM_EVENT_DATABASE", "TROPICAL_CYCLONE_TRACK_DATABASE", "TORNADO_DATABASE", "REGIONAL_STUDY", "NATIONAL_STANDARD", "SITE_MONITORING", "OTHER"]),
  agencyOrPublisher: z.string(),
  stationOrDatasetId: z.string(),
  latitudeDegrees: z.number().optional(),
  longitudeDegrees: z.number().optional(),
  elevationMetres: z.number().optional(),
  periodStart: z.string(),
  periodEnd: z.string(),
  samplingInterval: z.string(),
  averagingTimeSeconds: z.number().optional(),
  measurementHeightMetres: z.number().optional(),
  exposureDescription: z.string(),
  terrainHistory: z.string(),
  instrumentationHistory: z.string(),
  recordCompleteness: z.number(),
  qualityIssues: stringArray,
  acceptedUses: stringArray,
  excludedDataBasis: z.string(),
});

export const WindDataAdjustmentSchema = HighWindsAnalysisRecordSchema.extend({
  dataSourceRef: z.string(),
  adjustmentTypes: z.array(z.enum(["GUST_DURATION", "MEASUREMENT_HEIGHT", "TERRAIN_EXPOSURE", "TOPOGRAPHY", "INSTRUMENT_CHANGE", "STATION_RELOCATION", "SAMPLING_FILTER", "HOMOGENIZATION"])),
  inputWindDefinition: z.string(),
  outputWindDefinition: z.string(),
  method: z.string(),
  factorOrEquation: z.string(),
  validationRefs: stringArray,
  uncertaintyDescription: z.string(),
});

export const ReferenceWindDefinitionSchema = HighWindsAnalysisRecordSchema.extend({
  hazardType: HighWindsHazardTypeSchema,
  windParameter: z.enum(["THREE_SECOND_GUST", "FASTEST_MILE", "ONE_MINUTE_MEAN", "TEN_MINUTE_MEAN", "OTHER"]),
  averagingTimeSeconds: z.number(),
  referenceHeightMetres: z.number(),
  terrainExposure: z.string(),
  directionTreatment: z.string(),
  speedUnit: z.enum(["MPH", "MPS", "KPH"]),
  lowerBoundWindSpeed: z.number(),
  upperAnalysisWindSpeed: z.number(),
  conversionMethod: z.string(),
  shortDurationTreatment: z.string(),
  nationalStandardReference: z.string(),
  deviationsFromStandard: stringArray,
});

export const WindDataQualificationCheckSchema = HighWindsAnalysisRecordSchema.extend({
  dataSourceRef: z.string(),
  checkType: z.enum(["COMPLETENESS", "APPLICABILITY", "HOMOGENEITY", "INDEPENDENCE", "OUTLIER", "CURRENTNESS"]),
  acceptanceCriteria: stringArray,
  findings: stringArray,
  disposition: z.enum(["ACCEPT", "ACCEPT_WITH_ADJUSTMENT", "EXCLUDE"]),
  adjustmentRefs: stringArray,
});

export const HighWindsWindDataAndReferenceBasisSchema = z.object({
  dataSources: z.array(WindDataSourceSchema),
  dataAdjustments: z.array(WindDataAdjustmentSchema),
  referenceWindDefinitions: z.array(ReferenceWindDefinitionSchema),
  qualificationChecks: z.array(WindDataQualificationCheckSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const WindHazardCurvePointSchema = z.object({
  windSpeed: z.number(),
  meanAnnualExceedanceFrequency: z.number(),
  fifthPercentileAnnualExceedanceFrequency: z.number().optional(),
  fiftiethPercentileAnnualExceedanceFrequency: z.number().optional(),
  ninetyFifthPercentileAnnualExceedanceFrequency: z.number().optional(),
});

export const StraightWindStationAssessmentSchema = HighWindsAnalysisRecordSchema.extend({
  dataSourceRef: z.string(),
  distanceToSiteKilometres: z.number(),
  climateSimilarity: z.string(),
  exposureRepresentativeness: z.string(),
  adjustedDataRef: z.string(),
  recordYears: z.number(),
  retainedForAnalysis: z.boolean(),
  exclusionBasis: z.string(),
});

export const StraightWindClimateComponentSchema = HighWindsAnalysisRecordSchema.extend({
  componentType: z.enum(["THUNDERSTORM", "NON_THUNDERSTORM", "MIXED"]),
  stationAssessmentRefs: stringArray,
  classificationMethod: z.string(),
  eventCount: z.number(),
  independentEventDefinition: z.string(),
  thresholdWindSpeed: z.number(),
  omittedEventBasis: z.string(),
});

export const StraightWindExtremeValueModelSchema = HighWindsAnalysisRecordSchema.extend({
  climateComponentRef: z.string(),
  distribution: z.enum(["GUMBEL", "GENERALIZED_EXTREME_VALUE", "GENERALIZED_PARETO", "TWO_DIMENSIONAL_POISSON", "OTHER"]),
  fittingMethod: z.string(),
  thresholdSelection: z.string(),
  declusteringMethod: z.string(),
  parameterValues: numberRecord,
  goodnessOfFitTests: stringArray,
  rareEventTailJustification: z.string(),
  samplingUncertaintyTreatment: z.string(),
});

export const StraightWindPoolingModelSchema = HighWindsAnalysisRecordSchema.extend({
  stationAssessmentRefs: stringArray,
  climateComponentRefs: stringArray,
  poolingMethod: z.enum(["SUPERSTATION", "REGIONAL_FREQUENCY", "WEIGHTED_STATIONS", "SITE_ONLY", "OTHER"]),
  weights: numberRecord,
  independenceTreatment: z.string(),
  siteFrequencyDerivation: z.string(),
});

export const StraightWindHazardResultSchema = HighWindsAnalysisRecordSchema.extend({
  referenceWindDefinitionRef: z.string(),
  modelRefs: stringArray,
  poolingModelRef: z.string(),
  curvePoints: z.array(WindHazardCurvePointSchema),
  benchmarkReferences: stringArray,
  comparisonFindings: stringArray,
  significantDifferenceCauses: stringArray,
});

export const HighWindsStraightWindHazardAnalysisSchema = z.object({
  stationAssessments: z.array(StraightWindStationAssessmentSchema),
  climateComponents: z.array(StraightWindClimateComponentSchema),
  extremeValueModels: z.array(StraightWindExtremeValueModelSchema),
  poolingModels: z.array(StraightWindPoolingModelSchema),
  hazardResults: z.array(StraightWindHazardResultSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const TropicalCycloneDataSetSchema = HighWindsAnalysisRecordSchema.extend({
  dataSourceRefs: stringArray,
  basin: z.string(),
  coastalRegion: z.string(),
  recordStartYear: z.number(),
  recordEndYear: z.number(),
  stormCount: z.number(),
  intensityMeasures: stringArray,
  trackVariables: stringArray,
  pressureVariables: stringArray,
  reportingBiases: stringArray,
  homogenizationMethod: z.string(),
});

export const TropicalCycloneOccurrenceModelSchema = HighWindsAnalysisRecordSchema.extend({
  dataSetRefs: stringArray,
  annualOccurrenceRate: z.number(),
  intensityDistribution: z.string(),
  genesisModel: z.string(),
  temporalStationarityBasis: z.string(),
  regionalConditioning: z.string(),
  parameterValues: numberRecord,
});

export const TropicalCycloneTrackModelSchema = HighWindsAnalysisRecordSchema.extend({
  occurrenceModelRef: z.string(),
  modelType: z.enum(["EMPIRICAL_TRACK", "SYNTHETIC_TRACK", "PUBLISHED_HAZARD_MODEL", "OTHER"]),
  spatialDomain: z.string(),
  trackVariables: stringArray,
  translationSpeedTreatment: z.string(),
  landfallTreatment: z.string(),
  validationMetrics: stringArray,
});

export const TropicalCycloneWindFieldModelSchema = HighWindsAnalysisRecordSchema.extend({
  trackModelRef: z.string(),
  windFieldModelName: z.string(),
  centralPressureRelationship: z.string(),
  radiusOfMaximumWindsModel: z.string(),
  boundaryLayerModel: z.string(),
  translationAsymmetryTreatment: z.string(),
  surfaceRoughnessTreatment: z.string(),
  gustConversionTreatment: z.string(),
  inlandDecayModel: z.string(),
  validationRefs: stringArray,
});

export const TropicalCycloneSimulationSchema = HighWindsAnalysisRecordSchema.extend({
  occurrenceModelRef: z.string(),
  trackModelRef: z.string(),
  windFieldModelRef: z.string(),
  simulatedYears: z.number(),
  simulatedStorms: z.number(),
  randomSeedReference: z.string(),
  importanceSamplingMethod: z.string(),
  convergenceMetrics: stringArray,
  outputDataRefs: stringArray,
});

export const TropicalCycloneHazardResultSchema = HighWindsAnalysisRecordSchema.extend({
  referenceWindDefinitionRef: z.string(),
  simulationRef: z.string().optional(),
  publishedStudyRef: z.string().optional(),
  curvePoints: z.array(WindHazardCurvePointSchema),
  benchmarkReferences: stringArray,
  comparisonFindings: stringArray,
  significantDifferenceCauses: stringArray,
});

export const HighWindsTropicalCycloneHazardAnalysisSchema = z.object({
  dataSets: z.array(TropicalCycloneDataSetSchema),
  occurrenceModels: z.array(TropicalCycloneOccurrenceModelSchema),
  trackModels: z.array(TropicalCycloneTrackModelSchema),
  windFieldModels: z.array(TropicalCycloneWindFieldModelSchema),
  simulations: z.array(TropicalCycloneSimulationSchema),
  hazardResults: z.array(TropicalCycloneHazardResultSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const TornadoDataSetSchema = HighWindsAnalysisRecordSchema.extend({
  dataSourceRefs: stringArray,
  geographicRegion: z.string(),
  recordStartYear: z.number(),
  recordEndYear: z.number(),
  tornadoCount: z.number(),
  damageRatingScales: z.array(z.enum(["F_SCALE", "ENHANCED_FUJITA", "OTHER"])),
  pathVariables: stringArray,
  populationBiasDescription: z.string(),
  reportingLimitations: stringArray,
});

export const TornadoDataCorrectionSchema = HighWindsAnalysisRecordSchema.extend({
  dataSetRef: z.string(),
  correctionTypes: z.array(z.enum(["POPULATION_BIAS", "REPORTING_PRACTICE", "DAMAGE_SCALE", "PATH_GEOMETRY", "DUPLICATE_EVENT", "OTHER"])),
  affectedYears: z.string(),
  correctionMethod: z.string(),
  beforeEventCount: z.number(),
  afterEventCount: z.number(),
  uncertaintyTreatment: z.string(),
});

export const TornadoClimatologyRegionSchema = HighWindsAnalysisRecordSchema.extend({
  dataSetRefs: stringArray,
  boundaryDescription: z.string(),
  physiographicCharacteristics: stringArray,
  meteorologicalCharacteristics: stringArray,
  homogeneityTests: stringArray,
  sufficientlyBroadForRareEvents: z.boolean(),
  siteRepresentativenessBasis: z.string(),
});

export const TornadoOccurrenceAndPathModelSchema = HighWindsAnalysisRecordSchema.extend({
  climatologyRegionRef: z.string(),
  annualOccurrenceRate: z.number(),
  intensityDistribution: z.string(),
  pathLengthModel: z.string(),
  pathWidthModel: z.string(),
  pathDirectionModel: z.string(),
  translationSpeedModel: z.string(),
  intensityAlongPathModel: z.string(),
  intensityAcrossPathModel: z.string(),
  parameterValues: numberRecord,
});

export const TornadoDamageWindModelSchema = HighWindsAnalysisRecordSchema.extend({
  occurrenceAndPathModelRef: z.string(),
  damageIndicatorTypes: stringArray,
  degreeOfDamageTreatment: z.string(),
  windSpeedGivenDamageRatingModel: z.string(),
  constructionQualityTreatment: z.string(),
  ratingUncertaintyTreatment: z.string(),
  parameterValues: numberRecord,
});

export const TornadoWindFieldModelSchema = HighWindsAnalysisRecordSchema.extend({
  damageWindModelRef: z.string(),
  horizontalWindProfile: z.string(),
  verticalWindProfile: z.string(),
  radiusOfMaximumWindsModel: z.string(),
  translationalVelocityTreatment: z.string(),
  rotationalVelocityTreatment: z.string(),
  atmosphericPressureChangeModel: z.string(),
  validationRefs: stringArray,
});

export const TornadoTargetDefinitionSchema = HighWindsAnalysisRecordSchema.extend({
  targetType: z.enum(["POINT", "INDIVIDUAL_SSC", "BUILDING", "POWER_BLOCK", "MISSILE_GENERATION_AREA", "OTHER"]),
  planAreaSquareMetres: z.number(),
  heightMetres: z.number(),
  geometryDescription: z.string(),
  orientationTreatment: z.string(),
  locationRefs: stringArray,
});

export const TornadoHazardResultSchema = HighWindsAnalysisRecordSchema.extend({
  referenceWindDefinitionRef: z.string(),
  occurrenceAndPathModelRef: z.string(),
  windFieldModelRef: z.string(),
  targetDefinitionRef: z.string(),
  curvePoints: z.array(WindHazardCurvePointSchema),
  pressureEffectIncluded: z.boolean(),
  atmosphericPressureChangeIncluded: z.boolean(),
  missileEffectIncluded: z.boolean(),
  benchmarkReferences: stringArray,
  comparisonFindings: stringArray,
  significantDifferenceCauses: stringArray,
});

export const HighWindsTornadoHazardAnalysisSchema = z.object({
  dataSets: z.array(TornadoDataSetSchema),
  dataCorrections: z.array(TornadoDataCorrectionSchema),
  climatologyRegions: z.array(TornadoClimatologyRegionSchema),
  occurrenceAndPathModels: z.array(TornadoOccurrenceAndPathModelSchema),
  damageWindModels: z.array(TornadoDamageWindModelSchema),
  windFieldModels: z.array(TornadoWindFieldModelSchema),
  targetDefinitions: z.array(TornadoTargetDefinitionSchema),
  hazardResults: z.array(TornadoHazardResultSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const WindHazardLogicTreeBranchSchema = HighWindsAnalysisRecordSchema.extend({
  hazardType: HighWindsHazardTypeSchema,
  parentBranchRef: z.string().optional(),
  branchLevel: z.string(),
  modelOrParameterChoice: z.string(),
  branchWeight: z.number(),
  weightBasis: z.string(),
  affectedHazardResultRefs: stringArray,
});

export const WindHazardCurveSchema = HighWindsAnalysisRecordSchema.extend({
  hazardType: HighWindsHazardTypeSchema,
  referenceWindDefinitionRef: z.string(),
  sourceHazardResultRefs: stringArray,
  logicTreeBranchRefs: stringArray,
  curveType: z.enum(["MEAN", "FIFTH_PERCENTILE", "FIFTIETH_PERCENTILE", "NINETY_FIFTH_PERCENTILE", "CONSERVATIVE"]),
  curvePoints: z.array(WindHazardCurvePointSchema),
  interpolationMethod: z.string(),
  extrapolationMethod: z.string(),
  truncationBasis: z.string(),
});

export const WindHazardIntervalSchema = HighWindsAnalysisRecordSchema.extend({
  hazardCurveRef: z.string(),
  hazardType: HighWindsHazardTypeSchema,
  lowerWindSpeed: z.number(),
  upperWindSpeed: z.number(),
  representativeWindSpeed: z.number(),
  intervalAnnualFrequency: z.number(),
  conditionalWeight: z.number(),
  fragilityEvaluationRefs: stringArray,
});

export const WindHazardConvergenceStudySchema = HighWindsAnalysisRecordSchema.extend({
  hazardCurveRefs: stringArray,
  baselineIntervalRefs: stringArray,
  refinedIntervalCount: z.number(),
  upperWindSpeedTested: z.number(),
  riskMetric: z.string(),
  baselineResult: z.number(),
  refinedResult: z.number(),
  relativeDifference: z.number(),
  contributorRankingStable: z.boolean(),
  converged: z.boolean(),
});

export const HighWindsHazardIntegrationSchema = z.object({
  logicTreeBranches: z.array(WindHazardLogicTreeBranchSchema),
  hazardCurves: z.array(WindHazardCurveSchema),
  hazardIntervals: z.array(WindHazardIntervalSchema),
  convergenceStudies: z.array(WindHazardConvergenceStudySchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const HighWindsFailureModeSchema = HighWindsAnalysisRecordSchema.extend({
  failureModeType: z.enum(["FUNCTIONAL_FAILURE", "STRUCTURAL_FAILURE", "ANCHORAGE_FAILURE", "PRESSURE_BOUNDARY_FAILURE", "OVERTURNING", "SLIDING", "BUILDING_ENVELOPE_FAILURE", "BLOCKAGE", "SUBMERGENCE_OR_WETTING", "IMPACT_DAMAGE", "LOSS_OF_SUPPORT", "OTHER"]),
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  windEffects: z.array(HighWindsEffectTypeSchema),
  creditedFunction: z.string(),
  failureDefinition: z.string(),
  requiredState: z.enum(["FUNCTION_DURING_EVENT", "FUNCTION_AFTER_EVENT", "MAINTAIN_BOUNDARY", "OTHER"]),
  supportingElementRefs: stringArray,
  systemModelBasicEventRefs: stringArray,
  eventSequenceRefs: stringArray,
  fragilityRefs: stringArray,
  consequenceDescription: z.string(),
});

export const HighWindsEquipmentListEntrySchema = HighWindsAnalysisRecordSchema.extend({
  sscRef: z.string(),
  sscType: z.enum(["STRUCTURE", "SYSTEM", "COMPONENT", "SUPPORT", "BARRIER", "OPENING", "ELECTRICAL_EQUIPMENT", "OTHER"]),
  componentRef: z.string().optional(),
  systemRef: z.string().optional(),
  structureRef: z.string().optional(),
  parentSscRef: z.string().optional(),
  reactorUnitRefs: stringArray,
  radioactiveMaterialSourceRefs: stringArray,
  building: z.string(),
  roomOrArea: z.string(),
  elevation: z.string(),
  orientation: z.string(),
  mountingAndSupportDescription: z.string(),
  creditedFunctions: stringArray,
  inclusionSources: z.array(z.enum(["INTERNAL_EVENTS_SYSTEM_MODEL", "HIGH_WIND_EVENT_SEQUENCE_MODEL", "ADDITIONAL_HIGH_WIND_SSC", "INDUSTRY_HIGH_WIND_EQUIPMENT_LIST", "STRUCTURAL_INTERACTION", "MISSILE_TARGET", "WIND_DRIVEN_RAIN_TARGET", "OPERATOR_ACTION_SUPPORT", "INVESTIGATION_FINDING"])),
  sourceElementRefs: stringArray,
  applicableHazardTypes: z.array(HighWindsHazardTypeSchema),
  applicableWindEffects: z.array(HighWindsEffectTypeSchema),
  failureModes: z.array(HighWindsFailureModeSchema),
  supportingElementRefs: stringArray,
  correlationGroupRefs: stringArray,
  investigationRefs: stringArray,
  fragilityRefs: stringArray,
  disposition: z.enum(["ACTIVE", "SCREENED", "REMOVED_FROM_MODEL"]),
  dispositionBasis: z.string(),
});

export const HighWindsPreliminaryInitiatingEventSchema = HighWindsAnalysisRecordSchema.extend({
  initiatingEventRef: z.string(),
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  causationType: z.enum(["DIRECT", "INDIRECT", "PLANT_SHUTDOWN", "PROCEDURAL_RECONFIGURATION", "HUMAN_ACTION"]),
  initiatingFailureRefs: stringArray,
  affectedReactorUnitRefs: stringArray,
  affectedRadioactiveMaterialSourceRefs: stringArray,
  industryExperienceRefs: stringArray,
  retainedInModel: z.boolean(),
});

export const HighWindsPreliminaryModelReviewSchema = HighWindsAnalysisRecordSchema.extend({
  baselineModelRef: z.string(),
  reviewType: z.enum(["SYSTEM_LOGIC", "EVENT_SEQUENCE", "SUCCESS_CRITERIA", "DATA", "HRA", "PEER_REVIEW_FINDING"]),
  sourceRecordRefs: stringArray,
  highWindsGap: z.string(),
  requiredChange: z.string(),
  affectedSscRefs: stringArray,
  closureStatus: z.enum(["OPEN", "INCORPORATED", "NOT_APPLICABLE"]),
});

export const HighWindsPreliminaryPlantResponseSchema = z.object({
  preliminaryInitiatingEvents: z.array(HighWindsPreliminaryInitiatingEventSchema),
  modelReviews: z.array(HighWindsPreliminaryModelReviewSchema),
  highWindsEquipmentList: z.array(HighWindsEquipmentListEntrySchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const HighWindsInvestigationFindingSchema = HighWindsAnalysisRecordSchema.extend({
  investigationRef: z.string(),
  findingType: z.enum(["SSC_CONFIGURATION", "SUPPORTING_ELEMENT", "SCREENING_CONFIRMATION", "MISSILE_SOURCE", "STRUCTURAL_INTERACTION", "RAIN_ENTRY_PATH", "ACCESS_OR_HUMAN_ACTION", "OTHER"]),
  location: z.string(),
  affectedSscRefs: stringArray,
  affectedMissileSourceRefs: stringArray,
  condition: z.string(),
  modelImpact: z.string(),
  correctiveAction: z.string(),
  closureStatus: z.enum(["OPEN", "MODELED", "RESOLVED"]),
});

export const MissileSurveyZoneSchema = HighWindsAnalysisRecordSchema.extend({
  zoneType: z.enum(["SITE_GROUND", "BUILDING_ROOF", "BUILDING_ENVELOPE", "BUILDING_INTERIOR", "OUTAGE_LAYDOWN", "OFFSITE_ADJACENT"]),
  geometryDescription: z.string(),
  location: z.string(),
  elevationRange: z.string(),
  nearestHwelSscDistanceMetres: z.number(),
  topographyDescription: z.string(),
  shieldingFeatures: stringArray,
  plantOperatingStateRefs: stringArray,
  missileSourceRefs: stringArray,
});

export const WindMissileSourceSchema = HighWindsAnalysisRecordSchema.extend({
  surveyZoneRef: z.string(),
  sourceCategory: z.enum(["LOOSE_SITE_MATERIAL", "OUTAGE_MATERIAL", "VEHICLE_OR_TRAILER", "TREE_OR_POLE", "ROOFTOP_EQUIPMENT", "ROOF_GRAVEL_OR_PAVER", "METAL_CLADDING", "PURLIN_OR_GIRT", "BUILDING_CONTENT", "PIPE_OR_STRUCTURAL_SHAPE", "OTHER"]),
  missileShape: z.enum(["PLATE", "ROD", "COMPACT", "FLEXIBLE", "OTHER"]),
  material: z.string(),
  dimensions: z.string(),
  representativeMassKilograms: z.number(),
  quantityBestEstimate: z.number(),
  quantityLowerBound: z.number().optional(),
  quantityUpperBound: z.number().optional(),
  initialElevationMetres: z.number(),
  sourceAreaSquareMetres: z.number(),
  restraintOrReleaseDescription: z.string(),
  applicableHazardTypes: z.array(HighWindsHazardTypeSchema),
  plantOperatingStateRefs: stringArray,
  sourceTimeFraction: z.number(),
  targetSscRefs: stringArray,
});

export const MissilePopulationProfileSchema = HighWindsAnalysisRecordSchema.extend({
  plantCondition: z.enum(["NORMAL_OPERATION", "PRE_OUTAGE_BUILDUP", "OUTAGE", "POST_OUTAGE_CLEANUP", "CONSTRUCTION", "OTHER"]),
  plantOperatingStateRefs: stringArray,
  annualTimeFraction: z.number(),
  missileSourceRefs: stringArray,
  populationAdjustmentFactors: numberRecord,
  configurationChangeDescription: z.string(),
});

export const HighWindsPlantInvestigationAndMissileSurveySchema = z.object({
  investigations: z.array(HighWindsInvestigationSchema),
  findings: z.array(HighWindsInvestigationFindingSchema),
  missileSurveyZones: z.array(MissileSurveyZoneSchema),
  missileSources: z.array(WindMissileSourceSchema),
  missilePopulationProfiles: z.array(MissilePopulationProfileSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const HighWindsFragilityMethodSelectionSchema = HighWindsAnalysisRecordSchema.extend({
  sscRefs: stringArray,
  failureModeRefs: stringArray,
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  windEffects: z.array(HighWindsEffectTypeSchema),
  method: z.enum(["CODE_BASED", "NONPARAMETRIC", "RELIABILITY_ANALYSIS", "SIMULATION", "TEST_DATA", "GENERIC_WITH_SITE_EVALUATION", "SCREENING", "OTHER"]),
  informationBasis: z.enum(["PLANT_SPECIFIC", "GENERIC", "GENERIC_AUGMENTED", "BOUNDING"]),
  methodApplicability: z.string(),
  genericInformationRefs: stringArray,
  plantSpecificInformationRefs: stringArray,
  representativeFragilityGroupRef: z.string().optional(),
});

export const HighWindsFragilityCorrelationGroupSchema = HighWindsAnalysisRecordSchema.extend({
  memberSscRefs: stringArray,
  memberFailureModeRefs: stringArray,
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  windEffects: z.array(HighWindsEffectTypeSchema),
  correlationModel: z.enum(["PERFECT", "INDEPENDENT", "PARTIAL", "CAUSAL_DEPENDENCY"]),
  correlationCoefficient: z.number().optional(),
  commonDemandBasis: z.string(),
  constructionSimilarity: z.string(),
  locationAndOrientationSimilarity: z.string(),
  capacitySimilarity: z.string(),
  modelingImplementation: z.string(),
  sensitivityStudyRefs: stringArray,
});

export const HighWindsFragilityAggregationSchema = HighWindsAnalysisRecordSchema.extend({
  sscRef: z.string(),
  componentFragilityRefs: stringArray,
  failureModeRefs: stringArray,
  windEffects: z.array(HighWindsEffectTypeSchema),
  aggregationMethod: z.string(),
  dependencyTreatment: z.string(),
  conservativeBiasDescription: z.string(),
  resultingFragilityRef: z.string(),
});

export const HighWindsSscScreeningAndFragilityBasisSchema = z.object({
  screeningDecisions: z.array(HighWindsScreeningDecisionSchema),
  methodSelections: z.array(HighWindsFragilityMethodSelectionSchema),
  correlationGroups: z.array(HighWindsFragilityCorrelationGroupSchema),
  fragilityAggregations: z.array(HighWindsFragilityAggregationSchema),
  coexistentHazardAssessments: z.array(HighWindsHazardCombinationSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const WindFragilityCurvePointSchema = z.object({
  windSpeed: z.number(),
  conditionalFailureProbability: z.number(),
  fifthPercentileFailureProbability: z.number().optional(),
  ninetyFifthPercentileFailureProbability: z.number().optional(),
});

export const WindFragilityCurveSchema = HighWindsAnalysisRecordSchema.extend({
  sscRef: z.string(),
  failureModeRef: z.string(),
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  windEffects: z.array(HighWindsEffectTypeSchema),
  referenceWindDefinitionRef: z.string(),
  methodSelectionRef: z.string(),
  representativeGroupRef: z.string().optional(),
  medianCapacityWindSpeed: z.number(),
  logarithmicStandardDeviationRandomness: z.number(),
  logarithmicStandardDeviationUncertainty: z.number(),
  curvePoints: z.array(WindFragilityCurvePointSchema),
  hazardSpecific: z.boolean(),
  crossHazardUseJustification: z.string(),
  applicableWindSpeedRange: z.string(),
  informationSourceRefs: stringArray,
  correlationGroupRefs: stringArray,
});

export const BuildingEnvelopeStateSchema = HighWindsAnalysisRecordSchema.extend({
  structureRef: z.string(),
  state: z.enum(["ENCLOSED", "PARTIALLY_ENCLOSED", "OPEN", "PROGRESSIVE_FAILURE"]),
  failedEnvelopeElementRefs: stringArray,
  openingAreaSquareMetres: z.number(),
  internalPressureCoefficient: z.number(),
  transitionCriteria: z.string(),
  transitionProbabilityModel: z.string(),
});

export const WindPressureLoadModelSchema = HighWindsAnalysisRecordSchema.extend({
  sscRef: z.string(),
  failureModeRef: z.string(),
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  referenceWindDefinitionRef: z.string(),
  codeOrStandardBasis: z.string(),
  designCodeEra: z.string(),
  currentCodeComparison: z.string(),
  externalPressureCoefficients: numberRecord,
  envelopeStateRefs: stringArray,
  internalPressureTreatment: z.string(),
  directionalityFactor: z.number(),
  gustEffectFactor: z.number(),
  topographicFactor: z.number(),
  shieldingFactor: z.number(),
  negativeShieldingFactor: z.number(),
  flexibleStructure: z.boolean(),
  fundamentalFrequencyHertz: z.number().optional(),
  dynamicResponseTreatment: z.string(),
  loadCombinations: stringArray,
  demandCalculationRefs: stringArray,
});

export const AtmosphericPressureChangeLoadModelSchema = HighWindsAnalysisRecordSchema.extend({
  sscRef: z.string(),
  failureModeRef: z.string(),
  tornadoWindFieldModelRef: z.string(),
  pressureDropPascals: z.number(),
  pressureChangeRatePascalsPerSecond: z.number(),
  radiusOfMaximumWindsMetres: z.number(),
  tornadoTranslationSpeedMetresPerSecond: z.number(),
  backgroundLeakageAreaSquareMetres: z.number(),
  envelopeFailureRefs: stringArray,
  internalPressureResponseMethod: z.string(),
  combinedWindAndApcLoadMethod: z.string(),
  demandCalculationRefs: stringArray,
});

export const TopographyAndShieldingAssessmentSchema = HighWindsAnalysisRecordSchema.extend({
  siteArea: z.string(),
  affectedSscRefs: stringArray,
  topographicFeature: z.string(),
  speedUpMethod: z.string(),
  speedUpFactor: z.number(),
  surroundingStructureRefs: stringArray,
  shieldingDirections: stringArray,
  negativeShieldingDirections: stringArray,
  windTunnelOrCfdRefs: stringArray,
  engineeringJudgmentBasis: z.string(),
});

export const HighWindsPressureAndApcFragilityAnalysisSchema = z.object({
  buildingEnvelopeStates: z.array(BuildingEnvelopeStateSchema),
  pressureLoadModels: z.array(WindPressureLoadModelSchema),
  atmosphericPressureChangeModels: z.array(AtmosphericPressureChangeLoadModelSchema),
  topographyAndShieldingAssessments: z.array(TopographyAndShieldingAssessmentSchema),
  fragilityCurves: z.array(WindFragilityCurveSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const MissileCategorySchema = HighWindsAnalysisRecordSchema.extend({
  missileSourceRefs: stringArray,
  missileShape: z.enum(["PLATE", "ROD", "COMPACT", "FLEXIBLE", "OTHER"]),
  material: z.string(),
  representativeDimensions: z.string(),
  representativeMassKilograms: z.number(),
  quantityDistribution: z.string(),
  releaseWindSpeedDistribution: z.string(),
  applicableHazardTypes: z.array(HighWindsHazardTypeSchema),
});

export const MissileTargetModelSchema = HighWindsAnalysisRecordSchema.extend({
  sscRef: z.string(),
  failureModeRef: z.string(),
  targetGeometry: z.string(),
  targetAreaSquareMetres: z.number(),
  targetVolumeCubicMetres: z.number().optional(),
  targetElevationMetres: z.number(),
  targetOrientation: z.string(),
  openingAndLineOfSightDescription: z.string(),
  shieldingStructureRefs: stringArray,
  ricochetSurfaceRefs: stringArray,
  damageModes: stringArray,
});

export const MissileTrajectoryModelSchema = HighWindsAnalysisRecordSchema.extend({
  hazardType: HighWindsHazardTypeSchema,
  windFieldModelRef: z.string(),
  missileCategoryRefs: stringArray,
  sourceZoneRefs: stringArray,
  sourceDistanceCutoffMetres: z.number(),
  sourceDistanceCutoffBasis: z.string(),
  spatialDimension: z.enum(["TWO_DIMENSIONAL", "THREE_DIMENSIONAL"]),
  siteSpecificFeaturesCaptured: stringArray,
  injectionModel: z.string(),
  aerodynamicCoefficientModel: z.string(),
  trajectoryIntegrationMethod: z.string(),
  timeStepSeconds: z.number(),
  verticalWindTreatment: z.string(),
  shieldingTreatment: z.string(),
  ricochetTreatment: z.string(),
  multipleMissileTreatment: z.string(),
  simulationCount: z.number(),
  randomSeedReference: z.string(),
});

export const MissileImpactAndDamageModelSchema = HighWindsAnalysisRecordSchema.extend({
  targetModelRef: z.string(),
  trajectoryModelRefs: stringArray,
  missileCategoryRefs: stringArray,
  hitCriterion: z.string(),
  damageCriterion: z.string(),
  impactVelocityTreatment: z.string(),
  penetrationMethod: z.string(),
  perforationMethod: z.string(),
  spallMethod: z.string(),
  localDamageMethod: z.string(),
  nonlinearAnalysisRefs: stringArray,
  probabilityOfHit: z.number(),
  probabilityOfDamageGivenHit: z.number(),
  multipleSscCorrelationTreatment: z.string(),
  scalingMethod: z.string(),
  scalingJustification: z.string(),
});

export const MissileSimulationConvergenceStudySchema = HighWindsAnalysisRecordSchema.extend({
  trajectoryModelRef: z.string(),
  impactAndDamageModelRefs: stringArray,
  windSpeeds: z.array(z.number()),
  missilePopulationSize: z.number(),
  simulationCounts: z.array(z.number()),
  meanFragilityEstimates: z.array(z.number()),
  standardErrors: z.array(z.number()),
  convergenceCriterion: z.string(),
  converged: z.boolean(),
});

export const HighWindsMissileFragilityAnalysisSchema = z.object({
  missileCategories: z.array(MissileCategorySchema),
  targetModels: z.array(MissileTargetModelSchema),
  trajectoryModels: z.array(MissileTrajectoryModelSchema),
  impactAndDamageModels: z.array(MissileImpactAndDamageModelSchema),
  convergenceStudies: z.array(MissileSimulationConvergenceStudySchema),
  fragilityCurves: z.array(WindFragilityCurveSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const StructuralInteractionScenarioSchema = HighWindsAnalysisRecordSchema.extend({
  sourceStructureRef: z.string(),
  sourceFailureModeRef: z.string(),
  targetSscRefs: stringArray,
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  interactionType: z.enum(["COLLAPSE", "FALLING_OBJECT", "ADJACENT_STRUCTURE_CONTACT", "DEBRIS_BLOCKAGE", "OTHER"]),
  spatialGeometry: z.string(),
  sourceFragilityRef: z.string(),
  conditionalTargetDamageModel: z.string(),
  affectedFunctions: stringArray,
  plantResponseModelRefs: stringArray,
});

export const RainEntryPathSchema = HighWindsAnalysisRecordSchema.extend({
  structureRef: z.string(),
  envelopeElementRef: z.string(),
  entryPathType: z.enum(["ROOF", "ROOF_DRAIN", "DOOR", "WINDOW", "VENT", "LOUVER", "CLADDING", "PENETRATION", "OTHER"]),
  initiatingEnvelopeFailureRef: z.string().optional(),
  location: z.string(),
  openingAreaSquareMetres: z.number(),
  interiorTransportPath: z.string(),
  targetSscRefs: stringArray,
  dripSplashOrDepositionModes: stringArray,
  drainageAndProtectionFeatures: stringArray,
});

export const WindDrivenRainModelSchema = HighWindsAnalysisRecordSchema.extend({
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  referenceWindDefinitionRef: z.string(),
  rainIntensityModel: z.string(),
  dropSizeDistributionModel: z.string(),
  terminalVelocityModel: z.string(),
  windFieldModelRef: z.string(),
  buildingAerodynamicTreatment: z.string(),
  depositionOrIngressMethod: z.string(),
  entryPathRefs: stringArray,
  durationModel: z.string(),
  validationRefs: stringArray,
});

export const RainTargetVulnerabilitySchema = HighWindsAnalysisRecordSchema.extend({
  sscRef: z.string(),
  rainEntryPathRefs: stringArray,
  environmentalQualification: z.string(),
  enclosureRating: z.string(),
  failureThreshold: z.string(),
  leakageRateModel: z.string(),
  timeToFailureModel: z.string(),
  functionalFailureModeRef: z.string(),
  fragilityRef: z.string(),
});

export const HighWindsInteractionAndRainFragilityAnalysisSchema = z.object({
  structuralInteractionScenarios: z.array(StructuralInteractionScenarioSchema),
  rainEntryPaths: z.array(RainEntryPathSchema),
  windDrivenRainModels: z.array(WindDrivenRainModelSchema),
  rainTargetVulnerabilities: z.array(RainTargetVulnerabilitySchema),
  fragilityCurves: z.array(WindFragilityCurveSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const HighWindsPeerReviewDispositionSchema = HighWindsAnalysisRecordSchema.extend({
  sourcePraElement: z.string(),
  findingId: z.string(),
  findingText: z.string(),
  relevanceToHighWinds: z.string(),
  disposition: z.string(),
  affectedModelRefs: stringArray,
  closureEvidenceRefs: stringArray,
  closureStatus: z.enum(["OPEN", "INCORPORATED", "NOT_RELEVANT", "CLOSED"]),
});

export const HighWindsInitiatingEventModelSchema = HighWindsAnalysisRecordSchema.extend({
  initiatingEventRef: z.string(),
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  causationType: z.enum(["DIRECT", "INDIRECT", "PLANT_SHUTDOWN", "PROCEDURAL_RECONFIGURATION", "HUMAN_ACTION"]),
  inducingSscFailureRefs: stringArray,
  inducingHumanActionRefs: stringArray,
  affectedReactorUnitRefs: stringArray,
  affectedRadioactiveMaterialSourceRefs: stringArray,
  industryExperienceRefs: stringArray,
  baselineFrequencyTreatment: z.string(),
  modelImplementation: z.string(),
});

export const HighWindsEventSequenceModelSchema = HighWindsAnalysisRecordSchema.extend({
  sourceEventSequenceRef: z.string().optional(),
  initiatingEventRefs: stringArray,
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  reactorUnitRefs: stringArray,
  radioactiveMaterialSourceRefs: stringArray,
  sequenceEndStates: stringArray,
  eventSequenceFamilyRefs: stringArray,
  modelChanges: stringArray,
  multiReactorOrMultiSource: z.boolean(),
  coexistentHazardRefs: stringArray,
  missionTimeRef: z.string(),
  modelLogicRefs: stringArray,
});

export const HighWindsSuccessCriterionSchema = HighWindsAnalysisRecordSchema.extend({
  sourceSuccessCriterionRef: z.string().optional(),
  eventSequenceRefs: stringArray,
  safetyFunction: z.string(),
  criterion: z.string(),
  highWindsChange: z.string(),
  analysisRefs: stringArray,
});

export const HighWindsSystemModelModificationSchema = HighWindsAnalysisRecordSchema.extend({
  systemRef: z.string(),
  sourceModelRef: z.string(),
  affectedBasicEventRefs: stringArray,
  highWindsFailureModeRefs: stringArray,
  fragilityRefs: stringArray,
  correlationGroupRefs: stringArray,
  randomFailureTreatment: z.string(),
  unavailabilityTreatment: z.string(),
  beneficialFailureTreatment: z.string(),
  modificationDescription: z.string(),
  newLogicRefs: stringArray,
});

export const HighWindsMissionTimeSchema = HighWindsAnalysisRecordSchema.extend({
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  eventSequenceRefs: stringArray,
  missionTimeHours: z.number(),
  stableEndState: z.string(),
  offsitePowerRecoveryModel: z.string(),
  highWindsDurationBasis: z.string(),
  industryExperienceRefs: stringArray,
  boundingOrRealistic: z.enum(["BOUNDING", "REALISTIC"]),
});

export const HighWindsDataParameterSchema = HighWindsAnalysisRecordSchema.extend({
  parameterRef: z.string(),
  parameterType: z.enum(["RANDOM_FAILURE", "COMMON_CAUSE_FAILURE", "UNAVAILABILITY", "RECOVERY", "MISSION_TIME", "OTHER"]),
  sourceDataRef: z.string(),
  highWindsContextChange: z.string(),
  meanValue: z.number(),
  uncertaintyDistribution: z.string(),
  modelBasicEventRefs: stringArray,
});

export const HighWindsMultiUnitAssessmentSchema = HighWindsAnalysisRecordSchema.extend({
  affectedReactorUnitRefs: stringArray,
  affectedRadioactiveMaterialSourceRefs: stringArray,
  sharedSscRefs: stringArray,
  sharedResourceRefs: stringArray,
  organizationalResponseEffects: stringArray,
  siteAccessibilityEffects: stringArray,
  commonCauseFailureTreatment: z.string(),
  eventSequenceRefs: stringArray,
});

export const HighWindsPlantResponseModelSchema = z.object({
  peerReviewDispositions: z.array(HighWindsPeerReviewDispositionSchema),
  initiatingEventModels: z.array(HighWindsInitiatingEventModelSchema),
  eventSequenceModels: z.array(HighWindsEventSequenceModelSchema),
  successCriteria: z.array(HighWindsSuccessCriterionSchema),
  systemModelModifications: z.array(HighWindsSystemModelModificationSchema),
  missionTimes: z.array(HighWindsMissionTimeSchema),
  dataParameters: z.array(HighWindsDataParameterSchema),
  coexistentHazardAssessments: z.array(HighWindsHazardCombinationSchema),
  multiUnitAssessments: z.array(HighWindsMultiUnitAssessmentSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const HighWindsHumanActionSchema = HighWindsAnalysisRecordSchema.extend({
  sourceHumanActionRef: z.string().optional(),
  actionType: z.enum(["PREPARATORY", "RESPONSE", "RECOVERY"]),
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  actionLocation: z.enum(["CONTROL_ROOM", "LOCAL_INDOOR", "LOCAL_OUTDOOR", "REMOTE", "OTHER"]),
  cue: z.string(),
  procedureRefs: stringArray,
  requiredEquipmentRefs: stringArray,
  affectedFunctionRefs: stringArray,
  warningTimeAvailableMinutes: z.number(),
  timeAvailableMinutes: z.number(),
  nominalExecutionTimeMinutes: z.number(),
  highWindsExecutionTimeMinutes: z.number(),
  feasibilityBasis: z.string(),
});

export const HighWindsHumanFailureEventSchema = HighWindsAnalysisRecordSchema.extend({
  humanActionRef: z.string(),
  sourceHfeRef: z.string().optional(),
  eventSequenceRefs: stringArray,
  systemTrainOrComponentLevel: z.string(),
  failureDescription: z.string(),
  dependencyGroupRefs: stringArray,
  modelBasicEventRefs: stringArray,
  exclusiveRecovery: z.boolean(),
});

export const HighWindsPerformanceContextSchema = HighWindsAnalysisRecordSchema.extend({
  humanActionRef: z.string(),
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  warningAndDurationDescription: z.string(),
  workloadAndStress: z.string(),
  weatherAndEnvironment: z.string(),
  lightingAndHabitability: z.string(),
  debrisAndAccess: z.string(),
  doorwayAndEgressCondition: z.string(),
  staffingAndCommunications: z.string(),
  cueAvailability: z.string(),
  trainingAndJobAids: z.string(),
  physicalHazardToPersonnel: z.string(),
  competingMultiUnitDemands: z.string(),
});

export const HighWindsHepEstimateSchema = HighWindsAnalysisRecordSchema.extend({
  humanFailureEventRef: z.string(),
  performanceContextRef: z.string(),
  method: z.string(),
  nominalHep: z.number(),
  highWindsHep: z.number(),
  lowerBoundHep: z.number().optional(),
  upperBoundHep: z.number().optional(),
  timingMarginMinutes: z.number(),
  dependencyAdjustment: z.number(),
  recoveryCredit: z.boolean(),
  uncertaintyDistribution: z.string(),
});

export const HighWindsHumanActionConfirmationSchema = HighWindsAnalysisRecordSchema.extend({
  humanActionRefs: stringArray,
  confirmationType: z.enum(["PROCEDURE_REVIEW", "OPERATOR_INTERVIEW", "TALK_THROUGH", "TABLETOP", "SIMULATION"]),
  participantRoles: stringArray,
  confirmedProcedureInterpretation: z.boolean(),
  timingFindings: stringArray,
  feasibilityFindings: stringArray,
  modelChanges: stringArray,
});

export const HighWindsRecoveryAssessmentSchema = HighWindsAnalysisRecordSchema.extend({
  humanActionRef: z.string(),
  sourceRecoveryModelRef: z.string(),
  remainsValidUnderHighWinds: z.boolean(),
  invalidatingConditions: stringArray,
  adjustedRecoveryModel: z.string(),
  recoveryValue: z.number(),
  procedureAndConditionBasis: z.string(),
});

export const HighWindsHraDependencyAssessmentSchema = HighWindsAnalysisRecordSchema.extend({
  humanFailureEventRefs: stringArray,
  sharedCues: stringArray,
  sharedCrews: stringArray,
  sharedLocations: stringArray,
  temporalRelationship: z.string(),
  hazardCommonalities: stringArray,
  dependencyLevel: z.enum(["ZERO", "LOW", "MODERATE", "HIGH", "COMPLETE"]),
  jointProbabilityTreatment: z.string(),
});

export const HighWindsHumanReliabilityAnalysisSchema = z.object({
  humanActions: z.array(HighWindsHumanActionSchema),
  humanFailureEvents: z.array(HighWindsHumanFailureEventSchema),
  performanceContexts: z.array(HighWindsPerformanceContextSchema),
  hepEstimates: z.array(HighWindsHepEstimateSchema),
  confirmations: z.array(HighWindsHumanActionConfirmationSchema),
  recoveryAssessments: z.array(HighWindsRecoveryAssessmentSchema),
  dependencyAssessments: z.array(HighWindsHraDependencyAssessmentSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const HighWindsQuantificationRunSchema = HighWindsAnalysisRecordSchema.extend({
  modelVersion: z.string(),
  calculationDate: z.string(),
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  hazardCurveRefs: stringArray,
  hazardIntervalRefs: stringArray,
  fragilityRefs: stringArray,
  plantResponseModelRefs: stringArray,
  humanFailureEventRefs: stringArray,
  calculationMethod: z.string(),
  rareEventApproximationTreatment: z.string(),
  highFailureProbabilityTreatment: z.string(),
  truncationLevel: z.number(),
  uncertaintySampleCount: z.number(),
  randomSeedReference: z.string(),
  softwareAndVersion: z.string(),
});

export const HighWindsHazardIntervalResultSchema = HighWindsAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(),
  hazardIntervalRef: z.string(),
  hazardType: HighWindsHazardTypeSchema,
  eventSequenceFamilyRef: z.string(),
  intervalFrequencyPerPlantYear: z.number(),
  conditionalSequenceProbability: z.number(),
  sequenceFrequencyPerPlantYear: z.number(),
  dominantFragilityRefs: stringArray,
  dominantBasicEventRefs: stringArray,
});

export const HighWindsEventSequenceFamilyResultSchema = HighWindsAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(),
  eventSequenceFamilyRef: z.string(),
  eventSequenceRefs: stringArray,
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  reactorUnitRefs: stringArray,
  radioactiveMaterialSourceRefs: stringArray,
  releaseCategoryRefs: stringArray,
  meanFrequencyPerPlantYear: z.number(),
  pointEstimateFrequencyPerPlantYear: z.number(),
  fifthPercentileFrequencyPerPlantYear: z.number().optional(),
  fiftiethPercentileFrequencyPerPlantYear: z.number().optional(),
  ninetyFifthPercentileFrequencyPerPlantYear: z.number().optional(),
  dominantContributorRefs: stringArray,
});

export const HighWindsQuantificationConvergenceStudySchema = HighWindsAnalysisRecordSchema.extend({
  quantificationRunRefs: stringArray,
  studyType: z.enum(["HAZARD_BINNING", "UPPER_WIND_TRUNCATION", "CUTSET_TRUNCATION", "MONTE_CARLO_SAMPLE_SIZE", "MISSILE_SIMULATION"]),
  testedValues: z.array(z.number()),
  resultingRiskMetrics: z.array(z.number()),
  maximumRelativeDifference: z.number(),
  contributorRankingStable: z.boolean(),
  acceptanceCriterion: z.string(),
  converged: z.boolean(),
});

export const HighWindsIntegratedUncertaintyResultSchema = HighWindsAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(),
  riskMetric: z.string(),
  meanValue: z.number(),
  standardDeviation: z.number(),
  fifthPercentile: z.number(),
  fiftiethPercentile: z.number(),
  ninetyFifthPercentile: z.number(),
  hazardUncertaintyRefs: stringArray,
  fragilityUncertaintyRefs: stringArray,
  plantResponseUncertaintyRefs: stringArray,
  importanceMeasures: numberRecord,
});

export const HighWindsRiskContributorSchema = HighWindsAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(),
  contributorType: z.enum(["HAZARD_TYPE", "WIND_INTERVAL", "SSC", "FAILURE_MODE", "MISSILE_SOURCE", "HFE", "EVENT_SEQUENCE", "EVENT_SEQUENCE_FAMILY"]),
  contributorRef: z.string(),
  riskMetric: z.string(),
  absoluteContribution: z.number(),
  fractionalContribution: z.number(),
  rank: z.number(),
});

export const HighWindsEventSequenceQuantificationSchema = z.object({
  quantificationRuns: z.array(HighWindsQuantificationRunSchema),
  hazardIntervalResults: z.array(HighWindsHazardIntervalResultSchema),
  eventSequenceFamilyResults: z.array(HighWindsEventSequenceFamilyResultSchema),
  convergenceStudies: z.array(HighWindsQuantificationConvergenceStudySchema),
  uncertaintyResults: z.array(HighWindsIntegratedUncertaintyResultSchema),
  riskContributors: z.array(HighWindsRiskContributorSchema),
  screeningDecisions: z.array(HighWindsScreeningDecisionSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const HighWindsRiskInsightSchema = HighWindsAnalysisRecordSchema.extend({
  insightType: z.enum(["DOMINANT_CONTRIBUTOR", "DEFENSE_IN_DEPTH", "MODEL_LIMITATION", "UNCERTAINTY", "DESIGN_OPPORTUNITY", "PROCEDURAL_OPPORTUNITY"]),
  contributorRefs: stringArray,
  affectedRiskMetric: z.string(),
  fractionalContribution: z.number().optional(),
  decisionImplication: z.string(),
});

export const HighWindsModelRefinementSchema = HighWindsAnalysisRecordSchema.extend({
  technicalArea: z.enum(["HAZARD", "HWEL", "INVESTIGATION", "FRAGILITY", "MISSILE", "RAIN", "PLANT_RESPONSE", "HRA", "QUANTIFICATION"]),
  driverRefs: stringArray,
  affectedRecordRefs: stringArray,
  refinement: z.string(),
  expectedEffect: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  refinementStatus: z.enum(["PROPOSED", "IN_PROGRESS", "REQUANTIFIED", "CLOSED"]),
  quantificationIterationRef: z.string().optional(),
  result: z.string(),
  decisionBasis: z.string(),
});

export const HighWindsRefinementIterationSchema = HighWindsAnalysisRecordSchema.extend({
  modelVersion: z.string(),
  calculationDate: z.string(),
  refinementActionRefs: stringArray,
  aggregateMeanFrequencyPerPlantYear: z.number(),
  previousAggregateMeanFrequencyPerPlantYear: z.number().optional(),
  relativeChange: z.number().optional(),
  maximumFamilyRelativeChange: z.number().optional(),
  topContributorRefs: stringArray,
  contributorRankingStable: z.boolean(),
  newRiskSignificantContributorRefs: stringArray,
  decision: z.enum(["CONTINUE_REFINEMENT", "ACCEPT_STABLE"]),
});

export const HighWindsRiskIntegrationResultSchema = HighWindsAnalysisRecordSchema.extend({
  modelVersion: z.string(),
  plantOperatingStateRefs: stringArray,
  reactorUnitRefs: stringArray,
  radioactiveMaterialSourceRefs: stringArray,
  eventSequenceFamilyRefs: stringArray,
  releaseCategoryRefs: stringArray,
  aggregateMeanFrequencyPerPlantYear: z.number(),
  fifthPercentileFrequencyPerPlantYear: z.number(),
  ninetyFifthPercentileFrequencyPerPlantYear: z.number(),
  otherHazardRiskRefs: stringArray,
  overlapTreatment: z.string(),
  dominantContributorRefs: stringArray,
  integrationStatus: z.enum(["DRAFT", "READY_FOR_RISK_INTEGRATION", "ACCEPTED_BY_RISK_INTEGRATION"]),
});

export const HighWindsRiskDecisionSchema = HighWindsAnalysisRecordSchema.extend({
  decisionType: z.enum(["DESIGN", "PROCEDURE", "CONFIGURATION_CONTROL", "MISSILE_CONTROL", "MONITORING", "DATA_COLLECTION", "MODEL_CONTROL"]),
  driverRefs: stringArray,
  affectedSscRefs: stringArray,
  action: z.string(),
  duePhase: z.string(),
  disposition: z.enum(["IMPLEMENT", "MONITOR", "CONFIRM_PRE_OPERATIONAL", "RETAIN_CURRENT_BASIS", "FORWARD_TO_PLANT_PROCESS"]),
  verificationRefs: stringArray,
  reanalysisRequired: z.boolean(),
  riskIntegrationResultRef: z.string(),
});

export const HighWindsRiskTraceabilityPathSchema = HighWindsAnalysisRecordSchema.extend({
  evidenceRefs: stringArray,
  hazardDataRefs: stringArray,
  hazardCurveRefs: stringArray,
  highWindsEquipmentListRefs: stringArray,
  investigationRefs: stringArray,
  fragilityRefs: stringArray,
  initiatingEventRefs: stringArray,
  humanFailureEventRefs: stringArray,
  eventSequenceFamilyRefs: stringArray,
  resultRefs: stringArray,
  decisionRefs: stringArray,
  complete: z.boolean(),
});

export const HighWindsControlledBaselineSchema = HighWindsAnalysisRecordSchema.extend({
  modelVersion: z.string(),
  quantificationRunRef: z.string(),
  reportRef: z.string(),
  configurationControlRecordId: z.string(),
  peerReviewRef: z.string(),
  packageManifestRefs: stringArray,
  unresolvedLimitations: stringArray,
  releaseStatus: z.enum(["WORKING", "CONTROLLED", "SUPERSEDED"]),
});

export const HighWindsRiskInterpretationSchema = z.object({
  riskInsights: z.array(HighWindsRiskInsightSchema),
  refinementActions: z.array(HighWindsModelRefinementSchema),
  quantificationIterations: z.array(HighWindsRefinementIterationSchema),
  integrationResults: z.array(HighWindsRiskIntegrationResultSchema),
  riskDecisions: z.array(HighWindsRiskDecisionSchema),
  traceabilityPaths: z.array(HighWindsRiskTraceabilityPathSchema),
  controlledBaselines: z.array(HighWindsControlledBaselineSchema),
  stoppingCriteria: z.object({
    maximumAggregateFrequencyChange: z.number(),
    maximumFamilyFrequencyChange: z.number(),
    maximumContributorRankShift: z.number(),
    requiredStableIterations: z.number(),
    requireNoNewRiskSignificantContributors: z.boolean(),
    basis: z.string(),
  }),
});

export const HighWindsPeerReviewTeamMemberSchema = HighWindsAnalysisRecordSchema.extend({
  role: z.enum(["TEAM_LEAD", "SYSTEMS_ENGINEER", "WIND_HAZARD_SPECIALIST", "FRAGILITY_SPECIALIST", "HRA_SPECIALIST", "QUANTIFICATION_SPECIALIST", "OTHER"]),
  organization: z.string(),
  independenceStatement: z.string(),
  qualifications: stringArray,
  experience: stringArray,
  reviewScope: stringArray,
});

export const HighWindsPeerReviewFindingSchema = HighWindsAnalysisRecordSchema.extend({
  reviewArea: z.enum(["WHA", "WFR", "WPR", "INVESTIGATION", "QUANTIFICATION", "DOCUMENTATION"]),
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

export const HighWindsTechnicalClosureSchema = z.object({
  conformanceReviews: z.array(HighWindsAnalysisRecordSchema),
  documentationChecks: z.array(HighWindsAnalysisRecordSchema),
  interfaceClosureChecks: z.array(HighWindsAnalysisRecordSchema),
  peerReviewTeam: z.array(HighWindsPeerReviewTeamMemberSchema),
  peerReviewFindings: z.array(HighWindsPeerReviewFindingSchema),
  readinessChecks: z.array(HighWindsAnalysisRecordSchema),
  modelUncertainties: z.array(HighWindsModelUncertaintySchema),
  preOperationalAssumptions: z.array(HighWindsPreOperationalAssumptionSchema),
  documentation: HighWindsProcessDocumentationSchema,
});

export const HighWindsWorkflowRecordSchema = HighWindsAnalysisRecordSchema.extend({
  workflowRecordType: z.enum(["REPORT_SECTION", "QUALITY_CHECK", "REVIEW_ASSIGNMENT", "REVIEW_FINDING", "APPROVAL_READINESS", "APPROVAL_SIGNATURE"]),
  discipline: z.string(),
  assignee: z.string(),
  dueDate: z.string().optional(),
  result: z.string(),
  verificationRefs: stringArray,
});

export const HighWindsPraWorkflowSchema = z.object({
  reportSections: z.array(HighWindsWorkflowRecordSchema),
  draftQualityChecks: z.array(HighWindsWorkflowRecordSchema),
  reviewAssignments: z.array(HighWindsWorkflowRecordSchema),
  reviewFindings: z.array(HighWindsWorkflowRecordSchema),
  approvalReadiness: z.array(HighWindsWorkflowRecordSchema),
  approvalSignatures: z.array(HighWindsWorkflowRecordSchema),
});

export const HighWindsPraDocumentationSchema = z.object({
  overallProcessDescription: z.string(),
  analysisBasisSummary: z.string(),
  hazardScreeningSummary: z.string(),
  windDataSummary: z.string(),
  straightWindHazardSummary: z.string(),
  tropicalCycloneHazardSummary: z.string(),
  tornadoHazardSummary: z.string(),
  hazardIntegrationSummary: z.string(),
  highWindsEquipmentListSummary: z.string(),
  investigationSummary: z.string(),
  fragilitySummary: z.string(),
  plantResponseSummary: z.string(),
  humanReliabilitySummary: z.string(),
  quantificationSummary: z.string(),
  riskInsights: z.string(),
  uncertaintySummary: z.string(),
  configurationControlDescription: z.string(),
  peerReviewScope: z.string(),
  supportingDocumentRefs: stringArray,
});

export const HighWindsPraExampleDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["doc", "sheet", "image"]),
  sizeLabel: z.string(),
  uploadedLabel: z.string(),
  extracted: z.string(),
  linked: z.number(),
  url: z.string().optional(),
});

export const HighWindsPRASchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.HIGH_WINDS_PRA).shape,
  praScope: z.string(),
  hazardConditionedModels: HazardConditionedMethodModelsSchema.default(createEmptyHazardConditionedMethodModels),
  analysisBasis: HighWindsAnalysisBasisSchema,
  hazardScreening: HighWindsHazardScreeningSchema,
  windDataAndReferenceBasis: HighWindsWindDataAndReferenceBasisSchema,
  straightWindHazardAnalysis: HighWindsStraightWindHazardAnalysisSchema,
  tropicalCycloneHazardAnalysis: HighWindsTropicalCycloneHazardAnalysisSchema,
  tornadoHazardAnalysis: HighWindsTornadoHazardAnalysisSchema,
  hazardIntegration: HighWindsHazardIntegrationSchema,
  preliminaryPlantResponse: HighWindsPreliminaryPlantResponseSchema,
  plantInvestigationAndMissileSurvey: HighWindsPlantInvestigationAndMissileSurveySchema,
  sscScreeningAndFragilityBasis: HighWindsSscScreeningAndFragilityBasisSchema,
  pressureAndApcFragilityAnalysis: HighWindsPressureAndApcFragilityAnalysisSchema,
  missileFragilityAnalysis: HighWindsMissileFragilityAnalysisSchema,
  interactionAndRainFragilityAnalysis: HighWindsInteractionAndRainFragilityAnalysisSchema,
  plantResponseModel: HighWindsPlantResponseModelSchema,
  humanReliabilityAnalysis: HighWindsHumanReliabilityAnalysisSchema,
  eventSequenceQuantification: HighWindsEventSequenceQuantificationSchema,
  integratedUncertainties: z.array(HighWindsModelUncertaintySchema),
  riskInterpretation: HighWindsRiskInterpretationSchema,
  technicalClosure: HighWindsTechnicalClosureSchema,
  workflow: HighWindsPraWorkflowSchema,
  documentation: HighWindsPraDocumentationSchema,
  configurationControlRecordId: z.string().optional(),
  exampleDocuments: z.array(HighWindsPraExampleDocumentSchema).optional(),
  newlyDevelopedMethodIds: stringArray.optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _Pra = Expect<Equal<z.infer<typeof HighWindsPRASchema>, HighWindsPRA>>;
