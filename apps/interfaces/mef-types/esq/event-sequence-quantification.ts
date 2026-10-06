import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Unique, Named } from "../core/meta";
import {
  BetaDistribution,
  ExponentialDistribution,
  Frequency,
  FrequencyWithDistribution,
  GammaDistribution,
  LognormalDistribution,
  NormalDistribution,
  ParameterDistribution,
  PointEstimateDistribution,
  UniformDistribution,
  WeibullDistribution,
} from "../core/events";
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

export type EsqLinkCode = "ES" | "SY" | "DA" | "HRA" | "IE" | "POS" | "SC" | "RI" | "HS";

export interface EsqLinkedWorkbooks {
  ES?: string;
  SY?: string;
  DA?: string;
  HRA?: string;
  IE?: string;
  POS?: string;
  SC?: string;
  RI?: string;
  HS?: string;
}

export type EsqScopeAspect = "HAZARD_GROUP" | "OPERATING_STATE" | "SOURCE" | "INITIATOR_GROUP";

export interface EsqScopeExclusion {
  aspect: EsqScopeAspect;
  item: string;
  reason: string;
}

export type EsqFrequencyBasis = "PER_PLANT_YEAR" | "PER_REACTOR_YEAR";

export type EsqStateWeighting = "POS_HOURS" | "TYPED_SHARES";

export type EsqModuleCounting = "EACH_MODULE" | "ONCE_PER_PLANT";

export interface EsqPlanChoice<T> {
  value: T;
  reason?: string;
}

export interface EsqModuleCountLink {
  element: "IE";
  workbookId: string;
  field: "numberOfModules";
}

export interface EsqModuleCount {
  value: number;
  link?: EsqModuleCountLink;
}

export interface EsqQuantificationPlan {
  frequencyBasis?: EsqPlanChoice<EsqFrequencyBasis>;
  stateWeighting?: EsqPlanChoice<EsqStateWeighting>;
  modulesPerPlant?: EsqModuleCount;
  moduleCounting?: EsqPlanChoice<EsqModuleCounting>;
  reportingFloorPerYear?: EsqPlanChoice<number>;
  convergenceStepPercent?: EsqPlanChoice<number>;
}

export const ESQ_PLAN_DEFAULTS: {
  frequencyBasis: EsqFrequencyBasis;
  stateWeighting: EsqStateWeighting;
  moduleCounting: EsqModuleCounting;
  reportingFloorPerYear: number;
  convergenceStepPercent: number;
} = {
  frequencyBasis: "PER_PLANT_YEAR",
  stateWeighting: "POS_HOURS",
  moduleCounting: "EACH_MODULE",
  reportingFloorPerYear: 1e-7,
  convergenceStepPercent: 5,
};

export type EsqModelElement = "ES" | "SY" | "DA" | "HRA" | "IE" | "POS" | "SC";

export interface EsqModelSource {
  element: EsqModelElement;
  workbookId: string;
  workbookName: string;
  updatedAt?: string;
}

export type EsqModelTable =
  | "TREE"
  | "SEQUENCE"
  | "FAMILY"
  | "FUNCTION"
  | "TOP"
  | "INITIATOR"
  | "STATE"
  | "EVENT"
  | "CCF"
  | "PARAMETER"
  | "HUMAN"
  | "BARRIER"
  | "CRITERION"
  | "IMPACT"
  | "QUALIFICATION"
  | "ACTION"
  | "RECOVERY"
  | "DEPENDENCY";

export interface EsqModelChange {
  table: EsqModelTable;
  id: string;
  change: "ADDED" | "REMOVED" | "CHANGED";
  label?: string;
}

export type EsqBranchState = "SUCCESS" | "FAILURE" | "BYPASSED";

export interface EsqTopReference {
  workbookId: string;
  modelId: string;
  gateId: string;
}

export interface EsqTreeRecord {
  id: string;
  code: string;
  name: string;
  initiatorId: string;
  stateId?: string;
  functionIds: string[];
  missionTimeHours?: number;
  transferEntry: boolean;
}

