import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Unique, Named } from "../core/meta";
import { BasicEvent, ParameterDistribution, type UncertainFrequency } from "../core/events";
import type { BaseLaw, CcfFactorModel, Law, TruncatedLaw, UncertainExpression } from "../core/uncertainty";
import { SuccessCriteriaId, SensitivityStudy } from "../core/shared-patterns";
import { BaseAssumption, PreOperationalAssumption } from "../core/documentation";
import { ComponentReference, ComponentTypeReference } from "../core/component";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type PlantOperatingStateReference = string;
export type SystemReference = string;
export type EventSequenceReference = string;
export type CcfGroupReference = string;

export type ParameterType =
  | "FREQUENCY"
  | "FAILURE_RATE"
  | "PROBABILITY"
  | "UNAVAILABILITY"
  | "CCF_PARAMETER"
  | "HUMAN_ERROR_PROBABILITY"
  | "OTHER";

export type DetectabilityLevel = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface ProbabilityModel {
  distribution: ParameterDistribution;
  source?: "ESTIMATED" | "MANUAL" | "DEFAULT";
  estimationDetails?: {
    dataPointReferences: string[];
    estimationMethod: string;
    estimationDate: string;
    sampleSize?: number;
    goodnessOfFit?: {
      method: string;
      value: number;
    };
    confidenceIntervals?: {
      lower: Record<string, number>;
      upper: Record<string, number>;
    };
  };
}

export interface FailureModeType extends Unique, Named {
  category: string;
  mechanismOfFailure: string;
  detectability: DetectabilityLevel;
  defaultProbabilityModel?: ProbabilityModel;
}

export interface ComponentBasicEvent extends BasicEvent {
  componentTypeReference: ComponentTypeReference;
  failureMode: string;
  probabilityModel: ProbabilityModel;
  isTemplate: boolean;
  implementsSrs: SRReference[];
}

export interface ComponentBasicEventInstance extends Unique {
  componentReference: ComponentReference;
  templateReference: string;
  probabilityAdjustments?: Record<string, number>;
  implementsSrs: SRReference[];
}

export interface OperationalDataPoint extends Unique {
  componentReference: ComponentReference;
  componentTypeReference: ComponentTypeReference;
  timestamp: string;
  eventType: "FAILURE" | "REPAIR" | "INSPECTION" | "MAINTENANCE";
  operatingHours: number;
  operatingCycles: number;
  failureModeRef?: string;
  repetitiveProblemGroupId?: string;
  measurements?: Record<string, number>;
  description?: string;
}

export interface OperationalDataRegistry extends Unique, Named {
  dataPoints: OperationalDataPoint[];
}

export interface DataSource {
  source: string;
  context?: string;
  notes?: string;
  documentationReferences?: string[];
  sourceType?: "GENERIC_INDUSTRY" | "PLANT_SPECIFIC" | "EXPERT_JUDGMENT" | "OTHER_FACILITY_EXPERIENCE";
  timePeriod?: {
    startDate: string;
    endDate: string;
  };
  applicabilityAssessment?: string;
}

export interface Uncertainty {
  distribution: ParameterDistribution;
  modelUncertaintySources?: string[];
  riskImplications?: {
    affectedMetrics: string[];
    significanceLevel: "HIGH" | "MEDIUM" | "LOW";
    propagationNotes?: string;
  };
  correlations?: {
    parameterId: string;
    correlationType: "COMMON_CAUSE" | "ENVIRONMENTAL" | "OPERATIONAL" | "OTHER";
    correlationFactor: number;
    description?: string;
  }[];
  sensitivityStudies?: SensitivityStudy[];
}

export type DaQuantificationModel =
  | "DEMAND_PROBABILITY"
  | "RUNNING_RATE"
  | "MISSION_PROBABILITY"
  | "STANDBY_RATE"
  | "UNAVAILABILITY"
  | "HUMAN_ERROR"
  | "NON_RECOVERY"
  | "FREQUENCY"
  | "OTHER_PROBABILITY";

export const DA_COMPONENT_MODELS: readonly DaQuantificationModel[] = [
  "DEMAND_PROBABILITY",
  "RUNNING_RATE",
  "MISSION_PROBABILITY",
  "STANDBY_RATE",
  "OTHER_PROBABILITY",
  "UNAVAILABILITY",
];

