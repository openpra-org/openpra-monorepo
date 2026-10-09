import { DistributionType, FrequencyUnit, type ParameterDistribution, type UncertainFrequency } from "interfaces-mef-types/core/events";
import {
  canonicalJson,
  lawWithinUnit,
  type Law,
  type UncertainExpression,
  type UncertainUnit,
  type UncertainValue,
} from "interfaces-mef-types/core/uncertainty";
import { ParameterDistributionSchema } from "interfaces-mef-types/zod/core/events";
import { LawSchema, UncertainExpressionSchema } from "interfaces-mef-types/zod/core/uncertainty";
import type { UncertaintyOperation, UncertaintyRequest, UncertaintyResponse } from "interfaces-shared-types/newly-developed-methods/shared";
import { field, type Json, type JsonRecord } from "./uncertainty-migration-json";

type LognormalFit = Extract<UncertaintyOperation, { kind: "LOGNORMAL_FIT" }>;

type ScaleOperation = Extract<UncertaintyOperation, { kind: "SCALE" }>;

type LawOperation = LognormalFit | ScaleOperation;

interface QuantileQuestion {
  value: UncertainValue;
  probability: number;
}

type Answer<T> = { status: "READY"; value: T } | { status: "PENDING" } | { status: "FAILED"; error: string };

interface PraxisQuestions {
  laws: [string, LawOperation][];
  quantiles: [string, QuantileQuestion][];
}

const LEGACY_LEVEL = 0.95;

const UPPER_PERCENTILE = 0.95;

const STANDARD_NORMAL: UncertainValue = { unit: "QUANTITY", law: { family: "NORMAL", mean: 0, standardDeviation: 1 } };

const FREQUENCY_UNITS: readonly FrequencyUnit[] = Object.values(FrequencyUnit);

class PraxisAnswers {
  private readonly laws = new Map<string, Answer<Law>>();
  private readonly quantiles = new Map<string, Answer<number>>();
  private readonly lawQuestions = new Map<string, LawOperation>();
  private readonly quantileQuestions = new Map<string, QuantileQuestion>();

  law(operation: LawOperation): Answer<Law> {
    const key = canonicalJson(operation);
    const known = this.laws.get(key);
    if (known !== undefined) return known;
    this.lawQuestions.set(key, operation);
    return { status: "PENDING" };
  }

  quantile(question: QuantileQuestion): Answer<number> {
    const key = canonicalJson(question);
    const known = this.quantiles.get(key);
    if (known !== undefined) return known;
    this.quantileQuestions.set(key, question);
    return { status: "PENDING" };
  }

  questions(): PraxisQuestions {
    return { laws: [...this.lawQuestions], quantiles: [...this.quantileQuestions] };
  }

  answerLaw(key: string, answer: Answer<Law>): void {
    this.laws.set(key, answer);
    this.lawQuestions.delete(key);
  }

  answerQuantile(key: string, answer: Answer<number>): void {
    this.quantiles.set(key, answer);
    this.quantileQuestions.delete(key);
  }

  answered(): number {
    return this.laws.size + this.quantiles.size;
  }
}

class ConversionScope {
  readonly issues: string[] = [];

  constructor(
    readonly answers: PraxisAnswers,
    readonly label: string,
  ) {}

  report(message: string): void {
    this.issues.push(`${this.label}: ${message}`);
  }

  law(operation: LawOperation, what: string): Law | undefined {
    const answer = this.answers.law(operation);
    if (answer.status === "READY") return answer.value;
    if (answer.status === "FAILED") this.report(`PRAXIS could not form ${what}. ${answer.error}`);
    return undefined;
  }

  upperStandardQuantile(what: string): number | undefined {
    const answer = this.answers.quantile({ value: STANDARD_NORMAL, probability: UPPER_PERCENTILE });
    if (answer.status === "READY") return answer.value;
    if (answer.status === "FAILED") this.report(`PRAXIS could not give the standard normal percentile for ${what}. ${answer.error}`);
    return undefined;
  }
}

function questionRequest(questions: PraxisQuestions): UncertaintyRequest {
  return {
    parameters: [],
    laws: questions.quantiles.map(([, question], index) => ({ id: `quantile-${index}`, value: question.value, probabilities: [question.probability], curveProbabilities: [] })),
    expressions: [],
    operations: questions.laws.map(([, operation], index) => ({ id: `law-${index}`, operation })),
  };
}

