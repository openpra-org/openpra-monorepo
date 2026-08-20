import { ParameterDistribution } from "../core/events";
import { BaseModelUncertaintyDocumentation, PreOperationalAssumption } from "../core/documentation";
import { Named, Unique } from "../core/meta";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";
import { ImportanceLevel, SensitivityStudy } from "../core/shared-patterns";

export type SeismicSiteBasis = "IDENTIFIED_SITE" | "BOUNDING_SITE";

export type StructuredHazardProcessType =
  | "SSHAC_LEVEL_1"
  | "SSHAC_LEVEL_2"
  | "SSHAC_LEVEL_3"
  | "SSHAC_LEVEL_4"
  | "OTHER_STRUCTURED_PROCESS";

export type GroundMotionParameterType =
  | "PEAK_GROUND_ACCELERATION"
  | "SPECTRAL_ACCELERATION"
  | "AVERAGE_SPECTRAL_ACCELERATION";

export type GroundMotionDirection =
  | "HORIZONTAL_1"
  | "HORIZONTAL_2"
  | "GEOMETRIC_MEAN_HORIZONTAL"
  | "MAXIMUM_HORIZONTAL"
  | "RANDOM_HORIZONTAL"
  | "VERTICAL";

export type EarthScienceDiscipline =
  | "GEOLOGY"
  | "SEISMOLOGY"
  | "GEOPHYSICS"
  | "GEOTECHNICAL"
  | "TOPOGRAPHY"
  | "PALEOSEISMOLOGY"
  | "STRONG_MOTION";

export type EarthquakeCatalogRecordType = "HISTORICAL" | "INSTRUMENTAL" | "PALEOSEISMIC";

export type SeismicSourceType =
  | "FAULT"
  | "AREA"
  | "BACKGROUND"
  | "SUBDUCTION_INTERFACE"
  | "SUBDUCTION_SLAB"
  | "INDUCED"
  | "OTHER";

export type FaultMechanism = "STRIKE_SLIP" | "NORMAL" | "REVERSE" | "OBLIQUE" | "UNKNOWN";

export type LogicTreeNodeKind =
  | "SOURCE_GEOMETRY"
  | "MAXIMUM_MAGNITUDE"
  | "RECURRENCE"
  | "GROUND_MOTION_MODEL"
  | "SITE_RESPONSE"
  | "OTHER";

export type SiteResponseDimension = "ONE_DIMENSIONAL" | "TWO_DIMENSIONAL" | "THREE_DIMENSIONAL";

export type HazardCurveStatistic = "MEAN" | "FRACTILE" | "INDIVIDUAL_BRANCH";

export type ResponseSpectrumType =
  | "UNIFORM_HAZARD"
  | "HORIZONTAL_HAZARD_CONSISTENT"
  | "VERTICAL_HAZARD_CONSISTENT"
  | "FOUNDATION_INPUT_RESPONSE_SPECTRUM";

export type SecondarySeismicHazardType =
  | "FAULT_DISPLACEMENT"
  | "LANDSLIDE"
  | "SOIL_LIQUEFACTION"
  | "SOIL_SETTLEMENT"
  | "GROUND_FAILURE"
  | "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING"
  | "TSUNAMI_OR_SEICHE"
  | "OTHER";

export type SecondaryHazardDisposition = "SCREENED_OUT" | "RETAINED";

export type SecondaryHazardScreeningCriterion = "SCR-2" | "SCR-3" | "NOT_SCREENED";

export interface GeographicLocation {
  latitude: number;
  longitude: number;
  elevation?: number;
  elevationUnit?: string;
  horizontalDatum: string;
  verticalDatum?: string;
}

export interface BoundingSiteCharacteristic extends Unique, Named {
  description: string;
  value?: number | string;
  units?: string;
  lowerBound?: number;
  upperBound?: number;
  boundingDirection: "UPPER" | "LOWER" | "RANGE" | "QUALITATIVE";
  basis: string;
  candidateSiteRefs?: string[];
}

export interface SeismicSiteDefinition extends Unique, Named {
  siteBasis: SeismicSiteBasis;
  siteName?: string;
  location?: GeographicLocation;
  candidateSites?: {
    id: string;
    name: string;
    location?: GeographicLocation;
    inclusionBasis: string;
  }[];
  boundingCharacteristics?: BoundingSiteCharacteristic[];
  applicableSiteRange?: string;
  selectionAndApplicabilityBasis: string;
  boundsAllSitesInScope: boolean;
  boundingDemonstration?: string;
  implementsSrs: SRReference[];
}

