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
import type { BayesianNetworkEvidenceConfiguration, BayesianNetworkModel } from "./bayesian-network-model";
import { BayesianNetworkEvidenceConfigurationSchema, BayesianNetworkModelSchema } from "./bayesian-network-schemas";

interface BayesianNetworkMarginalValue {
  stateId: MethodEntityId;
  probability: number;
}

type BayesianNetworkMarginalValues = [
  BayesianNetworkMarginalValue,
  BayesianNetworkMarginalValue,
  ...BayesianNetworkMarginalValue[],
];

interface BayesianNetworkMarginalResult {
  nodeId: MethodEntityId;
  values: BayesianNetworkMarginalValues;
}

interface BayesianNetworkCreateResult {
  schemaVersion: MethodModelSchemaVersion;
  model: BayesianNetworkModel;
}

interface BayesianNetworkPatchResult {
  schemaVersion: MethodModelSchemaVersion;
  model: BayesianNetworkModel;
}

interface BayesianNetworkValidateResult {
  schemaVersion: MethodModelSchemaVersion;
  validation: ValidationResult;
}

interface BayesianNetworkExecuteResult {
  schemaVersion: MethodModelSchemaVersion;
  run: AnalysisRunMetadata;
}

interface BayesianNetworkAnalysisResult {
  schemaVersion: MethodModelSchemaVersion;
  runId: AnalysisRunId;
  modelId: MethodModelId;
  modelRevision: MethodModelRevision;
  evidence: BayesianNetworkEvidenceConfiguration;
  marginals: BayesianNetworkMarginalResult[];
  validationIssues: ValidationIssue[];
  completedAt: string;
}

const BayesianNetworkMarginalValueSchema = z
  .object({
    stateId: MethodEntityIdSchema,
    probability: z.number().min(0, "Probability cannot be less than zero").max(1, "Probability cannot exceed one"),
  })
  .strict();

const BayesianNetworkMarginalValuesSchema = z
  .tuple([BayesianNetworkMarginalValueSchema, BayesianNetworkMarginalValueSchema])
  .rest(BayesianNetworkMarginalValueSchema);

const BayesianNetworkMarginalResultSchema = z
  .object({
    nodeId: MethodEntityIdSchema,
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
    schemaVersion: MethodModelSchemaVersionSchema,
    model: BayesianNetworkModelSchema,
  })
  .strict();

const BayesianNetworkPatchResultSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    model: BayesianNetworkModelSchema,
  })
  .strict();

const BayesianNetworkValidateResultSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    validation: ValidationResultSchema,
  })
  .strict();

const BayesianNetworkExecuteResultSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
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
    schemaVersion: MethodModelSchemaVersionSchema,
    runId: AnalysisRunIdSchema,
    modelId: MethodModelIdSchema,
    modelRevision: MethodModelRevisionSchema,
    evidence: BayesianNetworkEvidenceConfigurationSchema,
    marginals: z.array(BayesianNetworkMarginalResultSchema),
    validationIssues: z.array(ValidationIssueSchema),
    completedAt: z.string().datetime({ offset: true }),
  })
  .strict();

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
  BayesianNetworkMarginalValue,
  BayesianNetworkMarginalValues,
  BayesianNetworkMarginalResult,
  BayesianNetworkCreateResult,
  BayesianNetworkPatchResult,
  BayesianNetworkValidateResult,
  BayesianNetworkExecuteResult,
  BayesianNetworkAnalysisResult,
};
