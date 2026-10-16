import type {
  CcfParameterEstimation,
  DataAnalysis,
  DaCcfEvidence,
  DaCcfFactor,
  DaCcfImportKind,
  DaCcfImportRecord,
  DaCcfMethod,
  DaCcfVector,
  DaDataNeeds,
  DaCcfTesting,
  DaSource,
} from "interfaces-mef-types/da/data-analysis";
import {
  canonicalJson,
  ccfFactorExpressions,
  ccfModelTakesTotal,
  expressionReferences,
  lawBounds,
  lawWithinUnit,
  modelArguments,
  parameterReferenceKey,
  unitBounds,
  vectorLength,
  vectorMean,
  type BaseLaw,
  type CcfFactorModel,
  type Law,
  type ParameterExpression,
  type UncertainExpression,
  type UncertainParameter,
  type UncertainUnit,
  type UncertainValue,
  type UncertainVector,
  type VectorLaw,
  type WeightedDirichletLaw,
} from "interfaces-mef-types/core/uncertainty";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import type { UncertaintyLawSummary, UncertaintyOperation } from "interfaces-shared-types/newly-developed-methods/shared";
import { uncertaintyVersion, type UncertaintyState } from "../newly-developed-methods/shared/useUncertainty";
import { expressionText, numberText } from "../newly-developed-methods/shared/uncertainText";
import { componentUnit, expressionSpread, lawParameter, lawSummary, operationAnswer, parameterPoint, pointState, type DaSpread } from "./daLaws";
import { KIND_MODEL, convertsBeta, readSet, type DaCcfModel, type DaCcfRowSet } from "./daCcfRows";
import type { DaFindingSeverity, DaNeedFinding } from "./daSelectors";

const RANK: Record<DaFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const MGL_LETTERS: readonly string[] = ["β", "γ", "δ", "ε", "μ", "ω", "σ"];

const SUM_TOLERANCE = 1e-6;

const MODEL_TEXT: Record<DaCcfModel, string> = {
  BETA_FACTOR: "beta factor",
  MGL: "multiple Greek letter",
  ALPHA_FACTOR: "alpha factor",
  PHI_FACTOR: "phi factor",
  BINOMIAL_FAILURE_RATE: "binomial failure rate",
};

const MODEL_LABELS: Record<DaCcfModel, string> = {
  BETA_FACTOR: "Beta factor",
  MGL: "Multiple Greek letter",
  ALPHA_FACTOR: "Alpha factor",
  PHI_FACTOR: "Phi factor",
  BINOMIAL_FAILURE_RATE: "Binomial failure rate",
};

const KIND_LABELS: Record<DaCcfImportKind, string> = {
  ALPHA_DIRICHLET: "Alpha factor distributions",
  ALPHA_MLE: "Alpha factor MLEs",
  ALPHA_SUMMARY: "Alpha factor summary means",
  ALPHA_POINTS: "Alpha factor values",
  MGL: "MGL factors",
  BETA: "Beta factor",
};

const BFR_PARTS: readonly { label: string; unit: UncertainUnit }[] = [
  { label: "Independent", unit: "PROBABILITY" },
  { label: "Non-lethal shock", unit: "PROBABILITY" },
  { label: "Failure per shock", unit: "FRACTION" },
  { label: "Lethal shock", unit: "PROBABILITY" },
];

const BFR_KEYS: readonly string[] = ["INDEPENDENT", "NON-LETHAL", "PER-SHOCK", "LETHAL"];

const TESTING_TEXT: Record<DaCcfTesting, string> = {
  STAGGERED: "staggered",
  NON_STAGGERED: "non-staggered",
};

interface DaCcfTemplate {
  sourceId: string;
  code: string;
  kind: DaCcfImportKind;
  component: string;
  failureMode: string;
  table: string;
}

interface DaCcfLevel {
  k: number;
  label: string;
  unit: UncertainUnit;
  law?: Law;
  priorLaw?: Law;
  expression?: UncertainExpression;
  mean?: number;
  p05?: number;
  p95?: number;
  prior?: number;
  published?: number;
}

interface DaCcfCombination {
  k: number;
  count: number;
  coefficient?: number;
  each?: number;
}

interface DaCcfMapping {
  evidenceId: string;
  from: number;
  to: number;
  rho?: number;
  lethal?: number;
  vector: number[];
  mapped?: number[];
  noImpact?: number;
}

interface DaCcfResult {
  size?: number;
  testing: DaCcfTesting;
  method?: DaCcfMethod;
  model?: DaCcfModel;
  qt?: number;
  qtFrom?: "PARAMETER" | "SY";
  template?: DaCcfTemplate;
  imported?: DaCcfImportRecord;
  vector?: DaCcfVector;
  factor?: DaCcfFactor;
  prior?: number[];
  counts?: number[];
  posterior?: number[];
  mappings: DaCcfMapping[];
  factors?: CcfFactorModel;
  factorEntries?: DaCcfFactor[];
  linkFactors?: (link: (entityId: string) => UncertainExpression) => CcfFactorModel;
  levels: DaCcfLevel[];
  combinations: DaCcfCombination[];
  pending: boolean;
  problem?: string;
}

interface DaCcfCheck {
  findings: DaNeedFinding[];
  pending: boolean;
}

const resultCache = new WeakMap<DataAnalysis, { version: number; values: Map<string, DaCcfResult> }>();

const checkCache = new WeakMap<DataAnalysis, { version: number; check: DaCcfCheck }>();

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i += 1) result = (result * (n - k + i)) / i;
  return result;
}

function preciseText(value: number): string {
  return String(Number(value.toPrecision(6)));
}

function ordersText(from: number, to: number): string {
  if (from === to) return `order ${from}`;
  return from + 1 === to ? `orders ${from} and ${to}` : `orders ${from} to ${to}`;
}

function testingOf(estimate: CcfParameterEstimation): DaCcfTesting {
  return estimate.testing ?? "NON_STAGGERED";
}

function kindOf(estimate: CcfParameterEstimation): DaCcfImportKind {
  return estimate.priorKind ?? "ALPHA_DIRICHLET";
}

function modelOfEstimate(estimate: CcfParameterEstimation): DaCcfModel | undefined {
  if (estimate.method === "TYPED") return estimate.factors?.model;
  if (estimate.method === "BAYES") return estimate.model ?? KIND_MODEL[kindOf(estimate)];
  if (estimate.method === "PRIOR") return KIND_MODEL[kindOf(estimate)];
  return estimate.factors?.model;
}

function vectorIdOf(sourceId: string, kind: DaCcfImportKind, template: string, size: number): string {
  return `ccfv/${sourceId}/${template}/${kind}/C${size}`;
}

function factorIdOf(sourceId: string, rowId: string): string {
  return `ccff/${sourceId}/${rowId}`;
}

function sourceOf(da: DataAnalysis, id: string | undefined): DaSource | undefined {
  return id === undefined ? undefined : (da.sources ?? []).find((candidate) => candidate.id === id);
}

function memberParameterIds(needs: DaDataNeeds, memberIds: readonly string[]): string[] {
  const events = new Map(needs.basicEvents.flatMap((need) => [[need.id, need] as const, [need.code, need] as const]));
  return [...new Set(memberIds.flatMap((id) => {
    const need = events.get(id);
    const parameterId = need?.parameterId ?? (need?.valueHeldBy === "DA" ? need.valueHolderId : undefined);
    return parameterId === undefined ? [] : [parameterId];
  }))];
}

function shareFromNeeds(da: DataAnalysis, estimate: CcfParameterEstimation): { members: string[]; parameterIds: string[]; total?: UncertainExpression; factors?: CcfFactorModel } | undefined {
  const needs = da.dataNeeds;
  const group = needs?.ccfGroups.find((candidate) => candidate.id === estimate.ccfGroupReference);
  if (needs === undefined || group === undefined) return undefined;
  return { members: group.memberIds, parameterIds: memberParameterIds(needs, group.memberIds), total: group.total, factors: group.factors };
}

function probabilityParameter(da: DataAnalysis, id: string | undefined): UncertaintyState<number> | undefined {
  const found = id === undefined ? undefined : da.parameters.find((candidate) => candidate.uuid === id);
  if (found === undefined) return undefined;
  const unit = componentUnit(found);
  const probability = lawParameter(found) ? unit === "PROBABILITY" || unit === "FRACTION" : found.parameterType !== "FAILURE_RATE" && found.parameterType !== "FREQUENCY";
  return probability ? parameterPoint(found) : undefined;
}

function totalPoint(da: DataAnalysis, total: UncertainExpression): UncertaintyState<number> | undefined {
  if (total.node === "PARAMETER") return probabilityParameter(da, total.reference.entityId.trim());
  return expressionReferences(total).length > 0 ? undefined : pointState(total, "PROBABILITY");
}

function qtOf(da: DataAnalysis, estimate: CcfParameterEstimation): { qt?: number; from?: "PARAMETER" | "SY"; pending: boolean } {
  const share = shareFromNeeds(da, estimate);
  const own = probabilityParameter(da, estimate.memberParameterId ?? share?.parameterIds[0]);
  if (own?.status === "pending") return { pending: true };
  if (own?.status === "ready" && own.value >= 0 && own.value <= 1) return { qt: own.value, from: "PARAMETER", pending: false };
  const total = share?.total === undefined ? undefined : totalPoint(da, share.total);
  if (total?.status === "pending") return { pending: true };
  return total?.status === "ready" ? { qt: total.value, from: "SY", pending: false } : { pending: false };
}

function dirichletFactors(concentrations: readonly number[], testing: DaCcfTesting): CcfFactorModel {
  return { model: "ALPHA_FACTOR", testing, alphas: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [...concentrations] } } };
}

