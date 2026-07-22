import { z } from "zod";
import type { SeismicHazardAnalysis } from "../../sha/seismic-hazard-analysis";
import { ParameterDistributionSchema } from "../core/events";
import { BaseModelUncertaintyDocumentationSchema, PreOperationalAssumptionSchema } from "../core/documentation";
import { ImportanceLevelSchema, SensitivityStudySchema } from "../core/shared-patterns";
import { SRReferenceSchema } from "../core/pra-common";

export const SeismicSiteBasisSchema = z.enum(["IDENTIFIED_SITE", "BOUNDING_SITE"]);

export const StructuredHazardProcessTypeSchema = z.enum([
  "SSHAC_LEVEL_1",
  "SSHAC_LEVEL_2",
  "SSHAC_LEVEL_3",
  "SSHAC_LEVEL_4",
  "OTHER_STRUCTURED_PROCESS",
]);

export const GroundMotionParameterTypeSchema = z.enum([
  "PEAK_GROUND_ACCELERATION",
  "SPECTRAL_ACCELERATION",
  "AVERAGE_SPECTRAL_ACCELERATION",
]);

export const GroundMotionDirectionSchema = z.enum([
  "HORIZONTAL_1",
  "HORIZONTAL_2",
  "GEOMETRIC_MEAN_HORIZONTAL",
  "MAXIMUM_HORIZONTAL",
  "RANDOM_HORIZONTAL",
  "VERTICAL",
]);

export const EarthScienceDisciplineSchema = z.enum([
  "GEOLOGY",
  "SEISMOLOGY",
  "GEOPHYSICS",
  "GEOTECHNICAL",
  "TOPOGRAPHY",
  "PALEOSEISMOLOGY",
  "STRONG_MOTION",
]);

export const EarthquakeCatalogRecordTypeSchema = z.enum(["HISTORICAL", "INSTRUMENTAL", "PALEOSEISMIC"]);

export const SeismicSourceTypeSchema = z.enum([
  "FAULT",
  "AREA",
  "BACKGROUND",
  "SUBDUCTION_INTERFACE",
  "SUBDUCTION_SLAB",
  "INDUCED",
  "OTHER",
]);

export const FaultMechanismSchema = z.enum(["STRIKE_SLIP", "NORMAL", "REVERSE", "OBLIQUE", "UNKNOWN"]);

export const LogicTreeNodeKindSchema = z.enum([
  "SOURCE_GEOMETRY",
  "MAXIMUM_MAGNITUDE",
  "RECURRENCE",
  "GROUND_MOTION_MODEL",
  "SITE_RESPONSE",
  "OTHER",
]);

export const SiteResponseDimensionSchema = z.enum(["ONE_DIMENSIONAL", "TWO_DIMENSIONAL", "THREE_DIMENSIONAL"]);

export const HazardCurveStatisticSchema = z.enum(["MEAN", "FRACTILE", "INDIVIDUAL_BRANCH"]);

export const ResponseSpectrumTypeSchema = z.enum([
  "UNIFORM_HAZARD",
  "HORIZONTAL_HAZARD_CONSISTENT",
  "VERTICAL_HAZARD_CONSISTENT",
  "FOUNDATION_INPUT_RESPONSE_SPECTRUM",
]);

export const SecondarySeismicHazardTypeSchema = z.enum([
  "FAULT_DISPLACEMENT",
  "LANDSLIDE",
  "SOIL_LIQUEFACTION",
  "SOIL_SETTLEMENT",
  "GROUND_FAILURE",
  "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING",
  "TSUNAMI_OR_SEICHE",
  "OTHER",
]);

export const SecondaryHazardDispositionSchema = z.enum(["SCREENED_OUT", "RETAINED"]);
export const SecondaryHazardScreeningCriterionSchema = z.enum(["SCR-2", "SCR-3", "NOT_SCREENED"]);

export const GeographicLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().optional(),
  elevationUnit: z.string().optional(),
  horizontalDatum: z.string(),
  verticalDatum: z.string().optional(),
});

export const BoundingSiteCharacteristicSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  value: z.union([z.number(), z.string()]).optional(),
  units: z.string().optional(),
  lowerBound: z.number().optional(),
  upperBound: z.number().optional(),
  boundingDirection: z.enum(["UPPER", "LOWER", "RANGE", "QUALITATIVE"]),
  basis: z.string(),
  candidateSiteRefs: z.array(z.string()).optional(),
});

