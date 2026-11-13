import { z } from "zod";
import {
  FaultTreeTopEventReferenceSchema,
  WorkbookAddressSchema,
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
import type { HclParameterDraws, HclSampler, HclZeroProbabilityContexts } from "interfaces-mef-types/modeling";
import {
  HclCptClipEpsilonSchema,
  HclSamplerSchema,
  HclUncertaintySampleCountSchema,
  HclUncertaintySeedSchema,
} from "interfaces-mef-types/zod/modeling";
import {
  HclBaseEvidenceSchema,
  HclEvidenceScenarioSchema,
  HclEventBindingSchema,
  HclFaultTreeReferenceSchema,
  HclHazardGridDefinitionSchema,
  HclSolverSettingsSchema,
} from "./hcl-schemas";
import { HclDependencyCutSetScoreSchema } from "./hcl-results";
import type { HclDependencyCutSetScore } from "./hcl-results";

const HclCalculationTypeSchema = z.enum(["PROBABILITY", "UNCERTAINTY"]);
type HclCalculationType = z.infer<typeof HclCalculationTypeSchema>;

interface HclDependencyCutSetSettings {
  score: HclDependencyCutSetScore;
  limitOrder?: number;
  cutOff?: number;
  keep: number;
  causes?: number;
}

const CutSetLimitShape = {
  limitOrder: z.number().int().min(1, "The cut set order limit must be at least 1").optional(),
  cutOff: z.number().gt(0, "The cut set cut-off must be above 0").max(1, "The cut set cut-off cannot exceed 1").optional(),
  keep: z.number().int().min(1, "Keep at least one cut set").max(1000, "Keep at most 1,000 cut sets"),
  causes: z.number().int().min(1, "List at least one cause").max(100, "List at most 100 causes").optional(),
};

const HclDependencyCutSetSettingsSchema = z
  .object({ score: HclDependencyCutSetScoreSchema, ...CutSetLimitShape })
  .strict();

interface HclFaultTreeCutSetSettings {
  limitOrder?: number;
  cutOff?: number;
  keep: number;
  causes?: number;
}

const HclFaultTreeCutSetSettingsSchema = z.object(CutSetLimitShape).strict();

interface HclRunSampling {
  sampleCount: number;
  seed?: number;
  sampler: HclSampler;
  cptSampler?: HclSampler;
  correlation?: HclParameterDraws;
  clipProbabilities?: boolean;
  cptClipEpsilon?: number;
  zeroProbabilityContexts?: HclZeroProbabilityContexts;
}

const HclRunSamplingSchema = z
  .object({
    sampleCount: HclUncertaintySampleCountSchema,
    seed: HclUncertaintySeedSchema.optional(),
    sampler: HclSamplerSchema,
    cptSampler: HclSamplerSchema.optional(),
    correlation: z.enum(["SHARED", "INDEPENDENT"]).optional(),
    clipProbabilities: z.boolean().optional(),
    cptClipEpsilon: HclCptClipEpsilonSchema.optional(),
    zeroProbabilityContexts: z.enum(["ZERO", "FAIL"]).optional(),
  })
  .strict();

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
  calculationType: HclCalculationType;
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
  faultTreeTopGate: FaultTreeTopEventReference;
  evidenceScenarioId?: WorkbookEntityId;
  dependencyCutSets?: HclFaultTreeCutSetSettings;
  dependencyImportance?: boolean;
  dependencyImportanceEvents?: number;
}

interface HclEventTreeExecuteRequest {
  calculationType: HclCalculationType;
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
  eventTree: WorkbookModelAddress;
  dependencyConfiguration?: WorkbookModelAddress;
  evidenceScenarioId?: WorkbookEntityId;
  sampling?: HclRunSampling;
  dependencyCutSets?: HclDependencyCutSetSettings;
  dependencyImportance?: boolean;
  dependencyImportanceEvents?: number;
}

const HclBatchInputSchema = z.object({
  evidenceScenarios: z.array(HclEvidenceScenarioSchema).min(1),
  hazardGrid: HclHazardGridDefinitionSchema.optional(),
}).strict().superRefine((input, context) => {
  for (const key of ["id", "code"] as const) {
    const values = input.evidenceScenarios.map((row) => row[key].trim().toLowerCase());
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", path: ["evidenceScenarios"], message: `Scenario ${key}s must be unique` });
    }
  }
});
type HclBatchInput = z.infer<typeof HclBatchInputSchema>;

interface HclFaultTreeBatchExecuteRequest {
  calculationType: HclCalculationType;
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
  faultTreeTopGate: FaultTreeTopEventReference;
  evidenceScenarioIds: WorkbookEntityId[];
  batchInput?: HclBatchInput;
  integrateHazardGrid?: boolean;
  dependencyCutSets?: HclFaultTreeCutSetSettings;
  dependencyImportance?: boolean;
  dependencyImportanceEvents?: number;
}

