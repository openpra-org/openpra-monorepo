import { z } from "zod";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { HazardConditionedMethodModelsSchema, createEmptyHazardConditionedMethodModels } from "../hazard-conditioned-models";
import {
  ExternalFloodAnalysisRecordSchema,
  ExternalFloodEffectTypeSchema,
  ExternalFloodHazardTypeSchema,
  ExternalFloodInvestigationSchema,
  ExternalFloodModelUncertaintySchema,
  ExternalFloodPraInterfaceRecordSchema,
  ExternalFloodPreOperationalAssumptionSchema,
  ExternalFloodProcessDocumentationSchema,
} from "./external-flood-pra-common";

const strings = z.array(z.string());
const numbers = z.array(z.number());
const numberRecord = z.record(z.string(), z.number());
const hazardTypes = z.array(ExternalFloodHazardTypeSchema);
const floodEffects = z.array(ExternalFloodEffectTypeSchema);
const record = <T extends z.ZodRawShape>(shape: T) => ExternalFloodAnalysisRecordSchema.extend(shape);
const technicalSection = <T extends z.ZodRawShape>(shape: T) => z.object({
  ...shape,
  modelUncertainties: z.array(ExternalFloodModelUncertaintySchema),
  preOperationalAssumptions: z.array(ExternalFloodPreOperationalAssumptionSchema),
  documentation: ExternalFloodProcessDocumentationSchema,
});

export const ExternalFloodPraApplicationSchema = record({
  purpose: z.string(), decisionContext: z.string(), supportedRiskMetrics: strings,
  consumingElementRefs: strings, configurationBasis: z.string(), limitations: strings,
});

export const ExternalFloodPraEvidenceRecordSchema = record({
  evidenceType: z.enum(["STANDARD", "HYDROMETEOROLOGICAL_DATA", "TOPOGRAPHIC_SURVEY", "DRAWING", "CALCULATION", "PROCEDURE", "MODEL", "WALKDOWN", "INTERVIEW", "OPERATING_EXPERIENCE", "REVIEW", "OTHER"]),
  sourceReference: z.string(), revision: z.string().optional(), effectiveDate: z.string().optional(),
  applicableSubelements: z.array(z.enum(["XFHA", "XFFR", "XFPR"])), applicability: z.string(),
  qualityAndLimitations: z.string(), fileReference: z.string().optional(), supersedesEvidenceRef: z.string().optional(), controlled: z.boolean(),
});

const BaselineTreatmentSchema = record({
  technicalArea: z.enum(["PLANT_OPERATING_STATES", "INITIATING_EVENTS", "EVENT_SEQUENCES", "SUCCESS_CRITERIA", "SYSTEMS", "DATA", "HUMAN_RELIABILITY", "RISK_INTEGRATION"]),
  sourceRecordRefs: strings, treatment: z.enum(["REUSED", "MODIFIED", "NEW", "NOT_APPLICABLE"]),
  externalFloodChange: z.string(), unresolvedItems: strings,
});

const BaselinePraSchema = z.object({
  modelName: z.string(), modelReference: z.string(), revision: z.string(), freezeDate: z.string(),
  freezeStatus: z.enum(["WORKING", "FROZEN", "REFERENCE_ONLY"]), modelBoundary: z.string(),
  plantOperatingStateRefs: strings, reactorUnitRefs: strings, radioactiveMaterialSourceRefs: strings,
  recordTreatments: z.array(BaselineTreatmentSchema), unresolvedInterfaces: strings,
});

const SiteBasisSchema = record({
  siteBasisType: z.enum(["SPECIFIC_SITE", "BOUNDING_SITE"]), siteName: z.string(),
  latitudeDegrees: z.number().optional(), longitudeDegrees: z.number().optional(), gradeElevationMetres: z.number().optional(),
  siteSelectionStatus: z.enum(["SELECTED", "CANDIDATE", "BOUNDING_ENVELOPE"]), boundingSiteRefs: strings,
  boundingCharacteristics: strings, watershedAndCoastalSetting: z.string(), topographyAndDrainageDescription: z.string(),
  datumAndSurveyBasis: z.string(), licenseeControlledAreaDescription: z.string(), reactorUnitRefs: strings,
  radioactiveMaterialSourceRefs: strings, plantOperatingStateRefs: strings, multiReactorOrMultiSourceLocations: strings,
  analysisDateCutoff: z.string(),
});

const ScopeRecordSchema = record({
  hazardTypes, floodEffects, reactorUnitRefs: strings, radioactiveMaterialSourceRefs: strings,
  plantOperatingStateRefs: strings, includedLocations: strings, excludedLocations: strings, inclusionBasis: z.string(),
});

export const ExternalFloodAnalysisBasisSchema = technicalSection({
  siteBasis: SiteBasisSchema.optional(), scopeRecords: z.array(ScopeRecordSchema),
  applications: z.array(ExternalFloodPraApplicationSchema), evidenceRegister: z.array(ExternalFloodPraEvidenceRecordSchema),
  baselinePra: BaselinePraSchema.optional(), interfaces: z.array(ExternalFloodPraInterfaceRecordSchema),
});