export function isComponentModel(model: DaQuantificationModel | undefined): boolean {
  return model !== undefined && DA_COMPONENT_MODELS.includes(model);
}

export const DA_ESTIMATE_MODELS: readonly DaQuantificationModel[] = [...DA_COMPONENT_MODELS, "FREQUENCY"];

export function holdsEstimate(model: DaQuantificationModel | undefined): boolean {
  return model !== undefined && DA_ESTIMATE_MODELS.includes(model);
}

export interface DaParameterValueLink {
  element: "SY" | "IE" | "HRA" | "POS";
  needId: string;
}

export type DaEvidenceKind =
  | "PLANT_RECORDS"
  | "TECHNOLOGY"
  | "GENERIC_NUCLEAR"
  | "ANALOGOUS_INDUSTRY"
  | "ENGINEERING_MODEL"
  | "EXPERT_JUDGMENT";

export type DaSourceOrigin = "SAME_TECHNOLOGY" | "OTHER_NUCLEAR" | "NONNUCLEAR";

export type DaEstimateQuantity = "PER_DEMAND" | "PER_HOUR" | "PER_YEAR" | "FRACTION" | "PROBABILITY" | "HOURS" | "FACTOR";

export const DA_LAW_QUANTITIES: readonly DaEstimateQuantity[] = ["PER_DEMAND", "PER_HOUR", "PER_YEAR", "PROBABILITY", "FRACTION", "FACTOR"];

export function entryHoldsLaw(quantity: DaEstimateQuantity): boolean {
  return DA_LAW_QUANTITIES.includes(quantity);
}

export interface DaSourceEntry {
  id: string;
  component: string;
  failureMode: string;
  quantity: DaEstimateQuantity;
  table?: string;
  law?: Law;
  distribution?: ParameterDistribution;
  mean?: number;
  p05?: number;
  median?: number;
  p95?: number;
  p025?: number;
  p975?: number;
  failures?: number;
  exposure?: number;
  population?: number;
  yearsFrom?: string;
  yearsTo?: string;
  method?: string;
  boundaryNote?: string;
  catalogCode?: string;
}

export interface DaSource {
  id: string;
  name: string;
  catalogId?: string;
  kind: DaEvidenceKind;
  origin: DaSourceOrigin;
  covers: string;
  yearsFrom?: string;
  yearsTo?: string;
  boundaryConvention: string;
  failureCounting: string;
  quality: string;
  reference: string;
  entries: DaSourceEntry[];
}

export interface DaTransferFactor {
  id: string;
  name: string;
  nominal: number;
  low: number;
  high: number;
  basis: string;
}

export type DaSourceVerdict = "APPLIES" | "SCALED" | "REJECTED";

export type DaBoundaryMatch = "SAME" | "ADJUSTED" | "DIFFERENT";

export interface DaSourceUse {
  id: string;
  sourceId?: string;
  entryId?: string;
  elicitationId?: string;
  verdict: DaSourceVerdict;
  boundary: DaBoundaryMatch;
  reason: string;
  hoursPerYear?: number;
  standbyHours?: number;
  factors?: DaTransferFactor[];
}

export type DaPriorForm = "AS_PUBLISHED" | "CONSTRAINED_NONINFORMATIVE" | "JEFFREYS";

export type DaEstimateMethod = "PRIOR" | "BAYES" | "POPULATION";

export type DaEvidenceOrigin = "PLANT_RECORDS" | "TECHNOLOGY";

export type DaEvidenceUnit = "DEMANDS" | "HOURS" | "YEARS";

export interface DaEvidence {
  id: string;
  origin: DaEvidenceOrigin;
  label?: string;
  failuresFrom: "TYPED" | "ENTRY" | "RECORDS";
  exposureFrom: "TYPED" | "ENTRY" | "DEMANDS_AND_HOURS";
  sourceId?: string;
  entryId?: string;
  recordSetId?: string;
  failures?: number;
  exposure?: number;
  unit?: DaEvidenceUnit;
  hoursPerDemand?: number;
  hoursPerYear?: number;
  yearsFrom?: string;
  yearsTo?: string;
  boundary: DaBoundaryMatch;
  reason: string;
  included: boolean;
  exclusionReason?: string;
}

