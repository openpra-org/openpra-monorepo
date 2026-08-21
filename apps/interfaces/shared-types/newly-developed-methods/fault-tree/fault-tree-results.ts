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
import type { FaultTreeModel } from "./fault-tree-model";
import { FaultTreeModelSchema } from "./fault-tree-schemas";

interface FaultTreeCreateResult {
  schemaVersion: MethodModelSchemaVersion;
  model: FaultTreeModel;
}

interface FaultTreePatchResult {
  schemaVersion: MethodModelSchemaVersion;
  model: FaultTreeModel;
}

interface FaultTreeValidateResult {
  schemaVersion: MethodModelSchemaVersion;
  validation: ValidationResult;
}

interface FaultTreeExecuteResult {
  schemaVersion: MethodModelSchemaVersion;
  run: AnalysisRunMetadata;
}

interface FaultTreeCutSetEvent {
  basicEventId: MethodEntityId;
  complemented: boolean;
}

interface FaultTreeCutSet {
  rank: number;
  order: number;
  probability?: number;
  contribution?: number;
  events: FaultTreeCutSetEvent[];
}

interface FaultTreeAnalysisResult {
  schemaVersion: MethodModelSchemaVersion;
  runId: AnalysisRunId;
  modelId: MethodModelId;
  modelRevision: MethodModelRevision;
  topGateId: MethodEntityId;
  topEventProbability: number;
  minimalCutSetCount: number;
  leadingCutSets: FaultTreeCutSet[];
  validationIssues: ValidationIssue[];
  completedAt: string;
}

const FaultTreeCreateResultSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    model: FaultTreeModelSchema,
  })
  .strict();

const FaultTreePatchResultSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    model: FaultTreeModelSchema,
  })
  .strict();

const FaultTreeValidateResultSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    validation: ValidationResultSchema,
  })
  .strict();

const FaultTreeExecuteResultSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    run: AnalysisRunMetadataSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.run.methodType !== "FAULT_TREE") {
      context.addIssue({
        code: "custom",
        path: ["run", "methodType"],
        message: "Fault-tree execution runs must use the FAULT_TREE method type",
      });
    }
  });

const ProbabilitySchema = z.number().min(0, "Probability cannot be less than zero").max(1, "Probability cannot exceed one");

const FaultTreeCutSetEventSchema = z
  .object({
    basicEventId: MethodEntityIdSchema,
    complemented: z.boolean(),
  })
  .strict();

const FaultTreeCutSetSchema = z
  .object({
    rank: z.number().int().positive(),
    order: z.number().int().positive(),
    probability: ProbabilitySchema.optional(),
    contribution: ProbabilitySchema.optional(),
    events: z.array(FaultTreeCutSetEventSchema).min(1, "A cut set must contain at least one event"),
  })
  .strict()
  .superRefine((cutSet, context) => {
    if (cutSet.order !== cutSet.events.length) {
      context.addIssue({
        code: "custom",
        path: ["order"],
        message: "Cut-set order must equal its event count",
      });
    }
  });

const FaultTreeAnalysisResultSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    runId: AnalysisRunIdSchema,
    modelId: MethodModelIdSchema,
    modelRevision: MethodModelRevisionSchema,
    topGateId: MethodEntityIdSchema,
    topEventProbability: ProbabilitySchema,
    minimalCutSetCount: z.number().int().nonnegative(),
    leadingCutSets: z.array(FaultTreeCutSetSchema),
    validationIssues: z.array(ValidationIssueSchema),
    completedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.leadingCutSets.length > result.minimalCutSetCount) {
      context.addIssue({
        code: "custom",
        path: ["leadingCutSets"],
        message: "Leading cut sets cannot exceed the total minimal-cut-set count",
      });
    }
  });

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertFaultTreeCreateResult = Expect<
  Equal<z.infer<typeof FaultTreeCreateResultSchema>, FaultTreeCreateResult>
>;
type _AssertFaultTreePatchResult = Expect<
  Equal<z.infer<typeof FaultTreePatchResultSchema>, FaultTreePatchResult>
>;
type _AssertFaultTreeValidateResult = Expect<
  Equal<z.infer<typeof FaultTreeValidateResultSchema>, FaultTreeValidateResult>
>;
type _AssertFaultTreeExecuteResult = Expect<
  Equal<z.infer<typeof FaultTreeExecuteResultSchema>, FaultTreeExecuteResult>
>;
type _AssertFaultTreeCutSetEvent = Expect<
  Equal<z.infer<typeof FaultTreeCutSetEventSchema>, FaultTreeCutSetEvent>
>;
type _AssertFaultTreeCutSet = Expect<Equal<z.infer<typeof FaultTreeCutSetSchema>, FaultTreeCutSet>>;
type _AssertFaultTreeAnalysisResult = Expect<
  Equal<z.infer<typeof FaultTreeAnalysisResultSchema>, FaultTreeAnalysisResult>
>;

export {
  FaultTreeCreateResultSchema,
  FaultTreePatchResultSchema,
  FaultTreeValidateResultSchema,
  FaultTreeExecuteResultSchema,
  FaultTreeCutSetEventSchema,
  FaultTreeCutSetSchema,
  FaultTreeAnalysisResultSchema,
};
export type {
  FaultTreeCreateResult,
  FaultTreePatchResult,
  FaultTreeValidateResult,
  FaultTreeExecuteResult,
  FaultTreeCutSetEvent,
  FaultTreeCutSet,
  FaultTreeAnalysisResult,
};
