import { Unique, Named } from "../core/meta";
import { InitiatingEvent, Frequency, FrequencyWithDistribution } from "../core/events";
import { ImportanceLevel, SensitivityStudy, ScreeningStatus, SuccessCriteriaId } from "../core/shared-patterns";
import { PreOperationalAssumption, BaseModelUncertaintyDocumentation, PlantRepresentationAccuracy } from "../core/documentation";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type PlantOperatingStateReference = string;
export type SafetyFunctionReference = string;
export type RadionuclideBarrierReference = string;
export type SystemReference = string;
export type ComponentReference = string;

export enum InitiatingEventCategory {
  TRANSIENT = "TRANSIENT",
  RCB_BREACH = "RCB_BREACH",
  INTERFACING_SYSTEMS_RCB_BREACH = "INTERFACING_SYSTEMS_RCB_BREACH",
  SPECIAL = "SPECIAL",
  INTERNAL_HAZARD = "INTERNAL_HAZARD",
  EXTERNAL_HAZARD = "EXTERNAL_HAZARD",
  HUMAN_FAILURE = "HUMAN_FAILURE",
}

export enum ModuleImpactState {
  IMPACTED = "IMPACTED",
  NOT_IMPACTED = "NOT_IMPACTED",
  PARTIALLY_IMPACTED = "PARTIALLY_IMPACTED",
}

export enum BarrierImpactState {
  INTACT = "INTACT",
  BREACHED = "BREACHED",
  DEGRADED = "DEGRADED",
  BYPASSED = "BYPASSED",
  OPEN = "OPEN",
}

export interface TripParameter {
  parameter: string;
  setpoint: number;
  uncertainty: number;
  basis: string;
}

export interface MitigatingSystemDemand {
  systemId: SystemReference;
  function: string;
  successCriteriaIds: SuccessCriteriaId[];
  dependencies: string[];
}

export interface BarrierImpact {
  barrierId: RadionuclideBarrierReference;
  state: BarrierImpactState;
  timing: string;
  mechanism: string;
}

export interface ModuleImpact {
  moduleId: string;
  state: ModuleImpactState;
  propagationPath?: string;
  timing?: string;
}

export interface SourceEscapeMechanism {
  sourceId: string;
  mechanisms: string[];
  hazardGroupsConsidered: string[];
  implementsSrs: SRReference[];
}

export interface IdentificationReview {
  reviewType: "INTERVIEW" | "EVALUATION";
  date: string;
  personnelRoles: string[];
  findings: string;
  overlookedInitiatorsIdentified: string[];
  implementsSrs: SRReference[];
}

export interface InterfacingSystemBreachFeatures {
  pathwayConfiguration: string;
  valveTypesAndFailureModes: string[];
  reliefValveProvisions: string;
  otherComponentBehavior?: string[];
  protectiveInterlocks: string[];
  testAndMaintenancePractices?: string[];
  detectionMeans?: string[];
  implementsSrs: SRReference[];
}

export interface InitiatorDefinition extends InitiatingEvent {
  category: InitiatingEventCategory;
  subcategory?: string;
  applicableStates: PlantOperatingStateReference[];
  groupId?: string;

  identificationMethodIds: string[];
  identificationBasis: string[];

  tripParameters: TripParameter[];
  mitigatingSystems: MitigatingSystemDemand[];
  barrierImpacts: BarrierImpact[];
  moduleImpacts?: ModuleImpact[];
  interfacingSystemFeatures?: InterfacingSystemBreachFeatures;

  challengedSafetyFunctions: SafetyFunctionReference[];

  plantExperience?: string[];
  genericAnalysisReview?: string;
  similarPlantReview?: string;

  screeningStatus: ScreeningStatus;
  screeningCriterion?: "SCR-1" | "SCR-2" | "SCR-3";
  screeningBasis?: string;
  barrierIntegrityScreeningSatisfied?: boolean;

  importanceLevel?: ImportanceLevel;
  preOperationalAssumptions?: PreOperationalAssumption[];

  implementsSrs: SRReference[];
}

export interface HazardInducedInitiator extends InitiatorDefinition {
  hazardType: string;
  hazardSeverity: string;
  combinedHazards?: string[];
  affectedAreas: string[];
  hazardFrequencyFactors: {
    returnPeriod?: number;
    exceedanceProbability?: number;
    fragilityParameters?: Record<string, number>;
  };
}

export interface InitiatingEventGroup extends Unique, Named {
  description: string;
  memberInitiatorIds: string[];
  groupingBasis: string;
  boundingInitiatorId: string;
  similarMitigationRequirements: string[];
  groupingDoesNotMaskRiskSignificantSequences: boolean;
  comparableImpactAcrossMembers: boolean;
  challengedSafetyFunctions: SafetyFunctionReference[];
  applicableStates: PlantOperatingStateReference[];
  affectedReactorOrSourceCombinations?: string[];
  meanFrequency?: Frequency | FrequencyWithDistribution;
  riskImportance?: ImportanceLevel;
  implementsSrs: SRReference[];
}

