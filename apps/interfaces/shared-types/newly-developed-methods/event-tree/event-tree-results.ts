import { z } from "zod";
import {
  AnalysisRunIdSchema,
  AnalysisRunMetadataSchema,
  WorkbookEntityIdSchema,
  WorkbookMethodSchemaVersionSchema,
  WorkbookModelSnapshotIdentitySchema,
  WorkbookRevisionSchema,
  ValidationIssueSchema,
  ValidationResultSchema,
  EventTreeFrequencySemanticsSchema,
  MethodEntityReferenceSchema,
} from "../shared";
import type {
  AnalysisRunId,
  AnalysisRunMetadata,
  WorkbookEntityId,
  WorkbookMethodSchemaVersion,
  WorkbookModelSnapshotIdentity,
  WorkbookRevision,
  ValidationIssue,
  ValidationResult,
  EventTreeFrequencySemantics,
  MethodEntityReference,
} from "../shared";
import type {
  EventTreeBranchResult,
  EventTreeModel,
  EventTreeSequencePathStep,
} from "./event-tree-model";
import { EventTreeBranchResultSchema, EventTreeModelSchema, EventTreeSequencePathStepSchema } from "./event-tree-schemas";
import {
  EsqEventTreeRunLogicSchema,
  EsqModelCalculationSchema,
  EsqPostRunPurposeSchema,
  EsqUncertaintyCorrelationSchema,
  EventTreeCutSetSettingsSchema,
  EventTreeExecutionModeSchema,
  EventTreeSamplingMethodSchema,
} from "./event-tree-requests";
import type { UncertainExpression, UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import { UncertainExpressionSchema, UncertainUnitSchema } from "interfaces-mef-types/zod/core/uncertainty";
import type {
  EsqEventTreeRunLogic,
  EsqModelCalculation,
  EsqPostRunPurpose,
  EsqUncertaintyCorrelation,
  EventTreeCutSetSettings,
  EventTreeExecutionMode,
  EventTreeSamplingMethod,
} from "./event-tree-requests";
import {
  HclUncertaintySummarySchema,
  HclBridgeStatsSchema, HclJunctionTreeStatsSchema, HclBatchCompilationStatsSchema,
} from "../hybrid-causal-logic/hcl-results";
import type {
  HclUncertaintySummary,
  HclBridgeStats, HclJunctionTreeStats, HclBatchCompilationStats,
} from "../hybrid-causal-logic/hcl-results";

interface EventTreeCreateResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  workbookRevision: WorkbookRevision;
  model: EventTreeModel;
}

interface EventTreePatchResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  workbookRevision: WorkbookRevision;
  model: EventTreeModel;
}

interface EventTreeValidateResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  validation: ValidationResult;
}

interface EventTreeExecuteResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  run: AnalysisRunMetadata;
}

/** Actual sequence compilation and point-pass diagnostics; no UQ/hazard-query counters. */
interface EventTreeSequenceDiagnostics {
  /** Null means an unconditional sequence did not build a BDD. */
  bdd: { nodes: number; variables: number; variableOrder: string[] } | null;
  /** Null means this sequence did not use the HCL bridge. */
  bridge: HclBridgeStats | null;
  /** Shared base network; null for independent evaluation. */
  junctionTree: HclJunctionTreeStats | null;
}

interface EventTreeCutSetSweepPoint {
  cutOff: number;
  count: number;
  probability: number;
  annualFrequency: number;
}

interface EventTreeCutSet {
  order: number;
  probability: number;
  annualFrequency: number;
  basicEventIds: string[];
}

interface EventTreeCutSetFocusItems {
  key: string;
  items: EventTreeCutSet[];
}

interface EventTreeSequenceCutSets {
  count: number;
  failedCount: number;
  distributionByOrder: number[];
  sweep: EventTreeCutSetSweepPoint[];
  items: EventTreeCutSet[];
  focus?: EventTreeCutSetFocusItems[];
}

interface EventTreeFamilyCutSets {
  familyId: string;
  sequenceIds: WorkbookEntityId[];
  count: number;
  sweep: EventTreeCutSetSweepPoint[];
  items: EventTreeCutSet[];
}

