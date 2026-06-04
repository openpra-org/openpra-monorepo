import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { InitiatingEvent, BaseEvent, Frequency, FrequencyUnit } from "../core/events";
import {
  IdPatterns,
  ImportanceLevel,
  SensitivityStudy,
  ScreeningStatus,
  ScreeningCriteria,
  SuccessCriteriaId,
} from "../core/shared-patterns";
import { PlantOperatingStateReference } from "../initiating-event-analysis/initiating-event-analysis";
import { DistributionType } from "../data-analysis/data-analysis";
import {
  BaseDesignInformation,
  BaseProcessDocumentation,
  BaseModelUncertaintyDocumentation,
  BasePreOperationalAssumptionsDocumentation,
  BasePeerReviewDocumentation,
  BaseTraceabilityDocumentation,
  BaseAssumption,
  PreOperationalAssumption,
} from "../core/documentation";
import { ComponentReference } from "../core/component";
import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";
interface SuccessCriterion extends Unique, Named {
  description?: string;
  criteriaText: string[];
  engineeringBasisReferences: string[];
  plantOperatingStateReferences?: string[];
  initiatingEventReferences?: string[];
  endState?: string;
}
interface OverallSuccessCriteriaDefinition extends Unique {
  eventSequenceReference: string;
  description: string;
  criteria: string[];
  endStateParameters: Record<string, string>;
  keySafetyFunctions: string[];
  radionuclideBarriers: string[];
  engineeringBasisReferences: string[];
  applicablePlantOperatingStates?: string[];
  isRiskSignificant?: boolean;
  usesRealisticCriteria?: boolean;
}
interface SystemSuccessCriteriaDefinition extends Unique {
  systemId: string;
  description: string;
  requiredCapacities: {
    parameter: string;
    value: string;
    basis: string;
  }[];
  systemDependencies?: {
    systemId: string;
    description: string;
  }[];
}
interface ComponentSuccessCriteriaDefinition extends Unique {
  componentId: string;
  description: string;
  performanceRequirements: {
    parameter: string;
    value: string;
    basis: string;
  }[];
  dependencies?: {
    componentId: string;
    description: string;
  }[];
}
interface HumanActionSuccessCriteriaDefinition extends Unique {
  humanActionId: string;
  description: string;
  requiredActions: {
    action: string;
    timing: string;
    basis: string;
  }[];
  dependencies?: {
    humanActionId: string;
    description: string;
  }[];
}
export enum EndState {
  SUCCESSFUL_MITIGATION = "SUCCESSFUL_MITIGATION",
  RADIONUCLIDE_RELEASE = "RADIONUCLIDE_RELEASE",
}
export enum DependencyType {
  FUNCTIONAL = "FUNCTIONAL",
  PHYSICAL = "PHYSICAL",
  HUMAN = "HUMAN",
  OPERATIONAL = "OPERATIONAL",
  PHENOMENOLOGICAL = "PHENOMENOLOGICAL",
  COMMON_CAUSE = "COMMON_CAUSE",
}
export type SystemReference = string;
export type HumanActionReference = string;
export type SourceTermReference = string;
export type ReleaseCategoryReference = string;
export type EventSequenceReference = string;
export type EventSequenceFamilyReference = string;
export type SystemStatus = "SUCCESS" | "FAILURE";
export type SequenceDesignatorId = string;
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
  applicablePlantOperatingStates?: string[];
  applicableInitiatingEvents?: string[];
  importanceLevel?: ImportanceLevel;
}
export interface PhenomenologicalImpact extends Unique, Named {
  description: string;
  affectedElements: (SystemReference | HumanActionReference)[];
  timing?: number;
  duration?: number;
  deterministicAnalysisReferences?: string[];
  applicablePlantOperatingStates?: string[];
  applicableInitiatingEvents?: string[];
  importanceLevel?: ImportanceLevel;
}
export interface IntermediateEndState extends Unique, Named {
  description: string;
  transferToEventTree?: string;
  transferToEventTreeBranch?: string;
  parentSequenceId?: EventSequenceReference;
  parentSequenceFamilyId?: EventSequenceFamilyReference;
  sourceEventTreeId?: string;
  plantConditions: {
    operatingMode?: "POWER" | "STARTUP" | "SHUTDOWN" | "REFUELING" | "MAINTENANCE";
    keyParameters: Record<string, string | number>;
    systemStatuses?: Record<SystemReference, SystemStatus>;
    barrierStatuses?: Record<string, "INTACT" | "BREACHED" | "DEGRADED" | "BYPASSED" | "OPEN">;
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
    initiatingEvent?: string[];
    operator?: HumanActionReference[];
    phenomenological?: string[];
    spatial?: string[];
  };
  supportingAnalysisReferences?: string[];
}
export interface EventSequence extends Unique, Named {
  description?: string;
  initiatingEventId: string;
  plantOperatingStateId: PlantOperatingStateReference;
  eventTreeId?: string;
  eventTreeSequenceId?: string;
  functionalEventStates?: Record<string, "SUCCESS" | "FAILURE">;
  designInformation?: EventSequenceDesignInformation[];
  progression?: string;
  systemResponses?: Record<SystemReference, SystemStatus>;
  operatorActions?: HumanActionReference[];
  timing?: SequenceTiming[];
  dependencies?: Dependency[];
  phenomenologicalImpacts?: PhenomenologicalImpact[];
  intermediateEndStates?: IntermediateEndState[];
  endState: EndState;
  sequenceFamilyId?: EventSequenceFamilyReference;
  releaseCategoryId?: ReleaseCategoryReference;
  successCriteriaIds?: SuccessCriteriaId[];
  frequency?: {
    mean: Frequency;
    units: FrequencyUnit;
    distribution?: DistributionType;
    distributionParameters?: Record<string, number>;
  };
  screening?: {
    status: ScreeningStatus;
    screeningBasis?: string;
    screeningJustification?: string;
  };
  sequenceSpecificAssumptions?: Assumption[];
}
export interface SequenceDesignator extends Unique {
  id: SequenceDesignatorId;
  eventSequenceId: EventSequenceReference;
  frequency?: Frequency;
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
  representativeInitiatingEventId: string;
  representativePlantOperatingStateId: PlantOperatingStateReference;
  representativePlantResponse: string;
  representativeSourceTermId?: SourceTermReference;
  releaseCategoryIds?: ReleaseCategoryReference[];
  memberSequenceIds: EventSequenceReference[];
  similarityBasis?: string;
  endState: EndState;
  frequency?: {
    mean: Frequency;
    units: FrequencyUnit;
    distribution?: DistributionType;
    distributionParameters?: Record<string, number>;
  };
  familySpecificAssumptions?: Assumption[];
}
export interface ReleaseCategoryMapping extends Unique {
  eventSequenceIds: EventSequenceReference[];
  releaseCategoryId: ReleaseCategoryReference;
  sourceTermId?: SourceTermReference;
  mappingBasis: string;
  commonCharacteristics: string[];
  supportingAnalysisReferences?: string[];
  frequencyInformation?: {
    mean?: number;
    units?: FrequencyUnit;
    uncertainty?: {
      distribution?: DistributionType;
      parameters?: Record<string, number>;
    };
  };
  processedByRiskIntegration?: boolean;
}
export interface FunctionalDependencyModel extends Unique, Named {
  description: string;
  involvedSystems: SystemReference[];
  dependencies: Dependency[];
  logicModel?: string;
  supportingAnalysisReferences?: string[];
}
export interface PhenomenologicalDependencyModel extends Unique, Named {
  description: string;
  phenomenon: string;
  affectedSystems: SystemReference[];
  environmentalConditions?: string[];
  systemSpecificImpacts?: Record<SystemReference, string>;
  deterministicAnalysisReferences?: string[];
}
export interface OperationalDependencyModel extends Unique, Named {
  description: string;
  operationalPractice: string;
  affectedSystems: SystemReference[];
  involvedHumanActions?: HumanActionReference[];
  procedureReferences?: string[];
}
export interface HumanDependencyModel extends Unique, Named {
  description: string;
  involvedHumanActions: HumanActionReference[];
  affectedSystems?: SystemReference[];
  dependencyType: string;
  hraReferences?: string[];
}
export interface SystemInterfaceDependency extends Unique, Named {
  description: string;
  involvedSystems: SystemReference[];
  interfaceType: "PHYSICAL" | "FUNCTIONAL" | "OPERATIONAL";
  connectionPoints?: string[];
  modelingApproach: string;
}
export interface Assumption extends BaseAssumption {}
export interface ModelUncertainty extends Unique, Named {
  description: string;
  affectedAspects?: ("eventSequenceDefinition" | "dependencies" | "releasePhenomena")[];
  assumptions?: Assumption[];
  reasonableAlternatives?: string[];
  impact?: string;
  addressingPlans?: string;
  characterization?: {
    type: "QUALITATIVE" | "QUANTITATIVE";
    description: string;
    range?: [number, number];
  };
}
export interface ProcessDocumentation extends BaseProcessDocumentation {
  posInitiatorSequenceLinkage?: {
    plantOperatingStateId: string;
    initiatingEventId: string;
    eventSequenceIds: EventSequenceReference[];
    description?: string;
  }[];
  successCriteriaBases?: {
    initiatingEventId: string;
    successCriteriaId: SuccessCriteriaId;
    basis: string;
    systemCapacitiesRequired: string;
    requiredComponents: string;
  }[];
  deterministicAnalyses?: {
    analysisId: string;
    description: string;
    purpose: string;
    results: string;
    applicationInEventSequences: string;
  }[];
  eventSequenceDescriptions?: {
    sequenceOrFamilyId: string;
    timing: string;
    proceduralGuidance: string;
    environmentalImpacts: string;
    dependencies: string;
    endStates: string;
    otherPertinentInformation?: string;
    uncertaintyEvaluation?: string;
  }[];
  barrierTreatmentBasis?: {
    barrierId: string;
    eventSequenceFamilyId: EventSequenceFamilyReference;
    fuelCapabilitiesCredited: string;
    structuralCapabilitiesCredited: string;
    barrierCapacitiesCredited: string;
    endStateAssignmentBasis: string;
  }[];
  failureModeEvaluation?: {
    barrierId: string;
    failureModes: string[];
    degradationMechanisms: string[];
    loadingConditions: string[];
    loadCapabilityAssessment: string;
    uncertaintyImpacts: string;
  }[];
  endStateAndFamilyDefinitions?: {
    id: string;
    definition: string;
    familyDeterminationDetail: string;
    releaseCategoryId?: ReleaseCategoryReference;
    mechanisticSourceTermId?: SourceTermReference;
  }[];
  operatorActionsRepresentation?: {
    humanActionId: HumanActionReference;
    timing: string;
    hraDependencies: string;
  }[];
  releaseInterfaceDescription?: {
    description: string;
    mappingApproach: string;
    sourceTermAssignment: string;
  };
  singleTopEventApproach?: {
    useSingleTopEvent: boolean;
    approachDescription?: string;
    requirementsSatisfactionDescription?: string;
  };
  mitigatingSystemChallenges?: {
    initiatingEventId: string;
    challengedSystems: Record<SystemReference, string>;
    systemImpact: string;
  }[];
  mitigatingSystemDependencies?: {
    mitigatingSystemId: SystemReference;
    systemDependencies: SystemReference[];
    humanActionDependencies: HumanActionReference[];
    dependencyDescription: string;
  }[];
  methodologyDetails?: {
    approachDescription: string;
    modelingTechniques: string[];
    toolsUsed: string[];
    validationApproach: string;
    conformanceToStandards?: string[];
  };
}
export interface ModelUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
  eventSequenceSpecificUncertainties?: {
    eventSequenceId: EventSequenceReference;
    uncertainties: string[];
    sequenceImpact: string;
  }[];
}
export interface PreOperationalAssumptionsDocumentation extends BasePreOperationalAssumptionsDocumentation {
  eventSequenceSpecificAssumptions?: {
    eventSequenceId: EventSequenceReference;
    assumptions: string[];
    modelingImpact: string;
  }[];
}
export interface PeerReviewDocumentation extends BasePeerReviewDocumentation {
  consistencyWithInitiatingEvents?: string;
  reviewerExperience?: string;
  plantSpecificFeaturesRecognition?: string;
  methodologyReview?: {
    peerReviewProcess: string;
    qualificationOfReviewers: string[];
    methodologyAssessment: string;
    findingsAndResolutions?: Record<string, string>;
  };
}
export interface EventSequenceDesignInformation extends BaseDesignInformation {
  supportedAspects: {
    timing?: boolean;
    systemDependencies?: boolean;
    operatorActions?: boolean;
    phenomenologicalImpacts?: boolean;
    successCriteria?: boolean;
  };
  applicationInSequence: string;
  assumptions?: string[];
}
export interface EventSequenceScreeningCriteria extends ScreeningCriteria {
  screened_out_sequences: {
    sequence_id: EventSequenceReference;
    reason: string;
    justification: string;
  }[];
}
export interface FunctionalEvent extends Unique, Named {
  name: string;
  label?: string;
  order?: number;
  description?: string;
  systemReference?: SystemReference;
  humanActionReference?: HumanActionReference;
  faultTreeId?: string;
}
export interface EventTreePath {
  state: "SUCCESS" | "FAILURE";
  target: string;
  targetType: "BRANCH" | "SEQUENCE" | "END_STATE";
  description?: string;
}
export interface EventTreeBranch extends Unique, Named {
  name: string;
  label?: string;
  functionalEventId?: string;
  paths: EventTreePath[];
  instructions?: string[];
}
export interface EventTreeSequence extends Unique, Named {
  name: string;
  label?: string;
  endState?: EndState | string;
  instructions?: string[];
  eventSequenceId?: EventSequenceReference;
  functionalEventStates?: Record<string, "SUCCESS" | "FAILURE">;
}
export interface EventTree extends Unique, Named {
  name: string;
  label?: string;
  initiatingEventId: string;
  plantOperatingStateId?: PlantOperatingStateReference;
  functionalEvents: Record<string, FunctionalEvent>;
  sequences: Record<string, EventTreeSequence>;
  branches: Record<string, EventTreeBranch>;
  initialState: {
    branchId: string;
  };
  transfers?: Record<
    string,
    {
      targetEventTreeId: string;
      transferConditions?: string[];
      preservedDependencies?: string[];
    }
  >;
  description?: string;
  missionTime?: number;
  missionTimeUnits?: string;
}
export interface EventSequenceValidationRules {
  initiatingEventCoverageRules: {
    description: string;
    validationMethod: string;
    requiredElements: string[];
  };
  plantOperatingStateCoverageRules: {
    description: string;
    validationMethod: string;
    requiredElements: string[];
  };
  endStateDefinitionRules: {
    description: string;
    requiredEndStates: string[];
    definitionCriteria: string[];
  };
  dependencyModelingRules: {
    description: string;
    requiredDependencyTypes: string[];
    documentationRequirements: string[];
  };
  releaseCategoryMappingRules: {
    description: string;
    mappingCriteria: string[];
    requiredDocumentation: string[];
  };
}
export interface EventSequenceAnalysis extends TechnicalElement<TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS> {
  additionalMetadata?: {
    traceability?: string;
  };
  scopeDefinition: {
    plantOperatingStateIds: PlantOperatingStateReference[];
    initiatingEventIds: string[];
    radioactiveMaterialSources: string[];
    radionuclideBarriers: string[];
  };
  keySafetyFunctions: string[];
  eventSequences: Record<EventSequenceReference, EventSequence>;
  sequenceDesignators?: Record<string, SequenceDesignator>;
  eventSequenceFamilies: Record<EventSequenceFamilyReference, EventSequenceFamily>;
  intermediateEndStates?: Record<string, IntermediateEndState>;
  releaseCategoryMappings?: ReleaseCategoryMapping[];
  dependencyModels?: {
    functionalDependencies?: FunctionalDependencyModel[];
    phenomenologicalDependencies?: PhenomenologicalDependencyModel[];
    operationalDependencies?: OperationalDependencyModel[];
    humanDependencies?: HumanDependencyModel[];
    systemInterfaces?: SystemInterfaceDependency[];
  };
  modelUncertainties?: ModelUncertainty[];
  sensitivityStudies?: SensitivityStudy[];
  preOperationalAssumptions?: Assumption[];
  plantResponseAnalysisReferences?: string[];
  documentation?: {
    processDocumentation?: ProcessDocumentation;
    modelUncertaintyDocumentation?: ModelUncertaintyDocumentation;
    preOperationalAssumptionsDocumentation?: PreOperationalAssumptionsDocumentation;
    peerReviewDocumentation?: PeerReviewDocumentation;
    traceabilityDocumentation?: BaseTraceabilityDocumentation;
  };
  validationRules?: EventSequenceValidationRules;
  screening_criteria?: EventSequenceScreeningCriteria;
  eventTrees?: Record<string, EventTree>;
}
export const validateEventTree = {
  validateStructure: (eventTree: EventTree): string[] => {
    const errors: string[] = [];
    if (!eventTree.initiatingEventId) {
      errors.push(`Event tree ${eventTree.name} must have an initiating event`);
    }
    if (!eventTree.initialState.branchId) {
      errors.push(`Event tree ${eventTree.name} must have an initial state branch ID`);
    } else if (!eventTree.branches[eventTree.initialState.branchId]) {
      errors.push(
        `Event tree ${eventTree.name} has invalid initial state branch ID: ${eventTree.initialState.branchId}`,
      );
    }
    Object.entries(eventTree.branches).forEach(([branchId, branch]) => {
      branch.paths.forEach((path, index) => {
        const { target, targetType } = path;
        if (targetType === "BRANCH" && !eventTree.branches[target]) {
          errors.push(`Branch ${branchId} path ${index} references non-existent branch: ${target}`);
        } else if (targetType === "SEQUENCE" && !eventTree.sequences[target]) {
          errors.push(`Branch ${branchId} path ${index} references non-existent sequence: ${target}`);
        }
      });
      if (branch.functionalEventId && !eventTree.functionalEvents[branch.functionalEventId]) {
        errors.push(`Branch ${branchId} references non-existent functional event: ${branch.functionalEventId}`);
      }
    });
    const visited = new Set<string>();
    const stack = new Set<string>();
    const checkForCycles = (branchId: string): boolean => {
      if (stack.has(branchId)) {
        errors.push(`Event tree ${eventTree.name} has a cycle involving branch: ${branchId}`);
        return true;
      }
      if (visited.has(branchId)) {
        return false;
      }
      visited.add(branchId);
      stack.add(branchId);
      const branch = eventTree.branches[branchId];
      for (const path of branch.paths) {
        if (path.targetType === "BRANCH" && checkForCycles(path.target)) {
          return true;
        }
      }
      stack.delete(branchId);
      return false;
    };
    checkForCycles(eventTree.initialState.branchId);
    return errors;
  },
  validateEventSequenceIntegrity: (
    eventTree: EventTree,
    sequences: Record<EventSequenceReference, EventSequence>,
  ): string[] => {
    const errors: string[] = [];
    Object.entries(eventTree.sequences).forEach(([seqId, treeSeq]) => {
      if (treeSeq.eventSequenceId) {
        const eventSeq = sequences[treeSeq.eventSequenceId];
        if (eventSeq) {
          if (eventSeq.initiatingEventId !== eventTree.initiatingEventId) {
            errors.push(
              `Inconsistent initiating event: Event tree ${eventTree.name} has initiating event ${eventTree.initiatingEventId} but linked sequence ${eventSeq.name} has initiating event ${eventSeq.initiatingEventId}`,
            );
          }
          if (treeSeq.functionalEventStates && eventSeq.systemResponses) {
            for (const [funcEventId, state] of Object.entries(treeSeq.functionalEventStates)) {
              const funcEvent = eventTree.functionalEvents[funcEventId];
              if (funcEvent?.systemReference) {
                const sysRef = funcEvent.systemReference;
                if (eventSeq.systemResponses[sysRef] && eventSeq.systemResponses[sysRef] !== state) {
                  errors.push(
                    `Inconsistent system state: Event tree sequence ${seqId} has state ${state} for functional event ${funcEventId} (system ${sysRef}) but event sequence ${eventSeq.name} has system response ${eventSeq.systemResponses[sysRef]}`,
                  );
                }
              }
            }
          }
          if (treeSeq.endState && eventSeq.endState !== treeSeq.endState) {
            errors.push(
              `Inconsistent end state: Event tree sequence ${seqId} has end state ${treeSeq.endState} but event sequence ${eventSeq.name} has end state ${eventSeq.endState}`,
            );
          }
          if (treeSeq.functionalEventStates && eventSeq.timing && eventSeq.timing.length > 0) {
          }
        }
      }
    });
    Object.values(sequences).forEach((seq) => {
      if (seq.eventTreeId === eventTree.name && seq.eventTreeSequenceId) {
        if (!eventTree.sequences[seq.eventTreeSequenceId]) {
          errors.push(
            `Event sequence ${seq.name} references non-existent event tree sequence ${seq.eventTreeSequenceId} in event tree ${eventTree.name}`,
          );
        }
      }
    });
    const functionalEventsByOrder = Object.values(eventTree.functionalEvents)
      .filter((fe) => fe.order !== undefined)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return errors;
  },
  validateSequenceCoverage: (
    eventTree: EventTree,
    sequences: Record<EventSequenceReference, EventSequence>,
  ): string[] => {
    const errors: string[] = [];
    Object.entries(eventTree.sequences).forEach(([treeSeqId, treeSeq]) => {
      if (!treeSeq.eventSequenceId) {
        errors.push(`Event tree sequence ${treeSeqId} has no corresponding event sequence reference`);
      } else if (!sequences[treeSeq.eventSequenceId]) {
        errors.push(
          `Event tree sequence ${treeSeqId} references non-existent event sequence ${treeSeq.eventSequenceId}`,
        );
      }
    });
    return errors;
  },
  validateTransfers: (eventTrees: Record<string, EventTree>): string[] => {
    const errors: string[] = [];
    Object.entries(eventTrees).forEach(([treeId, tree]) => {
      if (tree.transfers) {
        Object.entries(tree.transfers).forEach(([transferId, transfer]) => {
          if (!eventTrees[transfer.targetEventTreeId]) {
            errors.push(
              `Event tree ${treeId} transfer ${transferId} references non-existent target event tree: ${transfer.targetEventTreeId}`,
            );
          }
        });
      }
    });
    Object.entries(eventTrees).forEach(([treeId, tree]) => {
      Object.entries(tree.sequences).forEach(([seqId, seq]) => {
        if (seq.eventSequenceId) {
        }
      });
    });
    return errors;
  },
};