export interface EsqSequenceRecord {
  id: string;
  code: string;
  treeId: string;
  path: Record<string, EsqBranchState>;
  endState?: string;
  familyId?: string;
  releaseCategoryId?: string;
  sourceIds?: string[];
  transferTreeId?: string;
  transferCarries?: string[];
}

export interface EsqFamilyRecord {
  id: string;
  name: string;
  endState?: string;
  releaseCategoryIds: string[];
}

export interface EsqFunctionEsLink {
  treeId: string;
  top: EsqTopReference;
}

export interface EsqFunctionRecord {
  id: string;
  name: string;
  treeIds: string[];
  esLinks: EsqFunctionEsLink[];
}

export interface EsqTopNode {
  id: string;
  code: string;
  name: string;
}

export interface EsqTopHouseEvent extends EsqTopNode {
  state: boolean;
}

export interface EsqTopRecord {
  modelId: string;
  gateId: string;
  code: string;
  name: string;
  systemId?: string;
  systemName?: string;
  eventIds: string[];
  transferModelIds: string[];
  gates?: EsqTopNode[];
  houseEvents?: EsqTopHouseEvent[];
}

export interface EsqInitiatorRecord {
  id: string;
  name: string;
  stateIds: string[];
  meanFrequency?: number;
  medianFrequency?: number;
  errorFactor?: number;
  frequencyUnit?: string;
  heldBy?: "DA" | "TYPED";
  holderId?: string;
}

export interface EsqStateRecord {
  id: string;
  name: string;
  hours?: number;
}

export type EsqValueHolder = "DA" | "HRA" | "TYPED";

export interface EsqEventRecord {
  id: string;
  code: string;
  name: string;
  systemId?: string;
  systemName?: string;
  failureMode?: string;
  value?: number;
  valueUnit?: "PROBABILITY" | "PER_HOUR";
  missionTimeHours?: number;
  heldBy: EsqValueHolder;
  holderId?: string;
}

export interface EsqCcfRecord {
  id: string;
  name: string;
  systemIds: string[];
  memberIds: string[];
  modelType?: string;
  totalProbability?: number;
  estimateRef?: string;
}

export interface EsqParameterRecord {
  id: string;
  name: string;
  parameterType: string;
  value?: number;
  valueType: "POINT_ESTIMATE" | "MEAN";
  distributionType?: string;
  p05?: number;
  p95?: number;
  missionTimeHours?: number;
  evidenceKind?: string;
  distribution?: ParameterDistribution;
}

export type EsqHfeTiming = "PRE_INITIATOR" | "AT_INITIATOR" | "POST_INITIATOR";

export interface EsqHumanRecord {
  id: string;
  name: string;
  timing?: EsqHfeTiming;
  value?: number;
  valueType?: "MEAN" | "POINT_ESTIMATE";
  assessmentType?: "CONSERVATIVE_ESTIMATE" | "DETAILED_ASSESSMENT";
  riskSignificant: boolean;
  distributionGiven: boolean;
}

export interface EsqBarrierStateRecord {
  stateId: string;
  status: string;
}

export interface EsqBarrierRecord {
  id: string;
  name: string;
  sourceNames: string[];
  states: EsqBarrierStateRecord[];
  breachCriteria: string[];
  monitoring: string[];
}

export interface EsqCriterionParameter {
  parameter: string;
  criterion: string;
  basis: string;
}

export interface EsqCriterionLoad {
  sequenceId?: string;
  description: string;
  attributes: string[];
}

export interface EsqCriterionRecord {
  id: string;
  barrierRef: string;
  parameters: EsqCriterionParameter[];
  loads: EsqCriterionLoad[];
  capacityParameters: string[];
  method: "CONSERVATIVE" | "REALISTIC";
  uncertainty?: string;
  references: string[];
}

export interface EsqImpactRecord {
  initiatorId: string;
  initiatorName: string;
  groupId?: string;
  barrierRef: string;
  state: string;
  timing?: string;
  mechanism?: string;
}

