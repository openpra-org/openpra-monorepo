import { z } from "zod";
import { BooleanNodeIdSchema, BasicEventIdSchema } from "./boolean-logic";
import {
  SolverTargetSchema,
  ConvergenceIntervalPolicySchema,
} from "./quantification-settings";
import type { QuantificationResult } from "../quantification-result";

export const RuntimeSummarySchema = z.object({
  analysisSeconds: z.number().optional(),
  totalSeconds: z.number().optional(),
});

export const CutSetLiteralSchema = z.object({
  basicEventId: BasicEventIdSchema,
  negated: z.boolean(),
});

export const CutSetSchema = z.object({
  order: z.number(),
  literals: z.array(CutSetLiteralSchema),
  probability: z.number().optional(),
  contribution: z.number().optional(),
});

export const CutSetResultSchema = z.object({
  products: z.number(),
  originalProducts: z.number().optional(),
  primeImplicants: z.boolean().optional(),
  distributionByOrder: z.array(z.number()).optional(),
  truncationProbabilityError: z.number().optional(),
  list: z.array(CutSetSchema).optional(),
});

export const ApproximationSchema = z.enum([
  "rare-event",
  "mcub",
  "exact",
  "monte-carlo",
]);

export const ProbabilityResultSchema = z.object({
  value: z.number(),
  exactProbability: z.number().optional(),
  approximateProbability: z.number().optional(),
  relativeError: z.number().optional(),
  approximation: ApproximationSchema.optional(),
});

export const QuantileSchema = z.object({
  fraction: z.number(),
  value: z.number(),
});

export const HistogramBinSchema = z.object({
  lowerBound: z.number(),
  upperBound: z.number(),
  count: z.number(),
});

export const UncertaintyResultSchema = z.object({
  mean: z.number(),
  standardDeviation: z.number().optional(),
  errorFactor: z.number().optional(),
  quantiles: z.array(QuantileSchema).optional(),
  percentiles: z.record(z.string(), z.number()).optional(),
  histogramBins: z.array(HistogramBinSchema).optional(),
});

export const ConvergenceResultSchema = z.object({
  converged: z.boolean(),
  trials: z.number(),
  confidence: z.number().optional(),
  delta: z.number().optional(),
  ciPolicy: ConvergenceIntervalPolicySchema.optional(),
  achievedMarginOfError: z.number().optional(),
});

export const ImportanceMeasureResultSchema = z.object({
  basicEventId: BasicEventIdSchema,
  fussellVesely: z.number().optional(),
  riskAchievementWorth: z.number().optional(),
  riskReductionWorth: z.number().optional(),
  birnbaum: z.number().optional(),
  criticality: z.number().optional(),
});

export const SensitivityResultEntrySchema = z.object({
  studyId: z.number(),
  variedItem: z.string(),
  baselineValue: z.number().optional(),
  perturbedValue: z.number().optional(),
  resultDelta: z.number().optional(),
});

export const SafetyIntegrityLevelResultSchema = z.object({
  faultTreeId: z.number(),
  averageProbability: z.number().optional(),
  silBand: z.number().optional(),
});

export const FaultTreeQuantificationSchema = z.object({
  faultTreeId: z.number(),
  topNodeId: BooleanNodeIdSchema,
  topEventProbability: ProbabilityResultSchema.optional(),
  cutSets: CutSetResultSchema.optional(),
  importance: z.array(ImportanceMeasureResultSchema).optional(),
  uncertainty: UncertaintyResultSchema.optional(),
});

export const SequenceQuantificationSchema = z.object({
  sequenceId: z.number(),
  initiatingEventId: BasicEventIdSchema,
  endStateId: z.number().optional(),
  frequency: z.number().optional(),
  probability: ProbabilityResultSchema.optional(),
  cutSets: CutSetResultSchema.optional(),
  uncertainty: UncertaintyResultSchema.optional(),
});

export const EndStateQuantificationSchema = z.object({
  endStateId: z.number(),
  name: z.string().optional(),
  frequency: z.number().optional(),
  probability: ProbabilityResultSchema.optional(),
  uncertainty: UncertaintyResultSchema.optional(),
  contributingSequenceIds: z.array(z.number()).optional(),
});

export const InitiatingEventQuantificationSchema = z.object({
  initiatingEventId: BasicEventIdSchema,
  name: z.string().optional(),
  sequences: z.array(SequenceQuantificationSchema),
});

export const QuantificationResultSchema = z.object({
  id: z.number(),
  requestRef: z.number(),
  booleanModelRef: z.number(),
  modelVersionRef: z.string().optional(),
  solverName: SolverTargetSchema,
  solverVersion: z.string().optional(),
  configurationControlRecordId: z.string().optional(),
  timestamp: z.string().optional(),
  modelFeatures: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
  runtimeSummary: RuntimeSummarySchema.optional(),

  faultTrees: z.array(FaultTreeQuantificationSchema).optional(),
  initiatingEvents: z.array(InitiatingEventQuantificationSchema).optional(),
  sumOfProducts: z.array(SequenceQuantificationSchema).optional(),
  endStates: z.array(EndStateQuantificationSchema).optional(),

  importance: z.array(ImportanceMeasureResultSchema).optional(),
  uncertainty: UncertaintyResultSchema.optional(),
  convergence: ConvergenceResultSchema.optional(),
  sensitivity: z.array(SensitivityResultEntrySchema).optional(),
  safetyIntegrityLevels: z.array(SafetyIntegrityLevelResultSchema).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertQuantificationResultMirrorsType = Expect<
  Equal<z.infer<typeof QuantificationResultSchema>, QuantificationResult>
>;