interface HclEventTreeBatchExecuteRequest {
  calculationType: HclCalculationType;
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
  eventTree: WorkbookModelAddress;
  dependencyConfiguration?: WorkbookModelAddress;
  evidenceScenarioIds: WorkbookEntityId[];
  batchInput?: HclBatchInput;
  integrateHazardGrid?: boolean;
  sampling?: HclRunSampling;
  dependencyCutSets?: HclDependencyCutSetSettings;
  dependencyImportance?: boolean;
  dependencyImportanceEvents?: number;
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
    calculationType: HclCalculationTypeSchema.default("PROBABILITY"),
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    faultTreeTopGate: FaultTreeTopEventReferenceSchema,
    evidenceScenarioId: WorkbookEntityIdSchema.optional(),
    dependencyCutSets: HclFaultTreeCutSetSettingsSchema.optional(),
    dependencyImportance: z.boolean().optional(),
    dependencyImportanceEvents: z.number().int().min(1, "Sample at least one event").max(100, "Sample at most 100 events").optional(),
  })
  .strict();

const HclEventTreeAddressSchema = WorkbookAddressSchema.extend({
  modelId: z.string().trim().min(1, "Event tree id is required"),
}).strict();

const HclEventTreeExecuteRequestSchema = z
  .object({
    calculationType: HclCalculationTypeSchema.default("PROBABILITY"),
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    eventTree: HclEventTreeAddressSchema,
    dependencyConfiguration: WorkbookModelAddressSchema.optional(),
    evidenceScenarioId: WorkbookEntityIdSchema.optional(),
    sampling: HclRunSamplingSchema.optional(),
    dependencyCutSets: HclDependencyCutSetSettingsSchema.optional(),
    dependencyImportance: z.boolean().optional(),
    dependencyImportanceEvents: z.number().int().min(1, "Sample at least one event").max(100, "Sample at most 100 events").optional(),
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
    calculationType: HclCalculationTypeSchema.default("PROBABILITY"),
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    faultTreeTopGate: FaultTreeTopEventReferenceSchema,
    evidenceScenarioIds: EvidenceScenarioIdsSchema,
    batchInput: HclBatchInputSchema.optional(),
    integrateHazardGrid: z.boolean().optional(),
    dependencyCutSets: HclFaultTreeCutSetSettingsSchema.optional(),
    dependencyImportance: z.boolean().optional(),
    dependencyImportanceEvents: z.number().int().min(1, "Sample at least one event").max(100, "Sample at most 100 events").optional(),
  })
  .strict();

const HclEventTreeBatchExecuteRequestSchema = z
  .object({
    calculationType: HclCalculationTypeSchema.default("PROBABILITY"),
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    eventTree: HclEventTreeAddressSchema,
    dependencyConfiguration: WorkbookModelAddressSchema.optional(),
    evidenceScenarioIds: EvidenceScenarioIdsSchema,
    batchInput: HclBatchInputSchema.optional(),
    integrateHazardGrid: z.boolean().optional(),
    sampling: HclRunSamplingSchema.optional(),
    dependencyCutSets: HclDependencyCutSetSettingsSchema.optional(),
    dependencyImportance: z.boolean().optional(),
    dependencyImportanceEvents: z.number().int().min(1, "Sample at least one event").max(100, "Sample at most 100 events").optional(),
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
type _AssertHclRunSampling = Expect<Equal<z.infer<typeof HclRunSamplingSchema>, HclRunSampling>>;
type _AssertHclFaultTreeCutSetSettings = Expect<
  Equal<z.infer<typeof HclFaultTreeCutSetSettingsSchema>, HclFaultTreeCutSetSettings>
>;
type _AssertHclDependencyCutSetSettings = Expect<
  Equal<z.infer<typeof HclDependencyCutSetSettingsSchema>, HclDependencyCutSetSettings>
>;

export {
  HclCalculationTypeSchema,
  HclDependencyCutSetSettingsSchema,
  HclFaultTreeCutSetSettingsSchema,
  HclRunSamplingSchema,
  HclBatchInputSchema,
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
  HclCalculationType,
  HclDependencyCutSetSettings,
  HclFaultTreeCutSetSettings,
  HclRunSampling,
  HclBatchInput,
  HclCreateRequest,
  HclPatchChanges,
  HclPatchRequest,
  HclValidateRequest,
  HclExecuteRequest,
  HclEventTreeExecuteRequest,
  HclFaultTreeBatchExecuteRequest,
  HclEventTreeBatchExecuteRequest,
};
