import type { WorkbookParameterReference } from "../modeling/references";

export type UncertainUnit =
  | "PROBABILITY"
  | "FRACTION"
  | "FACTOR"
  | "PER_HOUR"
  | "PER_YEAR"
  | "HOURS"
  | "MINUTES"
  | "YEARS"
  | "QUANTITY";

export interface PointLaw {
  family: "POINT";
  value: number;
}

export interface BetaLaw {
  family: "BETA";
  alpha: number;
  beta: number;
  lower: number;
  upper: number;
}

export interface GammaLaw {
  family: "GAMMA";
  shape: number;
  rate: number;
}

export interface LognormalLaw {
  family: "LOGNORMAL";
  mean: number;
  errorFactor: number;
  level: number;
}

export interface NormalLaw {
  family: "NORMAL";
  mean: number;
  standardDeviation: number;
}

export interface StudentTLaw {
  family: "STUDENT_T";
  location: number;
  scale: number;
  degreesOfFreedom: number;
}

export interface LogitNormalLaw {
  family: "LOGIT_NORMAL";
  mu: number;
  sigma: number;
}

export interface UniformLaw {
  family: "UNIFORM";
  lower: number;
  upper: number;
}

export interface LogUniformLaw {
  family: "LOG_UNIFORM";
  lower: number;
  upper: number;
}

export interface TriangularLaw {
  family: "TRIANGULAR";
  lower: number;
  mode: number;
  upper: number;
}

export interface LogTriangularLaw {
  family: "LOG_TRIANGULAR";
  lower: number;
  mode: number;
  upper: number;
}

export interface WeibullLaw {
  family: "WEIBULL";
  scale: number;
  shape: number;
  location: number;
}

export interface MaximumEntropyLaw {
  family: "MAXIMUM_ENTROPY";
  lower: number;
  mean: number;
  upper: number;
}

export interface ConstrainedNoninformativeLaw {
  family: "CONSTRAINED_NONINFORMATIVE";
  mean: number;
}

export interface DiscreteOutcome {
  value: number;
  weight: number;
}

export interface DiscreteLaw {
  family: "DISCRETE";
  outcomes: DiscreteOutcome[];
}

export interface QuantilePoint {
  probability: number;
  value: number;
}

export type TabulatedScale = "LINEAR" | "LOG";

export interface TabulatedLaw {
  family: "TABULATED";
  points: QuantilePoint[];
  scale: TabulatedScale;
}

export interface MetalogLaw {
  family: "METALOG";
  points: QuantilePoint[];
  lower: number | null;
  upper: number | null;
}

export interface NoSmoothing {
  kind: "NONE";
}

export interface GaussianKernelSmoothing {
  kind: "GAUSSIAN_KERNEL";
  bandwidth: number;
}

export type SampleSmoothing = NoSmoothing | GaussianKernelSmoothing;

export interface SamplesLaw {
  family: "SAMPLES";
  values: number[];
  weights: number[];
  smoothing: SampleSmoothing;
}

export type BaseLaw =
  | PointLaw
  | BetaLaw
  | GammaLaw
  | LognormalLaw
  | NormalLaw
  | StudentTLaw
  | LogitNormalLaw
  | UniformLaw
  | LogUniformLaw
  | TriangularLaw
  | LogTriangularLaw
  | WeibullLaw
  | MaximumEntropyLaw
  | ConstrainedNoninformativeLaw
  | DiscreteLaw
  | TabulatedLaw
  | MetalogLaw
  | SamplesLaw;

export interface TruncatedLaw {
  family: "TRUNCATED";
  law: BaseLaw | MixtureLaw;
  lower: number | null;
  upper: number | null;
}

export interface MixtureComponent {
  weight: number;
  law: BaseLaw | TruncatedLaw;
}

export interface MixtureLaw {
  family: "MIXTURE";
  components: MixtureComponent[];
}

export type Likelihood = "BINOMIAL" | "POISSON";

