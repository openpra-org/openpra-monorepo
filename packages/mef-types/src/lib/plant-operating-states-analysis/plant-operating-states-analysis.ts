import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { InitiatingEvent, BaseEvent, Frequency, FrequencyWithDistribution } from "../core/events";
import {
  IdPatterns,
  ImportanceLevel,
  SensitivityStudy,
  ScreeningStatus,
  SuccessCriteriaId,
} from "../core/shared-patterns";
import { DistributionType } from "../data-analysis/data-analysis";
import { BaseAssumption } from "../core/documentation";
import { ComponentReference } from "../core/component";
import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";
export enum OperatingState {
  POWER = "POWER",
  STARTUP = "STARTUP",
  SHUTDOWN = "SHUTDOWN",
  REFUELING = "REFUELING",
  MAINTENANCE = "MAINTENANCE",
}
export enum BarrierStatus {
  INTACT = "INTACT",
  BREACHED = "BREACHED",
  DEGRADED = "DEGRADED",
  BYPASSED = "BYPASSED",
  OPEN = "OPEN",
}
export enum ModuleState {
  IMPACTED = "IMPACTED",
  NOT_IMPACTED = "NOT_IMPACTED",
  PARTIALLY_IMPACTED = "PARTIALLY_IMPACTED",
}
export type SourceLocationType = "IN_CORE_SOURCE" | "OUT_OF_CORE_SOURCE";
export type SystemStatus = "YES" | "NO";
export interface TimeVaryingCondition extends Unique, Named {
  time: number;
  parameter: string;
  value: number;
  impact: string;
  units?: string;
  uncertainty?: number;
  requiresMonitoring: boolean;
}
export interface TransitionEvent extends Unique {
  name: string;
  description?: string;
  fromStateId: string;
  toStateId: string;
  risks: string[];
  duration?: number;
  frequency?: Frequency | FrequencyWithDistribution;
  specialConsiderations?: string[];
  procedureIds?: string[];
  criticalParameters?: string[];
  transitionParameters?: TransitionParameter[];
  riskSignificance?: ImportanceLevel;
  mitigatingActions?: string[];
  requiredHumanActions?: string[];
  requiredEquipment?: string[];
  potentialFailureModes?: string[];
}
export interface PlantEvolution extends Unique, Named {
  description?: string;
  operatingModes: string[];
  rcbConfigurations: string[];
  rcsParameters: {
    powerLevel?: number;
    temperature?: number;
    pressure?: number;
    coolantInventory?: number;
  };
  availableInstrumentation: string[];
  activitiesLeadingToChanges: string[];
  radionuclideTransportBarriersStatus: string[];
  sscCapabilitiesChanges: string[];
  operationalAssumptions: string[];
  plantOperatingStates: PlantOperatingState[];
  evolutionProperties?: {
    praMode: string;
    screeningStatus: ScreeningStatus;
  };
  evolutionConsiderations?: {
    reactorCoolantBoundaryConfigurations: string[];
    reactorCoolantSystemParameterRanges: string[];
    availableMonitoringDevices: string[];
    operatorActions: string[];
    radionuclideTransportBarrierStatus: string[];
    screeningStatus: ScreeningStatus;
    hazardBarrierEffectivenessChanges?: string[];
    propagationPathwayModifications?: string[];
    sscFragilityModifications?: string[];
    transitionParameters?: TransitionParameter[];
  };
  transitions?: TransitionEvent[];
  initiatingEvents?: InitiatingEvent[];
}
export interface TimeBoundary {
  startingCondition: string;
  endingCondition: string;
  transitionParameters?: TransitionParameter[];
}
export interface TransitionParameter {
  parameter: string;
  value: string | number;
  units?: string;
  monitored?: boolean;
  monitoringInstruments?: string[];
}
export interface Instrument extends Unique, Named {
  parameter: string;
  location: string;
  accuracy: number;
  availability: boolean;
  range?: [number, number];
  units?: string;
  calibrationRequirements?: string;
  safetyRelated: boolean;
}
export interface DecayHeatRemovalSystems {
  primaryCoolingSystems: Record<string, SystemStatus>;
  secondaryCoolingSystems: Record<string, SystemStatus>;
}
export interface ReactorCoolantSystemParameters {
  powerLevel: [number, number];
  decayHeatLevel: [number, number];
  reactorCoolantTemperatureAtControlVolume1: [number, number];
  coolantPressureAtControlVolume1: [number, number];
  others?: [number, number];
  reactorLevel?: [number, number];
  timeAfterShutdown?: number;
  rcsConfigurationDescription?: string;
}
export interface RadionuclideTransportBarriers {
  barrier1: BarrierStatus;
  barrier2: BarrierStatus;
  [key: string]: BarrierStatus;
}
export interface OperatingStateRisk {
  stateId: string;
  stateName: string;
  riskContribution: number;
  riskMetrics: {
    CDF: Frequency | FrequencyWithDistribution;
    LERF: Frequency | FrequencyWithDistribution;
  };
  riskSignificantContributors: string[];
  importanceMeasures?: {
    componentId: ComponentReference;
    fussellVesely?: number;
    RAW?: number;
    RRW?: number;
  }[];
}
export interface PlantOperatingState extends Unique, Named {
  description?: string;
  characteristics?: string;
  processCriteriaIdentification?: string;
  timeBoundary: TimeBoundary;
  radioactiveMaterialSources: string[];
  detailedRadioactiveSources?: RadioactiveSource[];
  operatingMode: OperatingState;
  rcbConfiguration: string;
  rcsParameters: ReactorCoolantSystemParameters;
  decayHeatRemoval: DecayHeatRemovalSystems;
  availableInstrumentation: string[];
  detailedInstrumentation?: Instrument[];
  activitiesLeadingToChanges?: string[];
  radionuclideTransportBarrier: RadionuclideTransportBarriers;
  initiatingEvents: InitiatingEvent[];
  safetyFunctions: SafetyFunction[];
  meanDuration: number;
  meanTimeSinceShutdown?: number;
  meanFrequency?: Frequency | FrequencyWithDistribution;
  assumptions?: string[];
  successCriteriaIds?: SuccessCriteriaId[];
  timeVaryingConditions?: TimeVaryingCondition[];
  riskSignificance?: OperatingStateRisk;
  plantRepresentationAccuracy?: PlantRepresentationAccuracy & {
    highConfidenceAreas?: string[];
    lowerConfidenceAreas?: string[];
    improvementPlans?: string[];
  };
}
export interface PlantOperatingStatesTable {
  startUp: PlantOperatingState;
  controlledShutdown: PlantOperatingState;
  fullPower: PlantOperatingState;
  [key: string]: PlantOperatingState;
}
export interface OperatingStatesFrequencyDuration {
  outagePlansRecords: {
    startDate: string;
    endDate: string;
    description: string;
    frequencyPerYear: Frequency | FrequencyWithDistribution;
  }[];
  maintenancePlansRecords: {
    startDate: string;
    endDate: string;
    description: string;
    frequencyPerYear: Frequency | FrequencyWithDistribution;
  }[];
  operationsData: {
    startDate: string;
    endDate: string;
  }[];
  tripHistory: {
    date: string;
    description: string;
  }[];
  summary?: {
    posName: string;
    averageDuration: number;
    entriesPerYear: number;
    fractionOfTime: number;
  }[];
}
export interface PlantOperatingStatesGroup extends Unique, Named {
  description?: string;
  plantOperatingStateIds: string[];
  groupingJustification: string;
  representativeCharacteristics: string[];
}
export interface AssumptionsLackOfDetail {
  description: string;
  influence: string;
  riskImpact: ImportanceLevel;
  justification?: string;
  plannedActions?: string[];
  affectedPOSIds?: string[];
  potentialAlternatives?: string[];
  sensitivityAnalysis?: string;
}
export interface SubsumedPOS {
  subsumedPOS: string;
  subsumingPOS: string;
  justification: string;
  riskImpact?: ImportanceLevel;
  limitations?: string[];
  validationMethod?: string;
  sensitivityAnalysis?: SensitivityStudy;
}
export interface SafetyFunction extends Unique, Named {
  description?: string;
  state: "SUCCESS" | "FAILURE";
  criteria?: {
    success: string;
    failure: string;
  };
  systemResponses?: string[];
  dependencies?: {
    type: string;
    description: string;
  }[];
  preventionMitigationLevel?: string;
  successCriteriaIds?: SuccessCriteriaId[];
  initiatingEvents?: {
    id: string;
    name?: string;
    effectiveness?: string;
  }[];
  category: string;
  implementationMechanisms: Array<{
    name: string;
    description: string;
    status: string;
    statusDetails?: string;
    type: string;
    reliability?: {
      mtbf?: number;
      pfd?: number;
    };
  }>;
  operationalParameters?: Array<{
    name: string;
    value: string | number;
    units?: string;
    acceptableRange?: [number, number];
    monitored: boolean;
    monitoringInstruments?: string[];
  }>;
  degradationMechanisms?: Array<{
    name: string;
    description: string;
    status: string;
    mitigationMeasures?: string[];
  }>;
}
export interface RadionuclideBarrier extends Unique, Named {
  state: BarrierStatus;
  monitoringParameters?: string[];
  breachCriteria?: string[];
  description?: string;
}
export interface RadioactiveSource extends Unique, Named {
  location: "IN_VESSEL" | "EX_VESSEL";
  sourceLocation?: SourceLocationType;
  description: string;
  radionuclides: string[];
  status: string;
  releasePaths?: string[];
  barriers?: string[];
  screeningStatus: ScreeningStatus;
}
export interface HazardousSources {
  sourceDefinition: Record<SourceLocationType, ScreeningStatus>;
  detailedSources?: RadioactiveSource[];
  operatingStates: PlantOperatingStatesTable;
  operatingStatesFrequencyDuration: OperatingStatesFrequencyDuration;
  plantEvolution: PlantEvolution;
  exVesselSourceExclusionJustification?: string;
}
export interface POSValidationRules {
  mutualExclusivityRules: {
    description: string;
    delineationParameters: string[];
    verificationMethod: string;
  };
  collectiveExhaustivityRules: {
    description: string;
    verificationMethod: string;
    configurationCoverage: string;
  };
  transitionRules: {
    transitionMatrix: Record<string, string[]>;
    transitionTriggers: Record<string, string>;
  };
}
export interface ModelUncertaintyInfo {
  source: string;
  description: string;
  impact: ImportanceLevel;
  treatment: string;
  reasonableAlternatives?: string[];
}
export interface PeerReviewFinding {
  findingId: string;
  description: string;
  category: string;
  significance: ImportanceLevel;
  response: string;
  actions?: string[];
  status: "OPEN" | "CLOSED" | "IN_PROGRESS";
}
export interface TransitionRisk {
  transitionId: string;
  description: string;
  risks: string[];
  significance: ImportanceLevel;
  mitigatingActions?: string[];
  requiredHumanActions?: string[];
  requiredEquipment?: string[];
}
export interface PlantRepresentationAccuracy {
  accuracy: ImportanceLevel;
  basis: string;
  limitations?: string[];
  improvementActions?: string[];
  sufficientForRiskSignificantContributors: boolean;
  sufficiencyJustification?: string;
}
export interface PlantOperatingStatesDocumentation {
  processDescription: string;
  plantEvolutionsDetails: string;
  identificationProcessDetails: string;
  groupingProcessDetails: string;
  stateGroupDefinitions: string;
  stateCharacteristics: string;
  meanDurationsDetails: string;
  decayHeatDetails: string;
  praTaskInterfaces: string;
  modelUncertaintySources: string;
  asBuiltLimitations: string;
  peerReviewFindings?: PeerReviewFinding[];
  transitionRisks?: TransitionRisk[];
}
export interface PlantOperatingStatesAnalysis
  extends TechnicalElement<TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS> {
  additionalMetadata?: {
    limitations?: string[];
    assumptions?: string[];
  };
  plantEvolutions: PlantEvolution[];
  includesAtPowerOperations: boolean;
  hazardousSources: HazardousSources;
  plantOperatingStatesGroups?: PlantOperatingStatesGroup[];
  modelUncertainty?: ModelUncertaintyInfo[];
  subsumedPOSs?: SubsumedPOS[];
  assumptionsLackOfDetail?: AssumptionsLackOfDetail[];
  sscsAndOperationalCharacteristics?: string[];
  documentation?: PlantOperatingStatesDocumentation;
  posValidationRules: POSValidationRules;
  transitionEvents?: TransitionEvent[];
  plantRepresentationAccuracy?: PlantRepresentationAccuracy & {
    highConfidenceAreas?: string[];
    lowerConfidenceAreas?: string[];
    improvementPlans?: string[];
  };
  timeVaryingConditions?: TimeVaryingCondition[];
}