export interface HazardProcessParticipant extends Unique {
  name: string;
  organization?: string;
  role:
    | "PROJECT_MANAGER"
    | "TECHNICAL_INTEGRATOR"
    | "RESOURCE_EXPERT"
    | "EVALUATOR_EXPERT"
    | "PROPONENT_EXPERT"
    | "PEER_REVIEWER"
    | "OTHER";
  discipline?: EarthScienceDiscipline | "INTEGRATION" | "OTHER";
  responsibilities: string[];
  qualifications?: string;
  conflictOfInterestEvaluation?: string;
}

export interface HazardProcessActivity extends Unique, Named {
  activityType:
    | "PLANNING"
    | "DATA_EVALUATION"
    | "WORKSHOP"
    | "MODEL_DEVELOPMENT"
    | "INTEGRATION"
    | "DOCUMENTATION"
    | "REVIEW";
  date?: string;
  objective: string;
  participants: string[];
  inputs: string[];
  decisions: string[];
  outputs: string[];
  recordReference?: string;
}

export interface StructuredHazardProcess extends Unique, Named {
  processType: StructuredHazardProcessType;
  alternateProcessDescription?: string;
  processLevelBasis: string;
  studyObjective: string;
  participants: HazardProcessParticipant[];
  activities: HazardProcessActivity[];
  technicalIntegrationApproach: string;
  evaluationAndIntegrationMethods: string;
  centerBodyRangeDemonstration: string;
  qualityAssuranceProcess: string;
  independentReviewProcess: string;
  deviationsAndLimitations: string[];
  implementsSrs: SRReference[];
}

export interface GroundMotionParameterDefinition extends Unique, Named {
  parameterType: GroundMotionParameterType;
  direction: GroundMotionDirection;
  units: string;
  dampingRatio?: number;
  oscillatorPeriodSeconds?: number;
  oscillatorFrequencyHz?: number;
  averagingFrequencyBandHz?: {
    lower: number;
    upper: number;
    averagingMethod: string;
  };
  componentDefinition: string;
  selectedRange: {
    minimum: number;
    maximum: number;
  };
  selectedFrequencyRangeHz: {
    lower: number;
    upper: number;
  };
  usedForHazard: boolean;
  usedForFragility: boolean;
  usedForPlantResponse: boolean;
  consistencyBasis: string;
  downstreamElementRefs?: string[];
  implementsSrs: SRReference[];
}

export interface HazardCalculationBounds {
  maximumGroundMotion: number;
  groundMotionUnits: string;
  tailExtrapolationMethod: string;
  truncationImpactEvaluation: string;
  sequenceRankingUnaffected: boolean;
  lowerBoundMagnitude: number;
  magnitudeScale: string;
  lowerBoundMagnitudeBasis: string;
  epsilonLimit: number;
  epsilonTailTreatment: string;
  epsilonLimitBasis: string;
  implementsSrs: SRReference[];
}

export interface HazardAnalysisBasis {
  site: SeismicSiteDefinition;
  structuredProcess: StructuredHazardProcess;
  groundMotionParameters: GroundMotionParameterDefinition[];
  calculationBounds: HazardCalculationBounds;
  seismicFragilityAnalysisRef?: string;
  seismicPlantResponseAnalysisRef?: string;
  eventSequenceQuantificationRef?: string;
  implementsSrs: SRReference[];
}

export interface EarthScienceDataSet extends Unique, Named {
  discipline: EarthScienceDiscipline;
  sourceOrganization: string;
  sourceReference: string;
  publicationOrAcquisitionDate?: string;
  dataCutoffDate?: string;
  spatialCoverage: string;
  temporalCoverage?: string;
  resolution?: string;
  format?: string;
  qualityAndLimitations: string;
  currentnessAssessment: string;
  interpretationsSupported: string[];
  fileReference?: string;
  implementsSrs: SRReference[];
}

export interface SeismicStudyRegion extends Unique, Named {
  boundaryDescription: string;
  radialExtentKm?: number;
  tectonicSetting: string;
  includedSourceRegions: string[];
  majorContributorCoverageBasis: string;
  regionalPropagationDataSufficiency: string;
  localSiteEffectsDataSufficiency: string;
  uncertaintyCoverageBasis: string;
  mapReference?: string;
  implementsSrs: SRReference[];
}

export interface EarthquakeCatalogEvent extends Unique {
  recordType: EarthquakeCatalogRecordType;
  eventDateOrAge: string;
  location?: GeographicLocation;
  locationDescription?: string;
  magnitude?: number;
  magnitudeScale?: string;
  magnitudeUncertainty?: number;
  depthKm?: number;
  depthUncertaintyKm?: number;
  sourceReferences: string[];
  associatedSourceRef?: string;
  qualityFlags?: string[];
  comments?: string;
}