export const SeismicSiteDefinitionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  siteBasis: SeismicSiteBasisSchema,
  siteName: z.string().optional(),
  location: GeographicLocationSchema.optional(),
  candidateSites: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        location: GeographicLocationSchema.optional(),
        inclusionBasis: z.string(),
      }),
    )
    .optional(),
  boundingCharacteristics: z.array(BoundingSiteCharacteristicSchema).optional(),
  applicableSiteRange: z.string().optional(),
  selectionAndApplicabilityBasis: z.string(),
  boundsAllSitesInScope: z.boolean(),
  boundingDemonstration: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HazardProcessParticipantSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  organization: z.string().optional(),
  role: z.enum([
    "PROJECT_MANAGER",
    "TECHNICAL_INTEGRATOR",
    "RESOURCE_EXPERT",
    "EVALUATOR_EXPERT",
    "PROPONENT_EXPERT",
    "PEER_REVIEWER",
    "OTHER",
  ]),
  discipline: z.union([EarthScienceDisciplineSchema, z.enum(["INTEGRATION", "OTHER"])]).optional(),
  responsibilities: z.array(z.string()),
  qualifications: z.string().optional(),
  conflictOfInterestEvaluation: z.string().optional(),
});

export const HazardProcessActivitySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  activityType: z.enum([
    "PLANNING",
    "DATA_EVALUATION",
    "WORKSHOP",
    "MODEL_DEVELOPMENT",
    "INTEGRATION",
    "DOCUMENTATION",
    "REVIEW",
  ]),
  date: z.string().optional(),
  objective: z.string(),
  participants: z.array(z.string()),
  inputs: z.array(z.string()),
  decisions: z.array(z.string()),
  outputs: z.array(z.string()),
  recordReference: z.string().optional(),
});

