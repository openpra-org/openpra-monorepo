import { z } from "zod";
import {
  CanvasLayoutMetadataSchema,
  WorkbookEntityIdSchema,
  WorkbookMethodSchemaVersionSchema,
  WorkbookModelIdSchema,
  WorkbookRevisionSchema,
  ValidationModeSchema,
} from "../shared";
import type {
  CanvasLayoutMetadata,
  WorkbookEntityId,
  WorkbookMethodSchemaVersion,
  WorkbookModelId,
  WorkbookRevision,
  ValidationMode,
} from "../shared";
import type {
  BayesianNetworkConditionalProbabilityTable,
  BayesianNetworkDirectedEdge,
  BayesianNetworkEvidenceConfiguration,
  BayesianNetworkNode,
  BayesianNetworkNodePosition,
  BayesianNetworkXdslMetadata,
} from "./bayesian-network-model";
import {
  BayesianNetworkConditionalProbabilityTableSchema,
  BayesianNetworkDirectedEdgeSchema,
  BayesianNetworkEvidenceConfigurationSchema,
  BayesianNetworkNodePositionSchema,
  BayesianNetworkNodeSchema,
  BayesianNetworkXdslMetadataSchema,
} from "./bayesian-network-schemas";

interface BayesianNetworkQueryRequest {
  evidence: BayesianNetworkEvidenceConfiguration;
  queryNodeIds: WorkbookEntityId[];
}

interface BayesianNetworkCreateRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  code: string;
  name: string;
  description: string;
}

interface BayesianNetworkPatchChanges {
  code?: string;
  name?: string;
  description?: string;
  nodes?: BayesianNetworkNode[];
  edges?: BayesianNetworkDirectedEdge[];
  conditionalProbabilityTables?: BayesianNetworkConditionalProbabilityTable[];
  nodePositions?: BayesianNetworkNodePosition[];
  layout?: CanvasLayoutMetadata;
  xdslMetadata?: BayesianNetworkXdslMetadata;
}

interface BayesianNetworkPatchRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  expectedWorkbookRevision: WorkbookRevision;
  changes: BayesianNetworkPatchChanges;
}

interface BayesianNetworkValidateRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
  mode: ValidationMode;
}

interface BayesianNetworkExecuteRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
  query: BayesianNetworkQueryRequest;
}

const BayesianNetworkQueryRequestSchema = z
  .object({
    evidence: BayesianNetworkEvidenceConfigurationSchema,
    queryNodeIds: z.array(WorkbookEntityIdSchema).min(1, "At least one query node is required"),
  })
  .strict()
  .superRefine((request, context) => {
    const uniqueNodeIds = new Set(request.queryNodeIds);
    if (uniqueNodeIds.size !== request.queryNodeIds.length) {
      context.addIssue({
        code: "custom",
        path: ["queryNodeIds"],
        message: "Query node ids must be unique",
      });
    }
  });

const BayesianNetworkCreateRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    code: z.string().trim().min(1, "Model code is required").max(64, "Model code must be 64 characters or fewer"),
    name: z.string().trim().min(1, "Model name is required").max(200, "Model name must be 200 characters or fewer"),
    description: z.string().max(10_000, "Description must be 10,000 characters or fewer"),
  })
  .strict();

const BayesianNetworkPatchChangesSchema = z
  .object({
    code: z.string().trim().min(1, "Model code is required").max(64, "Model code must be 64 characters or fewer").optional(),
    name: z.string().trim().min(1, "Model name is required").max(200, "Model name must be 200 characters or fewer").optional(),
    description: z.string().max(10_000, "Description must be 10,000 characters or fewer").optional(),
    nodes: z.array(BayesianNetworkNodeSchema).optional(),
    edges: z.array(BayesianNetworkDirectedEdgeSchema).optional(),
    conditionalProbabilityTables: z.array(BayesianNetworkConditionalProbabilityTableSchema).optional(),
    nodePositions: z.array(BayesianNetworkNodePositionSchema).optional(),
    layout: CanvasLayoutMetadataSchema.optional(),
    xdslMetadata: BayesianNetworkXdslMetadataSchema.optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "At least one Bayesian-network change is required");

const BayesianNetworkPatchRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    expectedWorkbookRevision: WorkbookRevisionSchema,
    changes: BayesianNetworkPatchChangesSchema,
  })
  .strict();

const BayesianNetworkValidateRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    mode: ValidationModeSchema,
  })
  .strict();

const BayesianNetworkExecuteRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    query: BayesianNetworkQueryRequestSchema,
  })
  .strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertBayesianNetworkQueryRequest = Expect<
  Equal<z.infer<typeof BayesianNetworkQueryRequestSchema>, BayesianNetworkQueryRequest>
>;
type _AssertBayesianNetworkCreateRequest = Expect<
  Equal<z.infer<typeof BayesianNetworkCreateRequestSchema>, BayesianNetworkCreateRequest>
>;
type _AssertBayesianNetworkPatchChanges = Expect<
  Equal<z.infer<typeof BayesianNetworkPatchChangesSchema>, BayesianNetworkPatchChanges>
>;
type _AssertBayesianNetworkPatchRequest = Expect<
  Equal<z.infer<typeof BayesianNetworkPatchRequestSchema>, BayesianNetworkPatchRequest>
>;
type _AssertBayesianNetworkValidateRequest = Expect<
  Equal<z.infer<typeof BayesianNetworkValidateRequestSchema>, BayesianNetworkValidateRequest>
>;
type _AssertBayesianNetworkExecuteRequest = Expect<
  Equal<z.infer<typeof BayesianNetworkExecuteRequestSchema>, BayesianNetworkExecuteRequest>
>;

export {
  BayesianNetworkQueryRequestSchema,
  BayesianNetworkCreateRequestSchema,
  BayesianNetworkPatchChangesSchema,
  BayesianNetworkPatchRequestSchema,
  BayesianNetworkValidateRequestSchema,
  BayesianNetworkExecuteRequestSchema,
};
export type {
  BayesianNetworkQueryRequest,
  BayesianNetworkCreateRequest,
  BayesianNetworkPatchChanges,
  BayesianNetworkPatchRequest,
  BayesianNetworkValidateRequest,
  BayesianNetworkExecuteRequest,
};
