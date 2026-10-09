import { DistributionType, type ParameterDistribution } from "interfaces-mef-types/core/events";
import type {
  DataAnalysis,
  DataAnalysisParameter,
  DaSensitivityCase,
  DaUncertaintySource,
} from "interfaces-mef-types/da/data-analysis";
import { canonicalJson, type UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { uncertaintyVersion, type UncertaintyState } from "../newly-developed-methods/shared/useUncertainty";
import { familyText } from "../newly-developed-methods/shared/uncertainText";
import { distributionMean, distributionQuantile, distributionVariance, validDistribution } from "./daDistributions";
import { hasSpread, isFailureParameter, parameterEstimate, withEstimates } from "./daFailures";
import { componentUnit, lawParameter, parameterPoint, parameterSpread, pointState } from "./daLaws";
import { isMaintenanceParameter, maintenanceEstimate, withUnavailability } from "./daUnavailability";
import { frequencyEstimate, isFrequencyParameter, withFrequencies } from "./daFrequencies";
import { allFail, withCcf, withTestingFlipped } from "./daCcf";
import type { DaFindingSeverity, DaNeedFinding } from "./daSelectors";

const RANK: Record<DaFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const WIDE = 100;

interface DaDistributionSummary {
  parameter: DataAnalysisParameter;
  distribution?: ParameterDistribution;
  expression?: UncertainExpression;
  family: string;
  mean?: number;
  p05?: number;
  median?: number;
  p95?: number;
  errorFactor?: number;
  cv?: number;
  meanGap?: number;
  sampled?: boolean;
  pending?: boolean;
  problem?: string;
}

interface DaCorrelationGroup {
  parameter: DataAnalysisParameter;
  events: { id: string; code: string; name: string }[];
  estimates: string[];
  draws: number;
  pairFactor?: number;
}

interface DaSensitivityResult {
  item: DaSensitivityCase;
  label: string;
  unit: string;
  base?: number;
  low?: number;
  high?: number;
  pending?: boolean;
  problem?: string;
}

interface DaVersioned<T> {
  version: number;
  value: T;
}

const summaryCache = new WeakMap<DataAnalysis, DaVersioned<Map<string, DaDistributionSummary>>>();

const groupCache = new WeakMap<DataAnalysis, DaVersioned<DaCorrelationGroup[]>>();

const sensitivityCache = new WeakMap<DataAnalysis, DaVersioned<Map<string, DaSensitivityResult>>>();

const findingCache = new WeakMap<DataAnalysis, DaVersioned<{ findings: DaNeedFinding[]; pending: boolean }>>();

function versioned<T>(cache: WeakMap<DataAnalysis, DaVersioned<T>>, da: DataAnalysis, make: () => T): T {
  const version = uncertaintyVersion();
  const cached = cache.get(da);
  if (cached !== undefined && cached.version === version) return cached.value;
  const value = make();
  cache.set(da, { version, value });
  return value;
}

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function familyOf(distribution: ParameterDistribution | undefined): string {
  if (distribution === undefined) return "None";
  switch (distribution.type) {
    case DistributionType.GAMMA: return "Gamma";
    case DistributionType.BETA: return "Beta";
    case DistributionType.LOGNORMAL: return "Lognormal";
    case DistributionType.NORMAL: return "Normal";
    case DistributionType.UNIFORM: return "Uniform";
    case DistributionType.WEIBULL: return "Weibull";
    case DistributionType.EXPONENTIAL: return "Exponential";
    case DistributionType.POINT_ESTIMATE: return "Point";
    default: return "Other";
  }
}

function expressionFamily(expression: UncertainExpression): string {
  switch (expression.node) {
    case "VALUE":
      return familyText(expression.value.law.family);
    case "PARAMETER":
      return "Linked estimate";
    case "OPERATION":
      return "Combination";
    case "MODEL":
      return expression.model.form === "MISSION" ? "Mission model" : expression.model.form === "STANDBY" ? "Standby model" : expression.model.form === "REPAIRABLE" ? "Repairable model" : "Weibull model";
  }
}

function componentSummary(parameter: DataAnalysisParameter): DaDistributionSummary {
  const expression = parameter.estimate;
  const base: DaDistributionSummary = { parameter, expression, family: expression === undefined ? "None" : expressionFamily(expression) };
  const state = parameterSpread(parameter);
  if (state === undefined) return base;
  if (state.status === "pending") return { ...base, pending: true };
  if (state.status === "failed") return { ...base, problem: state.error };
  const { mean, standardDeviation, p05, median, p95, sampled } = state.value;
  const errorFactor = p95 !== undefined && median !== undefined && median > 0 ? p95 / median : undefined;
  const cv = mean > 0 && standardDeviation !== undefined ? standardDeviation / mean : undefined;
  return { ...base, mean, p05, median, p95, errorFactor, cv, sampled };
}

function computeSummary(parameter: DataAnalysisParameter): DaDistributionSummary {
  if (lawParameter(parameter)) return componentSummary(parameter);
  const distribution = parameter.uncertainty?.distribution;
  const base: DaDistributionSummary = { parameter, distribution, family: familyOf(distribution) };
  if (distribution === undefined) return base;
  if (!validDistribution(distribution)) return { ...base, problem: "The distribution's parameters are not valid." };
  const mean = distributionMean(distribution);
  const p05 = distributionQuantile(distribution, 0.05);
  const median = distributionQuantile(distribution, 0.5);
  const p95 = distributionQuantile(distribution, 0.95);
  const variance = distributionVariance(distribution);
  const errorFactor = p95 !== undefined && median !== undefined && median > 0 ? p95 / median : undefined;
  const cv = mean !== undefined && mean > 0 && variance !== undefined ? Math.sqrt(variance) / mean : undefined;
  const meanGap = mean !== undefined && parameter.value !== undefined && parameter.value > 0 ? Math.abs(mean - parameter.value) / parameter.value : undefined;
  return { ...base, mean, p05, median, p95, errorFactor, cv, meanGap };
}

function distributionSummary(da: DataAnalysis, parameter: DataAnalysisParameter): DaDistributionSummary {
  const byParameter = versioned(summaryCache, da, () => new Map<string, DaDistributionSummary>());
  const cached = byParameter.get(parameter.uuid);
  if (cached !== undefined) return cached;
  const summary = computeSummary(parameter);
  byParameter.set(parameter.uuid, summary);
  return summary;
}

function correlationGroups(da: DataAnalysis): DaCorrelationGroup[] {
  return versioned(groupCache, da, () => computeGroups(da));
}

function computeGroups(da: DataAnalysis): DaCorrelationGroup[] {
  const events = da.dataNeeds?.basicEvents ?? [];
  const groups = da.parameters.flatMap((parameter): DaCorrelationGroup[] => {
    const members = events.filter((need) => need.included && (need.parameterId ?? (need.valueHeldBy === "DA" ? need.valueHolderId : undefined)) === parameter.uuid).map((need) => ({ id: need.id, code: need.code, name: need.name }));
    const estimates = (da.ccfParameterEstimations ?? []).filter((estimate) => estimate.memberParameterId === parameter.uuid).map((estimate) => estimate.uuid);
    const draws = members.length + estimates.length;
    if (draws < 2) return [];
    const cv = distributionSummary(da, parameter).cv;
    return [{ parameter, events: members, estimates, draws, pairFactor: cv === undefined ? undefined : 1 + cv * cv }];
  });
  return groups;
}

function pipeline(da: DataAnalysis): DataAnalysis {
  return withCcf(withFrequencies(withUnavailability(withEstimates(da))));
}

function withParameter(da: DataAnalysis, id: string, change: (parameter: DataAnalysisParameter) => DataAnalysisParameter): DataAnalysis {
  return { ...da, parameters: da.parameters.map((parameter) => (parameter.uuid === id ? change(parameter) : parameter)) };
}

function factorsAt(parameter: DataAnalysisParameter, useId: string, pick: "low" | "high"): DataAnalysisParameter {
  return { ...parameter, sourceUses: (parameter.sourceUses ?? []).map((use) => (use.id === useId ? { ...use, factors: (use.factors ?? []).map((factor) => ({ ...factor, nominal: factor[pick] })) } : use)) };
}

function componentAfter(da: DataAnalysis, parameter: DataAnalysisParameter): UncertaintyState<number> | undefined {
  const unit = componentUnit(parameter);
  if (unit === undefined) return undefined;
  const estimate = isFailureParameter(parameter) ? parameterEstimate(da, parameter) : isMaintenanceParameter(parameter) ? maintenanceEstimate(da, parameter) : isFrequencyParameter(parameter) && parameter.valueMode === "CALCULATED" ? frequencyEstimate(da, parameter) : undefined;
  if (estimate === undefined) return parameter.estimate === undefined ? undefined : pointState(parameter.estimate, unit);
  if (estimate.pending) return { status: "pending" };
  if (estimate.problem !== undefined || estimate.estimate === undefined) return undefined;
  return pointState(estimate.estimate, unit);
}

function valueAfter(da: DataAnalysis, id: string): UncertaintyState<number> | undefined {
  const parameter = da.parameters.find((candidate) => candidate.uuid === id);
  if (parameter === undefined) return undefined;
  if (lawParameter(parameter)) return componentAfter(da, parameter);
  const value = pipeline(da).parameters.find((candidate) => candidate.uuid === id)?.value;
  return value === undefined ? undefined : { status: "ready", value };
}

function settledRange(base: DaSensitivityResult, first: UncertaintyState<number> | undefined, second: UncertaintyState<number> | undefined, problem: string): DaSensitivityResult {
  if (first?.status === "pending" || second?.status === "pending") return { ...base, pending: true };
  if (first?.status !== "ready" || second?.status !== "ready") return { ...base, problem: first?.status === "failed" ? first.error : second?.status === "failed" ? second.error : problem };
  return { ...base, low: Math.min(first.value, second.value), high: Math.max(first.value, second.value) };
}

function computeSensitivity(da: DataAnalysis, item: DaSensitivityCase): DaSensitivityResult {
  if (item.kind === "TESTING") {
    const estimate = (da.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === item.estimateId);
    const base: DaSensitivityResult = { item, label: estimate === undefined ? item.estimateId ?? "?" : `${estimate.uuid} · ${estimate.name ?? estimate.ccfGroupReference}`, unit: "all members failing, each" };
    if (estimate === undefined) return { ...base, problem: "Pick the common cause estimate the case changes." };
    if (item.testing === undefined) return { ...base, problem: "Pick the other testing scheme." };
    const flipped = withTestingFlipped(estimate, item.testing);
    if (typeof flipped === "string") return { ...base, problem: flipped };
    const before = allFail(da, estimate);
    const changed = pipeline({ ...da, ccfParameterEstimations: (da.ccfParameterEstimations ?? []).map((candidate) => (candidate.uuid === estimate.uuid ? flipped : candidate)) });
    const after = allFail(changed, (changed.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === estimate.uuid) ?? flipped);
    if (typeof before === "string") return { ...base, problem: before };
    if (typeof after === "string") return { ...base, problem: after };
    const range = settledRange(base, before, after, "The estimate cannot be recomputed with that testing scheme.");
    return before.status === "ready" ? { ...range, base: before.value } : range;
  }
  const parameter = da.parameters.find((candidate) => candidate.uuid === item.parameterId);
  const point = parameter === undefined ? undefined : parameterPoint(parameter);
  const label = parameter === undefined ? item.parameterId ?? "?" : `${parameter.uuid} · ${parameter.name}`;
  const unit = parameter?.parameterType === "FREQUENCY" ? "per plant-year" : parameter?.parameterType === "FAILURE_RATE" ? "per hour" : "probability";
  const base: DaSensitivityResult = { item, label, unit, base: point?.status === "ready" ? point.value : undefined };
  if (parameter === undefined) return { ...base, problem: "Pick the parameter the case changes." };
  if (point?.status === "pending" && item.kind !== "RANGE") return { ...base, pending: true };
  if (item.kind === "RANGE") {
    if (item.low === undefined || item.high === undefined) return { ...base, problem: "Type the low and high values." };
    if (!(item.low <= item.high)) return { ...base, problem: "The low value is above the high value." };
    return { ...base, low: item.low, high: item.high };
  }
  if (parameter.valueMode !== "CALCULATED") return { ...base, problem: "Only a calculated parameter can be recomputed with another input." };
  if (item.kind === "FACTOR") {
    const use = (parameter.sourceUses ?? []).find((candidate) => candidate.id === item.useId);
    if (use === undefined) return { ...base, problem: "Pick the source use whose factors go to their bounds." };
    if (use.verdict !== "SCALED" || (use.factors ?? []).length === 0) return { ...base, problem: "That source use has no transfer factors." };
    const low = valueAfter(withParameter(da, parameter.uuid, (candidate) => factorsAt(candidate, use.id, "low")), parameter.uuid);
    const high = valueAfter(withParameter(da, parameter.uuid, (candidate) => factorsAt(candidate, use.id, "high")), parameter.uuid);
    return settledRange(base, low, high, "The estimate cannot be recomputed at the factor bounds.");
  }
  const current: UncertaintyState<number> | undefined = base.base === undefined ? undefined : { status: "ready", value: base.base };
  if (item.kind === "PRIOR_FORM") {
    if (item.priorForm === undefined) return { ...base, problem: "Pick the other prior form." };
    const form = item.priorForm;
    const changed = withParameter(da, parameter.uuid, (candidate) => (candidate.frequency === undefined ? { ...candidate, priorForm: form } : { ...candidate, frequency: { ...candidate.frequency, parts: candidate.frequency.parts.map((part) => ({ ...part, priorForm: form })) } }));
    return settledRange(base, current, valueAfter(changed, parameter.uuid), "The estimate cannot be recomputed with that prior form.");
  }
  const useId = item.useId;
  const use = (parameter.sourceUses ?? []).find((candidate) => candidate.id === useId);
  if (useId === undefined || use === undefined) return { ...base, problem: "Pick the other source." };
  const parts = parameter.frequency?.parts ?? [];
  if (parameter.frequency !== undefined && parts.length !== 1) return { ...base, problem: "A source case changes a frequency built from one part only." };
  const changed = withParameter(da, parameter.uuid, (candidate) => (candidate.frequency === undefined ? { ...candidate, priorUseId: useId } : { ...candidate, frequency: { ...candidate.frequency, parts: candidate.frequency.parts.map((part) => ({ ...part, useId })) } }));
  return settledRange(base, current, valueAfter(changed, parameter.uuid), "The estimate cannot be recomputed from that source.");
}

function sensitivityResult(da: DataAnalysis, item: DaSensitivityCase): DaSensitivityResult {
  const byCase = versioned(sensitivityCache, da, () => new Map<string, DaSensitivityResult>());
  const cached = byCase.get(item.id);
  if (cached !== undefined) return cached;
  const result = computeSensitivity(da, item);
  byCase.set(item.id, result);
  return result;
}

function distributionFindings(da: DataAnalysis, findings: DaNeedFinding[], pending: { value: boolean }): void {
  const ccTwo = da.capabilityCategory !== "CC-I";
  for (const parameter of da.parameters) {
    const component = lawParameter(parameter);
    if (component ? parameter.estimate === undefined : parameter.value === undefined && parameter.uncertainty === undefined) continue;
    if (parameter.valueMode === "LINKED") continue;
    const item = parameter.uuid;
    const target = { kind: "daDistribution" as const, id: parameter.uuid };
    const summary = distributionSummary(da, parameter);
    if (summary.pending === true) {
      pending.value = true;
      continue;
    }
    if (summary.problem !== undefined) {
      findings.push({ severity: "error", check: "Invalid distribution", item, detail: summary.problem, target });
      continue;
    }
    const point = component ? parameter.estimate === undefined || !hasSpread(parameter.estimate) : summary.distribution === undefined || summary.distribution.type === DistributionType.POINT_ESTIMATE;
    if (point && ccTwo && parameter.isRiskSignificant === true) findings.push({ severity: "error", check: "No distribution", item, detail: "A risk-significant parameter needs a mean and a probability distribution at CC-II (DA-D3).", target });
    else if (point && blank(parameter.uncertaintyNote)) findings.push({ severity: "warning", check: "No characterization", item, detail: "Give a distribution, or say how uncertain the value is: a range, a discussion or a conservative bound (DA-D3, DA-N-26).", target });
    if (!point && !component && parameter.valueMode !== "CALCULATED" && parameter.valueType === "MEAN" && summary.meanGap !== undefined && summary.meanGap > 1e-6) findings.push({ severity: "warning", check: "Mean differs", item, detail: `The value differs from the distribution's mean by ${Number((summary.meanGap * 100).toPrecision(2))}%. The model uses the value, so they should agree.`, target });
    if (!point && !component && parameter.valueType === "POINT_ESTIMATE" && ccTwo && parameter.isRiskSignificant === true) findings.push({ severity: "warning", check: "Point value used", item, detail: "At CC-II a risk-significant parameter carries its mean (DA-D3).", target });
    if (summary.errorFactor !== undefined && summary.errorFactor > WIDE) findings.push({ severity: "note", check: "Very wide", item, detail: `The 95th percentile is ${Math.round(summary.errorFactor)} times the median. Check that the spread reflects what is known.`, target });
  }
}

function correlationFindings(da: DataAnalysis, findings: DaNeedFinding[]): void {
  const seen = new Map<string, DataAnalysisParameter>();
  for (const parameter of da.parameters) {
    if (parameter.componentGroupRef === undefined || parameter.failureModeRef === undefined || parameter.quantificationModel === undefined) continue;
    const estimate = parameter.estimate;
    const missionTime = estimate?.node === "MODEL" && estimate.model.form === "MISSION" ? estimate.model.missionTime : parameter.missionTime;
    const key = JSON.stringify([parameter.componentGroupRef, parameter.failureModeRef, parameter.quantificationModel, missionTime === undefined ? null : canonicalJson(missionTime), [...(parameter.stateIds ?? [])].sort()]);
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, parameter);
      continue;
    }
    findings.push({ severity: "warning", check: "Split population", item: parameter.uuid, detail: `${first.uuid} and ${parameter.uuid} cover the same population, failure mode and states. Their basic events draw separately in a Monte Carlo run, which loses the correlation.`, target: { kind: "daDistribution", id: parameter.uuid } });
  }
}