export type DaRecordJudgment = "OPEN" | "FAILURE" | "NOT_FAILURE" | "REPEAT" | "EXCLUDED";

export interface DaFailureRecord {
  id: string;
  date?: string;
  unit?: string;
  description: string;
  reference?: string;
  judgment: DaRecordJudgment;
  parameterId?: string;
  repeatOf?: string;
  reason?: string;
}

export interface DaRecordSet {
  id: string;
  name: string;
  origin: DaEvidenceOrigin;
  sourceId?: string;
  yearsFrom?: string;
  yearsTo?: string;
  reference: string;
  records: DaFailureRecord[];
}

export type DaDemandKind = "SURVEILLANCE" | "MAINTENANCE" | "OTHER_COMPONENT" | "OPERATIONAL";

export type DaCountBasis = "RECORDS" | "ANNUALIZED_PLAN" | "PLANNED_SCHEDULE";

export interface DaDemandCount {
  id: string;
  groupId: string;
  kind: DaDemandKind;
  activity: string;
  count: number;
  failureModeIds: string[];
  basis: DaCountBasis;
  reference?: string;
}

export interface DaHourCount {
  id: string;
  groupId: string;
  runHours?: number;
  standbyHours?: number;
  basis: DaCountBasis;
  reference?: string;
}

export type DaMaintenanceKind = "TRAIN" | "COINCIDENT";

export type DaMaintenanceMethod = "PLANNED" | "RECORDS" | "GENERIC";

export interface DaMaintenanceActivity {
  id: string;
  activity: string;
  perYear: number;
  hoursEach: number;
  hoursLow?: number;
  hoursHigh?: number;
  disablesFunction: boolean;
  chargedTo?: SystemReference;
  reason?: string;
  reference?: string;
}

export interface DaOutOfServiceRecord {
  id: string;
  date?: string;
  activity: string;
  hours: number;
  disablesFunction: boolean;
  chargedTo?: SystemReference;
  reference?: string;
}

export interface DaMaintenanceBasis {
  kind: DaMaintenanceKind;
  method: DaMaintenanceMethod;
  requiredHoursPerYear?: number;
  requiredReason?: string;
  trains?: number;
  trainsReason?: string;
  activities?: DaMaintenanceActivity[];
  records?: DaOutOfServiceRecord[];
  overlapIds?: string[];
  equipment?: string[];
  scope?: "INTRASYSTEM" | "INTERSYSTEM";
  basis?: string;
}

export type DaRestorationKind = "REPAIR" | "RECOVERY";

export type DaRestorationFrom = "SOURCES" | "RECORDS";

export interface DaRestorationTime {
  id: string;
  hours: number;
  date?: string;
  reference?: string;
}

export interface DaRestorationPart {
  useId: string;
  weight?: number;
  weightSourceId?: string;
  weightEntryId?: string;
  sampleSize?: number;
}

export interface DaRestorationBasis {
  kind: DaRestorationKind;
  subject: string;
  from: DaRestorationFrom;
  parts?: DaRestorationPart[];
  comparison?: DaRestorationPart[];
  times?: DaRestorationTime[];
  windowHours?: number;
  windowReason?: string;
  sequence?: string;
  basis?: string;
}

export interface DaOutage {
  id: string;
  evolution: string;
  outageType: string;
  stateId?: string;
  start?: string;
  hours: number;
  perYear: number;
  configurations?: string[];
  basis: DaCountBasis;
  reference?: string;
  valueFrom?: "TYPED" | "POS";
}

export type DaExpertRole = "EVALUATOR" | "PROPONENT" | "RESOURCE";

export interface DaElicitationExpert {
  id: string;
  name: string;
  role: DaExpertRole;
  outside: boolean;
  expertise: string;
  p05?: number;
  median?: number;
  p95?: number;
  weight?: number;
  acceptsResponsibility: boolean;
}

export type DaJudgmentLevel = "LOW" | "MEDIUM" | "HIGH";

export interface DaElicitation {
  id: string;
  issue: string;
  objective: string;
  quantity: DaEstimateQuantity;
  importance: DaJudgmentLevel;
  complexity: DaJudgmentLevel;
  structure: "SINGLE_EVALUATOR" | "PANEL";
  outsideReason?: string;
  experts: DaElicitationExpert[];
  pooling: "LINEAR" | "LOGARITHMIC";
  integrator: string;
  responsibility: "INTEGRATOR" | "SHARED";
  completed?: string;
  reference?: string;
}

