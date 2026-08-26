import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Unique, Named } from "../core/meta";
import { Frequency, FrequencyWithDistribution, ParameterDistribution } from "../core/events";
import { ImportanceLevel, SensitivityStudy, BaseUncertaintyAnalysis } from "../core/shared-patterns";
import { BaseModelUncertaintyDocumentation, PreOperationalAssumption } from "../core/documentation";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";
import type { EsqBayesianNetwork, EsqHclConfiguration } from "./workbook-models";
import type { EventSequenceFamilyWorkbookReference } from "../modeling/references";

export type EventSequenceReference = string;
export type EventSequenceFamilyReference = string;
export type PlantOperatingStateReference = string;
export type InitiatingEventReference = string;
export type HazardGroupReference = string;
export type SystemReference = string;
export type ComponentReference = string;
export type HumanActionReference = string;
export type HrDependencyAssessmentReference = string;
export type RecoveryActionReference = string;
export type ReleaseCategoryReference = string;
export type SourceReference = string;
export type PlantDamageStateReference = string;
export type RadionuclideBarrierReference = string;
export type DataAnalysisParameterReference = string;
export type CcfGroupReference = string;

export enum DependencyType {
  FUNCTIONAL = "FUNCTIONAL",
  PHYSICAL = "PHYSICAL",
  HUMAN = "HUMAN",
  OPERATIONAL = "OPERATIONAL",
  PHENOMENOLOGICAL = "PHENOMENOLOGICAL",
  COMMON_CAUSE = "COMMON_CAUSE",
}

export enum TruncationMethod {
  ABSOLUTE_FREQUENCY = "ABSOLUTE_FREQUENCY",
  PERCENTAGE_OF_TOTAL = "PERCENTAGE_OF_TOTAL",
  SIGNIFICANT_DIGITS = "SIGNIFICANT_DIGITS",
  RELATIVE_CONTRIBUTION = "RELATIVE_CONTRIBUTION",
}

export enum QuantificationApproach {
  FAULT_TREE_LINKING = "FAULT_TREE_LINKING",
  EVENT_TREE_BOUNDARY_CONDITIONS = "EVENT_TREE_BOUNDARY_CONDITIONS",
  BINARY_DECISION_DIAGRAM = "BINARY_DECISION_DIAGRAM",
  MARKOV_MODEL = "MARKOV_MODEL",
  DISCRETE_EVENT_SIMULATION = "DISCRETE_EVENT_SIMULATION",
  MONTE_CARLO_SIMULATION = "MONTE_CARLO_SIMULATION",
}

export enum CircularLogicResolutionMethod {
  CONDITIONAL_SPLIT_FRACTIONS = "CONDITIONAL_SPLIT_FRACTIONS",
  TRANSFER_GATES = "TRANSFER_GATES",
  ITERATIVE_CONVERGENCE = "ITERATIVE_CONVERGENCE",
  LOGIC_TRANSFORMATION = "LOGIC_TRANSFORMATION",
}

export interface EventSequenceFamilyQuantification extends Unique, Named {
  eventSequenceFamilyRef: EventSequenceFamilyReference;
  eventSequenceFamilyReference?: EventSequenceFamilyWorkbookReference;
  crossSourceGroupingJustification?: string;
  crossPosGroupingJustification?: string;
  dependenciesConsideredInGrouping: boolean;
  representativeSequenceSelectionBasis?: string;
  quantificationBasis: "POINT_ESTIMATE" | "MEAN_PROPAGATED_SOKC" | "MEAN_RISK_SIGNIFICANT_PARAMETERS";
  meanFrequency: Frequency | FrequencyWithDistribution;
  frequencyDistribution?: ParameterDistribution;
  percentile05?: number;
  percentile50?: number;
  percentile95?: number;
  significantUncertaintySources?: string[];
  contributionBreakdown?: {
    contributorRef: string;
    contributorType: string;
    fractionalContribution: number;
  }[];
  quantificationResultRef?: number;
  implementsSrs: SRReference[];
}

