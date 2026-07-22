import { ParameterDistribution } from "../core/events";
import { BaseModelUncertaintyDocumentation, PreOperationalAssumption } from "../core/documentation";
import { Named, Unique } from "../core/meta";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";
import { ImportanceLevel, SensitivityStudy } from "../core/shared-patterns";
import { FragilityCorrelationGroup, SeismicFailureModeType } from "../seismic/seismic-pra-common";

export type FragilityEvaluationBasis =
  | "PLANT_SPECIFIC_CALCULATION"
  | "PLANT_SPECIFIC_TEST"
  | "GENERIC_TEST_DATA"
  | "EARTHQUAKE_EXPERIENCE"
  | "SEISMIC_QUALIFICATION_DATA"
  | "DESIGN_CRITERIA"
  | "CONSERVATIVE_ASSUMPTION"
  | "ENGINEERING_JUDGMENT";

export type FragilityMechanismType =
  | "SLIDING"
  | "OVERTURNING"
  | "STRUCTURAL_YIELDING"
  | "EXCESSIVE_DRIFT"
  | "ANCHORAGE_FAILURE"
  | "FUNCTIONAL_FAILURE"
  | "IMPACT"
  | "BRACING_FAILURE"
  | "CONTACT_CHATTER"
  | "PRESSURE_BOUNDARY_FAILURE"
  | "LIQUEFACTION"
  | "SLOPE_INSTABILITY"
  | "DIFFERENTIAL_SETTLEMENT"
  | "FIRE_IGNITION"
  | "FLOOD_RELEASE"
  | "OTHER";

export interface FragilityScope {
  seismicEquipmentListRef: string;
  includedSscRefs: string[];
  excludedSscs: {
    sscRef: string;
    reason: string;
    modelDispositionRef?: string;
  }[];
  correlationGroupRefs: string[];
  scopeEvolutionSummary: string;
  systemsFragilityAlignment: string;
  implementsSrs: SRReference[];
}

export interface ReferenceEarthquake extends Unique, Named {
  hazardSpectrumRef: string;
  groundMotionParameterRef: string;
  controlPointRef: string;
  annualFrequencyOfExceedance?: number;
  groundMotionLevel: number;
  groundMotionUnits: string;
  horizontalComponentRefs: string[];
  verticalComponentRef: string;
  hazardRangeOfInterest: {
    lowerGroundMotion: number;
    upperGroundMotion: number;
    basis: string;
  };
  riskDominantInputLevel?: number;
  selectionMethod: string;
  selectionValidation: string;
  nonlinearBehaviorBasis: string;
  implementsSrs: SRReference[];
}

export interface StructuralResponseModel extends Unique, Named {
  structureRef: string;
  modelType: "THREE_DIMENSIONAL_FINITE_ELEMENT" | "THREE_DIMENSIONAL_LUMPED_MASS" | "OTHER_THREE_DIMENSIONAL";
  softwareAndVersion: string;
  modelFileRefs: string[];
  asModeledCondition: "AS_DESIGNED" | "AS_BUILT" | "AS_OPERATED" | "AS_INTENDED_TO_OPERATE";
  stiffnessRepresentation: string;
  massRepresentation: string;
  dampingRepresentation: string;
  stressStateRepresentation: string;
  directionalCoupling: string;
  rotationalInertia: string;
  diaphragmFlexibility: string;
  torsionalEffects: string;
  structuralCoupling: string;
  foundationAndEmbedment: string;
  nonlinearFeatures: string[];
  modalProperties: {
    mode: number;
    frequencyHz: number;
    dampingRatio: number;
    direction: string;
    massParticipationFraction: number;
  }[];
  verificationAndValidation: string;
  limitations: string[];
  implementsSrs: SRReference[];
}

export interface ResponseScalingEvaluation extends Unique, Named {
  sourceResponseAnalysisRef: string;
  targetResponseAnalysisRef: string;
  scaleFactor: number;
  originalSpectrumRef: string;
  targetSpectrumRef: string;
  structuralModelSimilarity: string;
  foundationSimilarity: string;
  inputMotionSimilarity: string;
  naturalFrequencyAndModeShapeEvaluation: string;
  nonlinearPhenomenaEvaluation: string;
  conservativeForCapabilityCategoryOne: boolean;
  adequacyJustification: string;
  implementsSrs: SRReference[];
}

