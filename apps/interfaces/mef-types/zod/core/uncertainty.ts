import { z } from "zod";
import type {
  AleatoryVariable,
  BaseLaw,
  CcfFactorModel,
  ComponentModel,
  CountEvidence,
  DurationLaw,
  DurationModel,
  DurationParameter,
  EmpiricalBayesLaw,
  EvidenceTerm,
  Law,
  MixtureLaw,
  PopulationLaw,
  PosteriorLaw,
  ProductLaw,
  QuantilePoint,
  TrendLaw,
  TruncatedLaw,
  UncertainExpression,
  UncertainParameter,
  UncertainUnit,
  UncertainValue,
  UncertainVector,
  UncertainVectorParameter,
  VectorLaw,
  WeightedDirichletLaw,
} from "../../core/uncertainty";
import { ccfModelTakesTotal } from "../../core/uncertainty";
import { WorkbookParameterReferenceSchema } from "../modeling/references";

export const UncertainUnitSchema = z.enum([
  "PROBABILITY",
  "FRACTION",
  "FACTOR",
  "PER_HOUR",
  "PER_YEAR",
  "HOURS",
  "MINUTES",
  "YEARS",
  "QUANTITY",
]);

const orderedBounds = (law: { lower: number; upper: number }) => law.lower < law.upper;

const orderedMode = (law: { lower: number; mode: number; upper: number }) =>
  law.lower <= law.mode && law.mode <= law.upper && law.lower < law.upper;

const optionalOrderedBounds = (law: { lower: number | null; upper: number | null }) =>
  law.lower === null || law.upper === null || law.lower < law.upper;

const increasingProbabilities = (points: QuantilePoint[]) =>
  points.every((point, index) => index === 0 || point.probability > points[index - 1]!.probability);

const nondecreasingValues = (points: QuantilePoint[]) =>
  points.every((point, index) => index === 0 || point.value >= points[index - 1]!.value);

const increasingValues = (points: QuantilePoint[]) =>
  points.every((point, index) => index === 0 || point.value > points[index - 1]!.value);

export const PointLawSchema = z.strictObject({
  family: z.literal("POINT"),
  value: z.number(),
});

export const BetaLawSchema = z
  .strictObject({
    family: z.literal("BETA"),
    alpha: z.number().positive(),
    beta: z.number().positive(),
    lower: z.number(),
    upper: z.number(),
  })
  .refine(orderedBounds, { message: "Beta lower bound must be below its upper bound" });

export const GammaLawSchema = z.strictObject({
  family: z.literal("GAMMA"),
  shape: z.number().positive(),
  rate: z.number().positive(),
});

export const LognormalLawSchema = z.strictObject({
  family: z.literal("LOGNORMAL"),
  mean: z.number().positive(),
  errorFactor: z.number().gt(1),
  level: z.number().gt(0.5).lt(1),
});

export const NormalLawSchema = z.strictObject({
  family: z.literal("NORMAL"),
  mean: z.number(),
  standardDeviation: z.number().positive(),
});

export const StudentTLawSchema = z.strictObject({
  family: z.literal("STUDENT_T"),
  location: z.number(),
  scale: z.number().positive(),
  degreesOfFreedom: z.number().positive(),
});

export const LogitNormalLawSchema = z.strictObject({
  family: z.literal("LOGIT_NORMAL"),
  mu: z.number(),
  sigma: z.number().positive(),
});

export const UniformLawSchema = z
  .strictObject({
    family: z.literal("UNIFORM"),
    lower: z.number(),
    upper: z.number(),
  })
  .refine(orderedBounds, { message: "Uniform lower bound must be below its upper bound" });

export const LogUniformLawSchema = z
  .strictObject({
    family: z.literal("LOG_UNIFORM"),
    lower: z.number().positive(),
    upper: z.number().positive(),
  })
  .refine(orderedBounds, { message: "Log-uniform lower bound must be below its upper bound" });

export const TriangularLawSchema = z
  .strictObject({
    family: z.literal("TRIANGULAR"),
    lower: z.number(),
    mode: z.number(),
    upper: z.number(),
  })
  .refine(orderedMode, { message: "Triangular needs lower <= mode <= upper with lower < upper" });

export const LogTriangularLawSchema = z
  .strictObject({
    family: z.literal("LOG_TRIANGULAR"),
    lower: z.number().positive(),
    mode: z.number().positive(),
    upper: z.number().positive(),
  })
  .refine(orderedMode, { message: "Log-triangular needs lower <= mode <= upper with lower < upper" });