export interface SequenceFrequencyEstimate extends Unique {
  eventSequenceRef: EventSequenceReference;
  meanFrequency: Frequency | FrequencyWithDistribution;
  frequencyDistribution?: ParameterDistribution;
  percentile05?: number;
  percentile50?: number;
  percentile95?: number;
  quantificationResultRef?: number;
  implementsSrs: SRReference[];
}

export interface ModelIntegration {
  integrationMethod: string;
  softwareTools: string[];
  integrationSteps: string[];
  integrationVerification: string;
  scopeCoverage: {
    radionuclideSources: SourceReference[];
    initiatingEventGroups: InitiatingEventReference[];
    hazardGroups: HazardGroupReference[];
    plantOperatingStates: PlantOperatingStateReference[];
    plantEvolutions: string[];
  };
  systemDependenciesAccounted: boolean;
  multiReactorSequencesIncluded: boolean;
  multiReactorInclusionBasis?: string;
  integrationIssues?: {
    description: string;
    resolution: string;
  }[];
  implementsSrs: SRReference[];
}

export interface ComputerCodeRecord {
  name: string;
  version: string;
  verificationDocumentation: string;
  validationDocumentation: string;
  benchmarkComparison?: string;
  methodSpecificLimitations: string[];
  methodSpecificFeatures?: string[];
  implementsSrs: SRReference[];
}

export interface ConvergenceAnalysis {
  truncationMethod: TruncationMethod;
  finalTruncationValue: number;
  truncationProgression: number[];
  frequencyAtTruncation: Record<number, number>;
  percentageChangeAtTruncation: Record<number, number>;
  basisForSelection: string;
  convergenceDemonstration: string;
  dependenciesPreservedAtTruncation: boolean;
  mergedCutsetTruncationConfirmed?: boolean;
  mergedCutsetConfirmationBasis?: string;
  truncationSensitivity?: string;
  demonstratedFamilyRef?: string;
  implementsSrs: SRReference[];
}

export interface QuantificationMethods {
  approach: QuantificationApproach;
  methodDiscriminationJustification: string;
  cutsetSolutionMethod?: "MCUB" | "EXACT" | "RARE_EVENT";
  rareEventJustification?: string;
  computerCodes: ComputerCodeRecord[];
  truncation: ConvergenceAnalysis;
  postInitiatorHfeHandling?: string;
  implementsSrs: SRReference[];
}

export interface RecoveryActionApplication extends Unique {
  recoveryActionRef: RecoveryActionReference;
  appliedAtLevel: "FAMILY" | "SEQUENCE" | "CUTSET";
  applicableFamilyRefs?: EventSequenceFamilyReference[];
  hrFeasibilityRequirementsSatisfied: boolean;
  hrDependencyRequirementsSatisfied: boolean;
  implementsSrs: SRReference[];
}

export interface ParameterConsistencyAttestation {
  capabilityCategory: "CC_I" | "CC_II";
  hrParameterConsistency: boolean;
  daParameterConsistency: boolean;
  sequenceConditionsConsidered: boolean;
  harshEnvironmentsConsidered: boolean;
  basis: string;
  implementsSrs: SRReference[];
}

export interface PhenomenaParameterBasis extends Unique {
  familyRef: EventSequenceFamilyReference;
  isRiskSignificant: boolean;
  basis: "CONSERVATIVE" | "REALISTIC" | "COMBINED";
  justification: string;
  implementsSrs: SRReference[];
}

export interface CircularLogicResolution extends Unique {
  description: string;
  involvedElementIds: string[];
  detectionMethod: string;
  resolutionMethod: CircularLogicResolutionMethod;
  resolutionDescription: string;
  neutralityJustification: string;
  resolutionImpact?: string;
  implementsSrs: SRReference[];
}

export interface SystemSuccessTreatment {
  treatmentMethod: string;
  systemsWithSuccessModeled: SystemReference[];
  impactOnResults: string;
  modelingExamples?: string[];
  implementsSrs: SRReference[];
}