export interface EsqQualificationRecord {
  id: string;
  kind: "ENVIRONMENT" | "CAPACITY";
  systemId: string;
  components: string[];
  condition: string;
  groupIds: string[];
  eventIds: string[];
  beyondQualification: boolean;
  treatment?: "CONSERVATIVE" | "REALISTIC_JUSTIFIED";
  justification?: string;
}

export interface EsqActionFeasibility {
  procedure: boolean;
  training: boolean;
  cues: boolean;
  crew: boolean;
  time: boolean;
  access: boolean;
  equipment: boolean;
}

export interface EsqActionRecord {
  id: string;
  name: string;
  timing: "AT_INITIATOR" | "POST_INITIATOR";
  hep?: number;
  assessmentType?: "CONSERVATIVE_ESTIMATE" | "DETAILED_ASSESSMENT";
  riskSignificant: boolean;
  cue?: string;
  cueMinutes?: number;
  availableMinutes?: number;
  requiredMinutes?: number;
  recoveryId?: string;
  recoveryName?: string;
  feasibility?: EsqActionFeasibility;
  feasibilityNote?: string;
}

export type EsqDependenceLevel = "ZERO" | "LOW" | "MODERATE" | "HIGH" | "COMPLETE";

export interface EsqRecoveryRecord {
  id: string;
  name: string;
  hfeId: string;
  restoredFunction?: string;
  level: "CUTSET" | "SCENARIO" | "SEQUENCE";
  sequenceIds: string[];
  hep?: number;
  dependencyId?: string;
  feasibility: EsqActionFeasibility;
  feasibilityNote?: string;
}

export interface EsqDependencyRecord {
  id: string;
  scope: "PRE_INITIATOR_SET" | "WITHIN_SEQUENCE";
  hfeIds: string[];
  level: EsqDependenceLevel;
  jointHep: number;
  stateId?: string;
  sequenceId?: string;
  includesRecovery: boolean;
  floorNote?: string;
}

export interface EsqJointFloorRecord {
  id: string;
  value: number;
  justification: string;
}

export interface EsqModel {
  importedAt?: string;
  sources: EsqModelSource[];
  changes?: EsqModelChange[];
  trees: EsqTreeRecord[];
  sequences: EsqSequenceRecord[];
  families: EsqFamilyRecord[];
  functions: EsqFunctionRecord[];
  tops: EsqTopRecord[];
  initiators: EsqInitiatorRecord[];
  states: EsqStateRecord[];
  events: EsqEventRecord[];
  ccfGroups: EsqCcfRecord[];
  parameters: EsqParameterRecord[];
  humanEvents: EsqHumanRecord[];
  barriers?: EsqBarrierRecord[];
  criteria?: EsqCriterionRecord[];
  impacts?: EsqImpactRecord[];
  qualifications?: EsqQualificationRecord[];
  actions?: EsqActionRecord[];
  recoveries?: EsqRecoveryRecord[];
  dependencies?: EsqDependencyRecord[];
  jointFloor?: EsqJointFloorRecord;
}

export interface EsqFaultTreeTarget {
  kind: "FAULT_TREE";
  top: EsqTopReference;
}

export interface EsqSplitFractionTarget {
  kind: "SPLIT_FRACTION";
  value?: number;
  errorFactor?: number;
  parameterId?: string;
  cellId?: string;
  basis?: string;
}

export type EsqFunctionTarget = EsqFaultTreeTarget | EsqSplitFractionTarget;

export interface EsqFunctionRule {
  id: string;
  groupIds: string[];
  stateIds: string[];
  target: EsqFunctionTarget;
  reason: string;
}

export interface EsqFunctionLink {
  functionId: string;
  target?: EsqFunctionTarget;
  rules?: EsqFunctionRule[];
  reason?: string;
}

export type EsqInitiatorSource = "IE" | "DA" | "TYPED";

export interface EsqStateShare {
  stateId: string;
  percent: number;
}

export interface EsqInitiatorChoice {
  groupId: string;
  source: EsqInitiatorSource;
  parameterId?: string;
  mean?: number;
  errorFactor?: number;
  basis?: string;
  shares?: EsqStateShare[];
}