function registerFindings(da: DataAnalysis, findings: DaNeedFinding[]): void {
  const register = da.uncertaintyRegister ?? [];
  const parameters = new Set(da.parameters.map((parameter) => parameter.uuid));
  const estimates = new Set((da.ccfParameterEstimations ?? []).map((estimate) => estimate.uuid));
  const cases = new Set((da.sensitivityCases ?? []).map((item) => item.id));
  const assumptions = new Set((da.preOperationalAssumptions ?? []).map((assumption) => assumption.assumptionId));
  const ids = new Set<string>();
  for (const source of register) {
    const item = source.id;
    const target = { kind: "daUncertaintySource" as const, id: source.id };
    if (ids.has(source.id)) findings.push({ severity: "error", check: "Duplicate ID", item, detail: "Two register entries share this ID.", target });
    ids.add(source.id);
    if (blank(source.source)) findings.push({ severity: "error", check: "No source", item, detail: "Say what is uncertain.", target });
    if (blank(source.impact)) findings.push({ severity: "warning", check: "No impact", item, detail: "Say how the uncertainty could change the results.", target });
    if (source.parameterIds.length === 0 && (source.estimateIds ?? []).length === 0) findings.push({ severity: "warning", check: "No parameter", item, detail: "Name the parameters or common cause estimates it affects.", target });
    for (const id of source.parameterIds) if (!parameters.has(id)) findings.push({ severity: "error", check: "Parameter missing", item, detail: `${id} does not exist.`, target });
    for (const id of source.estimateIds ?? []) if (!estimates.has(id)) findings.push({ severity: "error", check: "Estimate missing", item, detail: `${id} does not exist.`, target });
    if (source.alternatives.length === 0) findings.push({ severity: "warning", check: "No alternative", item, detail: "Give at least one reasonable alternative and why it was not chosen (DA-A5).", target });
    for (const alternative of source.alternatives) if (blank(alternative.reasonNotSelected)) findings.push({ severity: "warning", check: "No reason", item, detail: `Say why "${alternative.alternative}" was not chosen.`, target });
    for (const id of source.sensitivityIds ?? []) if (!cases.has(id)) findings.push({ severity: "error", check: "Case missing", item, detail: `Sensitivity case ${id} does not exist.`, target });
    for (const id of source.assumptionIds ?? []) if (!assumptions.has(id)) findings.push({ severity: "error", check: "Assumption missing", item, detail: `Assumption ${id} does not exist.`, target });
    if (source.key && (source.sensitivityIds ?? []).length === 0) findings.push({ severity: "warning", check: "No sensitivity case", item, detail: "A key source of uncertainty needs a sensitivity case for quantification.", target });
    if (source.key && blank(source.keyReason)) findings.push({ severity: "warning", check: "No key reason", item, detail: "Say why this source is key.", target });
  }
  if (register.length === 0) findings.push({ severity: "error", check: "Empty register", item: "Register", detail: "List the sources of model uncertainty and the assumptions behind the data (DA-A5).", target: { kind: "daUncertaintySource", id: "" } });
}