export interface EvidenceTerm {
  likelihood: Likelihood;
  failures: number;
  exposure: number;
}

export interface PosteriorLaw {
  family: "POSTERIOR";
  prior: BaseLaw | TruncatedLaw | MixtureLaw | null;
  evidence: EvidenceTerm[];
}

export interface PopulationLaw {
  family: "POPULATION";
  mu: BaseLaw | TruncatedLaw;
  sigma: BaseLaw | TruncatedLaw;
  upper: number | null;
  evidence: EvidenceTerm[];
  target: number | null;
}

export type Law = BaseLaw | TruncatedLaw | MixtureLaw | PosteriorLaw | PopulationLaw;

export type LawFamily = Law["family"];

const LAW_FAMILY_SET: Record<LawFamily, true> = {
  POINT: true,
  BETA: true,
  GAMMA: true,
  LOGNORMAL: true,
  NORMAL: true,
  STUDENT_T: true,
  LOGIT_NORMAL: true,
  UNIFORM: true,
  LOG_UNIFORM: true,
  TRIANGULAR: true,
  LOG_TRIANGULAR: true,
  WEIBULL: true,
  MAXIMUM_ENTROPY: true,
  CONSTRAINED_NONINFORMATIVE: true,
  DISCRETE: true,
  TABULATED: true,
  METALOG: true,
  SAMPLES: true,
  TRUNCATED: true,
  MIXTURE: true,
  POSTERIOR: true,
  POPULATION: true,
};

export const LAW_FAMILIES: readonly string[] = Object.keys(LAW_FAMILY_SET);

export interface UncertainValue {
  unit: UncertainUnit;
  law: Law;
}

export type UncertainOperation =
  | "ADD"
  | "SUBTRACT"
  | "MULTIPLY"
  | "DIVIDE"
  | "POWER"
  | "EXP"
  | "LOG"
  | "MIN"
  | "MAX";

export interface ValueExpression {
  node: "VALUE";
  value: UncertainValue;
}

export interface ParameterExpression {
  node: "PARAMETER";
  reference: WorkbookParameterReference;
}

export interface OperationExpression {
  node: "OPERATION";
  operation: UncertainOperation;
  operands: UncertainExpression[];
}

export interface MissionModel {
  form: "MISSION";
  rate: UncertainExpression;
  missionTime: UncertainExpression;
}

export interface StandbyModel {
  form: "STANDBY";
  rate: UncertainExpression;
  testInterval: UncertainExpression;
}

export interface RepairableModel {
  form: "REPAIRABLE";
  demandFailure: UncertainExpression;
  rate: UncertainExpression;
  repairRate: UncertainExpression;
  time: UncertainExpression;
}

export interface WeibullModel {
  form: "WEIBULL";
  scale: UncertainExpression;
  shape: UncertainExpression;
  location: UncertainExpression;
  time: UncertainExpression;
}

export interface FragilityModel {
  form: "FRAGILITY";
  median: UncertainExpression;
  randomness: UncertainExpression;
  demand: UncertainExpression;
}

export type ComponentModel = MissionModel | StandbyModel | RepairableModel | WeibullModel | FragilityModel;

export type ComponentModelForm = ComponentModel["form"];

export interface ModelExpression {
  node: "MODEL";
  model: ComponentModel;
}

export type UncertainExpression = ValueExpression | ParameterExpression | OperationExpression | ModelExpression;

export interface UncertainParameter {
  reference: WorkbookParameterReference;
  expression: UncertainExpression;
}

export interface DirichletLaw {
  family: "DIRICHLET";
  concentrations: number[];
}

export interface FixedVectorLaw {
  family: "FIXED";
  values: number[];
}

export type VectorLaw = DirichletLaw | FixedVectorLaw;

export interface VectorValueExpression {
  node: "VALUE";
  law: VectorLaw;
}

export type UncertainVector = VectorValueExpression | ParameterExpression;

export interface UncertainVectorParameter {
  reference: WorkbookParameterReference;
  vector: VectorLaw;
}

