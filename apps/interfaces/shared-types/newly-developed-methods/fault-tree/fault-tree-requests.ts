import { z } from "zod";
import {
  WorkbookMethodSchemaVersionSchema,
  ValidationModeSchema,
  WorkbookModelIdSchema,
  WorkbookRevisionSchema,
} from "../shared";
import type {
  CanvasLayoutMetadata,
  WorkbookMethodSchemaVersion,
  ValidationMode,
  WorkbookModelId,
  WorkbookRevision,
} from "../shared";
import type {
  FaultTreeBasicEvent,
  FaultTreeGate,
  FaultTreeGateInput,
  FaultTreeLeafNode,
  FaultTreeNodePosition,
  FaultTreeTopGateReference,
} from "./fault-tree-model";
import {
  FaultTreeBasicEventSchema,
  FaultTreeGateInputSchema,
  FaultTreeGateSchema,
  FaultTreeLeafNodeSchema,
  FaultTreeNodePositionSchema,
  FaultTreeTopGateReferenceSchema,
} from "./fault-tree-schemas";
import { CanvasLayoutMetadataSchema } from "../shared";

interface FaultTreeCreateRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  code: string;
  name: string;
  description: string;
}

interface FaultTreePatchChanges {
  code?: string;
  name?: string;
  description?: string;
  topGate?: FaultTreeTopGateReference | null;
  gates?: FaultTreeGate[];
  leafNodes?: FaultTreeLeafNode[];
  gateInputs?: FaultTreeGateInput[];
  nodePositions?: FaultTreeNodePosition[];
  layout?: CanvasLayoutMetadata;
}

interface FaultTreePatchRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  expectedWorkbookRevision: WorkbookRevision;
  changes: FaultTreePatchChanges;
}

interface FaultTreeValidateRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
  mode: ValidationMode;
}

interface FaultTreeExecuteRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
}

interface FaultTreeBasicEventCatalogueCreateRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  basicEvents: FaultTreeBasicEvent[];
}

interface FaultTreeBasicEventCataloguePatchRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  expectedWorkbookRevision: WorkbookRevision;
  basicEvents: FaultTreeBasicEvent[];
}

const FaultTreeCreateRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    code: z.string().trim().min(1, "Model code is required").max(64, "Model code must be 64 characters or fewer"),
    name: z.string().trim().min(1, "Model name is required").max(200, "Model name must be 200 characters or fewer"),
    description: z.string().max(10_000, "Description must be 10,000 characters or fewer"),
  })
  .strict();

const FaultTreePatchChangesSchema = z
  .object({
    code: z.string().trim().min(1, "Model code is required").max(64, "Model code must be 64 characters or fewer").optional(),
    name: z.string().trim().min(1, "Model name is required").max(200, "Model name must be 200 characters or fewer").optional(),
    description: z.string().max(10_000, "Description must be 10,000 characters or fewer").optional(),
    topGate: FaultTreeTopGateReferenceSchema.nullable().optional(),
    gates: z.array(FaultTreeGateSchema).optional(),
    leafNodes: z.array(FaultTreeLeafNodeSchema).optional(),
    gateInputs: z.array(FaultTreeGateInputSchema).optional(),
    nodePositions: z.array(FaultTreeNodePositionSchema).optional(),
    layout: CanvasLayoutMetadataSchema.optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "At least one fault-tree change is required");

const FaultTreePatchRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    expectedWorkbookRevision: WorkbookRevisionSchema,
    changes: FaultTreePatchChangesSchema,
  })
  .strict();

const FaultTreeValidateRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    mode: ValidationModeSchema,
  })
  .strict();

const FaultTreeExecuteRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
  })
  .strict();

const FaultTreeBasicEventCatalogueCreateRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    basicEvents: z.array(FaultTreeBasicEventSchema),
  })
  .strict();

const FaultTreeBasicEventCataloguePatchRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    expectedWorkbookRevision: WorkbookRevisionSchema,
    basicEvents: z.array(FaultTreeBasicEventSchema),
  })
  .strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertFaultTreeCreateRequest = Expect<
  Equal<z.infer<typeof FaultTreeCreateRequestSchema>, FaultTreeCreateRequest>
>;
type _AssertFaultTreePatchChanges = Expect<
  Equal<z.infer<typeof FaultTreePatchChangesSchema>, FaultTreePatchChanges>
>;
type _AssertFaultTreePatchRequest = Expect<
  Equal<z.infer<typeof FaultTreePatchRequestSchema>, FaultTreePatchRequest>
>;
type _AssertFaultTreeValidateRequest = Expect<
  Equal<z.infer<typeof FaultTreeValidateRequestSchema>, FaultTreeValidateRequest>
>;
type _AssertFaultTreeExecuteRequest = Expect<
  Equal<z.infer<typeof FaultTreeExecuteRequestSchema>, FaultTreeExecuteRequest>
>;
type _AssertFaultTreeBasicEventCatalogueCreateRequest = Expect<
  Equal<
    z.infer<typeof FaultTreeBasicEventCatalogueCreateRequestSchema>,
    FaultTreeBasicEventCatalogueCreateRequest
  >
>;
type _AssertFaultTreeBasicEventCataloguePatchRequest = Expect<
  Equal<
    z.infer<typeof FaultTreeBasicEventCataloguePatchRequestSchema>,
    FaultTreeBasicEventCataloguePatchRequest
  >
>;

export {
  FaultTreeCreateRequestSchema,
  FaultTreePatchChangesSchema,
  FaultTreePatchRequestSchema,
  FaultTreeValidateRequestSchema,
  FaultTreeExecuteRequestSchema,
  FaultTreeBasicEventCatalogueCreateRequestSchema,
  FaultTreeBasicEventCataloguePatchRequestSchema,
};
export type {
  FaultTreeCreateRequest,
  FaultTreePatchChanges,
  FaultTreePatchRequest,
  FaultTreeValidateRequest,
  FaultTreeExecuteRequest,
  FaultTreeBasicEventCatalogueCreateRequest,
  FaultTreeBasicEventCataloguePatchRequest,
};
