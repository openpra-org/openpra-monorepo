import { z } from "zod";
import {
  FaultTreeTopEventReferenceSchema,
  WorkbookEntityIdSchema,
  WorkbookMethodSchemaVersionSchema,
  WorkbookModelAddressSchema,
  WorkbookModelIdSchema,
  WorkbookRevisionSchema,
  ValidationModeSchema,
} from "../shared";
import type {
  FaultTreeTopEventReference,
  WorkbookEntityId,
  WorkbookMethodSchemaVersion,
  WorkbookModelAddress,
  WorkbookModelId,
  WorkbookRevision,
  ValidationMode,
} from "../shared";
import type {
  HclBaseEvidence,
  HclEvidenceScenario,
  HclFaultTreeReference,
  HclHazardGridDefinition,
  HclSolverSettings,
} from "./hcl-configuration";
import type { HclEventBinding } from "./hcl-bindings";
import {
  HclBaseEvidenceSchema,
  HclEvidenceScenarioSchema,
  HclEventBindingSchema,
  HclFaultTreeReferenceSchema,
  HclHazardGridDefinitionSchema,
  HclSolverSettingsSchema,
} from "./hcl-schemas";

interface HclCreateRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  code: string;
  name: string;
  description: string;
  bayesianNetwork: WorkbookModelAddress;
}

interface HclPatchChanges {
  code?: string;
  name?: string;
  description?: string;
  bayesianNetwork?: WorkbookModelAddress;
  faultTrees?: HclFaultTreeReference[];
  bindings?: HclEventBinding[];
  baseEvidence?: HclBaseEvidence;
  evidenceScenarios?: HclEvidenceScenario[];
  hazardGrid?: HclHazardGridDefinition;
  solverSettings?: HclSolverSettings;
}

interface HclPatchRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  expectedWorkbookRevision: WorkbookRevision;
  changes: HclPatchChanges;
}

interface HclValidateRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
  mode: ValidationMode;
}

interface HclExecuteRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
  faultTreeTopGate: FaultTreeTopEventReference;
  evidenceScenarioId?: WorkbookEntityId;
}

interface HclEventTreeExecuteRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
  eventTree: WorkbookModelAddress;
  dependencyConfiguration?: WorkbookModelAddress;
  evidenceScenarioId?: WorkbookEntityId;
}

interface HclFaultTreeBatchExecuteRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
  faultTreeTopGate: FaultTreeTopEventReference;
  evidenceScenarioIds: WorkbookEntityId[];
  integrateHazardGrid?: boolean;
}

interface HclEventTreeBatchExecuteRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
  eventTree: WorkbookModelAddress;
  dependencyConfiguration?: WorkbookModelAddress;
  evidenceScenarioIds: WorkbookEntityId[];
  integrateHazardGrid?: boolean;
}

const HclCreateRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    code: z.string().trim().min(1, "Model code is required").max(64, "Model code must be 64 characters or fewer"),
    name: z.string().trim().min(1, "Model name is required").max(200, "Model name must be 200 characters or fewer"),
    description: z.string().max(10_000, "Description must be 10,000 characters or fewer"),
    bayesianNetwork: WorkbookModelAddressSchema,
  })
  .strict();

const HclPatchChangesSchema = z
  .object({
    code: z.string().trim().min(1, "Model code is required").max(64, "Model code must be 64 characters or fewer").optional(),
    name: z.string().trim().min(1, "Model name is required").max(200, "Model name must be 200 characters or fewer").optional(),
    description: z.string().max(10_000, "Description must be 10,000 characters or fewer").optional(),
    bayesianNetwork: WorkbookModelAddressSchema.optional(),
    faultTrees: z.array(HclFaultTreeReferenceSchema).optional(),
    bindings: z.array(HclEventBindingSchema).optional(),
    baseEvidence: HclBaseEvidenceSchema.optional(),
    evidenceScenarios: z.array(HclEvidenceScenarioSchema).optional(),
    hazardGrid: HclHazardGridDefinitionSchema.optional(),
    solverSettings: HclSolverSettingsSchema.optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "At least one HCL change is required");

const HclPatchRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    expectedWorkbookRevision: WorkbookRevisionSchema,
    changes: HclPatchChangesSchema,
  })
  .strict();

const HclValidateRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    mode: ValidationModeSchema,
  })
  .strict();

const HclExecuteRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    faultTreeTopGate: FaultTreeTopEventReferenceSchema,
    evidenceScenarioId: WorkbookEntityIdSchema.optional(),
  })
  .strict();

const HclEventTreeExecuteRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    eventTree: WorkbookModelAddressSchema,
    dependencyConfiguration: WorkbookModelAddressSchema.optional(),
    evidenceScenarioId: WorkbookEntityIdSchema.optional(),
  })
  .strict();

const EvidenceScenarioIdsSchema = z
  .array(WorkbookEntityIdSchema)
  .min(1, "At least one evidence scenario is required")
  .superRefine((scenarioIds, context) => {
    if (new Set(scenarioIds).size !== scenarioIds.length) {
      context.addIssue({ code: "custom", message: "Evidence-scenario ids must be unique" });
    }
  });

const HclFaultTreeBatchExecuteRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    faultTreeTopGate: FaultTreeTopEventReferenceSchema,
    evidenceScenarioIds: EvidenceScenarioIdsSchema,
    integrateHazardGrid: z.boolean().optional(),
  })
  .strict();

const HclEventTreeBatchExecuteRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    eventTree: WorkbookModelAddressSchema,
    dependencyConfiguration: WorkbookModelAddressSchema.optional(),
    evidenceScenarioIds: EvidenceScenarioIdsSchema,
    integrateHazardGrid: z.boolean().optional(),
  })
  .strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertHclCreateRequest = Expect<Equal<z.infer<typeof HclCreateRequestSchema>, HclCreateRequest>>;
type _AssertHclPatchChanges = Expect<Equal<z.infer<typeof HclPatchChangesSchema>, HclPatchChanges>>;
type _AssertHclPatchRequest = Expect<Equal<z.infer<typeof HclPatchRequestSchema>, HclPatchRequest>>;
type _AssertHclValidateRequest = Expect<Equal<z.infer<typeof HclValidateRequestSchema>, HclValidateRequest>>;
type _AssertHclExecuteRequest = Expect<Equal<z.infer<typeof HclExecuteRequestSchema>, HclExecuteRequest>>;
type _AssertHclEventTreeExecuteRequest = Expect<
  Equal<z.infer<typeof HclEventTreeExecuteRequestSchema>, HclEventTreeExecuteRequest>
>;
type _AssertHclFaultTreeBatchExecuteRequest = Expect<
  Equal<z.infer<typeof HclFaultTreeBatchExecuteRequestSchema>, HclFaultTreeBatchExecuteRequest>
>;
type _AssertHclEventTreeBatchExecuteRequest = Expect<
  Equal<z.infer<typeof HclEventTreeBatchExecuteRequestSchema>, HclEventTreeBatchExecuteRequest>
>;

export {
  HclCreateRequestSchema,
  HclPatchChangesSchema,
  HclPatchRequestSchema,
  HclValidateRequestSchema,
  HclExecuteRequestSchema,
  HclEventTreeExecuteRequestSchema,
  HclFaultTreeBatchExecuteRequestSchema,
  HclEventTreeBatchExecuteRequestSchema,
};
export type {
  HclCreateRequest,
  HclPatchChanges,
  HclPatchRequest,
  HclValidateRequest,
  HclExecuteRequest,
  HclEventTreeExecuteRequest,
  HclFaultTreeBatchExecuteRequest,
  HclEventTreeBatchExecuteRequest,
};