export interface MutuallyExclusiveEventRule extends Unique {
  description: string;
  eventIds: string[];
  basis: string;
  identifiedInResults: boolean;
  treatment: "LOGIC_ELIMINATION" | "CUTSET_DELETION";
  retentionJustification?: string;
  implementsSrs: SRReference[];
}

export interface FlagEventSetting extends Unique, Named {
  purpose: string;
  state: boolean;
  effect: string;
  basis: string;
  isTemporary: boolean;
  applicableFamilyRefs?: EventSequenceFamilyReference[];
  setPriorToCutsetGeneration: boolean;
  houseEventNodeRef?: number;
  implementsSrs: SRReference[];
}

export interface ModuleUsageRecord extends Unique {
  moduleType: "MODULE" | "SUBTREE" | "SPLIT_FRACTION";
  processDescription: string;
  sharedEventsIdentified: boolean;
  trueIndependenceVerified: boolean;
  perEventInterpretabilityMaintained: boolean;
  implementsSrs: SRReference[];
}

export interface MultiHfeCutsetIdentification extends Unique {
  quantificationResultRef?: number;
  cutsetDescription: string;
  hfeRefs: HumanActionReference[];
  potentialRiskImpact: string;
  implementsSrs: SRReference[];
}

export interface HfeDependencyApplication extends Unique {
  hrDependencyAssessmentRef: HrDependencyAssessmentReference;
  cutsetContext: string;
  appliedJointHep?: number;
  implementsSrs: SRReference[];
}

export interface LinkingTransferRecord extends Unique {
  sourceTreeDescription: string;
  targetTreeDescription: string;
  failedEquipmentTransferred: string[];
  flagSettingsTransferred: string[];
  otherCharacteristicsTransferred?: string[];
  frequencyTransferred: boolean;
  implementsSrs: SRReference[];
}

export interface PhenomenaDependencyAssessment extends Unique {
  phenomenon: string;
  affectedSscRefs: (SystemReference | ComponentReference)[];
  dependencyAssessment: string;
  independenceJustifications?: string[];
  implementsSrs: SRReference[];
}

export interface BarrierFailureModeQuantification {
  failureMode: string;
  failureType: "GROSS" | "LOCALIZED_DEGRADED";
  mechanisms: string[];
  probability?: number;
  perFamilyProbabilities?: {
    familyRef: EventSequenceFamilyReference;
    probability: number;
  }[];
}

export interface RadionuclideBarrierQuantification extends Unique, Named {
  barrierRef?: RadionuclideBarrierReference;
  applicableSourceRefs: SourceReference[];
  failureModes: BarrierFailureModeQuantification[];
  challengingPhenomena: string[];
  hazardSpecificMechanisms?: string[];
  designSpecificDegradationMechanisms?: string[];
  screenedOutMechanisms?: {
    mechanism: string;
    criterion: "SCR-2" | "SCR-3";
    justification: string;
  }[];
  challengeAssessment: {
    basis: "CONSERVATIVE_GENERIC_ESTIMATE" | "REALISTIC_PLANT_SPECIFIC_CALCULATION";
    challenges: string[];
    genericApplicabilityJustification?: string;
  };
  capacityEvaluation: {
    basis: "CONSERVATIVE" | "REALISTIC";
    description: string;
    inServiceAgingIncluded?: boolean;
  };
  externalHazardCapacity?: {
    hazard: string;
    basis: "ESTIMATED" | "FRAGILITY_CURVES";
    fragilityReference?: string;
  }[];
  implementsSrs: SRReference[];
}

export interface PhenomenaModelLogic {
  logicIncluded: boolean;
  description: string;
  scrubbingEffectsIncluded?: boolean;
  scrubbingJustification?: string;
  beneficialFailuresIncluded?: boolean;
  beneficialFailureJustification?: string;
  implementsSrs: SRReference[];
}

export interface PostReleaseHfeTreatment extends Unique {
  hfeRefs: HumanActionReference[];
  treatment: "CONSERVATIVE" | "DETAILED_RISK_SIGNIFICANT";
  basis: string;
  implementsSrs: SRReference[];
}