export interface EarthquakeCatalog extends Unique, Named {
  catalogStartDateOrAge: string;
  catalogEndDate: string;
  magnitudeScales: string[];
  homogenizationMethod: string;
  declusteringMethod?: string;
  completenessAssessment: string;
  locationAndMagnitudeUncertaintyTreatment: string;
  duplicateResolutionMethod: string;
  events: EarthquakeCatalogEvent[];
  sourceReferences: string[];
  implementsSrs: SRReference[];
}

export interface EarthScienceModelInventoryEntry extends Unique, Named {
  modelKind: "SEISMIC_SOURCE" | "GROUND_MOTION" | "SITE_RESPONSE" | "REGIONAL_PROPAGATION" | "OTHER";
  version?: string;
  publicationDate?: string;
  sourceReference: string;
  applicability: string;
  limitations: string[];
  knownToExistingAnalysis: boolean;
  previouslyUsed: boolean;
  potentialImpactOnHazard: string;
  disposition: "INCLUDED" | "BOUNDED_BY_EXISTING_MODEL" | "EXCLUDED" | "REQUIRES_UPDATE";
  dispositionBasis: string;
  implementsSrs: SRReference[];
}

export interface EarthScienceInputs {
  dataSets: EarthScienceDataSet[];
  studyRegions: SeismicStudyRegion[];
  earthquakeCatalog: EarthquakeCatalog;
  modelAndMethodInventory: EarthScienceModelInventoryEntry[];
  dataGapAssessment: string;
  subjectMatterExpertReview: string;
  compilationCutoffDate: string;
  implementsSrs: SRReference[];
}

export interface LogicTreeBranch extends Unique, Named {
  modelRef?: string;
  value?: number | string;
  weight: number;
  technicalBasis: string;
  dataSupport: string[];
  limitations?: string[];
}

export interface LogicTreeNode extends Unique, Named {
  nodeKind: LogicTreeNodeKind;
  parentBranchRef?: string;
  branches: LogicTreeBranch[];
  weightSum: number;
  dependencyTreatment?: string;
  elicitationBasis: string;
}

export interface EpistemicLogicTree extends Unique, Named {
  nodes: LogicTreeNode[];
  totalEndBranchCount?: number;
  branchWeightReview: string;
  dependenciesAndCorrelations: string;
  centerBodyRangeCoverage: string;
  implementsSrs: SRReference[];
}

export interface SeismicSourceGeometry {
  geometryType: "POINT" | "LINE" | "AREA" | "PLANE" | "VOLUME";
  geometryDescription: string;
  coordinateReferenceSystem?: string;
  geometryFileRef?: string;
  closestDistanceToSiteKm?: number;
  depthRangeKm?: {
    minimum: number;
    maximum: number;
  };
  strikeDegrees?: number;
  dipDegrees?: number;
  uncertaintyDescription: string;
}

export interface MagnitudeFrequencyModel extends Unique, Named {
  modelType: "GUTENBERG_RICHTER" | "CHARACTERISTIC" | "RENEWAL" | "FIXED_RATE" | "OTHER";
  minimumMagnitude: number;
  maximumMagnitude: number;
  magnitudeScale: string;
  annualRateAboveMinimum?: number;
  aValue?: number;
  bValue?: number;
  recurrenceIntervalYears?: number;
  parameterDistributions?: Record<string, ParameterDistribution>;
  dataAndMethodBasis: string;
}

export interface SeismicSource extends Unique, Named {
  sourceType: SeismicSourceType;
  tectonicRegionType: string;
  active: boolean;
  faultMechanisms: FaultMechanism[];
  geometry: SeismicSourceGeometry;
  magnitudeFrequencyModels: MagnitudeFrequencyModel[];
  paleoseismicEventRefs?: string[];
  historicalAndInstrumentalEventRefs?: string[];
  sourceDataRefs: string[];
  majorHazardContributor: boolean;
  characterizationBasis: string;
  uncertainties: string[];
  implementsSrs: SRReference[];
}

export interface ExistingModelAssessment extends Unique, Named {
  modelType: "SEISMIC_SOURCE" | "GROUND_MOTION" | "SITE_RESPONSE" | "COMPLETE_HAZARD_ANALYSIS";
  modelVersion: string;
  originalStudyDate?: string;
  newDataModelMethodRefs: string[];
  centerBodyRangeCoverageEvaluation: string;
  technicalValidityEvaluation: string;
  updateRequired: boolean;
  updateLevel?: string;
  updateMethod?: string;
  updateJustification?: string;
  resultingModelRef?: string;
  implementsSrs: SRReference[];
}

