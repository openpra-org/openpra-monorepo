import type {
  CcfParameterEstimation,
  DataAnalysis,
  DaCcfMethod,
  DaDataNeeds,
  DaCcfTesting,
  DaSourceEntry,
} from "interfaces-mef-types/da/data-analysis";
import {
  canonicalJson,
  expressionReferences,
  lawBounds,
  modelArguments,
  unitBounds,
  type CcfFactorModel,
  type Law,
  type UncertainExpression,
  type UncertainValue,
  type UncertainVector,
} from "interfaces-mef-types/core/uncertainty";
import type { UncertaintyLawSummary } from "interfaces-shared-types/newly-developed-methods/shared";
import { uncertaintyVersion, type UncertaintyState } from "../newly-developed-methods/shared/useUncertainty";
import { expressionText, numberText } from "../newly-developed-methods/shared/uncertainText";
import { componentUnit, expressionSpread, lawParameter, lawSummary, parameterPoint, pointState, type DaSpread } from "./daLaws";
import type { DaFindingSeverity, DaNeedFinding } from "./daSelectors";

const RANK: Record<DaFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const MGL_LETTERS: readonly string[] = ["β", "γ", "δ"];

const MODEL_TEXT: Record<CcfFactorModel["model"], string> = {
  BETA_FACTOR: "beta factor",
  MGL: "multiple Greek letter",
  ALPHA_FACTOR: "alpha factor",
  PHI_FACTOR: "phi factor",
};

const MODEL_LABELS: Record<CcfFactorModel["model"], string> = {
  BETA_FACTOR: "Beta factor",
  MGL: "Multiple Greek letter",
  ALPHA_FACTOR: "Alpha factor",
  PHI_FACTOR: "Phi factor",
};

const TESTING_TEXT: Record<DaCcfTesting, string> = {
  STAGGERED: "staggered",
  NON_STAGGERED: "non-staggered",
};

interface DaCcfTemplate {
  sourceId: string;
  code: string;
  component: string;
  failureMode: string;
  table: string;
  sizes: number[];
}

interface DaCcfLevel {
  k: number;
  label: string;
  law?: Law;
  priorLaw?: Law;
  expression?: UncertainExpression;
  mean?: number;
  p05?: number;
  p95?: number;
  prior?: number;
}

interface DaCcfCombination {
  k: number;
  count: number;
  coefficient: number;
  each?: number;
}