export type DaInitiatorCategory = "I" | "II" | "III" | "IV";

export type DaFrequencyPer = "CRITICAL_YEAR" | "CALENDAR_YEAR" | "SHUTDOWN_YEAR";

export type DaFrequencyMethod = "PRIOR" | "BAYES";

export interface DaFrequencyPart {
  id: string;
  label: string;
  memberIds?: string[];
  per: DaFrequencyPer;
  stateIds?: string[];
  useId?: string;
  priorForm?: DaPriorForm;
  method?: DaFrequencyMethod;
  evidence?: DaEvidence[];
  reason?: string;
}

export interface DaFrequencyComparison {
  id: string;
  useId: string;
  per: DaFrequencyPer;
  reason?: string;
}

export interface DaFrequencyBasis {
  category?: DaInitiatorCategory;
  categoryReason?: string;
  siteWide?: boolean;
  siteWideReason?: string;
  parts: DaFrequencyPart[];
  comparisons?: DaFrequencyComparison[];
  basis?: string;
}

export interface DaImportance {
  from: "TYPED" | "ESQ";
  fussellVesely?: number;
  riskAchievementWorth?: number;
  entryIds?: string[];
  importedAt?: string;
}

export interface DaPopulationHyperprior {
  mu: BaseLaw | TruncatedLaw;
  sigma: BaseLaw | TruncatedLaw;
}

export interface DataAnalysisParameter extends Unique, Named {
  description?: string;
  parameterType: ParameterType;
  value?: number;
  valueType?: "POINT_ESTIMATE" | "MEAN";
  estimate?: UncertainExpression;
  quantificationModel?: DaQuantificationModel;
  missionTime?: UncertainExpression;
  valueMode?: "TYPED" | "LINKED" | "CALCULATED";
  valueLink?: DaParameterValueLink;
  stateIds?: string[];
  sourceUses?: DaSourceUse[];
  priorUseId?: string;
  evidenceKind?: DaEvidenceKind;
  evidenceReason?: string;
  priorForm?: DaPriorForm;
  priorFormReason?: string;
  estimateMethod?: DaEstimateMethod;
  estimateReason?: string;
  populationTargetId?: string;
  populationHyperprior?: DaPopulationHyperprior;
  evidence?: DaEvidence[];
  maintenance?: DaMaintenanceBasis;
  restoration?: DaRestorationBasis;
  frequency?: DaFrequencyBasis;
  isRiskSignificant?: boolean;
  importance?: DaImportance;
  basicEventRef?: string;
  componentGroupRef?: string;
  systemReference?: SystemReference;
  failureModeRef?: string;
  successCriteriaIds?: SuccessCriteriaId[];
  plantOperatingStateRef?: PlantOperatingStateReference;
  multiPosApplicabilityJustification?: string;
  componentBoundaryRef?: string;
  basicEventBoundaryRef?: string;
  modelSelectionBasis?: string;
  requiredData?: string;
  uncertainty?: Uncertainty;
  uncertaintyNote?: string;
  dataSources?: DataSource[];
  assumptions?: BaseAssumption[];
  sensitivityStudies?: SensitivityStudy[];
  implementsSrs: SRReference[];
}

export interface ComponentBoundary extends Unique, Named {
  systemId: SystemReference;
  componentId?: ComponentReference;
  description: string;
  boundaries: string[];
  includedItems: string[];
  excludedItems?: string[];
  boundaryBasis: string;
  referenceDocuments?: string[];
  implementsSrs: SRReference[];
}

export interface BasicEventBoundary extends Unique, Named {
  basicEventId: string;
  description: string;
  includedConditions: string[];
  excludedConditions?: string[];
  boundaryBasis: string;
  referenceDocuments?: string[];
  systemReference?: SystemReference;
  implementsSrs: SRReference[];
}