export const StructuredHazardProcessSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  processType: StructuredHazardProcessTypeSchema,
  alternateProcessDescription: z.string().optional(),
  processLevelBasis: z.string(),
  studyObjective: z.string(),
  participants: z.array(HazardProcessParticipantSchema),
  activities: z.array(HazardProcessActivitySchema),
  technicalIntegrationApproach: z.string(),
  evaluationAndIntegrationMethods: z.string(),
  centerBodyRangeDemonstration: z.string(),
  qualityAssuranceProcess: z.string(),
  independentReviewProcess: z.string(),
  deviationsAndLimitations: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const GroundMotionParameterDefinitionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  parameterType: GroundMotionParameterTypeSchema,
  direction: GroundMotionDirectionSchema,
  units: z.string(),
  dampingRatio: z.number().optional(),
  oscillatorPeriodSeconds: z.number().optional(),
  oscillatorFrequencyHz: z.number().optional(),
  averagingFrequencyBandHz: z
    .object({
      lower: z.number(),
      upper: z.number(),
      averagingMethod: z.string(),
    })
    .optional(),
  componentDefinition: z.string(),
  selectedRange: z.object({
    minimum: z.number(),
    maximum: z.number(),
  }),
  selectedFrequencyRangeHz: z.object({
    lower: z.number(),
    upper: z.number(),
  }),
  usedForHazard: z.boolean(),
  usedForFragility: z.boolean(),
  usedForPlantResponse: z.boolean(),
  consistencyBasis: z.string(),
  downstreamElementRefs: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HazardCalculationBoundsSchema = z.object({
  maximumGroundMotion: z.number(),
  groundMotionUnits: z.string(),
  tailExtrapolationMethod: z.string(),
  truncationImpactEvaluation: z.string(),
  sequenceRankingUnaffected: z.boolean(),
  lowerBoundMagnitude: z.number(),
  magnitudeScale: z.string(),
  lowerBoundMagnitudeBasis: z.string(),
  epsilonLimit: z.number(),
  epsilonTailTreatment: z.string(),
  epsilonLimitBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HazardAnalysisBasisSchema = z.object({
  site: SeismicSiteDefinitionSchema,
  structuredProcess: StructuredHazardProcessSchema,
  groundMotionParameters: z.array(GroundMotionParameterDefinitionSchema),
  calculationBounds: HazardCalculationBoundsSchema,
  seismicFragilityAnalysisRef: z.string().optional(),
  seismicPlantResponseAnalysisRef: z.string().optional(),
  eventSequenceQuantificationRef: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EarthScienceDataSetSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  discipline: EarthScienceDisciplineSchema,
  sourceOrganization: z.string(),
  sourceReference: z.string(),
  publicationOrAcquisitionDate: z.string().optional(),
  dataCutoffDate: z.string().optional(),
  spatialCoverage: z.string(),
  temporalCoverage: z.string().optional(),
  resolution: z.string().optional(),
  format: z.string().optional(),
  qualityAndLimitations: z.string(),
  currentnessAssessment: z.string(),
  interpretationsSupported: z.array(z.string()),
  fileReference: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicStudyRegionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  boundaryDescription: z.string(),
  radialExtentKm: z.number().optional(),
  tectonicSetting: z.string(),
  includedSourceRegions: z.array(z.string()),
  majorContributorCoverageBasis: z.string(),
  regionalPropagationDataSufficiency: z.string(),
  localSiteEffectsDataSufficiency: z.string(),
  uncertaintyCoverageBasis: z.string(),
  mapReference: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EarthquakeCatalogEventSchema = z.object({
  uuid: z.string(),
  recordType: EarthquakeCatalogRecordTypeSchema,
  eventDateOrAge: z.string(),
  location: GeographicLocationSchema.optional(),
  locationDescription: z.string().optional(),
  magnitude: z.number().optional(),
  magnitudeScale: z.string().optional(),
  magnitudeUncertainty: z.number().optional(),
  depthKm: z.number().optional(),
  depthUncertaintyKm: z.number().optional(),
  sourceReferences: z.array(z.string()),
  associatedSourceRef: z.string().optional(),
  qualityFlags: z.array(z.string()).optional(),
  comments: z.string().optional(),
});

export const EarthquakeCatalogSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  catalogStartDateOrAge: z.string(),
  catalogEndDate: z.string(),
  magnitudeScales: z.array(z.string()),
  homogenizationMethod: z.string(),
  declusteringMethod: z.string().optional(),
  completenessAssessment: z.string(),
  locationAndMagnitudeUncertaintyTreatment: z.string(),
  duplicateResolutionMethod: z.string(),
  events: z.array(EarthquakeCatalogEventSchema),
  sourceReferences: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EarthScienceModelInventoryEntrySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  modelKind: z.enum(["SEISMIC_SOURCE", "GROUND_MOTION", "SITE_RESPONSE", "REGIONAL_PROPAGATION", "OTHER"]),
  version: z.string().optional(),
  publicationDate: z.string().optional(),
  sourceReference: z.string(),
  applicability: z.string(),
  limitations: z.array(z.string()),
  knownToExistingAnalysis: z.boolean(),
  previouslyUsed: z.boolean(),
  potentialImpactOnHazard: z.string(),
  disposition: z.enum(["INCLUDED", "BOUNDED_BY_EXISTING_MODEL", "EXCLUDED", "REQUIRES_UPDATE"]),
  dispositionBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EarthScienceInputsSchema = z.object({
  dataSets: z.array(EarthScienceDataSetSchema),
  studyRegions: z.array(SeismicStudyRegionSchema),
  earthquakeCatalog: EarthquakeCatalogSchema,
  modelAndMethodInventory: z.array(EarthScienceModelInventoryEntrySchema),
  dataGapAssessment: z.string(),
  subjectMatterExpertReview: z.string(),
  compilationCutoffDate: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const LogicTreeBranchSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  modelRef: z.string().optional(),
  value: z.union([z.number(), z.string()]).optional(),
  weight: z.number(),
  technicalBasis: z.string(),
  dataSupport: z.array(z.string()),
  limitations: z.array(z.string()).optional(),
});

export const LogicTreeNodeSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  nodeKind: LogicTreeNodeKindSchema,
  parentBranchRef: z.string().optional(),
  branches: z.array(LogicTreeBranchSchema),
  weightSum: z.number(),
  dependencyTreatment: z.string().optional(),
  elicitationBasis: z.string(),
});

export const EpistemicLogicTreeSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  nodes: z.array(LogicTreeNodeSchema),
  totalEndBranchCount: z.number().optional(),
  branchWeightReview: z.string(),
  dependenciesAndCorrelations: z.string(),
  centerBodyRangeCoverage: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicSourceGeometrySchema = z.object({
  geometryType: z.enum(["POINT", "LINE", "AREA", "PLANE", "VOLUME"]),
  geometryDescription: z.string(),
  coordinateReferenceSystem: z.string().optional(),
  geometryFileRef: z.string().optional(),
  closestDistanceToSiteKm: z.number().optional(),
  depthRangeKm: z
    .object({
      minimum: z.number(),
      maximum: z.number(),
    })
    .optional(),
  strikeDegrees: z.number().optional(),
  dipDegrees: z.number().optional(),
  uncertaintyDescription: z.string(),
});

export const MagnitudeFrequencyModelSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  modelType: z.enum(["GUTENBERG_RICHTER", "CHARACTERISTIC", "RENEWAL", "FIXED_RATE", "OTHER"]),
  minimumMagnitude: z.number(),
  maximumMagnitude: z.number(),
  magnitudeScale: z.string(),
  annualRateAboveMinimum: z.number().optional(),
  aValue: z.number().optional(),
  bValue: z.number().optional(),
  recurrenceIntervalYears: z.number().optional(),
  parameterDistributions: z.record(z.string(), ParameterDistributionSchema).optional(),
  dataAndMethodBasis: z.string(),
});

