import { z } from "zod";
import {
  CanvasLayoutMetadataSchema,
  MethodEntityIdSchema,
  MethodModelIdSchema,
  MethodModelRevisionSchema,
  MethodModelSchemaVersionSchema,
  ValidationModeSchema,
} from "../shared";
import type {
  CanvasLayoutMetadata,
  MethodEntityId,
  MethodModelId,
  MethodModelRevision,
  MethodModelSchemaVersion,
  ValidationMode,
} from "../shared";
import type {
  BayesianNetworkConditionalProbabilityTable,
  BayesianNetworkDirectedEdge,
  BayesianNetworkEvidenceConfiguration,
  BayesianNetworkNode,
  BayesianNetworkNodePosition,
} from "./bayesian-network-model";
import {
  BayesianNetworkConditionalProbabilityTableSchema,
  BayesianNetworkDirectedEdgeSchema,
  BayesianNetworkEvidenceConfigurationSchema,
  BayesianNetworkNodePositionSchema,
  BayesianNetworkNodeSchema,
} from "./bayesian-network-schemas";

interface BayesianNetworkQueryRequest {
  evidence: BayesianNetworkEvidenceConfiguration;
  queryNodeIds: MethodEntityId[];
}

interface BayesianNetworkCreateRequest {
  schemaVersion: MethodModelSchemaVersion;
  projectId: string;
  code: string;
  name: string;
  description: string;
  createdBy: string;
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
}

interface BayesianNetworkPatchRequest {
  schemaVersion: MethodModelSchemaVersion;
  modelId: MethodModelId;
  expectedRevision: MethodModelRevision;
  updatedBy: string;
  changes: BayesianNetworkPatchChanges;
}

interface BayesianNetworkValidateRequest {
  schemaVersion: MethodModelSchemaVersion;
  modelId: MethodModelId;
  revision: MethodModelRevision;
  mode: ValidationMode;
  requestedBy: string;
}

interface BayesianNetworkExecuteRequest {
  schemaVersion: MethodModelSchemaVersion;
  modelId: MethodModelId;
  revision: MethodModelRevision;
  requestedBy: string;
  query: BayesianNetworkQueryRequest;
}

const BayesianNetworkQueryRequestSchema = z
  .object({
    evidence: BayesianNetworkEvidenceConfigurationSchema,
    queryNodeIds: z.array(MethodEntityIdSchema).min(1, "At least one query node is required"),
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
    schemaVersion: MethodModelSchemaVersionSchema,
    projectId: z.string().trim().min(1, "Project id is required"),
    code: z.string().trim().min(1, "Model code is required").max(64, "Model code must be 64 characters or fewer"),
    name: z.string().trim().min(1, "Model name is required").max(200, "Model name must be 200 characters or fewer"),
    description: z.string().max(10_000, "Description must be 10,000 characters or fewer"),
    createdBy: z.string().trim().min(1, "Creator id is required"),
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
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "At least one Bayesian-network change is required");

const BayesianNetworkPatchRequestSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    modelId: MethodModelIdSchema,
    expectedRevision: MethodModelRevisionSchema,
    updatedBy: z.string().trim().min(1, "Updater id is required"),
    changes: BayesianNetworkPatchChangesSchema,
  })
  .strict();

const BayesianNetworkValidateRequestSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    modelId: MethodModelIdSchema,
    revision: MethodModelRevisionSchema,
    mode: ValidationModeSchema,
    requestedBy: z.string().trim().min(1, "Requester id is required"),
  })
  .strict();

const BayesianNetworkExecuteRequestSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    modelId: MethodModelIdSchema,
    revision: MethodModelRevisionSchema,
    requestedBy: z.string().trim().min(1, "Requester id is required"),
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
