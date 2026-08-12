import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import {
  createHighWindsSrCatalog,
  HighWindsAnalysisRecord,
  HighWindsEffectType,
  HighWindsHazardType,
  HighWindsInvestigation,
  HighWindsModelUncertainty,
  HighWindsPraInterfaceRecord,
  HighWindsPreOperationalAssumption,
  HighWindsProcessDocumentation,
  HighWindsScreeningDecision,
  HighWindsSrCatalogEntry,
} from "./high-winds-pra-common";

export * from "./high-winds-pra-common";

export interface HighWindsPraApplication extends HighWindsAnalysisRecord {
  purpose: string;
  decisionContext: string;
  supportedRiskMetrics: string[];
  consumingElementRefs: string[];
  configurationBasis: string;
  limitations: string[];
}

export interface HighWindsPraEvidenceRecord extends HighWindsAnalysisRecord {
  evidenceType:
    | "STANDARD"
    | "METEOROLOGICAL_DATA"
    | "DRAWING"
    | "CALCULATION"
    | "PROCEDURE"
    | "MODEL"
    | "WALKDOWN"
    | "MISSILE_SURVEY"
    | "INTERVIEW"
    | "OPERATING_EXPERIENCE"
    | "REVIEW"
    | "OTHER";
  sourceReference: string;
  revision?: string;
  effectiveDate?: string;
  applicableSubelements: ("WHA" | "WFR" | "WPR")[];
  applicability: string;
  qualityAndLimitations: string;
  fileReference?: string;
  supersedesEvidenceRef?: string;
  controlled: boolean;
}

export interface HighWindsBaselinePraRecordTreatment extends HighWindsAnalysisRecord {
  technicalArea:
    | "PLANT_OPERATING_STATES"
    | "INITIATING_EVENTS"
    | "EVENT_SEQUENCES"
    | "SUCCESS_CRITERIA"
    | "SYSTEMS"
    | "DATA"
    | "HUMAN_RELIABILITY"
    | "RISK_INTEGRATION";
  sourceRecordRefs: string[];
  treatment: "REUSED" | "MODIFIED" | "NEW" | "NOT_APPLICABLE";
  highWindsChange: string;
  unresolvedItems: string[];
}

export interface HighWindsBaselinePraDefinition {
  modelName: string;
  modelReference: string;
  revision: string;
  freezeDate: string;
  freezeStatus: "WORKING" | "FROZEN" | "REFERENCE_ONLY";
  modelBoundary: string;
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  recordTreatments: HighWindsBaselinePraRecordTreatment[];
  unresolvedInterfaces: string[];
}

export interface HighWindsSiteBasis extends HighWindsAnalysisRecord {
  siteBasisType: "SPECIFIC_SITE" | "BOUNDING_SITE";
  siteName: string;
  latitudeDegrees?: number;
  longitudeDegrees?: number;
  elevationMetres?: number;
  siteSelectionStatus: "SELECTED" | "CANDIDATE" | "BOUNDING_ENVELOPE";
  boundingSiteRefs: string[];
  boundingCharacteristics: string[];
  regionalClimateDescription: string;
  terrainAndTopographyDescription: string;
  licenseeControlledAreaDescription: string;
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  plantOperatingStateRefs: string[];
  multiReactorOrMultiSourceLocations: string[];
  analysisDateCutoff: string;
}

export interface HighWindsAnalysisScopeRecord extends HighWindsAnalysisRecord {
  hazardTypes: HighWindsHazardType[];
  windEffects: HighWindsEffectType[];
  includedPlantLocations: string[];
  excludedPlantLocations: string[];
  includedOperatingStateRefs: string[];
  includedReactorUnitRefs: string[];
  includedRadioactiveMaterialSourceRefs: string[];
  riskMetrics: string[];
  intendedCapabilityCategory: "CC-I" | "CC-II";
}