export const SeismicSourceSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  sourceType: SeismicSourceTypeSchema,
  tectonicRegionType: z.string(),
  active: z.boolean(),
  faultMechanisms: z.array(FaultMechanismSchema),
  geometry: SeismicSourceGeometrySchema,
  magnitudeFrequencyModels: z.array(MagnitudeFrequencyModelSchema),
  paleoseismicEventRefs: z.array(z.string()).optional(),
  historicalAndInstrumentalEventRefs: z.array(z.string()).optional(),
  sourceDataRefs: z.array(z.string()),
  majorHazardContributor: z.boolean(),
  characterizationBasis: z.string(),
  uncertainties: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ExistingModelAssessmentSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  modelType: z.enum(["SEISMIC_SOURCE", "GROUND_MOTION", "SITE_RESPONSE", "COMPLETE_HAZARD_ANALYSIS"]),
  modelVersion: z.string(),
  originalStudyDate: z.string().optional(),
  newDataModelMethodRefs: z.array(z.string()),
  centerBodyRangeCoverageEvaluation: z.string(),
  technicalValidityEvaluation: z.string(),
  updateRequired: z.boolean(),
  updateLevel: z.string().optional(),
  updateMethod: z.string().optional(),
  updateJustification: z.string().optional(),
  resultingModelRef: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicSourceCharacterizationSchema = z.object({
  structuredApproach: z.string(),
  earthquakeSources: z.array(SeismicSourceSchema),
  sourceLogicTree: EpistemicLogicTreeSchema,
  uncertaintyIdentificationMethod: z.string(),
  existingModelAssessments: z.array(ExistingModelAssessmentSchema),
  sourceModelReference: z.string(),
  technicalIntegrationSummary: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const StrongMotionDataSetSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  sourceReference: z.string(),
  tectonicRegions: z.array(z.string()),
  magnitudeRange: z.object({
    minimum: z.number(),
    maximum: z.number(),
  }),
  distanceRangeKm: z.object({
    minimum: z.number(),
    maximum: z.number(),
  }),
  siteConditionRange: z.string(),
  recordCount: z.number().optional(),
  componentDefinition: z.string(),
  qualityScreening: z.string(),
  useInCalibration: z.string(),
});

export const GroundMotionPredictionModelSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  modelKind: z.enum(["PUBLISHED_GMPE", "PROJECT_SPECIFIC_GMPE", "SIMULATION", "HYBRID"]),
  version: z.string().optional(),
  sourceReference: z.string(),
  tectonicRegionTypes: z.array(z.string()),
  faultMechanisms: z.array(FaultMechanismSchema),
  magnitudeRange: z.object({
    minimum: z.number(),
    maximum: z.number(),
  }),
  distanceRangeKm: z.object({
    minimum: z.number(),
    maximum: z.number(),
  }),
  supportedParameterRefs: z.array(z.string()),
  horizontalComponentDefinition: z.string(),
  siteTermDefinition: z.string(),
  medianModelDescription: z.string(),
  aleatoryVariabilityDescription: z.string(),
  sigmaComponents: z
    .object({
      total: z.number().optional(),
      interEvent: z.number().optional(),
      intraEvent: z.number().optional(),
    })
    .optional(),
  extrapolationAndTruncation: z.string(),
  applicabilityAndLimitations: z.string(),
  calibrationDataRefs: z.array(z.string()),
  logicTreeWeight: z.number(),
  selectionBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ReferenceHorizonSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  horizonType: z.enum(["ROCK", "SOIL"]),
  depth: z.number(),
  depthUnit: z.string(),
  shearWaveVelocity: z.number(),
  shearWaveVelocityUnit: z.string(),
  density: z.number(),
  densityUnit: z.string(),
  dampingRatio: z.number(),
  definitionBasis: z.string(),
  uncertaintyDescription: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HazardUncertaintySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  uncertaintyType: z.enum(["ALEATORY", "EPISTEMIC"]),
  analysisArea: z.enum([
    "SOURCE",
    "GROUND_MOTION",
    "SITE_RESPONSE",
    "VERTICAL_MOTION",
    "SECONDARY_HAZARD",
    "INTEGRATION",
  ]),
  description: z.string(),
  affectedModelRefs: z.array(z.string()),
  affectedResultRefs: z.array(z.string()),
  characterizationMethod: z.string(),
  distribution: ParameterDistributionSchema.optional(),
  logicTreeNodeRef: z.string().optional(),
  correlationAndDependencyTreatment: z.string().optional(),
  propagationMethod: z.string(),
  importance: ImportanceLevelSchema.optional(),
  riskSignificanceBasis: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const GroundMotionCharacterizationSchema = z.object({
  governingMechanisms: z.array(z.string()),
  historicalAndInstrumentalReview: z.string(),
  strongMotionDataSets: z.array(StrongMotionDataSetSchema),
  modelSelectionCriteria: z.array(z.string()),
  predictionModels: z.array(GroundMotionPredictionModelSchema),
  groundMotionLogicTree: EpistemicLogicTreeSchema,
  referenceHorizons: z.array(ReferenceHorizonSchema),
  processCompatibilityBasis: z.string(),
  uncertainties: z.array(HazardUncertaintySchema),
  siteToSiteVariabilityIncluded: z.boolean(),
  siteToSiteVariabilityTreatment: z.string().optional(),
  boundingSiteVariabilityJustification: z.string().optional(),
  existingModelAssessments: z.array(ExistingModelAssessmentSchema),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MaterialPropertySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  propertyType: z.enum([
    "SHEAR_WAVE_VELOCITY",
    "COMPRESSIONAL_WAVE_VELOCITY",
    "DENSITY",
    "DAMPING",
    "SHEAR_MODULUS",
    "POISSON_RATIO",
    "OTHER",
  ]),
  value: z.number(),
  units: z.string(),
  distribution: ParameterDistributionSchema.optional(),
  correlationGroup: z.string().optional(),
  sourceReference: z.string(),
  basisAndLimitations: z.string(),
});

