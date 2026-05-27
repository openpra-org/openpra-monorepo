import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { InitiatingEvent, Frequency, FrequencyWithDistribution } from "../core/events";
import { ImportanceLevel, SensitivityStudy, ScreeningStatus, SuccessCriteriaId } from "../core/shared-patterns";
import { ComponentReference } from "../core/component";

export type CapabilityCategory = "CC-I" | "CC-II" | "CC-III";

export type PlantStage = "OPERATIONAL" | "PRE_OPERATIONAL";

export type HlrId = "A" | "B" | "C" | "D";

export type SRStatus = "MET" | "PARTIAL" | "NOT_MET" | "NOT_APPLICABLE" | "PENDING_REVIEW";

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

export interface SRReference {
  sr: string;
  hlr: HlrId;
}

export interface ParameterRange {
  min: number;
  max: number;
  representative: number;
  units?: string;
}

export interface ModelUncertainty {
  source: string;
  description: string;
  impact: ImportanceLevel;
  treatment: string;
  reasonableAlternatives: string[];
}

export interface PreOperationalAssumption {
  description: string;
  influenceOnDefinition: string;
  riskImpact: ImportanceLevel;
  closureBasis: string;
  plannedClosureActions: string[];
  affectedPosIds: string[];
  potentialAlternatives?: string[];
  sensitivityAnalysis?: SensitivityStudy;
}

export interface InterviewRecord {
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
  status: BarrierStatus;
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
  meanEntryFrequency: Frequency | FrequencyWithDistribution;
  decayHeatLevelDefined: boolean;
  decayHeatBasis?: string;

  timeVaryingConditions?: TimeVaryingCondition[];
  hazardGroupReviews?: HazardGroupReview[];

  riskSignificance?: OperatingStateRiskSignificance;
  preOperationalAssumptions?: PreOperationalAssumption[];

  implementsSrs: SRReference[];
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
  implementsSrs: SRReference[];
}

export interface PosScreeningRecord {
  posId: string;
  retained: boolean;
  criterion?: ScreeningCriterion;
  quantitativeBasis?: number;
  justification: string;
  alternateCriterionJustification?: string;
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

export interface PlantRepresentationAccuracy {
  scope: "OPERATING" | "PRE_OPERATIONAL";
  accuracy: ImportanceLevel;
  basis: string;
  detailConsistentWithPlant: boolean;
  sufficientForRiskSignificantContributors: boolean;
  sufficiencyJustification: string;
  highConfidenceAreas: string[];
  lowerConfidenceAreas: string[];
  improvementPlans: string[];
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

export interface PeerReviewFinding {
  findingId: string;
  description: string;
  associatedSr: string;
  significance: ImportanceLevel;
  response: string;
  actions: string[];
  status: "OPEN" | "CLOSED" | "IN_PROGRESS";
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
  peerReviewFindings?: PeerReviewFinding[];
  implementsSrs: SRReference[];
}

export interface SRConformance {
  sr: string;
  hlr: HlrId;
  capabilityCategory: CapabilityCategory;
  applicableToStage: PlantStage[];
  status: SRStatus;
  satisfiedByElementPaths: string[];
  evidence: string;
  reviewNotes?: string;
}

export interface PlantOperatingStatesAnalysis
  extends TechnicalElement<TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS> {
  metadata: {
    plantName: string;
    plantStage: PlantStage;
    capabilityCategory: CapabilityCategory;
    praScope: string;
    includesNonInternalHazardGroups: boolean;
    freezeDate: string;
    includesAtPowerOperations: boolean;
  };

  plantEvolutions: PlantEvolution[];
  plantOperatingStates: PlantOperatingState[];

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

  modelUncertainties: ModelUncertainty[];
  preOperationalAssumptions?: PreOperationalAssumption[];

  transitionEvents: TransitionEvent[];
  timeVaryingConditions?: TimeVaryingCondition[];

  validationRules: PosValidationRules;
  documentation: PosDocumentation;

  conformanceMatrix: SRConformance[];
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