export interface EsqFamilyChoice {
  familyId: string;
  name?: string;
  endState?: string;
  releaseCategoryId?: string;
  groupingReason?: string;
  manual?: { source: string };
}

export interface EsqSequenceChoice {
  sequenceId: string;
  familyId: string;
  reason: string;
}

export interface EsqValueBinding {
  eventId: string;
  heldBy: "DA" | "HRA";
  holderId: string;
  reason: string;
}

export interface EsqModelDecisions {
  functionLinks?: EsqFunctionLink[];
  initiatorChoices?: EsqInitiatorChoice[];
  familyChoices?: EsqFamilyChoice[];
  sequenceChoices?: EsqSequenceChoice[];
  valueBindings?: EsqValueBinding[];
}

export type EsqFlagTargetKind = "HOUSE" | "EVENT" | "GATE";

export interface EsqFlagTarget {
  kind: EsqFlagTargetKind;
  id: string;
  modelId?: string;
}

export interface EsqFlag {
  id: string;
  name: string;
  target?: EsqFlagTarget;
  state: boolean;
  groupIds: string[];
  stateIds: string[];
  basis: string;
}

export interface EsqLoopBreak {
  fromModelId: string;
  toModelId: string;
  state: boolean;
  basis: string;
}

export interface EsqExclusion {
  id: string;
  eventIds: string[];
  basis: string;
}

export interface EsqLogic {
  flags?: EsqFlag[];
  loopBreaks?: EsqLoopBreak[];
  exclusions?: EsqExclusion[];
}

export type EsqBarrierModeKind = "GROSS" | "LOCALIZED";

export interface EsqBarrierMode {
  id: string;
  name: string;
  kind: EsqBarrierModeKind;
  location: string;
}

export interface EsqBarrierEntry {
  barrierId: string;
  manual?: { name: string; source: string; sourceNames: string[] };
  criterionId?: string;
  impactRefs?: string[];
  modes: EsqBarrierMode[];
}

export type EsqMechanismKind = "PHENOMENON" | "DEGRADATION" | "HAZARD";

export interface EsqMechanismScreening {
  criterion: "SCR-2" | "SCR-3";
  basis: string;
}

export interface EsqMechanism {
  id: string;
  barrierId: string;
  modeIds: string[];
  kind: EsqMechanismKind;
  name: string;
  hazardGroup?: string;
  familyIds: string[];
  screening?: EsqMechanismScreening;
  equipment?: string[];
  dependency?: string;
  basis: string;
}

export interface EsqLogicCredit {
  credited: boolean;
  basis: string;
}

export interface EsqPhenomenaLogic {
  included: boolean;
  basis: string;
  scrubbing?: EsqLogicCredit;
  beneficial?: EsqLogicCredit;
}

export type EsqLaw =
  | LognormalDistribution
  | NormalDistribution
  | UniformDistribution
  | ExponentialDistribution
  | WeibullDistribution
  | GammaDistribution
  | BetaDistribution
  | PointEstimateDistribution;

export type EsqLawParameter =
  | "value"
  | "mean"
  | "stdDev"
  | "median"
  | "errorFactor"
  | "lower"
  | "upper"
  | "failureRate"
  | "scale"
  | "shape"
  | "location"
  | "rate"
  | "alpha"
  | "betaParam";

export interface EsqUncertainParameter {
  parameter: EsqLawParameter;
  distribution: EsqLaw;
  correlationKey?: string;
}

export interface EsqFragility {
  median: number;
  betaR: number;
  betaU: number;
}

export interface EsqCellSide {
  distribution?: EsqLaw;
  parameterId?: string;
  fragility?: EsqFragility;
  uncertain?: EsqUncertainParameter[];
  basis: string;
}

export type EsqCellUse = "SPLIT_FRACTION" | "END_STATE_ATTRIBUTE";

export type EsqCellSampling = "MONTE_CARLO" | "LATIN_HYPERCUBE";

export interface EsqCellRun {
  runId: string;
  revision: number;
  at: string;
  method: string;
  inputs: string;
  point: number;
  mean?: number;
  p05?: number;
  p50?: number;
  p95?: number;
  samples?: number;
  sampling?: EsqCellSampling;
}