export const WeibullLawSchema = z.strictObject({
  family: z.literal("WEIBULL"),
  scale: z.number().positive(),
  shape: z.number().positive(),
  location: z.number(),
});

export const MaximumEntropyLawSchema = z
  .strictObject({
    family: z.literal("MAXIMUM_ENTROPY"),
    lower: z.number(),
    mean: z.number(),
    upper: z.number(),
  })
  .refine((law) => law.lower < law.mean && law.mean < law.upper, {
    message: "Maximum entropy needs lower < mean < upper",
  });

export const ConstrainedNoninformativeLawSchema = z.strictObject({
  family: z.literal("CONSTRAINED_NONINFORMATIVE"),
  mean: z.number().gt(0).lt(1),
});

export const DiscreteOutcomeSchema = z.strictObject({
  value: z.number(),
  weight: z.number().positive(),
});

export const DiscreteLawSchema = z.strictObject({
  family: z.literal("DISCRETE"),
  outcomes: z.array(DiscreteOutcomeSchema).min(1),
});

export const QuantilePointSchema = z.strictObject({
  probability: z.number(),
  value: z.number(),
});

export const TabulatedScaleSchema = z.enum(["LINEAR", "LOG"]);

export const TabulatedLawSchema = z
  .strictObject({
    family: z.literal("TABULATED"),
    points: z.array(QuantilePointSchema).min(2),
    scale: TabulatedScaleSchema,
  })
  .refine((law) => law.points[0]!.probability === 0 && law.points[law.points.length - 1]!.probability === 1, {
    message: "A tabulated law starts at probability 0 and ends at probability 1",
  })
  .refine((law) => increasingProbabilities(law.points), {
    message: "Tabulated probabilities must increase",
  })
  .refine((law) => nondecreasingValues(law.points), {
    message: "Tabulated values must not decrease",
  })
  .refine((law) => law.scale === "LINEAR" || law.points[0]!.value > 0, {
    message: "A log-scale tabulated law needs positive values",
  });

export const MetalogLawSchema = z
  .strictObject({
    family: z.literal("METALOG"),
    points: z.array(QuantilePointSchema).min(2),
    lower: z.number().nullable(),
    upper: z.number().nullable(),
  })
  .refine((law) => law.points.every((point) => point.probability > 0 && point.probability < 1), {
    message: "Metalog probabilities lie strictly between 0 and 1",
  })
  .refine((law) => increasingProbabilities(law.points), {
    message: "Metalog probabilities must increase",
  })
  .refine((law) => increasingValues(law.points), {
    message: "Metalog values must increase",
  })
  .refine((law) => law.lower === null || law.lower < law.points[0]!.value, {
    message: "Metalog lower bound must be below the first value",
  })
  .refine((law) => law.upper === null || law.upper > law.points[law.points.length - 1]!.value, {
    message: "Metalog upper bound must be above the last value",
  });

export const NoSmoothingSchema = z.strictObject({
  kind: z.literal("NONE"),
});

export const GaussianKernelSmoothingSchema = z.strictObject({
  kind: z.literal("GAUSSIAN_KERNEL"),
  bandwidth: z.number().positive(),
});

export const SampleSmoothingSchema = z.discriminatedUnion("kind", [NoSmoothingSchema, GaussianKernelSmoothingSchema]);

export const SamplesLawSchema = z
  .strictObject({
    family: z.literal("SAMPLES"),
    values: z.array(z.number()).min(1),
    weights: z.array(z.number().positive()),
    smoothing: SampleSmoothingSchema,
  })
  .refine((law) => law.weights.length === 0 || law.weights.length === law.values.length, {
    message: "Sample weights are empty or one per value",
  });

export const BaseLawSchema = z.discriminatedUnion("family", [
  PointLawSchema,
  BetaLawSchema,
  GammaLawSchema,
  LognormalLawSchema,
  NormalLawSchema,
  StudentTLawSchema,
  LogitNormalLawSchema,
  UniformLawSchema,
  LogUniformLawSchema,
  TriangularLawSchema,
  LogTriangularLawSchema,
  WeibullLawSchema,
  MaximumEntropyLawSchema,
  ConstrainedNoninformativeLawSchema,
  DiscreteLawSchema,
  TabulatedLawSchema,
  MetalogLawSchema,
  SamplesLawSchema,
]);