export interface EquipmentSurvivabilityAssessment extends Unique {
  equipmentRefs: ComponentReference[];
  environmentalConditions: {
    type: string;
    severity: string;
  }[];
  survivabilityCriteria: string;
  assessmentResults: {
    equipmentRef: ComponentReference;
    survives: boolean;
    basis: string;
  }[];
  creditTaken: boolean;
  creditJustification?: string;
  engineeringAnalysisRefs?: string[];
  requirementsSatisfied?: {
    syA29: boolean;
    hrH2: boolean;
    esqC2: boolean;
    esqC4: boolean;
  };
  barrierFailureImpactJustification?: string;
  implementsSrs: SRReference[];
}

export interface DependencyTypeTreatment {
  type: DependencyType;
  treatmentDescription: string;
  modelingMethod: string;
  examples?: string[];
}

export interface DependencyTreatment {
  dependenciesByType: DependencyTypeTreatment[];
  postInitiatorHfeDependencyMethod: string;
  postInitiatorHfeDependencyBasis: string;
  ccfTreatment: {
    modelingApproach: string;
    parameterBasis: string;
    ccfGroupRefs: CcfGroupReference[];
  };
  recoveryDependencyTreatment: string;
  implementsSrs: SRReference[];
}

export interface CutsetLogicReviewRecord extends Unique {
  sampleDescription: string;
  quantificationResultRef?: number;
  logicCorrect: boolean;
  findings: string;
  correctiveActions?: string[];
  implementsSrs: SRReference[];
}

export interface ConsistencyReviewRecord extends Unique {
  modelingConsistencyConfirmed: boolean;
  modelingFindings?: string;
  operationalConsistencyConfirmed: boolean;
  operationalFindings?: string;
  implementsSrs: SRReference[];
}

export interface RuleLogicReviewRecord extends Unique {
  flagSettingsReviewed: boolean;
  mutuallyExclusiveRulesReviewed: boolean;
  recoveryRulesReviewed: boolean;
  logicalResultsConfirmed: boolean;
  findings?: string;
  implementsSrs: SRReference[];
}

export interface SimilarPlantComparison extends Unique {
  comparisonPlants: string[];
  keyDifferences: string[];
  differenceCauses?: string[];
  implementsSrs: SRReference[];
}

export interface NonSignificantSampleReview extends Unique {
  sampleDescription: string;
  physicallyMeaningful: boolean;
  findings: string;
  implementsSrs: SRReference[];
}

export enum RiskSignificantContributorType {
  PLANT_OPERATING_STATE = "PLANT_OPERATING_STATE",
  INITIATING_EVENT = "INITIATING_EVENT",
  HAZARD_GROUP = "HAZARD_GROUP",
  EVENT_SEQUENCE_FAMILY = "EVENT_SEQUENCE_FAMILY",
  EVENT_SEQUENCE = "EVENT_SEQUENCE",
  EQUIPMENT_FAILURE = "EQUIPMENT_FAILURE",
  CCF = "CCF",
  HUMAN_FAILURE_EVENT = "HUMAN_FAILURE_EVENT",
  PLANT_DAMAGE_STATE = "PLANT_DAMAGE_STATE",
  EVENT_PHENOMENON = "EVENT_PHENOMENON",
  BARRIER_FAILURE_MODE = "BARRIER_FAILURE_MODE",
}

export interface RiskSignificantContributor extends Unique {
  contributorType: RiskSignificantContributorType;
  entityRef: string;
  applicableFamilyRefs: EventSequenceFamilyReference[];
  fractionalContribution?: number;
  riskSignificanceCriteriaBasis: string;
  reactorScope?: "SINGLE_REACTOR" | "MULTI_REACTOR";
  contributionPhase?: "INITIATING_EVENT_OCCURRENCE" | "MITIGATION_FAILURE";
  basis: string;
  implementsSrs: SRReference[];
}

