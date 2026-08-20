import { z } from "zod";
import type { SeismicFragilityAnalysis } from "../../sfr/seismic-fragility-analysis";
import { ParameterDistributionSchema } from "../core/events";
import { BaseModelUncertaintyDocumentationSchema, PreOperationalAssumptionSchema } from "../core/documentation";
import { ImportanceLevelSchema, SensitivityStudySchema } from "../core/shared-patterns";
import { SRReferenceSchema } from "../core/pra-common";
import { FragilityCorrelationGroupSchema, SeismicFailureModeTypeSchema } from "../seismic/seismic-pra-common";

export const FragilityEvaluationBasisSchema = z.enum([
  "PLANT_SPECIFIC_CALCULATION",
  "PLANT_SPECIFIC_TEST",
  "GENERIC_TEST_DATA",
  "EARTHQUAKE_EXPERIENCE",
  "SEISMIC_QUALIFICATION_DATA",
  "DESIGN_CRITERIA",
  "CONSERVATIVE_ASSUMPTION",
  "ENGINEERING_JUDGMENT",
]);

export const FragilityMechanismTypeSchema = z.enum([
  "SLIDING",
  "OVERTURNING",
  "STRUCTURAL_YIELDING",
  "EXCESSIVE_DRIFT",
  "ANCHORAGE_FAILURE",
  "FUNCTIONAL_FAILURE",
  "IMPACT",
  "BRACING_FAILURE",
  "CONTACT_CHATTER",
  "PRESSURE_BOUNDARY_FAILURE",
  "LIQUEFACTION",
  "SLOPE_INSTABILITY",
  "DIFFERENTIAL_SETTLEMENT",
  "FIRE_IGNITION",
  "FLOOD_RELEASE",
  "OTHER",
]);

