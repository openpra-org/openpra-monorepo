import { z } from "zod";
import {
  CanvasLayoutDirectionSchema,
  CanvasLayoutMetadataSchema,
  CanvasLayoutModeSchema,
  CanvasPositionSchema,
  CanvasViewportSchema,
  MethodEntityIdSchema,
  MethodEntityReferenceSchema,
  MethodModelIdSchema,
  MethodModelReferenceSchema,
  BayesianNetworkNodeReferenceSchema,
  EventTreeFunctionalEventReferenceSchema,
  FaultTreeBasicEventCatalogueReferenceSchema,
  FaultTreeTopEventReferenceSchema,
  HclBindingReferenceSchema,
  WorkbookAddressSchema,
  WorkbookCrossReferenceSchema,
  WorkbookCrossReferenceTypeSchema,
  WorkbookEntityAddressSchema,
  WorkbookEntityIdSchema,
  WorkbookEntityIdentitySchema,
  WorkbookIdSchema,
  WorkbookModelAddressSchema,
  WorkbookModelEntityAddressSchema,
  WorkbookModelEntitySnapshotIdentitySchema,
  WorkbookModelIdSchema,
  WorkbookModelIdentitySchema,
  WorkbookModelSnapshotIdentitySchema,
  WorkbookRevisionSchema,
  WorkbookSnapshotIdentitySchema,
  WorkbookParameterReferenceSchema,
} from "interfaces-mef-types/zod/modeling";
import type {
  BayesianNetworkNodeReference,
  CanvasLayoutDirection,
  CanvasLayoutMetadata,
  CanvasLayoutMode,
  CanvasPosition,
  CanvasViewport,
  EventTreeFunctionalEventReference,
  FaultTreeBasicEventCatalogueReference,
  FaultTreeTopEventReference,
  HclBindingReference,
  MethodEntityId,
  MethodEntityReference,
  MethodModelId,
  MethodModelReference,
  WorkbookAddress,
  WorkbookCrossReference,
  WorkbookCrossReferenceType,
  WorkbookEntityAddress,
  WorkbookEntityId,
  WorkbookEntityIdentity,
  WorkbookId,
  WorkbookModelAddress,
  WorkbookModelEntityAddress,
  WorkbookModelEntitySnapshotIdentity,
  WorkbookModelId,
  WorkbookModelIdentity,
  WorkbookModelSnapshotIdentity,
  WorkbookRevision,
  WorkbookSnapshotIdentity,
  WorkbookParameterReference,
} from "interfaces-mef-types/modeling";

const MethodTypeSchema = z.enum(["FAULT_TREE", "BAYESIAN_NETWORK", "EVENT_TREE", "HYBRID_CAUSAL_LOGIC"]);

const CURRENT_WORKBOOK_METHOD_SCHEMA_VERSION = "1.0.0" as const;
const WorkbookMethodSchemaVersionSchema = z.literal(CURRENT_WORKBOOK_METHOD_SCHEMA_VERSION);

const WorkbookOwnershipMetadataSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    workbookId: WorkbookIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    ownerUsername: z.string().trim().min(1, "Workbook owner is required"),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

const WorkbookOwnedModelMetadataSchema = WorkbookOwnershipMetadataSchema.extend({
  modelId: WorkbookModelIdSchema,
  methodType: MethodTypeSchema,
}).strict();

const LegacyProjectMethodModelIdentitySchema = z.object({
  id: MethodModelIdSchema,
  projectId: z.string().trim().min(1, "Project id is required"),
  methodType: MethodTypeSchema,
  code: z.string().trim().min(1, "Model code is required").max(64, "Model code must be 64 characters or fewer"),
  name: z.string().trim().min(1, "Model name is required").max(200, "Model name must be 200 characters or fewer"),
  description: z.string().max(10_000, "Description must be 10,000 characters or fewer"),
});

/** @deprecated Standalone project models are retained only until workbook ownership migration is complete. */
const MethodModelIdentitySchema = LegacyProjectMethodModelIdentitySchema;

const CURRENT_METHOD_MODEL_SCHEMA_VERSION = "1.0.0" as const;
const MethodModelSchemaVersionSchema = z.literal(CURRENT_METHOD_MODEL_SCHEMA_VERSION);
const MethodModelRevisionSchema = z.number().int().positive("Model revision must be a positive integer");

const MethodModelAuditSchema = z.object({
  createdBy: z.string().trim().min(1, "Creator id is required"),
  createdAt: z.string().datetime({ offset: true }),
  updatedBy: z.string().trim().min(1, "Updater id is required"),
  updatedAt: z.string().datetime({ offset: true }),
});

const LegacyProjectMethodModelMetadataSchema = LegacyProjectMethodModelIdentitySchema.extend({
  schemaVersion: MethodModelSchemaVersionSchema,
  revision: MethodModelRevisionSchema,
  ...MethodModelAuditSchema.shape,
});

