import { z } from "zod";
import {
  AnalysisRunIdSchema,
  AnalysisRunMetadataSchema,
  FaultTreeTopEventReferenceSchema,
  WorkbookEntityIdSchema,
  WorkbookMethodSchemaVersionSchema,
  WorkbookModelSnapshotIdentitySchema,
  ValidationIssueSchema,
  ValidationResultSchema,
  BasicEventQuantificationTraceSchema,
} from "../shared";
import type {
  AnalysisRunId,
  AnalysisRunMetadata,
  FaultTreeTopEventReference,
  WorkbookEntityId,
  WorkbookMethodSchemaVersion,
  WorkbookModelSnapshotIdentity,
  ValidationIssue,
  ValidationResult,
  BasicEventQuantificationTrace,
} from "../shared";
import {
  AnnualizedFrequencyInputSchema,
} from "interfaces-mef-types/zod/modeling";
import type { AnnualizedFrequencyInput } from "interfaces-mef-types/modeling";

interface HclValidationResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  validation: ValidationResult;
}

interface HclExecuteResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  run: AnalysisRunMetadata;
}

interface HclBridgeStats {
  quantifications: number;
  bddContextCacheHits: number;
  bddContextCacheMisses: number;
  bnQueryCacheHits: number;
  bnQueryCacheMisses: number;
}

interface HclJunctionTreeStats {
  numCliques: number;
  maxCliqueSize: number;
  treewidth: number;
  totalTableEntries: number;
}

interface HclQuantificationResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  runId: AnalysisRunId;
  owner: WorkbookModelSnapshotIdentity;
  faultTreeTopGate: FaultTreeTopEventReference;
  probability: number;
  bddNodes: number;
  bddVariables: number;
  variableOrder: WorkbookEntityId[];
  bridge: HclBridgeStats;
  junctionTree: HclJunctionTreeStats;
  basicEventQuantifications?: BasicEventQuantificationTrace[];
  validationIssues: ValidationIssue[];
  completedAt: string;
}

interface HclEvidenceScenarioRun {
  scenarioId: WorkbookEntityId;
  scenarioCode: string;
  scenarioName: string;
  run: AnalysisRunMetadata;
}

interface HclBatchExecuteResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  runs: HclEvidenceScenarioRun[];
  hazardConvolution?: HclHazardConvolutionResult;
}

interface HclHazardConvolutionCommon {
  gridName: string;
  annualFrequencyScale: AnnualizedFrequencyInput;
  annualizedFrequencyScale: number;
  normalizeWeights: boolean;
  rawWeightSum: number;
  convolutionWeightSum: number;
}

interface HclHazardConvolutionWeight {
  scenarioId: WorkbookEntityId;
  rawWeight: number;
  normalizedWeight: number;
  convolutionWeight: number;
  annualFrequency: number;
}

interface HclFaultTreeHazardConvolutionRow extends HclHazardConvolutionWeight {
  conditionalProbability: number;
  annualContribution: number;
}

interface HclFaultTreeHazardConvolutionResult extends HclHazardConvolutionCommon {
  targetKind: "FAULT_TREE";
  rows: HclFaultTreeHazardConvolutionRow[];
  integratedAnnualFrequency: number;
}

interface HclEventTreeHazardSequenceContribution {
  sequenceId: WorkbookEntityId;
  conditionalProbability: number;
  annualContribution: number;
}

interface HclEventTreeHazardConvolutionRow extends HclHazardConvolutionWeight {
  sequences: HclEventTreeHazardSequenceContribution[];
}

interface HclEventTreeHazardSequenceResult {
  sequenceId: WorkbookEntityId;
  integratedAnnualFrequency: number;
}

interface HclEventTreeHazardEndStateResult {
  endStateId: WorkbookEntityId;
  integratedAnnualFrequency: number;
}

interface HclEventTreeHazardConvolutionResult extends HclHazardConvolutionCommon {
  targetKind: "EVENT_TREE";
  rows: HclEventTreeHazardConvolutionRow[];
  sequences: HclEventTreeHazardSequenceResult[];
  endStateAggregates: HclEventTreeHazardEndStateResult[];
}