export const FragilityScopeSchema = z.object({
  seismicEquipmentListRef: z.string(),
  includedSscRefs: z.array(z.string()),
  excludedSscs: z.array(
    z.object({
      sscRef: z.string(),
      reason: z.string(),
      modelDispositionRef: z.string().optional(),
    }),
  ),
  correlationGroupRefs: z.array(z.string()),
  scopeEvolutionSummary: z.string(),
  systemsFragilityAlignment: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ReferenceEarthquakeSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  hazardSpectrumRef: z.string(),
  groundMotionParameterRef: z.string(),
  controlPointRef: z.string(),
  annualFrequencyOfExceedance: z.number().optional(),
  groundMotionLevel: z.number(),
  groundMotionUnits: z.string(),
  horizontalComponentRefs: z.array(z.string()),
  verticalComponentRef: z.string(),
  hazardRangeOfInterest: z.object({
    lowerGroundMotion: z.number(),
    upperGroundMotion: z.number(),
    basis: z.string(),
  }),
  riskDominantInputLevel: z.number().optional(),
  selectionMethod: z.string(),
  selectionValidation: z.string(),
  nonlinearBehaviorBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const StructuralResponseModelSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  structureRef: z.string(),
  modelType: z.enum(["THREE_DIMENSIONAL_FINITE_ELEMENT", "THREE_DIMENSIONAL_LUMPED_MASS", "OTHER_THREE_DIMENSIONAL"]),
  softwareAndVersion: z.string(),
  modelFileRefs: z.array(z.string()),
  asModeledCondition: z.enum(["AS_DESIGNED", "AS_BUILT", "AS_OPERATED", "AS_INTENDED_TO_OPERATE"]),
  stiffnessRepresentation: z.string(),
  massRepresentation: z.string(),
  dampingRepresentation: z.string(),
  stressStateRepresentation: z.string(),
  directionalCoupling: z.string(),
  rotationalInertia: z.string(),
  diaphragmFlexibility: z.string(),
  torsionalEffects: z.string(),
  structuralCoupling: z.string(),
  foundationAndEmbedment: z.string(),
  nonlinearFeatures: z.array(z.string()),
  modalProperties: z.array(
    z.object({
      mode: z.number(),
      frequencyHz: z.number(),
      dampingRatio: z.number(),
      direction: z.string(),
      massParticipationFraction: z.number(),
    }),
  ),
  verificationAndValidation: z.string(),
  limitations: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ResponseScalingEvaluationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  sourceResponseAnalysisRef: z.string(),
  targetResponseAnalysisRef: z.string(),
  scaleFactor: z.number(),
  originalSpectrumRef: z.string(),
  targetSpectrumRef: z.string(),
  structuralModelSimilarity: z.string(),
  foundationSimilarity: z.string(),
  inputMotionSimilarity: z.string(),
  naturalFrequencyAndModeShapeEvaluation: z.string(),
  nonlinearPhenomenaEvaluation: z.string(),
  conservativeForCapabilityCategoryOne: z.boolean(),
  adequacyJustification: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicResponseResultSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  responseModelRef: z.string(),
  referenceEarthquakeRef: z.string(),
  location: z.string(),
  responseQuantity: z.enum(["FLOOR_RESPONSE_SPECTRUM", "STRUCTURAL_LOAD", "DISPLACEMENT", "ACCELERATION", "OTHER"]),
  direction: z.enum(["X", "Y", "Z", "COMBINED"]),
  medianValue: z.number().optional(),
  units: z.string(),
  spectrumPoints: z
    .array(
      z.object({
        frequencyHz: z.number(),
        periodSeconds: z.number(),
        medianResponse: z.number(),
      }),
    )
    .optional(),
  betaRandomness: z.number(),
  betaUncertainty: z.number(),
  compositeBeta: z.number().optional(),
  variabilityBasis: z.string(),
  applicableSscRefs: z.array(z.string()),
  outputFileRef: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SoilStructureInteractionAnalysisSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  applicable: z.boolean(),
  significanceAssessment: z.string(),
  analysisType: z.enum(["DETERMINISTIC", "PROBABILISTIC"]).optional(),
  method: z.string().optional(),
  siteSpecific: z.boolean(),
  soilProfileRefs: z.array(z.string()),
  strainCompatibleProperties: z.boolean(),
  propertyDistributions: z.record(z.string(), ParameterDistributionSchema).optional(),
  embedmentTreatment: z.string().optional(),
  groundMotionIncoherenceTreatment: z.string().optional(),
  structureSoilStructureInteractionTreatment: z.string().optional(),
  medianResponseResultRefs: z.array(z.string()),
  uncertaintyResultRefs: z.array(z.string()),
  exclusionOrMethodBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ProbabilisticResponseSimulationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  method: z.enum(["MONTE_CARLO", "LATIN_HYPERCUBE", "OTHER"]),
  simulationCount: z.number(),
  randomSeed: z.number().optional(),
  inputMotionSetCount: z.number(),
  componentsPerSet: z.number(),
  sampledAleatoryVariables: z.array(z.string()),
  sampledEpistemicVariables: z.array(z.string()),
  correlationTreatment: z.string(),
  convergenceMetric: z.string(),
  convergenceCriterion: z.string(),
  convergenceResults: z.array(
    z.object({
      sampleCount: z.number(),
      metricValue: z.number(),
    }),
  ),
  stableResponsesDemonstrated: z.boolean(),
  outputResultRefs: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicResponseAnalysisSchema = z.object({
  hazardSpectrumRefs: z.array(z.string()),
  threeOrthogonalDirectionsUsed: z.boolean(),
  referenceEarthquakes: z.array(ReferenceEarthquakeSchema),
  structuralModels: z.array(StructuralResponseModelSchema),
  scalingEvaluations: z.array(ResponseScalingEvaluationSchema),
  responseResults: z.array(SeismicResponseResultSchema),
  soilStructureInteractionAnalyses: z.array(SoilStructureInteractionAnalysisSchema),
  probabilisticSimulations: z.array(ProbabilisticResponseSimulationSchema),
  groundMotionParameterConsistency: z.string(),
  controlPointConsistency: z.string(),
  timeHistoryDevelopmentBasis: z.string(),
  medianCentered: z.boolean(),
  approximationBiasAssessment: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const InherentlyRuggedBasisSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  referenceGroundMotionParameter: z.string(),
  genericRuggedComponentTypes: z.array(z.string()),
  guidanceReferences: z.array(z.string()),
  plantSpecificAdditions: z.array(
    z.object({
      componentType: z.string(),
      justification: z.string(),
      supportingRefs: z.array(z.string()),
    }),
  ),
  excludedComponentTypes: z.array(z.string()),
  capacityBeyondRiskSignificantRangeBasis: z.string(),
  hazardIndependentBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const FragilityThresholdMethodSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  plantResponseThresholdRef: z.string(),
  groundMotionParameterRef: z.string(),
  controlPointRef: z.string(),
  thresholdCapacity: z.number(),
  capacityUnits: z.string(),
  cumulativeSscCountBasis: z.number(),
  correlationTreatment: z.string(),
  screeningCapacitySources: z.array(z.string()),
  caveatsAndInclusionRules: z.array(z.string()),
  comparisonMethod: z.string(),
  higherSeismicityAdjustment: z.string().optional(),
  satisfiesScr2: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const FragilityThresholdProgramSchema = z.object({
  inherentlyRuggedBases: z.array(InherentlyRuggedBasisSchema),
  thresholdMethods: z.array(FragilityThresholdMethodSchema),
  screenedSscRefs: z.array(z.string()),
  screeningConfirmationMethod: z.string(),
  anchorageAndSupportIncluded: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const InvestigationTeamMemberSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  organization: z.string().optional(),
  role: z.string(),
  seismicPerformanceExperience: z.string(),
  walkdownExperience: z.string().optional(),
  systemsOrOperationsExperience: z.string().optional(),
  qualifications: z.array(z.string()),
});

export const SeismicVulnerabilityFindingSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  sscRef: z.string(),
  findingType: z.enum([
    "ANCHORAGE_LOAD_PATH",
    "INTERNAL_ASSEMBLY",
    "CLEARANCE",
    "DIFFERENTIAL_DISPLACEMENT",
    "FALLING_HAZARD",
    "MAINTENANCE_CONDITION",
    "FLOOD_SOURCE",
    "FIRE_SOURCE",
    "INTERACTION",
    "OTHER",
  ]),
  description: z.string(),
  location: z.string(),
  credible: z.boolean(),
  potentiallyRiskSignificant: z.boolean(),
  affectedFunctionOrAction: z.string(),
  affectedFailureModeRefs: z.array(z.string()),
  resolutionOrFragilityTreatment: z.string(),
  evidenceRefs: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PlantInvestigationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  investigationType: z.enum(["WALKDOWN", "TABLETOP_REVIEW", "COMPUTERIZED_WALKDOWN", "DESIGN_DOCUMENT_REVIEW", "INTERVIEW"]),
  conditionBasis: z.enum(["AS_DESIGNED", "AS_BUILT", "AS_OPERATED", "AS_INTENDED_TO_OPERATE"]),
  date: z.string().optional(),
  scope: z.string(),
  procedures: z.string(),
  team: z.array(InvestigationTeamMemberSchema),
  designDocumentRefs: z.array(z.string()),
  sscRefsReviewed: z.array(z.string()),
  anchorageAndLoadPathReview: z.string(),
  observations: z.array(z.string()),
  findings: z.array(SeismicVulnerabilityFindingSchema),
  fragilityThresholdConfirmations: z.array(
    z.object({
      sscRef: z.string(),
      anchorageConfirmed: z.boolean(),
      supportConfirmed: z.boolean(),
      thresholdSatisfied: z.boolean(),
      basis: z.string(),
    }),
  ),
  conclusions: z.string(),
  limitations: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const FragilityFailureMechanismSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  sscRef: z.string(),
  systemsFailureModeRef: z.string(),
  mechanismType: FragilityMechanismTypeSchema,
  otherMechanismType: z.string().optional(),
  failureModeType: SeismicFailureModeTypeSchema,
  description: z.string(),
  demandParameter: z.string(),
  demandUnits: z.string(),
  demandResultRefs: z.array(z.string()),
  capacityParameter: z.string(),
  capacityUnits: z.string(),
  capacityDataRefs: z.array(z.string()),
  anchorageAndSupportLoadPath: z.string(),
  interactionRefs: z.array(z.string()),
  conservativeBounding: z.boolean(),
  realisticForRiskSignificantSsc: z.boolean(),
  controlling: z.boolean(),
  selectionBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const FragilityCurvePointSchema = z.object({
  groundMotion: z.number(),
  conditionalFailureProbability: z.number(),
});

export const SscFragilityEvaluationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  sscRef: z.string(),
  systemsFailureModeRef: z.string(),
  mechanismRefs: z.array(z.string()),
  controllingMechanismRef: z.string(),
  analysisCategory: z.enum(["GENERAL_SSC", "SOIL", "CONTACT_CHATTER", "FLOOD_SOURCE", "FIRE_SOURCE"]),
  evaluationBasis: FragilityEvaluationBasisSchema,
  plantSpecific: z.boolean(),
  genericDataJustification: z.string().optional(),
  riskSignificance: ImportanceLevelSchema,
  groundMotionParameterRef: z.string(),
  controlPointRef: z.string(),
  medianCapacity: z.number(),
  capacityUnits: z.string(),
  betaRandomness: z.number(),
  betaUncertainty: z.number(),
  compositeBeta: z.number().optional(),
  highConfidenceLowProbabilityOfFailureCapacity: z.number().optional(),
  meanFragilityCurve: z.array(FragilityCurvePointSchema),
  uncertaintyFractileCurves: z
    .array(
      z.object({
        fractile: z.number(),
        points: z.array(FragilityCurvePointSchema),
      }),
    )
    .optional(),
  demandToCapacityMethod: z.string(),
  responseResultRefs: z.array(z.string()),
  capacityDataRefs: z.array(z.string()),
  correlationGroupRefs: z.array(z.string()),
  thresholdMethodRef: z.string().optional(),
  thresholdSatisfied: z.boolean(),
  maskingEvaluation: z.string().optional(),
  sensitivityStudyRefs: z.array(z.string()),
  assumptions: z.array(z.string()),
  limitations: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const FragilityUncertaintySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  uncertaintyType: z.enum(["PARAMETER_ALEATORY", "PARAMETER_EPISTEMIC", "MODEL"]),
  description: z.string(),
  affectedSscRefs: z.array(z.string()),
  affectedFragilityRefs: z.array(z.string()),
  relatedAssumptions: z.array(z.string()),
  reasonableAlternatives: z.array(z.string()),
  treatment: z.string(),
  estimatedCapacityImpact: z
    .object({
      lowerFactor: z.number(),
      upperFactor: z.number(),
    })
    .optional(),
  quantificationImpactRef: z.string().optional(),
  importance: ImportanceLevelSchema.optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const FragilityAnalysisResultsSchema = z.object({
  failureMechanisms: z.array(FragilityFailureMechanismSchema),
  fragilityEvaluations: z.array(SscFragilityEvaluationSchema),
  correlationGroups: z.array(FragilityCorrelationGroupSchema),
  floodSourceFragilityRefs: z.array(z.string()),
  fireSourceFragilityRefs: z.array(z.string()),
  contactChatterFragilityRefs: z.array(z.string()),
  soilFragilityRefs: z.array(z.string()),
  uncertainties: z.array(FragilityUncertaintySchema),
  sensitivityStudies: z.array(SensitivityStudySchema),
  systemsModelTransferBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicFragilityDocumentationSchema = z.object({
  processDescription: z.string(),
  inputsDescription: z.string(),
  seismicResponseAnalysis: z.string(),
  ruggedAndThresholdMethodology: z.string(),
  investigationProcedures: z.string(),
  investigationTeamAndQualifications: z.string(),
  investigationObservationsAndConclusions: z.string(),
  designDocumentReview: z.string(),
  failureMechanismIdentification: z.string(),
  capacityEvaluationMethods: z.string(),
  fragilityParameterResults: z.string(),
  engineeringJudgments: z.string(),
  modelUncertaintiesAndAlternatives: z.string(),
  preOperationalAndBoundingSiteLimitations: z.string().optional(),
  dataAndCalculationRefs: z.array(z.string()),
  traceability: z.array(
    z.object({
      sscRef: z.string(),
      failureModeRef: z.string(),
      mechanismRefs: z.array(z.string()),
      demandRefs: z.array(z.string()),
      fragilityRef: z.string(),
      plantResponseModelRefs: z.array(z.string()),
    }),
  ),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicFragilityAnalysisSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  praScope: z.string(),
  scope: FragilityScopeSchema,
  seismicResponseAnalysis: SeismicResponseAnalysisSchema,
  thresholdProgram: FragilityThresholdProgramSchema,
  plantInvestigations: z.array(PlantInvestigationSchema),
  results: FragilityAnalysisResultsSchema,
  modelUncertainty: BaseModelUncertaintyDocumentationSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  documentation: SeismicFragilityDocumentationSchema,
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertSfrMirrorsType = Expect<Equal<z.infer<typeof SeismicFragilityAnalysisSchema>, SeismicFragilityAnalysis>>;