/** @deprecated Standalone project models are retained only until workbook ownership migration is complete. */
const MethodModelMetadataSchema = LegacyProjectMethodModelMetadataSchema;

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

type MethodType = z.infer<typeof MethodTypeSchema>;
type WorkbookMethodSchemaVersion = z.infer<typeof WorkbookMethodSchemaVersionSchema>;
type WorkbookOwnershipMetadata = z.infer<typeof WorkbookOwnershipMetadataSchema>;
type WorkbookOwnedModelMetadata = z.infer<typeof WorkbookOwnedModelMetadataSchema>;
type LegacyProjectMethodModelIdentity = z.infer<typeof LegacyProjectMethodModelIdentitySchema>;
/** @deprecated Standalone project models are retained only until workbook ownership migration is complete. */
type MethodModelIdentity = LegacyProjectMethodModelIdentity;
type MethodModelSchemaVersion = z.infer<typeof MethodModelSchemaVersionSchema>;
type MethodModelRevision = z.infer<typeof MethodModelRevisionSchema>;
type MethodModelAudit = z.infer<typeof MethodModelAuditSchema>;
type LegacyProjectMethodModelMetadata = z.infer<typeof LegacyProjectMethodModelMetadataSchema>;
/** @deprecated Standalone project models are retained only until workbook ownership migration is complete. */
type MethodModelMetadata = LegacyProjectMethodModelMetadata;
type MethodModelListResponse = z.infer<typeof MethodModelListResponseSchema>;
type MethodModelReferencePath = z.infer<typeof MethodModelReferencePathSchema>;
type ReferencingMethodModel = z.infer<typeof ReferencingMethodModelSchema>;
type ReferencingWorkbook = z.infer<typeof ReferencingWorkbookSchema>;
type MethodModelDependenciesResponse = z.infer<typeof MethodModelDependenciesResponseSchema>;

export {
  CURRENT_WORKBOOK_METHOD_SCHEMA_VERSION,
  CURRENT_METHOD_MODEL_SCHEMA_VERSION,
  WorkbookIdSchema,
  WorkbookRevisionSchema,
  WorkbookModelIdSchema,
  WorkbookEntityIdSchema,
  WorkbookAddressSchema,
  WorkbookModelAddressSchema,
  WorkbookEntityAddressSchema,
  WorkbookModelEntityAddressSchema,
  WorkbookSnapshotIdentitySchema,
  WorkbookModelSnapshotIdentitySchema,
  WorkbookModelEntitySnapshotIdentitySchema,
  WorkbookModelIdentitySchema,
  WorkbookEntityIdentitySchema,
  WorkbookCrossReferenceTypeSchema,
  FaultTreeTopEventReferenceSchema,
  FaultTreeBasicEventCatalogueReferenceSchema,
  EventTreeFunctionalEventReferenceSchema,
  BayesianNetworkNodeReferenceSchema,
  HclBindingReferenceSchema,
  WorkbookCrossReferenceSchema,
  WorkbookParameterReferenceSchema,
  MethodModelIdSchema,
  MethodEntityIdSchema,
  MethodTypeSchema,
  WorkbookMethodSchemaVersionSchema,
  WorkbookOwnershipMetadataSchema,
  WorkbookOwnedModelMetadataSchema,
  LegacyProjectMethodModelIdentitySchema,
  MethodModelIdentitySchema,
  MethodModelSchemaVersionSchema,
  MethodModelRevisionSchema,
  MethodModelAuditSchema,
  LegacyProjectMethodModelMetadataSchema,
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
  WorkbookId,
  WorkbookRevision,
  WorkbookModelId,
  WorkbookEntityId,
  WorkbookAddress,
  WorkbookModelAddress,
  WorkbookEntityAddress,
  WorkbookModelEntityAddress,
  WorkbookSnapshotIdentity,
  WorkbookModelSnapshotIdentity,
  WorkbookModelEntitySnapshotIdentity,
  WorkbookModelIdentity,
  WorkbookEntityIdentity,
  WorkbookCrossReferenceType,
  FaultTreeTopEventReference,
  FaultTreeBasicEventCatalogueReference,
  EventTreeFunctionalEventReference,
  BayesianNetworkNodeReference,
  HclBindingReference,
  WorkbookCrossReference,
  WorkbookParameterReference,
  MethodModelId,
  MethodEntityId,
  MethodType,
  WorkbookMethodSchemaVersion,
  WorkbookOwnershipMetadata,
  WorkbookOwnedModelMetadata,
  LegacyProjectMethodModelIdentity,
  MethodModelIdentity,
  MethodModelSchemaVersion,
  MethodModelRevision,
  MethodModelAudit,
  LegacyProjectMethodModelMetadata,
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