export interface SeismicSourceCharacterization {
  structuredApproach: string;
  earthquakeSources: SeismicSource[];
  sourceLogicTree: EpistemicLogicTree;
  uncertaintyIdentificationMethod: string;
  existingModelAssessments: ExistingModelAssessment[];
  sourceModelReference: string;
  technicalIntegrationSummary: string;
  implementsSrs: SRReference[];
}

export interface StrongMotionDataSet extends Unique, Named {
  sourceReference: string;
  tectonicRegions: string[];
  magnitudeRange: {
    minimum: number;
    maximum: number;
  };
  distanceRangeKm: {
    minimum: number;
    maximum: number;
  };
  siteConditionRange: string;
  recordCount?: number;
  componentDefinition: string;
  qualityScreening: string;
  useInCalibration: string;
}

export interface GroundMotionPredictionModel extends Unique, Named {
  modelKind: "PUBLISHED_GMPE" | "PROJECT_SPECIFIC_GMPE" | "SIMULATION" | "HYBRID";
  version?: string;
  sourceReference: string;
  tectonicRegionTypes: string[];
  faultMechanisms: FaultMechanism[];
  magnitudeRange: {
    minimum: number;
    maximum: number;
  };
  distanceRangeKm: {
    minimum: number;
    maximum: number;
  };
  supportedParameterRefs: string[];
  horizontalComponentDefinition: string;
  siteTermDefinition: string;
  medianModelDescription: string;
  aleatoryVariabilityDescription: string;
  sigmaComponents?: {
    total?: number;
    interEvent?: number;
    intraEvent?: number;
  };
  extrapolationAndTruncation: string;
  applicabilityAndLimitations: string;
  calibrationDataRefs: string[];
  logicTreeWeight: number;
  selectionBasis: string;
  implementsSrs: SRReference[];
}

export interface ReferenceHorizon extends Unique, Named {
  horizonType: "ROCK" | "SOIL";
  depth: number;
  depthUnit: string;
  shearWaveVelocity: number;
  shearWaveVelocityUnit: string;
  density: number;
  densityUnit: string;
  dampingRatio: number;
  definitionBasis: string;
  uncertaintyDescription: string;
  implementsSrs: SRReference[];
}

export interface HazardUncertainty extends Unique, Named {
  uncertaintyType: "ALEATORY" | "EPISTEMIC";
  analysisArea: "SOURCE" | "GROUND_MOTION" | "SITE_RESPONSE" | "VERTICAL_MOTION" | "SECONDARY_HAZARD" | "INTEGRATION";
  description: string;
  affectedModelRefs: string[];
  affectedResultRefs: string[];
  characterizationMethod: string;
  distribution?: ParameterDistribution;
  logicTreeNodeRef?: string;
  correlationAndDependencyTreatment?: string;
  propagationMethod: string;
  importance?: ImportanceLevel;
  riskSignificanceBasis?: string;
  implementsSrs: SRReference[];
}

export interface GroundMotionCharacterization {
  governingMechanisms: string[];
  historicalAndInstrumentalReview: string;
  strongMotionDataSets: StrongMotionDataSet[];
  modelSelectionCriteria: string[];
  predictionModels: GroundMotionPredictionModel[];
  groundMotionLogicTree: EpistemicLogicTree;
  referenceHorizons: ReferenceHorizon[];
  processCompatibilityBasis: string;
  uncertainties: HazardUncertainty[];
  siteToSiteVariabilityIncluded: boolean;
  siteToSiteVariabilityTreatment?: string;
  boundingSiteVariabilityJustification?: string;
  existingModelAssessments: ExistingModelAssessment[];
  implementsSrs: SRReference[];
}

export interface MaterialProperty extends Unique, Named {
  propertyType:
    | "SHEAR_WAVE_VELOCITY"
    | "COMPRESSIONAL_WAVE_VELOCITY"
    | "DENSITY"
    | "DAMPING"
    | "SHEAR_MODULUS"
    | "POISSON_RATIO"
    | "OTHER";
  value: number;
  units: string;
  distribution?: ParameterDistribution;
  correlationGroup?: string;
  sourceReference: string;
  basisAndLimitations: string;
}

export interface StrainDependentPropertyPoint {
  shearStrain: number;
  modulusReductionRatio: number;
  dampingRatio: number;
}

export interface GeotechnicalLayer extends Unique, Named {
  materialType: string;
  topDepth: number;
  bottomDepth: number;
  depthUnit: string;
  thickness: number;
  properties: MaterialProperty[];
  strainDependentProperties?: StrainDependentPropertyPoint[];
  spatialVariability: string;
  sourceReferences: string[];
}