interface EventTreeSequenceAnalysisResult {
  sequenceId: WorkbookEntityId;
  /** Source and destination sequences forming this complete transfer path. */
  sequenceChain?: MethodEntityReference[];
  path: EventTreeSequencePathStep[];
  result: EventTreeBranchResult;
  conditionalProbability: number;
  annualFrequency: number;
  diagnostics?: EventTreeSequenceDiagnostics;
  uncertainty?: {
    conditionalProbability: HclUncertaintySummary;
    annualFrequency: HclUncertaintySummary;
  };
  cutSets?: EventTreeSequenceCutSets;
}

interface EventTreeEndStateAggregate {
  endStateId: WorkbookEntityId;
  annualFrequency: number;
  uncertainty?: HclUncertaintySummary;
}

interface EventTreeImportanceChange {
  id: string;
  decrease: number;
  increase: number;
}

interface EventTreeImportanceGroupChange {
  key: string;
  decrease: number;
  increase: number;
}

interface EventTreeImportanceFamily {
  familyId: string;
  base: number;
  events: EventTreeImportanceChange[];
  groups: EventTreeImportanceGroupChange[];
}

interface EventTreeImportanceVariable {
  id: string;
  probability: number;
  ccfGroupId?: string;
  ccfMembers?: string[];
}

interface EventTreeImportanceResult {
  families: EventTreeImportanceFamily[];
  variables: EventTreeImportanceVariable[];
}

interface EventTreeSamplingFamily {
  familyId: string;
  values: number[];
}

interface EventTreeSamplingResult {
  trials: number;
  seed: number;
  method: EventTreeSamplingMethod;
  sampledEvents: number;
  families: EventTreeSamplingFamily[];
}

interface EventTreeAnalysisResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  runId: AnalysisRunId;
  owner: WorkbookModelSnapshotIdentity;
  mode: EventTreeExecutionMode;
  sequences: EventTreeSequenceAnalysisResult[];
  endStateAggregates: EventTreeEndStateAggregate[];
  frequencySemantics?: EventTreeFrequencySemantics;
  compilationReuse?: HclBatchCompilationStats;
  cutSetAnalysis?: EventTreeCutSetSettings;
  families?: EventTreeFamilyCutSets[];
  importance?: EventTreeImportanceResult;
  sampling?: EventTreeSamplingResult;
  validationIssues: ValidationIssue[];
  completedAt: string;
}

type EsqImportanceTargetKind = "EVENT" | "PARAMETER" | "HFE" | "CCF_GROUP" | "SYSTEM";

type EsqImportanceEventRole = "BASIC" | "CCF_TERM" | "RECOVERY" | "JOINT" | "INDEPENDENT_PART" | "SPLIT";

interface EsqImportanceTargetChange {
  familyId: string;
  decrease: number;
  increase: number;
}

interface EsqImportanceTarget {
  id: string;
  kind: EsqImportanceTargetKind;
  role: EsqImportanceEventRole | null;
  label: string;
  ref: string | null;
  probability: number | null;
  changes: EsqImportanceTargetChange[];
}

interface EsqImportanceFamily {
  familyId: string;
  base: number;
  endState: string | null;
}

interface EsqUncertaintyStatistics {
  point: number;
  mean: number;
  standardDeviation: number;
  standardError: number;
  p05: number;
  p50: number;
  p95: number;
}

interface EsqUncertaintyFamily extends EsqUncertaintyStatistics {
  familyId: string;
  endState: string | null;
  values: number[];
}

interface EsqUncertaintyKey {
  key: string;
  label: string;
  source: string;
  expression: UncertainExpression;
  unit: UncertainUnit;
  events: number;
}

interface EsqUncertaintyUnsampled {
  id: string;
  label: string;
  reason: string;
}

type EsqModelRunTreeStatus = "SUCCEEDED" | "FAILED";

interface EsqModelRunSweepPoint {
  cutOff: number;
  count: number;
  annualFrequency: number;
}

interface EsqModelRunTree {
  treeId: string;
  runId: AnalysisRunId;
  status: EsqModelRunTreeStatus;
  initiatorFrequency: number | null;
  failure: string | null;
}

interface EsqModelRunSequence {
  treeId: string;
  sequenceIds: string[];
  familyId: string | null;
  endState: string | null;
  conditionalProbability: number;
  annualFrequency: number;
  cutSetCount: number | null;
}