export interface HighWindsAnalysisBasis {
  siteBasis?: HighWindsSiteBasis;
  scopeRecords: HighWindsAnalysisScopeRecord[];
  applications: HighWindsPraApplication[];
  evidenceRegister: HighWindsPraEvidenceRecord[];
  baselinePra?: HighWindsBaselinePraDefinition;
  interfaces: HighWindsPraInterfaceRecord[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface HighWindsHazardCandidate extends HighWindsAnalysisRecord {
  hazardType: HighWindsHazardType;
  applicableWindPhenomena: string[];
  regionalIndicators: string[];
  siteCharacteristics: string[];
  plantCharacteristics: string[];
  potentialWindEffects: HighWindsEffectType[];
  coexistentHazardRefs: string[];
  sourceHazardScreeningRefs: string[];
  disposition: "RETAINED" | "SCREENED";
}

export interface HighWindsHazardCombination extends HighWindsAnalysisRecord {
  primaryHazardType: HighWindsHazardType;
  combinedHazards: string[];
  commonCauseDescription: string;
  temporalRelationship: "COINCIDENT" | "CAUSALLY_RELATED" | "SEQUENTIAL" | "INDEPENDENT";
  affectedPlantLocations: string[];
  affectedSscRefs: string[];
  plantResponseTreatment: string;
  disposition: "RETAINED" | "SCREENED" | "TRANSFERRED";
  destinationElementRefs: string[];
}

export interface HighWindsScreeningConfirmation extends HighWindsAnalysisRecord {
  screeningDecisionRef: string;
  investigationRefs: string[];
  hazardsScreeningRequirementRefs: string[];
  plantConditionBasis: "AS_BUILT_AS_OPERATED" | "AS_DESIGNED_AS_INTENDED";
  confirmed: boolean;
  discrepancies: string[];
  resolution: string;
}

export interface HighWindsHazardScreening {
  hazardCandidates: HighWindsHazardCandidate[];
  hazardCombinations: HighWindsHazardCombination[];
  screeningDecisions: HighWindsScreeningDecision[];
  aggregateScreeningChecks: HighWindsScreeningDecision[];
  confirmations: HighWindsScreeningConfirmation[];
  investigations: HighWindsInvestigation[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface WindDataSource extends HighWindsAnalysisRecord {
  hazardTypes: HighWindsHazardType[];
  sourceType:
    | "ANEMOMETER_STATION"
    | "STORM_EVENT_DATABASE"
    | "TROPICAL_CYCLONE_TRACK_DATABASE"
    | "TORNADO_DATABASE"
    | "REGIONAL_STUDY"
    | "NATIONAL_STANDARD"
    | "SITE_MONITORING"
    | "OTHER";
  agencyOrPublisher: string;
  stationOrDatasetId: string;
  latitudeDegrees?: number;
  longitudeDegrees?: number;
  elevationMetres?: number;
  periodStart: string;
  periodEnd: string;
  samplingInterval: string;
  averagingTimeSeconds?: number;
  measurementHeightMetres?: number;
  exposureDescription: string;
  terrainHistory: string;
  instrumentationHistory: string;
  recordCompleteness: number;
  qualityIssues: string[];
  acceptedUses: string[];
  excludedDataBasis: string;
}

export interface WindDataAdjustment extends HighWindsAnalysisRecord {
  dataSourceRef: string;
  adjustmentTypes: (
    | "GUST_DURATION"
    | "MEASUREMENT_HEIGHT"
    | "TERRAIN_EXPOSURE"
    | "TOPOGRAPHY"
    | "INSTRUMENT_CHANGE"
    | "STATION_RELOCATION"
    | "SAMPLING_FILTER"
    | "HOMOGENIZATION"
  )[];
  inputWindDefinition: string;
  outputWindDefinition: string;
  method: string;
  factorOrEquation: string;
  validationRefs: string[];
  uncertaintyDescription: string;
}

export interface ReferenceWindDefinition extends HighWindsAnalysisRecord {
  hazardType: HighWindsHazardType;
  windParameter: "THREE_SECOND_GUST" | "FASTEST_MILE" | "ONE_MINUTE_MEAN" | "TEN_MINUTE_MEAN" | "OTHER";
  averagingTimeSeconds: number;
  referenceHeightMetres: number;
  terrainExposure: string;
  directionTreatment: string;
  speedUnit: "MPH" | "MPS" | "KPH";
  lowerBoundWindSpeed: number;
  upperAnalysisWindSpeed: number;
  conversionMethod: string;
  shortDurationTreatment: string;
  nationalStandardReference: string;
  deviationsFromStandard: string[];
}

export interface WindDataQualificationCheck extends HighWindsAnalysisRecord {
  dataSourceRef: string;
  checkType: "COMPLETENESS" | "APPLICABILITY" | "HOMOGENEITY" | "INDEPENDENCE" | "OUTLIER" | "CURRENTNESS";
  acceptanceCriteria: string[];
  findings: string[];
  disposition: "ACCEPT" | "ACCEPT_WITH_ADJUSTMENT" | "EXCLUDE";
  adjustmentRefs: string[];
}

export interface HighWindsWindDataAndReferenceBasis {
  dataSources: WindDataSource[];
  dataAdjustments: WindDataAdjustment[];
  referenceWindDefinitions: ReferenceWindDefinition[];
  qualificationChecks: WindDataQualificationCheck[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface WindHazardCurvePoint {
  windSpeed: number;
  meanAnnualExceedanceFrequency: number;
  fifthPercentileAnnualExceedanceFrequency?: number;
  fiftiethPercentileAnnualExceedanceFrequency?: number;
  ninetyFifthPercentileAnnualExceedanceFrequency?: number;
}

export interface StraightWindStationAssessment extends HighWindsAnalysisRecord {
  dataSourceRef: string;
  distanceToSiteKilometres: number;
  climateSimilarity: string;
  exposureRepresentativeness: string;
  adjustedDataRef: string;
  recordYears: number;
  retainedForAnalysis: boolean;
  exclusionBasis: string;
}

export interface StraightWindClimateComponent extends HighWindsAnalysisRecord {
  componentType: "THUNDERSTORM" | "NON_THUNDERSTORM" | "MIXED";
  stationAssessmentRefs: string[];
  classificationMethod: string;
  eventCount: number;
  independentEventDefinition: string;
  thresholdWindSpeed: number;
  omittedEventBasis: string;
}

export interface StraightWindExtremeValueModel extends HighWindsAnalysisRecord {
  climateComponentRef: string;
  distribution: "GUMBEL" | "GENERALIZED_EXTREME_VALUE" | "GENERALIZED_PARETO" | "TWO_DIMENSIONAL_POISSON" | "OTHER";
  fittingMethod: string;
  thresholdSelection: string;
  declusteringMethod: string;
  parameterValues: Record<string, number>;
  goodnessOfFitTests: string[];
  rareEventTailJustification: string;
  samplingUncertaintyTreatment: string;
}

export interface StraightWindPoolingModel extends HighWindsAnalysisRecord {
  stationAssessmentRefs: string[];
  climateComponentRefs: string[];
  poolingMethod: "SUPERSTATION" | "REGIONAL_FREQUENCY" | "WEIGHTED_STATIONS" | "SITE_ONLY" | "OTHER";
  weights: Record<string, number>;
  independenceTreatment: string;
  siteFrequencyDerivation: string;
}

export interface StraightWindHazardResult extends HighWindsAnalysisRecord {
  referenceWindDefinitionRef: string;
  modelRefs: string[];
  poolingModelRef: string;
  curvePoints: WindHazardCurvePoint[];
  benchmarkReferences: string[];
  comparisonFindings: string[];
  significantDifferenceCauses: string[];
}

export interface HighWindsStraightWindHazardAnalysis {
  stationAssessments: StraightWindStationAssessment[];
  climateComponents: StraightWindClimateComponent[];
  extremeValueModels: StraightWindExtremeValueModel[];
  poolingModels: StraightWindPoolingModel[];
  hazardResults: StraightWindHazardResult[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface TropicalCycloneDataSet extends HighWindsAnalysisRecord {
  dataSourceRefs: string[];
  basin: string;
  coastalRegion: string;
  recordStartYear: number;
  recordEndYear: number;
  stormCount: number;
  intensityMeasures: string[];
  trackVariables: string[];
  pressureVariables: string[];
  reportingBiases: string[];
  homogenizationMethod: string;
}

export interface TropicalCycloneOccurrenceModel extends HighWindsAnalysisRecord {
  dataSetRefs: string[];
  annualOccurrenceRate: number;
  intensityDistribution: string;
  genesisModel: string;
  temporalStationarityBasis: string;
  regionalConditioning: string;
  parameterValues: Record<string, number>;
}

export interface TropicalCycloneTrackModel extends HighWindsAnalysisRecord {
  occurrenceModelRef: string;
  modelType: "EMPIRICAL_TRACK" | "SYNTHETIC_TRACK" | "PUBLISHED_HAZARD_MODEL" | "OTHER";
  spatialDomain: string;
  trackVariables: string[];
  translationSpeedTreatment: string;
  landfallTreatment: string;
  validationMetrics: string[];
}

export interface TropicalCycloneWindFieldModel extends HighWindsAnalysisRecord {
  trackModelRef: string;
  windFieldModelName: string;
  centralPressureRelationship: string;
  radiusOfMaximumWindsModel: string;
  boundaryLayerModel: string;
  translationAsymmetryTreatment: string;
  surfaceRoughnessTreatment: string;
  gustConversionTreatment: string;
  inlandDecayModel: string;
  validationRefs: string[];
}

export interface TropicalCycloneSimulation extends HighWindsAnalysisRecord {
  occurrenceModelRef: string;
  trackModelRef: string;
  windFieldModelRef: string;
  simulatedYears: number;
  simulatedStorms: number;
  randomSeedReference: string;
  importanceSamplingMethod: string;
  convergenceMetrics: string[];
  outputDataRefs: string[];
}

export interface TropicalCycloneHazardResult extends HighWindsAnalysisRecord {
  referenceWindDefinitionRef: string;
  simulationRef?: string;
  publishedStudyRef?: string;
  curvePoints: WindHazardCurvePoint[];
  benchmarkReferences: string[];
  comparisonFindings: string[];
  significantDifferenceCauses: string[];
}

export interface HighWindsTropicalCycloneHazardAnalysis {
  dataSets: TropicalCycloneDataSet[];
  occurrenceModels: TropicalCycloneOccurrenceModel[];
  trackModels: TropicalCycloneTrackModel[];
  windFieldModels: TropicalCycloneWindFieldModel[];
  simulations: TropicalCycloneSimulation[];
  hazardResults: TropicalCycloneHazardResult[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface TornadoDataSet extends HighWindsAnalysisRecord {
  dataSourceRefs: string[];
  geographicRegion: string;
  recordStartYear: number;
  recordEndYear: number;
  tornadoCount: number;
  damageRatingScales: ("F_SCALE" | "ENHANCED_FUJITA" | "OTHER")[];
  pathVariables: string[];
  populationBiasDescription: string;
  reportingLimitations: string[];
}

export interface TornadoDataCorrection extends HighWindsAnalysisRecord {
  dataSetRef: string;
  correctionTypes: ("POPULATION_BIAS" | "REPORTING_PRACTICE" | "DAMAGE_SCALE" | "PATH_GEOMETRY" | "DUPLICATE_EVENT" | "OTHER")[];
  affectedYears: string;
  correctionMethod: string;
  beforeEventCount: number;
  afterEventCount: number;
  uncertaintyTreatment: string;
}

export interface TornadoClimatologyRegion extends HighWindsAnalysisRecord {
  dataSetRefs: string[];
  boundaryDescription: string;
  physiographicCharacteristics: string[];
  meteorologicalCharacteristics: string[];
  homogeneityTests: string[];
  sufficientlyBroadForRareEvents: boolean;
  siteRepresentativenessBasis: string;
}

export interface TornadoOccurrenceAndPathModel extends HighWindsAnalysisRecord {
  climatologyRegionRef: string;
  annualOccurrenceRate: number;
  intensityDistribution: string;
  pathLengthModel: string;
  pathWidthModel: string;
  pathDirectionModel: string;
  translationSpeedModel: string;
  intensityAlongPathModel: string;
  intensityAcrossPathModel: string;
  parameterValues: Record<string, number>;
}

export interface TornadoDamageWindModel extends HighWindsAnalysisRecord {
  occurrenceAndPathModelRef: string;
  damageIndicatorTypes: string[];
  degreeOfDamageTreatment: string;
  windSpeedGivenDamageRatingModel: string;
  constructionQualityTreatment: string;
  ratingUncertaintyTreatment: string;
  parameterValues: Record<string, number>;
}

export interface TornadoWindFieldModel extends HighWindsAnalysisRecord {
  damageWindModelRef: string;
  horizontalWindProfile: string;
  verticalWindProfile: string;
  radiusOfMaximumWindsModel: string;
  translationalVelocityTreatment: string;
  rotationalVelocityTreatment: string;
  atmosphericPressureChangeModel: string;
  validationRefs: string[];
}

export interface TornadoTargetDefinition extends HighWindsAnalysisRecord {
  targetType: "POINT" | "INDIVIDUAL_SSC" | "BUILDING" | "POWER_BLOCK" | "MISSILE_GENERATION_AREA" | "OTHER";
  planAreaSquareMetres: number;
  heightMetres: number;
  geometryDescription: string;
  orientationTreatment: string;
  locationRefs: string[];
}

export interface TornadoHazardResult extends HighWindsAnalysisRecord {
  referenceWindDefinitionRef: string;
  occurrenceAndPathModelRef: string;
  windFieldModelRef: string;
  targetDefinitionRef: string;
  curvePoints: WindHazardCurvePoint[];
  pressureEffectIncluded: boolean;
  atmosphericPressureChangeIncluded: boolean;
  missileEffectIncluded: boolean;
  benchmarkReferences: string[];
  comparisonFindings: string[];
  significantDifferenceCauses: string[];
}

export interface HighWindsTornadoHazardAnalysis {
  dataSets: TornadoDataSet[];
  dataCorrections: TornadoDataCorrection[];
  climatologyRegions: TornadoClimatologyRegion[];
  occurrenceAndPathModels: TornadoOccurrenceAndPathModel[];
  damageWindModels: TornadoDamageWindModel[];
  windFieldModels: TornadoWindFieldModel[];
  targetDefinitions: TornadoTargetDefinition[];
  hazardResults: TornadoHazardResult[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface WindHazardLogicTreeBranch extends HighWindsAnalysisRecord {
  hazardType: HighWindsHazardType;
  parentBranchRef?: string;
  branchLevel: string;
  modelOrParameterChoice: string;
  branchWeight: number;
  weightBasis: string;
  affectedHazardResultRefs: string[];
}

export interface WindHazardCurve extends HighWindsAnalysisRecord {
  hazardType: HighWindsHazardType;
  referenceWindDefinitionRef: string;
  sourceHazardResultRefs: string[];
  logicTreeBranchRefs: string[];
  curveType: "MEAN" | "FIFTH_PERCENTILE" | "FIFTIETH_PERCENTILE" | "NINETY_FIFTH_PERCENTILE" | "CONSERVATIVE";
  curvePoints: WindHazardCurvePoint[];
  interpolationMethod: string;
  extrapolationMethod: string;
  truncationBasis: string;
}

export interface WindHazardInterval extends HighWindsAnalysisRecord {
  hazardCurveRef: string;
  hazardType: HighWindsHazardType;
  lowerWindSpeed: number;
  upperWindSpeed: number;
  representativeWindSpeed: number;
  intervalAnnualFrequency: number;
  conditionalWeight: number;
  fragilityEvaluationRefs: string[];
}

export interface WindHazardConvergenceStudy extends HighWindsAnalysisRecord {
  hazardCurveRefs: string[];
  baselineIntervalRefs: string[];
  refinedIntervalCount: number;
  upperWindSpeedTested: number;
  riskMetric: string;
  baselineResult: number;
  refinedResult: number;
  relativeDifference: number;
  contributorRankingStable: boolean;
  converged: boolean;
}

export interface HighWindsHazardIntegration {
  logicTreeBranches: WindHazardLogicTreeBranch[];
  hazardCurves: WindHazardCurve[];
  hazardIntervals: WindHazardInterval[];
  convergenceStudies: WindHazardConvergenceStudy[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export type HighWindsFailureModeType =
  | "FUNCTIONAL_FAILURE"
  | "STRUCTURAL_FAILURE"
  | "ANCHORAGE_FAILURE"
  | "PRESSURE_BOUNDARY_FAILURE"
  | "OVERTURNING"
  | "SLIDING"
  | "BUILDING_ENVELOPE_FAILURE"
  | "BLOCKAGE"
  | "SUBMERGENCE_OR_WETTING"
  | "IMPACT_DAMAGE"
  | "LOSS_OF_SUPPORT"
  | "OTHER";

export interface HighWindsFailureMode extends HighWindsAnalysisRecord {
  failureModeType: HighWindsFailureModeType;
  hazardTypes: HighWindsHazardType[];
  windEffects: HighWindsEffectType[];
  creditedFunction: string;
  failureDefinition: string;
  requiredState: "FUNCTION_DURING_EVENT" | "FUNCTION_AFTER_EVENT" | "MAINTAIN_BOUNDARY" | "OTHER";
  supportingElementRefs: string[];
  systemModelBasicEventRefs: string[];
  eventSequenceRefs: string[];
  fragilityRefs: string[];
  consequenceDescription: string;
}

export type HighWindsEquipmentListInclusionSource =
  | "INTERNAL_EVENTS_SYSTEM_MODEL"
  | "HIGH_WIND_EVENT_SEQUENCE_MODEL"
  | "ADDITIONAL_HIGH_WIND_SSC"
  | "INDUSTRY_HIGH_WIND_EQUIPMENT_LIST"
  | "STRUCTURAL_INTERACTION"
  | "MISSILE_TARGET"
  | "WIND_DRIVEN_RAIN_TARGET"
  | "OPERATOR_ACTION_SUPPORT"
  | "INVESTIGATION_FINDING";

export interface HighWindsEquipmentListEntry extends HighWindsAnalysisRecord {
  sscRef: string;
  sscType: "STRUCTURE" | "SYSTEM" | "COMPONENT" | "SUPPORT" | "BARRIER" | "OPENING" | "ELECTRICAL_EQUIPMENT" | "OTHER";
  componentRef?: string;
  systemRef?: string;
  structureRef?: string;
  parentSscRef?: string;
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  building: string;
  roomOrArea: string;
  elevation: string;
  orientation: string;
  mountingAndSupportDescription: string;
  creditedFunctions: string[];
  inclusionSources: HighWindsEquipmentListInclusionSource[];
  sourceElementRefs: string[];
  applicableHazardTypes: HighWindsHazardType[];
  applicableWindEffects: HighWindsEffectType[];
  failureModes: HighWindsFailureMode[];
  supportingElementRefs: string[];
  correlationGroupRefs: string[];
  investigationRefs: string[];
  fragilityRefs: string[];
  disposition: "ACTIVE" | "SCREENED" | "REMOVED_FROM_MODEL";
  dispositionBasis: string;
}

export interface HighWindsPreliminaryInitiatingEvent extends HighWindsAnalysisRecord {
  initiatingEventRef: string;
  hazardTypes: HighWindsHazardType[];
  causationType: "DIRECT" | "INDIRECT" | "PLANT_SHUTDOWN" | "PROCEDURAL_RECONFIGURATION" | "HUMAN_ACTION";
  initiatingFailureRefs: string[];
  affectedReactorUnitRefs: string[];
  affectedRadioactiveMaterialSourceRefs: string[];
  industryExperienceRefs: string[];
  retainedInModel: boolean;
}

export interface HighWindsPreliminaryModelReview extends HighWindsAnalysisRecord {
  baselineModelRef: string;
  reviewType: "SYSTEM_LOGIC" | "EVENT_SEQUENCE" | "SUCCESS_CRITERIA" | "DATA" | "HRA" | "PEER_REVIEW_FINDING";
  sourceRecordRefs: string[];
  highWindsGap: string;
  requiredChange: string;
  affectedSscRefs: string[];
  closureStatus: "OPEN" | "INCORPORATED" | "NOT_APPLICABLE";
}

export interface HighWindsPreliminaryPlantResponse {
  preliminaryInitiatingEvents: HighWindsPreliminaryInitiatingEvent[];
  modelReviews: HighWindsPreliminaryModelReview[];
  highWindsEquipmentList: HighWindsEquipmentListEntry[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface HighWindsInvestigationFinding extends HighWindsAnalysisRecord {
  investigationRef: string;
  findingType:
    | "SSC_CONFIGURATION"
    | "SUPPORTING_ELEMENT"
    | "SCREENING_CONFIRMATION"
    | "MISSILE_SOURCE"
    | "STRUCTURAL_INTERACTION"
    | "RAIN_ENTRY_PATH"
    | "ACCESS_OR_HUMAN_ACTION"
    | "OTHER";
  location: string;
  affectedSscRefs: string[];
  affectedMissileSourceRefs: string[];
  condition: string;
  modelImpact: string;
  correctiveAction: string;
  closureStatus: "OPEN" | "MODELED" | "RESOLVED";
}

export interface MissileSurveyZone extends HighWindsAnalysisRecord {
  zoneType: "SITE_GROUND" | "BUILDING_ROOF" | "BUILDING_ENVELOPE" | "BUILDING_INTERIOR" | "OUTAGE_LAYDOWN" | "OFFSITE_ADJACENT";
  geometryDescription: string;
  location: string;
  elevationRange: string;
  nearestHwelSscDistanceMetres: number;
  topographyDescription: string;
  shieldingFeatures: string[];
  plantOperatingStateRefs: string[];
  missileSourceRefs: string[];
}

export interface WindMissileSource extends HighWindsAnalysisRecord {
  surveyZoneRef: string;
  sourceCategory:
    | "LOOSE_SITE_MATERIAL"
    | "OUTAGE_MATERIAL"
    | "VEHICLE_OR_TRAILER"
    | "TREE_OR_POLE"
    | "ROOFTOP_EQUIPMENT"
    | "ROOF_GRAVEL_OR_PAVER"
    | "METAL_CLADDING"
    | "PURLIN_OR_GIRT"
    | "BUILDING_CONTENT"
    | "PIPE_OR_STRUCTURAL_SHAPE"
    | "OTHER";
  missileShape: "PLATE" | "ROD" | "COMPACT" | "FLEXIBLE" | "OTHER";
  material: string;
  dimensions: string;
  representativeMassKilograms: number;
  quantityBestEstimate: number;
  quantityLowerBound?: number;
  quantityUpperBound?: number;
  initialElevationMetres: number;
  sourceAreaSquareMetres: number;
  restraintOrReleaseDescription: string;
  applicableHazardTypes: HighWindsHazardType[];
  plantOperatingStateRefs: string[];
  sourceTimeFraction: number;
  targetSscRefs: string[];
}

export interface MissilePopulationProfile extends HighWindsAnalysisRecord {
  plantCondition: "NORMAL_OPERATION" | "PRE_OUTAGE_BUILDUP" | "OUTAGE" | "POST_OUTAGE_CLEANUP" | "CONSTRUCTION" | "OTHER";
  plantOperatingStateRefs: string[];
  annualTimeFraction: number;
  missileSourceRefs: string[];
  populationAdjustmentFactors: Record<string, number>;
  configurationChangeDescription: string;
}

export interface HighWindsPlantInvestigationAndMissileSurvey {
  investigations: HighWindsInvestigation[];
  findings: HighWindsInvestigationFinding[];
  missileSurveyZones: MissileSurveyZone[];
  missileSources: WindMissileSource[];
  missilePopulationProfiles: MissilePopulationProfile[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface HighWindsFragilityMethodSelection extends HighWindsAnalysisRecord {
  sscRefs: string[];
  failureModeRefs: string[];
  hazardTypes: HighWindsHazardType[];
  windEffects: HighWindsEffectType[];
  method: "CODE_BASED" | "NONPARAMETRIC" | "RELIABILITY_ANALYSIS" | "SIMULATION" | "TEST_DATA" | "GENERIC_WITH_SITE_EVALUATION" | "SCREENING" | "OTHER";
  informationBasis: "PLANT_SPECIFIC" | "GENERIC" | "GENERIC_AUGMENTED" | "BOUNDING";
  methodApplicability: string;
  genericInformationRefs: string[];
  plantSpecificInformationRefs: string[];
  representativeFragilityGroupRef?: string;
}

export interface HighWindsFragilityCorrelationGroup extends HighWindsAnalysisRecord {
  memberSscRefs: string[];
  memberFailureModeRefs: string[];
  hazardTypes: HighWindsHazardType[];
  windEffects: HighWindsEffectType[];
  correlationModel: "PERFECT" | "INDEPENDENT" | "PARTIAL" | "CAUSAL_DEPENDENCY";
  correlationCoefficient?: number;
  commonDemandBasis: string;
  constructionSimilarity: string;
  locationAndOrientationSimilarity: string;
  capacitySimilarity: string;
  modelingImplementation: string;
  sensitivityStudyRefs: string[];
}

export interface HighWindsFragilityAggregation extends HighWindsAnalysisRecord {
  sscRef: string;
  componentFragilityRefs: string[];
  failureModeRefs: string[];
  windEffects: HighWindsEffectType[];
  aggregationMethod: string;
  dependencyTreatment: string;
  conservativeBiasDescription: string;
  resultingFragilityRef: string;
}

export interface HighWindsSscScreeningAndFragilityBasis {
  screeningDecisions: HighWindsScreeningDecision[];
  methodSelections: HighWindsFragilityMethodSelection[];
  correlationGroups: HighWindsFragilityCorrelationGroup[];
  fragilityAggregations: HighWindsFragilityAggregation[];
  coexistentHazardAssessments: HighWindsHazardCombination[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface WindFragilityCurvePoint {
  windSpeed: number;
  conditionalFailureProbability: number;
  fifthPercentileFailureProbability?: number;
  ninetyFifthPercentileFailureProbability?: number;
}

export interface WindFragilityCurve extends HighWindsAnalysisRecord {
  sscRef: string;
  failureModeRef: string;
  hazardTypes: HighWindsHazardType[];
  windEffects: HighWindsEffectType[];
  referenceWindDefinitionRef: string;
  methodSelectionRef: string;
  representativeGroupRef?: string;
  medianCapacityWindSpeed: number;
  logarithmicStandardDeviationRandomness: number;
  logarithmicStandardDeviationUncertainty: number;
  curvePoints: WindFragilityCurvePoint[];
  hazardSpecific: boolean;
  crossHazardUseJustification: string;
  applicableWindSpeedRange: string;
  informationSourceRefs: string[];
  correlationGroupRefs: string[];
}

export interface BuildingEnvelopeState extends HighWindsAnalysisRecord {
  structureRef: string;
  state: "ENCLOSED" | "PARTIALLY_ENCLOSED" | "OPEN" | "PROGRESSIVE_FAILURE";
  failedEnvelopeElementRefs: string[];
  openingAreaSquareMetres: number;
  internalPressureCoefficient: number;
  transitionCriteria: string;
  transitionProbabilityModel: string;
}

export interface WindPressureLoadModel extends HighWindsAnalysisRecord {
  sscRef: string;
  failureModeRef: string;
  hazardTypes: HighWindsHazardType[];
  referenceWindDefinitionRef: string;
  codeOrStandardBasis: string;
  designCodeEra: string;
  currentCodeComparison: string;
  externalPressureCoefficients: Record<string, number>;
  envelopeStateRefs: string[];
  internalPressureTreatment: string;
  directionalityFactor: number;
  gustEffectFactor: number;
  topographicFactor: number;
  shieldingFactor: number;
  negativeShieldingFactor: number;
  flexibleStructure: boolean;
  fundamentalFrequencyHertz?: number;
  dynamicResponseTreatment: string;
  loadCombinations: string[];
  demandCalculationRefs: string[];
}

export interface AtmosphericPressureChangeLoadModel extends HighWindsAnalysisRecord {
  sscRef: string;
  failureModeRef: string;
  tornadoWindFieldModelRef: string;
  pressureDropPascals: number;
  pressureChangeRatePascalsPerSecond: number;
  radiusOfMaximumWindsMetres: number;
  tornadoTranslationSpeedMetresPerSecond: number;
  backgroundLeakageAreaSquareMetres: number;
  envelopeFailureRefs: string[];
  internalPressureResponseMethod: string;
  combinedWindAndApcLoadMethod: string;
  demandCalculationRefs: string[];
}

export interface TopographyAndShieldingAssessment extends HighWindsAnalysisRecord {
  siteArea: string;
  affectedSscRefs: string[];
  topographicFeature: string;
  speedUpMethod: string;
  speedUpFactor: number;
  surroundingStructureRefs: string[];
  shieldingDirections: string[];
  negativeShieldingDirections: string[];
  windTunnelOrCfdRefs: string[];
  engineeringJudgmentBasis: string;
}

export interface HighWindsPressureAndApcFragilityAnalysis {
  buildingEnvelopeStates: BuildingEnvelopeState[];
  pressureLoadModels: WindPressureLoadModel[];
  atmosphericPressureChangeModels: AtmosphericPressureChangeLoadModel[];
  topographyAndShieldingAssessments: TopographyAndShieldingAssessment[];
  fragilityCurves: WindFragilityCurve[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface MissileCategory extends HighWindsAnalysisRecord {
  missileSourceRefs: string[];
  missileShape: "PLATE" | "ROD" | "COMPACT" | "FLEXIBLE" | "OTHER";
  material: string;
  representativeDimensions: string;
  representativeMassKilograms: number;
  quantityDistribution: string;
  releaseWindSpeedDistribution: string;
  applicableHazardTypes: HighWindsHazardType[];
}

export interface MissileTargetModel extends HighWindsAnalysisRecord {
  sscRef: string;
  failureModeRef: string;
  targetGeometry: string;
  targetAreaSquareMetres: number;
  targetVolumeCubicMetres?: number;
  targetElevationMetres: number;
  targetOrientation: string;
  openingAndLineOfSightDescription: string;
  shieldingStructureRefs: string[];
  ricochetSurfaceRefs: string[];
  damageModes: string[];
}

export interface MissileTrajectoryModel extends HighWindsAnalysisRecord {
  hazardType: HighWindsHazardType;
  windFieldModelRef: string;
  missileCategoryRefs: string[];
  sourceZoneRefs: string[];
  sourceDistanceCutoffMetres: number;
  sourceDistanceCutoffBasis: string;
  spatialDimension: "TWO_DIMENSIONAL" | "THREE_DIMENSIONAL";
  siteSpecificFeaturesCaptured: string[];
  injectionModel: string;
  aerodynamicCoefficientModel: string;
  trajectoryIntegrationMethod: string;
  timeStepSeconds: number;
  verticalWindTreatment: string;
  shieldingTreatment: string;
  ricochetTreatment: string;
  multipleMissileTreatment: string;
  simulationCount: number;
  randomSeedReference: string;
}

export interface MissileImpactAndDamageModel extends HighWindsAnalysisRecord {
  targetModelRef: string;
  trajectoryModelRefs: string[];
  missileCategoryRefs: string[];
  hitCriterion: string;
  damageCriterion: string;
  impactVelocityTreatment: string;
  penetrationMethod: string;
  perforationMethod: string;
  spallMethod: string;
  localDamageMethod: string;
  nonlinearAnalysisRefs: string[];
  probabilityOfHit: number;
  probabilityOfDamageGivenHit: number;
  multipleSscCorrelationTreatment: string;
  scalingMethod: string;
  scalingJustification: string;
}

export interface MissileSimulationConvergenceStudy extends HighWindsAnalysisRecord {
  trajectoryModelRef: string;
  impactAndDamageModelRefs: string[];
  windSpeeds: number[];
  missilePopulationSize: number;
  simulationCounts: number[];
  meanFragilityEstimates: number[];
  standardErrors: number[];
  convergenceCriterion: string;
  converged: boolean;
}

export interface HighWindsMissileFragilityAnalysis {
  missileCategories: MissileCategory[];
  targetModels: MissileTargetModel[];
  trajectoryModels: MissileTrajectoryModel[];
  impactAndDamageModels: MissileImpactAndDamageModel[];
  convergenceStudies: MissileSimulationConvergenceStudy[];
  fragilityCurves: WindFragilityCurve[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface StructuralInteractionScenario extends HighWindsAnalysisRecord {
  sourceStructureRef: string;
  sourceFailureModeRef: string;
  targetSscRefs: string[];
  hazardTypes: HighWindsHazardType[];
  interactionType: "COLLAPSE" | "FALLING_OBJECT" | "ADJACENT_STRUCTURE_CONTACT" | "DEBRIS_BLOCKAGE" | "OTHER";
  spatialGeometry: string;
  sourceFragilityRef: string;
  conditionalTargetDamageModel: string;
  affectedFunctions: string[];
  plantResponseModelRefs: string[];
}

export interface RainEntryPath extends HighWindsAnalysisRecord {
  structureRef: string;
  envelopeElementRef: string;
  entryPathType: "ROOF" | "ROOF_DRAIN" | "DOOR" | "WINDOW" | "VENT" | "LOUVER" | "CLADDING" | "PENETRATION" | "OTHER";
  initiatingEnvelopeFailureRef?: string;
  location: string;
  openingAreaSquareMetres: number;
  interiorTransportPath: string;
  targetSscRefs: string[];
  dripSplashOrDepositionModes: string[];
  drainageAndProtectionFeatures: string[];
}

export interface WindDrivenRainModel extends HighWindsAnalysisRecord {
  hazardTypes: HighWindsHazardType[];
  referenceWindDefinitionRef: string;
  rainIntensityModel: string;
  dropSizeDistributionModel: string;
  terminalVelocityModel: string;
  windFieldModelRef: string;
  buildingAerodynamicTreatment: string;
  depositionOrIngressMethod: string;
  entryPathRefs: string[];
  durationModel: string;
  validationRefs: string[];
}

export interface RainTargetVulnerability extends HighWindsAnalysisRecord {
  sscRef: string;
  rainEntryPathRefs: string[];
  environmentalQualification: string;
  enclosureRating: string;
  failureThreshold: string;
  leakageRateModel: string;
  timeToFailureModel: string;
  functionalFailureModeRef: string;
  fragilityRef: string;
}

export interface HighWindsInteractionAndRainFragilityAnalysis {
  structuralInteractionScenarios: StructuralInteractionScenario[];
  rainEntryPaths: RainEntryPath[];
  windDrivenRainModels: WindDrivenRainModel[];
  rainTargetVulnerabilities: RainTargetVulnerability[];
  fragilityCurves: WindFragilityCurve[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface HighWindsPeerReviewDisposition extends HighWindsAnalysisRecord {
  sourcePraElement: string;
  findingId: string;
  findingText: string;
  relevanceToHighWinds: string;
  disposition: string;
  affectedModelRefs: string[];
  closureEvidenceRefs: string[];
  closureStatus: "OPEN" | "INCORPORATED" | "NOT_RELEVANT" | "CLOSED";
}

export interface HighWindsInitiatingEventModel extends HighWindsAnalysisRecord {
  initiatingEventRef: string;
  hazardTypes: HighWindsHazardType[];
  causationType: "DIRECT" | "INDIRECT" | "PLANT_SHUTDOWN" | "PROCEDURAL_RECONFIGURATION" | "HUMAN_ACTION";
  inducingSscFailureRefs: string[];
  inducingHumanActionRefs: string[];
  affectedReactorUnitRefs: string[];
  affectedRadioactiveMaterialSourceRefs: string[];
  industryExperienceRefs: string[];
  baselineFrequencyTreatment: string;
  modelImplementation: string;
}

export interface HighWindsEventSequenceModel extends HighWindsAnalysisRecord {
  sourceEventSequenceRef?: string;
  initiatingEventRefs: string[];
  hazardTypes: HighWindsHazardType[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  sequenceEndStates: string[];
  eventSequenceFamilyRefs: string[];
  modelChanges: string[];
  multiReactorOrMultiSource: boolean;
  coexistentHazardRefs: string[];
  missionTimeRef: string;
  modelLogicRefs: string[];
}

export interface HighWindsSuccessCriterion extends HighWindsAnalysisRecord {
  sourceSuccessCriterionRef?: string;
  eventSequenceRefs: string[];
  safetyFunction: string;
  criterion: string;
  highWindsChange: string;
  analysisRefs: string[];
}

export interface HighWindsSystemModelModification extends HighWindsAnalysisRecord {
  systemRef: string;
  sourceModelRef: string;
  affectedBasicEventRefs: string[];
  highWindsFailureModeRefs: string[];
  fragilityRefs: string[];
  correlationGroupRefs: string[];
  randomFailureTreatment: string;
  unavailabilityTreatment: string;
  beneficialFailureTreatment: string;
  modificationDescription: string;
  newLogicRefs: string[];
}

export interface HighWindsMissionTime extends HighWindsAnalysisRecord {
  hazardTypes: HighWindsHazardType[];
  eventSequenceRefs: string[];
  missionTimeHours: number;
  stableEndState: string;
  offsitePowerRecoveryModel: string;
  highWindsDurationBasis: string;
  industryExperienceRefs: string[];
  boundingOrRealistic: "BOUNDING" | "REALISTIC";
}

export interface HighWindsDataParameter extends HighWindsAnalysisRecord {
  parameterRef: string;
  parameterType: "RANDOM_FAILURE" | "COMMON_CAUSE_FAILURE" | "UNAVAILABILITY" | "RECOVERY" | "MISSION_TIME" | "OTHER";
  sourceDataRef: string;
  highWindsContextChange: string;
  meanValue: number;
  uncertaintyDistribution: string;
  modelBasicEventRefs: string[];
}

export interface HighWindsMultiUnitAssessment extends HighWindsAnalysisRecord {
  affectedReactorUnitRefs: string[];
  affectedRadioactiveMaterialSourceRefs: string[];
  sharedSscRefs: string[];
  sharedResourceRefs: string[];
  organizationalResponseEffects: string[];
  siteAccessibilityEffects: string[];
  commonCauseFailureTreatment: string;
  eventSequenceRefs: string[];
}

export interface HighWindsPlantResponseModel {
  peerReviewDispositions: HighWindsPeerReviewDisposition[];
  initiatingEventModels: HighWindsInitiatingEventModel[];
  eventSequenceModels: HighWindsEventSequenceModel[];
  successCriteria: HighWindsSuccessCriterion[];
  systemModelModifications: HighWindsSystemModelModification[];
  missionTimes: HighWindsMissionTime[];
  dataParameters: HighWindsDataParameter[];
  coexistentHazardAssessments: HighWindsHazardCombination[];
  multiUnitAssessments: HighWindsMultiUnitAssessment[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface HighWindsHumanAction extends HighWindsAnalysisRecord {
  sourceHumanActionRef?: string;
  actionType: "PREPARATORY" | "RESPONSE" | "RECOVERY";
  hazardTypes: HighWindsHazardType[];
  actionLocation: "CONTROL_ROOM" | "LOCAL_INDOOR" | "LOCAL_OUTDOOR" | "REMOTE" | "OTHER";
  cue: string;
  procedureRefs: string[];
  requiredEquipmentRefs: string[];
  affectedFunctionRefs: string[];
  warningTimeAvailableMinutes: number;
  timeAvailableMinutes: number;
  nominalExecutionTimeMinutes: number;
  highWindsExecutionTimeMinutes: number;
  feasibilityBasis: string;
}

export interface HighWindsHumanFailureEvent extends HighWindsAnalysisRecord {
  humanActionRef: string;
  sourceHfeRef?: string;
  eventSequenceRefs: string[];
  systemTrainOrComponentLevel: string;
  failureDescription: string;
  dependencyGroupRefs: string[];
  modelBasicEventRefs: string[];
  exclusiveRecovery: boolean;
}

export interface HighWindsPerformanceContext extends HighWindsAnalysisRecord {
  humanActionRef: string;
  hazardTypes: HighWindsHazardType[];
  warningAndDurationDescription: string;
  workloadAndStress: string;
  weatherAndEnvironment: string;
  lightingAndHabitability: string;
  debrisAndAccess: string;
  doorwayAndEgressCondition: string;
  staffingAndCommunications: string;
  cueAvailability: string;
  trainingAndJobAids: string;
  physicalHazardToPersonnel: string;
  competingMultiUnitDemands: string;
}

export interface HighWindsHepEstimate extends HighWindsAnalysisRecord {
  humanFailureEventRef: string;
  performanceContextRef: string;
  method: string;
  nominalHep: number;
  highWindsHep: number;
  lowerBoundHep?: number;
  upperBoundHep?: number;
  timingMarginMinutes: number;
  dependencyAdjustment: number;
  recoveryCredit: boolean;
  uncertaintyDistribution: string;
}

export interface HighWindsHumanActionConfirmation extends HighWindsAnalysisRecord {
  humanActionRefs: string[];
  confirmationType: "PROCEDURE_REVIEW" | "OPERATOR_INTERVIEW" | "TALK_THROUGH" | "TABLETOP" | "SIMULATION";
  participantRoles: string[];
  confirmedProcedureInterpretation: boolean;
  timingFindings: string[];
  feasibilityFindings: string[];
  modelChanges: string[];
}

export interface HighWindsRecoveryAssessment extends HighWindsAnalysisRecord {
  humanActionRef: string;
  sourceRecoveryModelRef: string;
  remainsValidUnderHighWinds: boolean;
  invalidatingConditions: string[];
  adjustedRecoveryModel: string;
  recoveryValue: number;
  procedureAndConditionBasis: string;
}

export interface HighWindsHraDependencyAssessment extends HighWindsAnalysisRecord {
  humanFailureEventRefs: string[];
  sharedCues: string[];
  sharedCrews: string[];
  sharedLocations: string[];
  temporalRelationship: string;
  hazardCommonalities: string[];
  dependencyLevel: "ZERO" | "LOW" | "MODERATE" | "HIGH" | "COMPLETE";
  jointProbabilityTreatment: string;
}

export interface HighWindsHumanReliabilityAnalysis {
  humanActions: HighWindsHumanAction[];
  humanFailureEvents: HighWindsHumanFailureEvent[];
  performanceContexts: HighWindsPerformanceContext[];
  hepEstimates: HighWindsHepEstimate[];
  confirmations: HighWindsHumanActionConfirmation[];
  recoveryAssessments: HighWindsRecoveryAssessment[];
  dependencyAssessments: HighWindsHraDependencyAssessment[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface HighWindsQuantificationRun extends HighWindsAnalysisRecord {
  modelVersion: string;
  calculationDate: string;
  hazardTypes: HighWindsHazardType[];
  hazardCurveRefs: string[];
  hazardIntervalRefs: string[];
  fragilityRefs: string[];
  plantResponseModelRefs: string[];
  humanFailureEventRefs: string[];
  calculationMethod: string;
  rareEventApproximationTreatment: string;
  highFailureProbabilityTreatment: string;
  truncationLevel: number;
  uncertaintySampleCount: number;
  randomSeedReference: string;
  softwareAndVersion: string;
}

export interface HighWindsHazardIntervalResult extends HighWindsAnalysisRecord {
  quantificationRunRef: string;
  hazardIntervalRef: string;
  hazardType: HighWindsHazardType;
  eventSequenceFamilyRef: string;
  intervalFrequencyPerPlantYear: number;
  conditionalSequenceProbability: number;
  sequenceFrequencyPerPlantYear: number;
  dominantFragilityRefs: string[];
  dominantBasicEventRefs: string[];
}

export interface HighWindsEventSequenceFamilyResult extends HighWindsAnalysisRecord {
  quantificationRunRef: string;
  eventSequenceFamilyRef: string;
  eventSequenceRefs: string[];
  hazardTypes: HighWindsHazardType[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  releaseCategoryRefs: string[];
  meanFrequencyPerPlantYear: number;
  pointEstimateFrequencyPerPlantYear: number;
  fifthPercentileFrequencyPerPlantYear?: number;
  fiftiethPercentileFrequencyPerPlantYear?: number;
  ninetyFifthPercentileFrequencyPerPlantYear?: number;
  dominantContributorRefs: string[];
}

export interface HighWindsQuantificationConvergenceStudy extends HighWindsAnalysisRecord {
  quantificationRunRefs: string[];
  studyType: "HAZARD_BINNING" | "UPPER_WIND_TRUNCATION" | "CUTSET_TRUNCATION" | "MONTE_CARLO_SAMPLE_SIZE" | "MISSILE_SIMULATION";
  testedValues: number[];
  resultingRiskMetrics: number[];
  maximumRelativeDifference: number;
  contributorRankingStable: boolean;
  acceptanceCriterion: string;
  converged: boolean;
}

export interface HighWindsIntegratedUncertaintyResult extends HighWindsAnalysisRecord {
  quantificationRunRef: string;
  riskMetric: string;
  meanValue: number;
  standardDeviation: number;
  fifthPercentile: number;
  fiftiethPercentile: number;
  ninetyFifthPercentile: number;
  hazardUncertaintyRefs: string[];
  fragilityUncertaintyRefs: string[];
  plantResponseUncertaintyRefs: string[];
  importanceMeasures: Record<string, number>;
}

export interface HighWindsRiskContributor extends HighWindsAnalysisRecord {
  quantificationRunRef: string;
  contributorType: "HAZARD_TYPE" | "WIND_INTERVAL" | "SSC" | "FAILURE_MODE" | "MISSILE_SOURCE" | "HFE" | "EVENT_SEQUENCE" | "EVENT_SEQUENCE_FAMILY";
  contributorRef: string;
  riskMetric: string;
  absoluteContribution: number;
  fractionalContribution: number;
  rank: number;
}

export interface HighWindsEventSequenceQuantification {
  quantificationRuns: HighWindsQuantificationRun[];
  hazardIntervalResults: HighWindsHazardIntervalResult[];
  eventSequenceFamilyResults: HighWindsEventSequenceFamilyResult[];
  convergenceStudies: HighWindsQuantificationConvergenceStudy[];
  uncertaintyResults: HighWindsIntegratedUncertaintyResult[];
  riskContributors: HighWindsRiskContributor[];
  screeningDecisions: HighWindsScreeningDecision[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface HighWindsRiskInsight extends HighWindsAnalysisRecord {
  insightType: "DOMINANT_CONTRIBUTOR" | "DEFENSE_IN_DEPTH" | "MODEL_LIMITATION" | "UNCERTAINTY" | "DESIGN_OPPORTUNITY" | "PROCEDURAL_OPPORTUNITY";
  contributorRefs: string[];
  affectedRiskMetric: string;
  fractionalContribution?: number;
  decisionImplication: string;
}

export interface HighWindsModelRefinement extends HighWindsAnalysisRecord {
  technicalArea: "HAZARD" | "HWEL" | "INVESTIGATION" | "FRAGILITY" | "MISSILE" | "RAIN" | "PLANT_RESPONSE" | "HRA" | "QUANTIFICATION";
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

export interface HighWindsRefinementIteration extends HighWindsAnalysisRecord {
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

export interface HighWindsRiskIntegrationResult extends HighWindsAnalysisRecord {
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

export interface HighWindsRiskDecision extends HighWindsAnalysisRecord {
  decisionType: "DESIGN" | "PROCEDURE" | "CONFIGURATION_CONTROL" | "MISSILE_CONTROL" | "MONITORING" | "DATA_COLLECTION" | "MODEL_CONTROL";
  driverRefs: string[];
  affectedSscRefs: string[];
  action: string;
  duePhase: string;
  disposition: "IMPLEMENT" | "MONITOR" | "CONFIRM_PRE_OPERATIONAL" | "RETAIN_CURRENT_BASIS" | "FORWARD_TO_PLANT_PROCESS";
  verificationRefs: string[];
  reanalysisRequired: boolean;
  riskIntegrationResultRef: string;
}

export interface HighWindsRiskTraceabilityPath extends HighWindsAnalysisRecord {
  evidenceRefs: string[];
  hazardDataRefs: string[];
  hazardCurveRefs: string[];
  highWindsEquipmentListRefs: string[];
  investigationRefs: string[];
  fragilityRefs: string[];
  initiatingEventRefs: string[];
  humanFailureEventRefs: string[];
  eventSequenceFamilyRefs: string[];
  resultRefs: string[];
  decisionRefs: string[];
  complete: boolean;
}

export interface HighWindsControlledBaseline extends HighWindsAnalysisRecord {
  modelVersion: string;
  quantificationRunRef: string;
  reportRef: string;
  configurationControlRecordId: string;
  peerReviewRef: string;
  packageManifestRefs: string[];
  unresolvedLimitations: string[];
  releaseStatus: "WORKING" | "CONTROLLED" | "SUPERSEDED";
}

export interface HighWindsRiskInterpretation {
  riskInsights: HighWindsRiskInsight[];
  refinementActions: HighWindsModelRefinement[];
  quantificationIterations: HighWindsRefinementIteration[];
  integrationResults: HighWindsRiskIntegrationResult[];
  riskDecisions: HighWindsRiskDecision[];
  traceabilityPaths: HighWindsRiskTraceabilityPath[];
  controlledBaselines: HighWindsControlledBaseline[];
  stoppingCriteria: {
    maximumAggregateFrequencyChange: number;
    maximumFamilyFrequencyChange: number;
    maximumContributorRankShift: number;
    requiredStableIterations: number;
    requireNoNewRiskSignificantContributors: boolean;
    basis: string;
  };
}

export interface HighWindsPeerReviewTeamMember extends HighWindsAnalysisRecord {
  role: "TEAM_LEAD" | "SYSTEMS_ENGINEER" | "WIND_HAZARD_SPECIALIST" | "FRAGILITY_SPECIALIST" | "HRA_SPECIALIST" | "QUANTIFICATION_SPECIALIST" | "OTHER";
  organization: string;
  independenceStatement: string;
  qualifications: string[];
  experience: string[];
  reviewScope: string[];
}

export interface HighWindsPeerReviewFinding extends HighWindsAnalysisRecord {
  reviewArea: "WHA" | "WFR" | "WPR" | "INVESTIGATION" | "QUANTIFICATION" | "DOCUMENTATION";
  requirementRefs: string[];
  findingCategory: "FACT_AND_OBSERVATION" | "SUGGESTION" | "BEST_PRACTICE" | "COMMENT";
  significance: "LOW" | "MEDIUM" | "HIGH";
  condition: string;
  consequence: string;
  recommendation: string;
  resolution: string;
  closureEvidenceRefs: string[];
  closureStatus: "OPEN" | "PROPOSED_RESOLUTION" | "CLOSED";
}

export interface HighWindsTechnicalClosure {
  conformanceReviews: HighWindsAnalysisRecord[];
  documentationChecks: HighWindsAnalysisRecord[];
  interfaceClosureChecks: HighWindsAnalysisRecord[];
  peerReviewTeam: HighWindsPeerReviewTeamMember[];
  peerReviewFindings: HighWindsPeerReviewFinding[];
  readinessChecks: HighWindsAnalysisRecord[];
  modelUncertainties: HighWindsModelUncertainty[];
  preOperationalAssumptions: HighWindsPreOperationalAssumption[];
  documentation: HighWindsProcessDocumentation;
}

export interface HighWindsWorkflowRecord extends HighWindsAnalysisRecord {
  workflowRecordType: "REPORT_SECTION" | "QUALITY_CHECK" | "REVIEW_ASSIGNMENT" | "REVIEW_FINDING" | "APPROVAL_READINESS" | "APPROVAL_SIGNATURE";
  discipline: string;
  assignee: string;
  dueDate?: string;
  result: string;
  verificationRefs: string[];
}

export interface HighWindsPraWorkflow {
  reportSections: HighWindsWorkflowRecord[];
  draftQualityChecks: HighWindsWorkflowRecord[];
  reviewAssignments: HighWindsWorkflowRecord[];
  reviewFindings: HighWindsWorkflowRecord[];
  approvalReadiness: HighWindsWorkflowRecord[];
  approvalSignatures: HighWindsWorkflowRecord[];
}

export interface HighWindsPraDocumentation {
  overallProcessDescription: string;
  analysisBasisSummary: string;
  hazardScreeningSummary: string;
  windDataSummary: string;
  straightWindHazardSummary: string;
  tropicalCycloneHazardSummary: string;
  tornadoHazardSummary: string;
  hazardIntegrationSummary: string;
  highWindsEquipmentListSummary: string;
  investigationSummary: string;
  fragilitySummary: string;
  plantResponseSummary: string;
  humanReliabilitySummary: string;
  quantificationSummary: string;
  riskInsights: string;
  uncertaintySummary: string;
  configurationControlDescription: string;
  peerReviewScope: string;
  supportingDocumentRefs: string[];
}

export interface HighWindsPraExampleDocument {
  id: string;
  name: string;
  kind: "doc" | "sheet" | "image";
  sizeLabel: string;
  uploadedLabel: string;
  extracted: string;
  linked: number;
  url?: string;
}

export interface HighWindsPRA extends TechnicalElement<TechnicalElementTypes.HIGH_WINDS_PRA> {
  praScope: string;
  analysisBasis: HighWindsAnalysisBasis;
  hazardScreening: HighWindsHazardScreening;
  windDataAndReferenceBasis: HighWindsWindDataAndReferenceBasis;
  straightWindHazardAnalysis: HighWindsStraightWindHazardAnalysis;
  tropicalCycloneHazardAnalysis: HighWindsTropicalCycloneHazardAnalysis;
  tornadoHazardAnalysis: HighWindsTornadoHazardAnalysis;
  hazardIntegration: HighWindsHazardIntegration;
  preliminaryPlantResponse: HighWindsPreliminaryPlantResponse;
  plantInvestigationAndMissileSurvey: HighWindsPlantInvestigationAndMissileSurvey;
  sscScreeningAndFragilityBasis: HighWindsSscScreeningAndFragilityBasis;
  pressureAndApcFragilityAnalysis: HighWindsPressureAndApcFragilityAnalysis;
  missileFragilityAnalysis: HighWindsMissileFragilityAnalysis;
  interactionAndRainFragilityAnalysis: HighWindsInteractionAndRainFragilityAnalysis;
  plantResponseModel: HighWindsPlantResponseModel;
  humanReliabilityAnalysis: HighWindsHumanReliabilityAnalysis;
  eventSequenceQuantification: HighWindsEventSequenceQuantification;
  integratedUncertainties: HighWindsModelUncertainty[];
  riskInterpretation: HighWindsRiskInterpretation;
  technicalClosure: HighWindsTechnicalClosure;
  workflow: HighWindsPraWorkflow;
  documentation: HighWindsPraDocumentation;
  configurationControlRecordId?: string;
  exampleDocuments?: HighWindsPraExampleDocument[];
  newlyDevelopedMethodIds?: string[];
}

export type HighWindsWorkbookSubelement = "INTEGRATED" | "WHA" | "WFR" | "WPR" | "WORKFLOW";

export interface HighWindsStepDefinition {
  id: string;
  number: string;
  label: string;
  title: string;
  subtitle: string;
  subelement: HighWindsWorkbookSubelement;
}

export const HIGH_WINDS_STEP_DEFINITIONS: HighWindsStepDefinition[] = [
  { id: "analysis-basis", number: "01", label: "Analysis basis", subelement: "INTEGRATED", title: "Analysis basis, scope, and interfaces", subtitle: "Define the site basis, plant stage, PRA applications, analysis boundary, baseline model, evidence, and technical-element interfaces." },
  { id: "hazard-screening", number: "02", label: "Hazard screening", subelement: "WHA", title: "High-wind hazard identification and screening", subtitle: "Identify and screen straight winds, tropical cyclones, tornadoes, coexistent hazards, and applicable wind effects." },
  { id: "wind-data", number: "03", label: "Wind data", subelement: "WHA", title: "Wind data and reference wind basis", subtitle: "Qualify meteorological data and establish consistent wind definitions, conversions, lower bounds, and analysis limits." },
  { id: "straight-wind", number: "04", label: "Straight wind", subelement: "WHA", title: "Straight-wind hazard analysis", subtitle: "Develop site straight-wind frequencies from representative stations and justified extreme-value methods." },
  { id: "tropical-cyclone", number: "05", label: "Tropical cyclone", subelement: "WHA", title: "Tropical-cyclone hazard analysis", subtitle: "Model storm occurrence, tracks, intensity, wind fields, pressure relationships, inland decay, and site frequencies." },
  { id: "tornado", number: "06", label: "Tornado", subelement: "WHA", title: "Tornado hazard analysis", subtitle: "Model regional climatology, reporting bias, paths, intensity variation, wind fields, targets, and site frequencies." },
  { id: "hazard-integration", number: "07", label: "Hazard results", subelement: "WHA", title: "Hazard curves, discretization, and uncertainty", subtitle: "Produce controlled hazard curves and intervals, propagate uncertainty, and demonstrate bin and upper-tail convergence." },
  { id: "preliminary-response", number: "08", label: "HWEL", subelement: "WPR", title: "Preliminary plant response and HWEL development", subtitle: "Use the baseline PRA to identify wind-induced initiators, SSCs, supporting elements, and failure modes for fragility analysis." },
  { id: "investigation", number: "09", label: "Investigation", subelement: "WFR", title: "Plant investigation and missile survey", subtitle: "Confirm plant conditions and inventory site, structural, rooftop, normal-operation, and outage missile sources." },
  { id: "fragility-basis", number: "10", label: "Fragility basis", subelement: "WFR", title: "SSC effect screening and fragility basis", subtitle: "Screen every HWEL SSC by hazard, effect, and failure mode and select justified fragility and correlation methods." },
  { id: "pressure-apc", number: "11", label: "Pressure and APC", subelement: "WFR", title: "Wind pressure and APC fragilities", subtitle: "Evaluate wind pressure, enclosure changes, atmospheric pressure change, dynamics, topography, and shielding." },
  { id: "missile-fragility", number: "12", label: "Missile fragility", subelement: "WFR", title: "Wind-generated missile fragilities", subtitle: "Model missile populations, trajectories, impacts, damage, spatial effects, correlations, and numerical convergence." },
  { id: "interaction-rain", number: "13", label: "Interaction and rain", subelement: "WFR", title: "Structural interaction and wind-driven rain fragilities", subtitle: "Evaluate collapsing structures, rain-entry paths, interior transport, exposed targets, and conditional failures." },
  { id: "plant-response", number: "14", label: "Plant response", subelement: "WPR", title: "High-wind initiating events and plant response", subtitle: "Finalize hazard-specific initiating events, sequences, system logic, mission times, correlations, and multi-unit effects." },
  { id: "human-reliability", number: "15", label: "Human reliability", subelement: "WPR", title: "High-wind human reliability analysis", subtitle: "Evaluate preparatory, response, and recovery actions under hazard-specific warning, duration, access, and workload conditions." },
  { id: "quantification", number: "16", label: "Quantification", subelement: "WPR", title: "Event-sequence quantification and convergence", subtitle: "Integrate hazard, fragility, plant response, and HRA and demonstrate stable, numerically valid plant-year results." },
  { id: "risk-interpretation", number: "17", label: "Risk interpretation", subelement: "INTEGRATED", title: "Uncertainty, sensitivity, and risk interpretation", subtitle: "Rank contributors, integrate uncertainty, refine the model, record decisions, and establish stable risk insights." },
  { id: "technical-closure", number: "18", label: "Technical closure", subelement: "INTEGRATED", title: "Documentation, conformance, and peer-review readiness", subtitle: "Complete traceability, conformance, interfaces, technical checks, peer-review scope, findings, and readiness evidence." },
  { id: "draft", number: "19", label: "Draft", subelement: "WORKFLOW", title: "Produce the draft", subtitle: "Generate and verify the controlled High Winds PRA report and supporting analysis package." },
  { id: "review", number: "20", label: "Review", subelement: "WORKFLOW", title: "Review and resolve findings", subtitle: "Perform technical and independent peer review and resolve findings with traceable evidence." },
  { id: "approval", number: "21", label: "Approval", subelement: "WORKFLOW", title: "Approve and control the baseline", subtitle: "Confirm readiness, obtain approval, and release the configuration-controlled High Winds PRA baseline." },
];

export const WHA_SR_CATALOG = createHighWindsSrCatalog("WHA", {
  A: [
    "Identify the specific reactor site or describe and justify a bounding site that bounds every site within the PRA scope.",
    "Compile every applicable high-wind hazard and combination of wind hazards for the site.",
    "Collect current site and regional information used for high-wind hazard screening.",
    "Screen straight winds only by demonstrating compliance with SCR-1 or SCR-2 through a conservative or fully compliant realistic assessment.",
    "Screen tropical-cyclone winds only by the 150-mile coastal SCR-3 criterion or by a conservative or fully compliant realistic SCR-1 or SCR-2 assessment.",
    "Screen tornado winds only by a justified regional SCR-3 exclusion or by a conservative or fully compliant realistic SCR-1 or SCR-2 assessment.",
    "Demonstrate that the aggregate frequency of all probabilistically screened high-wind event-sequence families meets SCR-2 or justify alternate criteria.",
    "Confirm screening against as-built/as-operated or as-designed/as-intended conditions through investigation and satisfy HLR-HS-C and HLR-HS-D for quantitative screening.",
  ],
  B: [
    "Define the reference wind-speed parameters for every retained hazard and justify deviations from the applicable national wind-loading standard.",
    "Apply currently accepted conversion methods when deriving reference wind speeds from raw data.",
    "Include short-duration phenomena such as thunderstorms and tornadoes when deriving wind-speed frequencies.",
    "Specify a lower-bound wind speed that captures potential damage to SSCs on the HWEL.",
    "Discretize each hazard curve sufficiently to determine wind frequency and plant response over the full analyzed wind-speed range.",
    "Extend each hazard curve to sufficiently large wind speeds that truncation does not affect numerical results or contributor rankings.",
  ],
  C: [
    "Identify nearby anemometer stations and evaluate the applicability and quality of each station record.",
    "Update station data to the defined reference wind speed before analysis.",
    "Analyze mixed straight-wind data for CC-I or separately analyze and combine thunderstorm and non-thunderstorm frequencies for CC-II.",
    "Justify the probability distribution used for rare straight-wind phenomena.",
    "Justify the method used to derive site-specific straight-wind frequencies from one or more station records.",
    "Compare straight-wind frequencies and uncertainties with current published information and explain significant differences.",
  ],
  D: [
    "Develop site-specific tropical-cyclone frequencies from a qualified published source or a probabilistic model containing frequency, intensity, tracks, wind field, pressure relationship, and inland decay.",
    "Compare tropical-cyclone frequencies and uncertainties with current published information and explain significant differences.",
  ],
  E: [
    "Develop site-specific tornado frequencies from a qualified published source or a compliant probabilistic tornado hazard model.",
    "Include representative frequency and intensity data, reporting corrections, path dimensions, within-path intensity variation, and probabilistic wind speed given damage rating.",
    "Use a sufficiently broad, reasonably homogeneous tornado region representative of rare-event climatology at the site.",
    "Ensure tornado frequencies account for wind pressure, atmospheric pressure change, and wind-borne missile effects.",
    "Compare tornado frequencies and uncertainties with current published information and explain significant differences.",
  ],
  F: [
    "Identify assumptions and uncertainty sources in every wind-hazard analysis step for downstream characterization and integrated uncertainty analysis.",
    "Characterize notable uncertainty sources for every retained hazard using alternate data, models, methods, or sensitivity studies.",
    "Use demonstrably conservative uncertainty estimates for CC-I or propagate contributing uncertainties through CC-II hazard quantification.",
    "Develop justified representative hazard functions for CC-I or mean and percentile hazard functions for CC-II for every retained hazard.",
  ],
  G: [
    "Document hazard screening, probabilistic methods, data, models, inclusion and exclusion bases, assumptions, and results with complete traceability.",
    "Document wind-hazard model uncertainties, related assumptions, and reasonable alternatives.",
    "Document pre-operational assumptions and limitations caused by unavailable as-built or as-operated wind-hazard information.",
    "For a bounding-site analysis, document the characteristics and justification demonstrating that the selected site basis bounds the candidate sites.",
  ],
}, {
  "WHA-G3": ["PRE_OPERATIONAL"],
});

export const WFR_SR_CATALOG = createHighWindsSrCatalog("WFR", {
  A: [
    "Include the SSCs and associated failure modes identified by the wind plant-response analysis in the fragility scope.",
    "Develop SSC-specific fragilities using the reference wind speed for each applicable hazard.",
    "Use site-specific wind fragilities for a specific-site PRA.",
    "Develop fragilities over the full wind-speed range established by the hazard analysis.",
    "Include every significant SSC failure mode for each applicable wind-loading effect.",
    "Justify aggregation when multiple effects or failure modes are combined into one fragility.",
    "Justify using the same fragility for different wind hazards instead of hazard-specific fragilities.",
    "Assess the effect of fragility correlations on High Winds PRA results and insights.",
    "Address coexistent-hazard effects on fragilities within the High Winds PRA scope.",
  ],
  B: [
    "Use investigations to collect as-built/as-operated or as-designed/as-intended site and SSC information relevant to fragility.",
    "Identify and include piping, conduits, vents, supports, and other supporting elements required for each HWEL SSC to function.",
    "Confirm through investigation that assumptions used to screen SSC failure modes are consistent with observed or intended conditions.",
    "For a specific-site PRA, compile the number, types, and locations of potential missiles capable of failing individual SSCs.",
    "For a bounding-site PRA, estimate the number, types, and locations of potential missiles capable of failing individual SSCs.",
    "Keep missile characterization consistent with the missile categorization, structural-source, and source-distance fragility methods.",
    "Estimate missile populations and locations for distinct plant conditions, including outage and non-outage configurations.",
  ],
  C: [
    "Justify screening an SSC from wind-pressure or atmospheric-pressure-change effects.",
    "Justify the method and basis for screening an SSC from wind-generated missile effects.",
    "Justify the method and basis for screening an SSC from structural-interaction effects.",
    "Justify the method and basis for screening an SSC from wind-driven rain effects.",
  ],
  D: [
    "Justify wind-pressure load methods that deviate from applicable national wind-loading standards.",
    "Justify atmospheric-pressure-change methods and the method used to combine APC with wind-pressure loads.",
    "Account for differences between the SSC design basis and current wind codes and loading standards.",
    "Include dynamic response when the SSC is a flexible structure.",
    "Evaluate site topography and include applicable topographic speed-up effects.",
    "Evaluate shielding and negative-shielding effects and include applicable factors in fragility calculations.",
  ],
  E: [
    "Use site-specific hazard characteristics and wind fields to develop wind-generated missile effects.",
    "Justify using missile effects that are not specific to the applicable wind hazard.",
    "Categorize missile types using the surveyed numbers and types of potential missiles.",
    "Quantify structure-source missiles, including envelope, building-content, and rooftop sources, in the missile analysis.",
    "Justify excluding missile sources beyond a selected distance from the nearest SSC.",
    "Justify scaling missile impact or damage results using SSC dimensions, area, or volume.",
    "Demonstrate stable missile impact and damage results over the analyzed wind-speed range.",
    "Specify spatial, wind-field, injection, aerodynamic, trajectory, impact, damage, shielding, ricochet, and multiple-missile assumptions applicable to the capability category.",
    "Apply WFR-E8 and, for a specific-site CC-II PRA, include site-specific path, direction, aerodynamics, and missile-type-dependent damage methods.",
    "Specify the missile hit and damage criterion for every SSC.",
    "Specify how correlated missile hits or damage to multiple SSCs in one wind event are modeled.",
    "Include changing missile populations caused by outages, non-outage conditions, and plant configuration changes.",
  ],
  F: [
    "Define the structural-interaction analysis methodology.",
    "Include interactions caused by failure of chimneys, stacks, exhausts, towers, poles, walls, roofs, and other structures or components near HWEL SSCs.",
  ],
  G: [
    "Define the wind-driven rain effects methodology.",
    "Include rain-entry paths that can drip, splash, or deposit water on vulnerable SSCs.",
  ],
  H: [
    "Develop justified conservative representative fragilities for CC-I or calculated fragilities for CC-II for every modeled failure mode.",
    "Use justified generic technical information for CC-I or plant-specific information, when available, augmented by site evaluation for CC-II.",
    "Identify assumptions and fragility uncertainty sources for characterization and integrated uncertainty analysis.",
    "Characterize notable fragility model uncertainties and reasonable alternatives.",
  ],
  I: [
    "Document fragility methods, SSC-specific curves or values, failure modes, information sources, locations, investigations, screening bases, parameters, and uncertainties.",
    "Document wind-fragility model uncertainties, related assumptions, and reasonable alternatives.",
    "Document pre-operational fragility assumptions and limitations caused by unavailable as-built, as-operated, design, or site details.",
  ],
}, {
  "WFR-I3": ["PRE_OPERATIONAL"],
});

export const WPR_SR_CATALOG = createHighWindsSrCatalog("WPR", {
  A: [
    "Identify direct high-wind initiating events using a process that addresses each applicable wind hazard's unique characteristics.",
    "Identify direct and indirect initiating events caused by shutdown, procedural reconfiguration, or other actions taken because of high winds.",
    "Incorporate relevant plant and industry high-wind operating experience into the initiating-event set.",
    "Include retained SSC- or human-action-induced initiating events that produce risk-significant sequences or progression sequences in the plant-response model.",
  ],
  B: [
    "Use internal-events sequences and systems logic as the basis and add high-wind sequences affecting multiple reactors or radioactive-material sources when needed.",
    "Resolve and incorporate relevant internal-events and other-hazard PRA peer-review findings into the high-wind plant-response model.",
    "Model high-wind-induced SSC failures representing every failure mode of interest.",
    "Model applicable fragility correlations and justify the selected correlation method.",
    "Include beneficial high-wind failures only when excluding them would distort risk results.",
    "Use bounding CC-I or realistic CC-II mission times sufficient to reach stable end states, extending internal-events mission times when high-wind conditions require it.",
    "Develop new high-wind PRA logic using applicable IE, ES, SC, SY, DA, and expert-judgment requirements and include hazard-induced, random, unavailable, and human-action events.",
    "Include coexistent hazards within the High Winds PRA scope.",
    "Assess multi-reactor effects on resources, organizational response, shared SSCs, common-cause failures, and site accessibility.",
  ],
  C: [
    "Use the internal-events systems model and any additional high-wind event-sequence systems as the basis for the HWEL.",
    "Add SSCs absent from or screened out of the internal-events model when they require High Winds PRA evaluation.",
    "Extend the HWEL using available industry High Winds PRA equipment lists.",
    "Include structural and spatial interactions from SSCs not represented in the internal-events model.",
    "Identify the failure modes of interest for every SSC included in the HWEL.",
  ],
  D: [
    "Identify baseline, preparatory, and recovery HFEs relevant to the High Winds PRA context.",
    "Evaluate operator actions using performance-shaping factors specific to straight winds, tropical cyclones, and tornadoes.",
    "Apply the applicable capability-category requirements of HLR-HR-E to high-wind human response actions.",
    "Apply the applicable capability-category requirements of HLR-HR-F when defining and specifying high-wind HFEs.",
    "For operating plants, review credited procedures and event sequences with operations or training personnel.",
    "For pre-operational PRAs, talk through assumed procedures and event sequences with knowledgeable operations or training personnel.",
    "Apply HLR-HR-H to additional exclusive recovery actions where applicable.",
    "Model HFEs at the function, system, train, or component level appropriate to their plant-response impact.",
    "Evaluate whether recovery actions credited in the internal-events PRA remain valid under high-wind conditions.",
    "Adjust invalidated recovery models and document the procedure and condition basis for retained recovery values.",
    "Develop HEPs using the applicable capability-category HLR-HR-G requirements and include high-wind effects on control-room and ex-control-room actions.",
  ],
  E: [
    "Integrate high-wind hazard, fragility, and systems analyses to quantify event-sequence-family frequencies on a plant-year basis.",
    "Prevent risk overestimation from rare-event approximations when fragility or other conditional failure probabilities approach one.",
    "Demonstrate convergence of risk metrics with respect to hazard-curve discretization or other numerical integration methods.",
    "Apply the applicable ESQ supporting requirements to High Winds PRA event-sequence-family quantification.",
    "Use point-estimate plant response for CC-I or propagate hazard, fragility, and plant-response uncertainty to mean and percentile CC-II results.",
    "Identify assumptions and uncertainty sources in the wind plant-response analysis.",
    "Characterize notable plant-response uncertainties and integrate uncertainties identified by WHA, WFR, and WPR in accordance with ESQ-E1.",
  ],
  F: [
    "Document plant-response inputs, adaptations, HRA influences, methods, event-sequence results, uncertainty distributions, sensitivity studies, and risk-significant contributors.",
    "Document wind plant-response and quantification model uncertainties, related assumptions, and reasonable alternatives.",
    "Document pre-operational plant-response and quantification assumptions and limitations caused by unavailable as-built or as-operated information.",
  ],
}, {
  "WPR-D5": ["OPERATIONAL"],
  "WPR-D6": ["PRE_OPERATIONAL"],
  "WPR-F3": ["PRE_OPERATIONAL"],
});

export const HIGH_WINDS_PRA_SR_CATALOG: Record<string, HighWindsSrCatalogEntry> = {
  ...WHA_SR_CATALOG,
  ...WFR_SR_CATALOG,
  ...WPR_SR_CATALOG,
};