const HazardCandidateSchema = record({
  hazardType: ExternalFloodHazardTypeSchema, sourceLocations: strings, siteIndicators: strings,
  floodEffects, preliminaryFrequencyPerPlantYear: z.number().optional(),
  screeningCriterion: z.enum(["SCR-1", "SCR-2", "SCR-3", "APPROVED_ALTERNATE", "RETAINED"]),
  disposition: z.enum(["SCREENED", "RETAINED"]), dispositionBasis: z.string(),
});
const HazardCombinationSchema = record({
  primaryHazardType: ExternalFloodHazardTypeSchema, combinedHazards: hazardTypes,
  relationship: z.enum(["CAUSAL", "CORRELATED", "COINCIDENT", "CONDITIONAL"]),
  jointTreatment: z.string(), doubleCountingControl: z.string(), disposition: z.enum(["SCREENED", "RETAINED"]),
});
const ScreeningDecisionSchema = record({
  screenedObjectType: z.enum(["HAZARD", "SSC", "FLOOD_EFFECT", "FAILURE_MODE", "SCENARIO", "EVENT_SEQUENCE_FAMILY"]),
  screenedObjectRefs: strings, hazardTypes, floodEffects,
  criterion: z.enum(["SCR-1", "SCR-2", "SCR-3", "APPROVED_ALTERNATE", "RETAINED"]),
  disposition: z.enum(["SCREENED", "RETAINED"]), conservativeAssumptions: strings,
  quantitativeValue: z.number().optional(), quantitativeUnit: z.string().optional(), threshold: z.number().optional(),
  aggregateFrequencyPerPlantYear: z.number().optional(), investigationRefs: strings, affectedEventSequenceFamilyRefs: strings,
});
const ConfirmationSchema = record({
  screeningDecisionRef: z.string(), plantConditionBasis: z.string(), confirmationMethod: z.string(),
  confirmed: z.boolean(), discrepancies: strings, resolutionRefs: strings,
});

export const ExternalFloodHazardScreeningSchema = technicalSection({
  hazardCandidates: z.array(HazardCandidateSchema), hazardCombinations: z.array(HazardCombinationSchema),
  screeningDecisions: z.array(ScreeningDecisionSchema), aggregateScreeningChecks: z.array(ScreeningDecisionSchema),
  confirmations: z.array(ConfirmationSchema), investigations: z.array(ExternalFloodInvestigationSchema),
});

const DataSourceSchema = record({
  sourceType: z.enum(["GAGE", "PRECIPITATION_FREQUENCY", "TOPOGRAPHY", "BATHYMETRY", "DAM_RECORD", "COASTAL_RECORD", "PALEOFLOOD", "REMOTE_SENSING", "SITE_MONITORING", "OTHER"]),
  datasetId: z.string(), agency: z.string(), location: z.string(), periodStart: z.string(), periodEnd: z.string(),
  datum: z.string(), spatialResolution: z.string(), recordCompleteness: z.number(), qualification: z.string(),
});
const SiteParameterSchema = record({
  parameterType: z.enum(["ELEVATION", "ROUGHNESS", "INFILTRATION", "DRAINAGE_CAPACITY", "SOIL", "BATHYMETRY", "BOUNDARY_CONDITION", "GROUNDWATER", "OTHER"]),
  location: z.string(), value: z.number(), unit: z.string(), distribution: z.string(), lowerBound: z.number(), upperBound: z.number(), sourceRef: z.string(),
});
const DatumConversionSchema = record({
  sourceDatum: z.string(), targetDatum: z.string(), verticalOffsetMetres: z.number(), horizontalTransformation: z.string(),
  surveyEpoch: z.string(), affectedRecordRefs: strings, verificationRef: z.string(),
});
const HydrologicAssumptionSchema = record({
  process: z.string(), assumption: z.string(), parameterValues: numberRecord, applicability: z.string(), sensitivityRef: z.string(),
});
const NumericalModelSchema = record({
  software: z.string(), version: z.string(), modelType: z.string(), domain: z.string(), dimensionality: z.enum(["1D", "2D", "COUPLED_1D_2D", "OTHER"]),
  gridResolutionMetres: z.number(), timeStepSeconds: z.number(), boundaryConditions: strings,
  calibrationEvidenceRefs: strings, verificationEvidenceRefs: strings, qualityStatus: z.enum(["QUALIFIED", "CONDITIONALLY_QUALIFIED", "NOT_QUALIFIED"]),
});
const QualificationCheckSchema = record({
  subjectRef: z.string(), checkType: z.enum(["COMPLETENESS", "APPLICABILITY", "DATUM", "CURRENTNESS", "CALIBRATION", "VERIFICATION", "INDEPENDENT_CHECK"]),
  acceptanceCriterion: z.string(), findings: z.string(), disposition: z.enum(["PASS", "CONDITIONAL", "FAIL"]), correctiveActionRefs: strings,
});

export const ExternalFloodSiteModelSchema = technicalSection({
  dataSources: z.array(DataSourceSchema), siteParameters: z.array(SiteParameterSchema), datumConversions: z.array(DatumConversionSchema),
  hydrologicAssumptions: z.array(HydrologicAssumptionSchema), numericalModels: z.array(NumericalModelSchema), qualificationChecks: z.array(QualificationCheckSchema),
});

const PrecipitationInputSchema = record({
  sourceRef: z.string(), durationHours: z.number(), annualExceedanceProbability: z.number(), depthMillimetres: z.number(),
  temporalDistribution: z.string(), arealReductionFactor: z.number(), climateAdjustmentFactor: z.number(), uncertaintyPercent: z.number(),
});
const CatchmentSchema = record({
  areaSquareMetres: z.number(), meanSlopePercent: z.number(), imperviousFraction: z.number(), infiltrationModel: z.string(),
  drainageCapacityCubicMetresPerSecond: z.number(), inletRefs: strings, overflowPathRefs: strings, targetLocationRefs: strings,
});
const HydraulicModelSchema = record({
  numericalModelRef: z.string(), inputRefs: strings, catchmentRefs: strings, drainageAvailability: z.number(),
  blockedInletFraction: z.number(), initialLossMillimetres: z.number(), simulationDurationHours: z.number(), massBalanceErrorPercent: z.number(),
});
const FlowPathSchema = record({
  origin: z.string(), destination: z.string(), pathwayType: z.enum(["SURFACE", "DRAIN", "CULVERT", "ROADWAY", "CHANNEL", "OPENING"]),
  crestElevationMetres: z.number(), widthMetres: z.number(), capacityCubicMetresPerSecond: z.number(), affectedLocationRefs: strings,
});
const HazardResultSchema = record({
  hazardType: ExternalFloodHazardTypeSchema, location: z.string(), annualExceedanceProbability: z.number(),
  waterSurfaceElevationMetres: z.number(), depthMetres: z.number(), velocityMetresPerSecond: z.number(),
  arrivalTimeHours: z.number(), durationHours: z.number(), warningTimeHours: z.number(),
  waveHeightMetres: z.number(), debrisDescription: z.string(), erosionDescription: z.string(), resultModelRefs: strings,
});