export interface GeotechnicalProfile extends Unique, Named {
  profileType: "BEST_ESTIMATE" | "LOWER_BOUND" | "UPPER_BOUND" | "ALTERNATIVE" | "BOUNDING_SITE";
  locationDescription: string;
  layers: GeotechnicalLayer[];
  depthToBedrock: number;
  depthUnit: string;
  bedrockDefinition: string;
  groundwaterDepth?: number;
  profileWeight?: number;
  siteVariabilityBasis: string;
  sourceReferences: string[];
  implementsSrs: SRReference[];
}

export interface SiteTopographyAndGeology {
  topographicDescription: string;
  topographicDataRefs: string[];
  surficialDepositDescription: string;
  surficialGeologyDataRefs: string[];
  geologicStructureDescription: string;
  geotechnicalInvestigationRefs: string[];
  topographicEffectsSignificant: boolean;
  topographicEffectsTreatment: string;
  implementsSrs: SRReference[];
}

export interface SiteResponseMethod extends Unique, Named {
  dimension: SiteResponseDimension;
  analysisType: "EQUIVALENT_LINEAR" | "NONLINEAR" | "RANDOM_VIBRATION_THEORY" | "TIME_DOMAIN" | "OTHER";
  softwareAndVersion?: string;
  methodDescription: string;
  dimensionSelectionBasis: string;
  inputLocation: string;
  outputLocation: string;
  boundaryConditions: string;
  materialModelDescription: string;
  verificationAndValidation: string;
  limitations: string[];
  implementsSrs: SRReference[];
}

export interface SiteResponseInputMotion extends Unique, Named {
  inputType: "RESPONSE_SPECTRUM" | "TIME_HISTORY" | "FOURIER_AMPLITUDE_SPECTRUM" | "RANDOM_VIBRATION";
  referenceHorizonRef: string;
  groundMotionParameterRef: string;
  amplitudeLevels: number[];
  units: string;
  timeHistoryRefs?: string[];
  spectrumRef?: string;
  selectionAndScalingBasis: string;
}

export interface SiteAmplificationPoint {
  inputGroundMotion: number;
  frequencyHz: number;
  medianAmplification: number;
  logarithmicStandardDeviation?: number;
  fractileAmplifications?: {
    fractile: number;
    amplification: number;
  }[];
}

export interface SiteAmplificationResult extends Unique, Named {
  profileRefs: string[];
  methodRef: string;
  inputMotionRef: string;
  outputControlPointRef: string;
  points: SiteAmplificationPoint[];
  weightingAndCombinationMethod: string;
  nonlinearEffectsTreatment: string;
  uncertaintyTreatment: string;
  implementsSrs: SRReference[];
}

export interface SiteResponseAnalysis {
  topographyAndGeology: SiteTopographyAndGeology;
  profiles: GeotechnicalProfile[];
  methods: SiteResponseMethod[];
  inputMotions: SiteResponseInputMotion[];
  amplificationResults: SiteAmplificationResult[];
  incorporationIntoHazardMethod: string;
  uncertainties: HazardUncertainty[];
  localSiteResponseIncluded: boolean;
  boundingSiteVariabilityIncluded: boolean;
  boundingSiteVariabilityTreatment?: string;
  approachJustification: string;
  implementsSrs: SRReference[];
}

export interface HazardCurvePoint {
  groundMotion: number;
  annualFrequencyOfExceedance: number;
}

export interface HazardCurve extends Unique, Named {
  groundMotionParameterRef: string;
  controlPointRef: string;
  direction: GroundMotionDirection;
  statistic: HazardCurveStatistic;
  fractile?: number;
  branchRef?: string;
  groundMotionUnits: string;
  frequencyUnit: string;
  points: HazardCurvePoint[];
  interpolationMethod: string;
  extrapolationMethod?: string;
  calculationRunRef: string;
  implementsSrs: SRReference[];
}

export interface ResponseSpectrumPoint {
  periodSeconds: number;
  frequencyHz: number;
  spectralAcceleration: number;
  units: string;
}

export interface ResponseSpectrum extends Unique, Named {
  spectrumType: ResponseSpectrumType;
  direction: GroundMotionDirection;
  controlPointRef: string;
  annualFrequencyOfExceedance?: number;
  dampingRatio: number;
  statistic: "MEAN" | "FRACTILE" | "DETERMINISTIC_SHAPE";
  fractile?: number;
  points: ResponseSpectrumPoint[];
  derivationMethod: string;
  sourceHazardCurveRefs: string[];
  implementsSrs: SRReference[];
}

export interface MagnitudeDistanceDeaggregationBin {
  magnitudeLower: number;
  magnitudeUpper: number;
  distanceLowerKm: number;
  distanceUpperKm: number;
  contributionFraction: number;
}