interface EsqModelRunCutSet {
  treeId: string;
  basicEventIds: string[];
  annualFrequency: number;
}

interface EsqModelRunFamilyState {
  stateId: string;
  annualFrequency: number;
  sweep: EsqModelRunSweepPoint[];
}

interface EsqModelRunFamily {
  familyId: string;
  annualFrequency: number;
  sequenceCount: number;
  cutSetCount: number | null;
  sweep: EsqModelRunSweepPoint[];
  states: EsqModelRunFamilyState[];
  cutSets: EsqModelRunCutSet[];
}

interface EsqModelRunEndState {
  endState: string;
  annualFrequency: number;
}

interface EsqPostCombinationFinding {
  eventIds: string[];
  treeIds: string[];
  cutSetCount: number;
  nominalFrequency: number;
}

interface EsqPostDeletionFinding {
  exclusionId: string;
  treeIds: string[];
  cutSetCount: number;
  nominalFrequency: number;
}

interface EsqPostRunResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  kind: "ESQ_POST_RUN";
  runId: AnalysisRunId;
  owner: WorkbookModelSnapshotIdentity;
  completedAt: string;
  inputs: string;
  purpose: EsqPostRunPurpose;
  cutOff: number;
  raisedHep: number | null;
  logic: EsqEventTreeRunLogic;
  trees: EsqModelRunTree[];
  combinations: EsqPostCombinationFinding[];
  deletions: EsqPostDeletionFinding[];
  eventCodes: Record<string, string>;
}

interface EsqModelRunResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  kind: "ESQ_MODEL_RUN";
  runId: AnalysisRunId;
  owner: WorkbookModelSnapshotIdentity;
  completedAt: string;
  inputs: string;
  calculation: EsqModelCalculation;
  logic: EsqEventTreeRunLogic;
  cutSets: EventTreeCutSetSettings | null;
  trees: EsqModelRunTree[];
  sequences: EsqModelRunSequence[];
  families: EsqModelRunFamily[];
  endStates: EsqModelRunEndState[];
  eventCodes: Record<string, string>;
  peakProbability: number | null;
  caseId?: string;
}

interface EsqImportanceRunResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  kind: "ESQ_IMPORTANCE_RUN";
  runId: AnalysisRunId;
  owner: WorkbookModelSnapshotIdentity;
  completedAt: string;
  inputs: string;
  logic: EsqEventTreeRunLogic;
  trees: EsqModelRunTree[];
  families: EsqImportanceFamily[];
  targets: EsqImportanceTarget[];
  silentEventIds: string[];
}

interface EsqUncertaintyRunResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  kind: "ESQ_UNCERTAINTY_RUN";
  runId: AnalysisRunId;
  owner: WorkbookModelSnapshotIdentity;
  completedAt: string;
  inputs: string;
  logic: EsqEventTreeRunLogic;
  trials: number;
  seed: number;
  method: EventTreeSamplingMethod;
  correlation: EsqUncertaintyCorrelation;
  trees: EsqModelRunTree[];
  families: EsqUncertaintyFamily[];
  total: EsqUncertaintyStatistics | null;
  keys: EsqUncertaintyKey[];
  unsampled: EsqUncertaintyUnsampled[];
}

const EventTreeCreateResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    workbookRevision: WorkbookRevisionSchema,
    model: EventTreeModelSchema,
  })
  .strict();

const EventTreePatchResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    workbookRevision: WorkbookRevisionSchema,
    model: EventTreeModelSchema,
  })
  .strict();

const EventTreeValidateResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    validation: ValidationResultSchema,
  })
  .strict();

const EventTreeExecuteResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    run: AnalysisRunMetadataSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.run.methodType !== "EVENT_TREE") {
      context.addIssue({
        code: "custom",
        path: ["run", "methodType"],
        message: "Event-tree execution runs must use the EVENT_TREE method type",
      });
    }
  });

const ProbabilitySchema = z.number().min(0, "Probability cannot be less than zero").max(1, "Probability cannot exceed one");

const EventTreeSequenceDiagnosticsSchema = z.object({
  bdd: z.object({
    nodes: z.number().int().nonnegative(),
    variables: z.number().int().nonnegative(),
    variableOrder: z.array(z.string().min(1)),
  }).strict().nullable(),
  bridge: HclBridgeStatsSchema.nullable(),
  junctionTree: HclJunctionTreeStatsSchema.nullable(),
}).strict();