export type CcfTesting = "STAGGERED" | "NON_STAGGERED";

export interface BetaFactorModel {
  model: "BETA_FACTOR";
  beta: UncertainExpression;
}

export interface MultipleGreekLetterModel {
  model: "MGL";
  factors: UncertainExpression[];
}

export interface AlphaFactorModel {
  model: "ALPHA_FACTOR";
  testing: CcfTesting;
  alphas: UncertainVector;
}

export interface PhiFactorModel {
  model: "PHI_FACTOR";
  phis: UncertainVector;
}

export type CcfFactorModel = BetaFactorModel | MultipleGreekLetterModel | AlphaFactorModel | PhiFactorModel;

export interface UncertainLawField {
  field: string;
  value: UncertainExpression;
}

export interface AleatoryVariable {
  law: Law;
  fields: UncertainLawField[];
}

export function modelArguments(model: ComponentModel): UncertainExpression[] {
  switch (model.form) {
    case "MISSION":
      return [model.rate, model.missionTime];
    case "STANDBY":
      return [model.rate, model.testInterval];
    case "REPAIRABLE":
      return [model.demandFailure, model.rate, model.repairRate, model.time];
    case "WEIBULL":
      return [model.scale, model.shape, model.location, model.time];
    case "FRAGILITY":
      return [model.median, model.randomness, model.demand];
  }
}

export function mapModelArguments(model: ComponentModel, map: (argument: UncertainExpression) => UncertainExpression): ComponentModel {
  switch (model.form) {
    case "MISSION":
      return { form: "MISSION", rate: map(model.rate), missionTime: map(model.missionTime) };
    case "STANDBY":
      return { form: "STANDBY", rate: map(model.rate), testInterval: map(model.testInterval) };
    case "REPAIRABLE":
      return { form: "REPAIRABLE", demandFailure: map(model.demandFailure), rate: map(model.rate), repairRate: map(model.repairRate), time: map(model.time) };
    case "WEIBULL":
      return { form: "WEIBULL", scale: map(model.scale), shape: map(model.shape), location: map(model.location), time: map(model.time) };
    case "FRAGILITY":
      return { form: "FRAGILITY", median: map(model.median), randomness: map(model.randomness), demand: map(model.demand) };
  }
}

export function vectorLength(law: VectorLaw): number {
  return law.family === "DIRICHLET" ? law.concentrations.length : law.values.length;
}

export function vectorMean(law: VectorLaw): number[] {
  if (law.family === "FIXED") return [...law.values];
  const total = law.concentrations.reduce((sum, value) => sum + value, 0);
  return law.concentrations.map((value) => value / total);
}

export function ccfFactorExpressions(model: CcfFactorModel): UncertainExpression[] {
  switch (model.model) {
    case "BETA_FACTOR":
      return [model.beta];
    case "MGL":
      return model.factors;
    case "ALPHA_FACTOR":
    case "PHI_FACTOR":
      return [];
  }
}

export function ccfFactorVector(model: CcfFactorModel): UncertainVector | undefined {
  switch (model.model) {
    case "ALPHA_FACTOR":
      return model.alphas;
    case "PHI_FACTOR":
      return model.phis;
    case "BETA_FACTOR":
    case "MGL":
      return undefined;
  }
}

export function expressionReferences(expression: UncertainExpression): WorkbookParameterReference[] {
  switch (expression.node) {
    case "VALUE":
      return [];
    case "PARAMETER":
      return [expression.reference];
    case "OPERATION":
      return expression.operands.flatMap(expressionReferences);
    case "MODEL":
      return modelArguments(expression.model).flatMap(expressionReferences);
  }
}

export function parameterReferenceKey(reference: Pick<WorkbookParameterReference, "workbookId" | "entityId">): string {
  return `${reference.workbookId.trim()}:${reference.entityId.trim()}`;
}

export interface LawBounds {
  lower: number;
  upper: number;
}