export const TruncatedLawSchema = z
  .strictObject({
    family: z.literal("TRUNCATED"),
    get law(): z.ZodType<BaseLaw | MixtureLaw | ProductLaw> {
      return z.union([BaseLawSchema, MixtureLawSchema, ProductLawSchema]);
    },
    lower: z.number().nullable(),
    upper: z.number().nullable(),
  })
  .refine((law) => law.lower !== null || law.upper !== null, {
    message: "A truncated law needs at least one bound",
  })
  .refine(optionalOrderedBounds, { message: "Truncation lower bound must be below its upper bound" });

export const MixtureComponentSchema = z.strictObject({
  weight: z.number().positive(),
  get law(): z.ZodType<BaseLaw | TruncatedLaw | ProductLaw> {
    return z.union([BaseLawSchema, TruncatedLawSchema, ProductLawSchema]);
  },
});

export const MixtureLawSchema = z.strictObject({
  family: z.literal("MIXTURE"),
  components: z.array(MixtureComponentSchema).min(2),
});

export const CountLikelihoodSchema = z.enum(["BINOMIAL", "POISSON"]);

export const LikelihoodSchema = z.enum(["BINOMIAL", "POISSON", "STANDBY_DEMAND", "UNCERTAIN_COUNT"]);

export const CountEvidenceSchema = z
  .strictObject({
    likelihood: CountLikelihoodSchema,
    failures: z.number().nonnegative(),
    exposure: z.number().positive(),
  })
  .refine((term) => term.likelihood === "POISSON" || term.failures <= term.exposure, {
    message: "Binomial evidence cannot have more failures than demands",
  });

export const StandbyDemandKindSchema = z.enum(["TEST", "RANDOM"]);

export const StandbyDemandEvidenceSchema = z
  .strictObject({
    likelihood: z.literal("STANDBY_DEMAND"),
    demand: StandbyDemandKindSchema,
    failures: z.number().nonnegative(),
    exposure: z.number().positive(),
    testInterval: z.number().positive(),
  })
  .refine((term) => term.failures <= term.exposure, {
    message: "Standby evidence cannot have more failures than demands",
  });

export const UncertainCountEvidenceSchema = z
  .strictObject({
    likelihood: z.literal("UNCERTAIN_COUNT"),
    count: CountLikelihoodSchema,
    outcomes: z.array(z.strictObject({ value: z.number().nonnegative(), weight: z.number().positive() })).min(1),
    exposure: z.number().positive(),
  })
  .refine((term) => term.count === "POISSON" || term.outcomes.every((outcome) => outcome.value <= term.exposure), {
    message: "An uncertain binomial count cannot have more failures than demands",
  });

export const EvidenceTermSchema = z.discriminatedUnion("likelihood", [
  CountEvidenceSchema,
  StandbyDemandEvidenceSchema,
  UncertainCountEvidenceSchema,
]);

export const PosteriorLawSchema = z.strictObject({
  family: z.literal("POSTERIOR"),
  get prior(): z.ZodType<BaseLaw | TruncatedLaw | MixtureLaw | ProductLaw | null> {
    return z.union([BaseLawSchema, TruncatedLawSchema, MixtureLawSchema, ProductLawSchema]).nullable();
  },
  evidence: z.array(EvidenceTermSchema).min(1),
});

export const PopulationLawSchema = z
  .strictObject({
    family: z.literal("POPULATION"),
    get mu(): z.ZodType<BaseLaw | TruncatedLaw> {
      return z.union([BaseLawSchema, TruncatedLawSchema]);
    },
    get sigma(): z.ZodType<BaseLaw | TruncatedLaw> {
      return z.union([BaseLawSchema, TruncatedLawSchema]);
    },
    upper: z.number().positive().nullable(),
    evidence: z.array(EvidenceTermSchema).min(2),
    target: z.number().int().nonnegative().nullable(),
  })
  .refine((law) => law.target === null || law.target < law.evidence.length, {
    message: "A population target names one of its evidence sets",
  });

export const EmpiricalBayesLawSchema = z
  .strictObject({
    family: z.literal("EMPIRICAL_BAYES"),
    evidence: z.array(CountEvidenceSchema).min(2),
    target: z.number().int().nonnegative().nullable(),
  })
  .refine((law) => law.evidence.every((term) => term.likelihood === law.evidence[0]!.likelihood), {
    message: "Empirical Bayes members share one likelihood",
  })
  .refine((law) => law.target === null || law.target < law.evidence.length, {
    message: "An empirical Bayes target names one of its members",
  });

