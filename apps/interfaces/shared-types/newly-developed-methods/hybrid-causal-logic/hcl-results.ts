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

interface HclCutSetBindingTrace {
  bayesianNetworkNodeId: WorkbookEntityId;
  stateIds: WorkbookEntityId[];
  parentNodeIds: WorkbookEntityId[];
}

interface HclCutSetLiteral {
  basicEventId: WorkbookEntityId;
  complemented: boolean;
  binding: HclCutSetBindingTrace | null;
}

interface HclCutSet {
  rank: number;
  order: number;
  probability: number;
  coverage: number | null;
  literals: HclCutSetLiteral[];
  bnAncestorNodeIds: WorkbookEntityId[];
  bnRootCauseNodeIds: WorkbookEntityId[];
}

interface HclCutSetAnalysis {
  totalCount: number;
  cutSets: HclCutSet[];
}

interface HclImportanceMeasure {
  rank: number;
  basicEventId: WorkbookEntityId;
  bayesianNetworkNodeId: WorkbookEntityId | null;
  eventProbability: number;
  probabilityIfTrue: number;
  probabilityIfFalse: number;
  birnbaum: number;
  criticality: number | null;
  fussellVesely: number | null;
  riskAchievementWorth: number | null;
  riskReductionWorth: number | null;
}

interface HclImportanceAnalysis {
  totalCount: number;
  measures: HclImportanceMeasure[];
}

interface HclUncertaintySummary {
  sampleCount: number;
  seed: number;
  mean: number;
  standardDeviation: number;
  coefficientOfVariation: number | null;
  minimum: number;
  percentile05: number;
  median: number;
  percentile95: number;
  maximum: number;
}

interface HclQuantificationResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  runId: AnalysisRunId;
  owner: WorkbookModelSnapshotIdentity;
  faultTreeTopGate: FaultTreeTopEventReference;
  probability: number;
  uncertainty?: HclUncertaintySummary;
  /** Present on results produced by PRAXIS versions with HCL cut-set analysis. */
  cutSets?: HclCutSetAnalysis;
  /** Present on results produced by PRAXIS versions with HCL importance analysis. */
  importance?: HclImportanceAnalysis;
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
  uncertainty?: HclUncertaintySummary;
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
  uncertainty?: HclUncertaintySummary;
}

