import type {
  DataAnalysis,
  DataAnalysisParameter,
  DaElicitation,
  DaEstimateQuantity,
  DaEvidenceKind,
  DaQuantificationModel,
  DaSourceEntry,
  DaSourceUse,
} from "interfaces-mef-types/da/data-analysis";
import { entryHoldsLaw, holdsEstimate } from "interfaces-mef-types/da/data-analysis";
import { canonicalJson, parameterReferenceKey, lawBounds, lawWithinUnit, unitBounds, type Law, type MixtureComponent, type UncertainExpression, type UncertainParameter, type UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import { legacyLaw } from "interfaces-mef-types/core/legacy-uncertainty-adapter";
import type {
  UncertaintyExpressionSummary,
  UncertaintyLawSummary,
  UncertaintyOperation,
  UncertaintySampling,
} from "interfaces-shared-types/newly-developed-methods/shared";
import {
  parametersFor,
  peekExpression,
  peekLaw,
  peekOperation,
  requestExpression,
  requestLaw,
  requestOperation,
  type ExpressionQuery,
  type LawQuery,
  type UncertaintyAnswer,
  type UncertaintyState,
} from "../newly-developed-methods/shared/useUncertainty";
import { entryFit, priorUse } from "./daSourcing";
import { scMissionTimeEntries } from "../sc-workbooks/scMissionTimeLinks";
import { type ScMissionTimeSource } from "../sy-workbooks/syLinks";

type DaLawState = { status: "pending" } | { status: "ready"; law: Law } | { status: "failed"; error: string } | { status: "missing"; problem: string };

type DaFactorPick = "nominal" | "low" | "high";

interface DaSpread {
  mean: number;
  standardDeviation?: number;
  p05?: number;
  median?: number;
  p95?: number;
  sampled: boolean;
}

const ESTIMATE_UNITS: Partial<Record<DaQuantificationModel, UncertainUnit>> = {
  DEMAND_PROBABILITY: "PROBABILITY",
  OTHER_PROBABILITY: "PROBABILITY",
  MISSION_PROBABILITY: "PROBABILITY",
  RUNNING_RATE: "PER_HOUR",
  STANDBY_RATE: "PER_HOUR",
  UNAVAILABILITY: "FRACTION",
  FREQUENCY: "PER_YEAR",
};

const SPREAD_SAMPLING: UncertaintySampling = { method: "LATIN_HYPERCUBE", trials: 10000, seed: 1 };

interface DaUseLaw {
  law: Law;
  quantity: DaEstimateQuantity;
  sourceKind: DaEvidenceKind;
  label: string;
  factor: number;
  cut: boolean;
}

type DaUseState = { status: "pending" } | { status: "ready"; value: DaUseLaw } | { status: "failed"; error: string } | { status: "missing"; problem: string };

const UNIT_OF_QUANTITY: Record<DaEstimateQuantity, UncertainUnit> = {
  PER_DEMAND: "PROBABILITY",
  PROBABILITY: "PROBABILITY",
  FRACTION: "FRACTION",
  PER_HOUR: "PER_HOUR",
  PER_YEAR: "PER_YEAR",
  HOURS: "HOURS",
  FACTOR: "FACTOR",
};

interface DaMissionTimes {
  sources: readonly ScMissionTimeSource[];
  families: ReadonlyMap<string, readonly string[]>;
}

const NO_MISSION_TIMES: DaMissionTimes = { sources: [], families: new Map() };

let missionTimes: DaMissionTimes = NO_MISSION_TIMES;

let parameterTable: ReadonlyMap<string, UncertainParameter> = new Map();

let parameterTableKey = canonicalJson([[], []]);

let parameterTableVersion = 0;

function missionTimeTable(sources: readonly ScMissionTimeSource[]): Map<string, UncertainParameter> {
  return new Map(sources.flatMap((source) => scMissionTimeEntries(source.workbookId, source.sc).map((entry) => [parameterReferenceKey(entry.reference), { reference: entry.reference, expression: entry.expression }] as const)));
}

function setDaMissionTimes(next: DaMissionTimes): void {
  const key = canonicalJson([next.sources.map((source) => [source.workbookId, source.sc.missionTimes, source.sc.componentMissionTimes ?? []]), [...next.families.entries()].sort(([left], [right]) => left.localeCompare(right))]);
  if (key === parameterTableKey) return;
  missionTimes = next;
  parameterTable = missionTimeTable(next.sources);
  parameterTableKey = key;
  parameterTableVersion += 1;
}

function daMissionTimes(): DaMissionTimes {
  return missionTimes;
}

function daParameterTable(): ReadonlyMap<string, UncertainParameter> {
  return parameterTable;
}

function daParameterTableVersion(): number {
  return parameterTableVersion;
}

function quantityUnit(quantity: DaEstimateQuantity): UncertainUnit {
  return UNIT_OF_QUANTITY[quantity];
}

const SUMMARY_PROBABILITIES: readonly number[] = [0.05, 0.5, 0.95];

const CURVE_PROBABILITIES: readonly number[] = Array.from({ length: 199 }, (_, index) => (index + 1) / 200);

function lawParameter(parameter: DataAnalysisParameter): boolean {
  return holdsEstimate(parameter.quantificationModel);
}

function withinUnit(unit: UncertainUnit, law: Law): { law: Law; cut: boolean } {
  const domain = unitBounds(unit);
  const bounds = lawBounds(law);
  const kept = lawWithinUnit(unit, law);
  return { law: kept, cut: bounds.upper > domain.upper && kept !== law };
}

function lawQuery(unit: UncertainUnit, law: Law, curve: boolean): LawQuery {
  return { value: { unit, law }, probabilities: SUMMARY_PROBABILITIES, curveProbabilities: curve ? CURVE_PROBABILITIES : [] };
}

function lawSummary(unit: UncertainUnit, law: Law, curve = false): UncertaintyState<UncertaintyLawSummary> {
  const query = lawQuery(unit, law, curve);
  const state = peekLaw(query);
  if (state.status === "pending") requestLaw(query);
  return state;
}

function expressionQuery(expression: UncertainExpression, unit: UncertainUnit): ExpressionQuery {
  return { expression, unit, probabilities: [], parameters: parametersFor([expression], parameterTable) };
}

function expressionPoint(expression: UncertainExpression, unit: UncertainUnit): UncertaintyState<UncertaintyExpressionSummary> {
  const query = expressionQuery(expression, unit);
  const state = peekExpression(query);
  if (state.status === "pending") requestExpression(query);
  return state;
}

function operationAnswer(operation: UncertaintyOperation): UncertaintyState<UncertaintyAnswer> {
  const state = peekOperation(operation);
  if (state.status === "pending") requestOperation(operation);
  return state;
}

function quantileOf(summary: { quantiles: readonly { probability: number; value: number }[] }, probability: number): number | undefined {
  return summary.quantiles.find((entry) => entry.probability === probability)?.value;
}

function expressionSpread(expression: UncertainExpression, unit: UncertainUnit): UncertaintyState<DaSpread> {
  if (expression.node === "VALUE") {
    const state = lawSummary(expression.value.unit, expression.value.law);
    if (state.status !== "ready") return state;
    return { status: "ready", value: { mean: state.value.mean, standardDeviation: state.value.standardDeviation ?? undefined, p05: quantileOf(state.value, 0.05), median: quantileOf(state.value, 0.5), p95: quantileOf(state.value, 0.95), sampled: false } };
  }
  const query: ExpressionQuery = { expression, unit, probabilities: SUMMARY_PROBABILITIES, parameters: parametersFor([expression], parameterTable), sampling: SPREAD_SAMPLING };
  const state = peekExpression(query);
  if (state.status === "pending") {
    requestExpression(query);
    return state;
  }
  if (state.status === "failed") return state;
  const sampled = state.value.sampled;
  if (sampled === null) return { status: "failed", error: "PRAXIS gave no samples." };
  return { status: "ready", value: { mean: sampled.mean, standardDeviation: sampled.standardDeviation, p05: quantileOf(sampled, 0.05), median: quantileOf(sampled, 0.5), p95: quantileOf(sampled, 0.95), sampled: true } };
}

function componentUnit(parameter: DataAnalysisParameter): UncertainUnit | undefined {
  return parameter.quantificationModel === undefined ? undefined : ESTIMATE_UNITS[parameter.quantificationModel];
}

function pointState(expression: UncertainExpression, unit: UncertainUnit): UncertaintyState<number> {
  const state = expressionPoint(expression, unit);
  return state.status === "ready" ? { status: "ready", value: state.value.point } : state;
}

function parameterPoint(parameter: DataAnalysisParameter): UncertaintyState<number> | undefined {
  if (!lawParameter(parameter)) return parameter.value === undefined ? undefined : { status: "ready", value: parameter.value };
  const unit = componentUnit(parameter);
  return parameter.estimate === undefined || unit === undefined ? undefined : pointState(parameter.estimate, unit);
}

function parameterSpread(parameter: DataAnalysisParameter): UncertaintyState<DaSpread> | undefined {
  const unit = componentUnit(parameter);
  return !lawParameter(parameter) || parameter.estimate === undefined || unit === undefined ? undefined : expressionSpread(parameter.estimate, unit);
}

function readyNumber(state: UncertaintyState<number> | undefined): number | undefined {
  return state?.status === "ready" ? state.value : undefined;
}

function operationLaw(operation: UncertaintyOperation): DaLawState {
  const state = peekOperation(operation);
  if (state.status === "pending") {
    requestOperation(operation);
    return { status: "pending" };
  }
  if (state.status === "failed") return { status: "failed", error: state.error };
  return "law" in state.value ? { status: "ready", law: state.value.law } : { status: "failed", error: "PRAXIS gave no law for this step." };
}

function entryLaw(entry: DaSourceEntry): Law | undefined {
  if (entryHoldsLaw(entry.quantity)) return entry.law;
  const fit = entryFit(entry);
  return fit === undefined ? undefined : legacyLaw(fit.distribution);
}

function judgmentOperations(elicitation: DaElicitation): { weight: number; operation: UncertaintyOperation }[] {
  const evaluators = elicitation.experts.filter((expert) => expert.role === "EVALUATOR");
  const stated = evaluators.some((expert) => expert.weight !== undefined);
  return evaluators.flatMap((expert) => {
    const { p05, median, p95 } = expert;
    if (p05 === undefined || median === undefined || p95 === undefined || !(p05 > 0 && median > p05 && p95 > median)) return [];
    const weight = stated ? expert.weight ?? 0 : 1;
    if (!(weight > 0)) return [];
    return [{ weight, operation: { kind: "LOGNORMAL_FIT" as const, mean: null, median, quantiles: [{ probability: 0.05, value: p05 }, { probability: 0.95, value: p95 }] } }];
  });
}

function elicitationLaw(elicitation: DaElicitation): DaLawState {
  const parts = judgmentOperations(elicitation);
  if (parts.length === 0) return { status: "missing", problem: "No evaluator gives a 5th, 50th and 95th percentile in rising order." };
  const components: MixtureComponent[] = [];
  for (const part of parts) {
    const state = operationLaw(part.operation);
    if (state.status !== "ready") return state;
    const law = state.law;
    if (law.family === "MIXTURE" || law.family === "POSTERIOR" || law.family === "POPULATION") return { status: "failed", error: "PRAXIS gave a judgment that cannot be pooled." };
    components.push({ weight: part.weight, law });
  }
  return operationLaw({ kind: "POOL", pooling: elicitation.pooling, components });
}

function factorOf(use: DaSourceUse, quantity: DaEstimateQuantity, pick: DaFactorPick): { factor: number; quantity: DaEstimateQuantity } {
  let factor = 1;
  let current = quantity;
  if (use.hoursPerYear !== undefined && use.hoursPerYear > 0 && current === "PER_YEAR") {
    factor /= use.hoursPerYear;
    current = "PER_HOUR";
  }
  if (use.standbyHours !== undefined && current === "PER_HOUR") {
    factor *= use.standbyHours;
    current = "PER_DEMAND";
  }
  if (use.verdict === "SCALED") {
    for (const item of use.factors ?? []) factor *= pick === "low" ? item.low : pick === "high" ? item.high : item.nominal;
  }
  return { factor, quantity: current };
}

function sourceUseLaw(da: DataAnalysis, use: DaSourceUse, pick: DaFactorPick = "nominal"): DaUseState {
  let base: { law: Law; quantity: DaEstimateQuantity; sourceKind: DaEvidenceKind; label: string };
  if (use.elicitationId !== undefined) {
    const elicitation = (da.elicitations ?? []).find((candidate) => candidate.id === use.elicitationId);
    if (elicitation === undefined) return { status: "missing", problem: "The elicitation no longer exists." };
    const state = elicitationLaw(elicitation);
    if (state.status !== "ready") return state;
    base = { law: state.law, quantity: elicitation.quantity, sourceKind: "EXPERT_JUDGMENT", label: elicitation.id };
  } else {
    const source = (da.sources ?? []).find((candidate) => candidate.id === use.sourceId);
    const entry = source?.entries.find((candidate) => candidate.id === use.entryId);
    if (source === undefined || entry === undefined) return { status: "missing", problem: "The source or estimate no longer exists." };
    const law = entryLaw(entry);
    if (law === undefined) return { status: "missing", problem: "The estimate gives no law." };
    base = { law, quantity: entry.quantity, sourceKind: source.kind, label: `${source.name} · ${entry.id}` };
  }
  const scaled = factorOf(use, base.quantity, pick);
  const unit = quantityUnit(scaled.quantity);
  if (scaled.factor === 1) return { status: "ready", value: { ...base, law: lawWithinUnit(unit, base.law), quantity: scaled.quantity, factor: 1, cut: false } };
  if (!(scaled.factor > 0 && Number.isFinite(scaled.factor))) return { status: "missing", problem: "The factors must be positive." };
  const state = operationLaw({ kind: "SCALE", law: base.law, factor: scaled.factor });
  if (state.status !== "ready") return state;
  const kept = withinUnit(unit, state.law);
  const before = withinUnit(quantityUnit(base.quantity), base.law);
  return { status: "ready", value: { ...base, law: kept.law, quantity: scaled.quantity, factor: scaled.factor, cut: kept.cut && !before.cut } };
}

function parameterPriorLaw(da: DataAnalysis, parameter: DataAnalysisParameter): DaUseState {
  const use = priorUse(parameter);
  if (use === undefined) return { status: "missing", problem: "No prior. Choose the source the estimate starts from in Step 04 Applicability." };
  return sourceUseLaw(da, use);
}

function constrainedLaw(law: Law, likelihood: "BINOMIAL" | "POISSON"): DaLawState {
  return operationLaw({ kind: "CONSTRAINED_NONINFORMATIVE", law, likelihood });
}

export {
  CURVE_PROBABILITIES,
  SUMMARY_PROBABILITIES,
  componentUnit,
  constrainedLaw,
  daMissionTimes,
  daParameterTable,
  daParameterTableVersion,
  elicitationLaw,
  expressionSpread,
  lawParameter,
  entryLaw,
  expressionPoint,
  expressionQuery,
  lawQuery,
  lawSummary,
  operationAnswer,
  operationLaw,
  parameterPoint,
  parameterSpread,
  pointState,
  quantileOf,
  parameterPriorLaw,
  readyNumber,
  quantityUnit,
  setDaMissionTimes,
  sourceUseLaw,
  type DaFactorPick,
  type DaMissionTimes,
  type DaSpread,
  type DaLawState,
  type DaUseLaw,
  type DaUseState,
};