export interface HazardDeaggregationContribution {
  contributorRef: string;
  contributorName: string;
  contributionFraction: number;
}

export interface EpsilonDeaggregationBin {
  epsilonLower: number;
  epsilonUpper: number;
  contributionFraction: number;
}

export interface HazardDeaggregation extends Unique, Named {
  groundMotionParameterRef: string;
  controlPointRef: string;
  groundMotionLevel: number;
  groundMotionUnits: string;
  annualFrequencyOfExceedance?: number;
  meanMagnitude: number;
  meanDistanceKm: number;
  magnitudeDistanceBins: MagnitudeDistanceDeaggregationBin[];
  sourceContributions: HazardDeaggregationContribution[];
  groundMotionModelContributions: HazardDeaggregationContribution[];
  epsilonContributions?: EpsilonDeaggregationBin[];
  calculationRunRef: string;
  implementsSrs: SRReference[];
}

export interface HazardCalculationRun extends Unique, Named {
  calculationDate: string;
  software: string;
  softwareVersion: string;
  sourceModelRef: string;
  groundMotionModelRef: string;
  siteResponseModelRefs: string[];
  logicTreeEndBranchCount?: number;
  numericalIntegrationMethod: string;
  magnitudeStep: number;
  distanceStepKm: number;
  annualFrequencyRange: {
    minimum: number;
    maximum: number;
  };
  convergenceCriteria: string;
  convergenceDemonstration: string;
  verificationChecks: string[];
  warningsAndLimitations: string[];
  outputFileRefs: string[];
  implementsSrs: SRReference[];
}

export interface SeismicHazardInterval extends Unique, Named {
  groundMotionParameterRef: string;
  controlPointRef: string;
  lowerGroundMotion: number;
  upperGroundMotion: number;
  representativeGroundMotion: number;
  groundMotionUnits: string;
  annualFrequency: number;
  frequencyUnit: string;
  frequencyCalculationMethod: string;
  sourceHazardCurveRef: string;
  verticalMotionRef?: string;
  secondaryHazardResultRefs?: string[];
  usedByEventSequenceFamilyRefs?: string[];
  implementsSrs: SRReference[];
}

export interface SeismicPraHazardInputs {
  hazardIntervals: SeismicHazardInterval[];
  fragilityInputSpectrumRefs: string[];
  plantResponseInputRefs: string[];
  eventSequenceQuantificationInputRefs: string[];
  verticalMotionResultRefs: string[];
  secondaryHazardResultRefs: string[];
  transferBasis: string;
  consistencyChecks: string[];
  implementsSrs: SRReference[];
}

export interface KeyHazardUncertaintyFinding extends Unique, Named {
  uncertaintyRef: string;
  analysisArea: HazardUncertainty["analysisArea"];
  affectedResultRefs: string[];
  identificationMethod: string;
  sensitivityStudyRefs: string[];
  effectOnResults: string;
  effectOnSeismicPraQuantification: string;
  importance: ImportanceLevel;
  implementsSrs: SRReference[];
}

export interface HazardQuantification {
  calculationRuns: HazardCalculationRun[];
  hazardCurves: HazardCurve[];
  uniformHazardSpectra: ResponseSpectrum[];
  deaggregations: HazardDeaggregation[];
  seismicPraInputs: SeismicPraHazardInputs;
  uncertaintyPropagationMethod: string;
  aleatoryUncertaintiesPropagated: boolean;
  epistemicUncertaintiesPropagated: boolean;
  sensitivityStudies: SensitivityStudy[];
  keyUncertaintyFindings: KeyHazardUncertaintyFinding[];
  resultQualityChecks: string[];
  implementsSrs: SRReference[];
}

export interface SeismicControlPoint extends Unique, Named {
  controlPointType: "GROUND_SURFACE" | "FOUNDATION" | "FREE_FIELD" | "REFERENCE_HORIZON" | "OTHER";
  locationDescription: string;
  elevation?: number;
  elevationUnit?: string;
  coordinateReference?: string;
  applicableStructureRefs?: string[];
  transferFunctionRef?: string;
  basis: string;
}

export interface HorizontalSpectralShapeBasis extends Unique, Named {
  spectrumRef: string;
  groundMotionLevel: number;
  groundMotionUnits: string;
  meanMagnitude: number;
  meanDistanceKm: number;
  controllingSourceRefs: string[];
  characteristicShapeRefs: string[];
  usesOrBoundsCharacteristicShapes: boolean;
  evaluationBasis: string;
  implementsSrs: SRReference[];
}

