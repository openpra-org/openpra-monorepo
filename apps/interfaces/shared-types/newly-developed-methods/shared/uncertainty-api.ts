import { z } from "zod";
import type {
  EvidenceTerm,
  Law,
  Likelihood,
  MixtureComponent,
  QuantilePoint,
  UncertainExpression,
  UncertainParameter,
  UncertainUnit,
  UncertainValue,
} from "interfaces-mef-types/core/uncertainty";
import {
  EvidenceTermSchema,
  LawSchema,
  LikelihoodSchema,
  MixtureComponentSchema,
  QuantilePointSchema,
  UncertainExpressionSchema,
  UncertainParameterSchema,
  UncertainUnitSchema,
  UncertainValueSchema,
} from "interfaces-mef-types/zod/core/uncertainty";

type UncertaintySamplingMethod = "MONTE_CARLO" | "LATIN_HYPERCUBE";

type UncertaintyPooling = "LINEAR" | "LOGARITHMIC";

interface UncertaintyLawQuery {
  id: string;
  value: UncertainValue;
  probabilities: number[];
  curveProbabilities: number[];
}

interface UncertaintySampling {
  method: UncertaintySamplingMethod;
  trials: number;
  seed: number;
}

interface UncertaintyExpressionQuery {
  id: string;
  expression: UncertainExpression;
  unit: UncertainUnit;
  probabilities: number[];
  sampling?: UncertaintySampling;
}

type UncertaintyOperation =
  | { kind: "SCALE"; law: Law; factor: number }
  | { kind: "CONSTRAINED_NONINFORMATIVE"; law: Law; likelihood: Likelihood }
  | { kind: "LOGNORMAL_FIT"; mean: number | null; median: number | null; quantiles: QuantilePoint[] }
  | { kind: "POOL"; pooling: UncertaintyPooling; components: MixtureComponent[] }
  | { kind: "PRIOR_PREDICTIVE"; law: Law; term: EvidenceTerm }
  | { kind: "HOMOGENEITY"; terms: EvidenceTerm[] }
  | { kind: "LAPLACE_TREND"; times: number[]; start: number; end: number }
  | { kind: "CCF_IMPACT_VECTOR"; groupSize: number; multiplicities: UncertaintyMultiplicity[] }
  | { kind: "CCF_MAP_DOWN"; counts: number[]; targetSize: number }
  | { kind: "CCF_MAP_UP"; independent: number; nonLethal: number[]; lethal: number; rho: number; targetSize: number };

interface UncertaintyMultiplicity {
  failed: number;
  events: number;
}

interface UncertaintyOperationQuery {
  id: string;
  operation: UncertaintyOperation;
}

interface UncertaintyRequest {
  parameters: UncertainParameter[];
  laws: UncertaintyLawQuery[];
  expressions: UncertaintyExpressionQuery[];
  operations: UncertaintyOperationQuery[];
}

interface UncertaintyQuantile {
  probability: number;
  value: number;
}

interface UncertaintyCurvePoint {
  x: number;
  cumulative: number;
  density: number | null;
}

interface UncertaintyTurningPoint {
  x: number;
  density: number;
}

interface UncertaintyAtom {
  value: number;
  probability: number;
}

interface UncertaintyFailure {
  id: string;
  error: string;
}

interface UncertaintyLawSummary {
  id: string;
  mean: number;
  standardDeviation: number | null;
  quantiles: UncertaintyQuantile[];
  support: { lower: number | null; upper: number | null };
  curve: UncertaintyCurvePoint[];
  peaks: UncertaintyTurningPoint[];
  valleys: UncertaintyTurningPoint[];
  atoms: UncertaintyAtom[];
}

interface UncertaintySampledSummary {
  mean: number;
  standardDeviation: number;
  standardError: number;
  quantiles: UncertaintyQuantile[];
  samples: number[];
}

interface UncertaintyExpressionSummary {
  id: string;
  unit: UncertainUnit;
  point: number;
  sampled: UncertaintySampledSummary | null;
}

interface UncertaintyLawResult {
  id: string;
  law: Law;
}

interface UncertaintyPredictiveResult {
  id: string;
  expected: number;
  atMost: number;
  atLeast: number;
}