const FrequencySchema = z.number().finite().nonnegative("Annual frequency cannot be negative");

const EventTreeCutSetSweepPointSchema = z
  .object({
    cutOff: z.number().finite().positive(),
    count: z.number().int().nonnegative(),
    probability: ProbabilitySchema,
    annualFrequency: FrequencySchema,
  })
  .strict();

const EventTreeCutSetSchema = z
  .object({
    order: z.number().int().nonnegative(),
    probability: ProbabilitySchema,
    annualFrequency: FrequencySchema,
    basicEventIds: z.array(z.string().min(1)),
  })
  .strict();

const EventTreeCutSetFocusItemsSchema = z
  .object({
    key: z.string().min(1),
    items: z.array(EventTreeCutSetSchema),
  })
  .strict();

const EventTreeSequenceCutSetsSchema = z
  .object({
    count: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    distributionByOrder: z.array(z.number().int().nonnegative()),
    sweep: z.array(EventTreeCutSetSweepPointSchema),
    items: z.array(EventTreeCutSetSchema),
    focus: z.array(EventTreeCutSetFocusItemsSchema).optional(),
  })
  .strict();

const EventTreeFamilyCutSetsSchema = z
  .object({
    familyId: z.string().min(1),
    sequenceIds: z.array(WorkbookEntityIdSchema),
    count: z.number().int().nonnegative(),
    sweep: z.array(EventTreeCutSetSweepPointSchema),
    items: z.array(EventTreeCutSetSchema),
  })
  .strict();

const EventTreeSequenceAnalysisResultSchema = z
  .object({
    sequenceId: WorkbookEntityIdSchema,
    sequenceChain: z.array(MethodEntityReferenceSchema).min(2).optional(),
    path: z.array(EventTreeSequencePathStepSchema),
    result: EventTreeBranchResultSchema,
    conditionalProbability: ProbabilitySchema,
    annualFrequency: z.number().nonnegative("Annual frequency cannot be negative"),
    diagnostics: EventTreeSequenceDiagnosticsSchema.optional(),
    uncertainty: z.object({
      conditionalProbability: HclUncertaintySummarySchema,
      annualFrequency: HclUncertaintySummarySchema,
    }).strict().optional(),
    cutSets: EventTreeSequenceCutSetsSchema.optional(),
  })
  .strict();

const EventTreeEndStateAggregateSchema = z
  .object({
    endStateId: WorkbookEntityIdSchema,
    annualFrequency: z.number().nonnegative("Annual frequency cannot be negative"),
    uncertainty: HclUncertaintySummarySchema.optional(),
  })
  .strict();

const ChangeSchema = z.number().finite();

const EventTreeImportanceResultSchema = z
  .object({
    families: z.array(
      z
        .object({
          familyId: z.string().min(1),
          base: FrequencySchema,
          events: z.array(z.object({ id: z.string().min(1), decrease: ChangeSchema, increase: ChangeSchema }).strict()),
          groups: z.array(z.object({ key: z.string().min(1), decrease: ChangeSchema, increase: ChangeSchema }).strict()),
        })
        .strict(),
    ),
    variables: z.array(
      z
        .object({
          id: z.string().min(1),
          probability: ProbabilitySchema,
          ccfGroupId: z.string().min(1).optional(),
          ccfMembers: z.array(z.string().min(1)).optional(),
        })
        .strict(),
    ),
  })
  .strict();

const EventTreeSamplingResultSchema = z
  .object({
    trials: z.number().int().positive(),
    seed: z.number().int().nonnegative(),
    method: EventTreeSamplingMethodSchema,
    sampledEvents: z.number().int().nonnegative(),
    families: z.array(z.object({ familyId: z.string().min(1), values: z.array(FrequencySchema) }).strict()),
  })
  .strict();

const EventTreeAnalysisResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    runId: AnalysisRunIdSchema,
    owner: WorkbookModelSnapshotIdentitySchema,
    mode: EventTreeExecutionModeSchema,
    sequences: z.array(EventTreeSequenceAnalysisResultSchema),
    endStateAggregates: z.array(EventTreeEndStateAggregateSchema),
    frequencySemantics: EventTreeFrequencySemanticsSchema.optional(),
    compilationReuse: HclBatchCompilationStatsSchema.optional(),
    cutSetAnalysis: EventTreeCutSetSettingsSchema.optional(),
    families: z.array(EventTreeFamilyCutSetsSchema).optional(),
    importance: EventTreeImportanceResultSchema.optional(),
    sampling: EventTreeSamplingResultSchema.optional(),
    validationIssues: z.array(ValidationIssueSchema),
    completedAt: z.string().datetime({ offset: true }),
  })
  .strict();

const EsqModelRunSweepPointSchema = z
  .object({
    cutOff: z.number().finite().positive(),
    count: z.number().int().nonnegative(),
    annualFrequency: FrequencySchema,
  })
  .strict();

const EsqModelRunTreeSchema = z
  .object({
    treeId: z.string().min(1),
    runId: AnalysisRunIdSchema,
    status: z.enum(["SUCCEEDED", "FAILED"]),
    initiatorFrequency: FrequencySchema.nullable(),
    failure: z.string().nullable(),
  })
  .strict();

const EsqModelRunSequenceSchema = z
  .object({
    treeId: z.string().min(1),
    sequenceIds: z.array(z.string().min(1)).min(1),
    familyId: z.string().nullable(),
    endState: z.string().nullable(),
    conditionalProbability: ProbabilitySchema,
    annualFrequency: FrequencySchema,
    cutSetCount: z.number().int().nonnegative().nullable(),
  })
  .strict();

const EsqModelRunCutSetSchema = z
  .object({
    treeId: z.string().min(1),
    basicEventIds: z.array(z.string().min(1)),
    annualFrequency: FrequencySchema,
  })
  .strict();

const EsqModelRunFamilyStateSchema = z
  .object({
    stateId: z.string().min(1),
    annualFrequency: FrequencySchema,
    sweep: z.array(EsqModelRunSweepPointSchema),
  })
  .strict();

const EsqModelRunFamilySchema = z
  .object({
    familyId: z.string().min(1),
    annualFrequency: FrequencySchema,
    sequenceCount: z.number().int().nonnegative(),
    cutSetCount: z.number().int().nonnegative().nullable(),
    sweep: z.array(EsqModelRunSweepPointSchema),
    states: z.array(EsqModelRunFamilyStateSchema),
    cutSets: z.array(EsqModelRunCutSetSchema),
  })
  .strict();

const EsqModelRunEndStateSchema = z
  .object({
    endState: z.string().min(1),
    annualFrequency: FrequencySchema,
  })
  .strict();

const EsqPostRunResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    kind: z.literal("ESQ_POST_RUN"),
    runId: AnalysisRunIdSchema,
    owner: WorkbookModelSnapshotIdentitySchema,
    completedAt: z.string().datetime({ offset: true }),
    inputs: z.string().min(1),
    purpose: EsqPostRunPurposeSchema,
    cutOff: z.number().finite().positive(),
    raisedHep: z.number().finite().positive().max(1).nullable(),
    logic: EsqEventTreeRunLogicSchema,
    trees: z.array(EsqModelRunTreeSchema),
    combinations: z.array(
      z
        .object({
          eventIds: z.array(z.string().min(1)).min(2),
          treeIds: z.array(z.string().min(1)),
          cutSetCount: z.number().int().nonnegative(),
          nominalFrequency: FrequencySchema,
        })
        .strict(),
    ),
    deletions: z.array(
      z
        .object({
          exclusionId: z.string().min(1),
          treeIds: z.array(z.string().min(1)),
          cutSetCount: z.number().int().nonnegative(),
          nominalFrequency: FrequencySchema,
        })
        .strict(),
    ),
    eventCodes: z.record(z.string(), z.string()),
  })
  .strict();

const EsqModelRunResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    kind: z.literal("ESQ_MODEL_RUN"),
    runId: AnalysisRunIdSchema,
    owner: WorkbookModelSnapshotIdentitySchema,
    completedAt: z.string().datetime({ offset: true }),
    inputs: z.string().min(1),
    calculation: EsqModelCalculationSchema,
    logic: EsqEventTreeRunLogicSchema,
    cutSets: EventTreeCutSetSettingsSchema.nullable(),
    trees: z.array(EsqModelRunTreeSchema),
    sequences: z.array(EsqModelRunSequenceSchema),
    families: z.array(EsqModelRunFamilySchema),
    endStates: z.array(EsqModelRunEndStateSchema),
    eventCodes: z.record(z.string(), z.string()),
    peakProbability: ProbabilitySchema.nullable(),
    caseId: z.string().min(1).optional(),
  })
  .strict();

const EsqImportanceRunResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    kind: z.literal("ESQ_IMPORTANCE_RUN"),
    runId: AnalysisRunIdSchema,
    owner: WorkbookModelSnapshotIdentitySchema,
    completedAt: z.string().datetime({ offset: true }),
    inputs: z.string().min(1),
    logic: EsqEventTreeRunLogicSchema,
    trees: z.array(EsqModelRunTreeSchema),
    families: z.array(z.object({ familyId: z.string().min(1), base: FrequencySchema, endState: z.string().nullable() }).strict()),
    targets: z.array(
      z
        .object({
          id: z.string().min(1),
          kind: z.enum(["EVENT", "PARAMETER", "HFE", "CCF_GROUP", "SYSTEM"]),
          role: z.enum(["BASIC", "CCF_TERM", "RECOVERY", "JOINT", "INDEPENDENT_PART", "SPLIT"]).nullable(),
          label: z.string().min(1),
          ref: z.string().nullable(),
          probability: ProbabilitySchema.nullable(),
          changes: z.array(z.object({ familyId: z.string().min(1), decrease: ChangeSchema, increase: ChangeSchema }).strict()),
        })
        .strict(),
    ),
    silentEventIds: z.array(z.string().min(1)),
  })
  .strict();

const EsqUncertaintyStatisticsSchema = z
  .object({
    point: FrequencySchema,
    mean: FrequencySchema,
    standardDeviation: FrequencySchema,
    standardError: FrequencySchema,
    p05: FrequencySchema,
    p50: FrequencySchema,
    p95: FrequencySchema,
  })
  .strict();

const EsqUncertaintyRunResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    kind: z.literal("ESQ_UNCERTAINTY_RUN"),
    runId: AnalysisRunIdSchema,
    owner: WorkbookModelSnapshotIdentitySchema,
    completedAt: z.string().datetime({ offset: true }),
    inputs: z.string().min(1),
    logic: EsqEventTreeRunLogicSchema,
    trials: z.number().int().positive(),
    seed: z.number().int().nonnegative(),
    method: EventTreeSamplingMethodSchema,
    correlation: EsqUncertaintyCorrelationSchema,
    trees: z.array(EsqModelRunTreeSchema),
    families: z.array(
      EsqUncertaintyStatisticsSchema.extend({
        familyId: z.string().min(1),
        endState: z.string().nullable(),
        values: z.array(FrequencySchema),
      }).strict(),
    ),
    total: EsqUncertaintyStatisticsSchema.nullable(),
    keys: z.array(
      z
        .object({
          key: z.string().min(1),
          label: z.string().min(1),
          source: z.string(),
          expression: UncertainExpressionSchema,
          unit: UncertainUnitSchema,
          events: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    unsampled: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), reason: z.string().min(1) }).strict()),
  })
  .strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertEventTreeCreateResult = Expect<
  Equal<z.infer<typeof EventTreeCreateResultSchema>, EventTreeCreateResult>
>;
type _AssertEventTreePatchResult = Expect<
  Equal<z.infer<typeof EventTreePatchResultSchema>, EventTreePatchResult>
>;
type _AssertEventTreeValidateResult = Expect<
  Equal<z.infer<typeof EventTreeValidateResultSchema>, EventTreeValidateResult>
>;
type _AssertEventTreeExecuteResult = Expect<
  Equal<z.infer<typeof EventTreeExecuteResultSchema>, EventTreeExecuteResult>
>;
type _AssertEventTreeSequenceDiagnostics = Expect<
  Equal<z.infer<typeof EventTreeSequenceDiagnosticsSchema>, EventTreeSequenceDiagnostics>
>;
type _AssertEventTreeSequenceAnalysisResult = Expect<
  Equal<z.infer<typeof EventTreeSequenceAnalysisResultSchema>, EventTreeSequenceAnalysisResult>