export const ExternalFloodLipAnalysisSchema = technicalSection({
  precipitationInputs: z.array(PrecipitationInputSchema), drainageCatchments: z.array(CatchmentSchema),
  hydraulicModels: z.array(HydraulicModelSchema), surfaceFlowPaths: z.array(FlowPathSchema), hazardResults: z.array(HazardResultSchema),
});

const WatershedModelSchema = record({
  watershedAreaSquareKilometres: z.number(), gageRefs: strings, hydrologicModel: z.string(), lossMethod: z.string(),
  routingMethod: z.string(), snowmeltTreatment: z.string(), calibrationEvents: strings, downstreamBoundary: z.string(),
});
const FrequencyAnalysisSchema = record({
  dataSourceRefs: strings, method: z.string(), recordYears: z.number(), lowOutlierTreatment: z.string(),
  historicalAndPaleofloodTreatment: z.string(), regionalSkew: z.number(), confidenceTreatment: z.string(),
  annualExceedanceProbabilities: numbers, peakDischargesCubicMetresPerSecond: numbers,
});
const StageDischargeSchema = record({
  riverLocation: z.string(), hydraulicModelRef: z.string(), roughnessValues: numberRecord, bridgeAndCulvertTreatment: z.string(),
  backwaterTreatment: z.string(), sedimentAndIceTreatment: z.string(), dischargesCubicMetresPerSecond: numbers, stagesMetres: numbers,
});
const LeveeAssessmentSchema = record({
  leveeLocation: z.string(), crestElevationMetres: z.number(), condition: z.string(), failureModes: strings,
  fragilityRef: z.string(), interiorDrainageTreatment: z.string(), overtoppingTreatment: z.string(),
});

export const ExternalFloodRiverineAnalysisSchema = technicalSection({
  watershedModels: z.array(WatershedModelSchema), frequencyAnalyses: z.array(FrequencyAnalysisSchema),
  stageDischargeModels: z.array(StageDischargeSchema), leveeAssessments: z.array(LeveeAssessmentSchema), hazardResults: z.array(HazardResultSchema),
});

const ImpoundmentSchema = record({
  facilityId: z.string(), facilityType: z.enum(["DAM", "RESERVOIR", "LEVEE", "CANAL", "COOLING_POND", "OTHER"]),
  ownerOrganization: z.string(), distanceToSiteKilometres: z.number(), normalPoolElevationMetres: z.number(),
  maximumStorageCubicMetres: z.number(), hazardClassification: z.string(), inspectionStatus: z.string(), cascadeRefs: strings,
});
const DamFailureModeSchema = record({
  impoundmentRef: z.string(), failureType: z.enum(["OVERTOPPING", "INTERNAL_EROSION", "STRUCTURAL", "SEISMIC", "MISOPERATION", "CASCADE", "OTHER"]),
  initiatingConditions: strings, conditionalFailureProbability: z.number(), warningBasis: z.string(), correlatedHazardRefs: strings,
});
const BreachModelSchema = record({
  failureModeRef: z.string(), breachMethod: z.string(), breachWidthMetres: z.number(), breachFormationTimeHours: z.number(),
  finalInvertElevationMetres: z.number(), peakOutflowCubicMetresPerSecond: z.number(), hydrographRef: z.string(), sensitivityRefs: strings,
});
const RoutingModelSchema = record({
  breachModelRefs: strings, numericalModelRef: z.string(), routingDistanceKilometres: z.number(),
  channelAndFloodplainBasis: z.string(), downstreamStructureTreatment: z.string(), travelTimeHours: z.number(), attenuationTreatment: z.string(),
});

export const ExternalFloodDamAnalysisSchema = technicalSection({
  impoundmentInventory: z.array(ImpoundmentSchema), failureModes: z.array(DamFailureModeSchema),
  breachModels: z.array(BreachModelSchema), routingModels: z.array(RoutingModelSchema), hazardResults: z.array(HazardResultSchema),
});

const CoastalSourceSchema = record({
  sourceType: z.enum(["TROPICAL_CYCLONE", "EXTRATROPICAL_STORM", "LANDSLIDE", "EARTHQUAKE", "VOLCANIC", "METEOROLOGICAL_SEICHE", "OTHER"]),
  sourceRegion: z.string(), dataSourceRefs: strings, occurrenceModel: z.string(), magnitudeParameters: numberRecord, applicability: z.string(),
});
const CoastalModelSchema = record({
  sourceRefs: strings, numericalModelRef: z.string(), bathymetryRef: z.string(), tideTreatment: z.string(),
  waveTreatment: z.string(), runupTreatment: z.string(), boundaryConditions: strings, eventCount: z.number(), simulatedYears: z.number(),
});
const SeicheModelSchema = record({
  waterBody: z.string(), excitationMechanisms: strings, naturalPeriodsMinutes: numbers, dampingTreatment: z.string(),
  waterLevelAmplitudesMetres: numbers, shorelineAmplification: z.number(),
});
const TsunamiModelSchema = record({
  sourceRefs: strings, sourceModel: z.string(), propagationModel: z.string(), bathymetryRef: z.string(),
  runupMethod: z.string(), drawdownTreatment: z.string(), arrivalTimesHours: numbers, validationReferences: strings,
});

export const ExternalFloodCoastalAnalysisSchema = technicalSection({
  coastalSources: z.array(CoastalSourceSchema), stormSurgeModels: z.array(CoastalModelSchema),
  seicheModels: z.array(SeicheModelSchema), tsunamiModels: z.array(TsunamiModelSchema), hazardResults: z.array(HazardResultSchema),
});