function marginalLaw(concentrations: readonly number[], index: number): Law {
  const own = concentrations[index] ?? 0;
  const rest = sum(concentrations) - own;
  if (!(own > 0)) return { family: "POINT", value: 0 };
  if (!(rest > 0)) return { family: "POINT", value: 1 };
  return { family: "BETA", alpha: own, beta: rest, lower: 0, upper: 1 };
}

function resolvedVector(da: DataAnalysis, vector: UncertainVector): VectorLaw | string {
  if (vector.node === "VALUE") return vector.law;
  const found = (da.ccfVectors ?? []).find((candidate) => candidate.id === vector.reference.entityId.trim());
  return found === undefined ? `The linked vector ${vector.reference.entityId} is not published by this workbook.` : found.vector;
}

function vectorLaws(law: VectorLaw): Law[] {
  if (law.family === "FIXED") return law.values.map((value) => ({ family: "POINT", value }));
  return law.concentrations.map((_, index) => marginalLaw(law.concentrations, index));
}

function vectorSize(da: DataAnalysis, vector: UncertainVector): number | string {
  const law = resolvedVector(da, vector);
  return typeof law === "string" ? law : vectorLength(law);
}

function phiWeights(size: number): number[] {
  return Array.from({ length: size }, (_, index) => 1 / choose(size - 1, index));
}

function phiVector(concentrations: readonly number[]): WeightedDirichletLaw {
  return { family: "WEIGHTED_DIRICHLET", concentrations: [...concentrations], weights: phiWeights(concentrations.length) };
}

function shareReference(index: number): WorkbookParameterReference {
  return { referenceType: "WORKBOOK_PARAMETER", workbookId: "weighted-dirichlet", entityId: `G${index + 1}` };
}

function weightedShare(law: WeightedDirichletLaw, index: number): UncertainExpression {
  const part = (at: number): UncertainExpression => ({ node: "OPERATION", operation: "MULTIPLY", operands: [constant(law.weights[at] ?? 1), { node: "PARAMETER", reference: shareReference(at) }] });
  return { node: "OPERATION", operation: "DIVIDE", operands: [part(index), { node: "OPERATION", operation: "ADD", operands: law.concentrations.map((_, at) => part(at)) }] };
}

function weightedLevels(law: WeightedDirichletLaw, letter: string, prior: readonly number[] | undefined, published: readonly number[]): UncertaintyState<DaCcfLevel>[] {
  const table = new Map(law.concentrations.map((shape, index) => [parameterReferenceKey(shareReference(index)), { reference: shareReference(index), expression: gammaValue(shape) }] as const));
  const means = vectorMean(law);
  const before = prior === undefined ? undefined : vectorMean({ ...law, concentrations: [...prior] });
  return law.concentrations.map((_, index): UncertaintyState<DaCcfLevel> => {
    const spread = expressionSpread(weightedShare(law, index), "FRACTION", table);
    if (spread.status !== "ready") return spread;
    const level: DaCcfLevel = { k: index + 1, label: `${letter}${index + 1}`, unit: "FRACTION", mean: means[index], p05: spread.value.p05, p95: spread.value.p95 };
    return { status: "ready", value: { ...level, ...(published[index] === undefined ? {} : { published: published[index] }), ...(before?.[index] === undefined ? {} : { prior: before[index] }) } };
  });
}

function inlineFactors(da: DataAnalysis, factors: CcfFactorModel): CcfFactorModel {
  if (factors.model !== "ALPHA_FACTOR" && factors.model !== "PHI_FACTOR") return factors;
  const vector = factors.model === "ALPHA_FACTOR" ? factors.alphas : factors.phis;
  const law = resolvedVector(da, vector);
  if (typeof law === "string" || vector.node === "VALUE") return factors;
  const inline: UncertainVector = { node: "VALUE", law };
  return factors.model === "ALPHA_FACTOR" ? { ...factors, alphas: inline } : { model: "PHI_FACTOR", phis: inline };
}

function shapeProblem(da: DataAnalysis, factors: CcfFactorModel, size: number): string | undefined {
  switch (factors.model) {
    case "BETA_FACTOR":
    case "BINOMIAL_FAILURE_RATE":
      return undefined;
    case "MGL":
      return factors.factors.length === 0 || factors.factors.length > size - 1 ? `A group of ${size} takes 1 to ${size - 1} MGL factors.` : undefined;
    case "ALPHA_FACTOR": {
      const length = vectorSize(da, factors.alphas);
      if (typeof length === "string") return length;
      return length === size ? undefined : `A group of ${size} takes ${size} alpha factors.`;
    }
    case "PHI_FACTOR": {
      const length = vectorSize(da, factors.phis);
      if (typeof length === "string") return length;
      return length === size ? undefined : `A group of ${size} takes exactly ${size} phi factors, one for each number of failed components.`;
    }
  }
}

function summaryLevel(level: DaCcfLevel, state: UncertaintyState<UncertaintyLawSummary>): UncertaintyState<DaCcfLevel> {
  if (state.status !== "ready") return state;
  const quantile = (probability: number): number | undefined => state.value.quantiles.find((entry) => entry.probability === probability)?.value;
  return { status: "ready", value: { ...level, mean: state.value.mean, p05: quantile(0.05), p95: quantile(0.95) } };
}

function spreadLevel(level: DaCcfLevel, state: UncertaintyState<DaSpread>): UncertaintyState<DaCcfLevel> {
  if (state.status !== "ready") return state;
  return { status: "ready", value: { ...level, mean: state.value.mean, p05: state.value.p05, p95: state.value.p95 } };
}

function withPrior(level: UncertaintyState<DaCcfLevel>, prior: Law | undefined): UncertaintyState<DaCcfLevel> {
  if (level.status !== "ready" || prior === undefined) return level;
  const state = lawSummary("FRACTION", prior, true);
  if (state.status !== "ready") return state;
  return { status: "ready", value: { ...level.value, priorLaw: prior, prior: state.value.mean } };
}

function ownTable(da: DataAnalysis, expression: UncertainExpression): Map<string, UncertainParameter> {
  const held = new Map<string, UncertainExpression>();
  for (const parameter of da.parameters) if (parameter.estimate !== undefined) held.set(parameter.uuid, parameter.estimate);
  for (const factor of da.ccfFactors ?? []) held.set(factor.id, factor.expression);
  const table = new Map<string, UncertainParameter>();
  const pending = expressionReferences(expression);
  for (let reference = pending.pop(); reference !== undefined; reference = pending.pop()) {
    const key = parameterReferenceKey(reference);
    const found = held.get(reference.entityId.trim());
    if (table.has(key) || found === undefined) continue;
    table.set(key, { reference, expression: found });
    pending.push(...expressionReferences(found));
  }
  return table;
}

function expressionLevel(da: DataAnalysis, k: number, label: string, unit: UncertainUnit, expression: UncertainExpression, published?: number): UncertaintyState<DaCcfLevel> {
  return spreadLevel({ k, label, unit, expression, ...(published === undefined ? {} : { published }) }, expressionSpread(expression, unit, ownTable(da, expression)));
}

function bfrExpressions(factors: CcfFactorModel): UncertainExpression[] {
  return factors.model === "BINOMIAL_FAILURE_RATE" ? [factors.independent, factors.nonLethalShock, factors.componentFailure, factors.lethalShock] : [];
}

function levelStates(da: DataAnalysis, factors: CcfFactorModel, prior: readonly number[] | undefined, published: readonly number[]): UncertaintyState<DaCcfLevel>[] | string {
  switch (factors.model) {
    case "BETA_FACTOR":
      return [expressionLevel(da, 1, "β", "FRACTION", factors.beta, published[0])];
    case "MGL":
      return factors.factors.map((factor, index) => expressionLevel(da, index + 1, MGL_LETTERS[index] ?? `ρ${index + 2}`, "FRACTION", factor, published[index]));
    case "BINOMIAL_FAILURE_RATE":
      return bfrExpressions(factors).map((expression, index) => {
        const part = BFR_PARTS[index] ?? { label: `Part ${index + 1}`, unit: "PROBABILITY" as const };
        return expressionLevel(da, index + 1, part.label, part.unit, expression);
      });
    case "ALPHA_FACTOR":
    case "PHI_FACTOR": {
      const vector = factors.model === "ALPHA_FACTOR" ? factors.alphas : factors.phis;
      const letter = factors.model === "ALPHA_FACTOR" ? "α" : "φ";
      const resolved = resolvedVector(da, vector);
      if (typeof resolved === "string") return resolved;
      if (resolved.family === "WEIGHTED_DIRICHLET") return weightedLevels(resolved, letter, prior, published);
      return vectorLaws(resolved).map((law, index) => {
        const base: DaCcfLevel = { k: index + 1, label: `${letter}${index + 1}`, unit: "FRACTION", law, ...(published[index] === undefined ? {} : { published: published[index] }) };
        return withPrior(summaryLevel(base, lawSummary("FRACTION", law, true)), prior === undefined ? undefined : marginalLaw(prior, index));
      });
    }
  }
}

function bfrEach(points: readonly number[], size: number): number[] {
  const [independent = 0, shock = 0, p = 0, lethal = 0] = points;
  return Array.from({ length: size }, (_, index) => {
    const k = index + 1;
    const value = shock * Math.pow(p, k) * Math.pow(1 - p, size - k);
    return value + (k === 1 ? independent : 0) + (k === size ? lethal : 0);
  });
}

