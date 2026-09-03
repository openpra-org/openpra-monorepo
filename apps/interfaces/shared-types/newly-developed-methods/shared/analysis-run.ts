import { z } from "zod";
import {
  MethodTypeSchema,
  WorkbookCrossReferenceSchema,
  WorkbookEntityIdSchema,
  WorkbookModelAddressSchema,
  WorkbookModelSnapshotIdentitySchema,
  WorkbookSnapshotIdentitySchema,
} from "./method-model";
import { WorkbookMethodHostTypeSchema } from "./workbook-dependencies";

const CURRENT_ANALYSIS_RUN_SCHEMA_VERSION = "1.0.0" as const;
const AnalysisRunSchemaVersionSchema = z.literal(CURRENT_ANALYSIS_RUN_SCHEMA_VERSION);
const AnalysisRunIdSchema = z.string().uuid("Analysis run id must be a UUID");
const AnalysisRunStatusSchema = z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]);

const AnalysisEngineMetadataSchema = z.object({
  name: z.string().trim().min(1, "Analysis engine name is required"),
  version: z.string().trim().min(1, "Analysis engine version is required"),
});

const AnalysisRunFailureSchema = z
  .object({
    kind: z.string().trim().min(1, "Analysis failure kind is required"),
    code: z.string().trim().min(1, "Analysis failure code is required"),
    message: z.string().trim().min(1, "Analysis failure message is required"),
    details: z.record(z.string(), z.unknown()),
  })
  .strict();

const OptionalRunTimestampSchema = z.string().datetime({ offset: true }).nullable();

const AnalysisRunWorkbookSnapshotSchema = z
  .object({
    hostType: WorkbookMethodHostTypeSchema,
    identity: WorkbookSnapshotIdentitySchema,
    mef: z.record(z.string(), z.unknown()),
  })
  .strict();

const AnalysisRunWorkbookSnapshotsSchema = z
  .array(AnalysisRunWorkbookSnapshotSchema)
  .min(1, "At least one immutable workbook snapshot is required")
  .superRefine((snapshots, context) => {
    const workbookIds = new Set<string>();
    snapshots.forEach((snapshot, index) => {
      if (workbookIds.has(snapshot.identity.workbookId)) {
        context.addIssue({
          code: "custom",
          path: [index, "identity", "workbookId"],
          message: "Each workbook can have only one immutable run snapshot",
        });
      }
      workbookIds.add(snapshot.identity.workbookId);
    });
  });

const ImmutableAnalysisRunContextSchema = z
  .object({
    owner: WorkbookModelSnapshotIdentitySchema,
    sourceWorkbooks: z.array(WorkbookSnapshotIdentitySchema).min(1),
    workbookSnapshots: AnalysisRunWorkbookSnapshotsSchema,
  })
  .strict()
  .superRefine((context, refinement) => {
    const sourceRevisions = new Map(
      context.sourceWorkbooks.map((source) => [source.workbookId, source.workbookRevision]),
    );
    if (sourceRevisions.size !== context.sourceWorkbooks.length) {
      refinement.addIssue({
        code: "custom",
        path: ["sourceWorkbooks"],
        message: "Contributing workbook identities must be unique",
      });
    }
    if (sourceRevisions.get(context.owner.workbookId) !== context.owner.workbookRevision) {
      refinement.addIssue({
        code: "custom",
        path: ["owner"],
        message: "Owner workbook revision must be included in the contributing sources",
      });
    }

    const snapshotRevisions = new Map(
      context.workbookSnapshots.map((snapshot) => [
        snapshot.identity.workbookId,
        snapshot.identity.workbookRevision,
      ]),
    );
    if (
      sourceRevisions.size !== snapshotRevisions.size ||
      [...sourceRevisions].some(
        ([workbookId, workbookRevision]) => snapshotRevisions.get(workbookId) !== workbookRevision,
      )
    ) {
      refinement.addIssue({
        code: "custom",
        path: ["workbookSnapshots"],
        message: "Immutable snapshots must exactly match all contributing workbook revisions",
      });
    }
  });