export interface EsqCellTyped {
  value: number;
  errorFactor?: number;
  basis: string;
}

export interface EsqCellAssumption {
  calculation: string;
  closure: string;
}

export interface EsqCell {
  id: string;
  barrierId: string;
  modeId: string;
  familyId?: string;
  hazardGroup?: string;
  mechanismIds: string[];
  variable: string;
  unit: string;
  basis: "CONSERVATIVE" | "REALISTIC";
  load: EsqCellSide;
  capacity: EsqCellSide;
  aging?: string;
  use: EsqCellUse;
  assumption?: EsqCellAssumption;
  run?: EsqCellRun;
  typed?: EsqCellTyped;
  ofRecord?: "RUN" | "TYPED";
}

export type EsqCreditKind = "EQUIPMENT" | "ACTION";

export interface EsqCredit {
  id: string;
  kind: EsqCreditKind;
  qualificationId?: string;
  actionId?: string;
  name: string;
  familyIds: string[];
  environment: string;
  beyondQualification: boolean;
  credited: boolean;
  analysis: string;
  treatment?: "CONSERVATIVE" | "DETAILED";
  feasibility?: EsqActionFeasibility;
  basis: string;
}

export interface EsqBarrierWork {
  barriers?: EsqBarrierEntry[];
  mechanisms?: EsqMechanism[];
  phenomenaLogic?: EsqPhenomenaLogic;
  cells?: EsqCell[];
  credits?: EsqCredit[];
}

export type EsqSolveCalculation = "EXACT" | "CUT_SETS";

export type EsqCutOffBasis = "FREQUENCY" | "PROBABILITY";

export type EsqCutSetQuantifier = "MCUB" | "RARE_EVENT" | "EXACT";

export type EsqSolveLoopChoice = "AS_SET" | "TRUE" | "FALSE";

export interface EsqSolveLogic {
  flags: boolean;
  loopBreaks: EsqSolveLoopChoice;
  exclusions: boolean;
  expandCcf: boolean;
  recovery?: boolean;
  dependency?: boolean;
}

export interface EsqSolveSweepPoint {
  cutOff: number;
  count: number;
  annualFrequency: number;
}

export interface EsqSolveRun {
  runId: string;
  revision: number;
  at: string;
  inputs: string;
  calculation: EsqSolveCalculation;
  logic: EsqSolveLogic;
  basis?: EsqCutOffBasis;
  quantifier?: EsqCutSetQuantifier;
  cutOffs?: number[];
  limitOrder?: number;
  peakProbability?: number;
  peakInitiatorFrequency?: number;
}

export interface EsqFamilyStateValue {
  stateId: string;
  annualFrequency: number;
  sweep: EsqSolveSweepPoint[];
}

export interface EsqFamilyRunValue {
  annualFrequency: number;
  sequenceCount: number;
  cutSetCount?: number;
  sweep: EsqSolveSweepPoint[];
  states: EsqFamilyStateValue[];
}

export interface EsqFamilyTyped {
  annualFrequency: number;
  source: string;
}

export interface EsqFamilyImported {
  annualFrequency: number;
  element: "ES";
  workbookId: string;
  at: string;
}

export type EsqFamilyValueSource = "RUN" | "TYPED" | "IMPORTED";

export interface EsqFamilySolve {
  familyId: string;
  ofRecord?: EsqFamilyValueSource;
  run?: EsqFamilyRunValue;
  typed?: EsqFamilyTyped;
  imported?: EsqFamilyImported;
  reason?: string;
}

export interface EsqSolveWork {
  run?: EsqSolveRun;
  families: EsqFamilySolve[];
  rareEventReason?: string;
}

export interface EsqRecoveryRule {
  id: string;
  manual?: { name: string };
  eventIds?: string[];
  groupIds: string[];
  stateIds: string[];
  credited: boolean;
  feasibility?: EsqActionFeasibility;
  typed?: { value: number; errorFactor?: number; source: string };
  ofRecord?: "HRA" | "TYPED";
  basis: string;
}

