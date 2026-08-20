import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { InitiatingEvent, Frequency, FrequencyWithDistribution } from "../core/events";
import { ImportanceLevel, SensitivityStudy, ScreeningStatus, SuccessCriteriaId } from "../core/shared-patterns";
import { ComponentReference } from "../core/component";
import { BaseModelUncertaintyDocumentation, PreOperationalAssumption, PlantRepresentationAccuracy } from "../core/documentation";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type ScreeningCriterion = "SCR-1" | "SCR-2" | "SCR-3" | "ALTERNATE";

export type SystemStatus = "YES" | "NO" | "STANDBY" | "OOS";

export enum OperatingMode {
  POWER = "POWER",
  STARTUP = "STARTUP",
  SHUTDOWN = "SHUTDOWN",
  REFUELING = "REFUELING",
  MAINTENANCE = "MAINTENANCE",
}

export enum EvolutionType {
  AT_POWER = "AT_POWER",
  CONTROLLED_SHUTDOWN = "CONTROLLED_SHUTDOWN",
  FORCED_OUTAGE = "FORCED_OUTAGE",
  REFUELING_OUTAGE = "REFUELING_OUTAGE",
  LOAD_FOLLOW = "LOAD_FOLLOW",
  MAINTENANCE_CONFIG = "MAINTENANCE_CONFIG",
}

export enum BarrierStatus {
  INTACT = "INTACT",
  BREACHED = "BREACHED",
  DEGRADED = "DEGRADED",
  BYPASSED = "BYPASSED",
  DEINERTED = "DEINERTED",
  DRAINED = "DRAINED",
  OPEN = "OPEN",
}

export enum SourceLocation {
  IN_CORE = "IN_CORE",
  EX_CORE = "EX_CORE",
}

export enum SafetyFunctionCategory {
  REACTIVITY_CONTROL = "REACTIVITY_CONTROL",
  COOLANT_CHEMISTRY_CONTROL = "COOLANT_CHEMISTRY_CONTROL",
  DECAY_HEAT_REMOVAL = "DECAY_HEAT_REMOVAL",
  RCS_INVENTORY_BARRIER_CONTROL = "RCS_INVENTORY_BARRIER_CONTROL",
  RADIONUCLIDE_TRANSPORT_BARRIER_CONTROL = "RADIONUCLIDE_TRANSPORT_BARRIER_CONTROL",
  EX_VESSEL_FISSION_PRODUCT_CONTROL = "EX_VESSEL_FISSION_PRODUCT_CONTROL",
}

export interface ParameterRange {
  min: number;
  max: number;
  representative: number;
  units?: string;
}

export interface InterviewRecord {
  // additional-to-example
  uuid?: string;
  evolutionId?: string;
  posId?: string;
  date: string;
  personnelRoles: string[];
  method: "TABLETOP" | "WALKDOWN" | "COMPUTERIZED_WALKDOWN" | "INTERVIEW";
  findings: string;
  overlookedEvolutionsIdentified: string[];
}

export interface TransitionParameter {
  parameter: string;
  threshold: string | number;
  units?: string;
  monitored: boolean;
  monitoringInstruments?: string[];
}

export interface TimeBoundary {
  startingCondition: string;
  endingCondition: string;
  transitionParameters: TransitionParameter[];
}

export interface Instrument extends Unique, Named {
  parameter: string;
  location: string;
  range?: [number, number];
  units?: string;
  availability: boolean;
  safetyRelated: boolean;
}

export interface RadioactiveSource extends Unique, Named {
  location: SourceLocation;
  description: string;
  radionuclides: string[];
  status: string;
  releasePaths: string[];
  barriers: string[];
  screeningStatus: ScreeningStatus;
  exclusionJustification?: string;
}

export interface RadionuclideTransportBarrier extends Unique, Named {
  status?: BarrierStatus;
  monitoringParameters: string[];
  breachCriteria: string[];
}

