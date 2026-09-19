import { z } from "zod";
import type {
  CanvasLayoutDirection,
  CanvasLayoutMetadata,
  CanvasLayoutMode,
  CanvasPosition,
  CanvasViewport,
  WorkbookAddress,
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
  MethodEntityId,
  MethodEntityReference,
  MethodModelId,
  MethodModelReference,
} from "../../modeling/shared";

const WorkbookIdSchema = z.string().trim().min(1, "Workbook id is required");
const WorkbookRevisionSchema = z.number().int().positive("Workbook revision must be a positive integer");
const WorkbookModelIdSchema = z.string().uuid("Workbook-local model id must be a UUID");
const WorkbookEntityIdSchema = z.string().uuid("Workbook-local entity id must be a UUID");

const WorkbookAddressSchema = z
  .object({
    workbookId: WorkbookIdSchema,
  })
  .strict();

const WorkbookModelAddressSchema = WorkbookAddressSchema.extend({
  modelId: WorkbookModelIdSchema,
}).strict();

const WorkbookEntityAddressSchema = WorkbookAddressSchema.extend({
  entityId: WorkbookEntityIdSchema,
}).strict();

const WorkbookModelEntityAddressSchema = WorkbookModelAddressSchema.extend({
  entityId: WorkbookEntityIdSchema,
}).strict();

const WorkbookSnapshotIdentitySchema = WorkbookAddressSchema.extend({
  workbookRevision: WorkbookRevisionSchema,
}).strict();

const WorkbookModelSnapshotIdentitySchema = WorkbookModelAddressSchema.extend({
  workbookRevision: WorkbookRevisionSchema,
}).strict();

const WorkbookModelEntitySnapshotIdentitySchema = WorkbookModelEntityAddressSchema.extend({
  workbookRevision: WorkbookRevisionSchema,
}).strict();

/** @deprecated Use WorkbookModelSnapshotIdentitySchema; revisions do not belong in durable addresses. */
const WorkbookModelIdentitySchema = WorkbookModelSnapshotIdentitySchema;

/** @deprecated Use WorkbookModelEntitySnapshotIdentitySchema; revisions do not belong in durable addresses. */
const WorkbookEntityIdentitySchema = WorkbookModelEntitySnapshotIdentitySchema;

/*
 * Legacy project-model transport aliases below remain until the backend ownership
 * migration removes the standalone project routes.
 */
const LegacyMethodModelReferenceSchema = z
  .object({
    modelId: WorkbookModelIdSchema,
  })
  .strict();

/** @deprecated Use WorkbookModelIdSchema for workbook-owned model definitions. */
const MethodModelIdSchema = WorkbookModelIdSchema;
/** @deprecated Use WorkbookEntityIdSchema for workbook-owned model definitions. */
const MethodEntityIdSchema = WorkbookEntityIdSchema;

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

/** @deprecated Use a typed workbook reference schema with workbook scope. */
const MethodModelReferenceSchema = LegacyMethodModelReferenceSchema;

/** @deprecated Use a typed workbook reference schema with workbook and entity scope. */
const MethodEntityReferenceSchema = z
  .object({
    modelId: MethodModelIdSchema,
    entityId: MethodEntityIdSchema,
  })
  .strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertWorkbookId = Expect<Equal<z.infer<typeof WorkbookIdSchema>, WorkbookId>>;
type _AssertWorkbookRevision = Expect<Equal<z.infer<typeof WorkbookRevisionSchema>, WorkbookRevision>>;
type _AssertWorkbookModelId = Expect<Equal<z.infer<typeof WorkbookModelIdSchema>, WorkbookModelId>>;
type _AssertWorkbookEntityId = Expect<Equal<z.infer<typeof WorkbookEntityIdSchema>, WorkbookEntityId>>;
type _AssertWorkbookAddress = Expect<Equal<z.infer<typeof WorkbookAddressSchema>, WorkbookAddress>>;
type _AssertWorkbookModelAddress = Expect<
  Equal<z.infer<typeof WorkbookModelAddressSchema>, WorkbookModelAddress>
>;
type _AssertWorkbookEntityAddress = Expect<
  Equal<z.infer<typeof WorkbookEntityAddressSchema>, WorkbookEntityAddress>
>;
type _AssertWorkbookModelEntityAddress = Expect<
  Equal<z.infer<typeof WorkbookModelEntityAddressSchema>, WorkbookModelEntityAddress>
>;
type _AssertWorkbookSnapshotIdentity = Expect<
  Equal<z.infer<typeof WorkbookSnapshotIdentitySchema>, WorkbookSnapshotIdentity>
>;
type _AssertWorkbookModelSnapshotIdentity = Expect<
  Equal<z.infer<typeof WorkbookModelSnapshotIdentitySchema>, WorkbookModelSnapshotIdentity>
>;
type _AssertWorkbookModelEntitySnapshotIdentity = Expect<
  Equal<
    z.infer<typeof WorkbookModelEntitySnapshotIdentitySchema>,
    WorkbookModelEntitySnapshotIdentity
  >
>;
type _AssertWorkbookModelIdentity = Expect<
  Equal<z.infer<typeof WorkbookModelIdentitySchema>, WorkbookModelIdentity>
>;
type _AssertWorkbookEntityIdentity = Expect<
  Equal<z.infer<typeof WorkbookEntityIdentitySchema>, WorkbookEntityIdentity>
>;
type _AssertMethodModelId = Expect<Equal<z.infer<typeof MethodModelIdSchema>, MethodModelId>>;
type _AssertMethodEntityId = Expect<Equal<z.infer<typeof MethodEntityIdSchema>, MethodEntityId>>;
type _AssertCanvasPosition = Expect<Equal<z.infer<typeof CanvasPositionSchema>, CanvasPosition>>;
type _AssertCanvasViewport = Expect<Equal<z.infer<typeof CanvasViewportSchema>, CanvasViewport>>;
type _AssertCanvasLayoutMode = Expect<Equal<z.infer<typeof CanvasLayoutModeSchema>, CanvasLayoutMode>>;
type _AssertCanvasLayoutDirection = Expect<
  Equal<z.infer<typeof CanvasLayoutDirectionSchema>, CanvasLayoutDirection>
>;
type _AssertCanvasLayoutMetadata = Expect<
  Equal<z.infer<typeof CanvasLayoutMetadataSchema>, CanvasLayoutMetadata>
>;
type _AssertMethodModelReference = Expect<
  Equal<z.infer<typeof MethodModelReferenceSchema>, MethodModelReference>
>;
type _AssertMethodEntityReference = Expect<
  Equal<z.infer<typeof MethodEntityReferenceSchema>, MethodEntityReference>
>;

export {
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
  MethodModelIdSchema,
  MethodEntityIdSchema,
  CanvasPositionSchema,
  CanvasViewportSchema,
  CanvasLayoutModeSchema,
  CanvasLayoutDirectionSchema,
  CanvasLayoutMetadataSchema,
  MethodModelReferenceSchema,
  MethodEntityReferenceSchema,
};