export type EsqJointSource = "HRA" | "THERP" | "TYPED";

export interface EsqCombination {
  id: string;
  eventIds: string[];
  dependencyId?: string;
  level?: EsqDependenceLevel;
  typed?: { joint: number; source: string };
  ofRecord?: EsqJointSource;
  floorWaiver?: string;
  groupIds: string[];
  stateIds: string[];
  basis: string;
}

export interface EsqCombinationFinding {
  eventIds: string[];
  treeIds: string[];
  cutSetCount: number;
  nominalFrequency: number;
}

export interface EsqPostSearch {
  runId: string;
  revision: number;
  at: string;
  inputs: string;
  raisedHep: number;
  cutOff: number;
  findings: EsqCombinationFinding[];
}

export interface EsqDeletionFinding {
  exclusionId: string;
  treeIds: string[];
  cutSetCount: number;
  nominalFrequency: number;
}

export interface EsqPostDeletions {
  runId: string;
  revision: number;
  at: string;
  inputs: string;
  cutOff: number;
  findings: EsqDeletionFinding[];
}

export interface EsqPostComparison {
  runId: string;
  at: string;
  inputs: string;
  families: { familyId: string; annualFrequency: number }[];
}

export interface EsqPostWork {
  recoveries?: EsqRecoveryRule[];
  combinations?: EsqCombination[];
  floor?: { value: number; source: string };
  search?: EsqPostSearch;
  deletions?: EsqPostDeletions;
  comparison?: EsqPostComparison;
}

export type EsqImportanceKind = "EVENT" | "PARAMETER" | "HFE" | "CCF_GROUP" | "SYSTEM";

export interface EsqImportanceSignificant {
  id: string;
  kind: EsqImportanceKind;
  label: string;
  ref?: string;
  fussellVesely: number;
  riskAchievementWorth: number;
}

export interface EsqImportanceRecord {
  runId: string;
  revision: number;
  at: string;
  inputs: string;
  logic: EsqSolveLogic;
  base: number;
  significant: EsqImportanceSignificant[];
  silentEventIds: string[];
  thresholds?: { fussellVesely: number; riskAchievementWorth: number };
}

export interface EsqThresholds {
  fussellVesely: number;
  riskAchievementWorth: number;
  source: string;
}

export interface EsqCutSetReview {
  key: string;
  familyId: string;
  treeId: string;
  eventIds: string[];
  annualFrequency: number;
  significant: boolean;
  verdict?: "CORRECT" | "ISSUE";
  note: string;
}

export type EsqConsistencyTopic = "SYSTEMS" | "SUCCESS_CRITERIA" | "PROCEDURES" | "RULES";

export interface EsqConsistencyEntry {
  topic: EsqConsistencyTopic;
  consistent?: boolean;
  note: string;
}

export interface EsqComparedPlant {
  id: string;
  name: string;
  source: string;
  familyId?: string;
  value?: number;
  note: string;
}

export interface EsqPlantComparison {
  possible: boolean;
  reason: string;
  plants: EsqComparedPlant[];
}

export interface EsqScreenedBound {
  groupId: string;
  familyId?: string;
  frequency?: number;
  conditional?: number;
  basis: string;
}

export interface EsqCutSetList {
  runId: string;
  at: string;
  inputs: string;
  cutOff: number;
}

export interface EsqReviewWork {
  importance?: EsqImportanceRecord;
  thresholds?: EsqThresholds;
  cutSetList?: EsqCutSetList;
  cutSetReviews?: EsqCutSetReview[];
  consistency?: EsqConsistencyEntry[];
  comparison?: EsqPlantComparison;
  screened?: EsqScreenedBound[];
  confirmations?: { eventId: string; reason: string }[];
  reconciliations?: { targetId: string; note: string }[];
}

export interface EsqSpread {
  key: string;
  errorFactor: number;
  source: string;
}

export interface EsqUncertaintyStats {
  point: number;
  mean: number;
  standardDeviation: number;
  p05: number;
  p50: number;
  p95: number;
}