function joined(parts: LawBounds[]): LawBounds {
  return {
    lower: Math.min(...parts.map((part) => part.lower)),
    upper: Math.max(...parts.map((part) => part.upper)),
  };
}

function valueBounds(values: number[]): LawBounds {
  return values.length === 0
    ? { lower: Number.NEGATIVE_INFINITY, upper: Number.POSITIVE_INFINITY }
    : { lower: Math.min(...values), upper: Math.max(...values) };
}

export function lawBounds(law: Law): LawBounds {
  switch (law.family) {
    case "POINT":
      return { lower: law.value, upper: law.value };
    case "BETA":
    case "UNIFORM":
    case "LOG_UNIFORM":
    case "TRIANGULAR":
    case "LOG_TRIANGULAR":
    case "MAXIMUM_ENTROPY":
      return { lower: law.lower, upper: law.upper };
    case "GAMMA":
    case "LOGNORMAL":
      return { lower: 0, upper: Number.POSITIVE_INFINITY };
    case "CONSTRAINED_NONINFORMATIVE":
    case "LOGIT_NORMAL":
      return { lower: 0, upper: 1 };
    case "NORMAL":
    case "STUDENT_T":
      return { lower: Number.NEGATIVE_INFINITY, upper: Number.POSITIVE_INFINITY };
    case "WEIBULL":
      return { lower: law.location, upper: Number.POSITIVE_INFINITY };
    case "DISCRETE":
      return valueBounds(law.outcomes.map((outcome) => outcome.value));
    case "TABULATED":
      return valueBounds(law.points.map((point) => point.value));
    case "METALOG":
      return { lower: law.lower ?? Number.NEGATIVE_INFINITY, upper: law.upper ?? Number.POSITIVE_INFINITY };
    case "SAMPLES":
      return law.smoothing.kind === "NONE"
        ? valueBounds(law.values)
        : { lower: Number.NEGATIVE_INFINITY, upper: Number.POSITIVE_INFINITY };
    case "TRUNCATED": {
      const inner = lawBounds(law.law);
      return {
        lower: law.lower === null ? inner.lower : Math.max(inner.lower, law.lower),
        upper: law.upper === null ? inner.upper : Math.min(inner.upper, law.upper),
      };
    }
    case "MIXTURE":
      return joined(law.components.map((component) => lawBounds(component.law)));
    case "POSTERIOR": {
      const binomial = law.evidence.some((term) => term.likelihood === "BINOMIAL");
      const prior = law.prior === null ? { lower: 0, upper: binomial ? 1 : Number.POSITIVE_INFINITY } : lawBounds(law.prior);
      return binomial ? { lower: Math.max(prior.lower, 0), upper: Math.min(prior.upper, 1) } : prior;
    }
    case "POPULATION":
      return { lower: 0, upper: law.upper ?? Number.POSITIVE_INFINITY };
  }
}

export function unitBounds(unit: UncertainUnit): LawBounds {
  if (unit === "QUANTITY") return { lower: Number.NEGATIVE_INFINITY, upper: Number.POSITIVE_INFINITY };
  return { lower: 0, upper: unit === "PROBABILITY" || unit === "FRACTION" ? 1 : Number.POSITIVE_INFINITY };
}

export function lawWithinUnit(unit: UncertainUnit, law: Law): Law {
  const domain = unitBounds(unit);
  const bounds = lawBounds(law);
  const lower = bounds.lower < domain.lower ? domain.lower : null;
  const upper = bounds.upper > domain.upper ? domain.upper : null;
  if (lower === null && upper === null) return law;
  if (law.family === "TRUNCATED") {
    return { family: "TRUNCATED", law: law.law, lower: lower ?? law.lower, upper: upper ?? law.upper };
  }
  if (law.family === "POSTERIOR" || law.family === "POPULATION" || law.family === "POINT") return law;
  return { family: "TRUNCATED", law, lower, upper };
}

export type CanonicalValue = object | string | number | boolean | null | undefined;

export function canonicalJson(value: CanonicalValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([name, entry]) => `${JSON.stringify(name)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
