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
  calculationType: FaultTreeCalculationType;
  workflow: FaultTreeWorkflow;
  settings: FaultTreeAnalysisSettings;
}

type FaultTreeCalculationType =
  | "PROBABILITY"
  | "CUT_SETS"
  | "PROBABILITY_AND_CUT_SETS"
  | "IMPORTANCE"
  | "UNCERTAINTY"
  | "SIL";

type FaultTreeWorkflow = "MANUAL" | "BATCH";

type FaultTreeAlgorithm =
  | "BDD"
  | "ZBDD"
  | "ZBDD_DIRECT"
  | "ZBDD_DELTERM"
  | "MOCUS"
  | "MOCUS_PI"
  | "MONTE_CARLO";

type FaultTreeApproximation = "EXACT" | "RARE_EVENT" | "MCUB";

type FaultTreeVariableOrder =
  | "DFS"
  | "FORCE"
  | "SLOAN"
  | "DFS_SCRAM"
  | "DFS_PLAIN"
  | "REVERSE"
  | "SIFT"
  | "GSIFT"
  | "ILS";

type FaultTreeVarianceReduction = "NONE" | "IMPORTANCE_SAMPLING" | "STRATIFIED_SAMPLING";

interface FaultTreeAnalysisSettings {
  algorithm: FaultTreeAlgorithm;
  approximation: FaultTreeApproximation;
  limitOrder?: number;
  cutOff?: number;
  variableOrder: FaultTreeVariableOrder;
  reorderBudgetSeconds: number;
  expandCcf: boolean;
  numTrials: number;
  seed: number;
  missionTimeHours: number;
  earlyStop: boolean;
  convergenceDelta: number;
  confidenceLevel: number;
  burnInTrials: number;
  varianceReduction: FaultTreeVarianceReduction;
  importanceSamplingBiasFactor: number;
  importanceSamplingMaxEvents: number;
  importanceSamplingMinimumProbability: number;
  stratifyEvents: number;
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

const FaultTreeCalculationTypeSchema = z.enum([
  "PROBABILITY",
  "CUT_SETS",
  "PROBABILITY_AND_CUT_SETS",
  "IMPORTANCE",
  "UNCERTAINTY",
  "SIL",
]);

const FaultTreeWorkflowSchema = z.enum(["MANUAL", "BATCH"]);

const FaultTreeAlgorithmSchema = z.enum([
  "BDD",
  "ZBDD",
  "ZBDD_DIRECT",
  "ZBDD_DELTERM",
  "MOCUS",
  "MOCUS_PI",
  "MONTE_CARLO",
]);

const FaultTreeApproximationSchema = z.enum(["EXACT", "RARE_EVENT", "MCUB"]);

const FaultTreeVariableOrderSchema = z.enum([
  "DFS",
  "FORCE",
  "SLOAN",
  "DFS_SCRAM",
  "DFS_PLAIN",
  "REVERSE",
  "SIFT",
  "GSIFT",
  "ILS",
]);

const FaultTreeVarianceReductionSchema = z.enum(["NONE", "IMPORTANCE_SAMPLING", "STRATIFIED_SAMPLING"]);

const FaultTreeAnalysisSettingsSchema = z
  .object({
    algorithm: FaultTreeAlgorithmSchema.default("BDD"),
    approximation: FaultTreeApproximationSchema.default("EXACT"),
    limitOrder: z.number().int().positive().max(10_000).optional(),
    cutOff: z.number().min(0).max(1).optional(),
    variableOrder: FaultTreeVariableOrderSchema.default("DFS"),
    reorderBudgetSeconds: z.number().positive().max(3_600).default(60),
    expandCcf: z.boolean().default(false),
    numTrials: z.number().int().positive().max(1_000_000_000).default(10_000),
    seed: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(847),
    missionTimeHours: z.number().positive().max(1_000_000_000).default(8_760),
    earlyStop: z.boolean().default(false),
    convergenceDelta: z.number().positive().default(0.1),
    confidenceLevel: z.number().gt(0).lt(1).default(0.95),
    burnInTrials: z.number().int().nonnegative().default(0),
    varianceReduction: FaultTreeVarianceReductionSchema.default("NONE"),
    importanceSamplingBiasFactor: z.number().positive().default(10),
    importanceSamplingMaxEvents: z.number().int().nonnegative().default(32),
    importanceSamplingMinimumProbability: z.number().gt(0).lt(0.5).default(1e-12),
    stratifyEvents: z.number().int().positive().default(4),
  })
  .strict();

const FaultTreeExecuteRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    calculationType: FaultTreeCalculationTypeSchema.default("PROBABILITY"),
    workflow: FaultTreeWorkflowSchema.default("MANUAL"),
    settings: FaultTreeAnalysisSettingsSchema.default({
      algorithm: "BDD",
      approximation: "EXACT",
      variableOrder: "DFS",
      reorderBudgetSeconds: 60,
      expandCcf: false,
      numTrials: 10_000,
      seed: 847,
      missionTimeHours: 8_760,
      earlyStop: false,
      convergenceDelta: 0.1,
      confidenceLevel: 0.95,
      burnInTrials: 0,
      varianceReduction: "NONE",
      importanceSamplingBiasFactor: 10,
      importanceSamplingMaxEvents: 32,
      importanceSamplingMinimumProbability: 1e-12,
      stratifyEvents: 4,
    }),
  })
  .strict()
  .superRefine((request, context) => {
    const { algorithm, approximation } = request.settings;
    const cutSetAlgorithms: FaultTreeAlgorithm[] = ["ZBDD", "ZBDD_DIRECT", "ZBDD_DELTERM", "MOCUS", "MOCUS_PI"];
    if (["CUT_SETS", "PROBABILITY_AND_CUT_SETS"].includes(request.calculationType) && !cutSetAlgorithms.includes(algorithm)) {
      context.addIssue({ code: "custom", path: ["settings", "algorithm"], message: "This calculation requires a cut-set algorithm" });
    }
    if (["IMPORTANCE", "UNCERTAINTY", "SIL"].includes(request.calculationType) && algorithm !== "BDD") {
      context.addIssue({ code: "custom", path: ["settings", "algorithm"], message: "This calculation requires the BDD algorithm" });
    }
    if (algorithm === "MONTE_CARLO" && request.calculationType !== "PROBABILITY") {
      context.addIssue({ code: "custom", path: ["calculationType"], message: "Monte Carlo supports probability calculations" });
    }
    if (["BDD", "MONTE_CARLO"].includes(algorithm) && approximation !== "EXACT") {
      context.addIssue({ code: "custom", path: ["settings", "approximation"], message: "This algorithm does not use a cut-set approximation" });
    }
    if (["ZBDD_DIRECT", "ZBDD_DELTERM", "MOCUS", "MOCUS_PI"].includes(algorithm) && approximation === "EXACT") {
      context.addIssue({ code: "custom", path: ["settings", "approximation"], message: "This algorithm requires rare-event or MCUB approximation" });
    }
    if (request.settings.earlyStop && request.settings.varianceReduction !== "NONE") {
      context.addIssue({ code: "custom", path: ["settings", "varianceReduction"], message: "Variance reduction cannot be combined with early stopping" });
    }
    if ((request.settings.earlyStop || request.settings.varianceReduction !== "NONE") && algorithm !== "MONTE_CARLO") {
      context.addIssue({ code: "custom", path: ["settings", "algorithm"], message: "Monte Carlo controls require the Monte Carlo algorithm" });
    }
    if (["IMPORTANCE", "UNCERTAINTY", "SIL"].includes(request.calculationType)
      && (request.settings.limitOrder !== undefined || request.settings.cutOff !== undefined)) {
      context.addIssue({ code: "custom", path: ["settings"], message: "Limits are not used by this calculation" });
    }
  });

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
  FaultTreeCalculationTypeSchema,
  FaultTreeWorkflowSchema,
  FaultTreeAlgorithmSchema,
  FaultTreeApproximationSchema,
  FaultTreeVariableOrderSchema,
  FaultTreeVarianceReductionSchema,
  FaultTreeAnalysisSettingsSchema,
  FaultTreeBasicEventCatalogueCreateRequestSchema,
  FaultTreeBasicEventCataloguePatchRequestSchema,
};
export type {
  FaultTreeCreateRequest,
  FaultTreePatchChanges,
  FaultTreePatchRequest,
  FaultTreeValidateRequest,
  FaultTreeExecuteRequest,
  FaultTreeCalculationType,
  FaultTreeWorkflow,
  FaultTreeAlgorithm,
  FaultTreeApproximation,
  FaultTreeVariableOrder,
  FaultTreeVarianceReduction,
  FaultTreeAnalysisSettings,
  FaultTreeBasicEventCatalogueCreateRequest,
  FaultTreeBasicEventCataloguePatchRequest,
};