export const StrainDependentPropertyPointSchema = z.object({
  shearStrain: z.number(),
  modulusReductionRatio: z.number(),
  dampingRatio: z.number(),
});

export const GeotechnicalLayerSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  materialType: z.string(),
  topDepth: z.number(),
  bottomDepth: z.number(),
  depthUnit: z.string(),
  thickness: z.number(),
  properties: z.array(MaterialPropertySchema),
  strainDependentProperties: z.array(StrainDependentPropertyPointSchema).optional(),
  spatialVariability: z.string(),
  sourceReferences: z.array(z.string()),
});

export const GeotechnicalProfileSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  profileType: z.enum(["BEST_ESTIMATE", "LOWER_BOUND", "UPPER_BOUND", "ALTERNATIVE", "BOUNDING_SITE"]),
  locationDescription: z.string(),
  layers: z.array(GeotechnicalLayerSchema),
  depthToBedrock: z.number(),
  depthUnit: z.string(),
  bedrockDefinition: z.string(),
  groundwaterDepth: z.number().optional(),
  profileWeight: z.number().optional(),
  siteVariabilityBasis: z.string(),
  sourceReferences: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SiteTopographyAndGeologySchema = z.object({
  topographicDescription: z.string(),
  topographicDataRefs: z.array(z.string()),
  surficialDepositDescription: z.string(),
  surficialGeologyDataRefs: z.array(z.string()),
  geologicStructureDescription: z.string(),
  geotechnicalInvestigationRefs: z.array(z.string()),
  topographicEffectsSignificant: z.boolean(),
  topographicEffectsTreatment: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SiteResponseMethodSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  dimension: SiteResponseDimensionSchema,
  analysisType: z.enum(["EQUIVALENT_LINEAR", "NONLINEAR", "RANDOM_VIBRATION_THEORY", "TIME_DOMAIN", "OTHER"]),
  softwareAndVersion: z.string().optional(),
  methodDescription: z.string(),
  dimensionSelectionBasis: z.string(),
  inputLocation: z.string(),
  outputLocation: z.string(),
  boundaryConditions: z.string(),
  materialModelDescription: z.string(),
  verificationAndValidation: z.string(),
  limitations: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SiteResponseInputMotionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  inputType: z.enum(["RESPONSE_SPECTRUM", "TIME_HISTORY", "FOURIER_AMPLITUDE_SPECTRUM", "RANDOM_VIBRATION"]),
  referenceHorizonRef: z.string(),
  groundMotionParameterRef: z.string(),
  amplitudeLevels: z.array(z.number()),
  units: z.string(),
  timeHistoryRefs: z.array(z.string()).optional(),
  spectrumRef: z.string().optional(),
  selectionAndScalingBasis: z.string(),
});

export const SiteAmplificationPointSchema = z.object({
  inputGroundMotion: z.number(),
  frequencyHz: z.number(),
  medianAmplification: z.number(),
  logarithmicStandardDeviation: z.number().optional(),
  fractileAmplifications: z
    .array(
      z.object({
        fractile: z.number(),
        amplification: z.number(),
      }),
    )
    .optional(),
});