export const DurationModelSchema = z.enum(["EXPONENTIAL", "LOGNORMAL", "WEIBULL", "GAMMA"]);

export const DurationParameterSchema = z.enum(["RATE", "MU", "SIGMA", "SHAPE", "SCALE"]);

export const DURATION_PARAMETERS: Record<DurationModel, readonly DurationParameter[]> = {
  EXPONENTIAL: ["RATE"],
  LOGNORMAL: ["MU", "SIGMA"],
  WEIBULL: ["SHAPE", "SCALE"],
  GAMMA: ["SHAPE", "RATE"],
};

export const DurationPriorSchema = z.strictObject({
  parameter: DurationParameterSchema,
  get law(): z.ZodType<BaseLaw | TruncatedLaw> {
    return z.union([BaseLawSchema, TruncatedLawSchema]);
  },
});

export const DurationExceedanceSchema = z.strictObject({
  kind: z.literal("EXCEEDANCE"),
  time: z.number().positive(),
});

export const DurationMeanSchema = z.strictObject({
  kind: z.literal("MEAN"),
});

export const DurationOutputSchema = z.discriminatedUnion("kind", [DurationExceedanceSchema, DurationMeanSchema]);

export const DurationLawSchema = z
  .strictObject({
    family: z.literal("DURATION"),
    model: DurationModelSchema,
    times: z.array(z.number().positive()),
    censored: z.array(z.number().positive()),
    priors: z.array(DurationPriorSchema),
    output: DurationOutputSchema,
  })
  .refine((law) => law.times.length > 0 || DURATION_PARAMETERS[law.model].every((parameter) => law.priors.some((prior) => prior.parameter === parameter)), {
    message: "A duration law needs a completed time or a prior on each parameter",
  })
  .refine((law) => law.priors.every((prior) => DURATION_PARAMETERS[law.model].includes(prior.parameter)), {
    message: "A duration prior names a parameter of its model",
  })
  .refine((law) => new Set(law.priors.map((prior) => prior.parameter)).size === law.priors.length, {
    message: "Each duration parameter has at most one prior",
  });

export const TrendBinSchema = z.strictObject({
  time: z.number(),
  failures: z.number().nonnegative(),
  exposure: z.number().positive(),
});

export const TrendLawSchema = z
  .strictObject({
    family: z.literal("TREND"),
    bins: z.array(TrendBinSchema).min(2),
    at: z.number(),
  })
  .refine((law) => new Set(law.bins.map((bin) => bin.time)).size >= 2, {
    message: "A trend needs bins at two or more times",
  })
  .refine((law) => law.bins.some((bin) => bin.failures > 0), {
    message: "A trend needs at least one failure",
  });

export const ProductLawSchema = z.strictObject({
  family: z.literal("PRODUCT"),
  get factors(): z.ZodArray<z.ZodType<Law>> {
    return z.array(LawSchema).min(2);
  },
});

export const LawSchema: z.ZodType<Law> = z.union([
  BaseLawSchema,
  TruncatedLawSchema,
  MixtureLawSchema,
  PosteriorLawSchema,
  PopulationLawSchema,
  EmpiricalBayesLawSchema,
  DurationLawSchema,
  TrendLawSchema,
  ProductLawSchema,
]);

export const UncertainValueSchema = z.strictObject({
  unit: UncertainUnitSchema,
  law: LawSchema,
});

export const UncertainOperationSchema = z.enum([
  "ADD",
  "SUBTRACT",
  "MULTIPLY",
  "DIVIDE",
  "POWER",
  "EXP",
  "LOG",
  "MIN",
  "MAX",
]);

const UNARY_OPERATIONS = new Set(["EXP", "LOG"]);
const BINARY_OPERATIONS = new Set(["SUBTRACT", "DIVIDE", "POWER"]);

export const ValueExpressionSchema = z.strictObject({
  node: z.literal("VALUE"),
  value: UncertainValueSchema,
});

export const ParameterExpressionSchema = z.strictObject({
  node: z.literal("PARAMETER"),
  reference: WorkbookParameterReferenceSchema,
});

export const OperationExpressionSchema = z
  .strictObject({
    node: z.literal("OPERATION"),
    operation: UncertainOperationSchema,
    get operands(): z.ZodArray<z.ZodType<UncertainExpression>> {
      return z.array(UncertainExpressionSchema);
    },
  })
  .refine(
    (expression) =>
      UNARY_OPERATIONS.has(expression.operation)
        ? expression.operands.length === 1
        : BINARY_OPERATIONS.has(expression.operation)
          ? expression.operands.length === 2
          : expression.operands.length >= 2,
    { message: "Operation has the wrong number of operands" },
  );