export interface VerticalSpectrumBasis extends Unique, Named {
  spectrumRef: string;
  methodType: "VERTICAL_GMPE" | "VERTICAL_TO_HORIZONTAL_RATIO" | "SITE_SPECIFIC_ANALYSIS" | "OTHER";
  methodDescription: string;
  dataAndModelRefs: string[];
  verticalToHorizontalRatios?: VerticalToHorizontalRatioPoint[];
  stateOfKnowledgeAssessment: string;
  appropriatenessJustification: string;
  limitations: string[];
  implementsSrs: SRReference[];
}

export interface VerticalToHorizontalRatioPoint {
  periodSeconds: number;
  frequencyHz: number;
  ratio: number;
}

export interface FoundationInputResponseSpectrum extends Unique, Named {
  structureRef: string;
  controlPointRef: string;
  horizontalSpectrumRefs: string[];
  verticalSpectrumRef?: string;
  soilStructureInteractionTreatment: string;
  derivationMethod: string;
  applicabilityAndLimitations: string;
  implementsSrs: SRReference[];
}

export interface ResponseSpectraEvaluation {
  controlPoints: SeismicControlPoint[];
  horizontalSpectra: ResponseSpectrum[];
  horizontalShapeBases: HorizontalSpectralShapeBasis[];
  verticalSpectra: ResponseSpectrum[];
  verticalSpectrumBases: VerticalSpectrumBasis[];
  foundationInputResponseSpectra: FoundationInputResponseSpectrum[];
  downstreamConsistencyBasis: string;
  implementsSrs: SRReference[];
}

export interface SecondaryHazardScreening {
  disposition: SecondaryHazardDisposition;
  criterion: SecondaryHazardScreeningCriterion;
  methodology: string;
  demonstrablyConservative: boolean;
  screeningBasis: string;
  calculationsAndEvidenceRefs: string[];
  reviewer?: string;
  reviewDate?: string;
  implementsSrs: SRReference[];
}

export interface SecondaryHazardCurvePoint {
  hazardLevel: number;
  annualFrequencyOfExceedance: number;
}

export interface SecondaryHazardCurve extends Unique, Named {
  hazardParameter: string;
  hazardParameterUnits: string;
  statistic: HazardCurveStatistic;
  fractile?: number;
  points: SecondaryHazardCurvePoint[];
  calculationRunRef?: string;
  implementsSrs: SRReference[];
}

export interface RetainedSecondaryHazardAnalysis extends Unique, Named {
  hazardParameter: string;
  parameterUnits: string;
  affectedSeismicEquipmentListItemRefs: string[];
  failureMechanisms: {
    id: string;
    name: string;
    description: string;
    fragilityParameter: string;
    fragilityUnits: string;
  }[];
  hazardCurves: SecondaryHazardCurve[];
  calculationMethod: string;
  dataAndModelRefs: string[];
  uncertainties: HazardUncertainty[];
  sensitivityStudyRefs: string[];
  outputRefs: string[];
  implementsSrs: SRReference[];
}

export interface ExternalFloodingInterfaceRequirement {
  requirementGroup: "XFHA-A" | "XFHA-B" | "XFHA-C" | "XFHA-D" | "XFHA-E" | "XFHA-F" | "XFHA-G";
  applicable: boolean;
  status: "MET" | "PARTIAL" | "NOT_MET" | "NOT_APPLICABLE";
  satisfiedByRefs: string[];
  evidence: string;
}

export interface ExternalFloodingInterface {
  externalFloodingAnalysisRef?: string;
  mechanismDescription: string;
  interfaceRequirements: ExternalFloodingInterfaceRequirement[];
  hazardParameterResultsRefs: string[];
  fragilityFailureMechanismRefs: string[];
  interfaceBasis: string;
  implementsSrs: SRReference[];
}

export interface SecondarySeismicHazard extends Unique, Named {
  hazardType: SecondarySeismicHazardType;
  otherHazardType?: string;
  description: string;
  initiatingMechanisms: string[];
  siteEvidenceRefs: string[];
  potentiallyAffectedArea: string;
  potentiallyAffectedSeismicEquipmentListItemRefs: string[];
  screening: SecondaryHazardScreening;
  retainedAnalysis?: RetainedSecondaryHazardAnalysis;
  externalFloodingInterface?: ExternalFloodingInterface;
  implementsSrs: SRReference[];
}

export interface SecondaryHazardEvaluation {
  identificationMethod: string;
  siteAndRegionalHazardListSources: string[];
  hazards: SecondarySeismicHazard[];
  seismicEquipmentListRef?: string;
  screeningCriteriaReference: string;
  crossHazardDependencies: string[];
  completenessReview: string;
  implementsSrs: SRReference[];
}