interface UncertaintyHomogeneityResult {
  id: string;
  statistic: number;
  degreesOfFreedom: number;
  probability: number;
  smallExpected: boolean;
}

interface UncertaintyTrendResult {
  id: string;
  statistic: number;
  probability: number;
}

interface UncertaintyImpactCountsResult {
  id: string;
  groupSize: number;
  counts: number[];
}

interface UncertaintyMappedDownResult {
  id: string;
  groupSize: number;
  counts: number[];
  noImpact: number;
}

type UncertaintyOperationResult =
  | UncertaintyLawResult
  | UncertaintyPredictiveResult
  | UncertaintyHomogeneityResult
  | UncertaintyTrendResult
  | UncertaintyImpactCountsResult
  | UncertaintyMappedDownResult
  | UncertaintyFailure;

interface UncertaintyResponse {
  laws: (UncertaintyLawSummary | UncertaintyFailure)[];
  expressions: (UncertaintyExpressionSummary | UncertaintyFailure)[];
  operations: UncertaintyOperationResult[];
}

const UncertaintySamplingMethodSchema = z.enum(["MONTE_CARLO", "LATIN_HYPERCUBE"]);

const UncertaintyPoolingSchema = z.enum(["LINEAR", "LOGARITHMIC"]);

const OpenProbabilitySchema = z.number().gt(0).lt(1);

const UncertaintyLawQuerySchema = z.strictObject({
  id: z.string().min(1),
  value: UncertainValueSchema,
  probabilities: z.array(OpenProbabilitySchema),
  curveProbabilities: z.array(OpenProbabilitySchema),
});

const UncertaintySamplingSchema = z.strictObject({
  method: UncertaintySamplingMethodSchema,
  trials: z.number().int().min(1).max(100_000),
  seed: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});

const UncertaintyExpressionQuerySchema = z.strictObject({
  id: z.string().min(1),
  expression: UncertainExpressionSchema,
  unit: UncertainUnitSchema,
  probabilities: z.array(OpenProbabilitySchema),
  sampling: UncertaintySamplingSchema.optional(),
});

const GroupSizeSchema = z.number().int().min(1);

const EventCountSchema = z.number().nonnegative();

const EventCountsSchema = z.array(EventCountSchema).min(1);

const UncertaintyMultiplicitySchema = z.strictObject({ failed: GroupSizeSchema, events: EventCountSchema });

const UncertaintyOperationSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("SCALE"), law: LawSchema, factor: z.number().positive() }),
  z.strictObject({ kind: z.literal("CONSTRAINED_NONINFORMATIVE"), law: LawSchema, likelihood: LikelihoodSchema }),
  z.strictObject({
    kind: z.literal("LOGNORMAL_FIT"),
    mean: z.number().positive().nullable(),
    median: z.number().positive().nullable(),
    quantiles: z.array(QuantilePointSchema).max(2),
  }),
  z.strictObject({ kind: z.literal("POOL"), pooling: UncertaintyPoolingSchema, components: z.array(MixtureComponentSchema).min(1) }),
  z.strictObject({ kind: z.literal("PRIOR_PREDICTIVE"), law: LawSchema, term: EvidenceTermSchema }),
  z.strictObject({ kind: z.literal("HOMOGENEITY"), terms: z.array(EvidenceTermSchema).min(2) }),
  z.strictObject({ kind: z.literal("LAPLACE_TREND"), times: z.array(z.number()).min(3), start: z.number(), end: z.number() }),
  z.strictObject({ kind: z.literal("CCF_IMPACT_VECTOR"), groupSize: GroupSizeSchema, multiplicities: z.array(UncertaintyMultiplicitySchema) }),
  z.strictObject({ kind: z.literal("CCF_MAP_DOWN"), counts: EventCountsSchema, targetSize: GroupSizeSchema }),
  z.strictObject({
    kind: z.literal("CCF_MAP_UP"),
    independent: EventCountSchema,
    nonLethal: EventCountsSchema,
    lethal: EventCountSchema,
    rho: z.number().min(0).max(1),
    targetSize: GroupSizeSchema,
  }),
]);

const UncertaintyOperationQuerySchema = z.strictObject({
  id: z.string().min(1),
  operation: UncertaintyOperationSchema,
});