type HclHazardConvolutionResult =
  | HclFaultTreeHazardConvolutionResult
  | HclEventTreeHazardConvolutionResult;

const NonnegativeCounterSchema = z.number().int().nonnegative();

const HclValidationResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    validation: ValidationResultSchema,
  })
  .strict();

const HclExecuteResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    run: AnalysisRunMetadataSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.run.methodType !== "HYBRID_CAUSAL_LOGIC") {
      context.addIssue({
        code: "custom",
        path: ["run", "methodType"],
        message: "HCL execution runs must use the HYBRID_CAUSAL_LOGIC method type",
      });
    }
  });

const HclEvidenceScenarioRunSchema = z
  .object({
    scenarioId: WorkbookEntityIdSchema,
    scenarioCode: z.string().trim().min(1).max(64),
    scenarioName: z.string().trim().min(1).max(200),
    run: AnalysisRunMetadataSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.run.methodType !== "HYBRID_CAUSAL_LOGIC" && result.run.methodType !== "EVENT_TREE") {
      context.addIssue({
        code: "custom",
        path: ["run", "methodType"],
        message: "HCL scenario runs must use the HYBRID_CAUSAL_LOGIC or EVENT_TREE method type",
      });
    }
  });

const HclBatchExecuteResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    runs: z.array(HclEvidenceScenarioRunSchema).min(1),
    hazardConvolution: z.lazy(() => HclHazardConvolutionResultSchema).optional(),
  })
  .strict()
  .superRefine((result, context) => {
    if (new Set(result.runs.map((scenario) => scenario.scenarioId)).size !== result.runs.length) {
      context.addIssue({ code: "custom", path: ["runs"], message: "Scenario results must be unique" });
    }
  });

const HclBridgeStatsSchema = z
  .object({
    quantifications: NonnegativeCounterSchema,
    bddContextCacheHits: NonnegativeCounterSchema,
    bddContextCacheMisses: NonnegativeCounterSchema,
    bnQueryCacheHits: NonnegativeCounterSchema,
    bnQueryCacheMisses: NonnegativeCounterSchema,
  })
  .strict();

const HclJunctionTreeStatsSchema = z
  .object({
    numCliques: NonnegativeCounterSchema,
    maxCliqueSize: NonnegativeCounterSchema,
    treewidth: NonnegativeCounterSchema,
    totalTableEntries: NonnegativeCounterSchema,
  })
  .strict();

const ProbabilitySchema = z.number().min(0).max(1);
const NonnegativeFiniteSchema = z.number().nonnegative().finite();

const HclHazardConvolutionWeightSchema = z.object({
  scenarioId: WorkbookEntityIdSchema,
  rawWeight: NonnegativeFiniteSchema,
  normalizedWeight: NonnegativeFiniteSchema,
  convolutionWeight: NonnegativeFiniteSchema,
  annualFrequency: NonnegativeFiniteSchema,
}).strict();

const HclHazardConvolutionCommonShape = {
  gridName: z.string().trim().min(1).max(200),
  annualFrequencyScale: AnnualizedFrequencyInputSchema,
  annualizedFrequencyScale: NonnegativeFiniteSchema,
  normalizeWeights: z.boolean(),
  rawWeightSum: NonnegativeFiniteSchema,
  convolutionWeightSum: NonnegativeFiniteSchema,
};

const HclFaultTreeHazardConvolutionResultSchema = z.object({
  targetKind: z.literal("FAULT_TREE"),
  ...HclHazardConvolutionCommonShape,
  rows: z.array(HclHazardConvolutionWeightSchema.extend({
    conditionalProbability: ProbabilitySchema,
    annualContribution: NonnegativeFiniteSchema,
  }).strict()).min(1),
  integratedAnnualFrequency: NonnegativeFiniteSchema,
}).strict();

const HclEventTreeHazardSequenceContributionSchema = z.object({
  sequenceId: WorkbookEntityIdSchema,
  conditionalProbability: ProbabilitySchema,
  annualContribution: NonnegativeFiniteSchema,
}).strict();

