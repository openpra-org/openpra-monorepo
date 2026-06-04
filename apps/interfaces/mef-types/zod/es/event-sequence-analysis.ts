import { z } from "zod";
import { BarrierImpactState, DependencyType, EndState } from "../../es/event-sequence-analysis";
import type { EventSequenceAnalysis } from "../../es/event-sequence-analysis";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { FrequencySchema, FrequencyWithDistributionSchema } from "../core/events";
import {
  ImportanceLevelSchema,
  ScreeningStatusSchema,
  SensitivityStudySchema,
  SuccessCriteriaIdSchema,
} from "../core/shared-patterns";
import {
  BaseModelUncertaintyDocumentationSchema,
  PlantRepresentationAccuracySchema,
  PreOperationalAssumptionSchema,
} from "../core/documentation";
import { SRReferenceSchema } from "../core/pra-common";

export const EndStateSchema = z.enum(EndState);
export const DependencyTypeSchema = z.enum(DependencyType);
export const EsBarrierImpactStateSchema = z.enum(BarrierImpactState);
export const EsSystemStatusSchema = z.enum(["SUCCESS", "FAILURE"]);

const FrequencyValueSchema = z.union([FrequencySchema, FrequencyWithDistributionSchema]);

export const TimeWindowSchema = z.object({
  startTime: z.number(),
  endTime: z.number(),
  description: z.string().optional(),
  basis: z.string().optional(),
  deterministicAnalysisReferences: z.array(z.string()).optional(),
});

export const SequenceTimingSchema = z.object({
  uuid: z.string(),
  event: z.string(),
  timeAfterInitiator: z.number(),
  duration: z.number().optional(),
  timeWindow: TimeWindowSchema.optional(),
  basis: z.string().optional(),
  deterministicAnalysisReferences: z.array(z.string()).optional(),
  uncertaintyRange: z.tuple([z.number(), z.number()]).optional(),
});

export const DependencySchema = z.object({
  uuid: z.string(),
  dependentElement: z.string(),
  dependedUponElement: z.string(),
  dependencyType: DependencyTypeSchema,
  description: z.string(),
  basis: z.string().optional(),
  applicablePlantOperatingStates: z.array(z.string()).optional(),
  applicableInitiatingEvents: z.array(z.string()).optional(),
  timePhased: z.boolean().optional(),
  importanceLevel: ImportanceLevelSchema.optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PhenomenologicalImpactSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  affectedElements: z.array(z.string()),
  timing: z.number().optional(),
  duration: z.number().optional(),
  deterministicAnalysisReferences: z.array(z.string()).optional(),
  applicablePlantOperatingStates: z.array(z.string()).optional(),
  applicableInitiatingEvents: z.array(z.string()).optional(),
  importanceLevel: ImportanceLevelSchema.optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const IntermediateEndStateSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  transferToEventTreeId: z.string().optional(),
  transferToEventTreeBranch: z.string().optional(),
  parentSequenceId: z.string().optional(),
  parentSequenceFamilyId: z.string().optional(),
  sourceEventTreeId: z.string().optional(),
  plantConditions: z.object({
    operatingMode: z.enum(["POWER", "STARTUP", "SHUTDOWN", "REFUELING", "MAINTENANCE"]).optional(),
    keyParameters: z.record(z.string(), z.union([z.string(), z.number()])),
    systemStatuses: z.record(z.string(), EsSystemStatusSchema).optional(),
    barrierStatuses: z.record(z.string(), EsBarrierImpactStateSchema).optional(),
    successCriteriaIds: z.array(SuccessCriteriaIdSchema).optional(),
  }),
  transferConditions: z
    .object({
      description: z.string(),
      logicExpression: z.string().optional(),
      triggeringEvents: z.array(z.string()).optional(),
    })
    .optional(),
  preservedDependencies: z.object({
    functional: z.array(z.string()).optional(),
    system: z.array(z.string()).optional(),
    initiatingEvent: z.array(z.string()).optional(),
    operator: z.array(z.string()).optional(),
    phenomenological: z.array(z.string()).optional(),
    spatial: z.array(z.string()).optional(),
  }),
  supportingAnalysisReferences: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EventSequenceSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  initiatingEventId: z.string(),
  plantOperatingStateId: z.string(),
  eventTreeId: z.string().optional(),
  eventTreeSequenceId: z.string().optional(),
  functionalEventStates: z.record(z.string(), EsSystemStatusSchema).optional(),
  progression: z.string().optional(),
  systemResponses: z.record(z.string(), EsSystemStatusSchema).optional(),
  operatorActions: z.array(z.string()).optional(),
  procedureReferences: z.array(z.string()).optional(),
  timing: z.array(SequenceTimingSchema).optional(),
  dependencies: z.array(DependencySchema).optional(),
  phenomenologicalImpacts: z.array(PhenomenologicalImpactSchema).optional(),
  intermediateEndStates: z.array(IntermediateEndStateSchema).optional(),
  endState: EndStateSchema,
  affectedReactorSourceCombinations: z.array(z.string()).optional(),
  sequenceFamilyId: z.string().optional(),
  releaseCategoryId: z.string().optional(),
  successCriteriaIds: z.array(SuccessCriteriaIdSchema).optional(),
  meanFrequency: FrequencyValueSchema.optional(),
  screeningStatus: ScreeningStatusSchema.optional(),
  screeningBasis: z.string().optional(),
  sequenceSpecificAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SequenceDesignatorSchema = z.object({
  uuid: z.string(),
  designatorId: z.string(),
  eventSequenceId: z.string(),
  meanFrequency: FrequencyValueSchema.optional(),
  description: z.string().optional(),
});

export const GroupingCriteriaSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  basis: z.string().optional(),
  characteristicsConsidered: z.array(z.string()),
  limitations: z.array(z.string()).optional(),
});