function pointCoefficients(factors: CcfFactorModel, points: readonly number[], size: number): number[] | string {
  switch (factors.model) {
    case "BETA_FACTOR": {
      const beta = points[0] ?? 0;
      return Array.from({ length: size }, (_, index) => (index === 0 ? 1 - beta : index === size - 1 ? beta : 0));
    }
    case "MGL": {
      const top = points.length + 1;
      return Array.from({ length: size }, (_, index) => {
        const k = index + 1;
        if (k > top) return 0;
        let product = 1;
        for (let i = 0; i < k - 1; i += 1) product *= points[i] ?? 0;
        const closing = k < top ? 1 - (points[k - 1] ?? 0) : 1;
        return (product * closing) / choose(size - 1, k - 1);
      });
    }
    case "ALPHA_FACTOR": {
      const total = sum(points.map((alpha, index) => (index + 1) * alpha));
      if (factors.testing === "NON_STAGGERED" && !(total > 0)) return "The alpha factors add to zero.";
      return points.map((alpha, index) => (factors.testing === "STAGGERED" ? alpha / choose(size - 1, index) : ((index + 1) * alpha) / (total * choose(size - 1, index))));
    }
    case "PHI_FACTOR":
      return Array.from({ length: size }, (_, index) => points[index] ?? 0);
    case "BINOMIAL_FAILURE_RATE":
      return "The binomial failure rate model gives each combination directly.";
  }
}

function mappingOperation(vector: readonly number[], from: number, to: number, rho: number | undefined, lethal: number): UncertaintyOperation | string {
  if (to < from) return { kind: "CCF_MAP_DOWN", counts: [...vector], targetSize: to };
  if (rho === undefined) return `Type rho to map the counts up from a group of ${from} to a group of ${to}.`;
  const all = vector[from - 1] ?? 0;
  if (!(lethal >= 0) || lethal > all) return `The lethal shocks must lie between 0 and the ${numberText(all)} events that fail all ${from}.`;
  return { kind: "CCF_MAP_UP", independent: 0, nonLethal: vector.map((value, index) => (index === from - 1 ? value - lethal : value)), lethal, rho, targetSize: to };
}

function mappedVector(vector: readonly number[], from: number, to: number, rho: number | undefined, lethal: number): UncertaintyState<{ counts: number[]; noImpact?: number }> | string {
  if (from === to) return { status: "ready", value: { counts: [...vector] } };
  const operation = mappingOperation(vector, from, to, rho, lethal);
  if (typeof operation === "string") return operation;
  const state = operationAnswer(operation);
  if (state.status !== "ready") return state;
  const answer = state.value;
  if (!("counts" in answer)) return { status: "failed", error: "PRAXIS gave no mapped counts." };
  return { status: "ready", value: { counts: answer.counts, ...("noImpact" in answer ? { noImpact: answer.noImpact } : {}) } };
}

function multiplicityCounts(evidence: DaCcfEvidence, from: number): UncertaintyState<number[]> | string {
  const multiplicities = (evidence.multiplicities ?? []).filter((item) => item.events > 0);
  if (multiplicities.length === 0) return { status: "ready", value: Array.from({ length: from }, () => 0) };
  const above = multiplicities.find((item) => item.failed > from);
  if (above !== undefined) return `${numberText(above.events)} events fail ${above.failed} components, more than the ${from} the counts are coded for.`;
  const state = operationAnswer({ kind: "CCF_IMPACT_VECTOR", groupSize: from, multiplicities: multiplicities.map((item) => ({ failed: item.failed, events: item.events })) });
  if (state.status !== "ready") return state;
  const answer = state.value;
  if (!("counts" in answer) || answer.counts.length !== from) return { status: "failed", error: "PRAXIS gave no impact counts." };
  return { status: "ready", value: answer.counts };
}

function evidenceVector(evidence: DaCcfEvidence, from: number): { vector: number[]; problem?: string } {
  const what = blank(evidence.label) ? evidence.id : evidence.label ?? evidence.id;
  const vector = Array.from({ length: from }, () => 0);
  if (evidence.counts !== undefined) {
    if (evidence.counts.length !== from) return { vector, problem: `${what}: the counts need ${from} values, one for each number of failed components.` };
    if (evidence.counts.some((value) => !(value >= 0))) return { vector, problem: `${what}: the counts cannot be negative.` };
    evidence.counts.forEach((value, index) => { vector[index] = (vector[index] ?? 0) + value; });
  }
  for (const event of evidence.events) {
    if (!event.included) continue;
    if (event.impact.length !== from) return { vector, problem: `${what} · ${event.id}: the impact vector needs ${from} values, one for each number of failed components.` };
    if (event.impact.some((value) => !(value >= 0 && value <= 1)) || sum(event.impact) > 1 + 1e-9) return { vector, problem: `${what} · ${event.id}: each impact value lies between 0 and 1, and together they add to at most 1.` };
    event.impact.forEach((value, index) => { vector[index] = (vector[index] ?? 0) + value; });
  }
  return { vector };
}

function evidenceCounts(estimate: CcfParameterEstimation, size: number): { counts: number[]; mappings: DaCcfMapping[]; pending: boolean; problem?: string } {
  const counts = Array.from({ length: size }, () => 0);
  const mappings: DaCcfMapping[] = [];
  let pending = false;
  for (const evidence of estimate.evidence ?? []) {
    if (!evidence.included) continue;
    const what = blank(evidence.label) ? evidence.id : evidence.label ?? evidence.id;
    if (!(evidence.population > 0)) return { counts, mappings, pending, problem: `${what}: enter how many components the population had.` };
    if (!(evidence.independentFailures >= 0)) return { counts, mappings, pending, problem: `${what}: the independent failures cannot be negative.` };
    const from = evidence.impactSize ?? size;
    if (!Number.isInteger(from) || from < 2) return { counts, mappings, pending, problem: `${what}: the impact vectors need a group of two or more components.` };
    counts[0] = (counts[0] ?? 0) + (evidence.independentFailures * size) / evidence.population;
    const built = evidenceVector(evidence, from);
    if (built.problem !== undefined) return { counts, mappings, pending, problem: built.problem };
    const multiple = multiplicityCounts(evidence, from);
    if (typeof multiple === "string") return { counts, mappings, pending, problem: `${what}: ${multiple}` };
    if (multiple.status === "failed") return { counts, mappings, pending, problem: `${what}: ${multiple.error}` };
    if (multiple.status === "pending") {
      pending = true;
      continue;
    }
    multiple.value.forEach((value, index) => { built.vector[index] = (built.vector[index] ?? 0) + value; });
    const mapped = mappedVector(built.vector, from, size, evidence.mappingRho, evidence.lethalShocks ?? 0);
    const mapping: DaCcfMapping = { evidenceId: evidence.id, from, to: size, vector: built.vector, ...(evidence.mappingRho === undefined ? {} : { rho: evidence.mappingRho }), ...(evidence.lethalShocks === undefined ? {} : { lethal: evidence.lethalShocks }) };
    if (typeof mapped === "string") return { counts, mappings: [...mappings, mapping], pending, problem: `${what}: ${mapped}` };
    if (mapped.status === "failed") return { counts, mappings: [...mappings, mapping], pending, problem: `${what}: ${mapped.error}` };
    if (mapped.status === "pending") {
      pending = true;
      mappings.push(mapping);
      continue;
    }
    const values = mapped.value.counts;
    if (values.length !== size) return { counts, mappings, pending, problem: `${what}: PRAXIS mapped the counts to ${values.length} values, not ${size}.` };
    mappings.push({ ...mapping, mapped: values, ...(mapped.value.noImpact === undefined ? {} : { noImpact: mapped.value.noImpact }) });
    values.forEach((value, index) => { counts[index] = (counts[index] ?? 0) + value; });
  }
  return { counts, mappings, pending };
}

function ccfResult(da: DataAnalysis, estimate: CcfParameterEstimation): DaCcfResult {
  const version = uncertaintyVersion();
  let entry = resultCache.get(da);
  if (entry === undefined || entry.version !== version) {
    entry = { version, values: new Map() };
    resultCache.set(da, entry);
  }
  const cached = entry.values.get(estimate.uuid);
  if (cached !== undefined) return cached;
  const result = computeResult(da, estimate);
  entry.values.set(estimate.uuid, result);
  return result;
}

function finish(da: DataAnalysis, base: DaCcfResult, factors: CcfFactorModel, size: number, published: readonly number[] = []): DaCcfResult {
  const shaped = shapeProblem(da, factors, size);
  const withFactors: DaCcfResult = { ...base, model: factors.model, factors };
  if (shaped !== undefined) return { ...withFactors, problem: shaped };
  const states = levelStates(da, factors, base.method === "BAYES" ? base.prior : undefined, published);
  if (typeof states === "string") return { ...withFactors, problem: states };
  const failed = states.find((state) => state.status === "failed");
  if (failed?.status === "failed") return { ...withFactors, problem: `PRAXIS could not compute the factors: ${failed.error}` };
  const levels = states.flatMap((state) => (state.status === "ready" ? [state.value] : []));
  if (levels.length < states.length) return { ...withFactors, pending: true };
  const points = levels.map((level) => level.mean ?? 0);
  if (factors.model === "BINOMIAL_FAILURE_RATE") {
    const each = bfrEach(points, size);
    return { ...withFactors, levels, combinations: each.map((value, index) => ({ k: index + 1, count: choose(size, index + 1), each: value })) };
  }
  const coefficients = pointCoefficients(factors, points, size);
  if (typeof coefficients === "string") return { ...withFactors, levels, problem: coefficients };
  const qt = base.qt;
  return { ...withFactors, levels, combinations: coefficients.map((coefficient, index) => ({ k: index + 1, count: choose(size, index + 1), coefficient, ...(qt === undefined ? {} : { each: coefficient * qt }) })) };
}