export interface SeismicResponseResult extends Unique, Named {
  responseModelRef: string;
  referenceEarthquakeRef: string;
  location: string;
  responseQuantity: "FLOOR_RESPONSE_SPECTRUM" | "STRUCTURAL_LOAD" | "DISPLACEMENT" | "ACCELERATION" | "OTHER";
  direction: "X" | "Y" | "Z" | "COMBINED";
  medianValue?: number;
  units: string;
  spectrumPoints?: {
    frequencyHz: number;
    periodSeconds: number;
    medianResponse: number;
  }[];
  betaRandomness: number;
  betaUncertainty: number;
  compositeBeta?: number;
  variabilityBasis: string;
  applicableSscRefs: string[];
  outputFileRef?: string;
  implementsSrs: SRReference[];
}

export interface SoilStructureInteractionAnalysis extends Unique, Named {
  applicable: boolean;
  significanceAssessment: string;
  analysisType?: "DETERMINISTIC" | "PROBABILISTIC";
  method?: string;
  siteSpecific: boolean;
  soilProfileRefs: string[];
  strainCompatibleProperties: boolean;
  propertyDistributions?: Record<string, ParameterDistribution>;
  embedmentTreatment?: string;
  groundMotionIncoherenceTreatment?: string;
  structureSoilStructureInteractionTreatment?: string;
  medianResponseResultRefs: string[];
  uncertaintyResultRefs: string[];
  exclusionOrMethodBasis: string;
  implementsSrs: SRReference[];
}

export interface ProbabilisticResponseSimulation extends Unique, Named {
  method: "MONTE_CARLO" | "LATIN_HYPERCUBE" | "OTHER";
  simulationCount: number;
  randomSeed?: number;
  inputMotionSetCount: number;
  componentsPerSet: number;
  sampledAleatoryVariables: string[];
  sampledEpistemicVariables: string[];
  correlationTreatment: string;
  convergenceMetric: string;
  convergenceCriterion: string;
  convergenceResults: {
    sampleCount: number;
    metricValue: number;
  }[];
  stableResponsesDemonstrated: boolean;
  outputResultRefs: string[];
  implementsSrs: SRReference[];
}

export interface SeismicResponseAnalysis {
  hazardSpectrumRefs: string[];
  threeOrthogonalDirectionsUsed: boolean;
  referenceEarthquakes: ReferenceEarthquake[];
  structuralModels: StructuralResponseModel[];
  scalingEvaluations: ResponseScalingEvaluation[];
  responseResults: SeismicResponseResult[];
  soilStructureInteractionAnalyses: SoilStructureInteractionAnalysis[];
  probabilisticSimulations: ProbabilisticResponseSimulation[];
  groundMotionParameterConsistency: string;
  controlPointConsistency: string;
  timeHistoryDevelopmentBasis: string;
  medianCentered: boolean;
  approximationBiasAssessment: string;
  implementsSrs: SRReference[];
}

export interface InherentlyRuggedBasis extends Unique, Named {
  referenceGroundMotionParameter: string;
  genericRuggedComponentTypes: string[];
  guidanceReferences: string[];
  plantSpecificAdditions: {
    componentType: string;
    justification: string;
    supportingRefs: string[];
  }[];
  excludedComponentTypes: string[];
  capacityBeyondRiskSignificantRangeBasis: string;
  hazardIndependentBasis: string;
  implementsSrs: SRReference[];
}

export interface FragilityThresholdMethod extends Unique, Named {
  plantResponseThresholdRef: string;
  groundMotionParameterRef: string;
  controlPointRef: string;
  thresholdCapacity: number;
  capacityUnits: string;
  cumulativeSscCountBasis: number;
  correlationTreatment: string;
  screeningCapacitySources: string[];
  caveatsAndInclusionRules: string[];
  comparisonMethod: string;
  higherSeismicityAdjustment?: string;
  satisfiesScr2: boolean;
  implementsSrs: SRReference[];
}

export interface FragilityThresholdProgram {
  inherentlyRuggedBases: InherentlyRuggedBasis[];
  thresholdMethods: FragilityThresholdMethod[];
  screenedSscRefs: string[];
  screeningConfirmationMethod: string;
  anchorageAndSupportIncluded: boolean;
  implementsSrs: SRReference[];
}