export interface SeismicHazardTraceabilityLink extends Unique {
  sourceType:
    | "DATA_SET"
    | "INTERPRETATION"
    | "MODEL"
    | "LOGIC_TREE_BRANCH"
    | "CALCULATION"
    | "RESULT"
    | "REVIEW_FINDING";
  sourceRef: string;
  targetType: string;
  targetRef: string;
  relationship: string;
  requirementRefs: SRReference[];
}

export interface SeismicHazardDocumentation {
  processDescription: string;
  inputsDescription: string;
  modelStructureDescription: string;
  structuredProcessDescription: string;
  sourceCharacterizationMethods: string;
  groundMotionCharacterizationMethods: string;
  localSiteResponseMethods: string;
  scientificInterpretations: string;
  riskSignificantUncertaintiesAndAssumptions: string;
  existingAnalysisEvaluation?: string;
  verticalSpectraMethods: string;
  secondaryHazardMethods: string;
  hazardResultsSummary: string;
  modelUncertaintyDocumentation: string;
  boundingSiteBasis?: string;
  limitations: string[];
  dataAndModelReferences: string[];
  calculationFileRefs: string[];
  reviewRecordRefs: string[];
  traceabilityLinks: SeismicHazardTraceabilityLink[];
  implementsSrs: SRReference[];
}

export interface SeismicHazardAnalysis extends Unique, Named {
  praScope: string;

  analysisBasis: HazardAnalysisBasis;
  earthScienceInputs: EarthScienceInputs;
  sourceCharacterization: SeismicSourceCharacterization;
  groundMotionCharacterization: GroundMotionCharacterization;
  siteResponseAnalysis: SiteResponseAnalysis;
  hazardQuantification: HazardQuantification;
  responseSpectraEvaluation: ResponseSpectraEvaluation;
  secondaryHazardEvaluation: SecondaryHazardEvaluation;

  uncertainties: HazardUncertainty[];
  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];
  documentation: SeismicHazardDocumentation;
}

const ALL_PLANT_STAGES: PlantStage[] = ["OPERATIONAL", "PRE_OPERATIONAL"];

export const SHA_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  "SHA-A1": { hlr: "A", stages: ALL_PLANT_STAGES },
  "SHA-A2": { hlr: "A", stages: ALL_PLANT_STAGES },
  "SHA-A3": { hlr: "A", stages: ALL_PLANT_STAGES },
  "SHA-A4": { hlr: "A", stages: ALL_PLANT_STAGES },
  "SHA-A5": { hlr: "A", stages: ALL_PLANT_STAGES },
  "SHA-A6": { hlr: "A", stages: ALL_PLANT_STAGES },
  "SHA-A7": { hlr: "A", stages: ALL_PLANT_STAGES },
  "SHA-B1": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SHA-B2": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SHA-B3": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SHA-B4": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SHA-B5": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SHA-C1": { hlr: "C", stages: ALL_PLANT_STAGES },
  "SHA-C2": { hlr: "C", stages: ALL_PLANT_STAGES },
  "SHA-C3": { hlr: "C", stages: ALL_PLANT_STAGES },
  "SHA-C4": { hlr: "C", stages: ALL_PLANT_STAGES },
  "SHA-C5": { hlr: "C", stages: ALL_PLANT_STAGES },
  "SHA-D1": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SHA-D2": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SHA-D3": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SHA-D4": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SHA-E1": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SHA-E2": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SHA-E3": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SHA-E4": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SHA-E5": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SHA-E6": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SHA-F1": { hlr: "F", stages: ALL_PLANT_STAGES },
  "SHA-F2": { hlr: "F", stages: ALL_PLANT_STAGES },
  "SHA-F3": { hlr: "F", stages: ALL_PLANT_STAGES },
  "SHA-F4": { hlr: "F", stages: ALL_PLANT_STAGES },
  "SHA-G1": { hlr: "G", stages: ALL_PLANT_STAGES },
  "SHA-G2": { hlr: "G", stages: ALL_PLANT_STAGES },
  "SHA-H1": { hlr: "H", stages: ALL_PLANT_STAGES },
  "SHA-H2": { hlr: "H", stages: ALL_PLANT_STAGES },
  "SHA-H3": { hlr: "H", stages: ALL_PLANT_STAGES },
  "SHA-H4": { hlr: "H", stages: ALL_PLANT_STAGES },
  "SHA-I1": { hlr: "I", stages: ALL_PLANT_STAGES },
  "SHA-I2": { hlr: "I", stages: ALL_PLANT_STAGES },
  "SHA-I3": { hlr: "I", stages: ALL_PLANT_STAGES },
};