function fraction(law: Law): UncertainExpression {
  return { node: "VALUE", value: { unit: "FRACTION", law } };
}

function convertedBeta(beta: UncertainExpression): UncertainExpression {
  const one: UncertainExpression = { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: 1 } } };
  return { node: "OPERATION", operation: "DIVIDE", operands: [beta, { node: "OPERATION", operation: "ADD", operands: [one, beta] }] };
}

function constant(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value } } };
}

function updatedVectorIdOf(estimateId: string, size: number): string {
  return `ccfv/${estimateId}/updated/C${size}`;
}

function updatedFactorIdOf(estimateId: string, part: string): string {
  return `ccff/${estimateId}/updated/${part}`;
}

function gammaIdOf(estimateId: string, k: number): string {
  return updatedFactorIdOf(estimateId, `G${k}`);
}

function weightedGamma(k: number, testing: DaCcfTesting, gamma: UncertainExpression): UncertainExpression {
  return testing === "STAGGERED" || k === 1 ? gamma : { node: "OPERATION", operation: "MULTIPLY", operands: [constant(k), gamma] };
}

function ratioFactor(j: number, concentrations: readonly number[], testing: DaCcfTesting, gamma: (k: number) => UncertainExpression): UncertainExpression | undefined {
  const above = concentrations.flatMap((value, index) => (index + 1 > j && value > 0 ? [weightedGamma(index + 1, testing, gamma(index + 1))] : []));
  const first = above[0];
  if (first === undefined) return undefined;
  if (!((concentrations[j - 1] ?? 0) > 0)) return fraction({ family: "POINT", value: 1 });
  const rest: UncertainExpression = above.length === 1 ? first : { node: "OPERATION", operation: "ADD", operands: above };
  const share: UncertainExpression = { node: "OPERATION", operation: "DIVIDE", operands: [weightedGamma(j, testing, gamma(j)), rest] };
  return { node: "OPERATION", operation: "DIVIDE", operands: [constant(1), { node: "OPERATION", operation: "ADD", operands: [constant(1), share] }] };
}

function gammaFactors(model: "MGL" | "BETA_FACTOR", concentrations: readonly number[], testing: DaCcfTesting, gamma: (k: number) => UncertainExpression): CcfFactorModel | string {
  const none = "The update leaves no event that fails more than one component.";
  if (model === "BETA_FACTOR") {
    const beta = ratioFactor(1, concentrations, testing, gamma);
    return beta === undefined ? none : { model: "BETA_FACTOR", beta };
  }
  const factors: UncertainExpression[] = [];
  for (let j = 1; j < concentrations.length; j += 1) {
    const factor = ratioFactor(j, concentrations, testing, gamma);
    if (factor === undefined) break;
    factors.push(factor);
  }
  return factors.length === 0 ? none : { model: "MGL", factors };
}

function alphaMeans(levels: readonly number[], testing: DaCcfTesting): number[] {
  if (testing === "STAGGERED") return [...levels];
  const raw = levels.map((value, index) => value / (index + 1));
  const total = sum(raw);
  return raw.map((value) => value / total);
}

function mglLevels(factors: readonly number[], size: number): number[] | string {
  if (factors.some((value) => !(value >= 0 && value <= 1))) return "Each MGL factor must lie between 0 and 1.";
  let reach = 1;
  return Array.from({ length: size }, (_, index) => {
    if (index > factors.length) return 0;
    const next = factors[index];
    const level = next === undefined ? reach : reach * (1 - next);
    reach *= next ?? 0;
    return level;
  });
}

function betaLevels(beta: number, size: number): number[] {
  return Array.from({ length: size }, (_, index) => (index === 0 ? 1 - beta : index === size - 1 ? beta : 0));
}

function priorConcentrations(estimate: CcfParameterEstimation, kind: DaCcfImportKind, code: string, set: DaCcfRowSet, source: DaSource, size: number): UncertaintyState<number[]> | string {
  if (kind === "ALPHA_DIRICHLET") return { status: "ready", value: [...set.values] };
  const testing = testingOf(estimate);
  let weight = estimate.priorWeight;
  let means: number[];
  if (kind === "MGL") {
    const levels = mglLevels(set.values, size);
    if (typeof levels === "string") return levels;
    means = alphaMeans(levels, testing);
    const first = set.rows[0]?.law;
    if (weight === undefined && first?.family === "BETA") weight = first.alpha + first.beta;
  } else if (kind === "BETA") {
    const law = set.rows[0]?.law;
    if (law === undefined) return `${code} gives no beta factor law.`;
    let beta: number;
    if (law.family === "POINT") beta = convertsBeta(source) ? law.value / (1 + law.value) : law.value;
    else {
      if (convertsBeta(source)) return `${code} is not a point value, so it cannot be converted from Qt = (1 + b) Qs.`;
      const summary = lawSummary("FRACTION", lawWithinUnit("FRACTION", law));
      if (summary.status !== "ready") return summary;
      beta = summary.value.mean;
      if (law.family === "BETA" && weight === undefined) weight = law.alpha + law.beta;
    }
    if (!(beta >= 0 && beta <= 1)) return `${code} gives a beta factor outside 0 to 1.`;
    means = alphaMeans(betaLevels(beta, size), testing);
  } else {
    const total = sum(set.values);
    if (!(total > 0)) return "The printed alpha factors add to zero, so they cannot start an update.";
    means = set.values.map((value) => value / total);
  }
  if (weight === undefined || !(weight > 0)) return "The dataset values are points. Type the events they are worth to update them.";
  const total = weight;
  return { status: "ready", value: means.map((value) => value * total) };
}

function bayesResult(da: DataAnalysis, estimate: CcfParameterEstimation, base: DaCcfResult, set: DaCcfRowSet, source: DaSource, kind: DaCcfImportKind, code: string, size: number, record: DaCcfImportRecord): DaCcfResult {
  const testing = testingOf(estimate);
  const model = base.model ?? KIND_MODEL[kind];
  const withModel: DaCcfResult = { ...base, model, imported: record };
  const prior = priorConcentrations(model === "PHI_FACTOR" ? { ...estimate, testing: "STAGGERED" } : estimate, kind, code, set, source, size);
  if (typeof prior === "string") return { ...withModel, problem: prior };
  if (prior.status === "pending") return { ...withModel, pending: true };
  if (prior.status === "failed") return { ...withModel, problem: `PRAXIS could not read the prior: ${prior.error}` };
  const evidence = evidenceCounts(estimate, size);
  const withEvidence: DaCcfResult = { ...withModel, prior: prior.value, counts: evidence.counts, mappings: evidence.mappings };
  if (evidence.problem !== undefined) return { ...withEvidence, problem: evidence.problem };
  if (evidence.pending) return { ...withEvidence, pending: true };
  const posterior = prior.value.map((value, index) => value + (evidence.counts[index] ?? 0));
  const withPosterior: DaCcfResult = { ...withEvidence, posterior };
  if (model === "ALPHA_FACTOR" || model === "PHI_FACTOR") {
    const empty = posterior.findIndex((value) => !(value > 0));
    if (empty !== -1) return { ...withPosterior, problem: `Order ${empty + 1} has no prior weight and no event, so the factors cannot form a Dirichlet. Use the MGL or beta factor form.` };
    const law: VectorLaw = model === "PHI_FACTOR" ? phiVector(posterior) : { family: "DIRICHLET", concentrations: [...posterior] };
    const vector: DaCcfVector = { id: updatedVectorIdOf(estimate.uuid, size), sourceId: source.id, kind, template: code, groupSize: size, rowIds: record.rowIds, vector: law, estimateId: estimate.uuid };
    const factors: CcfFactorModel = model === "PHI_FACTOR" ? { model: "PHI_FACTOR", phis: { node: "VALUE", law } } : dirichletFactors(posterior, testing);
    return finish(da, { ...withPosterior, imported: { ...record, vectorId: vector.id }, vector }, factors, size);
  }
  if (model === "BINOMIAL_FAILURE_RATE") return { ...withPosterior, problem: "The binomial failure rate model takes no dataset values." };
  const entries: DaCcfFactor[] = posterior.flatMap((value, index) => (value > 0 ? [{ id: gammaIdOf(estimate.uuid, index + 1), sourceId: source.id, rowId: `${code} updated, order ${index + 1}`, expression: gammaValue(value), estimateId: estimate.uuid }] : []));
  const held = new Map(entries.map((entry) => [entry.id, entry.expression]));
  const factors = gammaFactors(model, posterior, testing, (k) => held.get(gammaIdOf(estimate.uuid, k)) ?? constant(0));
  if (typeof factors === "string") return { ...withPosterior, problem: factors };
  const linkFactors = (link: (entityId: string) => UncertainExpression): CcfFactorModel => {
    const linked = gammaFactors(model, posterior, testing, (k) => link(gammaIdOf(estimate.uuid, k)));
    return typeof linked === "string" ? factors : linked;
  };
  return finish(da, { ...withPosterior, factorEntries: entries, linkFactors }, factors, size);
}

function gammaValue(shape: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "FACTOR", law: { family: "GAMMA", shape, rate: 1 } } };
}

function posteriorValue(unit: UncertainUnit, failures: number, exposure: number): UncertainExpression {
  return { node: "VALUE", value: { unit, law: { family: "POSTERIOR", prior: null, evidence: [{ likelihood: "BINOMIAL", failures, exposure }] } } };
}

function lethalShocks(estimate: CcfParameterEstimation): number {
  return sum((estimate.evidence ?? []).filter((evidence) => evidence.included).map((evidence) => (evidence.lethalShocks ?? 0) + sum(evidence.events.filter((event) => event.included && event.lethal === true).map((event) => event.impact[event.impact.length - 1] ?? 0))));
}