export interface ReactorCoolantSystemParameters {
  powerLevel: ParameterRange;
  decayHeatLevel: ParameterRange;
  reactorCoolantTemperature: ParameterRange;
  coolantPressure: ParameterRange;
  reactorLevel?: ParameterRange;
  coolantInventory?: ParameterRange;
  timeAfterShutdownHours?: number;
  rcsConfigurationDescription: string;
  otherParameters?: Record<string, ParameterRange>;
}

export interface DecayHeatRemovalConfiguration {
  primaryCoolingSystems: Record<string, SystemStatus>;
  secondaryCoolingSystems: Record<string, SystemStatus>;
  passiveMechanisms: Record<string, SystemStatus>;
}

export interface SafetyFunctionImplementation {
  name: string;
  description: string;
  status: string;
  type: "ACTIVE" | "PASSIVE";
  reliability?: {
    mtbf?: number;
    pfd?: number;
  };
}

export interface SafetyFunction extends Unique, Named {
  category: SafetyFunctionCategory;
  description: string;
  state: "SUCCESS" | "FAILURE" | "STANDBY";
  successCriterion: string;
  failureCriterion: string;
  successCriteriaIds: SuccessCriteriaId[];
  implementationMechanisms: SafetyFunctionImplementation[];
  supportingSscs: ComponentReference[];
  applicableInitiatingEvents: string[];
}

export interface SscOperationalCharacteristic {
  ssc: ComponentReference;
  desiredState: string;
  supportedSafetyFunction: SafetyFunctionCategory;
}

export interface TimeVaryingCondition extends Unique, Named {
  timeHours: number;
  parameter: string;
  value: number;
  units?: string;
  uncertainty?: number;
  impactOnSafetyFunctions: string;
  requiresMonitoring: boolean;
}

export interface HazardGroupReview {
  hazardGroup: string;
  hazardBarrierEffectivenessChanges: string[];
  propagationPathwayModifications: string[];
  sscFragilityModifications: string[];
  conditionsRemainSufficient: boolean;
  basis: string;
}

export interface OperatingStateRiskSignificance {
  posId: string;
  riskContributionFraction: number;
  cdf: Frequency | FrequencyWithDistribution;
  lerf?: Frequency | FrequencyWithDistribution;
  riskSignificantContributors: string[];
  importanceMeasures?: {
    component: ComponentReference;
    fussellVesely?: number;
    raw?: number;
    rrw?: number;
  }[];
}

export interface PlantOperatingState extends Unique, Named {
  evolutionId: string;
  description: string;
  operatingMode: OperatingMode;

  radioactiveMaterialSources: RadioactiveSource[];
  rcbConfiguration: string;
  rcsParameters: ReactorCoolantSystemParameters;
  availableInstrumentation: Instrument[];
  activitiesLeadingToParameterChanges: string[];
  radionuclideTransportBarriers: RadionuclideTransportBarrier[];

  timeBoundary: TimeBoundary;

  decayHeatRemoval: DecayHeatRemovalConfiguration;
  sscOperationalCharacteristics: SscOperationalCharacteristic[];
  safetyFunctions: SafetyFunction[];

  applicableInitiatingEvents: InitiatingEvent[];
  successCriteriaIds: SuccessCriteriaId[];

  meanDurationHours: number;
  meanTimeAfterShutdownHours?: number;
  durationAndCycleTimingBasis?: string;
  meanEntryFrequency: Frequency | FrequencyWithDistribution;
  decayHeatLevelDefined: boolean;
  decayHeatBasis?: string;

  timeVaryingConditions?: TimeVaryingCondition[];
  hazardGroupReviews?: HazardGroupReview[];

  riskSignificance?: OperatingStateRiskSignificance;
  preOperationalAssumptions?: PreOperationalAssumption[];

  implementsSrs: SRReference[];

  // additional-to-example
  uiStatus?: "ok" | "warn" | "draft";
  // additional-to-example
  uiStatusMessage?: string;
  // additional-to-example
  docsLinked?: number;
}