export const SiteAmplificationResultSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  profileRefs: z.array(z.string()),
  methodRef: z.string(),
  inputMotionRef: z.string(),
  outputControlPointRef: z.string(),
  points: z.array(SiteAmplificationPointSchema),
  weightingAndCombinationMethod: z.string(),
  nonlinearEffectsTreatment: z.string(),
  uncertaintyTreatment: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SiteResponseAnalysisSchema = z.object({
  topographyAndGeology: SiteTopographyAndGeologySchema,
  profiles: z.array(GeotechnicalProfileSchema),
  methods: z.array(SiteResponseMethodSchema),
  inputMotions: z.array(SiteResponseInputMotionSchema),
  amplificationResults: z.array(SiteAmplificationResultSchema),
  incorporationIntoHazardMethod: z.string(),
  uncertainties: z.array(HazardUncertaintySchema),
  localSiteResponseIncluded: z.boolean(),
  boundingSiteVariabilityIncluded: z.boolean(),
  boundingSiteVariabilityTreatment: z.string().optional(),
  approachJustification: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HazardCurvePointSchema = z.object({
  groundMotion: z.number(),
  annualFrequencyOfExceedance: z.number(),
});

export const HazardCurveSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  groundMotionParameterRef: z.string(),
  controlPointRef: z.string(),
  direction: GroundMotionDirectionSchema,
  statistic: HazardCurveStatisticSchema,
  fractile: z.number().optional(),
  branchRef: z.string().optional(),
  groundMotionUnits: z.string(),
  frequencyUnit: z.string(),
  points: z.array(HazardCurvePointSchema),
  interpolationMethod: z.string(),
  extrapolationMethod: z.string().optional(),
  calculationRunRef: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ResponseSpectrumPointSchema = z.object({
  periodSeconds: z.number(),
  frequencyHz: z.number(),
  spectralAcceleration: z.number(),
  units: z.string(),
});

export const ResponseSpectrumSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  spectrumType: ResponseSpectrumTypeSchema,
  direction: GroundMotionDirectionSchema,
  controlPointRef: z.string(),
  annualFrequencyOfExceedance: z.number().optional(),
  dampingRatio: z.number(),
  statistic: z.enum(["MEAN", "FRACTILE", "DETERMINISTIC_SHAPE"]),
  fractile: z.number().optional(),
  points: z.array(ResponseSpectrumPointSchema),
  derivationMethod: z.string(),
  sourceHazardCurveRefs: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MagnitudeDistanceDeaggregationBinSchema = z.object({
  magnitudeLower: z.number(),
  magnitudeUpper: z.number(),
  distanceLowerKm: z.number(),
  distanceUpperKm: z.number(),
  contributionFraction: z.number(),
});

export const HazardDeaggregationContributionSchema = z.object({
  contributorRef: z.string(),
  contributorName: z.string(),
  contributionFraction: z.number(),
});

export const EpsilonDeaggregationBinSchema = z.object({
  epsilonLower: z.number(),
  epsilonUpper: z.number(),
  contributionFraction: z.number(),
});

export const HazardDeaggregationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  groundMotionParameterRef: z.string(),
  controlPointRef: z.string(),
  groundMotionLevel: z.number(),
  groundMotionUnits: z.string(),
  annualFrequencyOfExceedance: z.number().optional(),
  meanMagnitude: z.number(),
  meanDistanceKm: z.number(),
  magnitudeDistanceBins: z.array(MagnitudeDistanceDeaggregationBinSchema),
  sourceContributions: z.array(HazardDeaggregationContributionSchema),
  groundMotionModelContributions: z.array(HazardDeaggregationContributionSchema),
  epsilonContributions: z.array(EpsilonDeaggregationBinSchema).optional(),
  calculationRunRef: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HazardCalculationRunSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  calculationDate: z.string(),
  software: z.string(),
  softwareVersion: z.string(),
  sourceModelRef: z.string(),
  groundMotionModelRef: z.string(),
  siteResponseModelRefs: z.array(z.string()),
  logicTreeEndBranchCount: z.number().optional(),
  numericalIntegrationMethod: z.string(),
  magnitudeStep: z.number(),
  distanceStepKm: z.number(),
  annualFrequencyRange: z.object({
    minimum: z.number(),
    maximum: z.number(),
  }),
  convergenceCriteria: z.string(),
  convergenceDemonstration: z.string(),
  verificationChecks: z.array(z.string()),
  warningsAndLimitations: z.array(z.string()),
  outputFileRefs: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicHazardIntervalSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  groundMotionParameterRef: z.string(),
  controlPointRef: z.string(),
  lowerGroundMotion: z.number(),
  upperGroundMotion: z.number(),
  representativeGroundMotion: z.number(),
  groundMotionUnits: z.string(),
  annualFrequency: z.number(),
  frequencyUnit: z.string(),
  frequencyCalculationMethod: z.string(),
  sourceHazardCurveRef: z.string(),
  verticalMotionRef: z.string().optional(),
  secondaryHazardResultRefs: z.array(z.string()).optional(),
  usedByEventSequenceFamilyRefs: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicPraHazardInputsSchema = z.object({
  hazardIntervals: z.array(SeismicHazardIntervalSchema),
  fragilityInputSpectrumRefs: z.array(z.string()),
  plantResponseInputRefs: z.array(z.string()),
  eventSequenceQuantificationInputRefs: z.array(z.string()),
  verticalMotionResultRefs: z.array(z.string()),
  secondaryHazardResultRefs: z.array(z.string()),
  transferBasis: z.string(),
  consistencyChecks: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const KeyHazardUncertaintyFindingSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  uncertaintyRef: z.string(),
  analysisArea: HazardUncertaintySchema.shape.analysisArea,
  affectedResultRefs: z.array(z.string()),
  identificationMethod: z.string(),
  sensitivityStudyRefs: z.array(z.string()),
  effectOnResults: z.string(),
  effectOnSeismicPraQuantification: z.string(),
  importance: ImportanceLevelSchema,
  implementsSrs: z.array(SRReferenceSchema),
});

export const HazardQuantificationSchema = z.object({
  calculationRuns: z.array(HazardCalculationRunSchema),
  hazardCurves: z.array(HazardCurveSchema),
  uniformHazardSpectra: z.array(ResponseSpectrumSchema),
  deaggregations: z.array(HazardDeaggregationSchema),
  seismicPraInputs: SeismicPraHazardInputsSchema,
  uncertaintyPropagationMethod: z.string(),
  aleatoryUncertaintiesPropagated: z.boolean(),
  epistemicUncertaintiesPropagated: z.boolean(),
  sensitivityStudies: z.array(SensitivityStudySchema),
  keyUncertaintyFindings: z.array(KeyHazardUncertaintyFindingSchema),
  resultQualityChecks: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicControlPointSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  controlPointType: z.enum(["GROUND_SURFACE", "FOUNDATION", "FREE_FIELD", "REFERENCE_HORIZON", "OTHER"]),
  locationDescription: z.string(),
  elevation: z.number().optional(),
  elevationUnit: z.string().optional(),
  coordinateReference: z.string().optional(),
  applicableStructureRefs: z.array(z.string()).optional(),
  transferFunctionRef: z.string().optional(),
  basis: z.string(),
});

export const HorizontalSpectralShapeBasisSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  spectrumRef: z.string(),
  groundMotionLevel: z.number(),
  groundMotionUnits: z.string(),
  meanMagnitude: z.number(),
  meanDistanceKm: z.number(),
  controllingSourceRefs: z.array(z.string()),
  characteristicShapeRefs: z.array(z.string()),
  usesOrBoundsCharacteristicShapes: z.boolean(),
  evaluationBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const VerticalSpectrumBasisSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  spectrumRef: z.string(),
  methodType: z.enum(["VERTICAL_GMPE", "VERTICAL_TO_HORIZONTAL_RATIO", "SITE_SPECIFIC_ANALYSIS", "OTHER"]),
  methodDescription: z.string(),
  dataAndModelRefs: z.array(z.string()),
  verticalToHorizontalRatios: z
    .array(
      z.object({
        periodSeconds: z.number(),
        frequencyHz: z.number(),
        ratio: z.number(),
      }),
    )
    .optional(),
  stateOfKnowledgeAssessment: z.string(),
  appropriatenessJustification: z.string(),
  limitations: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const FoundationInputResponseSpectrumSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  structureRef: z.string(),
  controlPointRef: z.string(),
  horizontalSpectrumRefs: z.array(z.string()),
  verticalSpectrumRef: z.string().optional(),
  soilStructureInteractionTreatment: z.string(),
  derivationMethod: z.string(),
  applicabilityAndLimitations: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ResponseSpectraEvaluationSchema = z.object({
  controlPoints: z.array(SeismicControlPointSchema),
  horizontalSpectra: z.array(ResponseSpectrumSchema),
  horizontalShapeBases: z.array(HorizontalSpectralShapeBasisSchema),
  verticalSpectra: z.array(ResponseSpectrumSchema),
  verticalSpectrumBases: z.array(VerticalSpectrumBasisSchema),
  foundationInputResponseSpectra: z.array(FoundationInputResponseSpectrumSchema),
  downstreamConsistencyBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SecondaryHazardScreeningSchema = z.object({
  disposition: SecondaryHazardDispositionSchema,
  criterion: SecondaryHazardScreeningCriterionSchema,
  methodology: z.string(),
  demonstrablyConservative: z.boolean(),
  screeningBasis: z.string(),
  calculationsAndEvidenceRefs: z.array(z.string()),
  reviewer: z.string().optional(),
  reviewDate: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SecondaryHazardCurvePointSchema = z.object({
  hazardLevel: z.number(),
  annualFrequencyOfExceedance: z.number(),
});

export const SecondaryHazardCurveSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  hazardParameter: z.string(),
  hazardParameterUnits: z.string(),
  statistic: HazardCurveStatisticSchema,
  fractile: z.number().optional(),
  points: z.array(SecondaryHazardCurvePointSchema),
  calculationRunRef: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RetainedSecondaryHazardAnalysisSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  hazardParameter: z.string(),
  parameterUnits: z.string(),
  affectedSeismicEquipmentListItemRefs: z.array(z.string()),
  failureMechanisms: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      fragilityParameter: z.string(),
      fragilityUnits: z.string(),
    }),
  ),
  hazardCurves: z.array(SecondaryHazardCurveSchema),
  calculationMethod: z.string(),
  dataAndModelRefs: z.array(z.string()),
  uncertainties: z.array(HazardUncertaintySchema),
  sensitivityStudyRefs: z.array(z.string()),
  outputRefs: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ExternalFloodingInterfaceRequirementSchema = z.object({
  requirementGroup: z.enum(["XFHA-A", "XFHA-B", "XFHA-C", "XFHA-D", "XFHA-E", "XFHA-F", "XFHA-G"]),
  applicable: z.boolean(),
  status: z.enum(["MET", "PARTIAL", "NOT_MET", "NOT_APPLICABLE"]),
  satisfiedByRefs: z.array(z.string()),
  evidence: z.string(),
});

export const ExternalFloodingInterfaceSchema = z.object({
  externalFloodingAnalysisRef: z.string().optional(),
  mechanismDescription: z.string(),
  interfaceRequirements: z.array(ExternalFloodingInterfaceRequirementSchema),
  hazardParameterResultsRefs: z.array(z.string()),
  fragilityFailureMechanismRefs: z.array(z.string()),
  interfaceBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SecondarySeismicHazardSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  hazardType: SecondarySeismicHazardTypeSchema,
  otherHazardType: z.string().optional(),
  description: z.string(),
  initiatingMechanisms: z.array(z.string()),
  siteEvidenceRefs: z.array(z.string()),
  potentiallyAffectedArea: z.string(),
  potentiallyAffectedSeismicEquipmentListItemRefs: z.array(z.string()),
  screening: SecondaryHazardScreeningSchema,
  retainedAnalysis: RetainedSecondaryHazardAnalysisSchema.optional(),
  externalFloodingInterface: ExternalFloodingInterfaceSchema.optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SecondaryHazardEvaluationSchema = z.object({
  identificationMethod: z.string(),
  siteAndRegionalHazardListSources: z.array(z.string()),
  hazards: z.array(SecondarySeismicHazardSchema),
  seismicEquipmentListRef: z.string().optional(),
  screeningCriteriaReference: z.string(),
  crossHazardDependencies: z.array(z.string()),
  completenessReview: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicHazardTraceabilityLinkSchema = z.object({
  uuid: z.string(),
  sourceType: z.enum([
    "DATA_SET",
    "INTERPRETATION",
    "MODEL",
    "LOGIC_TREE_BRANCH",
    "CALCULATION",
    "RESULT",
    "REVIEW_FINDING",
  ]),
  sourceRef: z.string(),
  targetType: z.string(),
  targetRef: z.string(),
  relationship: z.string(),
  requirementRefs: z.array(SRReferenceSchema),
});

export const SeismicHazardDocumentationSchema = z.object({
  processDescription: z.string(),
  inputsDescription: z.string(),
  modelStructureDescription: z.string(),
  structuredProcessDescription: z.string(),
  sourceCharacterizationMethods: z.string(),
  groundMotionCharacterizationMethods: z.string(),
  localSiteResponseMethods: z.string(),
  scientificInterpretations: z.string(),
  riskSignificantUncertaintiesAndAssumptions: z.string(),
  existingAnalysisEvaluation: z.string().optional(),
  verticalSpectraMethods: z.string(),
  secondaryHazardMethods: z.string(),
  hazardResultsSummary: z.string(),
  modelUncertaintyDocumentation: z.string(),
  boundingSiteBasis: z.string().optional(),
  limitations: z.array(z.string()),
  dataAndModelReferences: z.array(z.string()),
  calculationFileRefs: z.array(z.string()),
  reviewRecordRefs: z.array(z.string()),
  traceabilityLinks: z.array(SeismicHazardTraceabilityLinkSchema),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicHazardAnalysisSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  praScope: z.string(),
  analysisBasis: HazardAnalysisBasisSchema,
  earthScienceInputs: EarthScienceInputsSchema,
  sourceCharacterization: SeismicSourceCharacterizationSchema,
  groundMotionCharacterization: GroundMotionCharacterizationSchema,
  siteResponseAnalysis: SiteResponseAnalysisSchema,
  hazardQuantification: HazardQuantificationSchema,
  responseSpectraEvaluation: ResponseSpectraEvaluationSchema,
  secondaryHazardEvaluation: SecondaryHazardEvaluationSchema,
  uncertainties: z.array(HazardUncertaintySchema),
  modelUncertainty: BaseModelUncertaintyDocumentationSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  documentation: SeismicHazardDocumentationSchema,
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertShaMirrorsType = Expect<Equal<z.infer<typeof SeismicHazardAnalysisSchema>, SeismicHazardAnalysis>>;
