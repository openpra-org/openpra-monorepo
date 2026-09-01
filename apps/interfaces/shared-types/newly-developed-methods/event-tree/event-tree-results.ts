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
} from "../shared";
import type {
  EventTreeBranchResult,
  EventTreeModel,
  EventTreeSequencePathStep,
} from "./event-tree-model";
import { EventTreeBranchResultSchema, EventTreeModelSchema, EventTreeSequencePathStepSchema } from "./event-tree-schemas";
import { EventTreeExecutionModeSchema } from "./event-tree-requests";
import type { EventTreeExecutionMode } from "./event-tree-requests";

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

interface EventTreeSequenceAnalysisResult {
  sequenceId: WorkbookEntityId;
  path: EventTreeSequencePathStep[];
  result: EventTreeBranchResult;
  conditionalProbability: number;
  annualFrequency: number;
}

interface EventTreeEndStateAggregate {
  endStateId: WorkbookEntityId;
  annualFrequency: number;
}

interface EventTreeAnalysisResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  runId: AnalysisRunId;
  owner: WorkbookModelSnapshotIdentity;
  mode: EventTreeExecutionMode;
  sequences: EventTreeSequenceAnalysisResult[];
  endStateAggregates: EventTreeEndStateAggregate[];
  frequencySemantics?: EventTreeFrequencySemantics;
  validationIssues: ValidationIssue[];
  completedAt: string;
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

const EventTreeSequenceAnalysisResultSchema = z
  .object({
    sequenceId: WorkbookEntityIdSchema,
    path: z.array(EventTreeSequencePathStepSchema),
    result: EventTreeBranchResultSchema,
    conditionalProbability: ProbabilitySchema,
    annualFrequency: z.number().nonnegative("Annual frequency cannot be negative"),
  })
  .strict();

const EventTreeEndStateAggregateSchema = z
  .object({
    endStateId: WorkbookEntityIdSchema,
    annualFrequency: z.number().nonnegative("Annual frequency cannot be negative"),
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
    validationIssues: z.array(ValidationIssueSchema),
    completedAt: z.string().datetime({ offset: true }),
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
type _AssertEventTreeSequenceAnalysisResult = Expect<
  Equal<z.infer<typeof EventTreeSequenceAnalysisResultSchema>, EventTreeSequenceAnalysisResult>
>;
type _AssertEventTreeEndStateAggregate = Expect<
  Equal<z.infer<typeof EventTreeEndStateAggregateSchema>, EventTreeEndStateAggregate>
>;
type _AssertEventTreeAnalysisResult = Expect<
  Equal<z.infer<typeof EventTreeAnalysisResultSchema>, EventTreeAnalysisResult>
>;

export {
  EventTreeCreateResultSchema,
  EventTreePatchResultSchema,
  EventTreeValidateResultSchema,
  EventTreeExecuteResultSchema,
  EventTreeSequenceAnalysisResultSchema,
  EventTreeEndStateAggregateSchema,
  EventTreeAnalysisResultSchema,
};
export type {
  EventTreeCreateResult,
  EventTreePatchResult,
  EventTreeValidateResult,
  EventTreeExecuteResult,
  EventTreeSequenceAnalysisResult,
  EventTreeEndStateAggregate,
  EventTreeAnalysisResult,
};