function sensitivityFindings(da: DataAnalysis, findings: DaNeedFinding[], pending: { value: boolean }): void {
  const linked = new Set((da.uncertaintyRegister ?? []).flatMap((source) => source.sensitivityIds ?? []));
  const ids = new Set<string>();
  for (const item of da.sensitivityCases ?? []) {
    const target = { kind: "daSensitivity" as const, id: item.id };
    if (ids.has(item.id)) findings.push({ severity: "error", check: "Duplicate ID", item: item.id, detail: "Two cases share this ID.", target });
    ids.add(item.id);
    const result = sensitivityResult(da, item);
    if (result.pending === true) pending.value = true;
    if (result.problem !== undefined) findings.push({ severity: "error", check: "Cannot compute", item: item.id, detail: result.problem, target });
    if (blank(item.reason)) findings.push({ severity: "warning", check: "No reason", item: item.id, detail: "Say what the case tests and why.", target });
    if (!linked.has(item.id)) findings.push({ severity: "note", check: "Not in the register", item: item.id, detail: "No register entry points at this case.", target });
  }
}

function assumptionFindings(da: DataAnalysis, findings: DaNeedFinding[]): void {
  const operating = da.plantStage === "OPERATIONAL";
  const known = new Set([...da.parameters.map((parameter) => parameter.uuid), ...(da.ccfParameterEstimations ?? []).map((estimate) => estimate.uuid)]);
  const registered = new Set((da.uncertaintyRegister ?? []).flatMap((source) => source.assumptionIds ?? []));
  for (const assumption of da.preOperationalAssumptions ?? []) {
    const item = assumption.assumptionId;
    const target = { kind: "daAssumption" as const, id: assumption.assumptionId };
    if (blank(assumption.description)) findings.push({ severity: "error", check: "No description", item, detail: "Say what is assumed.", target });
    for (const id of assumption.affectedElementIds) if (!known.has(id)) findings.push({ severity: "warning", check: "Parameter missing", item, detail: `${id} is not a DA parameter or common cause estimate.`, target });
    if (assumption.affectedElementIds.length === 0) findings.push({ severity: "note", check: "No parameter", item, detail: "Name the parameters the assumption touches.", target });
    if (operating && assumption.status !== "CLOSED" && !registered.has(assumption.assumptionId)) findings.push({ severity: "warning", check: "Open at operation", item, detail: "The plant operates. Close the assumption with as-built and as-operated data, or move it into the register (DA-N-4).", target });
    if (!operating && assumption.status !== "CLOSED" && blank(assumption.closureBasis) && assumption.plannedClosureActions.length === 0) findings.push({ severity: "warning", check: "No closure plan", item, detail: "Say how and when the assumption will be closed (DA-A6, DA-E3).", target });
  }
}