const AnalysisRunMetadataSchema = z
  .object({
    schemaVersion: AnalysisRunSchemaVersionSchema,
    id: AnalysisRunIdSchema,
    owner: WorkbookModelSnapshotIdentitySchema,
    sourceWorkbooks: z.array(WorkbookSnapshotIdentitySchema).min(1),
    methodType: MethodTypeSchema,
    status: AnalysisRunStatusSchema,
    requestedBy: z.string().trim().min(1, "Requester id is required"),
    requestedAt: z.string().datetime({ offset: true }),
    startedAt: OptionalRunTimestampSchema,
    completedAt: OptionalRunTimestampSchema,
    engine: AnalysisEngineMetadataSchema.nullable(),
    failure: AnalysisRunFailureSchema.nullable().optional(),
  })
  .superRefine((run, context) => {
    const sourceRevisions = new Map<string, number>();
    run.sourceWorkbooks.forEach((source, index) => {
      const priorRevision = sourceRevisions.get(source.workbookId);
      if (priorRevision !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["sourceWorkbooks", index, "workbookId"],
          message: "Each contributing workbook must appear exactly once",
        });
      } else {
        sourceRevisions.set(source.workbookId, source.workbookRevision);
      }
    });
    if (sourceRevisions.get(run.owner.workbookId) !== run.owner.workbookRevision) {
      context.addIssue({
        code: "custom",
        path: ["sourceWorkbooks"],
        message: "Source workbooks must include the owner workbook snapshot",
      });
    }

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

    if (run.status === "FAILED" && (run.failure === undefined || run.failure === null)) {
      context.addIssue({
        code: "custom",
        path: ["failure"],
        message: "Failed runs require structured failure details",
      });
    }
    if (run.status !== "FAILED" && run.failure !== undefined && run.failure !== null) {
      context.addIssue({
        code: "custom",
        path: ["failure"],
        message: "Only failed runs can have failure details",
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

const BayesianNetworkQueryRunTargetSchema = z
  .object({
    targetType: z.literal("BAYESIAN_NETWORK_QUERY"),
    model: WorkbookModelSnapshotIdentitySchema,
    queryNodeIds: z.array(WorkbookEntityIdSchema).min(1),
    evidenceNodeIds: z.array(WorkbookEntityIdSchema),
  })
  .strict();

const HclFaultTreeRunTargetSchema = z
  .object({
    targetType: z.literal("HCL_FAULT_TREE"),
    configuration: WorkbookModelSnapshotIdentitySchema,
    faultTreeTopEvent: WorkbookModelSnapshotIdentitySchema.extend({
      entityId: WorkbookEntityIdSchema,
    }).strict(),
  })
  .strict();

const HclEventTreeRunTargetSchema = z
  .object({
    targetType: z.literal("HCL_EVENT_TREE"),
    configuration: WorkbookModelSnapshotIdentitySchema,
    eventTree: WorkbookModelSnapshotIdentitySchema,
    orchestrator: WorkbookModelSnapshotIdentitySchema.optional(),
  })
  .strict();

const AnalysisRunTargetSchema = z.discriminatedUnion("targetType", [
  BayesianNetworkQueryRunTargetSchema,
  HclFaultTreeRunTargetSchema,
  HclEventTreeRunTargetSchema,
]);

const AnalysisRunContributionSchema = z
  .object({
    hostType: WorkbookMethodHostTypeSchema,
    workbook: WorkbookSnapshotIdentitySchema,
    models: z.array(WorkbookModelAddressSchema),
    entities: z.array(WorkbookCrossReferenceSchema),
  })
  .strict()
  .superRefine((contribution, context) => {
    contribution.models.forEach((model, index) => {
      if (model.workbookId !== contribution.workbook.workbookId) {
        context.addIssue({
          code: "custom",
          path: ["models", index, "workbookId"],
          message: "Contributing models must belong to the contributing workbook",
        });
      }
    });
    contribution.entities.forEach((entity, index) => {
      if (entity.workbookId !== contribution.workbook.workbookId) {
        context.addIssue({
          code: "custom",
          path: ["entities", index, "workbookId"],
          message: "Contributing entities must belong to the contributing workbook",
        });
      }
    });
    const modelKeys = contribution.models.map((model) => `${model.workbookId}:${model.modelId}`);
    if (new Set(modelKeys).size !== modelKeys.length) {
      context.addIssue({
        code: "custom",
        path: ["models"],
        message: "Contributing model references must be unique",
      });
    }
    const entityKeys = contribution.entities.map((entity) => JSON.stringify(entity));
    if (new Set(entityKeys).size !== entityKeys.length) {
      context.addIssue({
        code: "custom",
        path: ["entities"],
        message: "Contributing entity references must be unique",
      });
    }
  });

const AnalysisRunTraceSchema = z
  .object({
    target: AnalysisRunTargetSchema,
    contributions: z.array(AnalysisRunContributionSchema).min(1),
  })
  .strict();

const AnalysisRunProvenanceSchema = z
  .object({
    run: AnalysisRunMetadataSchema,
    ...AnalysisRunTraceSchema.shape,
  })
  .strict()
  .superRefine((provenance, context) => {
    const sourceRevisions = new Map(
      provenance.run.sourceWorkbooks.map((source) => [source.workbookId, source.workbookRevision]),
    );
    const contributionRevisions = new Map(
      provenance.contributions.map((contribution) => [
        contribution.workbook.workbookId,
        contribution.workbook.workbookRevision,
      ]),
    );
    if (
      sourceRevisions.size !== contributionRevisions.size ||
      [...sourceRevisions].some(
        ([workbookId, workbookRevision]) => contributionRevisions.get(workbookId) !== workbookRevision,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["contributions"],
        message: "Run contributions must exactly match every immutable source workbook revision",
      });
    }

    const owner = provenance.target.targetType === "BAYESIAN_NETWORK_QUERY"
      ? provenance.target.model
      : provenance.target.targetType === "HCL_EVENT_TREE" && provenance.target.orchestrator !== undefined
        ? provenance.target.orchestrator
        : provenance.target.configuration;
    if (
      owner.workbookId !== provenance.run.owner.workbookId ||
      owner.workbookRevision !== provenance.run.owner.workbookRevision ||
      owner.modelId !== provenance.run.owner.modelId
    ) {
      context.addIssue({
        code: "custom",
        path: ["target"],
        message: "Run target owner must exactly match the immutable analysis-run owner",
      });
    }
  });

const AnalysisRunProvenanceListSchema = z
  .object({
    schemaVersion: AnalysisRunSchemaVersionSchema,
    runs: z.array(AnalysisRunProvenanceSchema),
  })
  .strict();

type AnalysisRunSchemaVersion = z.infer<typeof AnalysisRunSchemaVersionSchema>;
type AnalysisRunId = z.infer<typeof AnalysisRunIdSchema>;
type AnalysisRunStatus = z.infer<typeof AnalysisRunStatusSchema>;
type AnalysisEngineMetadata = z.infer<typeof AnalysisEngineMetadataSchema>;
type AnalysisRunFailure = z.infer<typeof AnalysisRunFailureSchema>;
type AnalysisRunWorkbookSnapshot = z.infer<typeof AnalysisRunWorkbookSnapshotSchema>;
type AnalysisRunWorkbookSnapshots = z.infer<typeof AnalysisRunWorkbookSnapshotsSchema>;
type ImmutableAnalysisRunContext = z.infer<typeof ImmutableAnalysisRunContextSchema>;
type AnalysisRunMetadata = z.infer<typeof AnalysisRunMetadataSchema>;
type BayesianNetworkQueryRunTarget = z.infer<typeof BayesianNetworkQueryRunTargetSchema>;
type HclFaultTreeRunTarget = z.infer<typeof HclFaultTreeRunTargetSchema>;
type HclEventTreeRunTarget = z.infer<typeof HclEventTreeRunTargetSchema>;
type AnalysisRunTarget = z.infer<typeof AnalysisRunTargetSchema>;
type AnalysisRunContribution = z.infer<typeof AnalysisRunContributionSchema>;
type AnalysisRunTrace = z.infer<typeof AnalysisRunTraceSchema>;
type AnalysisRunProvenance = z.infer<typeof AnalysisRunProvenanceSchema>;
type AnalysisRunProvenanceList = z.infer<typeof AnalysisRunProvenanceListSchema>;

const freezeRecursively = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.values(value).forEach((entry) => freezeRecursively(entry));
  return Object.freeze(value);
};

const createImmutableAnalysisRunContext = (
  input: ImmutableAnalysisRunContext,
): ImmutableAnalysisRunContext =>
  freezeRecursively(ImmutableAnalysisRunContextSchema.parse(input));

export {
  CURRENT_ANALYSIS_RUN_SCHEMA_VERSION,
  AnalysisRunSchemaVersionSchema,
  AnalysisRunIdSchema,
  AnalysisRunStatusSchema,
  AnalysisEngineMetadataSchema,
  AnalysisRunFailureSchema,
  AnalysisRunWorkbookSnapshotSchema,
  AnalysisRunWorkbookSnapshotsSchema,
  ImmutableAnalysisRunContextSchema,
  AnalysisRunMetadataSchema,
  BayesianNetworkQueryRunTargetSchema,
  HclFaultTreeRunTargetSchema,
  HclEventTreeRunTargetSchema,
  AnalysisRunTargetSchema,
  AnalysisRunContributionSchema,
  AnalysisRunTraceSchema,
  AnalysisRunProvenanceSchema,
  AnalysisRunProvenanceListSchema,
  createImmutableAnalysisRunContext,
};
export type {
  AnalysisRunSchemaVersion,
  AnalysisRunId,
  AnalysisRunStatus,
  AnalysisEngineMetadata,
  AnalysisRunFailure,
  AnalysisRunWorkbookSnapshot,
  AnalysisRunWorkbookSnapshots,
  ImmutableAnalysisRunContext,
  AnalysisRunMetadata,
  BayesianNetworkQueryRunTarget,
  HclFaultTreeRunTarget,
  HclEventTreeRunTarget,
  AnalysisRunTarget,
  AnalysisRunContribution,
  AnalysisRunTrace,
  AnalysisRunProvenance,
  AnalysisRunProvenanceList,
};