export interface ComponentGrouping extends Unique, Named {
  systemId: SystemReference;
  groupId: string;
  componentIds: ComponentReference[];
  groupingBasis: "TYPE_ONLY" | "TYPE_AND_SERVICE_CONDITIONS";
  designCharacteristics: string[];
  environmentalConditions: string[];
  serviceConditions: string[];
  operationalConditions?: string[];
  groupingJustification: string;
  referenceDocuments?: string[];
  excludedOutliers?: string[];
  outlierIdentificationCriteria?: string[];
  implementsSrs: SRReference[];
}

export interface OutlierComponent extends Unique {
  systemId: SystemReference;
  componentId: ComponentReference;
  potentialGroupId: string;
  exclusionReason: string;
  exclusionJustification: string;
  differentiatingCharacteristics: string[];
  alternativeHandling: string;
  referenceDocuments?: string[];
  status: "CONFIRMED" | "TENTATIVE" | "UNDER_REVIEW";
  determinationDate?: string;
  determinedBy?: string;
  implementsSrs: SRReference[];
}

export interface ExternalDataSource extends Unique, Named {
  sourceType: "INDUSTRY_DATABASE" | "PLANT_RECORDS" | "EXPERT_JUDGMENT" | "OTHER_FACILITY_EXPERIENCE" | "OTHER";
  sourceLocation: string;
  timePeriod: {
    start: string;
    end: string;
  };
  accessMethod: string;
  dataFormat: string;
  qualityAssurance?: string;
  limitations?: string[];
  referenceDocumentation: string[];
  validationMethod?: string;
  implementsSrs: SRReference[];
}

export interface DataConsistencyCheck extends Unique {
  parameterId: string;
  dataSourceId: string;
  verificationMethod: string;
  consistencyAssessment: "CONSISTENT" | "INCONSISTENT" | "PARTIALLY_CONSISTENT";
  discrepancies?: string[];
  resolutionActions?: string[];
  verificationDate: string;
  verifierId: string;
  implementsSrs: SRReference[];
}

export interface FailureEventClassification extends Unique {
  componentGroupRef?: string;
  failureModeRef?: string;
  failureDefinitionBasis: string;
  degradedStatesCountedAsFailures: string[];
  degradedStatesNotCounted: string[];
  repeatedFailureCountingApplied: boolean;
  basisDocuments?: string[];
  implementsSrs: SRReference[];
}

export type DaCcfTesting = "STAGGERED" | "NON_STAGGERED";

export type DaCcfMethod = "PRIOR" | "BAYES" | "TYPED";

export interface DaCcfEvent {
  id: string;
  recordId?: string;
  description?: string;
  date?: string;
  impact: number[];
  included: boolean;
  reason: string;
}

export interface DaCcfEvidence {
  id: string;
  label?: string;
  origin: DaEvidenceOrigin;
  recordSetId?: string;
  population: number;
  independentFailures: number;
  events: DaCcfEvent[];
  boundary: DaBoundaryMatch;
  reason: string;
  included: boolean;
  exclusionReason?: string;
}

export interface CcfParameterEstimation extends Unique {
  ccfGroupReference: CcfGroupReference;
  name?: string;
  groupSize?: number;
  memberParameterId?: string;
  testing?: DaCcfTesting;
  testingReason?: string;
  method?: DaCcfMethod;
  priorSourceId?: string;
  priorTemplate?: string;
  priorReason?: string;
  evidence?: DaCcfEvidence[];
  estimateReason?: string;
  factors?: CcfFactorModel;
  isRiskSignificant?: boolean;
  importance?: DaImportance;
  parameterSource: "GENERIC" | "PLANT_EXPERIENCE_CONSISTENT";
  componentBoundaryConsistencyBasis: string;
  genericExclusionConsistencyConfirmed?: boolean;
  genericExclusionConsistencyBasis?: string;
  dataSources?: DataSource[];
  implementsSrs: SRReference[];
}

export interface DataModificationAdjustment extends Unique {
  modificationDescription: string;
  effectiveDate?: string;
  affectedParameterIds: string[];
  pastDataDisposition: "ADJUSTED" | "DISCARDED" | "RETAINED_WITH_JUSTIFICATION";
  basis: string;
  implementsSrs: SRReference[];
}