function bfrResult(da: DataAnalysis, estimate: CcfParameterEstimation, base: DaCcfResult, size: number): DaCcfResult {
  const evidence = evidenceCounts(estimate, size);
  const withEvidence: DaCcfResult = { ...base, model: "BINOMIAL_FAILURE_RATE", counts: evidence.counts, mappings: evidence.mappings };
  if (evidence.problem !== undefined) return { ...withEvidence, problem: evidence.problem };
  if (evidence.pending) return { ...withEvidence, pending: true };
  if (!(estimate.evidence ?? []).some((item) => item.included)) return { ...withEvidence, problem: "Add the events the four parts are updated with." };
  const demands = estimate.groupDemands;
  if (demands === undefined || !(demands > 0)) return { ...withEvidence, problem: "Type the demands on the group over the period of the events." };
  const counts = evidence.counts;
  const lethal = lethalShocks(estimate);
  const shared = counts.slice(1);
  const all = counts[size - 1] ?? 0;
  if (lethal > all + 1e-9) return { ...withEvidence, problem: `The lethal shocks, ${numberText(lethal)}, are more than the ${numberText(all)} events that fail all ${size}.` };
  const shocks = sum(shared) - lethal;
  if (!(shocks > 0)) return { ...withEvidence, problem: "No non-lethal shock is in the events, so the failure per shock has no data." };
  const failed = sum(shared.map((value, index) => (index + 2) * value)) - size * lethal;
  const terms: { unit: UncertainUnit; failures: number; exposure: number }[] = [
    { unit: "PROBABILITY", failures: counts[0] ?? 0, exposure: size * demands },
    { unit: "PROBABILITY", failures: shocks, exposure: demands },
    { unit: "FRACTION", failures: failed, exposure: size * shocks },
    { unit: "PROBABILITY", failures: lethal, exposure: demands },
  ];
  const over = terms.findIndex((term) => term.failures > term.exposure);
  if (over !== -1) return { ...withEvidence, problem: `${BFR_PARTS[over]?.label ?? "A part"} has more events than demands. Check the demands on the group.` };
  const entries: DaCcfFactor[] = terms.map((term, index) => ({
    id: updatedFactorIdOf(estimate.uuid, BFR_KEYS[index] ?? String(index)),
    sourceId: estimate.uuid,
    rowId: `${BFR_PARTS[index]?.label ?? ""} updated`,
    expression: posteriorValue(term.unit, term.failures, term.exposure),
    estimateId: estimate.uuid,
  }));
  const build = (part: (index: number) => UncertainExpression): CcfFactorModel => ({ model: "BINOMIAL_FAILURE_RATE", independent: part(0), nonLethalShock: part(1), componentFailure: part(2), lethalShock: part(3) });
  const factors = build((index) => entries[index]?.expression ?? constant(0));
  return finish(da, { ...withEvidence, factorEntries: entries, linkFactors: (link) => build((index) => link(entries[index]?.id ?? "")) }, factors, size);
}

function templateOf(source: DaSource, kind: DaCcfImportKind, code: string, first: { component: string; failureMode: string; table?: string } | undefined): DaCcfTemplate {
  return { sourceId: source.id, code, kind, component: first?.component ?? "", failureMode: first?.failureMode ?? "", table: first?.table ?? "" };
}

function importedResult(da: DataAnalysis, estimate: CcfParameterEstimation, base: DaCcfResult, size: number): DaCcfResult {
  const source = sourceOf(da, estimate.priorSourceId);
  const code = estimate.priorTemplate;
  const kind = kindOf(estimate);
  if (source === undefined || code === undefined || blank(code)) return { ...base, model: base.model ?? KIND_MODEL[kind], problem: "Choose the dataset values the estimate starts from." };
  const set = readSet(kind, code, size, source.entries);
  if (typeof set === "string") return { ...base, model: KIND_MODEL[kind], problem: set };
  const template = templateOf(source, kind, code, set.rows[0]);
  const rowIds = [...set.rows, ...set.checks].map((row) => row.id);
  const record: DaCcfImportRecord = { kind, rowIds, groupSize: size };
  const testing = testingOf(estimate);
  const withTemplate: DaCcfResult = { ...base, template };
  if (estimate.method === "BAYES") return bayesResult(da, estimate, withTemplate, set, source, kind, code, size, record);
  switch (kind) {
    case "ALPHA_DIRICHLET": {
      const gamma = set.values;
      const vector: DaCcfVector = { id: vectorIdOf(source.id, kind, code, size), sourceId: source.id, kind, template: code, groupSize: size, rowIds, vector: { family: "DIRICHLET", concentrations: [...gamma] } };
      return finish(da, { ...withTemplate, imported: { ...record, vectorId: vector.id }, vector, prior: gamma }, dirichletFactors(gamma, testing), size);
    }
    case "ALPHA_MLE":
    case "ALPHA_SUMMARY":
    case "ALPHA_POINTS": {
      const printed = set.values;
      const total = sum(printed);
      if (!(total > 0)) return { ...withTemplate, model: "ALPHA_FACTOR", problem: "The printed alpha factors add to zero, so they cannot be scaled to add to 1." };
      const scaled = Math.abs(total - 1) > SUM_TOLERANCE;
      const values = scaled ? printed.map((value) => value / total) : [...printed];
      const vector: DaCcfVector = { id: vectorIdOf(source.id, kind, code, size), sourceId: source.id, kind, template: code, groupSize: size, rowIds, vector: { family: "FIXED", values } };
      const imported: DaCcfImportRecord = { ...record, vectorId: vector.id, ...(scaled ? { originalSum: total, scale: 1 / total } : {}) };
      const factors: CcfFactorModel = { model: "ALPHA_FACTOR", testing, alphas: { node: "VALUE", law: { family: "FIXED", values } } };
      return finish(da, { ...withTemplate, imported, vector }, factors, size, scaled ? printed : []);
    }
    case "MGL": {
      const staggered = source.catalogId === "CCF-2020";
      const factors: CcfFactorModel = { model: "MGL", factors: set.values.map((value, index) => {
        const law = set.rows[index]?.law;
        return fraction(law !== undefined && law.family === "BETA" ? lawWithinUnit("FRACTION", law) : { family: "POINT", value });
      }) };
      return finish(da, { ...withTemplate, imported: { ...record, ...(staggered ? { testing: "STAGGERED" as const } : {}) } }, factors, size);
    }
    case "BETA": {
      const row = set.rows[0];
      const law = row?.law;
      if (row === undefined || law === undefined) return { ...withTemplate, model: "BETA_FACTOR", problem: `${code} gives no beta factor law.` };
      if (convertsBeta(source)) {
        if (law.family !== "POINT") return { ...withTemplate, model: "BETA_FACTOR", problem: `${code} is not a point value, so it cannot be converted from Qt = (1 + b) Qs.` };
        if (!(law.value >= 0)) return { ...withTemplate, model: "BETA_FACTOR", problem: `${code} gives a negative beta factor.` };
        const factor: DaCcfFactor = { id: factorIdOf(source.id, code), sourceId: source.id, rowId: code, expression: { node: "VALUE", value: { unit: "FACTOR", law } } };
        return finish(da, { ...withTemplate, imported: { ...record, conversion: "ONE_PLUS_BETA", factorId: factor.id }, factor }, { model: "BETA_FACTOR", beta: convertedBeta(fraction(law)) }, size, [law.value]);
      }
      return finish(da, { ...withTemplate, imported: record }, { model: "BETA_FACTOR", beta: fraction(lawWithinUnit("FRACTION", law)) }, size);
    }
  }
}

function computeResult(da: DataAnalysis, estimate: CcfParameterEstimation): DaCcfResult {
  const size = estimate.groupSize;
  const testing = testingOf(estimate);
  const method = estimate.method;
  const model = modelOfEstimate(estimate);
  const takesTotal = model !== "BINOMIAL_FAILURE_RATE";
  const total = takesTotal ? qtOf(da, estimate) : { pending: false };
  const base: DaCcfResult = { size, testing, method, model, qt: total.qt, qtFrom: total.from, levels: [], combinations: [], mappings: [], pending: total.pending };
  if (size === undefined || !Number.isInteger(size) || size < 2) return { ...base, problem: "Enter the group size, two or more components." };
  if (method === undefined) return { ...base, problem: "Choose where the factors come from." };
  if (method === "TYPED") {
    if (estimate.factors === undefined) return { ...base, problem: "Type the factors for the model and group size." };
    return finish(da, base, estimate.factors, size);
  }
  if (method === "BAYES" && model === "BINOMIAL_FAILURE_RATE") return bfrResult(da, estimate, base, size);
  return importedResult(da, estimate, base, size);
}

function sameFactors(left: CcfFactorModel | undefined, right: CcfFactorModel | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return canonicalJson(left) === canonicalJson(right);
}

function factorReferences(factors: CcfFactorModel | undefined): WorkbookParameterReference[] {
  if (factors === undefined) return [];
  const vector = factors.model === "ALPHA_FACTOR" ? factors.alphas : factors.model === "PHI_FACTOR" ? factors.phis : undefined;
  return [...(vector?.node === "PARAMETER" ? [vector.reference] : []), ...ccfFactorExpressions(factors).flatMap(expressionReferences)];
}

function linkedWorkbook(stored: CcfFactorModel | undefined, id: string, self: string | undefined): string | undefined {
  if (self !== undefined && self.trim().length > 0) return self;
  return factorReferences(stored).find((reference) => reference.entityId.trim() === id)?.workbookId;
}

