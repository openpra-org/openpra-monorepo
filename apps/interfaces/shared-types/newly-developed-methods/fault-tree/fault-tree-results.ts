import { z } from "zod";
import {
  AnalysisRunIdSchema,
  AnalysisRunMetadataSchema,
  MethodEntityIdSchema,
  WorkbookMethodSchemaVersionSchema,
  ValidationIssueSchema,
  ValidationResultSchema,
  WorkbookModelSnapshotIdentitySchema,
  WorkbookRevisionSchema,
  BasicEventQuantificationTraceSchema,
} from "../shared";
import type {
  AnalysisRunId,
  AnalysisRunMetadata,
  MethodEntityId,
  WorkbookMethodSchemaVersion,
  ValidationIssue,
  ValidationResult,
  WorkbookModelSnapshotIdentity,
  WorkbookRevision,
  BasicEventQuantificationTrace,
} from "../shared";
import type { FaultTreeModel } from "./fault-tree-model";
import { FaultTreeModelSchema } from "./fault-tree-schemas";

interface FaultTreeCreateResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  workbookRevision: WorkbookRevision;
  model: FaultTreeModel;
}

interface FaultTreePatchResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  workbookRevision: WorkbookRevision;
  model: FaultTreeModel;
}

interface FaultTreeValidateResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  validation: ValidationResult;
}

interface FaultTreeExecuteResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  run: AnalysisRunMetadata;
}

interface FaultTreeAnalysisResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  runId: AnalysisRunId;
  owner: WorkbookModelSnapshotIdentity;
  topGateId: MethodEntityId;
  topEventProbability: number;
  basicEventQuantifications?: BasicEventQuantificationTrace[];
  validationIssues: ValidationIssue[];
  completedAt: string;
}

const FaultTreeCreateResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    workbookRevision: WorkbookRevisionSchema,
    model: FaultTreeModelSchema,
  })
  .strict();

const FaultTreePatchResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    workbookRevision: WorkbookRevisionSchema,
    model: FaultTreeModelSchema,
  })
  .strict();

const FaultTreeValidateResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    validation: ValidationResultSchema,
  })
  .strict();

const FaultTreeExecuteResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
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

const FaultTreeAnalysisResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    runId: AnalysisRunIdSchema,
    owner: WorkbookModelSnapshotIdentitySchema,
    topGateId: MethodEntityIdSchema,
    topEventProbability: ProbabilitySchema,
    basicEventQuantifications: z.array(BasicEventQuantificationTraceSchema).optional(),
    validationIssues: z.array(ValidationIssueSchema),
    completedAt: z.string().datetime({ offset: true }),
  })
  .strict();

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
type _AssertFaultTreeAnalysisResult = Expect<
  Equal<z.infer<typeof FaultTreeAnalysisResultSchema>, FaultTreeAnalysisResult>
>;

export {
  FaultTreeCreateResultSchema,
  FaultTreePatchResultSchema,
  FaultTreeValidateResultSchema,
  FaultTreeExecuteResultSchema,
  FaultTreeAnalysisResultSchema,
};
export type {
  FaultTreeCreateResult,
  FaultTreePatchResult,
  FaultTreeValidateResult,
  FaultTreeExecuteResult,
  FaultTreeAnalysisResult,
};