export interface EsqUncertaintyRecord {
  runId: string;
  revision: number;
  at: string;
  inputs: string;
  logic: EsqSolveLogic;
  trials: number;
  seed: number;
  method: "MONTE_CARLO" | "LATIN_HYPERCUBE";
  correlation: "SHARED" | "INDEPENDENT";
  families: (EsqUncertaintyStats & { familyId: string })[];
  total?: EsqUncertaintyStats;
}

export interface EsqUncertaintyWork {
  spreads?: EsqSpread[];
  run?: EsqUncertaintyRecord;
  independent?: EsqUncertaintyRecord;
}

export type EsqRegisterKind = "SOURCE" | "ASSUMPTION" | "ALTERNATIVE";

export interface EsqRegisterDecision {
  id: string;
  familyIds: string[];
  key?: boolean;
  caseIds: string[];
  reason: string;
}

export interface EsqManualRegisterEntry {
  id: string;
  kind: EsqRegisterKind;
  text: string;
  impact: string;
}

export type EsqCaseKind = "PARAMETER" | "CCF_TOTAL" | "HEP" | "EVENT" | "GROUP_FAILED" | "FLAG" | "LOGIC" | "HEP_95TH";

export interface EsqCaseLogic {
  flags?: boolean;
  loopBreaks?: EsqSolveLoopChoice;
  exclusions?: boolean;
  expandCcf?: boolean;
  recovery?: boolean;
  dependency?: boolean;
}

export interface EsqCaseRun {
  runId: string;
  at: string;
  inputs: string;
  families: { familyId: string; annualFrequency: number }[];
}

export interface EsqSensitivityCase {
  id: string;
  name: string;
  kind: EsqCaseKind;
  target?: string;
  value?: number;
  factor?: number;
  state?: boolean;
  logic?: EsqCaseLogic;
  basis: string;
  daCaseRef?: { workbookId: string; caseId: string };
  run?: EsqCaseRun;
}

export interface EsqPreOperationalDecision {
  id: string;
  status?: "OPEN" | "IN_PROGRESS" | "CLOSED";
  closure: string;
  caseIds: string[];
}

export interface EsqManualPreOperational {
  id: string;
  text: string;
  limitation: string;
}

export interface EsqSensitivityWork {
  decisions?: EsqRegisterDecision[];
  manual?: EsqManualRegisterEntry[];
  cases?: EsqSensitivityCase[];
  preOperational?: EsqPreOperationalDecision[];
  manualPreOperational?: EsqManualPreOperational[];
}

export type EsqResponseStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

export interface EsqHandoffResponse {
  id: string;
  kind: "FAMILY" | "CONTRIBUTOR" | "GENERAL";
  ref: string;
  response: string;
  status: EsqResponseStatus;
  sentTo?: string;
}

export interface EsqHandoffPublication {
  at: string;
  revision: number;
  inputs: string;
  families: number;
  measures: number;
}

export interface EsqHandoffWork {
  published?: EsqHandoffPublication;
  responses?: EsqHandoffResponse[];
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
  scopeExclusions?: EsqScopeExclusion[];
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
  sourceElementCode: "POS" | "IE" | "ES" | "SC" | "SY" | "HR" | "DA" | "HS" | "ESQ";
  uncertaintySource: string;
  relatedAssumptions: string[];
  evaluationType: "QUALITATIVE" | "QUANTITATIVE";
  evaluationScope: "INDIVIDUAL" | "COMBINATION";
  effectOnFamilyFrequencies: string;
  dataAnalysisSourceRef?: { workbookId: string; sourceId: string };
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
  linkedWorkbooks?: EsqLinkedWorkbooks;
  quantificationPlan?: EsqQuantificationPlan;
  model?: EsqModel;
  modelDecisions?: EsqModelDecisions;
  logic?: EsqLogic;
  barrierWork?: EsqBarrierWork;
  solve?: EsqSolveWork;
  postWork?: EsqPostWork;
  review?: EsqReviewWork;
  uncertaintyWork?: EsqUncertaintyWork;
  sensitivityWork?: EsqSensitivityWork;
  handoffWork?: EsqHandoffWork;

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