>;
type _AssertEventTreeEndStateAggregate = Expect<
  Equal<z.infer<typeof EventTreeEndStateAggregateSchema>, EventTreeEndStateAggregate>
>;
type _AssertEventTreeAnalysisResult = Expect<
  Equal<z.infer<typeof EventTreeAnalysisResultSchema>, EventTreeAnalysisResult>
>;
type _AssertEventTreeSequenceCutSets = Expect<
  Equal<z.infer<typeof EventTreeSequenceCutSetsSchema>, EventTreeSequenceCutSets>
>;
type _AssertEventTreeFamilyCutSets = Expect<
  Equal<z.infer<typeof EventTreeFamilyCutSetsSchema>, EventTreeFamilyCutSets>
>;
type _AssertEsqModelRunResult = Expect<
  Equal<z.infer<typeof EsqModelRunResultSchema>, EsqModelRunResult>
>;
type _AssertEsqPostRunResult = Expect<
  Equal<z.infer<typeof EsqPostRunResultSchema>, EsqPostRunResult>
>;
type _AssertEventTreeImportanceResult = Expect<
  Equal<z.infer<typeof EventTreeImportanceResultSchema>, EventTreeImportanceResult>
>;
type _AssertEventTreeSamplingResult = Expect<
  Equal<z.infer<typeof EventTreeSamplingResultSchema>, EventTreeSamplingResult>
>;
type _AssertEsqImportanceRunResult = Expect<
  Equal<z.infer<typeof EsqImportanceRunResultSchema>, EsqImportanceRunResult>
>;
type _AssertEsqUncertaintyRunResult = Expect<
  Equal<z.infer<typeof EsqUncertaintyRunResultSchema>, EsqUncertaintyRunResult>
>;

export {
  EventTreeSequenceDiagnosticsSchema,
  EventTreeCreateResultSchema,
  EventTreePatchResultSchema,
  EventTreeValidateResultSchema,
  EventTreeExecuteResultSchema,
  EventTreeSequenceAnalysisResultSchema,
  EventTreeEndStateAggregateSchema,
  EventTreeAnalysisResultSchema,
  EventTreeCutSetSweepPointSchema,
  EventTreeCutSetSchema,
  EventTreeSequenceCutSetsSchema,
  EventTreeFamilyCutSetsSchema,
  EsqModelRunResultSchema,
  EsqPostRunResultSchema,
  EventTreeImportanceResultSchema,
  EventTreeSamplingResultSchema,
  EsqImportanceRunResultSchema,
  EsqUncertaintyStatisticsSchema,
  EsqUncertaintyRunResultSchema,
};
export type {
  EventTreeSequenceDiagnostics,
  EventTreeCreateResult,
  EventTreePatchResult,
  EventTreeValidateResult,
  EventTreeExecuteResult,
  EventTreeSequenceAnalysisResult,
  EventTreeEndStateAggregate,
  EventTreeAnalysisResult,
  EventTreeCutSetSweepPoint,
  EventTreeCutSet,
  EventTreeSequenceCutSets,
  EventTreeFamilyCutSets,
  EsqModelRunTreeStatus,
  EsqModelRunSweepPoint,
  EsqModelRunTree,
  EsqModelRunSequence,
  EsqModelRunCutSet,
  EsqModelRunFamilyState,
  EsqModelRunFamily,
  EsqModelRunEndState,
  EsqModelRunResult,
  EventTreeCutSetFocusItems,
  EsqPostCombinationFinding,
  EsqPostDeletionFinding,
  EsqPostRunResult,
  EventTreeImportanceChange,
  EventTreeImportanceGroupChange,
  EventTreeImportanceFamily,
  EventTreeImportanceVariable,
  EventTreeImportanceResult,
  EventTreeSamplingFamily,
  EventTreeSamplingResult,
  EsqImportanceTargetKind,
  EsqImportanceEventRole,
  EsqImportanceTargetChange,
  EsqImportanceTarget,
  EsqImportanceFamily,
  EsqImportanceRunResult,
  EsqUncertaintyStatistics,
  EsqUncertaintyFamily,
  EsqUncertaintyKey,
  EsqUncertaintyUnsampled,
  EsqUncertaintyRunResult,
};