export interface InvestigationTeamMember extends Unique {
  name: string;
  organization?: string;
  role: string;
  seismicPerformanceExperience: string;
  walkdownExperience?: string;
  systemsOrOperationsExperience?: string;
  qualifications: string[];
}

export interface SeismicVulnerabilityFinding extends Unique, Named {
  sscRef: string;
  findingType:
    | "ANCHORAGE_LOAD_PATH"
    | "INTERNAL_ASSEMBLY"
    | "CLEARANCE"
    | "DIFFERENTIAL_DISPLACEMENT"
    | "FALLING_HAZARD"
    | "MAINTENANCE_CONDITION"
    | "FLOOD_SOURCE"
    | "FIRE_SOURCE"
    | "INTERACTION"
    | "OTHER";
  description: string;
  location: string;
  credible: boolean;
  potentiallyRiskSignificant: boolean;
  affectedFunctionOrAction: string;
  affectedFailureModeRefs: string[];
  resolutionOrFragilityTreatment: string;
  evidenceRefs: string[];
  implementsSrs: SRReference[];
}

export interface PlantInvestigation extends Unique, Named {
  investigationType: "WALKDOWN" | "TABLETOP_REVIEW" | "COMPUTERIZED_WALKDOWN" | "DESIGN_DOCUMENT_REVIEW" | "INTERVIEW";
  conditionBasis: "AS_DESIGNED" | "AS_BUILT" | "AS_OPERATED" | "AS_INTENDED_TO_OPERATE";
  date?: string;
  scope: string;
  procedures: string;
  team: InvestigationTeamMember[];
  designDocumentRefs: string[];
  sscRefsReviewed: string[];
  anchorageAndLoadPathReview: string;
  observations: string[];
  findings: SeismicVulnerabilityFinding[];
  fragilityThresholdConfirmations: {
    sscRef: string;
    anchorageConfirmed: boolean;
    supportConfirmed: boolean;
    thresholdSatisfied: boolean;
    basis: string;
  }[];
  conclusions: string;
  limitations: string[];
  implementsSrs: SRReference[];
}

export interface FragilityFailureMechanism extends Unique, Named {
  sscRef: string;
  systemsFailureModeRef: string;
  mechanismType: FragilityMechanismType;
  otherMechanismType?: string;
  failureModeType: SeismicFailureModeType;
  description: string;
  demandParameter: string;
  demandUnits: string;
  demandResultRefs: string[];
  capacityParameter: string;
  capacityUnits: string;
  capacityDataRefs: string[];
  anchorageAndSupportLoadPath: string;
  interactionRefs: string[];
  conservativeBounding: boolean;
  realisticForRiskSignificantSsc: boolean;
  controlling: boolean;
  selectionBasis: string;
  implementsSrs: SRReference[];
}

export interface FragilityCurvePoint {
  groundMotion: number;
  conditionalFailureProbability: number;
}

export interface SscFragilityEvaluation extends Unique, Named {
  sscRef: string;
  systemsFailureModeRef: string;
  mechanismRefs: string[];
  controllingMechanismRef: string;
  analysisCategory: "GENERAL_SSC" | "SOIL" | "CONTACT_CHATTER" | "FLOOD_SOURCE" | "FIRE_SOURCE";
  evaluationBasis: FragilityEvaluationBasis;
  plantSpecific: boolean;
  genericDataJustification?: string;
  riskSignificance: ImportanceLevel;
  groundMotionParameterRef: string;
  controlPointRef: string;
  medianCapacity: number;
  capacityUnits: string;
  betaRandomness: number;
  betaUncertainty: number;
  compositeBeta?: number;
  highConfidenceLowProbabilityOfFailureCapacity?: number;
  meanFragilityCurve: FragilityCurvePoint[];
  uncertaintyFractileCurves?: {
    fractile: number;
    points: FragilityCurvePoint[];
  }[];
  demandToCapacityMethod: string;
  responseResultRefs: string[];
  capacityDataRefs: string[];
  correlationGroupRefs: string[];
  thresholdMethodRef?: string;
  thresholdSatisfied: boolean;
  maskingEvaluation?: string;
  sensitivityStudyRefs: string[];
  assumptions: string[];
  limitations: string[];
  implementsSrs: SRReference[];
}

