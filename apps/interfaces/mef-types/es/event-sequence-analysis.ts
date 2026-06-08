import { Unique, Named } from "../core/meta";
import { Frequency, FrequencyWithDistribution, EndState } from "../core/events";
import { ImportanceLevel, SensitivityStudy, ScreeningStatus, SuccessCriteriaId } from "../core/shared-patterns";
import { BaseModelUncertaintyDocumentation, PreOperationalAssumption, PlantRepresentationAccuracy } from "../core/documentation";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type PlantOperatingStateReference = string;
export type InitiatingEventReference = string;
export type SuccessCriteriaReference = string;
export type SystemReference = string;
export type ComponentReference = string;
export type HumanActionReference = string;
export type SourceTermReference = string;
export type ReleaseCategoryReference = string;
export type EventSequenceReference = string;
export type EventSequenceFamilyReference = string;
export type SequenceDesignatorId = string;

export type SystemStatus = "SUCCESS" | "FAILURE";

export enum DependencyType {
  FUNCTIONAL = "FUNCTIONAL",
  PHYSICAL = "PHYSICAL",
  HUMAN = "HUMAN",
  OPERATIONAL = "OPERATIONAL",
  PHENOMENOLOGICAL = "PHENOMENOLOGICAL",
  COMMON_CAUSE = "COMMON_CAUSE",
}

export enum BarrierImpactState {
  INTACT = "INTACT",
  BREACHED = "BREACHED",
  DEGRADED = "DEGRADED",
  BYPASSED = "BYPASSED",
  OPEN = "OPEN",
}

export interface TimeWindow {
  startTime: number;
  endTime: number;
  description?: string;
  basis?: string;
  deterministicAnalysisReferences?: string[];
}

export interface SequenceTiming extends Unique {
  event: string;
  timeAfterInitiator: number;
  duration?: number;
  timeWindow?: TimeWindow;
  basis?: string;
  deterministicAnalysisReferences?: string[];
  uncertaintyRange?: [number, number];
}

export interface Dependency extends Unique {
  dependentElement: SystemReference | HumanActionReference;
  dependedUponElement: SystemReference | HumanActionReference;
  dependencyType: DependencyType;
  description: string;
  basis?: string;
  applicablePlantOperatingStates?: PlantOperatingStateReference[];
  applicableInitiatingEvents?: InitiatingEventReference[];
  timePhased?: boolean;
  importanceLevel?: ImportanceLevel;
  implementsSrs: SRReference[];
}

export interface PhenomenologicalImpact extends Unique, Named {
  description: string;
  affectedElements: (SystemReference | HumanActionReference)[];
  timing?: number;
  duration?: number;
  deterministicAnalysisReferences?: string[];
  applicablePlantOperatingStates?: PlantOperatingStateReference[];
  applicableInitiatingEvents?: InitiatingEventReference[];
  importanceLevel?: ImportanceLevel;
  implementsSrs: SRReference[];
}

export interface IntermediateEndState extends Unique, Named {
  description: string;
  transferToEventTreeId?: string;
  transferToEventTreeBranch?: string;
  parentSequenceId?: EventSequenceReference;
  parentSequenceFamilyId?: EventSequenceFamilyReference;
  sourceEventTreeId?: string;
  plantConditions: {
    operatingMode?: "POWER" | "STARTUP" | "SHUTDOWN" | "REFUELING" | "MAINTENANCE";
    keyParameters: Record<string, string | number>;
    systemStatuses?: Record<SystemReference, SystemStatus>;
    barrierStatuses?: Record<string, BarrierImpactState>;
    successCriteriaIds?: SuccessCriteriaId[];
  };
  transferConditions?: {
    description: string;
    logicExpression?: string;
    triggeringEvents?: string[];
  };
  preservedDependencies: {
    functional?: string[];
    system?: SystemReference[];
    initiatingEvent?: InitiatingEventReference[];
    operator?: HumanActionReference[];
    phenomenological?: string[];
    spatial?: string[];
  };
  supportingAnalysisReferences?: string[];
  implementsSrs: SRReference[];
}

