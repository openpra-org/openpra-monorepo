import { z } from "zod";
import {
  AnalysisRunIdSchema,
  AnalysisRunMetadataSchema,
  MethodEntityIdSchema,
  MethodModelIdSchema,
  MethodModelRevisionSchema,
  MethodModelSchemaVersionSchema,
  ValidationIssueSchema,
  ValidationResultSchema,
} from "../shared";
import type {
  AnalysisRunId,
  AnalysisRunMetadata,
  MethodEntityId,
  MethodModelId,
  MethodModelRevision,
  MethodModelSchemaVersion,
  ValidationIssue,
  ValidationResult,
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
  schemaVersion: MethodModelSchemaVersion;
  model: EventTreeModel;
}

interface EventTreePatchResult {
  schemaVersion: MethodModelSchemaVersion;
  model: EventTreeModel;
}

interface EventTreeValidateResult {
  schemaVersion: MethodModelSchemaVersion;
  validation: ValidationResult;
}

interface EventTreeExecuteResult {
  schemaVersion: MethodModelSchemaVersion;
  run: AnalysisRunMetadata;
}

interface EventTreeSequenceAnalysisResult {
  sequenceId: MethodEntityId;
  path: EventTreeSequencePathStep[];
  result: EventTreeBranchResult;
  conditionalProbability: number;
  annualFrequency: number;
}

interface EventTreeEndStateAggregate {
  endStateId: MethodEntityId;
  annualFrequency: number;
}

interface EventTreeAnalysisResult {
  schemaVersion: MethodModelSchemaVersion;
  runId: AnalysisRunId;
  modelId: MethodModelId;
  modelRevision: MethodModelRevision;
  mode: EventTreeExecutionMode;
  sequences: EventTreeSequenceAnalysisResult[];
  endStateAggregates: EventTreeEndStateAggregate[];
  validationIssues: ValidationIssue[];
  completedAt: string;
}

const EventTreeCreateResultSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    model: EventTreeModelSchema,
  })
  .strict();

const EventTreePatchResultSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    model: EventTreeModelSchema,
  })
  .strict();

const EventTreeValidateResultSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    validation: ValidationResultSchema,
  })
  .strict();

const EventTreeExecuteResultSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
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
    sequenceId: MethodEntityIdSchema,
    path: z.array(EventTreeSequencePathStepSchema),
    result: EventTreeBranchResultSchema,
    conditionalProbability: ProbabilitySchema,
    annualFrequency: z.number().nonnegative("Annual frequency cannot be negative"),
  })
  .strict();

const EventTreeEndStateAggregateSchema = z
  .object({
    endStateId: MethodEntityIdSchema,
    annualFrequency: z.number().nonnegative("Annual frequency cannot be negative"),
  })
  .strict();

const EventTreeAnalysisResultSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    runId: AnalysisRunIdSchema,
    modelId: MethodModelIdSchema,
    modelRevision: MethodModelRevisionSchema,
    mode: EventTreeExecutionModeSchema,
    sequences: z.array(EventTreeSequenceAnalysisResultSchema),
    endStateAggregates: z.array(EventTreeEndStateAggregateSchema),
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