const UncertaintyRequestSchema = z.strictObject({
  parameters: z.array(UncertainParameterSchema),
  laws: z.array(UncertaintyLawQuerySchema),
  expressions: z.array(UncertaintyExpressionQuerySchema),
  operations: z.array(UncertaintyOperationQuerySchema),
});

const UncertaintyQuantileSchema = z.strictObject({ probability: z.number(), value: z.number() });

const UncertaintyFailureSchema = z.strictObject({ id: z.string(), error: z.string() });

const UncertaintyTurningPointSchema = z.strictObject({ x: z.number(), density: z.number() });

const UncertaintyLawSummarySchema = z.strictObject({
  id: z.string(),
  mean: z.number(),
  standardDeviation: z.number().nullable(),
  quantiles: z.array(UncertaintyQuantileSchema),
  support: z.strictObject({ lower: z.number().nullable(), upper: z.number().nullable() }),
  curve: z.array(z.strictObject({ x: z.number(), cumulative: z.number(), density: z.number().nullable() })),
  peaks: z.array(UncertaintyTurningPointSchema),
  valleys: z.array(UncertaintyTurningPointSchema),
  atoms: z.array(z.strictObject({ value: z.number(), probability: z.number() })),
});

const UncertaintySampledSummarySchema = z.strictObject({
  mean: z.number(),
  standardDeviation: z.number(),
  standardError: z.number(),
  quantiles: z.array(UncertaintyQuantileSchema),
  samples: z.array(z.number()),
});

const UncertaintyExpressionSummarySchema = z.strictObject({
  id: z.string(),
  unit: UncertainUnitSchema,
  point: z.number(),
  sampled: UncertaintySampledSummarySchema.nullable(),
});

const UncertaintyOperationResultSchema = z.union([
  z.strictObject({ id: z.string(), law: LawSchema }),
  z.strictObject({ id: z.string(), expected: z.number(), atMost: z.number(), atLeast: z.number() }),
  z.strictObject({
    id: z.string(),
    statistic: z.number(),
    degreesOfFreedom: z.number(),
    probability: z.number(),
    smallExpected: z.boolean(),
  }),
  z.strictObject({ id: z.string(), statistic: z.number(), probability: z.number() }),
  z.strictObject({ id: z.string(), groupSize: z.number(), counts: z.array(z.number()) }),
  z.strictObject({ id: z.string(), groupSize: z.number(), counts: z.array(z.number()), noImpact: z.number() }),
  UncertaintyFailureSchema,
]);

const UncertaintyResponseSchema = z.strictObject({
  laws: z.array(z.union([UncertaintyLawSummarySchema, UncertaintyFailureSchema])),
  expressions: z.array(z.union([UncertaintyExpressionSummarySchema, UncertaintyFailureSchema])),
  operations: z.array(UncertaintyOperationResultSchema),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertRequest = Expect<Equal<z.infer<typeof UncertaintyRequestSchema>, UncertaintyRequest>>;
type _AssertResponse = Expect<Equal<z.infer<typeof UncertaintyResponseSchema>, UncertaintyResponse>>;

export {
  UncertaintyExpressionQuerySchema,
  UncertaintyLawQuerySchema,
  UncertaintyOperationQuerySchema,
  UncertaintyOperationSchema,
  UncertaintyPoolingSchema,
  UncertaintyRequestSchema,
  UncertaintyResponseSchema,
  UncertaintySamplingMethodSchema,
  UncertaintySamplingSchema,
};
export type {
  UncertaintyAtom,
  UncertaintyCurvePoint,
  UncertaintyExpressionQuery,
  UncertaintyExpressionSummary,
  UncertaintyFailure,
  UncertaintyHomogeneityResult,
  UncertaintyImpactCountsResult,
  UncertaintyLawQuery,
  UncertaintyLawResult,
  UncertaintyLawSummary,
  UncertaintyMappedDownResult,
  UncertaintyMultiplicity,
  UncertaintyOperation,
  UncertaintyOperationQuery,
  UncertaintyOperationResult,
  UncertaintyPooling,
  UncertaintyPredictiveResult,
  UncertaintyQuantile,
  UncertaintyRequest,
  UncertaintyResponse,
  UncertaintySampledSummary,
  UncertaintySampling,
  UncertaintySamplingMethod,
  UncertaintyTrendResult,
  UncertaintyTurningPoint,
};