export interface EventSequence extends Unique, Named {
  description?: string;
  initiatingEventId: InitiatingEventReference;
  plantOperatingStateId: PlantOperatingStateReference;
  eventTreeId?: string;
  eventTreeSequenceId?: string;
  functionalEventStates?: Record<string, SystemStatus>;
  progression?: string;
  systemResponses?: Record<SystemReference, SystemStatus>;
  operatorActions?: HumanActionReference[];
  procedureReferences?: string[];
  timing?: SequenceTiming[];
  dependencies?: Dependency[];
  phenomenologicalImpacts?: PhenomenologicalImpact[];
  intermediateEndStates?: IntermediateEndState[];
  endState: EndState;
  affectedReactorSourceCombinations?: string[];
  sequenceFamilyId?: EventSequenceFamilyReference;
  releaseCategoryId?: ReleaseCategoryReference;
  successCriteriaIds?: SuccessCriteriaId[];
  meanFrequency?: Frequency | FrequencyWithDistribution;
  screeningStatus?: ScreeningStatus;
  screeningBasis?: string;
  sequenceSpecificAssumptions?: PreOperationalAssumption[];
  implementsSrs: SRReference[];
}

export interface SequenceDesignator extends Unique {
  designatorId: SequenceDesignatorId;
  eventSequenceId: EventSequenceReference;
  meanFrequency?: Frequency | FrequencyWithDistribution;
  description?: string;
}

export interface GroupingCriteria extends Unique, Named {
  description: string;
  basis?: string;
  characteristicsConsidered: string[];
  limitations?: string[];
}

export interface EventSequenceFamily extends Unique, Named {
  description?: string;
  groupingCriteriaId: string;
  representativeInitiatingEventId: InitiatingEventReference;
  representativePlantOperatingStateId: PlantOperatingStateReference;
  representativePlantResponse: string;
  representativeSourceTermId?: SourceTermReference;
  releaseCategoryIds?: ReleaseCategoryReference[];
  memberSequenceIds: EventSequenceReference[];
  similarityBasis?: string;
  endState: EndState;
  meanFrequency?: Frequency | FrequencyWithDistribution;
  familySpecificAssumptions?: PreOperationalAssumption[];
  implementsSrs: SRReference[];
}

export interface ReleaseCategoryMapping extends Unique {
  eventSequenceIds: EventSequenceReference[];
  releaseCategoryId: ReleaseCategoryReference;
  sourceTermId?: SourceTermReference;
  mappingBasis: string;
  commonCharacteristics: string[];
  physicalReleaseCharacteristics: string[];
  supportingAnalysisReferences?: string[];
  meanFrequency?: Frequency | FrequencyWithDistribution;
  processedByRiskIntegration?: boolean;
  implementsSrs: SRReference[];
}

export interface FunctionalDependencyModel extends Unique, Named {
  description: string;
  involvedSystems: SystemReference[];
  dependencies: Dependency[];
  logicModel?: string;
  supportingAnalysisReferences?: string[];
  implementsSrs: SRReference[];
}

export interface PhenomenologicalDependencyModel extends Unique, Named {
  description: string;
  phenomenon: string;
  affectedSystems: SystemReference[];
  environmentalConditions?: string[];
  systemSpecificImpacts?: Record<SystemReference, string>;
  deterministicAnalysisReferences?: string[];
  implementsSrs: SRReference[];
}

export interface OperationalDependencyModel extends Unique, Named {
  description: string;
  operationalPractice: string;
  affectedSystems: SystemReference[];
  involvedHumanActions?: HumanActionReference[];
  procedureReferences?: string[];
  implementsSrs: SRReference[];
}

export interface HumanDependencyModel extends Unique, Named {
  description: string;
  involvedHumanActions: HumanActionReference[];
  affectedSystems?: SystemReference[];
  dependencyType: string;
  hraReferences?: string[];
  implementsSrs: SRReference[];
}

export interface SystemInterfaceDependency extends Unique, Named {
  description: string;
  involvedSystems: SystemReference[];
  interfaceType: "PHYSICAL" | "FUNCTIONAL" | "OPERATIONAL";
  connectionPoints?: string[];
  modelingApproach: string;
  implementsSrs: SRReference[];
}

export interface DependencyModels {
  functionalDependencies?: FunctionalDependencyModel[];
  phenomenologicalDependencies?: PhenomenologicalDependencyModel[];
  operationalDependencies?: OperationalDependencyModel[];
  humanDependencies?: HumanDependencyModel[];
  systemInterfaces?: SystemInterfaceDependency[];
}

export interface FunctionalEvent extends Unique, Named {
  label?: string;
  order?: number;
  description?: string;
  systemReference?: SystemReference;
  humanActionReference?: HumanActionReference;
  faultTreeId?: string;
}

export interface EventTreePath {
  state: SystemStatus;
  target: string;
  targetType: "BRANCH" | "SEQUENCE" | "END_STATE";
  description?: string;
}