export interface ImportanceMeasureEntry {
  entityType: "BASIC_EVENT" | "INITIATING_EVENT" | "HUMAN_FAILURE_EVENT" | "CCF_GROUP" | "SYSTEM" | "COMPONENT";
  entityRef: string;
  solverBasicEventId?: number;
  systemRef?: SystemReference;
  humanFailureEventRef?: HumanActionReference;
  dataAnalysisParameterRef?: DataAnalysisParameterReference;
  fussellVesely?: number;
  riskAchievementWorth?: number;
  riskReductionWorth?: number;
  birnbaum?: number;
  criticality?: number;
}

export interface ImportanceAnalysisRecord extends Unique {
  scope: "OVERALL" | "PER_FAMILY" | "PER_SEQUENCE";
  familyRef?: EventSequenceFamilyReference;
  sequenceRef?: EventSequenceReference;
  measures: ImportanceMeasureEntry[];
  significanceCutoff?: number;
  quantificationResultRef?: number;
  implementsSrs: SRReference[];
}

export interface ImportanceReviewRecord extends Unique {
  scope: string;
  riCriteriaBasis: string;
  consistentWithExpectations: boolean;
  unexpectedResults?: {
    entityRef: string;
    description: string;
    reconciliation: string;
  }[];
  implementsSrs: SRReference[];
}

export interface ScreenedEventCumulativeAssessment {
  screenedInitiatingEventRefs: InitiatingEventReference[];
  cumulativeImpactAssessment: string;
  affectsRiskSignificantContributors: boolean;
  basis: string;
  implementsSrs: SRReference[];
}

export interface ModelUncertaintySourceAssessment extends Unique {
  sourceElementCode: "POS" | "IE" | "ES" | "SC" | "SY" | "HR" | "DA" | "ESQ";
  uncertaintySource: string;
  relatedAssumptions: string[];
  evaluationType: "QUALITATIVE" | "QUANTITATIVE";
  evaluationScope: "INDIVIDUAL" | "COMBINATION";
  effectOnFamilyFrequencies: string;
  implementsSrs: SRReference[];
}

export interface UncertaintyPropagation extends BaseUncertaintyAnalysis {
  characterizationLevel: "CHARACTERIZED" | "PROPAGATED_RISK_SIGNIFICANT_SOKC";
  parameterUncertainties: {
    parameterRef: DataAnalysisParameterReference;
    distribution: ParameterDistribution;
    basis: string;
  }[];
  stateOfKnowledgeCorrelation: {
    isConsidered: boolean;
    justificationIfNotConsidered?: string;
    handlingMethod?: "SAME_RANDOM_SEED" | "EXPLICIT_CORRELATION_MATRIX" | "PARAMETER_GROUPING" | "OTHER";
    handlingDescription?: string;
    correlatedParameterGroups?: DataAnalysisParameterReference[][];
    impactAssessment?: string;
  };
  implementsSrs: SRReference[];
}

export interface RiskIntegrationFeedback {
  analysisRef: string;
  feedbackDate?: string;
  sequenceFeedback?: {
    sequenceRef: EventSequenceReference;
    riskSignificance?: ImportanceLevel;
    insights?: string[];
    recommendations?: string[];
  }[];
  generalFeedback?: string;
  response?: {
    description: string;
    changes?: string[];
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  };
}

export interface EsqDocumentation {
  processDescription: string;
  inputsDescription: string;
  appliedMethods: string;
  resultsSummary: string;
  nonRecoveryTermsProcess: string;
  cutsetReviewProcess: string;
  quantificationProcessDescription: string;
  truncationConvergenceProcess: string;
  familyFrequenciesAndContributions: string;
  aggregationDisaggregationInsights: string;
  sequenceBinningMethod: string;
  intermediateStateDependencyTreatment: string;
  nonSignificanceDrivingFactors: string;
  releaseCategoryResolutionInputs: string;
  barrierChallengeTreatment: string;
  barrierCapacityBasis: string;
  uncertaintySensitivityResults: string;
  importanceResults: string;
  mutuallyExclusiveEventsEliminated: string;
  modelingAsymmetries: string;
  codeVerificationProcess: string;
  undocumentedParameterEstimatesBasis: string;
  pdsPreservationApproach: string;
  scopeAssumptionDrivenContributors: string;
  similarPlantComparison: string;
  riskSignificantContributorsDocumentation: string;
  uncertaintySourcesDocumentation: string;
  limitationsForApplications: string;
  asBuiltLimitations: string;
  praTaskInterfaces: string;
  implementsSrs: SRReference[];
}