interface DaCcfResult {
  size?: number;
  testing: DaCcfTesting;
  method?: DaCcfMethod;
  qt?: number;
  qtFrom?: "PARAMETER" | "SY";
  template?: DaCcfTemplate;
  prior?: number[];
  counts?: number[];
  posterior?: number[];
  factors?: CcfFactorModel;
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

function entryBeta(entry: DaSourceEntry | undefined): { alpha: number; beta: number } | undefined {
  const law = entry?.law;
  if (law === undefined || law.family !== "BETA") return undefined;
  return law.lower === 0 && law.upper === 1 && law.alpha > 0 && law.beta > 0 ? { alpha: law.alpha, beta: law.beta } : undefined;
}

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

function templateParts(id: string): { code: string; size: number; order: number } | undefined {
  const parts = id.split("-");
  const last = parts[parts.length - 1] ?? "";
  const before = parts[parts.length - 2] ?? "";
  if (parts.length < 3 || !last.startsWith("A") || !before.startsWith("C")) return undefined;
  const order = Number(last.slice(1));
  const size = Number(before.slice(1));
  if (!Number.isInteger(order) || !Number.isInteger(size) || order < 1 || size < 2 || order > size) return undefined;
  return { code: parts.slice(0, -2).join("-"), size, order };
}

function baseFailureMode(text: string): string {
  const cut = text.indexOf(", CCCG");
  return cut === -1 ? text : text.slice(0, cut);
}

function ccfTemplates(sourceId: string, entries: readonly DaSourceEntry[]): DaCcfTemplate[] {
  const found = new Map<string, { template: DaCcfTemplate; orders: Map<number, Set<number>> }>();
  for (const entry of entries) {
    const parts = templateParts(entry.id);
    if (parts === undefined || entryBeta(entry) === undefined) continue;
    let record = found.get(parts.code);
    if (record === undefined) {
      record = { template: { sourceId, code: parts.code, component: entry.component, failureMode: baseFailureMode(entry.failureMode), table: entry.table ?? "", sizes: [] }, orders: new Map() };
      found.set(parts.code, record);
    }
    const orders = record.orders.get(parts.size) ?? new Set<number>();
    orders.add(parts.order);
    record.orders.set(parts.size, orders);
  }
  return [...found.values()].map(({ template, orders }) => ({
    ...template,
    sizes: [...orders.entries()].filter(([size, seen]) => seen.size === size).map(([size]) => size).sort((a, b) => a - b),
  })).filter((template) => template.sizes.length > 0);
}

function templateEntryIds(code: string, size: number): string[] {
  return Array.from({ length: size }, (_, index) => `${code}-C${size}-A${index + 1}`);
}

function testingOf(estimate: CcfParameterEstimation): DaCcfTesting {
  return estimate.testing ?? "NON_STAGGERED";
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

function vectorLaws(vector: UncertainVector): Law[] | string {
  if (vector.node === "PARAMETER") return "A vector held in another workbook cannot be read here. Type the factors.";
  const law = vector.law;
  if (law.family === "FIXED") return law.values.map((value) => ({ family: "POINT", value }));
  return law.concentrations.map((_, index) => marginalLaw(law.concentrations, index));
}

function shapeProblem(factors: CcfFactorModel, size: number): string | undefined {
  switch (factors.model) {
    case "BETA_FACTOR":
      return undefined;
    case "MGL":
      return factors.factors.length === 0 || factors.factors.length > size - 1 ? `A group of ${size} takes 1 to ${size - 1} MGL factors.` : undefined;
    case "ALPHA_FACTOR": {
      const laws = vectorLaws(factors.alphas);
      if (typeof laws === "string") return laws;
      return laws.length === size ? undefined : `A group of ${size} takes ${size} alpha factors.`;
    }
    case "PHI_FACTOR": {
      const laws = vectorLaws(factors.phis);
      if (typeof laws === "string") return laws;
      return laws.length === 0 || laws.length > size ? `A group of ${size} takes 1 to ${size} phi factors.` : undefined;
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

function levelStates(factors: CcfFactorModel, prior: readonly number[] | undefined): UncertaintyState<DaCcfLevel>[] | string {
  switch (factors.model) {
    case "BETA_FACTOR":
      return [spreadLevel({ k: 1, label: "β", expression: factors.beta }, expressionSpread(factors.beta, "FRACTION"))];
    case "MGL":
      return factors.factors.map((factor, index) => spreadLevel({ k: index + 1, label: MGL_LETTERS[index] ?? `ρ${index + 2}`, expression: factor }, expressionSpread(factor, "FRACTION")));
    case "ALPHA_FACTOR":
    case "PHI_FACTOR": {
      const vector = factors.model === "ALPHA_FACTOR" ? factors.alphas : factors.phis;
      const letter = factors.model === "ALPHA_FACTOR" ? "α" : "φ";
      const laws = vectorLaws(vector);
      if (typeof laws === "string") return laws;
      return laws.map((law, index) => withPrior(summaryLevel({ k: index + 1, label: `${letter}${index + 1}`, law }, lawSummary("FRACTION", law, true)), prior === undefined ? undefined : marginalLaw(prior, index)));
    }
  }
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
  }
}

function templateGamma(da: DataAnalysis, estimate: CcfParameterEstimation, size: number): { gamma?: number[]; template?: DaCcfTemplate; problem?: string } {
  const source = (da.sources ?? []).find((candidate) => candidate.id === estimate.priorSourceId);
  const code = estimate.priorTemplate;
  if (source === undefined || code === undefined || blank(code)) return { problem: "Choose the published factors the estimate starts from." };
  const entries = new Map(source.entries.map((entry) => [entry.id, entry]));
  const rows = templateEntryIds(code, size).map((id) => entries.get(id));
  const first = rows[0];
  if (rows.some((row) => row === undefined) || first === undefined) return { problem: `${code} has no alpha factors stored for a group of ${size}. Pick the template again to store them.` };
  const gamma: number[] = [];
  for (const row of rows) {
    const beta = entryBeta(row);
    if (beta === undefined) return { problem: `${row?.id ?? code} has no beta law to rebuild the factors from.` };
    gamma.push(beta.alpha);
  }
  return { gamma, template: { sourceId: source.id, code, component: first.component, failureMode: baseFailureMode(first.failureMode), table: first.table ?? "", sizes: [size] } };
}

function evidenceCounts(estimate: CcfParameterEstimation, size: number): { counts: number[]; problem?: string } {
  const counts = Array.from({ length: size }, () => 0);
  for (const evidence of estimate.evidence ?? []) {
    if (!evidence.included) continue;
    const what = blank(evidence.label) ? evidence.id : evidence.label ?? evidence.id;
    if (!(evidence.population > 0)) return { counts, problem: `${what}: enter how many components the population had.` };
    if (!(evidence.independentFailures >= 0)) return { counts, problem: `${what}: the independent failures cannot be negative.` };
    counts[0] = (counts[0] ?? 0) + (evidence.independentFailures * size) / evidence.population;
    for (const event of evidence.events) {
      if (!event.included) continue;
      if (event.impact.length !== size) return { counts, problem: `${what} · ${event.id}: the impact vector needs ${size} values, one for each number of failed components.` };
      if (event.impact.some((value) => !(value >= 0 && value <= 1)) || sum(event.impact) > 1 + 1e-9) return { counts, problem: `${what} · ${event.id}: each impact value lies between 0 and 1, and together they add to at most 1.` };
      event.impact.forEach((value, index) => { counts[index] = (counts[index] ?? 0) + value; });
    }
  }
  return { counts };
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

function finish(base: DaCcfResult, factors: CcfFactorModel, size: number): DaCcfResult {
  const shaped = shapeProblem(factors, size);
  const withFactors: DaCcfResult = { ...base, factors };
  if (shaped !== undefined) return { ...withFactors, problem: shaped };
  const states = levelStates(factors, base.method === "BAYES" ? base.prior : undefined);
  if (typeof states === "string") return { ...withFactors, problem: states };
  const failed = states.find((state) => state.status === "failed");
  if (failed?.status === "failed") return { ...withFactors, problem: `PRAXIS could not compute the factors: ${failed.error}` };
  const levels = states.flatMap((state) => (state.status === "ready" ? [state.value] : []));
  if (levels.length < states.length) return { ...withFactors, pending: true };
  const points = levels.map((level) => level.mean ?? 0);
  const coefficients = pointCoefficients(factors, points, size);
  if (typeof coefficients === "string") return { ...withFactors, levels, problem: coefficients };
  const qt = base.qt;
  return { ...withFactors, levels, combinations: coefficients.map((coefficient, index) => ({ k: index + 1, count: choose(size, index + 1), coefficient, ...(qt === undefined ? {} : { each: coefficient * qt }) })) };
}

function computeResult(da: DataAnalysis, estimate: CcfParameterEstimation): DaCcfResult {
  const size = estimate.groupSize;
  const testing = testingOf(estimate);
  const method = estimate.method;
  const total = qtOf(da, estimate);
  const base: DaCcfResult = { size, testing, method, qt: total.qt, qtFrom: total.from, levels: [], combinations: [], pending: total.pending };
  if (size === undefined || !Number.isInteger(size) || size < 2) return { ...base, problem: "Enter the group size, two or more components." };
  if (method === undefined) return { ...base, problem: "Choose how the factors are found." };
  if (method === "TYPED") {
    if (estimate.factors === undefined) return { ...base, problem: "Type the factors for the model and group size." };
    return finish(base, estimate.factors, size);
  }
  const prior = templateGamma(da, estimate, size);
  if (prior.gamma === undefined) return { ...base, problem: prior.problem };
  const gamma = prior.gamma;
  const evidence = method === "BAYES" ? evidenceCounts(estimate, size) : { counts: Array.from({ length: size }, () => 0) };
  if (evidence.problem !== undefined) return { ...base, template: prior.template, prior: gamma, problem: evidence.problem };
  const posterior = gamma.map((value, index) => value + (evidence.counts[index] ?? 0));
  return finish({ ...base, template: prior.template, prior: gamma, counts: evidence.counts, posterior }, dirichletFactors(posterior, testing), size);
}

function sameFactors(left: CcfFactorModel | undefined, right: CcfFactorModel | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return canonicalJson(left) === canonicalJson(right);
}

function withCcf(da: DataAnalysis): DataAnalysis {
  const estimates = da.ccfParameterEstimations;
  if (estimates === undefined) return da;
  let changed = false;
  const next = estimates.map((estimate) => {
    if (estimate.method !== "PRIOR" && estimate.method !== "BAYES") return estimate;
    const factors = ccfResult(da, estimate).factors;
    if (factors === undefined || sameFactors(estimate.factors, factors)) return estimate;
    changed = true;
    return { ...estimate, factors };
  });
  return changed ? { ...da, ccfParameterEstimations: next } : da;
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

function scalarFactors(factors: CcfFactorModel): UncertainExpression[] {
  if (factors.model === "BETA_FACTOR") return [factors.beta];
  return factors.model === "MGL" ? factors.factors : [];
}

function outOfRange(factors: CcfFactorModel): boolean {
  const domain = unitBounds("FRACTION");
  return scalarFactors(factors).flatMap(valueNodes).some((value) => {
    const bounds = lawBounds(value.law);
    return !(bounds.lower >= domain.lower && bounds.upper <= domain.upper);
  });
}

function modelText(factors: CcfFactorModel): string {
  return MODEL_TEXT[factors.model];
}

function vectorText(vector: UncertainVector): string {
  if (vector.node === "PARAMETER") return `linked to ${vector.reference.entityId}`;
  const law = vector.law;
  return law.family === "DIRICHLET" ? `Dirichlet(${law.concentrations.map(numberText).join(", ")})` : `fixed ${law.values.map(numberText).join(", ")}`;
}

function factorsText(factors: CcfFactorModel): string {
  switch (factors.model) {
    case "BETA_FACTOR":
      return `${MODEL_LABELS.BETA_FACTOR}, β ${expressionText(factors.beta)}`;
    case "MGL":
      return `${MODEL_LABELS.MGL}, ${factors.factors.map((factor, index) => `${MGL_LETTERS[index] ?? `ρ${index + 2}`} ${expressionText(factor)}`).join(", ")}`;
    case "ALPHA_FACTOR":
      return `${MODEL_LABELS.ALPHA_FACTOR}, ${TESTING_TEXT[factors.testing]}, ${vectorText(factors.alphas)}`;
    case "PHI_FACTOR":
      return `${MODEL_LABELS.PHI_FACTOR}, ${vectorText(factors.phis)}`;
  }
}

function estimateFindings(da: DataAnalysis, estimate: CcfParameterEstimation, check: DaCcfCheck): void {
  const findings = check.findings;
  const item = estimate.uuid;
  const group = { kind: "daCcfGroup" as const, id: estimate.uuid };
  const factors = { kind: "daCcfFactors" as const, id: estimate.uuid };
  const events = { kind: "daCcfEvents" as const, id: estimate.uuid };
  const result = ccfResult(da, estimate);
  if (result.pending) check.pending = true;
  const size = estimate.groupSize;
  const operating = da.plantStage === "OPERATIONAL";
  const ccTwo = da.capabilityCategory !== "CC-I";
  const needs = da.dataNeeds;
  const share = shareFromNeeds(da, estimate);
  if (blank(estimate.ccfGroupReference)) findings.push({ severity: "error", check: "No group", item, detail: "Name the Systems Analysis group this estimate serves.", target: group });
  else if (needs !== undefined && needs.ccfGroups.length > 0 && share === undefined) findings.push({ severity: "warning", check: "Group not imported", item, detail: `${estimate.ccfGroupReference} is not among the common cause groups imported in Step 02.`, target: group });
  if (share !== undefined && size !== undefined && share.members.length !== size) findings.push({ severity: "error", check: "Size differs", item, detail: `Systems Analysis gives ${estimate.ccfGroupReference} ${share.members.length} members, but the estimate is for a group of ${size}.`, target: group });
  if (share !== undefined && share.parameterIds.length > 1) findings.push({ severity: "error", check: "Members differ", item, detail: `The members map to ${share.parameterIds.join(", ")}. A group shares one independent estimate, its total failure probability (DA-D8).`, target: group });
  if (estimate.memberParameterId !== undefined && share !== undefined && share.parameterIds.length === 1 && share.parameterIds[0] !== estimate.memberParameterId) findings.push({ severity: "warning", check: "Members' parameter", item, detail: `The members map to ${share.parameterIds[0] ?? "?"}, but the estimate takes its total from ${estimate.memberParameterId}.`, target: group });
  if (estimate.memberParameterId === undefined && (share === undefined || share.parameterIds.length === 0)) findings.push({ severity: "warning", check: "No total", item, detail: "Pick the parameter the members share, so each combination can be computed.", target: group });
  if (size !== undefined && size > 4 && blank(estimate.estimateReason)) findings.push({ severity: "warning", check: "Large group", item, detail: `Say why a group of ${size} is modeled. Groups above four rarely have data behind them.`, target: factors });
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
    findings.push({ severity: "error", check: "No method", item, detail: "Choose the published factors as they are, an update with events, or typed factors.", target: factors });
    return;
  }
  if (method === "TYPED") {
    const typed = estimate.factors;
    if (result.problem !== undefined) findings.push({ severity: "error", check: "Cannot use", item, detail: result.problem, target: factors });
    if (typed !== undefined && outOfRange(typed)) findings.push({ severity: "error", check: "Out of range", item, detail: "Each factor lies between 0 and 1. Truncate a law that leaves that range.", target: factors });
    if (typed?.model === "ALPHA_FACTOR" && estimate.testing !== undefined && typed.testing !== estimate.testing) findings.push({ severity: "warning", check: "Testing differs", item, detail: `The typed alpha factors are for ${TESTING_TEXT[typed.testing]} testing, but the group is tested ${TESTING_TEXT[estimate.testing]}.`, target: factors });
    if (typed?.model === "BETA_FACTOR" && ccTwo && estimate.isRiskSignificant === true && size !== undefined && size > 2) findings.push({ severity: "error", check: "Model too coarse", item, detail: "A risk-significant group of more than two needs alpha factors, MGL or another multi-parameter model at Capability Category II (DA-D7).", target: factors });
    if (blank(estimate.estimateReason)) findings.push({ severity: "warning", check: "No basis", item, detail: "Say where the typed factors come from.", target: factors });
  } else {
    if (result.problem !== undefined) findings.push({ severity: "error", check: "Cannot estimate", item, detail: result.problem, target: result.prior === undefined ? factors : events });
    if (blank(estimate.priorReason)) findings.push({ severity: "warning", check: "No template reason", item, detail: "Say why the template's component and failure mode fit the members (DA-D8).", target: factors });
    const code = estimate.priorTemplate ?? "";
    const rateMember = member?.quantificationModel === "RUNNING_RATE" || member?.quantificationModel === "STANDBY_RATE" || member?.quantificationModel === "MISSION_PROBABILITY";
    const demandMember = member?.quantificationModel === "DEMAND_PROBABILITY";
    if (blank(estimate.priorReason) && ((code === "CCF-DEM" && rateMember) || (code === "CCF-RATE" && demandMember))) findings.push({ severity: "warning", check: "Failure type differs", item, detail: `The members fail ${demandMember ? "on demand" : "over time"}, but ${code} pools ${code === "CCF-DEM" ? "demand" : "rate"} failures.`, target: factors });
    if (result.prior !== undefined && size !== undefined) {
      const source = (da.sources ?? []).find((candidate) => candidate.id === estimate.priorSourceId);
      const totals = templateEntryIds(code, size).flatMap((id) => {
        const beta = entryBeta(source?.entries.find((entry) => entry.id === id));
        return beta === undefined ? [] : [beta.alpha + beta.beta];
      });
      const spread = totals.length > 0 ? (Math.max(...totals) - Math.min(...totals)) / Math.max(...totals) : 0;
      if (spread > 0.02) findings.push({ severity: "note", check: "Marginals disagree", item, detail: `The printed marginals imply totals that differ by ${Math.round(spread * 100)}%, so the rebuilt factors are approximate.`, target: factors });
    }
    const included = (estimate.evidence ?? []).filter((evidence) => evidence.included);
    if (method === "PRIOR" && included.length > 0) findings.push({ severity: ccTwo ? "error" : "warning", check: "Events not used", item, detail: "Events are in the update but the published factors are used as they are. Update them (DA-D8).", target: factors });
    if (method === "BAYES" && included.length === 0) findings.push({ severity: "note", check: "Nothing to update", item, detail: "No events are in the update, so the factors equal the published ones.", target: events });
    if (included.length > 0 && estimate.genericExclusionConsistencyConfirmed !== true) findings.push({ severity: "warning", check: "Exclusions not confirmed", item, detail: "Confirm that every event left out of the independent data is left out of the common cause events too (DA-D9).", target: factors });
    if (included.length > 0 && estimate.genericExclusionConsistencyConfirmed === true && blank(estimate.genericExclusionConsistencyBasis)) findings.push({ severity: "warning", check: "No exclusion basis", item, detail: "Say how the exclusions were matched (DA-D9).", target: factors });
    if (ccTwo && operating && included.length === 0) findings.push({ severity: "note", check: "Plant experience", item, detail: "At Capability Category II, update the published factors with plant experience where it exists (DA-D8).", target: events });
  }
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
  const ours = method === "TYPED" ? estimate.factors : result.factors;
  const theirs = share?.factors;
  if (ours !== undefined && theirs !== undefined && !sameFactors(ours, theirs)) findings.push({ severity: "warning", check: "SY differs", item, detail: `Systems Analysis holds other ${modelText(theirs)} factors. Apply the DA values in SY Step 04.`, target: factors });
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
  return (estimate.evidence ?? []).reduce((total, evidence) => total + evidence.events.length, 0);
}

function withTestingFlipped(estimate: CcfParameterEstimation, testing: DaCcfTesting): CcfParameterEstimation | string {
  if (estimate.method === "PRIOR" || estimate.method === "BAYES") return { ...estimate, testing };
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
  allFail,
  ccfComplete,
  ccfEventCount,
  ccfFindings,
  ccfResult,
  ccfTemplates,
  choose,
  dirichletFactors,
  factorsText,
  marginalLaw,
  memberParameterIds,
  MODEL_LABELS,
  modelText,
  pointCoefficients,
  shareFromNeeds,
  templateEntryIds,
  templateParts,
  withCcf,
  withTestingFlipped,
  type DaCcfCombination,
  type DaCcfLevel,
  type DaCcfResult,
  type DaCcfTemplate,
};