export interface PlantEvolution extends Unique, Named {
  type: EvolutionType;
  description: string;
  operatingModes: string[];
  reviewedDocumentation: {
    operatingModes: string[];
    rcbConfigurations: string[];
    rcsParameterRanges: string[];
    decayHeatRemovalMechanisms: string[];
    availableInstrumentation: string[];
    activitiesLeadingToChanges: string[];
    radionuclideTransportBarrierStatus: string[];
    sscCapabilityChanges: string[];
    operationalAssumptions: string[];
  };
  plantOperatingStateIds: string[];
  futureEvolutionReview?: {
    higherRiskStatesNotPreviouslyEncountered: string[];
    earlierOrLaterEntryDecayHeatImpacts: string[];
    durationChanges: string[];
  };
  preOperationalAssumptions?: PreOperationalAssumption[];
  implementsSrs: SRReference[];

  // additional-to-example
  sourceDocumentRef?: string;
}

export type PosEvidenceType =
  | "DESIGN_BASIS"
  | "PROCESS_DRAWING"
  | "ELECTRICAL_I_AND_C"
  | "OPERATING_PROCEDURE"
  | "WORK_CONTROL"
  | "ENGINEERING_CALCULATION"
  | "HAZARD_BARRIER"
  | "HUMAN_FACTORS"
  | "OPERATING_EXPERIENCE"
  | "CONFIGURATION_CONTROL"
  | "INTERVIEW_WALKDOWN";

export type PosEvidenceStatus = "PRELIMINARY" | "APPROVED" | "AS_BUILT" | "AS_OPERATED" | "SUPERSEDED";

export interface PosEvidenceRecord extends Unique {
  identifier: string;
  title: string;
  revision: string;
  effectiveDate: string;
  evidenceType: PosEvidenceType;
  lifecycleStatus: PosEvidenceStatus;
  citation: string;
  extractedFact: string;
  affectedEvolutionIds: string[];
  affectedPosIds: string[];
  limitation?: string;
  reviewer?: string;
}

export type EvolutionSearchMethod =
  | "MODE_LIFECYCLE"
  | "PROCEDURE_ACTIVITY"
  | "SYSTEM_SAFETY_FUNCTION"
  | "SOURCE_BARRIER"
  | "EXPERIENCE_PERSONNEL";

export interface EvolutionSearchRecord extends Unique {
  method: EvolutionSearchMethod;
  evidenceIds: string[];
  identifiedEvolutionIds: string[];
  complete: boolean;
  basis: string;
}

export type PosBoundaryDimension =
  | "RADIOACTIVE_SOURCE"
  | "CRITICALITY_POWER"
  | "TIME_AFTER_SHUTDOWN"
  | "COOLANT_CONDITION"
  | "PROCESS_BOUNDARY"
  | "DECAY_HEAT_REMOVAL"
  | "INSTRUMENTATION"
  | "AUTOMATION"
  | "SSC_ALIGNMENT"
  | "SUPPORT_SYSTEMS"
  | "RADIONUCLIDE_BARRIER"
  | "HAZARD_BARRIER"
  | "HUMAN_ACTIVITY"
  | "HUMAN_CONTEXT";

export type PosBoundaryDisposition = "UNRESOLVED" | "RETAIN" | "COMBINE";

export interface PosCandidateBoundary extends Unique {
  evolutionId: string;
  sequence: number;
  label: string;
  activity: string;
  entryCondition: string;
  changedDimensions: PosBoundaryDimension[];
  evidenceIds: string[];
  stateBeforeId?: string;
  stateAfterId?: string;
  disposition: PosBoundaryDisposition;
  basis: string;
}

export type PosImpactResult = "CHANGED" | "UNCHANGED" | "UNRESOLVED";
export type PosBoundaryInterfaceCode =
  | "IE"
  | "ES"
  | "SC"
  | "SY"
  | "HR"
  | "DA"
  | "FL"
  | "F"
  | "S"
  | "HS"
  | "W"
  | "XF"
  | "O"
  | "ESQ"
  | "MS"
  | "RC"
  | "RI";