export const MissionModelSchema = z.strictObject({
  form: z.literal("MISSION"),
  get rate(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
  get missionTime(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
});

export const StandbyModelSchema = z.strictObject({
  form: z.literal("STANDBY"),
  get rate(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
  get testInterval(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
});

export const RepairableModelSchema = z.strictObject({
  form: z.literal("REPAIRABLE"),
  get demandFailure(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
  get rate(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
  get repairRate(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
  get time(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
});

export const WeibullModelSchema = z.strictObject({
  form: z.literal("WEIBULL"),
  get scale(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
  get shape(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
  get location(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
  get time(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
});

export const FragilityModelSchema = z.strictObject({
  form: z.literal("FRAGILITY"),
  get median(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
  get randomness(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
  get demand(): z.ZodType<UncertainExpression> {
    return UncertainExpressionSchema;
  },
});

export const ComponentModelSchema = z.discriminatedUnion("form", [
  MissionModelSchema,
  StandbyModelSchema,
  RepairableModelSchema,
  WeibullModelSchema,
  FragilityModelSchema,
]);

export const ModelExpressionSchema = z.strictObject({
  node: z.literal("MODEL"),
  model: ComponentModelSchema,
});

export const UncertainExpressionSchema: z.ZodType<UncertainExpression> = z.discriminatedUnion("node", [
  ValueExpressionSchema,
  ParameterExpressionSchema,
  OperationExpressionSchema,
  ModelExpressionSchema,
]);

export const UncertainParameterSchema = z.strictObject({
  reference: WorkbookParameterReferenceSchema,
  expression: UncertainExpressionSchema,
});

export const UncertainParameterTableSchema = z.array(UncertainParameterSchema).min(1);

const SIMPLEX_TOLERANCE = 1e-6;

export const DirichletLawSchema = z
  .strictObject({
    family: z.literal("DIRICHLET"),
    concentrations: z.array(z.number().nonnegative()).min(2),
  })
  .refine((law) => law.concentrations.some((value) => value > 0), { message: "A Dirichlet law needs a positive concentration" });

export const FixedVectorLawSchema = z
  .strictObject({
    family: z.literal("FIXED"),
    values: z.array(z.number().min(0).max(1)).min(1),
  })
  .refine((law) => Math.abs(law.values.reduce((sum, value) => sum + value, 0) - 1) <= SIMPLEX_TOLERANCE, { message: "A fixed vector of fractions sums to 1" });

export const WeightedDirichletLawSchema = z
  .strictObject({
    family: z.literal("WEIGHTED_DIRICHLET"),
    concentrations: z.array(z.number().positive()).min(2),
    weights: z.array(z.number().positive()).min(2),
  })
  .refine((law) => law.weights.length === law.concentrations.length, { message: "A weighted Dirichlet law needs one weight per concentration" });

export const VectorLawSchema = z.discriminatedUnion("family", [DirichletLawSchema, FixedVectorLawSchema, WeightedDirichletLawSchema]);

export const VectorValueExpressionSchema = z.strictObject({
  node: z.literal("VALUE"),
  law: VectorLawSchema,
});

export const UncertainVectorSchema = z.discriminatedUnion("node", [VectorValueExpressionSchema, ParameterExpressionSchema]);

export const UncertainVectorParameterSchema = z.strictObject({
  reference: WorkbookParameterReferenceSchema,
  vector: VectorLawSchema,
});

export const CcfTestingSchema = z.enum(["STAGGERED", "NON_STAGGERED"]);

export const BetaFactorModelSchema = z.strictObject({
  model: z.literal("BETA_FACTOR"),
  beta: UncertainExpressionSchema,
});

export const MultipleGreekLetterModelSchema = z.strictObject({
  model: z.literal("MGL"),
  factors: z.array(UncertainExpressionSchema).min(1),
});

export const AlphaFactorModelSchema = z.strictObject({
  model: z.literal("ALPHA_FACTOR"),
  testing: CcfTestingSchema,
  alphas: UncertainVectorSchema,
});

export const PhiFactorModelSchema = z.strictObject({
  model: z.literal("PHI_FACTOR"),
  phis: UncertainVectorSchema,
});

export const BinomialFailureRateModelSchema = z.strictObject({
  model: z.literal("BINOMIAL_FAILURE_RATE"),
  independent: UncertainExpressionSchema,
  nonLethalShock: UncertainExpressionSchema,
  componentFailure: UncertainExpressionSchema,
  lethalShock: UncertainExpressionSchema,
});

export const CcfFactorModelSchema = z.discriminatedUnion("model", [
  BetaFactorModelSchema,
  MultipleGreekLetterModelSchema,
  AlphaFactorModelSchema,
  PhiFactorModelSchema,
  BinomialFailureRateModelSchema,
]);

export const CCF_TOTAL_MESSAGE = "A binomial failure rate group takes no total. Every other common cause model needs one";

export const CCF_BFR_TOTAL_MESSAGE = "A binomial failure rate group takes no total";

export function ccfTotalMatchesModel(group: { factors?: CcfFactorModel; total?: UncertainExpression }): boolean {
  if (group.factors === undefined) return true;
  return ccfModelTakesTotal(group.factors) === (group.total !== undefined);
}

export function ccfTotalAllowedByModel(group: { factors?: CcfFactorModel; total?: UncertainExpression }): boolean {
  if (group.factors === undefined || group.total === undefined) return true;
  return ccfModelTakesTotal(group.factors);
}

export const UncertainLawFieldSchema = z.strictObject({
  field: z.string().min(1),
  value: UncertainExpressionSchema,
});

export const AleatoryVariableSchema = z
  .strictObject({
    law: LawSchema,
    fields: z.array(UncertainLawFieldSchema),
  })
  .refine((variable) => new Set(variable.fields.map((entry) => entry.field)).size === variable.fields.length, { message: "Each law field is uncertain at most once" });

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertUncertainUnit = Expect<Equal<z.infer<typeof UncertainUnitSchema>, UncertainUnit>>;
type _AssertBaseLaw = Expect<Equal<z.infer<typeof BaseLawSchema>, BaseLaw>>;
type _AssertTruncatedLaw = Expect<Equal<z.infer<typeof TruncatedLawSchema>, TruncatedLaw>>;
type _AssertMixtureLaw = Expect<Equal<z.infer<typeof MixtureLawSchema>, MixtureLaw>>;
type _AssertCountEvidence = Expect<Equal<z.infer<typeof CountEvidenceSchema>, CountEvidence>>;
type _AssertEvidenceTerm = Expect<Equal<z.infer<typeof EvidenceTermSchema>, EvidenceTerm>>;
type _AssertPosteriorLaw = Expect<Equal<z.infer<typeof PosteriorLawSchema>, PosteriorLaw>>;
type _AssertPopulationLaw = Expect<Equal<z.infer<typeof PopulationLawSchema>, PopulationLaw>>;
type _AssertEmpiricalBayesLaw = Expect<Equal<z.infer<typeof EmpiricalBayesLawSchema>, EmpiricalBayesLaw>>;
type _AssertDurationLaw = Expect<Equal<z.infer<typeof DurationLawSchema>, DurationLaw>>;
type _AssertTrendLaw = Expect<Equal<z.infer<typeof TrendLawSchema>, TrendLaw>>;
type _AssertProductLaw = Expect<Equal<z.infer<typeof ProductLawSchema>, ProductLaw>>;
type _AssertWeightedDirichletLaw = Expect<Equal<z.infer<typeof WeightedDirichletLawSchema>, WeightedDirichletLaw>>;
type _AssertUncertainValue = Expect<Equal<z.infer<typeof UncertainValueSchema>, UncertainValue>>;
type _AssertComponentModel = Expect<Equal<z.infer<typeof ComponentModelSchema>, ComponentModel>>;
type _AssertUncertainParameter = Expect<Equal<z.infer<typeof UncertainParameterSchema>, UncertainParameter>>;
type _AssertVectorLaw = Expect<Equal<z.infer<typeof VectorLawSchema>, VectorLaw>>;
type _AssertUncertainVector = Expect<Equal<z.infer<typeof UncertainVectorSchema>, UncertainVector>>;
type _AssertUncertainVectorParameter = Expect<Equal<z.infer<typeof UncertainVectorParameterSchema>, UncertainVectorParameter>>;
type _AssertCcfFactorModel = Expect<Equal<z.infer<typeof CcfFactorModelSchema>, CcfFactorModel>>;
type _AssertAleatoryVariable = Expect<Equal<z.infer<typeof AleatoryVariableSchema>, AleatoryVariable>>;