interface HclEventTreeHazardEndStateResult {
  endStateId: WorkbookEntityId;
  integratedAnnualFrequency: number;
  uncertainty?: HclUncertaintySummary;
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

const HclCutSetBindingTraceSchema = z.object({
  bayesianNetworkNodeId: WorkbookEntityIdSchema,
  stateIds: z.array(WorkbookEntityIdSchema).min(1),
  parentNodeIds: z.array(WorkbookEntityIdSchema),
}).strict();

const HclCutSetLiteralSchema = z.object({
  basicEventId: WorkbookEntityIdSchema,
  complemented: z.boolean(),
  binding: HclCutSetBindingTraceSchema.nullable(),
}).strict();

const HclCutSetSchema = z.object({
  rank: z.number().int().positive(),
  order: z.number().int().nonnegative(),
  probability: z.number().min(0).max(1),
  coverage: z.number().min(0).max(1).nullable(),
  literals: z.array(HclCutSetLiteralSchema),
  bnAncestorNodeIds: z.array(WorkbookEntityIdSchema),
  bnRootCauseNodeIds: z.array(WorkbookEntityIdSchema),
}).strict().superRefine((cutSet, context) => {
  if (cutSet.order !== cutSet.literals.length) {
    context.addIssue({
      code: "custom",
      path: ["order"],
      message: "HCL cut-set order must equal its literal count",
    });
  }
});

const HclCutSetAnalysisSchema = z.object({
  totalCount: NonnegativeCounterSchema,
  cutSets: z.array(HclCutSetSchema),
}).strict().superRefine((analysis, context) => {
  if (analysis.totalCount !== analysis.cutSets.length) {
    context.addIssue({
      code: "custom",
      path: ["totalCount"],
      message: "HCL cut-set count must equal the returned structural enumeration",
    });
  }
  analysis.cutSets.forEach((cutSet, index) => {
    if (cutSet.rank !== index + 1) {
      context.addIssue({
        code: "custom",
        path: ["cutSets", index, "rank"],
        message: "HCL cut sets must use contiguous probability rank order",
      });
    }
  });
});

const HclImportanceMeasureSchema = z.object({
  rank: z.number().int().positive(),
  basicEventId: WorkbookEntityIdSchema,
  bayesianNetworkNodeId: WorkbookEntityIdSchema.nullable(),
  eventProbability: z.number().min(0).max(1),
  probabilityIfTrue: z.number().min(0).max(1),
  probabilityIfFalse: z.number().min(0).max(1),
  birnbaum: z.number().finite().min(-1).max(1),
  criticality: z.number().finite().nullable(),
  fussellVesely: z.number().finite().nullable(),
  riskAchievementWorth: z.number().finite().nonnegative().nullable(),
  riskReductionWorth: z.number().finite().nonnegative().nullable(),
}).strict();

const HclImportanceAnalysisSchema = z.object({
  totalCount: NonnegativeCounterSchema,
  measures: z.array(HclImportanceMeasureSchema),
}).strict().superRefine((analysis, context) => {
  if (analysis.totalCount !== analysis.measures.length) {
    context.addIssue({
      code: "custom",
      path: ["totalCount"],
      message: "HCL importance count must equal the returned measure count",
    });
  }
  analysis.measures.forEach((measure, index) => {
    if (measure.rank !== index + 1) {
      context.addIssue({
        code: "custom",
        path: ["measures", index, "rank"],
        message: "HCL importance measures must use contiguous rank order",
      });
    }
  });
});

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
  uncertainty: z.lazy(() => HclUncertaintySummarySchema).optional(),
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
    uncertainty: z.lazy(() => HclUncertaintySummarySchema).optional(),
  }).strict()),
  endStateAggregates: z.array(z.object({
    endStateId: WorkbookEntityIdSchema,
    integratedAnnualFrequency: NonnegativeFiniteSchema,
    uncertainty: z.lazy(() => HclUncertaintySummarySchema).optional(),
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
    uncertainty: z.lazy(() => HclUncertaintySummarySchema).optional(),
    cutSets: HclCutSetAnalysisSchema.optional(),
    importance: HclImportanceAnalysisSchema.optional(),
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

const HclUncertaintySummarySchema = z
  .object({
    sampleCount: z.number().int().positive(),
    seed: z.number().int().nonnegative(),
    mean: z.number().finite().nonnegative(),
    standardDeviation: z.number().finite().nonnegative(),
    coefficientOfVariation: z.number().finite().nonnegative().nullable(),
    minimum: z.number().finite().nonnegative(),
    percentile05: z.number().finite().nonnegative(),
    median: z.number().finite().nonnegative(),
    percentile95: z.number().finite().nonnegative(),
    maximum: z.number().finite().nonnegative(),
  })
  .strict()
  .superRefine((summary, context) => {
    if (!(summary.minimum <= summary.percentile05
      && summary.percentile05 <= summary.median
      && summary.median <= summary.percentile95
      && summary.percentile95 <= summary.maximum)) {
      context.addIssue({ code: "custom", path: ["percentile05"], message: "Uncertainty percentiles must be ordered" });
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
  HclCutSetBindingTraceSchema,
  HclCutSetLiteralSchema,
  HclCutSetSchema,
  HclCutSetAnalysisSchema,
  HclImportanceMeasureSchema,
  HclImportanceAnalysisSchema,
  HclUncertaintySummarySchema,
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
  HclCutSetBindingTrace,
  HclCutSetLiteral,
  HclCutSet,
  HclCutSetAnalysis,
  HclImportanceMeasure,
  HclImportanceAnalysis,
  HclUncertaintySummary,
  HclQuantificationResult,
};
