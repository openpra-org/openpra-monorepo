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
} from "../shared";
import type { BayesianNetworkEvidenceConfiguration, BayesianNetworkModel } from "./bayesian-network-model";
import { BayesianNetworkEvidenceConfigurationSchema, BayesianNetworkModelSchema } from "./bayesian-network-schemas";

interface BayesianNetworkMarginalValue {
  stateId: WorkbookEntityId;
  probability: number;
}

type BayesianNetworkMarginalValues = [
  BayesianNetworkMarginalValue,
  ...BayesianNetworkMarginalValue[],
];

interface BayesianNetworkMarginalResult {
  nodeId: WorkbookEntityId;
  values: BayesianNetworkMarginalValues;
}

interface BayesianNetworkCreateResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  workbookRevision: WorkbookRevision;
  model: BayesianNetworkModel;
}

interface BayesianNetworkPatchResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  workbookRevision: WorkbookRevision;
  model: BayesianNetworkModel;
}

interface BayesianNetworkValidateResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  validation: ValidationResult;
}

interface BayesianNetworkExecuteResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  run: AnalysisRunMetadata;
}

interface BayesianNetworkAnalysisResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  runId: AnalysisRunId;
  owner: WorkbookModelSnapshotIdentity;
  evidence: BayesianNetworkEvidenceConfiguration;
  marginals: BayesianNetworkMarginalResult[];
  validationIssues: ValidationIssue[];
  completedAt: string;
}

const BayesianNetworkMarginalValueSchema = z
  .object({
    stateId: WorkbookEntityIdSchema,
    probability: z.number().min(0, "Probability cannot be less than zero").max(1, "Probability cannot exceed one"),
  })
  .strict();

const BayesianNetworkMarginalValuesSchema = z
  .tuple([BayesianNetworkMarginalValueSchema])
  .rest(BayesianNetworkMarginalValueSchema);

const BayesianNetworkMarginalResultSchema = z
  .object({
    nodeId: WorkbookEntityIdSchema,
    values: BayesianNetworkMarginalValuesSchema,
  })
  .strict()
  .superRefine((result, context) => {
    const total = result.values.reduce((sum, value) => sum + value.probability, 0);
    if (Math.abs(total - 1) > 1e-9) {
      context.addIssue({
        code: "custom",
        path: ["values"],
        message: "Marginal probabilities must sum to one",
      });
    }
  });

const BayesianNetworkCreateResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    workbookRevision: WorkbookRevisionSchema,
    model: BayesianNetworkModelSchema,
  })
  .strict();

const BayesianNetworkPatchResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    workbookRevision: WorkbookRevisionSchema,
    model: BayesianNetworkModelSchema,
  })
  .strict();

const BayesianNetworkValidateResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    validation: ValidationResultSchema,
  })
  .strict();

const BayesianNetworkExecuteResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    run: AnalysisRunMetadataSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.run.methodType !== "BAYESIAN_NETWORK") {
      context.addIssue({
        code: "custom",
        path: ["run", "methodType"],
        message: "Bayesian-network execution runs must use the BAYESIAN_NETWORK method type",
      });
    }
  });

const BayesianNetworkAnalysisResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    runId: AnalysisRunIdSchema,
    owner: WorkbookModelSnapshotIdentitySchema,
    evidence: BayesianNetworkEvidenceConfigurationSchema,
    marginals: z.array(BayesianNetworkMarginalResultSchema),
    validationIssues: z.array(ValidationIssueSchema),
    completedAt: z.string().datetime({ offset: true }),
  })
  .strict();

const BayesianNetworkBatchRowSchema = z.intersection(
  z.object({ scenarioId: WorkbookEntityIdSchema, scenarioCode: z.string(), scenarioName: z.string() }),
  z.discriminatedUnion("status", [
    z.object({ status: z.literal("SUCCEEDED"), failure: z.null(), result: BayesianNetworkAnalysisResultSchema }),
    z.object({ status: z.literal("FAILED"), failure: z.string(), result: z.null() }),
  ]),
);

const BayesianNetworkBatchAnalysisResultSchema = z.object({
  schemaVersion: WorkbookMethodSchemaVersionSchema,
  runId: AnalysisRunIdSchema,
  owner: WorkbookModelSnapshotIdentitySchema,
  queryNodeIds: z.array(WorkbookEntityIdSchema).min(1),
  scenarios: z.array(BayesianNetworkBatchRowSchema).min(1),
  diagnostics: z.object({
    junctionTreeCompilations: z.number().int().min(0),
    scenarioEvaluations: z.number().int().min(1),
  }).strict(),
  completedAt: z.string().datetime({ offset: true }),
}).strict();

type BayesianNetworkBatchRow = z.infer<typeof BayesianNetworkBatchRowSchema>;
type BayesianNetworkBatchAnalysisResult = z.infer<typeof BayesianNetworkBatchAnalysisResultSchema>;
const BayesianNetworkStoredResultSchema = z.union([
  BayesianNetworkAnalysisResultSchema, BayesianNetworkBatchAnalysisResultSchema,
]);

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertBayesianNetworkMarginalValue = Expect<
  Equal<z.infer<typeof BayesianNetworkMarginalValueSchema>, BayesianNetworkMarginalValue>
>;
type _AssertBayesianNetworkMarginalValues = Expect<
  Equal<z.infer<typeof BayesianNetworkMarginalValuesSchema>, BayesianNetworkMarginalValues>
>;
type _AssertBayesianNetworkMarginalResult = Expect<
  Equal<z.infer<typeof BayesianNetworkMarginalResultSchema>, BayesianNetworkMarginalResult>
>;
type _AssertBayesianNetworkCreateResult = Expect<
  Equal<z.infer<typeof BayesianNetworkCreateResultSchema>, BayesianNetworkCreateResult>
>;
type _AssertBayesianNetworkPatchResult = Expect<
  Equal<z.infer<typeof BayesianNetworkPatchResultSchema>, BayesianNetworkPatchResult>
>;
type _AssertBayesianNetworkValidateResult = Expect<
  Equal<z.infer<typeof BayesianNetworkValidateResultSchema>, BayesianNetworkValidateResult>
>;
type _AssertBayesianNetworkExecuteResult = Expect<
  Equal<z.infer<typeof BayesianNetworkExecuteResultSchema>, BayesianNetworkExecuteResult>
>;
type _AssertBayesianNetworkAnalysisResult = Expect<
  Equal<z.infer<typeof BayesianNetworkAnalysisResultSchema>, BayesianNetworkAnalysisResult>
>;

export {
  BayesianNetworkBatchRowSchema,
  BayesianNetworkBatchAnalysisResultSchema,
  BayesianNetworkStoredResultSchema,
  BayesianNetworkMarginalValueSchema,
  BayesianNetworkMarginalValuesSchema,
  BayesianNetworkMarginalResultSchema,
  BayesianNetworkCreateResultSchema,
  BayesianNetworkPatchResultSchema,
  BayesianNetworkValidateResultSchema,
  BayesianNetworkExecuteResultSchema,
  BayesianNetworkAnalysisResultSchema,
};
export type {
  BayesianNetworkBatchRow,
  BayesianNetworkBatchAnalysisResult,
  BayesianNetworkMarginalValue,
  BayesianNetworkMarginalValues,
  BayesianNetworkMarginalResult,
  BayesianNetworkCreateResult,
  BayesianNetworkPatchResult,
  BayesianNetworkValidateResult,
  BayesianNetworkExecuteResult,
  BayesianNetworkAnalysisResult,
};
