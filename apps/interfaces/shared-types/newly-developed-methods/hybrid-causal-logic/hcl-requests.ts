import { z } from "zod";
import {
  MethodEntityReferenceSchema,
  MethodModelIdSchema,
  MethodModelReferenceSchema,
  MethodModelRevisionSchema,
  MethodModelSchemaVersionSchema,
  ValidationModeSchema,
} from "../shared";
import type {
  MethodEntityReference,
  MethodModelId,
  MethodModelReference,
  MethodModelRevision,
  MethodModelSchemaVersion,
  ValidationMode,
} from "../shared";
import type {
  HclBaseEvidence,
  HclFaultTreeReference,
  HclSolverSettings,
} from "./hcl-configuration";
import type { HclEventBinding } from "./hcl-bindings";
import {
  HclBaseEvidenceSchema,
  HclEventBindingSchema,
  HclFaultTreeReferenceSchema,
  HclSolverSettingsSchema,
} from "./hcl-schemas";

interface HclCreateRequest {
  schemaVersion: MethodModelSchemaVersion;
  projectId: string;
  code: string;
  name: string;
  description: string;
  createdBy: string;
  bayesianNetwork: MethodModelReference;
}

interface HclPatchChanges {
  code?: string;
  name?: string;
  description?: string;
  bayesianNetwork?: MethodModelReference;
  faultTrees?: HclFaultTreeReference[];
  bindings?: HclEventBinding[];
  baseEvidence?: HclBaseEvidence;
  solverSettings?: HclSolverSettings;
}

interface HclPatchRequest {
  schemaVersion: MethodModelSchemaVersion;
  modelId: MethodModelId;
  expectedRevision: MethodModelRevision;
  updatedBy: string;
  changes: HclPatchChanges;
}

interface HclValidateRequest {
  schemaVersion: MethodModelSchemaVersion;
  modelId: MethodModelId;
  revision: MethodModelRevision;
  mode: ValidationMode;
  requestedBy: string;
}

interface HclExecuteRequest {
  schemaVersion: MethodModelSchemaVersion;
  modelId: MethodModelId;
  revision: MethodModelRevision;
  requestedBy: string;
  faultTreeTopGate: MethodEntityReference;
}

const HclCreateRequestSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    projectId: z.string().trim().min(1, "Project id is required"),
    code: z.string().trim().min(1, "Model code is required").max(64, "Model code must be 64 characters or fewer"),
    name: z.string().trim().min(1, "Model name is required").max(200, "Model name must be 200 characters or fewer"),
    description: z.string().max(10_000, "Description must be 10,000 characters or fewer"),
    createdBy: z.string().trim().min(1, "Creator id is required"),
    bayesianNetwork: MethodModelReferenceSchema,
  })
  .strict();

const HclPatchChangesSchema = z
  .object({
    code: z.string().trim().min(1, "Model code is required").max(64, "Model code must be 64 characters or fewer").optional(),
    name: z.string().trim().min(1, "Model name is required").max(200, "Model name must be 200 characters or fewer").optional(),
    description: z.string().max(10_000, "Description must be 10,000 characters or fewer").optional(),
    bayesianNetwork: MethodModelReferenceSchema.optional(),
    faultTrees: z.array(HclFaultTreeReferenceSchema).optional(),
    bindings: z.array(HclEventBindingSchema).optional(),
    baseEvidence: HclBaseEvidenceSchema.optional(),
    solverSettings: HclSolverSettingsSchema.optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "At least one HCL change is required");

const HclPatchRequestSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    modelId: MethodModelIdSchema,
    expectedRevision: MethodModelRevisionSchema,
    updatedBy: z.string().trim().min(1, "Updater id is required"),
    changes: HclPatchChangesSchema,
  })
  .strict();

const HclValidateRequestSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    modelId: MethodModelIdSchema,
    revision: MethodModelRevisionSchema,
    mode: ValidationModeSchema,
    requestedBy: z.string().trim().min(1, "Requester id is required"),
  })
  .strict();

const HclExecuteRequestSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    modelId: MethodModelIdSchema,
    revision: MethodModelRevisionSchema,
    requestedBy: z.string().trim().min(1, "Requester id is required"),
    faultTreeTopGate: MethodEntityReferenceSchema,
  })
  .strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertHclCreateRequest = Expect<Equal<z.infer<typeof HclCreateRequestSchema>, HclCreateRequest>>;
type _AssertHclPatchChanges = Expect<Equal<z.infer<typeof HclPatchChangesSchema>, HclPatchChanges>>;
type _AssertHclPatchRequest = Expect<Equal<z.infer<typeof HclPatchRequestSchema>, HclPatchRequest>>;
type _AssertHclValidateRequest = Expect<Equal<z.infer<typeof HclValidateRequestSchema>, HclValidateRequest>>;
type _AssertHclExecuteRequest = Expect<Equal<z.infer<typeof HclExecuteRequestSchema>, HclExecuteRequest>>;

export {
  HclCreateRequestSchema,
  HclPatchChangesSchema,
  HclPatchRequestSchema,
  HclValidateRequestSchema,
  HclExecuteRequestSchema,
};
export type {
  HclCreateRequest,
  HclPatchChanges,
  HclPatchRequest,
  HclValidateRequest,
  HclExecuteRequest,
};
