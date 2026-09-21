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
import {
  FaultTreeAlgorithmSchema,
  FaultTreeAnalysisSettingsSchema,
  FaultTreeCalculationTypeSchema,
  FaultTreeWorkflowSchema,
} from "./fault-tree-requests";
import type {
  FaultTreeAlgorithm,
  FaultTreeAnalysisSettings,
  FaultTreeCalculationType,
  FaultTreeWorkflow,
} from "./fault-tree-requests";

type FaultTreeProbabilityMethod = "EXACT" | "LIMITED" | "RARE_EVENT" | "MCUB" | "MONTE_CARLO";

interface FaultTreeCutSetLiteral {
  basicEventId: MethodEntityId;
  negated: boolean;
}

interface FaultTreeCutSet {
  order: number;
  probability: number;
  literals: FaultTreeCutSetLiteral[];
}

interface FaultTreeCutSetsResult {
  primeImplicants: boolean;
  count: number;
  distributionByOrder: number[];
  items: FaultTreeCutSet[];
}

interface FaultTreeImportanceResult {
  basicEventId: MethodEntityId;
  birnbaum: number;
  criticality: number;
  fussellVesely: number;
  riskAchievementWorth: number;
  riskReductionWorth: number;
}

interface FaultTreeUncertaintyResult {
  mean: number;
  standardDeviation: number;
  errorFactor: number;
  quantiles: { probability: number; value: number }[];
  sampleCount: number;
  seed: number;
}

interface FaultTreeMonteCarloResult {
  trials: number;
  requestedTrials?: number;
  stoppedEarly?: boolean;
  successes: number;
  standardDeviation: number;
  confidenceInterval: { lower: number; upper: number; confidence: number };
  seed: number;
  varianceReduction?: "NONE" | "IMPORTANCE_SAMPLING" | "STRATIFIED_SAMPLING";
}

interface FaultTreeSilResult {
  probabilityOfFailureOnDemand: number;
  dangerousFailureRatePerHour: number;
  pfdLevel: "NONE" | "SIL_1" | "SIL_2" | "SIL_3" | "SIL_4";
  pfhLevel: "NONE" | "SIL_1" | "SIL_2" | "SIL_3" | "SIL_4";
}

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
  calculationType?: FaultTreeCalculationType;
  workflow?: FaultTreeWorkflow;
  algorithm?: FaultTreeAlgorithm;
  settings?: FaultTreeAnalysisSettings;
  probabilityMethod?: FaultTreeProbabilityMethod;
  cutSets?: FaultTreeCutSetsResult;
  importance?: FaultTreeImportanceResult[];
  uncertainty?: FaultTreeUncertaintyResult;
  monteCarlo?: FaultTreeMonteCarloResult;
  sil?: FaultTreeSilResult;
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
const FiniteNumberSchema = z.number().finite();
const FaultTreeProbabilityMethodSchema = z.enum(["EXACT", "LIMITED", "RARE_EVENT", "MCUB", "MONTE_CARLO"]);
const FaultTreeCutSetLiteralSchema = z.object({
  basicEventId: MethodEntityIdSchema,
  negated: z.boolean(),
}).strict();
const FaultTreeCutSetSchema = z.object({
  order: z.number().int().nonnegative(),
  probability: ProbabilitySchema,
  literals: z.array(FaultTreeCutSetLiteralSchema),
}).strict();
const FaultTreeCutSetsResultSchema = z.object({
  primeImplicants: z.boolean(),
  count: z.number().int().nonnegative(),
  distributionByOrder: z.array(z.number().int().nonnegative()),
  items: z.array(FaultTreeCutSetSchema),
}).strict();
const FaultTreeImportanceResultSchema = z.object({
  basicEventId: MethodEntityIdSchema,
  birnbaum: FiniteNumberSchema,
  criticality: FiniteNumberSchema,
  fussellVesely: FiniteNumberSchema,
  riskAchievementWorth: FiniteNumberSchema,
  riskReductionWorth: FiniteNumberSchema,
}).strict();
const FaultTreeUncertaintyResultSchema = z.object({
  mean: ProbabilitySchema,
  standardDeviation: z.number().finite().nonnegative(),
  errorFactor: z.number().finite().nonnegative(),
  quantiles: z.array(z.object({ probability: ProbabilitySchema, value: ProbabilitySchema }).strict()),
  sampleCount: z.number().int().positive(),
  seed: z.number().int().nonnegative(),
}).strict();
const FaultTreeMonteCarloResultSchema = z.object({
  trials: z.number().int().positive(),
  requestedTrials: z.number().int().positive().optional(),
  stoppedEarly: z.boolean().optional(),
  successes: z.number().int().nonnegative(),
  standardDeviation: z.number().finite().nonnegative(),
  confidenceInterval: z.object({
    lower: ProbabilitySchema,
    upper: ProbabilitySchema,
    confidence: ProbabilitySchema,
  }).strict(),
  seed: z.number().int().nonnegative(),
  varianceReduction: z.enum(["NONE", "IMPORTANCE_SAMPLING", "STRATIFIED_SAMPLING"]).optional(),
}).strict();
const FaultTreeSilLevelSchema = z.enum(["NONE", "SIL_1", "SIL_2", "SIL_3", "SIL_4"]);
const FaultTreeSilResultSchema = z.object({
  probabilityOfFailureOnDemand: ProbabilitySchema,
  dangerousFailureRatePerHour: z.number().finite().nonnegative(),
  pfdLevel: FaultTreeSilLevelSchema,
  pfhLevel: FaultTreeSilLevelSchema,
}).strict();

const FaultTreeAnalysisResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    runId: AnalysisRunIdSchema,
    owner: WorkbookModelSnapshotIdentitySchema,
    topGateId: MethodEntityIdSchema,
    topEventProbability: ProbabilitySchema,
    calculationType: FaultTreeCalculationTypeSchema.optional(),
    workflow: FaultTreeWorkflowSchema.optional(),
    algorithm: FaultTreeAlgorithmSchema.optional(),
    settings: FaultTreeAnalysisSettingsSchema.optional(),
    probabilityMethod: FaultTreeProbabilityMethodSchema.optional(),
    cutSets: FaultTreeCutSetsResultSchema.optional(),
    importance: z.array(FaultTreeImportanceResultSchema).optional(),
    uncertainty: FaultTreeUncertaintyResultSchema.optional(),
    monteCarlo: FaultTreeMonteCarloResultSchema.optional(),
    sil: FaultTreeSilResultSchema.optional(),
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
  FaultTreeProbabilityMethodSchema,
  FaultTreeCutSetLiteralSchema,
  FaultTreeCutSetSchema,
  FaultTreeCutSetsResultSchema,
  FaultTreeImportanceResultSchema,
  FaultTreeUncertaintyResultSchema,
  FaultTreeMonteCarloResultSchema,
  FaultTreeSilResultSchema,
};
export type {
  FaultTreeCreateResult,
  FaultTreePatchResult,
  FaultTreeValidateResult,
  FaultTreeExecuteResult,
  FaultTreeAnalysisResult,
  FaultTreeProbabilityMethod,
  FaultTreeCutSetLiteral,
  FaultTreeCutSet,
  FaultTreeCutSetsResult,
  FaultTreeImportanceResult,
  FaultTreeUncertaintyResult,
  FaultTreeMonteCarloResult,
  FaultTreeSilResult,
};