const LogicBranchSchema = record({
  hazardType: ExternalFloodHazardTypeSchema, branchLevel: z.string(), alternative: z.string(), weight: z.number(),
  inputRefs: strings, outputCurveRef: z.string(), rationale: z.string(),
});
const HazardCurveSchema = record({
  hazardType: ExternalFloodHazardTypeSchema, location: z.string(), parameter: z.enum(["WATER_SURFACE_ELEVATION", "DEPTH", "DISCHARGE", "WAVE_HEIGHT", "VELOCITY"]),
  unit: z.string(), values: numbers, annualExceedanceFrequencies: numbers, curveType: z.enum(["MEAN", "MEDIAN", "P05", "P50", "P95", "CONSERVATIVE"]),
  lowerAnalysisValue: z.number(), upperAnalysisValue: z.number(), sourceResultRefs: strings,
});
const SpatialCharacterizationSchema = record({
  hazardType: ExternalFloodHazardTypeSchema, hazardCurveRef: z.string(), locationRefs: strings,
  depthMapRef: z.string(), velocityMapRef: z.string(), arrivalTimeMapRef: z.string(), durationMapRef: z.string(),
  spatialCorrelationTreatment: z.string(),
});
const HazardIntervalSchema = record({
  hazardCurveRef: z.string(), lowerValue: z.number(), upperValue: z.number(), representativeValue: z.number(),
  intervalAnnualFrequency: z.number(), conditionalWeight: z.number(), representativeDurationHours: z.number(),
  representativeWarningTimeHours: z.number(), spatialCharacterizationRef: z.string(),
});
const UncertaintyStudySchema = record({
  hazardTypes, uncertaintySources: strings, logicTreeBranchRefs: strings, samplingMethod: z.string(), sampleCount: z.number(),
  outputStatistics: numberRecord, sensitivityResults: strings,
});
const ConvergenceSchema = record({
  studyType: z.enum(["HAZARD_BINNING", "UPPER_TAIL", "GRID", "TIME_STEP", "SAMPLING", "SCENARIO_SCREENING"]),
  testedValues: numbers, resultValues: numbers, acceptanceCriterion: z.string(), relativeChange: z.number(), converged: z.boolean(),
});

export const ExternalFloodHazardIntegrationSchema = technicalSection({
  logicTreeBranches: z.array(LogicBranchSchema), hazardCurves: z.array(HazardCurveSchema),
  spatialCharacterizations: z.array(SpatialCharacterizationSchema), hazardIntervals: z.array(HazardIntervalSchema),
  uncertaintyStudies: z.array(UncertaintyStudySchema), convergenceStudies: z.array(ConvergenceSchema),
});

const PreliminaryInitiatorSchema = record({
  hazardTypes, initiatingEventRef: z.string(), triggerConditions: strings, affectedPlantOperatingStateRefs: strings,
  affectedUnitRefs: strings, directOrConsequential: z.enum(["DIRECT", "CONSEQUENTIAL"]), disposition: z.enum(["RETAINED", "SCREENED", "MERGED"]),
});
const ModelReviewSchema = record({
  baselineModelArea: z.string(), sourceModelRefs: strings, reviewQuestion: z.string(), findings: strings,
  requiredChanges: strings, resultingRecordRefs: strings,
});
const EquipmentListSchema = record({
  sscRef: z.string(), sscType: z.string(), location: z.string(), elevationMetres: z.number(),
  creditedFunctions: strings, supportingElementRefs: strings, applicableHazardTypes: hazardTypes, applicableFloodEffects: floodEffects,
  pathwayRefs: strings, protectionFeatureRefs: strings, failureModeRefs: strings, investigationRefs: strings,
  inclusionSources: strings, disposition: z.enum(["ACTIVE", "SCREENED", "PENDING"]),
});

export const ExternalFloodPreliminaryPlantResponseSchema = technicalSection({
  preliminaryInitiatingEvents: z.array(PreliminaryInitiatorSchema), modelReviews: z.array(ModelReviewSchema),
  externalFloodEquipmentList: z.array(EquipmentListSchema),
});

const FindingSchema = record({
  findingType: z.enum(["CONDITION_CONFIRMED", "MODEL_CHANGE", "CORRECTIVE_ACTION", "OPEN_ITEM"]),
  location: z.string(), observedCondition: z.string(), expectedCondition: z.string(), affectedRecordRefs: strings,
  modelDisposition: z.string(), correctiveActionRef: z.string(), closureStatus: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});
const PathwaySchema = record({
  origin: z.string(), destination: z.string(), pathwayType: z.enum(["DOOR", "HATCH", "PENETRATION", "VENT", "LOUVER", "DRAIN", "WALL", "GROUNDWATER", "OPEN_AREA", "OTHER"]),
  invertOrSillElevationMetres: z.number(), openingAreaSquareMetres: z.number(), flowCapacityCubicMetresPerSecond: z.number(),
  normallyOpen: z.boolean(), protectionFeatureRefs: strings, exposedSscRefs: strings, investigationRefs: strings,
});
const ProtectionFeatureSchema = record({
  featureType: z.enum(["PERMANENT_BARRIER", "TEMPORARY_BARRIER", "WATERTIGHT_DOOR", "HATCH", "PENETRATION_SEAL", "DRAIN_ISOLATION", "PUMP", "OTHER"]),
  location: z.string(), creditedElevationMetres: z.number(), designCapacity: z.string(), passive: z.boolean(),
  deploymentProcedureRef: z.string(), surveillanceRef: z.string(), fragilityRef: z.string(), investigationRefs: strings,
});
const DrainageFeatureSchema = record({
  featureType: z.enum(["FLOOR_DRAIN", "STORM_DRAIN", "ROOF_DRAIN", "SUMP", "PUMP", "BACKFLOW_PREVENTER", "CULVERT"]),
  location: z.string(), capacityCubicMetresPerSecond: z.number(), powerDependencyRefs: strings, dischargeLocation: z.string(),
  blockagePotential: z.string(), backflowPotential: z.string(), investigationRefs: strings,
});