function sharedId(result: DaCcfResult): string | undefined {
  return result.vector?.id ?? result.factor?.id ?? result.factorEntries?.[0]?.id;
}

function heldFactors(result: DaCcfResult, stored: CcfFactorModel | undefined, self: string | undefined): CcfFactorModel | undefined {
  const factors = result.factors;
  const id = sharedId(result);
  if (factors === undefined || id === undefined) return factors;
  const workbookId = linkedWorkbook(stored, id, self);
  if (workbookId === undefined) return factors;
  const linkTo = (entityId: string): ParameterExpression => ({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId, entityId } });
  const link = linkTo(id);
  if (result.linkFactors !== undefined) return result.linkFactors(linkTo);
  if (factors.model === "ALPHA_FACTOR" && result.vector !== undefined) return { ...factors, alphas: link };
  if (factors.model === "PHI_FACTOR" && result.vector !== undefined) return { model: "PHI_FACTOR", phis: link };
  if (factors.model === "BETA_FACTOR" && result.factor !== undefined) return { model: "BETA_FACTOR", beta: convertedBeta(link) };
  return factors;
}

function publishedList<T extends { id: string }>(found: Map<string, T>, held: readonly T[] | undefined, referenced: ReadonlySet<string>): { list: T[]; changed: boolean } {
  for (const item of held ?? []) if (!found.has(item.id) && referenced.has(item.id)) found.set(item.id, item);
  const list = [...found.values()].sort((left, right) => left.id.localeCompare(right.id));
  return { list, changed: canonicalJson(list) !== canonicalJson(held ?? []) };
}

function withCcf(da: DataAnalysis, self?: string): DataAnalysis {
  const estimates = da.ccfParameterEstimations;
  if (estimates === undefined) return da;
  let changed = false;
  const vectors = new Map<string, DaCcfVector>();
  const factorTable = new Map<string, DaCcfFactor>();
  const next = estimates.map((estimate) => {
    if (estimate.method !== "PRIOR" && estimate.method !== "BAYES") return estimate;
    const result = ccfResult(da, estimate);
    if (result.vector !== undefined) vectors.set(result.vector.id, result.vector);
    if (result.factor !== undefined) factorTable.set(result.factor.id, result.factor);
    for (const entry of result.factorEntries ?? []) factorTable.set(entry.id, entry);
    if (result.pending) return estimate;
    const factors = heldFactors(result, estimate.factors, self);
    const imported = factors === undefined ? undefined : result.imported;
    if (sameFactors(estimate.factors, factors) && canonicalJson(estimate.imported) === canonicalJson(imported)) return estimate;
    changed = true;
    return { ...estimate, factors, imported };
  });
  const referenced = new Set(next.flatMap((estimate) => factorReferences(estimate.factors).map((reference) => reference.entityId.trim())));
  const shared = publishedList(vectors, da.ccfVectors, referenced);
  const scalars = publishedList(factorTable, da.ccfFactors, referenced);
  if (!changed && !shared.changed && !scalars.changed) return da;
  return {
    ...da,
    ccfParameterEstimations: changed ? next : estimates,
    ...(shared.changed ? { ccfVectors: shared.list.length === 0 && da.ccfVectors === undefined ? undefined : shared.list } : {}),
    ...(scalars.changed ? { ccfFactors: scalars.list.length === 0 && da.ccfFactors === undefined ? undefined : scalars.list } : {}),
  };
}

function stateModes(da: DataAnalysis): Map<string, string | undefined> {
  return new Map((da.dataNeeds?.states ?? []).map((state) => [state.id, state.mode]));
}

function valueNodes(expression: UncertainExpression): UncertainValue[] {
  switch (expression.node) {
    case "VALUE": return [expression.value];
    case "PARAMETER": return [];
    case "OPERATION": return expression.operands.flatMap(valueNodes);
    case "MODEL": return modelArguments(expression.model).flatMap(valueNodes);
  }
}

function factorRange(factors: CcfFactorModel): "OUTSIDE" | "CROSSES" | undefined {
  const domain = unitBounds("FRACTION");
  const bounds = ccfFactorExpressions(factors).flatMap((expression) => (expression.node === "VALUE" ? [expression.value] : [])).map((value) => lawBounds(value.law));
  if (bounds.some((bound) => bound.upper < domain.lower || bound.lower > domain.upper)) return "OUTSIDE";
  if (bounds.some((bound) => bound.lower < domain.lower || bound.upper > domain.upper)) return "CROSSES";
  return undefined;
}

function nestedRange(factors: CcfFactorModel): boolean {
  const nested = ccfFactorExpressions(factors).filter((expression) => expression.node !== "VALUE").flatMap(valueNodes);
  return nested.filter((value) => value.unit === "FRACTION" || value.unit === "PROBABILITY").map((value) => lawBounds(value.law)).some((bound) => bound.lower < 0 || bound.upper > 1);
}

function modelText(factors: CcfFactorModel): string {
  return MODEL_TEXT[factors.model];
}

type CcfLabel = (key: string) => string;

function entityOf(key: string): string {
  return key.slice(key.indexOf(":") + 1);
}

function ccfVectorLabel(vector: Pick<DaCcfVector, "template" | "kind" | "groupSize" | "estimateId">): string {
  if (vector.estimateId !== undefined) return `${vector.template} updated for ${vector.estimateId} · group of ${vector.groupSize}`;
  return `${vector.template} · ${KIND_LABELS[vector.kind]} · group of ${vector.groupSize}`;
}

function ccfLabelOf(da: Pick<DataAnalysis, "parameters" | "sources" | "ccfVectors" | "ccfFactors">): CcfLabel {
  const sourceNames = new Map((da.sources ?? []).map((source) => [source.id, source.name]));
  const labels = new Map<string, string>([
    ...da.parameters.map((parameter) => [parameter.uuid, parameter.name] as const),
    ...(da.ccfVectors ?? []).map((vector) => [vector.id, ccfVectorLabel(vector)] as const),
    ...(da.ccfFactors ?? []).map((factor) => [factor.id, `${sourceNames.get(factor.sourceId) ?? factor.sourceId} ${factor.rowId}`] as const),
  ]);
  return (key) => labels.get(entityOf(key)) ?? entityOf(key);
}

function vectorText(vector: UncertainVector, label: CcfLabel): string {
  if (vector.node === "PARAMETER") return `linked to ${label(parameterReferenceKey(vector.reference))}`;
  const law = vector.law;
  switch (law.family) {
    case "DIRICHLET": return `Dirichlet(${law.concentrations.map(numberText).join(", ")})`;
    case "WEIGHTED_DIRICHLET": return `weighted Dirichlet(${law.concentrations.map(numberText).join(", ")}) with weights ${law.weights.map(numberText).join(", ")}`;
    case "FIXED": return `fixed ${law.values.map(numberText).join(", ")}`;
  }
}

function factorsText(factors: CcfFactorModel, label: CcfLabel = entityOf): string {
  switch (factors.model) {
    case "BETA_FACTOR":
      return `${MODEL_LABELS.BETA_FACTOR}, β ${expressionText(factors.beta, label)}`;
    case "MGL":
      return `${MODEL_LABELS.MGL}, ${factors.factors.map((factor, index) => `${MGL_LETTERS[index] ?? `ρ${index + 2}`} ${expressionText(factor, label)}`).join(", ")}`;
    case "ALPHA_FACTOR":
      return `${MODEL_LABELS.ALPHA_FACTOR}, ${TESTING_TEXT[factors.testing]}, ${vectorText(factors.alphas, label)}`;
    case "PHI_FACTOR":
      return `${MODEL_LABELS.PHI_FACTOR}, ${vectorText(factors.phis, label)}`;
    case "BINOMIAL_FAILURE_RATE":
      return `${MODEL_LABELS.BINOMIAL_FAILURE_RATE}, ${bfrExpressions(factors).map((expression, index) => `${(BFR_PARTS[index]?.label ?? "").toLowerCase()} ${expressionText(expression, label)}`).join(", ")}`;
  }
}

function zeroOrders(factors: CcfFactorModel | undefined, size: number | undefined): string | undefined {
  if (factors === undefined || size === undefined || !Number.isInteger(size)) return undefined;
  if (factors.model === "MGL") {
    const count = factors.factors.length;
    if (count < 1 || count >= size - 1) return undefined;
    return `With ${count} MGL ${count === 1 ? "factor" : "factors"} for a group of ${size}, PRAXIS gives ${ordersText(count + 2, size)} no events, so ${count + 2 === size ? "it is" : "they are"} set to zero.`;
  }
  if (factors.model === "BETA_FACTOR" && size > 2) return `The beta factor model fails one member or all ${size}. PRAXIS gives ${ordersText(2, size - 1)} no events, so ${size === 3 ? "it is" : "they are"} set to zero.`;
  return undefined;
}

function evidenceFindings(estimate: CcfParameterEstimation, item: string, findings: DaNeedFinding[]): void {
  const events = { kind: "daCcfEvents" as const, id: estimate.uuid };
  for (const evidence of estimate.evidence ?? []) {
    const what = blank(evidence.label) ? evidence.id : evidence.label ?? evidence.id;
    const imported = evidence.imported;
    if (evidence.included && imported?.kind === "IMPACT_VECTOR" && imported.sourceId === estimate.priorSourceId && estimate.priorTemplate !== undefined && imported.set.startsWith(`${estimate.priorTemplate}-C`)) {
      findings.push({ severity: "error", check: "Events counted twice", item, detail: `${what} holds the events already in the ${estimate.priorTemplate} distributions. Start from the prior the report used, or leave the events out.`, target: events });
    }
    if (evidence.included && imported?.kind === "MULTIPLICITY" && !(evidence.independentFailures > 0)) {
      findings.push({ severity: "warning", check: "No independent failures", item, detail: `${what} gives counts of shared-cause events only. Type the independent failures of the same population.`, target: events });
    }
    const from = evidence.impactSize;
    const size = estimate.groupSize;
    if (evidence.included && from !== undefined && size !== undefined && from !== size) {
      findings.push({ severity: "note", check: "Mapped", item, detail: `${what} is coded for a group of ${from} and is mapped ${from > size ? "down" : "up"} to ${size} in PRAXIS${from < size && evidence.mappingRho !== undefined ? ` with rho ${numberText(evidence.mappingRho)}` : ""}.`, target: events });
    }
  }
}