export interface DaDocumentation {
  processDescription: string;
  systemComponentBoundaries: string;
  basicEventProbabilityModels: string;
  genericParameterSources: string;
  plantSpecificDataSourcesAndPeriods: string;
  dataExclusionJustifications: string;
  demandAndExposureCounting: string;
  unavailabilityTreatment: string;
  repairAndRecoveryData: string;
  lpsdOutageData: string;
  componentGroupingAndOutliers: string;
  ccfParameterBasis: string;
  bayesianPriorRationales: string;
  parameterEstimatesWithUncertainty: string;
  multiPosGenericUse: string;
  modelUncertaintySources: string;
  asBuiltLimitations: string;
  praTaskInterfaces: string;
  implementsSrs: SRReference[];
}

export type DaLinkCode = "SY" | "IE" | "HRA" | "POS" | "SC" | "ESQ";

export interface DaLinkedWorkbooks {
  SY?: string;
  IE?: string;
  HRA?: string;
  POS?: string;
  SC?: string;
  ESQ?: string;
}

export type DaScopeKind =
  | "TEST_MAINTENANCE"
  | "REPAIR_RECOVERY"
  | "COMMON_CAUSE"
  | "INITIATING_EVENT"
  | "HUMAN_ERROR"
  | "OUTAGE";

export interface DaScopeDecision {
  kind: DaScopeKind;
  included: boolean;
  exclusionReason?: string;
}

export interface DaFieldLink {
  element: DaLinkCode;
  workbookId: string;
  field: string;
}

export interface DaLinkedNumber {
  value: number;
  link?: DaFieldLink;
}

export interface DaDataPlan {
  freezeDate?: string;
  dataWindowStart?: string;
  dataWindowEnd?: string;
  modulesPerPlant?: DaLinkedNumber;
}

export type DaNeedKind =
  | "DEMAND"
  | "RUNNING"
  | "STANDBY"
  | "UNAVAILABILITY"
  | "HUMAN_ERROR"
  | "RECOVERY"
  | "COMMON_CAUSE"
  | "OTHER";

export type DaNeedElement = "SY" | "IE" | "HRA" | "POS";

export type DaValueHolder = "TYPED" | "DA" | "HRA";

export interface DaManualEntry {
  source: string;
}

export interface DaNeedSource {
  element: DaNeedElement;
  workbookId: string;
  workbookName: string;
  updatedAt?: string;
}

export interface DaNeedChange {
  element: DaNeedElement;
  id: string;
  change: "ADDED" | "REMOVED" | "CHANGED";
  label?: string;
}

export interface DaBasicEventNeed {
  id: string;
  code: string;
  name: string;
  systemId?: string;
  systemName?: string;
  failureMode?: string;
  importedKind?: DaNeedKind;
  kind?: DaNeedKind;
  importedMissionTime?: UncertainExpression;
  missionTime?: UncertainExpression;
  testIntervalHours?: number;
  value?: number;
  valueUnit?: "PROBABILITY" | "PER_HOUR";
  expression?: UncertainExpression;
  valueHeldBy?: DaValueHolder;
  valueHolderId?: string;
  repairCredited?: boolean;
  meanTimeToRepairHours?: number;
  changeReason?: string;
  parameterId?: string;
  included: boolean;
  exclusionReason?: string;
  manual?: DaManualEntry;
}

export interface DaInitiatorNeed {
  id: string;
  name: string;
  stateIds: string[];
  memberIds: string[];
  frequency?: UncertainFrequency;
  frequencyBasis?: string;
  valueHeldBy?: DaValueHolder;
  valueHolderId?: string;
  parameterId?: string;
  included: boolean;
  exclusionReason?: string;
  manual?: DaManualEntry;
}

export interface DaHumanErrorNeed {
  id: string;
  hfeId: string;
  name: string;
  timing?: "PRE_INITIATOR" | "AT_INITIATOR" | "POST_INITIATOR";
  kind: "HUMAN_ERROR" | "RECOVERY";
  value?: number;
  valueKind?: "MEAN" | "POINT_ESTIMATE";
  method?: string;
  stateIds: string[];
  valueHeldBy?: DaValueHolder;
  valueHolderId?: string;
  parameterId?: string;
  included: boolean;
  exclusionReason?: string;
  manual?: DaManualEntry;
}