export const ExternalFloodPlantInvestigationSchema = technicalSection({
  investigations: z.array(ExternalFloodInvestigationSchema), findings: z.array(FindingSchema), floodPathways: z.array(PathwaySchema),
  protectionFeatures: z.array(ProtectionFeatureSchema), drainageFeatures: z.array(DrainageFeatureSchema),
});

const FragilityMethodSchema = record({
  sscRefs: strings, failureModeRefs: strings, floodEffects,
  method: z.enum(["DETERMINISTIC_CAPACITY", "LOGNORMAL_FRAGILITY", "RELIABILITY", "TEST_DATA", "GENERIC_WITH_SITE_EVALUATION", "SCREENING"]),
  informationBasis: strings, capabilityCategoryBasis: z.string(), correlationTreatment: z.string(),
});
const FailureModeSchema = record({
  sscRef: z.string(), modeType: z.enum(["OVERTOPPING", "LEAKAGE", "STRUCTURAL_FAILURE", "SUBMERGENCE", "SPRAY", "DEBRIS_IMPACT", "EROSION", "BUOYANCY", "LOSS_OF_SUPPORT", "HUMAN_DEPLOYMENT", "OTHER"]),
  floodEffects, demandParameters: strings, capacityParameters: strings, functionalConsequence: z.string(),
});
const CorrelationSchema = record({
  memberSscRefs: strings, failureModeRefs: strings, sharedDemandRefs: strings,
  correlationBasis: z.string(), correlationModel: z.string(), correlationCoefficient: z.number(), implementation: z.string(),
});

export const ExternalFloodFragilityBasisSchema = technicalSection({
  screeningDecisions: z.array(ScreeningDecisionSchema), methodSelections: z.array(FragilityMethodSchema),
  failureModes: z.array(FailureModeSchema), correlationGroups: z.array(CorrelationSchema),
  coexistentHazardAssessments: z.array(HazardCombinationSchema),
});

const BarrierFragilitySchema = record({
  featureRef: z.string(), failureModeRef: z.string(), demandParameter: z.string(), capacityModel: z.string(),
  medianCapacity: z.number(), unit: z.string(), betaRandomness: z.number(), betaUncertainty: z.number(),
  leakageTreatment: z.string(), deploymentFailureRef: z.string(), agingAndMaintenanceTreatment: z.string(),
});
const EquipmentFragilitySchema = record({
  sscRef: z.string(), failureModeRef: z.string(), demandParameter: z.string(), equipmentQualification: z.string(),
  thresholdValue: z.number(), unit: z.string(), medianCapacity: z.number(), betaRandomness: z.number(), betaUncertainty: z.number(),
  enclosureAndMounting: z.string(), functionalFailureCriterion: z.string(),
});
const StructuralLoadSchema = record({
  sscRef: z.string(), hydrostaticLoadKilonewtons: z.number(), hydrodynamicLoadKilonewtons: z.number(),
  waveLoadKilonewtons: z.number(), debrisImpactLoadKilonewtons: z.number(), buoyancyLoadKilonewtons: z.number(),
  erosionAndScourTreatment: z.string(), loadCombination: z.string(), analysisReference: z.string(),
});
const SealAssessmentSchema = record({
  sealOrPenetrationRef: z.string(), sealType: z.string(), installedCondition: z.string(),
  differentialHeadCapacityMetres: z.number(), leakageRateLitresPerMinute: z.number(), agingTreatment: z.string(),
  testEvidenceRefs: strings, inspectionEvidenceRefs: strings,
});
const FragilityCurveSchema = record({
  sscRef: z.string(), failureModeRef: z.string(), methodSelectionRef: z.string(), demandParameter: z.string(), unit: z.string(),
  hazardSpecific: z.boolean(), crossHazardUseJustification: z.string(), demandValues: numbers, conditionalFailureProbabilities: numbers,
  correlationGroupRefs: strings,
});

export const ExternalFloodFragilityAnalysisSchema = technicalSection({
  barrierFragilities: z.array(BarrierFragilitySchema), equipmentFragilities: z.array(EquipmentFragilitySchema),
  structuralLoadModels: z.array(StructuralLoadSchema), sealAssessments: z.array(SealAssessmentSchema), fragilityCurves: z.array(FragilityCurveSchema),
});

const ScenarioGroupSchema = record({
  hazardTypes, sourceRefs: strings, initialPathwayRefs: strings, protectionFeatureRefs: strings, exposedSscRefs: strings,
  plantOperatingStateRefs: strings, initiatingEventRefs: strings, groupingBasis: z.string(), representativeScenarioRef: z.string(),
});
const PropagationModelSchema = record({
  scenarioGroupRef: z.string(), sourceLocation: z.string(), destinationLocations: strings, pathwayRefs: strings,
  volumeBalanceMethod: z.string(), drainageAndPumpingTreatment: z.string(), leakageTreatment: z.string(),
  spatialCorrelationTreatment: z.string(), outputLocationStates: strings,
});
const TimelineSchema = record({
  scenarioGroupRef: z.string(), warningTimeHours: z.number(), siteArrivalTimeHours: z.number(),
  ingressTimeHours: z.number(), sscFailureTimesHours: numberRecord, operatorActionWindowsHours: numberRecord,
  peakTimeHours: z.number(), recessionTimeHours: z.number(), missionTimeHours: z.number(),
});

export const ExternalFloodScenarioDevelopmentSchema = technicalSection({
  scenarioGroups: z.array(ScenarioGroupSchema), propagationModels: z.array(PropagationModelSchema),
  scenarioTimelines: z.array(TimelineSchema), hazardCombinations: z.array(HazardCombinationSchema),
  screeningDecisions: z.array(ScreeningDecisionSchema),
});

const PeerDispositionSchema = record({
  sourcePraElement: z.string(), findingId: z.string(), relevanceToExternalFlood: z.string(),
  disposition: z.string(), modelChangeRefs: strings, closureStatus: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});