function estimateFindings(da: DataAnalysis, estimate: CcfParameterEstimation, check: DaCcfCheck): void {
  const findings = check.findings;
  const item = estimate.uuid;
  const group = { kind: "daCcfGroup" as const, id: estimate.uuid };
  const factorsTarget = { kind: "daCcfFactors" as const, id: estimate.uuid };
  const events = { kind: "daCcfEvents" as const, id: estimate.uuid };
  const result = ccfResult(da, estimate);
  if (result.pending) check.pending = true;
  const size = estimate.groupSize;
  const operating = da.plantStage === "OPERATIONAL";
  const ccTwo = da.capabilityCategory !== "CC-I";
  const needs = da.dataNeeds;
  const share = shareFromNeeds(da, estimate);
  const takesTotal = result.model !== "BINOMIAL_FAILURE_RATE";
  if (blank(estimate.ccfGroupReference)) findings.push({ severity: "error", check: "No group", item, detail: "Name the Systems Analysis group this estimate serves.", target: group });
  else if (needs !== undefined && needs.ccfGroups.length > 0 && share === undefined) findings.push({ severity: "warning", check: "Group not imported", item, detail: `${estimate.ccfGroupReference} is not among the common cause groups imported in Step 02.`, target: group });
  if (share !== undefined && size !== undefined && share.members.length !== size) findings.push({ severity: "error", check: "Size differs", item, detail: `Systems Analysis gives ${estimate.ccfGroupReference} ${share.members.length} members, but the estimate is for a group of ${size}.`, target: group });
  if (takesTotal && share !== undefined && share.parameterIds.length > 1) findings.push({ severity: "error", check: "Members differ", item, detail: `The members map to ${share.parameterIds.join(", ")}. A group shares one independent estimate, its total failure probability (DA-D8).`, target: group });
  if (takesTotal && estimate.memberParameterId !== undefined && share !== undefined && share.parameterIds.length === 1 && share.parameterIds[0] !== estimate.memberParameterId) findings.push({ severity: "warning", check: "Members' parameter", item, detail: `The members map to ${share.parameterIds[0] ?? "?"}, but the estimate takes its total from ${estimate.memberParameterId}.`, target: group });
  if (takesTotal && estimate.memberParameterId === undefined && (share === undefined || share.parameterIds.length === 0)) findings.push({ severity: "warning", check: "No total", item, detail: "Pick the parameter the members share, so each combination can be computed.", target: group });
  if (size !== undefined && size > 4 && blank(estimate.estimateReason)) findings.push({ severity: "warning", check: "Large group", item, detail: `Say why a group of ${size} is modeled. Groups above four rarely have data behind them.`, target: factorsTarget });
  if (estimate.testing === undefined) findings.push({ severity: "warning", check: "No testing scheme", item, detail: "Set the testing scheme. Non-staggered is the conservative choice when it is not known.", target: group });
  else if (blank(estimate.testingReason)) findings.push({ severity: "warning", check: "No testing basis", item, detail: "Say which plan or procedure sets the testing scheme.", target: group });
  if (blank(estimate.componentBoundaryConsistencyBasis)) findings.push({ severity: "warning", check: "No boundary basis", item, detail: "Say how the factors' component boundary matches the members' boundary (DA-D8).", target: group });
  const memberId = estimate.memberParameterId ?? share?.parameterIds[0];
  const member = memberId === undefined ? undefined : da.parameters.find((candidate) => candidate.uuid === memberId);
  if (memberId !== undefined && member === undefined) findings.push({ severity: "error", check: "Parameter missing", item, detail: `${memberId} does not exist.`, target: group });
  const modes = stateModes(da);
  const shutdown = (member?.stateIds ?? []).filter((state) => {
    const mode = modes.get(state);
    return mode !== undefined && mode !== "POWER" && mode !== "STARTUP";
  });
  if (shutdown.length > 0) findings.push({ severity: "note", check: "Shutdown states", item, detail: `The members hold in ${shutdown.join(", ")}. Full-power common cause data may need adjusting there (DA-N-29).`, target: group });
  const method = result.method;
  if (method === undefined) {
    findings.push({ severity: "error", check: "No method", item, detail: "Choose dataset values, dataset values updated with events, or factors typed by hand.", target: factorsTarget });
    return;
  }
  const held = method === "TYPED" ? estimate.factors : result.factors;
  if (method === "TYPED") {
    const typed = estimate.factors;
    if (result.problem !== undefined) findings.push({ severity: "error", check: "Cannot use", item, detail: result.problem, target: factorsTarget });
    const range = typed === undefined ? undefined : factorRange(typed);
    if (range === "OUTSIDE") findings.push({ severity: "error", check: "Out of range", item, detail: "A factor lies entirely outside 0 to 1.", target: factorsTarget });
    if (range === "CROSSES" || (typed !== undefined && nestedRange(typed))) findings.push({ severity: "warning", check: "Can leave range", item, detail: "A factor law can leave 0 to 1. A run stops on any trial outside that range. Truncate the law to be safe.", target: factorsTarget });
    if (typed?.model === "ALPHA_FACTOR" && estimate.testing !== undefined && typed.testing !== estimate.testing) findings.push({ severity: "warning", check: "Testing differs", item, detail: `The typed alpha factors are for ${TESTING_TEXT[typed.testing]} testing, but the group is tested ${TESTING_TEXT[estimate.testing]}.`, target: factorsTarget });
    if (blank(estimate.estimateReason)) findings.push({ severity: "warning", check: "No basis", item, detail: "Say where the typed factors come from.", target: factorsTarget });
  } else {
    if (result.problem !== undefined) findings.push({ severity: "error", check: "Cannot estimate", item, detail: result.problem, target: result.prior === undefined || method === "PRIOR" ? factorsTarget : events });
    if (blank(estimate.priorReason) && result.model !== "BINOMIAL_FAILURE_RATE") findings.push({ severity: "warning", check: "No template reason", item, detail: "Say why the dataset's component and failure mode fit the members (DA-D8).", target: factorsTarget });
    const code = estimate.priorTemplate ?? "";
    const rateMember = member?.quantificationModel === "RUNNING_RATE" || member?.quantificationModel === "STANDBY_RATE" || member?.quantificationModel === "MISSION_PROBABILITY";
    const demandMember = member?.quantificationModel === "DEMAND_PROBABILITY";
    if (blank(estimate.priorReason) && ((code === "CCF-DEM" && rateMember) || (code === "CCF-RATE" && demandMember))) findings.push({ severity: "warning", check: "Failure type differs", item, detail: `The members fail ${demandMember ? "on demand" : "over time"}, but ${code} pools ${code === "CCF-DEM" ? "demand" : "rate"} failures.`, target: factorsTarget });
    const imported = result.imported;
    if (imported?.kind === "ALPHA_DIRICHLET" && result.template !== undefined && size !== undefined) {
      const source = sourceOf(da, estimate.priorSourceId);
      const totals = imported.rowIds.flatMap((id) => {
        const law = source?.entries.find((entry) => entry.id === id)?.law;
        return law?.family === "BETA" ? [law.alpha + law.beta] : [];
      });
      const spread = totals.length > 0 ? (Math.max(...totals) - Math.min(...totals)) / Math.max(...totals) : 0;
      if (spread > 0.02) findings.push({ severity: "note", check: "Marginals disagree", item, detail: `The printed marginals imply totals that differ by ${Math.round(spread * 100)}%, so the rebuilt factors are approximate.`, target: factorsTarget });
    }
    if (imported?.scale !== undefined && imported.originalSum !== undefined) findings.push({ severity: "note", check: "Scaled to 1", item, detail: `The printed alpha factors add to ${preciseText(imported.originalSum)}. DA scales them by ${preciseText(imported.scale)} so they add to 1.`, target: factorsTarget });
    if (imported?.conversion === "ONE_PLUS_BETA") findings.push({ severity: "note", check: "Beta converted", item, detail: "The source uses Qt = (1 + b) Qs. PRAXIS converts b to the standard b / (1 + b).", target: factorsTarget });
    if (imported?.testing === "STAGGERED" && estimate.testing === "NON_STAGGERED") findings.push({ severity: "warning", check: "MGL assumes staggered", item, detail: "The report converted these MGL values from alpha factors under staggered testing. This group is tested non-staggered, so its alpha factors fit better.", target: factorsTarget });
    const shared = sharedId(result);
    if (shared !== undefined && linkedWorkbook(estimate.factors, shared, undefined) === undefined) findings.push({ severity: "note", check: "Shared draw not linked", item, detail: "The factors are linked for shared draws once the workbook is saved in a project.", target: factorsTarget });
    const included = (estimate.evidence ?? []).filter((evidence) => evidence.included);
    if (method === "PRIOR" && included.length > 0) findings.push({ severity: ccTwo ? "error" : "warning", check: "Events not used", item, detail: "Events are in the update but the dataset values are used as they are. Update them (DA-D8).", target: factorsTarget });
    if (method === "BAYES" && included.length === 0) findings.push({ severity: "note", check: "Nothing to update", item, detail: "No events are in the update, so the factors equal the published ones.", target: events });
    if (included.length > 0 && estimate.genericExclusionConsistencyConfirmed !== true) findings.push({ severity: "warning", check: "Exclusions not confirmed", item, detail: "Confirm that every event left out of the independent data is left out of the common cause events too (DA-D9).", target: factorsTarget });
    if (included.length > 0 && estimate.genericExclusionConsistencyConfirmed === true && blank(estimate.genericExclusionConsistencyBasis)) findings.push({ severity: "warning", check: "No exclusion basis", item, detail: "Say how the exclusions were matched (DA-D9).", target: factorsTarget });
    if (ccTwo && operating && included.length === 0 && KIND_MODEL[kindOf(estimate)] === "ALPHA_FACTOR") findings.push({ severity: "note", check: "Plant experience", item, detail: "At Capability Category II, update the published factors with plant experience where it exists (DA-D8).", target: events });
  }
  if (held?.model === "BETA_FACTOR" && ccTwo && estimate.isRiskSignificant === true && size !== undefined && size > 2) findings.push({ severity: "error", check: "Model too coarse", item, detail: "A risk-significant group of more than two needs alpha factors, MGL or another multi-parameter model at Capability Category II (DA-D7).", target: factorsTarget });
  const zero = zeroOrders(held, size);
  if (zero !== undefined) findings.push({ severity: "warning", check: "Orders set to zero", item, detail: zero, target: factorsTarget });
  evidenceFindings(estimate, item, findings);
  const records = new Map((da.recordSets ?? []).map((set) => [set.id, set]));
  for (const evidence of estimate.evidence ?? []) {
    const what = blank(evidence.label) ? evidence.id : evidence.label ?? evidence.id;
    if (blank(evidence.reason)) findings.push({ severity: "error", check: "No reason", item, detail: `Say why ${what} applies to this group.`, target: events });
    if (!evidence.included && blank(evidence.exclusionReason)) findings.push({ severity: "error", check: "No exclusion reason", item, detail: `Say why ${what} is left out.`, target: events });
    if (evidence.included && evidence.boundary === "DIFFERENT") findings.push({ severity: "error", check: "Boundary differs", item, detail: `${what} covers a different boundary. Leave it out or adjust it (DA-D8).`, target: events });
    if (evidence.included && !operating && evidence.origin === "PLANT_RECORDS") findings.push({ severity: "warning", check: "Plant records before operation", item, detail: `${what} is marked as plant records, but the plant does not operate yet.`, target: events });
    const set = evidence.recordSetId === undefined ? undefined : records.get(evidence.recordSetId);
    if (evidence.recordSetId !== undefined && set === undefined) findings.push({ severity: "error", check: "Record set missing", item, detail: `${what} points at record set ${evidence.recordSetId}, which does not exist.`, target: events });
    for (const event of evidence.events) {
      if (blank(event.reason)) findings.push({ severity: "error", check: "No reason", item, detail: `Say how the impact of ${event.id} was judged, or why it is left out.`, target: events });
      if (event.recordId === undefined || set === undefined) continue;
      const record = set.records.find((candidate) => candidate.id === event.recordId);
      if (record === undefined) {
        findings.push({ severity: "error", check: "Record missing", item, detail: `${event.id} points at ${event.recordId}, which is not in ${set.id}.`, target: events });
        continue;
      }
      const counted = record.judgment === "FAILURE";
      if (evidence.included && event.included && !counted) findings.push({ severity: "warning", check: "Exclusions differ", item, detail: `${record.id} is left out of the independent data in Step 05, but counts here as a common cause event (DA-D9).`, target: events });
      if (evidence.included && !event.included && counted) findings.push({ severity: "warning", check: "Exclusions differ", item, detail: `${record.id} counts as a failure in Step 05, but is left out of the common cause events here (DA-D9).`, target: events });
    }
    if (set !== undefined && evidence.included && memberId !== undefined) {
      const linked = new Set(evidence.events.filter((event) => event.included && event.recordId !== undefined).map((event) => event.recordId));
      const independent = set.records.filter((record) => record.judgment === "FAILURE" && record.parameterId === memberId && !linked.has(record.id)).length;
      if (independent !== evidence.independentFailures) findings.push({ severity: "note", check: "Independent count", item, detail: `${set.id} counts ${independent} independent ${independent === 1 ? "failure" : "failures"} of ${memberId}, but ${what} uses ${Number(evidence.independentFailures.toPrecision(4))}.`, target: events });
    }
  }
  const ours = estimate.factors ?? held;
  const theirs = share?.factors;
  if (ours !== undefined && theirs !== undefined && !sameFactors(ours, theirs)) findings.push({ severity: "warning", check: "SY differs", item, detail: `Systems Analysis holds other ${modelText(theirs)} factors. Apply the DA values in SY Step 04.`, target: factorsTarget });
}

