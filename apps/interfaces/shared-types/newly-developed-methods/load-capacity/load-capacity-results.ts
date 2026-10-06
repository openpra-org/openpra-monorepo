import { z } from "zod";
import {
  AnalysisRunIdSchema,
  AnalysisRunMetadataSchema,
  ValidationIssueSchema,
  WorkbookMethodSchemaVersionSchema,
  WorkbookModelSnapshotIdentitySchema,
} from "../shared";
import type {
  AnalysisRunId,
  AnalysisRunMetadata,
  ValidationIssue,
  WorkbookMethodSchemaVersion,
  WorkbookModelSnapshotIdentity,
} from "../shared";
import { LoadCapacitySamplingSchema } from "./load-capacity-requests";
import type { LoadCapacitySampling } from "./load-capacity-requests";

type LoadCapacityIntegrationMethod =
  | "POINT_BOTH"
  | "POINT_LOAD"
  | "POINT_CAPACITY"
  | "CLOSED_FORM_LOGNORMAL"
  | "CLOSED_FORM_NORMAL"
  | "QUADRATURE";

interface LoadCapacityUncertainty {
  sampling: LoadCapacitySampling;
  samples: number;
  seed: number;
  mean: number;
  standardDeviation: number;
  p05: number;
  p50: number;
  p95: number;
  minimum: number;
  maximum: number;
  largestQuadratureError: number | null;
}

interface LoadCapacityCurvePoint {
  load: number;
  probability: number;
  mean?: number;
  p05?: number;
  p50?: number;
  p95?: number;
}

interface LoadCapacityAnalysisResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  runId: AnalysisRunId;
  owner: WorkbookModelSnapshotIdentity;
  completedAt: string;
  method: LoadCapacityIntegrationMethod;
  pointProbability: number;
  quadratureError: number | null;
  unit: string | null;
  uncertainty: LoadCapacityUncertainty | null;
  curve: LoadCapacityCurvePoint[];
  validationIssues: ValidationIssue[];
}

interface LoadCapacityExecuteResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  run: AnalysisRunMetadata;
}

const ProbabilitySchema = z.number().min(0).max(1);

const LoadCapacityIntegrationMethodSchema = z.enum([
  "POINT_BOTH",
  "POINT_LOAD",
  "POINT_CAPACITY",
  "CLOSED_FORM_LOGNORMAL",
  "CLOSED_FORM_NORMAL",
  "QUADRATURE",
]);

const LoadCapacityUncertaintySchema = z
  .object({
    sampling: LoadCapacitySamplingSchema,
    samples: z.number().int().min(2),
    seed: z.number().int().min(0),
    mean: ProbabilitySchema,
    standardDeviation: z.number().min(0),
    p05: ProbabilitySchema,
    p50: ProbabilitySchema,
    p95: ProbabilitySchema,
    minimum: ProbabilitySchema,
    maximum: ProbabilitySchema,
    largestQuadratureError: z.number().min(0).nullable(),
  })
  .strict();

const LoadCapacityCurvePointSchema = z
  .object({
    load: z.number().finite(),
    probability: ProbabilitySchema,
    mean: ProbabilitySchema.optional(),
    p05: ProbabilitySchema.optional(),
    p50: ProbabilitySchema.optional(),
    p95: ProbabilitySchema.optional(),
  })
  .strict();

const LoadCapacityAnalysisResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    runId: AnalysisRunIdSchema,
    owner: WorkbookModelSnapshotIdentitySchema,
    completedAt: z.string().datetime({ offset: true }),
    method: LoadCapacityIntegrationMethodSchema,
    pointProbability: ProbabilitySchema,
    quadratureError: z.number().min(0).nullable(),
    unit: z.string().nullable(),
    uncertainty: LoadCapacityUncertaintySchema.nullable(),
    curve: z.array(LoadCapacityCurvePointSchema).min(2),
    validationIssues: z.array(ValidationIssueSchema),
  })
  .strict();

const LoadCapacityExecuteResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    run: AnalysisRunMetadataSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.run.methodType !== "LOAD_CAPACITY") {
      context.addIssue({
        code: "custom",
        path: ["run", "methodType"],
        message: "Load-capacity runs must use the LOAD_CAPACITY method type",
      });
    }
  });

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertLoadCapacityIntegrationMethod = Expect<Equal<z.infer<typeof LoadCapacityIntegrationMethodSchema>, LoadCapacityIntegrationMethod>>;
type _AssertLoadCapacityUncertainty = Expect<Equal<z.infer<typeof LoadCapacityUncertaintySchema>, LoadCapacityUncertainty>>;
type _AssertLoadCapacityCurvePoint = Expect<Equal<z.infer<typeof LoadCapacityCurvePointSchema>, LoadCapacityCurvePoint>>;
type _AssertLoadCapacityAnalysisResult = Expect<Equal<z.infer<typeof LoadCapacityAnalysisResultSchema>, LoadCapacityAnalysisResult>>;
type _AssertLoadCapacityExecuteResult = Expect<Equal<z.infer<typeof LoadCapacityExecuteResultSchema>, LoadCapacityExecuteResult>>;

export {
  LoadCapacityIntegrationMethodSchema,
  LoadCapacityUncertaintySchema,
  LoadCapacityCurvePointSchema,
  LoadCapacityAnalysisResultSchema,
  LoadCapacityExecuteResultSchema,
};
export type {
  LoadCapacityIntegrationMethod,
  LoadCapacityUncertainty,
  LoadCapacityCurvePoint,
  LoadCapacityAnalysisResult,
  LoadCapacityExecuteResult,
};
