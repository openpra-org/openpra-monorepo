import { z } from "zod";

const MethodModelIdSchema = z.string().uuid("Model id must be a UUID");
const MethodEntityIdSchema = z.string().uuid("Entity id must be a UUID");

const MethodTypeSchema = z.enum(["FAULT_TREE", "BAYESIAN_NETWORK", "EVENT_TREE", "HYBRID_CAUSAL_LOGIC"]);

const MethodModelIdentitySchema = z.object({
  id: MethodModelIdSchema,
  projectId: z.string().trim().min(1, "Project id is required"),
  methodType: MethodTypeSchema,
  code: z.string().trim().min(1, "Model code is required").max(64, "Model code must be 64 characters or fewer"),
  name: z.string().trim().min(1, "Model name is required").max(200, "Model name must be 200 characters or fewer"),
  description: z.string().max(10_000, "Description must be 10,000 characters or fewer"),
});

const CURRENT_METHOD_MODEL_SCHEMA_VERSION = "1.0.0" as const;
const MethodModelSchemaVersionSchema = z.literal(CURRENT_METHOD_MODEL_SCHEMA_VERSION);
const MethodModelRevisionSchema = z.number().int().positive("Model revision must be a positive integer");

const MethodModelAuditSchema = z.object({
  createdBy: z.string().trim().min(1, "Creator id is required"),
  createdAt: z.string().datetime({ offset: true }),
  updatedBy: z.string().trim().min(1, "Updater id is required"),
  updatedAt: z.string().datetime({ offset: true }),
});

const MethodModelMetadataSchema = MethodModelIdentitySchema.extend({
  schemaVersion: MethodModelSchemaVersionSchema,
  revision: MethodModelRevisionSchema,
  ...MethodModelAuditSchema.shape,
});

const MethodModelListResponseSchema = z
  .object({
    models: z.array(MethodModelMetadataSchema),
  })
  .strict();

const MethodModelReferencePathSchema = z.string().startsWith("/", "Reference path must be a JSON pointer");

const ReferencingMethodModelSchema = MethodModelMetadataSchema.extend({
  referencePaths: z.array(MethodModelReferencePathSchema).min(1),
}).strict();

const ReferencingWorkbookSchema = z
  .object({
    id: z.string().trim().min(1, "Workbook id is required"),
    projectId: z.string().trim().min(1, "Project id is required"),
    elementCode: z.string().trim().min(1, "Element code is required"),
    name: z.string().trim().min(1, "Workbook name is required"),
    referencePaths: z.array(MethodModelReferencePathSchema).min(1),
  })
  .strict();

const MethodModelDependenciesResponseSchema = z
  .object({
    modelId: MethodModelIdSchema,
    models: z.array(ReferencingMethodModelSchema),
    workbooks: z.array(ReferencingWorkbookSchema),
  })
  .strict();

const CanvasPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const CanvasViewportSchema = CanvasPositionSchema.extend({
  zoom: z.number().min(0.05, "Canvas zoom is too small").max(8, "Canvas zoom is too large"),
});

const CanvasLayoutModeSchema = z.enum(["MANUAL", "AUTOMATIC"]);
const CanvasLayoutDirectionSchema = z.enum(["TOP_TO_BOTTOM", "LEFT_TO_RIGHT"]);

const CanvasLayoutMetadataSchema = z.object({
  viewport: CanvasViewportSchema,
  mode: CanvasLayoutModeSchema,
  direction: CanvasLayoutDirectionSchema,
});

const MethodModelReferenceSchema = z
  .object({
    modelId: MethodModelIdSchema,
  })
  .strict();

const MethodEntityReferenceSchema = z
  .object({
    modelId: MethodModelIdSchema,
    entityId: MethodEntityIdSchema,
  })
  .strict();

type MethodModelId = z.infer<typeof MethodModelIdSchema>;
type MethodEntityId = z.infer<typeof MethodEntityIdSchema>;
type MethodType = z.infer<typeof MethodTypeSchema>;
type MethodModelIdentity = z.infer<typeof MethodModelIdentitySchema>;
type MethodModelSchemaVersion = z.infer<typeof MethodModelSchemaVersionSchema>;
type MethodModelRevision = z.infer<typeof MethodModelRevisionSchema>;
type MethodModelAudit = z.infer<typeof MethodModelAuditSchema>;
type MethodModelMetadata = z.infer<typeof MethodModelMetadataSchema>;
type MethodModelListResponse = z.infer<typeof MethodModelListResponseSchema>;
type MethodModelReferencePath = z.infer<typeof MethodModelReferencePathSchema>;
type ReferencingMethodModel = z.infer<typeof ReferencingMethodModelSchema>;
type ReferencingWorkbook = z.infer<typeof ReferencingWorkbookSchema>;
type MethodModelDependenciesResponse = z.infer<typeof MethodModelDependenciesResponseSchema>;
type CanvasPosition = z.infer<typeof CanvasPositionSchema>;
type CanvasViewport = z.infer<typeof CanvasViewportSchema>;
type CanvasLayoutMode = z.infer<typeof CanvasLayoutModeSchema>;
type CanvasLayoutDirection = z.infer<typeof CanvasLayoutDirectionSchema>;
type CanvasLayoutMetadata = z.infer<typeof CanvasLayoutMetadataSchema>;
type MethodModelReference = z.infer<typeof MethodModelReferenceSchema>;
type MethodEntityReference = z.infer<typeof MethodEntityReferenceSchema>;

export {
  CURRENT_METHOD_MODEL_SCHEMA_VERSION,
  MethodModelIdSchema,
  MethodEntityIdSchema,
  MethodTypeSchema,
  MethodModelIdentitySchema,
  MethodModelSchemaVersionSchema,
  MethodModelRevisionSchema,
  MethodModelAuditSchema,
  MethodModelMetadataSchema,
  MethodModelListResponseSchema,
  MethodModelReferencePathSchema,
  ReferencingMethodModelSchema,
  ReferencingWorkbookSchema,
  MethodModelDependenciesResponseSchema,
  CanvasPositionSchema,
  CanvasViewportSchema,
  CanvasLayoutModeSchema,
  CanvasLayoutDirectionSchema,
  CanvasLayoutMetadataSchema,
  MethodModelReferenceSchema,
  MethodEntityReferenceSchema,
};
export type {
  MethodModelId,
  MethodEntityId,
  MethodType,
  MethodModelIdentity,
  MethodModelSchemaVersion,
  MethodModelRevision,
  MethodModelAudit,
  MethodModelMetadata,
  MethodModelListResponse,
  MethodModelReferencePath,
  ReferencingMethodModel,
  ReferencingWorkbook,
  MethodModelDependenciesResponse,
  CanvasPosition,
  CanvasViewport,
  CanvasLayoutMode,
  CanvasLayoutDirection,
  CanvasLayoutMetadata,
  MethodModelReference,
  MethodEntityReference,
};