function ccfCheck(da: DataAnalysis): DaCcfCheck {
  const version = uncertaintyVersion();
  const cached = checkCache.get(da);
  if (cached !== undefined && cached.version === version) return cached.check;
  const check: DaCcfCheck = { findings: [], pending: false };
  const estimates = da.ccfParameterEstimations ?? [];
  const seen = new Set<string>();
  for (const estimate of estimates) {
    if (seen.has(estimate.uuid)) check.findings.push({ severity: "error", check: "Duplicate ID", item: estimate.uuid, detail: "Two estimates share this ID.", target: { kind: "daCcfGroup", id: estimate.uuid } });
    seen.add(estimate.uuid);
    estimateFindings(da, estimate, check);
  }
  const needs = da.dataNeeds;
  if (needs !== undefined) {
    const byGroup = new Set(estimates.map((estimate) => estimate.ccfGroupReference));
    const byId = new Set(estimates.map((estimate) => estimate.uuid));
    for (const need of needs.ccfGroups) {
      if (!need.included) continue;
      if (!byGroup.has(need.id) && (need.estimateRef === undefined || !byId.has(need.estimateRef))) check.findings.push({ severity: "error", check: "No estimate", item: need.id, detail: "This Systems Analysis group has no common cause estimate.", target: { kind: "needCcf", id: need.id } });
    }
    const groups = estimates.filter((estimate) => estimates.filter((other) => other.ccfGroupReference === estimate.ccfGroupReference).length > 1);
    for (const estimate of groups) check.findings.push({ severity: "warning", check: "Group estimated twice", item: estimate.uuid, detail: `More than one estimate serves ${estimate.ccfGroupReference}.`, target: { kind: "daCcfGroup", id: estimate.uuid } });
  }
  const sorted = check.findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => RANK[a.finding.severity] - RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
  const result = { findings: sorted, pending: check.pending };
  checkCache.set(da, { version, check: result });
  return result;
}

function ccfFindings(da: DataAnalysis): DaNeedFinding[] {
  return ccfCheck(da).findings;
}

function ccfComplete(da: DataAnalysis): boolean {
  const decision = (da.scopeDecisions ?? []).find((candidate) => candidate.kind === "COMMON_CAUSE");
  if (decision !== undefined && !decision.included) return true;
  const estimates = da.ccfParameterEstimations ?? [];
  if (estimates.length === 0) return false;
  if (estimates.some((estimate) => estimate.factors === undefined)) return false;
  const check = ccfCheck(da);
  return !check.pending && !check.findings.some((finding) => finding.severity === "error");
}

function ccfEventCount(estimate: CcfParameterEstimation): number {
  return (estimate.evidence ?? []).reduce((total, evidence) => total + evidence.events.length + (evidence.counts === undefined && evidence.multiplicities === undefined ? 0 : 1), 0);
}

function withTestingFlipped(estimate: CcfParameterEstimation, testing: DaCcfTesting): CcfParameterEstimation | string {
  const model = modelOfEstimate(estimate);
  if (estimate.method === "BAYES" && model !== "BINOMIAL_FAILURE_RATE" && model !== "PHI_FACTOR") return { ...estimate, testing };
  if (estimate.method === "PRIOR" && KIND_MODEL[kindOf(estimate)] === "ALPHA_FACTOR") return { ...estimate, testing };
  const factors = estimate.factors;
  if (estimate.method === "TYPED" && factors?.model === "ALPHA_FACTOR") return { ...estimate, testing, factors: { ...factors, testing } };
  return "Only alpha factors depend on the testing scheme.";
}

function allFail(da: DataAnalysis, estimate: CcfParameterEstimation): UncertaintyState<number> | string {
  const result = ccfResult(da, estimate);
  if (result.pending) return { status: "pending" };
  if (result.problem !== undefined) return result.problem;
  const each = result.combinations[result.combinations.length - 1]?.each;
  return each === undefined ? "The estimate has no total probability to combine with its factors." : { status: "ready", value: each };
}

export {
  BFR_PARTS,
  preciseText,
  KIND_LABELS,
  MODEL_LABELS,
  allFail,
  ccfComplete,
  ccfEventCount,
  ccfFindings,
  ccfLabelOf,
  ccfVectorLabel,
  ccfResult,
  choose,
  dirichletFactors,
  factorsText,
  inlineFactors,
  kindOf,
  marginalLaw,
  memberParameterIds,
  modelOfEstimate,
  modelText,
  pointCoefficients,
  shareFromNeeds,
  factorIdOf,
  vectorIdOf,
  withCcf,
  withTestingFlipped,
  type DaCcfCombination,
  type DaCcfLevel,
  type DaCcfMapping,
  type DaCcfResult,
  type DaCcfTemplate,
};