export const EventSequenceFamilySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  groupingCriteriaId: z.string(),
  representativeInitiatingEventId: z.string(),
  representativePlantOperatingStateId: z.string(),
  representativePlantResponse: z.string(),
  representativeSourceTermId: z.string().optional(),
  releaseCategoryIds: z.array(z.string()).optional(),
  memberSequenceIds: z.array(z.string()),
  similarityBasis: z.string().optional(),
  endState: EndStateSchema,
  meanFrequency: FrequencyValueSchema.optional(),
  familySpecificAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ReleaseCategoryMappingSchema = z.object({
  uuid: z.string(),
  eventSequenceIds: z.array(z.string()),
  releaseCategoryId: z.string(),
  sourceTermId: z.string().optional(),
  mappingBasis: z.string(),
  commonCharacteristics: z.array(z.string()),
  physicalReleaseCharacteristics: z.array(z.string()),
  supportingAnalysisReferences: z.array(z.string()).optional(),
  meanFrequency: FrequencyValueSchema.optional(),
  processedByRiskIntegration: z.boolean().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const FunctionalDependencyModelSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  involvedSystems: z.array(z.string()),
  dependencies: z.array(DependencySchema),
  logicModel: z.string().optional(),
  supportingAnalysisReferences: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PhenomenologicalDependencyModelSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  phenomenon: z.string(),
  affectedSystems: z.array(z.string()),
  environmentalConditions: z.array(z.string()).optional(),
  systemSpecificImpacts: z.record(z.string(), z.string()).optional(),
  deterministicAnalysisReferences: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const OperationalDependencyModelSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  operationalPractice: z.string(),
  affectedSystems: z.array(z.string()),
  involvedHumanActions: z.array(z.string()).optional(),
  procedureReferences: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HumanDependencyModelSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  involvedHumanActions: z.array(z.string()),
  affectedSystems: z.array(z.string()).optional(),
  dependencyType: z.string(),
  hraReferences: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SystemInterfaceDependencySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  involvedSystems: z.array(z.string()),
  interfaceType: z.enum(["PHYSICAL", "FUNCTIONAL", "OPERATIONAL"]),
  connectionPoints: z.array(z.string()).optional(),
  modelingApproach: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const DependencyModelsSchema = z.object({
  functionalDependencies: z.array(FunctionalDependencyModelSchema).optional(),
  phenomenologicalDependencies: z.array(PhenomenologicalDependencyModelSchema).optional(),
  operationalDependencies: z.array(OperationalDependencyModelSchema).optional(),
  humanDependencies: z.array(HumanDependencyModelSchema).optional(),
  systemInterfaces: z.array(SystemInterfaceDependencySchema).optional(),
});

export const FunctionalEventSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  label: z.string().optional(),
  order: z.number().optional(),
  description: z.string().optional(),
  systemReference: z.string().optional(),
  humanActionReference: z.string().optional(),
  faultTreeId: z.string().optional(),
});

export const EventTreePathSchema = z.object({
  state: EsSystemStatusSchema,
  target: z.string(),
  targetType: z.enum(["BRANCH", "SEQUENCE", "END_STATE"]),
  description: z.string().optional(),
});