export interface EventTreeBranch extends Unique, Named {
  label?: string;
  functionalEventId?: string;
  paths: EventTreePath[];
  instructions?: string[];
}

export interface EventTreeSequence extends Unique, Named {
  label?: string;
  endState?: EndState;
  instructions?: string[];
  eventSequenceId?: EventSequenceReference;
  functionalEventStates?: Record<string, SystemStatus>;
}

export interface EventTreeTransfer {
  targetEventTreeId: string;
  transferConditions?: string[];
  preservedDependencies?: string[];
}

export interface EventTree extends Unique, Named {
  label?: string;
  initiatingEventId: InitiatingEventReference;
  plantOperatingStateId?: PlantOperatingStateReference;
  functionalEvents: Record<string, FunctionalEvent>;
  sequences: Record<string, EventTreeSequence>;
  branches: Record<string, EventTreeBranch>;
  initialState: {
    branchId: string;
  };
  transfers?: Record<string, EventTreeTransfer>;
  description?: string;
  missionTime?: number;
  missionTimeUnits?: string;
  implementsSrs: SRReference[];
}

export interface RepairCreditRecord extends Unique {
  eventSequenceId: EventSequenceReference;
  repairCredited: boolean;
  conservativeRepairBasis?: string;
  riskSignificantReviewPerformed?: boolean;
  justification: string;
  implementsSrs: SRReference[];
}

export interface EventSequenceScreeningRecord {
  sequenceId: EventSequenceReference;
  retained: boolean;
  criterion?: "SCR-1" | "SCR-2" | "SCR-3";
  justification: string;
  implementsSrs: SRReference[];
}

export interface EventSequenceDocumentation {
  processDescription: string;
  posInitiatorSequenceLinkage: string;
  successCriteriaBases: string;
  keySafetyFunctionsIdentification: string;
  sequenceDelineation: string;
  dependencyTreatment: string;
  endStateAndReleaseCategoryDefinitions: string;
  operatorActionsRepresentation: string;
  deterministicAnalysesUsed: string;
  plantResponseAnalysisBasis: string;
  intermediateEndStatesAndTransfers: string;
  screeningProcessAndBasis: string;
  modelUncertaintySources: string;
  asBuiltLimitations: string;
  praTaskInterfaces: string;
  implementsSrs: SRReference[];
}

export interface EventSequenceAnalysis
  extends TechnicalElement<TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS> {
  praScope: string;

  scopeDefinition: {
    plantOperatingStateIds: PlantOperatingStateReference[];
    initiatingEventIds: InitiatingEventReference[];
    radioactiveMaterialSources: string[];
    radionuclideBarriers: string[];
  };
  keySafetyFunctions: string[];

  eventSequences: EventSequence[];
  sequenceDesignators?: SequenceDesignator[];
  groupingCriteria?: GroupingCriteria[];
  eventSequenceFamilies: EventSequenceFamily[];
  intermediateEndStates?: IntermediateEndState[];

  eventTrees?: EventTree[];

  dependencyModels?: DependencyModels;
  releaseCategoryMappings?: ReleaseCategoryMapping[];

  screeningRecords: EventSequenceScreeningRecord[];
  repairCreditRecords?: RepairCreditRecord[];

  plantResponseAnalysisApproach?: "GENERIC" | "REALISTIC_DESIGN_SPECIFIC" | "REALISTIC_SIMILAR_PLANT";
  plantResponseAnalysisAccuracy: PlantRepresentationAccuracy;
  plantDamageStatesUsed?: boolean;
  plantDamageStateDefinitions?: string[];

  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];
  sensitivityStudies?: SensitivityStudy[];
  plantResponseAnalysisReferences?: string[];

  documentation: EventSequenceDocumentation;

  configurationControlRecordId?: string;
  newlyDevelopedMethodIds?: string[];
}

export const ES_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  "ES-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-A4": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-A5": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-A6": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-A7": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-A8": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-A9": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-A10": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-A11": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-A12": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-A13": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-A14": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-A15": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "ES-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-B3": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-B4": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-B5": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-B6": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-B7": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-B8": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-B9": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-B10": { hlr: "B", stages: ["PRE_OPERATIONAL"] },
  "ES-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-C2": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-C3": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-C4": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-C5": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-C6": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-C7": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-C8": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "ES-C9": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-C10": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-C11": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "ES-D1": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-D2": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "ES-D3": { hlr: "D", stages: ["PRE_OPERATIONAL"] },
};
