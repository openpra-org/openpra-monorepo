import { z } from "zod";
import {
  MethodModelIdSchema,
  MethodModelRevisionSchema,
  MethodTypeSchema,
} from "./method-model";

const CURRENT_ANALYSIS_RUN_SCHEMA_VERSION = "1.0.0" as const;
const AnalysisRunSchemaVersionSchema = z.literal(CURRENT_ANALYSIS_RUN_SCHEMA_VERSION);
const AnalysisRunIdSchema = z.string().uuid("Analysis run id must be a UUID");
const AnalysisRunStatusSchema = z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]);

const AnalysisEngineMetadataSchema = z.object({
  name: z.string().trim().min(1, "Analysis engine name is required"),
  version: z.string().trim().min(1, "Analysis engine version is required"),
});

const OptionalRunTimestampSchema = z.string().datetime({ offset: true }).nullable();

const AnalysisRunMetadataSchema = z
  .object({
    schemaVersion: AnalysisRunSchemaVersionSchema,
    id: AnalysisRunIdSchema,
    modelId: MethodModelIdSchema,
    modelRevision: MethodModelRevisionSchema,
    methodType: MethodTypeSchema,
    status: AnalysisRunStatusSchema,
    requestedBy: z.string().trim().min(1, "Requester id is required"),
    requestedAt: z.string().datetime({ offset: true }),
    startedAt: OptionalRunTimestampSchema,
    completedAt: OptionalRunTimestampSchema,
    engine: AnalysisEngineMetadataSchema.nullable(),
  })
  .superRefine((run, context) => {
    if (run.status === "QUEUED" && (run.startedAt !== null || run.completedAt !== null || run.engine !== null)) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Queued runs cannot have start, completion, or engine metadata",
      });
    }

    if (run.status === "RUNNING" && (run.startedAt === null || run.completedAt !== null || run.engine === null)) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Running runs require start and engine metadata and cannot be completed",
      });
    }

    if ((run.status === "SUCCEEDED" || run.status === "FAILED") && (run.startedAt === null || run.completedAt === null || run.engine === null)) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Succeeded and failed runs require start, completion, and engine metadata",
      });
    }

    if (run.status === "CANCELLED" && run.completedAt === null) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "Cancelled runs require a completion timestamp",
      });
    }

    const requestedAt = Date.parse(run.requestedAt);
    const startedAt = run.startedAt === null ? null : Date.parse(run.startedAt);
    const completedAt = run.completedAt === null ? null : Date.parse(run.completedAt);
    if (startedAt !== null && startedAt < requestedAt) {
      context.addIssue({
        code: "custom",
        path: ["startedAt"],
        message: "Analysis cannot start before it was requested",
      });
    }
    if (completedAt !== null && completedAt < (startedAt ?? requestedAt)) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "Analysis cannot complete before it starts",
      });
    }
  });

type AnalysisRunSchemaVersion = z.infer<typeof AnalysisRunSchemaVersionSchema>;
type AnalysisRunId = z.infer<typeof AnalysisRunIdSchema>;
type AnalysisRunStatus = z.infer<typeof AnalysisRunStatusSchema>;
type AnalysisEngineMetadata = z.infer<typeof AnalysisEngineMetadataSchema>;
type AnalysisRunMetadata = z.infer<typeof AnalysisRunMetadataSchema>;

export {
  CURRENT_ANALYSIS_RUN_SCHEMA_VERSION,
  AnalysisRunSchemaVersionSchema,
  AnalysisRunIdSchema,
  AnalysisRunStatusSchema,
  AnalysisEngineMetadataSchema,
  AnalysisRunMetadataSchema,
};
export type {
  AnalysisRunSchemaVersion,
  AnalysisRunId,
  AnalysisRunStatus,
  AnalysisEngineMetadata,
  AnalysisRunMetadata,
};