export interface FragilityUncertainty extends Unique, Named {
  uncertaintyType: "PARAMETER_ALEATORY" | "PARAMETER_EPISTEMIC" | "MODEL";
  description: string;
  affectedSscRefs: string[];
  affectedFragilityRefs: string[];
  relatedAssumptions: string[];
  reasonableAlternatives: string[];
  treatment: string;
  estimatedCapacityImpact?: {
    lowerFactor: number;
    upperFactor: number;
  };
  quantificationImpactRef?: string;
  importance?: ImportanceLevel;
  implementsSrs: SRReference[];
}

export interface FragilityAnalysisResults {
  failureMechanisms: FragilityFailureMechanism[];
  fragilityEvaluations: SscFragilityEvaluation[];
  correlationGroups: FragilityCorrelationGroup[];
  floodSourceFragilityRefs: string[];
  fireSourceFragilityRefs: string[];
  contactChatterFragilityRefs: string[];
  soilFragilityRefs: string[];
  uncertainties: FragilityUncertainty[];
  sensitivityStudies: SensitivityStudy[];
  systemsModelTransferBasis: string;
  implementsSrs: SRReference[];
}

export interface SeismicFragilityDocumentation {
  processDescription: string;
  inputsDescription: string;
  seismicResponseAnalysis: string;
  ruggedAndThresholdMethodology: string;
  investigationProcedures: string;
  investigationTeamAndQualifications: string;
  investigationObservationsAndConclusions: string;
  designDocumentReview: string;
  failureMechanismIdentification: string;
  capacityEvaluationMethods: string;
  fragilityParameterResults: string;
  engineeringJudgments: string;
  modelUncertaintiesAndAlternatives: string;
  preOperationalAndBoundingSiteLimitations?: string;
  dataAndCalculationRefs: string[];
  traceability: {
    sscRef: string;
    failureModeRef: string;
    mechanismRefs: string[];
    demandRefs: string[];
    fragilityRef: string;
    plantResponseModelRefs: string[];
  }[];
  implementsSrs: SRReference[];
}

export interface SeismicFragilityAnalysis extends Unique, Named {
  praScope: string;
  scope: FragilityScope;
  seismicResponseAnalysis: SeismicResponseAnalysis;
  thresholdProgram: FragilityThresholdProgram;
  plantInvestigations: PlantInvestigation[];
  results: FragilityAnalysisResults;
  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];
  documentation: SeismicFragilityDocumentation;
}

const ALL_PLANT_STAGES: PlantStage[] = ["OPERATIONAL", "PRE_OPERATIONAL"];

export const SFR_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  "SFR-A1": { hlr: "A", stages: ALL_PLANT_STAGES },
  "SFR-A2": { hlr: "A", stages: ALL_PLANT_STAGES },
  "SFR-B1": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SFR-B2": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SFR-B3": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SFR-B4": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SFR-B5": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SFR-B6": { hlr: "B", stages: ALL_PLANT_STAGES },
  "SFR-C1": { hlr: "C", stages: ALL_PLANT_STAGES },
  "SFR-C2": { hlr: "C", stages: ALL_PLANT_STAGES },
  "SFR-D1": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SFR-D2": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SFR-D3": { hlr: "D", stages: ["OPERATIONAL"] },
  "SFR-D4": { hlr: "D", stages: ["PRE_OPERATIONAL"] },
  "SFR-D5": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SFR-D6": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SFR-D7": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SFR-D8": { hlr: "D", stages: ALL_PLANT_STAGES },
  "SFR-E1": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SFR-E2": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SFR-E3": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SFR-E4": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SFR-E5": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SFR-E6": { hlr: "E", stages: ALL_PLANT_STAGES },
  "SFR-E7": { hlr: "E", stages: ["PRE_OPERATIONAL"] },
  "SFR-F1": { hlr: "F", stages: ALL_PLANT_STAGES },
  "SFR-F2": { hlr: "F", stages: ALL_PLANT_STAGES },
  "SFR-F3": { hlr: "F", stages: ALL_PLANT_STAGES },
};