export interface PosBoundaryInterfaceReview extends Unique {
  technicalElementCode: PosBoundaryInterfaceCode;
  result: PosImpactResult;
  affectedArtifact: string;
  responsibleAnalyst: string;
  reviewStatus: "NOT_REVIEWED" | "PENDING" | "CONFIRMED";
  technicalBasis: string;
}

export interface PosBoundaryImpactAssessment {
  boundaryId: string;
  interfaceReviews: PosBoundaryInterfaceReview[];
  exposureTreatment: "UNRESOLVED" | "TIME_BASED" | "DEMAND_BASED" | "BOTH" | "NOT_APPLICABLE";
  exposureResult: PosImpactResult;
  exposureBasis: string;
  riskSignificanceCheck: "UNRESOLVED" | "PRESERVED" | "COULD_MASK";
  riskSignificanceBasis: string;
  conclusion: PosBoundaryDisposition;
  basis: string;
  reviewer?: string;
}

export interface PosBaselineReview {
  revision: string;
  status: "DRAFT" | "READY" | "BASELINED";
  reviewer: string;
  reviewDate: string;
  evolutionTraceable: boolean;
  boundaryTraceable: boolean;
  groupingTraceable: boolean;
  quantificationTraceable: boolean;
  interfacesTraceable: boolean;
  openAssumptions: number;
  changeSummary: string;
}

export interface EvolutionGroup extends Unique, Named {
  memberEvolutionIds: string[];
  similarityBasis: string;
  boundedByWorstCaseImpact: string;
  groupingDoesNotImpactRiskSignificantSequences: boolean;
  comparableImpactAcrossMembers: boolean;
  implementsSrs: SRReference[];
}

export interface PlantOperatingStateGroup extends Unique, Named {
  evolutionType: EvolutionType;
  memberPosIds: string[];
  similarityBasis: string;
  boundingCharacteristics: string[];
  doesNotMaskRiskSignificantContributors: boolean;
  summedDurationHours: number;
  entryFrequency: Frequency | FrequencyWithDistribution;
  preOperationalAssumptions?: PreOperationalAssumption[];
  implementsSrs: SRReference[];
}

export interface PosScreeningRecord {
  posId: string;
  retained: boolean;
  criterion?: ScreeningCriterion;
  quantitativeBasis?: number;
  justification: string;
  alternateCriterionJustification?: string;
  riskSignificance?: ImportanceLevel;
  implementsSrs: SRReference[];
}

export interface PosSeparationRecord {
  separatedPosIds: string[];
  differingResponseBasis: string;
  differentSuccessCriteria: boolean;
  differentBarrierConfiguration: boolean;
  moreSevereReleasePotential: boolean;
  implementsSrs: SRReference[];
}

export interface DemandTimeBasedRecord {
  posId: string;
  initiatorBasis: "DEMAND_BASED" | "TIME_BASED";
  delineatedToAvoidAveraging: boolean;
  justification: string;
  implementsSrs: SRReference[];
}

export interface SubsumedPosRecord {
  subsumedPosId: string;
  subsumingPosId: string;
  criterion: ScreeningCriterion;
  justification: string;
  riskImpact: ImportanceLevel;
  limitations: string[];
  validationMethod: string;
  sensitivityAnalysis?: SensitivityStudy;
  implementsSrs: SRReference[];
}

export interface DecayHeatCharacterization {
  posId: string;
  decayHeatLevel: ParameterRange;
  timeAfterShutdownHours: number;
  basis: string;
  isLpsd: boolean;
  implementsSrs: SRReference[];
}

export interface MutualExclusivityValidation {
  delineationParameters: string[];
  verificationMethod: string;
  allConditionsBelongToExactlyOnePos: boolean;
}

export interface CollectiveExhaustivityValidation {
  verificationMethod: string;
  totalCycleHours: number;
  summedPosHours: number;
  coverageFraction: number;
  allConfigurationsCovered: boolean;
}

export interface TransitionValidation {
  transitionMatrix: Record<string, string[]>;
  transitionTriggers: Record<string, string>;
}