const InitiatingEventModelSchema = record({
  initiatingEventRef: z.string(), hazardTypes, hazardIntervalRefs: strings, scenarioGroupRefs: strings,
  initiatingFailureRefs: strings, frequencyTreatment: z.string(), affectedSourceRefs: strings,
});
const EventSequenceModelSchema = record({
  eventTreeRef: z.string(), initiatingEventRefs: strings, hazardTypes, scenarioGroupRefs: strings,
  eventSequenceRefs: strings, releaseCategoryRefs: strings, missionTimeRef: z.string(),
  floodSpecificLogic: z.string(), dependencyRefs: strings,
});
const SuccessCriterionSchema = record({
  safetyFunctionRef: z.string(), criterion: z.string(), requiredSscRefs: strings, hazardIntervalRefs: strings,
  scenarioGroupRefs: strings, missionTimeHours: z.number(), analysisRefs: strings,
});
const SystemModificationSchema = record({
  systemRef: z.string(), affectedSscRefs: strings, failureModeRefs: strings, modification: z.string(),
  basicEventRefs: strings, dependencyTreatment: z.string(), verificationRefs: strings,
});
const MissionTimeSchema = record({
  hazardTypes, safetyFunctionRef: z.string(), missionTimeHours: z.number(), eventSequenceFamilyRefs: strings,
  recessionAndAccessBasis: z.string(),
});
const DataParameterSchema = record({
  parameterRef: z.string(), parameterType: z.enum(["RANDOM_FAILURE", "COMMON_CAUSE", "UNAVAILABILITY", "RECOVERY", "MISSION_TIME", "OTHER"]),
  sourceDataRef: z.string(), meanValue: z.number(), uncertaintyDistribution: z.string(), floodAdjustment: z.string(),
});
const MultiUnitSchema = record({
  affectedReactorUnitRefs: strings, affectedSourceRefs: strings, sharedSscRefs: strings, sharedResourceRefs: strings,
  accessAndStaffingEffects: z.string(), commonCauseTreatment: z.string(), eventSequenceRefs: strings,
});

export const ExternalFloodPlantResponseModelSchema = technicalSection({
  peerReviewDispositions: z.array(PeerDispositionSchema), initiatingEventModels: z.array(InitiatingEventModelSchema),
  eventSequenceModels: z.array(EventSequenceModelSchema), successCriteria: z.array(SuccessCriterionSchema),
  systemModelModifications: z.array(SystemModificationSchema), missionTimes: z.array(MissionTimeSchema),
  dataParameters: z.array(DataParameterSchema), multiUnitAssessments: z.array(MultiUnitSchema),
});

const HumanActionSchema = record({
  actionType: z.enum(["PREPARATORY", "RESPONSE", "RECOVERY"]), scenarioGroupRefs: strings,
  procedureRefs: strings, cueDescription: z.string(), actionLocation: z.string(), executionLocation: z.string(),
  warningTimeAvailableMinutes: z.number(), requiredTimeMinutes: z.number(), executionTimeMinutes: z.number(),
  requiredEquipment: strings, feasibilityBasis: z.string(),
});
const HumanFailureEventSchema = record({
  humanActionRef: z.string(), failureDescription: z.string(), eventSequenceRefs: strings,
  basicEventRef: z.string(), dependencyGroupRefs: strings, exclusiveRecovery: z.boolean(),
});
const PerformanceContextSchema = record({
  humanActionRef: z.string(), hazardTypes, warningAndCues: z.string(), weatherAndEnvironment: z.string(),
  waterAndDebrisConditions: z.string(), accessAndEgress: z.string(), habitabilityAndLighting: z.string(),
  staffingAndWorkload: z.string(), communications: z.string(), multiUnitDemands: z.string(),
});
const HepSchema = record({
  humanFailureEventRef: z.string(), performanceContextRef: z.string(), method: z.string(), nominalHep: z.number(),
  externalFloodHep: z.number(), lowerBound: z.number(), upperBound: z.number(), timingMarginMinutes: z.number(),
  dependencyAdjustment: z.number(), recoveryCredit: z.number(), uncertaintyTreatment: z.string(),
});
const ActionConfirmationSchema = record({
  humanActionRefs: strings, confirmationType: z.enum(["PROCEDURE_REVIEW", "INTERVIEW", "TALK_THROUGH", "TABLETOP", "SIMULATION", "WALKDOWN"]),
  participantRefs: strings, confirmedProcedureInterpretation: z.boolean(), confirmedTiming: z.boolean(),
  confirmedFeasibility: z.boolean(), observedConstraints: strings, modelChanges: strings,
});
const RecoverySchema = record({
  humanActionRef: z.string(), sourceRecoveryModelRef: z.string(), remainsValidUnderExternalFlood: z.boolean(),
  accessAssessment: z.string(), environmentalAssessment: z.string(), timingAssessment: z.string(), recoveryValue: z.number(),
});
const HraDependencySchema = record({
  humanFailureEventRefs: strings, sharedCrews: strings, sharedCues: strings, sharedLocations: strings,
  temporalRelationship: z.string(), dependencyLevel: z.enum(["ZERO", "LOW", "MODERATE", "HIGH", "COMPLETE"]),
  jointProbability: z.number(), calculationMethod: z.string(),
});

export const ExternalFloodHumanReliabilityAnalysisSchema = technicalSection({
  humanActions: z.array(HumanActionSchema), humanFailureEvents: z.array(HumanFailureEventSchema),
  performanceContexts: z.array(PerformanceContextSchema), hepEstimates: z.array(HepSchema),
  confirmations: z.array(ActionConfirmationSchema), recoveryAssessments: z.array(RecoverySchema),
  dependencyAssessments: z.array(HraDependencySchema),
});