export interface DaCcfGroupNeed {
  id: string;
  name: string;
  systemIds: string[];
  memberIds: string[];
  factors?: CcfFactorModel;
  total?: UncertainExpression;
  estimateRef?: string;
  included: boolean;
  exclusionReason?: string;
  manual?: DaManualEntry;
}

export interface DaStateNeed {
  id: string;
  name: string;
  mode?: string;
  durationHours?: number;
  entriesPerYear?: number;
  valueHeldBy?: DaValueHolder;
  included: boolean;
  exclusionReason?: string;
  manual?: DaManualEntry;
}

export interface DaDataNeeds {
  importedAt?: string;
  sources: DaNeedSource[];
  changes?: DaNeedChange[];
  basicEvents: DaBasicEventNeed[];
  initiators: DaInitiatorNeed[];
  humanErrors: DaHumanErrorNeed[];
  ccfGroups: DaCcfGroupNeed[];
  states: DaStateNeed[];
}

export interface DaUncertaintyAlternative {
  id: string;
  alternative: string;
  reasonNotSelected: string;
}

export interface DaUncertaintySource {
  id: string;
  source: string;
  impact: string;
  parameterIds: string[];
  estimateIds?: string[];
  assumption?: string;
  assumptionBasis?: string;
  alternatives: DaUncertaintyAlternative[];
  key: boolean;
  keyReason?: string;
  sensitivityIds?: string[];
  assumptionIds?: string[];
}

export type DaSensitivityKind = "FACTOR" | "PRIOR_FORM" | "SOURCE" | "TESTING" | "RANGE";

export interface DaSensitivityCase {
  id: string;
  name: string;
  kind: DaSensitivityKind;
  parameterId?: string;
  estimateId?: string;
  useId?: string;
  priorForm?: DaPriorForm;
  testing?: DaCcfTesting;
  low?: number;
  high?: number;
  reason: string;
  results?: string;
}

export interface DataAnalysis extends TechnicalElement<TechnicalElementTypes.DATA_ANALYSIS> {
  praScope: string;
  linkedWorkbooks?: DaLinkedWorkbooks;
  scopeDecisions?: DaScopeDecision[];
  dataPlan?: DaDataPlan;
  dataNeeds?: DaDataNeeds;
  sources?: DaSource[];
  elicitations?: DaElicitation[];

  parameters: DataAnalysisParameter[];
  componentBasicEvents?: ComponentBasicEvent[];
  componentBasicEventInstances?: ComponentBasicEventInstance[];
  failureModes?: FailureModeType[];

  componentBoundaries: ComponentBoundary[];
  basicEventBoundaries?: BasicEventBoundary[];
  componentGroupings?: ComponentGrouping[];
  outlierComponents?: OutlierComponent[];

  operationalDataRegistries?: OperationalDataRegistry[];
  externalDataSources?: ExternalDataSource[];
  dataConsistencyChecks?: DataConsistencyCheck[];

  failureEventClassifications?: FailureEventClassification[];
  recordSets?: DaRecordSet[];
  demandCounts?: DaDemandCount[];
  hourCounts?: DaHourCount[];
  outages?: DaOutage[];

  ccfParameterEstimations?: CcfParameterEstimation[];
  dataModificationAdjustments?: DataModificationAdjustment[];

  uncertaintyRegister?: DaUncertaintySource[];
  preOperationalAssumptions?: PreOperationalAssumption[];
  sensitivityCases?: DaSensitivityCase[];

  documentation: DaDocumentation;

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

export const DA_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  "DA-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-A4": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-A5": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-A6": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "DA-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-C2": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "DA-C3": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C4": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C5": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C6": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C7": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C8": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C9": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "DA-C10": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C11": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C12": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C13": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C14": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "DA-C15": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-C16": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C17": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "DA-C18": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C19": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "DA-C20": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-C21": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "DA-C22": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C23": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "DA-C24": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C25": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-C26": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-D1": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-D2": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-D3": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-D4": { hlr: "D", stages: ["OPERATIONAL"] },
  "DA-D5": { hlr: "D", stages: ["PRE_OPERATIONAL"] },
  "DA-D6": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-D7": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-D8": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-D9": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-D10": { hlr: "D", stages: ["OPERATIONAL"] },
  "DA-E1": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-E2": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-E3": { hlr: "E", stages: ["PRE_OPERATIONAL"] },
};