export const EventTreeBranchSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  label: z.string().optional(),
  functionalEventId: z.string().optional(),
  paths: z.array(EventTreePathSchema),
  instructions: z.array(z.string()).optional(),
});

export const EventTreeSequenceSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  label: z.string().optional(),
  endState: EndStateSchema.optional(),
  instructions: z.array(z.string()).optional(),
  eventSequenceId: z.string().optional(),
  functionalEventStates: z.record(z.string(), EsSystemStatusSchema).optional(),
});

export const EventTreeTransferSchema = z.object({
  targetEventTreeId: z.string(),
  transferConditions: z.array(z.string()).optional(),
  preservedDependencies: z.array(z.string()).optional(),
});

export const EventTreeSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  label: z.string().optional(),
  initiatingEventId: z.string(),
  plantOperatingStateId: z.string().optional(),
  functionalEvents: z.record(z.string(), FunctionalEventSchema),
  sequences: z.record(z.string(), EventTreeSequenceSchema),
  branches: z.record(z.string(), EventTreeBranchSchema),
  initialState: z.object({
    branchId: z.string(),
  }),
  transfers: z.record(z.string(), EventTreeTransferSchema).optional(),
  missionTime: z.number().optional(),
  missionTimeUnits: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RepairCreditRecordSchema = z.object({
  uuid: z.string(),
  eventSequenceId: z.string(),
  repairCredited: z.boolean(),
  conservativeRepairBasis: z.string().optional(),
  riskSignificantReviewPerformed: z.boolean().optional(),
  justification: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EventSequenceScreeningRecordSchema = z.object({
  sequenceId: z.string(),
  retained: z.boolean(),
  criterion: z.enum(["SCR-1", "SCR-2", "SCR-3"]).optional(),
  justification: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EventSequenceDocumentationSchema = z.object({
  processDescription: z.string(),
  posInitiatorSequenceLinkage: z.string(),
  successCriteriaBases: z.string(),
  keySafetyFunctionsIdentification: z.string(),
  sequenceDelineation: z.string(),
  dependencyTreatment: z.string(),
  endStateAndReleaseCategoryDefinitions: z.string(),
  operatorActionsRepresentation: z.string(),
  deterministicAnalysesUsed: z.string(),
  plantResponseAnalysisBasis: z.string(),
  intermediateEndStatesAndTransfers: z.string(),
  screeningProcessAndBasis: z.string(),
  modelUncertaintySources: z.string(),
  asBuiltLimitations: z.string(),
  praTaskInterfaces: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EventSequenceAnalysisSchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS).shape,
  praScope: z.string(),
  scopeDefinition: z.object({
    plantOperatingStateIds: z.array(z.string()),
    initiatingEventIds: z.array(z.string()),
    radioactiveMaterialSources: z.array(z.string()),
    radionuclideBarriers: z.array(z.string()),
  }),
  keySafetyFunctions: z.array(z.string()),
  eventSequences: z.array(EventSequenceSchema),
  sequenceDesignators: z.array(SequenceDesignatorSchema).optional(),
  groupingCriteria: z.array(GroupingCriteriaSchema).optional(),
  eventSequenceFamilies: z.array(EventSequenceFamilySchema),
  intermediateEndStates: z.array(IntermediateEndStateSchema).optional(),
  eventTrees: z.array(EventTreeSchema).optional(),
  dependencyModels: DependencyModelsSchema.optional(),
  releaseCategoryMappings: z.array(ReleaseCategoryMappingSchema).optional(),
  screeningRecords: z.array(EventSequenceScreeningRecordSchema),
  repairCreditRecords: z.array(RepairCreditRecordSchema).optional(),
  plantResponseAnalysisApproach: z
    .enum(["GENERIC", "REALISTIC_DESIGN_SPECIFIC", "REALISTIC_SIMILAR_PLANT"])
    .optional(),
  plantResponseAnalysisAccuracy: PlantRepresentationAccuracySchema,
  plantDamageStatesUsed: z.boolean().optional(),
  plantDamageStateDefinitions: z.array(z.string()).optional(),
  modelUncertainty: BaseModelUncertaintyDocumentationSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  sensitivityStudies: z.array(SensitivityStudySchema).optional(),
  plantResponseAnalysisReferences: z.array(z.string()).optional(),
  documentation: EventSequenceDocumentationSchema,
  configurationControlRecordId: z.string().optional(),
  newlyDevelopedMethodIds: z.array(z.string()).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertEsMirrorsType = Expect<Equal<z.infer<typeof EventSequenceAnalysisSchema>, EventSequenceAnalysis>>;