const HclEventTreeHazardConvolutionResultSchema = z.object({
  targetKind: z.literal("EVENT_TREE"),
  ...HclHazardConvolutionCommonShape,
  rows: z.array(HclHazardConvolutionWeightSchema.extend({
    sequences: z.array(HclEventTreeHazardSequenceContributionSchema),
  }).strict()).min(1),
  sequences: z.array(z.object({
    sequenceId: WorkbookEntityIdSchema,
    integratedAnnualFrequency: NonnegativeFiniteSchema,
  }).strict()),
  endStateAggregates: z.array(z.object({
    endStateId: WorkbookEntityIdSchema,
    integratedAnnualFrequency: NonnegativeFiniteSchema,
  }).strict()),
}).strict();

const HclHazardConvolutionResultSchema = z.discriminatedUnion("targetKind", [
  HclFaultTreeHazardConvolutionResultSchema,
  HclEventTreeHazardConvolutionResultSchema,
]);

const HclQuantificationResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    runId: AnalysisRunIdSchema,
    owner: WorkbookModelSnapshotIdentitySchema,
    faultTreeTopGate: FaultTreeTopEventReferenceSchema,
    probability: z.number().min(0, "Probability cannot be less than zero").max(1, "Probability cannot exceed one"),
    bddNodes: NonnegativeCounterSchema,
    bddVariables: NonnegativeCounterSchema,
    variableOrder: z.array(WorkbookEntityIdSchema),
    bridge: HclBridgeStatsSchema,
    junctionTree: HclJunctionTreeStatsSchema,
    basicEventQuantifications: z.array(BasicEventQuantificationTraceSchema).optional(),
    validationIssues: z.array(ValidationIssueSchema),
    completedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((result, context) => {
    if (new Set(result.variableOrder).size !== result.variableOrder.length) {
      context.addIssue({
        code: "custom",
        path: ["variableOrder"],
        message: "Result variable-order event ids must be unique",
      });
    }

    if (result.bddVariables !== result.variableOrder.length) {
      context.addIssue({
        code: "custom",
        path: ["bddVariables"],
        message: "BDD variable count must equal the returned variable-order length",
      });
    }
  });

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertHclValidationResult = Expect<
  Equal<z.infer<typeof HclValidationResultSchema>, HclValidationResult>
>;
type _AssertHclExecuteResult = Expect<Equal<z.infer<typeof HclExecuteResultSchema>, HclExecuteResult>>;
type _AssertHclEvidenceScenarioRun = Expect<
  Equal<z.infer<typeof HclEvidenceScenarioRunSchema>, HclEvidenceScenarioRun>
>;
type _AssertHclBatchExecuteResult = Expect<
  Equal<z.infer<typeof HclBatchExecuteResultSchema>, HclBatchExecuteResult>
>;
type _AssertHclHazardConvolutionResult = Expect<
  Equal<z.infer<typeof HclHazardConvolutionResultSchema>, HclHazardConvolutionResult>
>;
type _AssertHclBridgeStats = Expect<Equal<z.infer<typeof HclBridgeStatsSchema>, HclBridgeStats>>;
type _AssertHclJunctionTreeStats = Expect<
  Equal<z.infer<typeof HclJunctionTreeStatsSchema>, HclJunctionTreeStats>
>;
type _AssertHclQuantificationResult = Expect<
  Equal<z.infer<typeof HclQuantificationResultSchema>, HclQuantificationResult>
>;

export {
  HclValidationResultSchema,
  HclExecuteResultSchema,
  HclEvidenceScenarioRunSchema,
  HclBatchExecuteResultSchema,
  HclHazardConvolutionResultSchema,
  HclFaultTreeHazardConvolutionResultSchema,
  HclEventTreeHazardConvolutionResultSchema,
  HclBridgeStatsSchema,
  HclJunctionTreeStatsSchema,
  HclQuantificationResultSchema,
};
export type {
  HclValidationResult,
  HclExecuteResult,
  HclEvidenceScenarioRun,
  HclBatchExecuteResult,
  HclHazardConvolutionResult,
  HclFaultTreeHazardConvolutionResult,
  HclEventTreeHazardConvolutionResult,
  HclBridgeStats,
  HclJunctionTreeStats,
  HclQuantificationResult,
};