export interface InitiatingEventFrequencyQuantification {
  initiatorOrGroupId: string;
  meanFrequency: Frequency | FrequencyWithDistribution;
  basis: "OPERATING_DATA" | "GENERIC_DATA" | "SIMILAR_PLANT_DATA" | "DESIGN_BASED" | "FAULT_TREE";
  plantCalendarYearBasis: boolean;
  posTimeFractionApplied: boolean;
  dataSourceJustification: string;
  dataExclusionJustification?: string;
  otherReactorDataJustification?: string;
  recoveryActionsIncluded: boolean;
  recoveryActionJustifications?: string[];
  plantSpecificRecoveryInfoUsed?: boolean;
  faultTreeDetails?: {
    modelId: string;
    topEvent: string;
    modifications: string[];
    quantifiesFrequencyNotProbability: boolean;
    hfeContributionsIncluded: boolean;
    hfeExclusionBasis?: string;
    componentFailureCombinationsIncluded: boolean;
  };
  operatorContribution?: {
    controlRoomContributionEstimated: boolean;
    operatorSplitFraction?: number;
    hardwareSplitFraction?: number;
    basis: string;
  };
  genericDataComparison?: {
    performed: boolean;
    differencesExplanation?: string;
  };
  rareEventTreatment?: {
    industryGenericDataUsed: boolean;
    plantSpecificAugmentation?: string;
    expertJudgmentUsed: boolean;
    expertJudgmentBasis?: string;
  };
  uncertaintyCharacterization?: {
    riskSignificant: boolean;
    method: string;
    probabilisticRepresentationProvided: boolean;
  };
  sensitivityStudies?: SensitivityStudy[];
  implementsSrs: SRReference[];
}

export interface InitiatingEventScreeningRecord {
  initiatorOrGroupId: string;
  retained: boolean;
  criterion?: "SCR-1" | "SCR-2" | "SCR-3";
  barrierIntegrityPreconditionMet: boolean;
  justification: string;
  implementsSrs: SRReference[];
}

export interface HazardAnalysis extends Unique, Named {
  description: string;
  hazardType: "INTERNAL" | "EXTERNAL";
  subcategory: string;
  severityLevels: string[];
  affectedAreas: string[];
  radionuclideBarrierIds: RadionuclideBarrierReference[];
  inducingMechanisms: string[];
  inducedInitiatorIds: string[];
  potentialCombinations: string[];
  analysisMethods: string[];
  screeningStatus: ScreeningStatus;
  screeningBasis: string;
  implementsSrs: SRReference[];
}

export interface IeCompletenessSearch {
  functionalCategoriesCovered: InitiatingEventCategory[];
  perSystemSearchPerformed: boolean;
  perSupportSystemSearchPerformed: boolean;
  multipleFailureInitiatorsIncluded: boolean;
  temporaryAlignmentsConsidered: boolean;
  multiReactorEventsAddressed: boolean;
  radioactiveSourceMechanismsAddressed: boolean;
  implementsSrs: SRReference[];
}

export interface IeDocumentation {
  processDescription: string;
  inputSources: string;
  appliedMethods: string;
  resultsSummary: string;
  functionalCategoriesConsidered: string;
  plantUniqueInitiatorsSearch: string;
  stateSpecificInitiatorsSearch: string;
  rcbFailureSearch: string;
  completenessAssessment: string;
  groupingProcessAndBasis: string;
  screeningProcessAndBasis: string;
  frequencyDerivation: string;
  quantificationApproach: string;
  dataSourceJustification: string;
  modelUncertaintySources: string;
  asBuiltLimitations: string;
  praTaskInterfaces: string;
  implementsSrs: SRReference[];
}

export interface InitiatingEventsAnalysis
  extends TechnicalElement<TechnicalElementTypes.INITIATING_EVENT_ANALYSIS> {
  praScope: string;
  includesNonInternalHazardGroups: boolean;
  applicablePlantOperatingStates: PlantOperatingStateReference[];

  initiators: InitiatorDefinition[];
  hazardInducedInitiators?: HazardInducedInitiator[];
  initiatingEventGroups: InitiatingEventGroup[];

  completenessSearch: IeCompletenessSearch;
  sourceMechanisms: SourceEscapeMechanism[];
  identificationReviews: IdentificationReview[];
  plantRepresentationAccuracy: PlantRepresentationAccuracy;
  hazardAnalyses?: HazardAnalysis[];

  quantifications: InitiatingEventFrequencyQuantification[];
  screeningRecords: InitiatingEventScreeningRecord[];

  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];
  documentation: IeDocumentation;

  configurationControlRecordId?: string;
  newlyDevelopedMethodIds?: string[];
}

export const IE_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  "IE-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-A3": { hlr: "A", stages: ["OPERATIONAL"] },
  "IE-A4": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "IE-A5": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-A6": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-A7": { hlr: "A", stages: ["OPERATIONAL"] },
  "IE-A8": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-A9": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-A10": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-A11": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-A12": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-A13": { hlr: "A", stages: ["OPERATIONAL"] },
  "IE-A14": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "IE-A15": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-A16": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-A17": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-A18": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "IE-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-B3": { hlr: "B", stages: ["PRE_OPERATIONAL"] },
  "IE-B4": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-B5": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-B6": { hlr: "B", stages: ["PRE_OPERATIONAL"] },
  "IE-C1": { hlr: "C", stages: ["OPERATIONAL"] },
  "IE-C2": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "IE-C3": { hlr: "C", stages: ["OPERATIONAL"] },
  "IE-C4": { hlr: "C", stages: ["OPERATIONAL"] },
  "IE-C5": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "IE-C6": { hlr: "C", stages: ["OPERATIONAL"] },
  "IE-C7": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "IE-C8": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-C9": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-C10": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-C11": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-C12": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-C13": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-C14": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-C15": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-C16": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-C17": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-C18": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-C19": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-D1": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-D2": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "IE-D3": { hlr: "D", stages: ["PRE_OPERATIONAL"] },
};