function recordAnswers(questions: PraxisQuestions, response: UncertaintyResponse, answers: PraxisAnswers): void {
  for (const result of response.operations) {
    const key = questions.laws[Number(result.id.slice("law-".length))]?.[0];
    if (key === undefined) continue;
    if ("error" in result) answers.answerLaw(key, { status: "FAILED", error: result.error });
    else if ("law" in result) answers.answerLaw(key, { status: "READY", value: result.law });
    else answers.answerLaw(key, { status: "FAILED", error: "PRAXIS returned no law." });
  }
  for (const summary of response.laws) {
    const entry = questions.quantiles[Number(summary.id.slice("quantile-".length))];
    if (entry === undefined) continue;
    const [key, question] = entry;
    if ("error" in summary) {
      answers.answerQuantile(key, { status: "FAILED", error: summary.error });
      continue;
    }
    const value = summary.quantiles.find((quantile) => quantile.probability === question.probability)?.value;
    answers.answerQuantile(key, value === undefined ? { status: "FAILED", error: "PRAXIS returned no percentile." } : { status: "READY", value });
  }
}

function openQuestions(answers: PraxisAnswers): number {
  const questions = answers.questions();
  return questions.laws.length + questions.quantiles.length;
}

function lognormalFit(mean: number | null, median: number | null, quantiles: LognormalFit["quantiles"]): LognormalFit {
  return { kind: "LOGNORMAL_FIT", mean, median, quantiles };
}

function valueExpression(unit: UncertainUnit, law: Law): UncertainExpression {
  return { node: "VALUE", value: { unit, law: lawWithinUnit(unit, law) } };
}

function pointExpression(unit: UncertainUnit, value: number): UncertainExpression {
  return { node: "VALUE", value: { unit, law: { family: "POINT", value } } };
}

function parameterExpression(workbookId: string, entityId: string): UncertainExpression {
  return { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId, entityId } };
}

function storedExpression(record: JsonRecord, key: string): UncertainExpression | undefined {
  const parsed = UncertainExpressionSchema.safeParse(field(record, key));
  return parsed.success ? parsed.data : undefined;
}