export interface PosValidationRules {
  mutualExclusivity: MutualExclusivityValidation;
  collectiveExhaustivity: CollectiveExhaustivityValidation;
  transitions: TransitionValidation;
  implementsSrs: SRReference[];
}

export interface TransitionEvent extends Unique, Named {
  fromPosId: string;
  toPosId: string;
  trigger: string;
  frequency: Frequency | FrequencyWithDistribution;
  durationHours?: number;
  transitionParameters: TransitionParameter[];
  risks: string[];
  riskSignificance?: ImportanceLevel;
  requiredHumanActions: string[];
  requiredEquipment: string[];
  procedureIds: string[];
}

export interface PosDocumentation {
  processDescription: string;
  evolutionSelectionAndDefinitions: string;
  posIdentificationProcessAndCriteria: string;
  posGroupingProcessAndCriteria: string;
  posGroupDefinitions: string;
  posCharacteristics: string;
  durationsTimesSinceShutdownFrequencies: string;
  decayHeatPerPos: string;
  praTaskInterfaces: string;
  modelUncertaintySources: string;
  asBuiltLimitations: string;
  implementsSrs: SRReference[];
}

export interface PlantOperatingStatesAnalysis
  extends TechnicalElement<TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS> {
  praScope: string;
  includesNonInternalHazardGroups: boolean;
  includesAtPowerOperations: boolean;
  // Additional
  includesLPSDOperations?: boolean;

  plantEvolutions: PlantEvolution[];
  plantOperatingStates: PlantOperatingState[];

  evidenceRegister?: PosEvidenceRecord[];
  evolutionSearchRecords?: EvolutionSearchRecord[];
  candidateBoundaries?: PosCandidateBoundary[];
  boundaryImpactAssessments?: PosBoundaryImpactAssessment[];
  baselineReview?: PosBaselineReview;

  evolutionGroups?: EvolutionGroup[];
  plantOperatingStateGroups?: PlantOperatingStateGroup[];

  screeningRecords: PosScreeningRecord[];
  separationRecords: PosSeparationRecord[];
  demandTimeBasedRecords?: DemandTimeBasedRecord[];
  subsumedPosRecords?: SubsumedPosRecord[];

  decayHeatCharacterizations: DecayHeatCharacterization[];

  hazardGroupReviews?: HazardGroupReview[];

  interviewRecords?: InterviewRecord[];
  plantRepresentationAccuracy: PlantRepresentationAccuracy;

  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];

  transitionEvents: TransitionEvent[];
  timeVaryingConditions?: TimeVaryingCondition[];

  validationRules: PosValidationRules;
  documentation: PosDocumentation;

  configurationControlRecordId?: string;
  newlyDevelopedMethodIds?: string[];

  // additional-to-example
  decayHeatOperatingDays?: number;
  // additional-to-example
  decayHeatCurve?: {
    name: string;
    points: { hours: number; fractionOfPower: number }[];
  };
  // additional-to-example
  exampleDocuments?: ExampleDocumentRef[];
}

// additional-to-example
export interface ExampleDocumentRef {
  id: string;
  name: string;
  kind: "doc" | "sheet" | "image";
  sizeLabel: string;
  uploadedLabel: string;
  extracted: string;
  linked: number;
  url?: string;
  citation?: string;
}

export const POS_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  "POS-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-A4": { hlr: "A", stages: ["OPERATIONAL"] },
  "POS-A5": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "POS-A6": { hlr: "A", stages: ["OPERATIONAL"] },
  "POS-A7": { hlr: "A", stages: ["OPERATIONAL"] },
  "POS-A8": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "POS-A9": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-A10": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-A11": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-A12": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-A13": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "POS-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-B3": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-B4": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-B5": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-B6": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-B7": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-B8": { hlr: "B", stages: ["PRE_OPERATIONAL"] },
  "POS-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-C2": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "POS-C3": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-C4": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-C5": { hlr: "C", stages: ["OPERATIONAL"] },
  "POS-D1": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-D2": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "POS-D3": { hlr: "D", stages: ["PRE_OPERATIONAL"] },
};