const QuantificationRunSchema = record({
  modelVersion: z.string(), hazardTypes, hazardCurveRefs: strings, hazardIntervalRefs: strings, fragilityRefs: strings,
  scenarioGroupRefs: strings, plantResponseModelRefs: strings, hraModelRefs: strings,
  rareEventApproximationTreatment: z.string(), highFailureProbabilityTreatment: z.string(), truncationLimit: z.number(),
  uncertaintySampleCount: z.number(), randomSeedReference: z.string(), softwareAndVersion: z.string(),
});
const IntervalResultSchema = record({
  quantificationRunRef: z.string(), hazardIntervalRef: z.string(), hazardType: ExternalFloodHazardTypeSchema,
  scenarioGroupRef: z.string(), eventSequenceFamilyRef: z.string(), intervalAnnualFrequency: z.number(),
  conditionalSequenceProbability: z.number(), sequenceFrequencyPerPlantYear: z.number(), dominantFragilityRefs: strings, dominantBasicEventRefs: strings,
});
const FamilyResultSchema = record({
  quantificationRunRef: z.string(), eventSequenceFamilyRef: z.string(), hazardTypes, scenarioGroupRefs: strings,
  reactorUnitRefs: strings, radioactiveMaterialSourceRefs: strings, releaseCategoryRefs: strings,
  pointEstimateFrequencyPerPlantYear: z.number(), meanFrequencyPerPlantYear: z.number(),
  fifthPercentileFrequencyPerPlantYear: z.number(), medianFrequencyPerPlantYear: z.number(), ninetyFifthPercentileFrequencyPerPlantYear: z.number(),
});
const IntegratedUncertaintySchema = record({
  quantificationRunRef: z.string(), uncertaintySourceRefs: strings, sampleCount: z.number(),
  aggregateMeanFrequencyPerPlantYear: z.number(), aggregateMedianFrequencyPerPlantYear: z.number(),
  aggregateFifthPercentileFrequencyPerPlantYear: z.number(), aggregateNinetyFifthPercentileFrequencyPerPlantYear: z.number(),
  varianceContributions: numberRecord,
});
const RiskContributorSchema = record({
  quantificationRunRef: z.string(), contributorType: z.enum(["HAZARD", "LOCATION", "PROTECTION_FEATURE", "SSC", "SCENARIO", "HUMAN_ACTION", "BASIC_EVENT", "SEQUENCE_FAMILY"]),
  contributorRef: z.string(), rank: z.number(), frequencyContributionPerPlantYear: z.number(), fractionalContribution: z.number(),
  importanceMeasures: numberRecord, insight: z.string(),
});

export const ExternalFloodEventSequenceQuantificationSchema = technicalSection({
  quantificationRuns: z.array(QuantificationRunSchema), hazardIntervalResults: z.array(IntervalResultSchema),
  eventSequenceFamilyResults: z.array(FamilyResultSchema), convergenceStudies: z.array(ConvergenceSchema),
  uncertaintyResults: z.array(IntegratedUncertaintySchema), riskContributors: z.array(RiskContributorSchema),
  screeningDecisions: z.array(ScreeningDecisionSchema),
});

const RiskInsightSchema = record({
  insightType: z.enum(["DOMINANT_HAZARD", "DOMINANT_LOCATION", "DOMINANT_SSC", "DOMINANT_SCENARIO", "HUMAN_ACTION", "UNCERTAINTY", "MULTI_UNIT", "RISK_REDUCTION"]),
  contributorRefs: strings, quantitativeBasis: z.string(), decisionSignificance: z.string(), recommendedActions: strings,
});
const RefinementSchema = record({
  trigger: z.string(), affectedRecordRefs: strings, proposedChange: z.string(), expectedRiskImpact: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]), completionEvidenceRefs: strings, closureStatus: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});
const IterationSchema = record({
  iterationNumber: z.number(), priorRunRef: z.string(), currentRunRef: z.string(), changes: strings,
  aggregateFrequencyChange: z.number(), largestFamilyFrequencyChange: z.number(), contributorRankShift: z.number(),
  newRiskSignificantContributors: strings, decision: z.enum(["REFINE", "ACCEPT_STABLE"]),
});
const SensitivitySchema = record({
  baseRunRef: z.string(), variedInputs: strings, alternateValues: numberRecord, resultChanges: numberRecord,
  conclusion: z.string(), decisionRefs: strings,
});

export const ExternalFloodRiskInterpretationSchema = z.object({
  riskInsights: z.array(RiskInsightSchema), refinementActions: z.array(RefinementSchema),
  quantificationIterations: z.array(IterationSchema), sensitivityStudies: z.array(SensitivitySchema),
});

const IntegrationResultSchema = record({
  sourceQuantificationRefs: strings, targetRiskModelRef: z.string(), metric: z.string(),
  externalFloodContributionPerPlantYear: z.number(), totalRiskPerPlantYear: z.number(), fractionalContribution: z.number(),
  overlapAndDoubleCountingTreatment: z.string(), uncertaintyTreatment: z.string(),
});
const RiskDecisionSchema = record({
  decisionType: z.enum(["MODEL_ACCEPTANCE", "DESIGN_CHANGE", "PROCEDURE_CHANGE", "SURVEILLANCE", "MAINTENANCE", "EMERGENCY_PREPAREDNESS", "OTHER"]),
  insightRefs: strings, decision: z.string(), quantitativeAcceptanceBasis: z.string(), implementationRefs: strings,
  responsibleOrganization: z.string(), dueDate: z.string(), closureStatus: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});
const TraceabilitySchema = record({
  evidenceRefs: strings, hazardRefs: strings, fragilityRefs: strings, scenarioRefs: strings,
  eventSequenceRefs: strings, resultRefs: strings, insightRefs: strings, decisionRefs: strings, complete: z.boolean(), gaps: strings,
});
const ControlledBaselineSchema = record({
  modelVersion: z.string(), freezeDate: z.string(), hazardPackageRefs: strings, fragilityPackageRefs: strings,
  plantResponsePackageRefs: strings, quantificationPackageRefs: strings, reportRefs: strings,
  approvalRefs: strings, configurationControlRecordId: z.string(), releaseStatus: z.enum(["WORKING", "CONTROLLED", "SUPERSEDED"]),
});

export const ExternalFloodRiskIntegrationSchema = z.object({
  integrationResults: z.array(IntegrationResultSchema), riskDecisions: z.array(RiskDecisionSchema),
  traceabilityPaths: z.array(TraceabilitySchema), controlledBaselines: z.array(ControlledBaselineSchema),
});