function storedLaw(value: Json | undefined): Law | undefined {
  const parsed = LawSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function lognormalFromMedian(median: number, errorFactor: number, scope: ConversionScope, what: string): Law | undefined {
  if (!(median > 0) || !(errorFactor >= 1)) {
    scope.report(`${what} is a lognormal with median ${median} and error factor ${errorFactor}, which is not a law.`);
    return undefined;
  }
  if (errorFactor === 1) return { family: "POINT", value: median };
  return scope.law(lognormalFit(null, median, [{ probability: UPPER_PERCENTILE, value: median * errorFactor }]), `the lognormal law of ${what}`);
}

function lognormalFromMean(mean: number, errorFactor: number, scope: ConversionScope, what: string): Law | undefined {
  if (!(mean > 0) || !(errorFactor >= 1)) {
    scope.report(`${what} is a lognormal with mean ${mean} and error factor ${errorFactor}, which is not a law.`);
    return undefined;
  }
  return errorFactor === 1 ? { family: "POINT", value: mean } : { family: "LOGNORMAL", mean, errorFactor, level: LEGACY_LEVEL };
}

function boundedLaw(lower: number, upper: number, scope: ConversionScope, what: string): Law | undefined {
  if (lower === upper) return { family: "POINT", value: lower };
  if (lower < upper) return { family: "UNIFORM", lower, upper };
  scope.report(`${what} is a uniform law with its upper bound below its lower bound.`);
  return undefined;
}

function normalLaw(mean: number, standardDeviation: number, scope: ConversionScope, what: string): Law | undefined {
  if (standardDeviation === 0) return { family: "POINT", value: mean };
  if (standardDeviation > 0) return { family: "NORMAL", mean, standardDeviation };
  scope.report(`${what} is a normal law with a negative standard deviation.`);
  return undefined;
}

function positiveLaw(law: Law, values: readonly number[], scope: ConversionScope, what: string): Law | undefined {
  if (values.every((value) => value > 0)) return law;
  scope.report(`${what} is a ${law.family.toLowerCase()} law with parameters that are not above zero.`);
  return undefined;
}

function distributionLaw(distribution: ParameterDistribution, mean: number | undefined, scope: ConversionScope, what: string): Law | undefined {
  switch (distribution.type) {
    case DistributionType.LOGNORMAL:
      return mean === undefined
        ? lognormalFromMedian(distribution.median, distribution.errorFactor, scope, what)
        : lognormalFromMean(mean, distribution.errorFactor, scope, what);
    case DistributionType.BETA:
      return positiveLaw({ family: "BETA", alpha: distribution.alpha, beta: distribution.betaParam, lower: 0, upper: 1 }, [distribution.alpha, distribution.betaParam], scope, what);
    case DistributionType.GAMMA:
      return positiveLaw({ family: "GAMMA", shape: distribution.shape, rate: distribution.rate }, [distribution.shape, distribution.rate], scope, what);
    case DistributionType.EXPONENTIAL:
      return positiveLaw({ family: "GAMMA", shape: 1, rate: distribution.failureRate }, [distribution.failureRate], scope, what);
    case DistributionType.NORMAL:
      return normalLaw(distribution.mean, distribution.stdDev, scope, what);
    case DistributionType.UNIFORM:
      return boundedLaw(distribution.lower, distribution.upper, scope, what);
    case DistributionType.WEIBULL:
      return positiveLaw({ family: "WEIBULL", scale: distribution.scale, shape: distribution.shape, location: distribution.location }, [distribution.scale, distribution.shape], scope, what);
    case DistributionType.POINT_ESTIMATE:
      return { family: "POINT", value: distribution.value };
    case DistributionType.LOGNORMAL_TIME:
    case DistributionType.BINOMIAL:
    case DistributionType.POISSON:
      scope.report(`${what} is a ${distribution.type} distribution, which has no exact law in the contract.`);
      return undefined;
  }
}

function storedDistributionLaw(value: Json | undefined, mean: number | undefined, scope: ConversionScope, what: string): Law | undefined {
  const parsed = ParameterDistributionSchema.safeParse(value);
  if (!parsed.success) {
    scope.report(`${what} holds a distribution that does not parse.`);
    return undefined;
  }
  return distributionLaw(parsed.data, mean, scope, what);
}

function figuresLaw(mean: number | undefined, median: number | undefined, errorFactor: number | undefined, scope: ConversionScope, what: string): Law | undefined {
  if (mean !== undefined) {
    if (mean < 0) {
      scope.report(`${what} has a negative mean.`);
      return undefined;
    }
    if (errorFactor === undefined || mean === 0) return { family: "POINT", value: mean };
    return lognormalFromMean(mean, errorFactor, scope, what);
  }
  if (median !== undefined && errorFactor !== undefined) return lognormalFromMedian(median, errorFactor, scope, what);
  if (median !== undefined) scope.report(`${what} holds a median without a mean or an error factor.`);
  else if (errorFactor !== undefined) scope.report(`${what} holds an error factor without a mean or a median.`);
  return undefined;
}

function frequencyBasis(value: Json | undefined, scope: ConversionScope, what: string): FrequencyUnit | undefined {
  if (value === undefined || value === null) return FrequencyUnit.PER_PLANT_YEAR;
  const basis = FREQUENCY_UNITS.find((unit) => unit === value);
  if (basis === undefined) scope.report(`${what} is given ${String(value)}, which is not a frequency basis.`);
  return basis;
}

function uncertainFrequency(expression: UncertainExpression, basis: FrequencyUnit): UncertainFrequency {
  return { expression, basis };
}

export {
  ConversionScope,
  LEGACY_LEVEL,
  PraxisAnswers,
  UPPER_PERCENTILE,
  boundedLaw,
  figuresLaw,
  frequencyBasis,
  lognormalFit,
  lognormalFromMean,
  lognormalFromMedian,
  normalLaw,
  openQuestions,
  parameterExpression,
  pointExpression,
  positiveLaw,
  questionRequest,
  recordAnswers,
  storedDistributionLaw,
  storedExpression,
  storedLaw,
  uncertainFrequency,
  valueExpression,
};
export type { Answer, LawOperation, LognormalFit, PraxisQuestions, QuantileQuestion, ScaleOperation };