export interface EventSequenceQuantification
  extends TechnicalElement<TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION> {
  praScope: string;

  bayesianNetworks: EsqBayesianNetwork[];
  hclConfigurations: EsqHclConfiguration[];

  familyQuantifications: EventSequenceFamilyQuantification[];
  sequenceFrequencyEstimates?: SequenceFrequencyEstimate[];

  modelIntegration: ModelIntegration;
  quantificationMethods: QuantificationMethods;
  parameterConsistency: ParameterConsistencyAttestation;
  phenomenaParameterBases?: PhenomenaParameterBasis[];
  recoveryActionApplications?: RecoveryActionApplication[];

  circularLogicResolutions?: CircularLogicResolution[];
  systemSuccessTreatment: SystemSuccessTreatment;
  mutuallyExclusiveEventRules?: MutuallyExclusiveEventRule[];
  flagEventSettings?: FlagEventSetting[];
  moduleUsageRecords?: ModuleUsageRecord[];

  dependencyTreatment: DependencyTreatment;
  multiHfeCutsetIdentifications?: MultiHfeCutsetIdentification[];
  hfeDependencyApplications?: HfeDependencyApplication[];
  linkingTransferRecords?: LinkingTransferRecord[];
  phenomenaDependencyAssessments?: PhenomenaDependencyAssessment[];
  barrierQuantifications: RadionuclideBarrierQuantification[];
  phenomenaModelLogic?: PhenomenaModelLogic;
  postReleaseHfeTreatments?: PostReleaseHfeTreatment[];
  equipmentSurvivabilityAssessments?: EquipmentSurvivabilityAssessment[];

  cutsetLogicReviews: CutsetLogicReviewRecord[];
  consistencyReviews: ConsistencyReviewRecord[];
  ruleLogicReviews: RuleLogicReviewRecord[];
  similarPlantComparisons?: SimilarPlantComparison[];
  nonSignificantSampleReviews: NonSignificantSampleReview[];

  riskSignificantContributors: RiskSignificantContributor[];
  importanceAnalyses?: ImportanceAnalysisRecord[];
  importanceReviews?: ImportanceReviewRecord[];
  screenedEventCumulativeAssessment?: ScreenedEventCumulativeAssessment;

  modelUncertaintySourceAssessments?: ModelUncertaintySourceAssessment[];
  uncertaintyPropagation: UncertaintyPropagation;
  sensitivityStudies?: SensitivityStudy[];

  quantificationRequestRefs?: number[];
  quantificationResultRefs?: number[];

  riskIntegrationFeedback?: RiskIntegrationFeedback;

  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];

  documentation: EsqDocumentation;

  configurationControlRecordId?: string;
  exampleDocuments?: ExampleDocumentRef[];
  newlyDevelopedMethodIds?: string[];
}

export interface ExampleDocumentRef {
  id: string;
  name: string;
  kind: "doc" | "sheet" | "image";
  sizeLabel: string;
  uploadedLabel: string;
  extracted: string;
  linked: number;
  url?: string;
}

export const ESQ_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  "ESQ-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-A4": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-A5": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-A6": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-A7": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-A8": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-A9": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-B3": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-B4": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-B5": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-B6": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-B7": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-B8": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-B9": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-B10": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C2": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C3": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C4": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C5": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C6": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C7": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C8": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C9": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C10": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C11": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C12": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C13": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C14": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C15": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C16": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-C17": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "ESQ-D1": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-D2": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-D3": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-D4": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-D5": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-D6": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-D7": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-D8": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-E1": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-E2": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-F1": { hlr: "F", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-F2": { hlr: "F", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-F3": { hlr: "F", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-F4": { hlr: "F", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ESQ-F5": { hlr: "F", stages: ["PRE_OPERATIONAL"] },
};