const PeerTeamSchema = record({
  role: z.enum(["TEAM_LEAD", "FLOOD_HAZARD_SPECIALIST", "FRAGILITY_SPECIALIST", "SYSTEMS_ENGINEER", "HRA_SPECIALIST", "QUANTIFICATION_SPECIALIST", "OTHER"]),
  organization: z.string(), independenceStatement: z.string(), qualifications: strings, experience: strings, reviewScope: strings,
});
const PeerFindingSchema = record({
  reviewArea: z.enum(["XFHA", "XFFR", "XFPR", "INVESTIGATION", "QUANTIFICATION", "DOCUMENTATION"]),
  requirementRefs: strings, findingCategory: z.enum(["FACT_AND_OBSERVATION", "SUGGESTION", "BEST_PRACTICE", "COMMENT"]),
  significance: z.enum(["LOW", "MEDIUM", "HIGH"]), condition: z.string(), consequence: z.string(),
  recommendation: z.string(), resolution: z.string(), closureEvidenceRefs: strings,
  closureStatus: z.enum(["OPEN", "PROPOSED_RESOLUTION", "CLOSED"]),
});

export const ExternalFloodTechnicalClosureSchema = technicalSection({
  conformanceReviews: z.array(ExternalFloodAnalysisRecordSchema), documentationChecks: z.array(ExternalFloodAnalysisRecordSchema),
  interfaceClosureChecks: z.array(ExternalFloodAnalysisRecordSchema), peerReviewTeam: z.array(PeerTeamSchema),
  peerReviewFindings: z.array(PeerFindingSchema), readinessChecks: z.array(ExternalFloodAnalysisRecordSchema),
});

export const ExternalFloodWorkflowRecordSchema = record({
  workflowRecordType: z.enum(["REPORT_SECTION", "QUALITY_CHECK", "REVIEW_ASSIGNMENT", "REVIEW_FINDING", "APPROVAL_READINESS", "APPROVAL_SIGNATURE"]),
  discipline: z.string(), assignee: z.string(), dueDate: z.string().optional(), result: z.string(), verificationRefs: strings,
});
export const ExternalFloodPraWorkflowSchema = z.object({
  reportSections: z.array(ExternalFloodWorkflowRecordSchema), draftQualityChecks: z.array(ExternalFloodWorkflowRecordSchema),
  reviewAssignments: z.array(ExternalFloodWorkflowRecordSchema), reviewFindings: z.array(ExternalFloodWorkflowRecordSchema),
  approvalReadiness: z.array(ExternalFloodWorkflowRecordSchema), approvalSignatures: z.array(ExternalFloodWorkflowRecordSchema),
});

export const ExternalFloodPraDocumentationSchema = z.object({
  overallProcessDescription: z.string(), analysisBasisSummary: z.string(), evidenceAndSiteBasisSummary: z.string(),
  hazardScreeningSummary: z.string(), siteFloodModelSummary: z.string(), localIntensePrecipitationSummary: z.string(),
  riverineFloodSummary: z.string(), damAndImpoundmentSummary: z.string(), surgeSeicheTsunamiSummary: z.string(),
  hazardIntegrationSummary: z.string(), equipmentListSummary: z.string(), investigationSummary: z.string(),
  fragilitySummary: z.string(), scenarioSummary: z.string(), plantResponseSummary: z.string(),
  humanReliabilitySummary: z.string(), quantificationSummary: z.string(), riskInsights: z.string(), uncertaintySummary: z.string(),
  configurationControlDescription: z.string(), peerReviewScope: z.string(), supportingDocumentRefs: strings,
});
const ExampleDocumentSchema = z.object({
  id: z.string(), name: z.string(), kind: z.enum(["doc", "sheet", "image"]), sizeLabel: z.string(),
  uploadedLabel: z.string(), extracted: z.string(), linked: z.number(), url: z.string().optional(),
});

export const ExternalFloodPRASchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.EXTERNAL_FLOODING_PRA).shape,
  praScope: z.string(), hazardConditionedModels: HazardConditionedMethodModelsSchema.default(createEmptyHazardConditionedMethodModels), analysisBasis: ExternalFloodAnalysisBasisSchema,
  hazardScreening: ExternalFloodHazardScreeningSchema, siteFloodModel: ExternalFloodSiteModelSchema,
  localIntensePrecipitationAnalysis: ExternalFloodLipAnalysisSchema, riverineFloodAnalysis: ExternalFloodRiverineAnalysisSchema,
  damAndImpoundmentAnalysis: ExternalFloodDamAnalysisSchema, surgeSeicheTsunamiAnalysis: ExternalFloodCoastalAnalysisSchema,
  hazardIntegration: ExternalFloodHazardIntegrationSchema, preliminaryPlantResponse: ExternalFloodPreliminaryPlantResponseSchema,
  plantInvestigation: ExternalFloodPlantInvestigationSchema, sscScreeningAndFragilityBasis: ExternalFloodFragilityBasisSchema,
  floodFragilityAnalysis: ExternalFloodFragilityAnalysisSchema, scenarioDevelopment: ExternalFloodScenarioDevelopmentSchema,
  plantResponseModel: ExternalFloodPlantResponseModelSchema, humanReliabilityAnalysis: ExternalFloodHumanReliabilityAnalysisSchema,
  eventSequenceQuantification: ExternalFloodEventSequenceQuantificationSchema,
  integratedUncertainties: z.array(ExternalFloodModelUncertaintySchema), riskInterpretation: ExternalFloodRiskInterpretationSchema,
  riskIntegration: ExternalFloodRiskIntegrationSchema, technicalClosure: ExternalFloodTechnicalClosureSchema,
  workflow: ExternalFloodPraWorkflowSchema, documentation: ExternalFloodPraDocumentationSchema,
  configurationControlRecordId: z.string().optional(), exampleDocuments: z.array(ExampleDocumentSchema).optional(),
  newlyDevelopedMethodIds: strings.optional(),
});