function uncertaintyCheck(da: DataAnalysis): { findings: DaNeedFinding[]; pending: boolean } {
  return versioned(findingCache, da, () => {
    const findings: DaNeedFinding[] = [];
    const pending = { value: false };
    distributionFindings(da, findings, pending);
    correlationFindings(da, findings);
    registerFindings(da, findings);
    sensitivityFindings(da, findings, pending);
    assumptionFindings(da, findings);
    const sorted = findings
      .map((finding, index) => ({ finding, index }))
      .sort((a, b) => RANK[a.finding.severity] - RANK[b.finding.severity] || a.index - b.index)
      .map(({ finding }) => finding);
    return { findings: sorted, pending: pending.value };
  });
}

function uncertaintyFindings(da: DataAnalysis): DaNeedFinding[] {
  return uncertaintyCheck(da).findings;
}

function uncertaintyComplete(da: DataAnalysis): boolean {
  const check = uncertaintyCheck(da);
  return !check.pending && !check.findings.some((finding) => finding.severity === "error");
}

function registerUsers(da: DataAnalysis, source: DaUncertaintySource): string[] {
  return [...source.parameterIds, ...(source.estimateIds ?? [])];
}

export {
  correlationGroups,
  distributionSummary,
  familyOf,
  registerUsers,
  sensitivityResult,
  uncertaintyComplete,
  uncertaintyFindings,
  type DaCorrelationGroup,
  type DaDistributionSummary,
  type DaSensitivityResult,
};
