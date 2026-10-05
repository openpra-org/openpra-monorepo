import { DistributionType, type ParameterDistribution } from "interfaces-mef-types/core/events";
import type {
  DataAnalysis,
  DataAnalysisParameter,
  DaEstimateQuantity,
  DaEvidence,
  DaFrequencyComparison,
  DaFrequencyMethod,
  DaFrequencyPart,
  DaFrequencyPer,
  DaPriorForm,
  DaSourceUse,
  DaStateNeed,
} from "interfaces-mef-types/da/data-analysis";
import { distributionQuantile, shapeMean, shapePoint, shapeVariance, scaleDistribution, type DaShape } from "./daDistributions";
import { bayesUpdate, constrainedNoninformative, outputFor, type DaOutput, type DaTerm, type DaUpdatePrior } from "./daEstimates";
import { sourceUseResult } from "./daSourcing";
import type { DaFindingSeverity, DaNeedFinding } from "./daSelectors";

const RANK: Record<DaFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const CRITICAL_MODES: ReadonlySet<string> = new Set(["POWER", "STARTUP"]);

const SHUTDOWN_MODES: ReadonlySet<string> = new Set(["SHUTDOWN", "REFUELING", "MAINTENANCE"]);

const GAP = 5;

type DaFrequencyComputation = "PRIOR" | "CONJUGATE" | "NUMERICAL";

type DaFrequencyFit = "EXACT" | "LOGNORMAL" | "GAMMA_MOMENTS";

interface DaFrequencyEvidence {
  evidence: DaEvidence;
  label: string;
  failures?: number;
  exposure?: number;
  term?: DaTerm;
  problem?: string;
}

interface DaPartShare {
  share?: number;
  counted: string[];
  ignored: string[];
  missing: string[];
}

interface DaFrequencyPartEstimate {
  part: DaFrequencyPart;
  use?: DaSourceUse;
  published?: { distribution: ParameterDistribution; quantity: DaEstimateQuantity };
  form: DaPriorForm;
  prior?: DaShape;
  evidence: DaFrequencyEvidence[];
  terms: DaTerm[];
  method?: DaFrequencyMethod;
  computation?: DaFrequencyComputation;
  posterior?: DaShape;
  output?: DaOutput;
  share: DaPartShare;
  factor?: number;
  mean?: number;
  variance?: number;
  distribution?: ParameterDistribution;
  problem?: string;
}

interface DaFrequencyComparisonResult {
  comparison: DaFrequencyComparison;
  label: string;
  value?: number;
  ratio?: number;
  problem?: string;
}

interface DaFrequencyEstimate {
  modules: number;
  siteWide: boolean;
  parts: DaFrequencyPartEstimate[];
  mean?: number;
  p05?: number;
  median?: number;
  p95?: number;
  distribution?: ParameterDistribution;
  fit?: DaFrequencyFit;
  comparisons: DaFrequencyComparisonResult[];
  problem?: string;
}

const estimateCache = new WeakMap<DataAnalysis, Map<string, DaFrequencyEstimate>>();

const findingCache = new WeakMap<DataAnalysis, DaNeedFinding[]>();

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function isFrequencyParameter(parameter: DataAnalysisParameter): boolean {
  return parameter.quantificationModel === "FREQUENCY" || (parameter.quantificationModel === undefined && parameter.parameterType === "FREQUENCY");
}

function frequencyParameters(da: DataAnalysis): DataAnalysisParameter[] {
  return da.parameters.filter(isFrequencyParameter);
}

function stateShares(states: readonly DaStateNeed[]): Map<string, number> {
  const total = states.reduce((sum, state) => sum + (state.durationHours ?? 0), 0);
  const shares = new Map<string, number>();
  if (total <= 0) return shares;
  for (const state of states) {
    if (state.durationHours !== undefined) shares.set(state.id, state.durationHours / total);
  }
  return shares;
}

function modulesOf(da: DataAnalysis): number {
  const value = da.dataPlan?.modulesPerPlant?.value;
  return value !== undefined && Number.isFinite(value) && value >= 1 ? value : 1;
}

function modeFits(per: DaFrequencyPer, mode: string | undefined): boolean {
  if (mode === undefined) return false;
  if (per === "CRITICAL_YEAR") return CRITICAL_MODES.has(mode);
  if (per === "SHUTDOWN_YEAR") return SHUTDOWN_MODES.has(mode);
  return true;
}

function shareOf(da: DataAnalysis, per: DaFrequencyPer, stateIds: readonly string[]): DaPartShare {
  if (per === "CALENDAR_YEAR") return { share: 1, counted: [], ignored: [], missing: [] };
  const states = da.dataNeeds?.states ?? [];
  const shares = stateShares(states);
  const byId = new Map(states.map((state) => [state.id, state]));
  const counted: string[] = [];
  const ignored: string[] = [];
  const missing: string[] = [];
  let share = 0;
  for (const id of stateIds) {
    const state = byId.get(id);
    const part = shares.get(id);
    if (state === undefined || part === undefined) {
      missing.push(id);
      continue;
    }
    if (!modeFits(per, state.mode)) {
      ignored.push(id);
      continue;
    }
    counted.push(id);
    share += part;
  }
  return { share: counted.length > 0 ? share : undefined, counted, ignored, missing };
}

function perLabel(per: DaFrequencyPer): string {
  if (per === "CRITICAL_YEAR") return "per critical year";
  if (per === "SHUTDOWN_YEAR") return "per shutdown year";
  return "per calendar year";
}

function entryOf(da: DataAnalysis, sourceId: string | undefined, entryId: string | undefined): { failures?: number; exposure?: number; quantity: DaEstimateQuantity } | undefined {
  if (sourceId === undefined || entryId === undefined) return undefined;
  return (da.sources ?? []).find((source) => source.id === sourceId)?.entries.find((entry) => entry.id === entryId);
}

function evidenceLabel(da: DataAnalysis, evidence: DaEvidence): string {
  if (!blank(evidence.label)) return evidence.label ?? "";
  if (evidence.failuresFrom === "RECORDS" && evidence.recordSetId !== undefined) {
    const set = (da.recordSets ?? []).find((candidate) => candidate.id === evidence.recordSetId);
    return set === undefined ? evidence.recordSetId : `${set.id} · ${set.name}`;
  }
  if (evidence.sourceId !== undefined && evidence.entryId !== undefined) return `${evidence.sourceId} · ${evidence.entryId}`;
  return evidence.origin === "PLANT_RECORDS" ? "Plant counts" : "Typed counts";
}

function resolveEvidence(da: DataAnalysis, parameter: DataAnalysisParameter, part: DaFrequencyPart): DaFrequencyEvidence[] {
  return (part.evidence ?? []).map((evidence) => {
    const resolved: DaFrequencyEvidence = { evidence, label: evidenceLabel(da, evidence) };
    const entry = entryOf(da, evidence.sourceId, evidence.entryId);
    if (evidence.failuresFrom === "TYPED") resolved.failures = evidence.failures;
    else if (evidence.failuresFrom === "ENTRY") {
      if (entry === undefined) return { ...resolved, problem: "Pick the library estimate the event count comes from." };
      resolved.failures = entry.failures;
    } else {
      const set = (da.recordSets ?? []).find((candidate) => candidate.id === evidence.recordSetId);
      if (set === undefined) return { ...resolved, problem: "Pick the record set the events are counted from." };
      resolved.failures = set.records.filter((record) => record.judgment === "FAILURE" && record.parameterId === parameter.uuid).length;
    }
    if (evidence.exposureFrom === "ENTRY") {
      if (entry === undefined) return { ...resolved, problem: "Pick the library estimate the exposure comes from." };
      if (entry.quantity !== "PER_YEAR") return { ...resolved, problem: "This estimate does not count events in years." };
      resolved.exposure = entry.exposure;
    } else if (evidence.exposureFrom === "TYPED") {
      if (evidence.unit !== undefined && evidence.unit !== "YEARS") return { ...resolved, problem: "Initiating events are counted over years." };
      resolved.exposure = evidence.exposure;
    } else return { ...resolved, problem: "Count the exposure in years, typed or from a library estimate." };
    if (resolved.failures === undefined) return { ...resolved, problem: "Enter the number of events." };
    if (resolved.exposure === undefined) return { ...resolved, problem: "Enter the years the events happened in." };
    if (!(resolved.exposure > 0)) return { ...resolved, problem: "The exposure must be more than zero." };
    if (resolved.failures < 0) return { ...resolved, problem: "The event count cannot be negative." };
    return { ...resolved, term: { kind: "POISSON", failures: resolved.failures, exposure: resolved.exposure } };
  });
}

function partPrior(form: DaPriorForm, published: { distribution: ParameterDistribution } | undefined): { prior?: DaUpdatePrior; shape?: DaShape; problem?: string } {
  if (form === "JEFFREYS") return { prior: { kind: "JEFFREYS_RATE" } };
  if (published === undefined) return { problem: "Choose the source this part starts from." };
  if (form === "AS_PUBLISHED") return { prior: { kind: "PROPER", shape: published.distribution }, shape: published.distribution };
  const mean = shapeMean(published.distribution);
  const widened = mean === undefined ? undefined : constrainedNoninformative(mean, "RATE");
  if (widened === undefined) return { problem: "The source's mean cannot carry a constrained noninformative prior." };
  return { prior: { kind: "PROPER", shape: widened }, shape: widened };
}

function estimatePart(da: DataAnalysis, parameter: DataAnalysisParameter, part: DaFrequencyPart, modules: number, siteWide: boolean): DaFrequencyPartEstimate {
  const use = part.useId === undefined ? undefined : (parameter.sourceUses ?? []).find((candidate) => candidate.id === part.useId);
  const result = use === undefined ? undefined : sourceUseResult(da, use);
  const published = result === undefined ? undefined : { distribution: result.distribution, quantity: result.quantity };
  const form = part.priorForm ?? "AS_PUBLISHED";
  const evidence = resolveEvidence(da, parameter, part);
  const terms = evidence.flatMap((item) => (item.evidence.included && item.term !== undefined ? [item.term] : []));
  const share = shareOf(da, part.per, part.stateIds ?? []);
  const base: DaFrequencyPartEstimate = { part, use, published, form, evidence, terms, method: part.method, share };
  if (use !== undefined && result === undefined) return { ...base, problem: "The chosen source cannot be read. Check it in Step 04 Applicability." };
  if (published !== undefined && published.quantity !== "PER_YEAR") return { ...base, problem: "The source is not a frequency per year." };
  const chosen = partPrior(form, published);
  const withPrior: DaFrequencyPartEstimate = { ...base, prior: chosen.shape };
  if (part.method === undefined) return { ...withPrior, problem: "Choose how this part is estimated." };
  if (chosen.prior === undefined) return { ...withPrior, problem: chosen.problem ?? "No prior." };
  const prior = chosen.prior;
  let posterior: DaShape | undefined;
  let computation: DaFrequencyComputation | undefined;
  if (part.method === "PRIOR" || terms.length === 0) {
    if (prior.kind !== "PROPER") return { ...withPrior, problem: "A Jeffreys prior needs events to update." };
    posterior = prior.shape;
    computation = "PRIOR";
  } else {
    if (prior.kind === "PROPER" && shapePoint(prior.shape) !== undefined) return { ...withPrior, problem: "A point value cannot be updated. Use the constrained noninformative form." };
    const update = bayesUpdate(prior, terms, "RATE");
    if (update === undefined) return { ...withPrior, problem: "The update cannot be computed with this prior and these events." };
    posterior = update.shape;
    computation = update.computation;
  }
  const output = outputFor(posterior, undefined);
  if (output === undefined) return { ...withPrior, posterior, computation, problem: "The estimate cannot be summarized." };
  if (share.share === undefined) return { ...withPrior, posterior, computation, output, problem: part.per === "CALENDAR_YEAR" ? "No share of the year." : `No ${part.per === "CRITICAL_YEAR" ? "power" : "shutdown"} state with a duration covers this part. Check its states and the POS import in Step 02.` };
  const factor = share.share * (siteWide ? 1 : modules);
  const variance = shapeVariance(posterior);
  const distribution = scaleDistribution(output.distribution, factor);
  if (distribution === undefined) return { ...withPrior, posterior, computation, output, problem: "The estimate cannot be scaled to the plant." };
  return { ...withPrior, posterior, computation, output, factor, mean: output.summary.mean * factor, variance: variance === undefined ? undefined : variance * factor * factor, distribution };
}

function gammaFromMoments(mean: number, variance: number): ParameterDistribution | undefined {
  if (!(mean > 0)) return undefined;
  if (!(variance > 0)) return { type: DistributionType.POINT_ESTIMATE, value: mean };
  return { type: DistributionType.GAMMA, shape: (mean * mean) / variance, rate: mean / variance };
}

function comparisonResult(da: DataAnalysis, parameter: DataAnalysisParameter, comparison: DaFrequencyComparison, mean: number | undefined, modules: number, siteWide: boolean): DaFrequencyComparisonResult {
  const use = (parameter.sourceUses ?? []).find((candidate) => candidate.id === comparison.useId);
  const label = use === undefined ? comparison.useId : use.elicitationId ?? `${use.sourceId ?? "?"} · ${use.entryId ?? "?"}`;
  const result = use === undefined ? undefined : sourceUseResult(da, use);
  if (result === undefined) return { comparison, label, problem: "The comparison source cannot be read." };
  if (result.quantity !== "PER_YEAR") return { comparison, label, problem: "The comparison is not a frequency per year." };
  const share = shareOf(da, comparison.per, parameter.stateIds ?? []);
  if (share.share === undefined) return { comparison, label, problem: "None of the group's states fits this comparison's basis." };
  const value = result.mean * share.share * (siteWide ? 1 : modules);
  return { comparison, label, value, ratio: mean !== undefined && value > 0 ? mean / value : undefined };
}

function frequencyEstimate(da: DataAnalysis, parameter: DataAnalysisParameter): DaFrequencyEstimate {
  let byParameter = estimateCache.get(da);
  if (byParameter === undefined) {
    byParameter = new Map();
    estimateCache.set(da, byParameter);
  }
  const cached = byParameter.get(parameter.uuid);
  if (cached !== undefined) return cached;
  const estimate = computeEstimate(da, parameter);
  byParameter.set(parameter.uuid, estimate);
  return estimate;
}

function computeEstimate(da: DataAnalysis, parameter: DataAnalysisParameter): DaFrequencyEstimate {
  const basis = parameter.frequency;
  const modules = modulesOf(da);
  const siteWide = basis?.siteWide === true;
  const parts = (basis?.parts ?? []).map((part) => estimatePart(da, parameter, part, modules, siteWide));
  const base: DaFrequencyEstimate = { modules, siteWide, parts, comparisons: [] };
  const withComparisons = (mean: number | undefined): DaFrequencyComparisonResult[] => (basis?.comparisons ?? []).map((comparison) => comparisonResult(da, parameter, comparison, mean, modules, siteWide));
  if (basis === undefined || parts.length === 0) return { ...base, comparisons: withComparisons(undefined), problem: "Add the part or parts the frequency is built from." };
  const broken = parts.find((part) => part.problem !== undefined || part.mean === undefined || part.distribution === undefined);
  if (broken !== undefined) return { ...base, comparisons: withComparisons(undefined), problem: `${broken.part.label}: ${broken.problem ?? "cannot be estimated."}` };
  let distribution: ParameterDistribution | undefined;
  let fit: DaFrequencyFit | undefined;
  const only = parts.length === 1 ? parts[0] : undefined;
  if (only !== undefined) {
    distribution = only.distribution;
    fit = only.output?.fit === "LOGNORMAL" ? "LOGNORMAL" : "EXACT";
  } else {
    const mean = parts.reduce((total, part) => total + (part.mean ?? 0), 0);
    const variance = parts.reduce((total, part) => total + (part.variance ?? 0), 0);
    distribution = gammaFromMoments(mean, variance);
    fit = "GAMMA_MOMENTS";
  }
  if (distribution === undefined) return { ...base, comparisons: withComparisons(undefined), problem: "The parts cannot be combined." };
  const mean = only?.mean ?? parts.reduce((total, part) => total + (part.mean ?? 0), 0);
  const p05 = distributionQuantile(distribution, 0.05);
  const median = distributionQuantile(distribution, 0.5);
  const p95 = distributionQuantile(distribution, 0.95);
  return { ...base, mean, p05, median, p95, distribution, fit, comparisons: withComparisons(mean) };
}

function sameNumber(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a === b || Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));
}

function sameDistribution(a: ParameterDistribution | undefined, b: ParameterDistribution | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.type !== b.type) return false;
  const left = Object.entries(a);
  const right = new Map(Object.entries(b));
  if (left.length !== right.size) return false;
  return left.every(([key, value]) => {
    const other = right.get(key);
    return typeof value === "number" && typeof other === "number" ? sameNumber(value, other) : value === other;
  });
}

function withFrequencies(da: DataAnalysis): DataAnalysis {
  let changed = false;
  const parameters = da.parameters.map((parameter) => {
    if (!isFrequencyParameter(parameter) || parameter.valueMode !== "CALCULATED") return parameter;
    const estimate = frequencyEstimate(da, parameter);
    if (estimate.mean === undefined || estimate.distribution === undefined) return parameter;
    if (sameNumber(parameter.value, estimate.mean) && parameter.valueType === "MEAN" && sameDistribution(parameter.uncertainty?.distribution, estimate.distribution)) return parameter;
    changed = true;
    return { ...parameter, value: estimate.mean, valueType: "MEAN" as const, uncertainty: { ...(parameter.uncertainty ?? {}), distribution: estimate.distribution } };
  });
  return changed ? { ...da, parameters } : da;
}

function sci(value: number): string {
  return Number(value.toPrecision(3)).toExponential().replace("e+", "E").replace("e", "E");
}

function initiatorFor(da: DataAnalysis, parameter: DataAnalysisParameter): { id: string; valueHeldBy?: string; meanFrequency?: number } | undefined {
  const needs = da.dataNeeds?.initiators ?? [];
  if (parameter.valueLink?.element === "IE") return needs.find((need) => need.id === parameter.valueLink?.needId);
  return needs.find((need) => need.parameterId === parameter.uuid);
}

function parameterFindings(da: DataAnalysis, parameter: DataAnalysisParameter, findings: DaNeedFinding[]): void {
  const item = parameter.uuid;
  const target = { kind: "daFrequency" as const, id: parameter.uuid };
  const ccTwo = da.capabilityCategory !== "CC-I";
  const modules = modulesOf(da);
  if (parameter.valueMode === "LINKED") {
    const need = initiatorFor(da, parameter);
    if (parameter.valueLink?.element !== "IE" || need === undefined) findings.push({ severity: "error", check: "Link missing", item, detail: "The parameter imports its value from an IE group that is not among the imported groups.", target });
    else if (need.valueHeldBy === "DA") findings.push({ severity: "error", check: "Circular link", item, detail: `IE imports ${need.id} from DA, and this parameter imports it back from IE. One side has to own the value.`, target });
    return;
  }
  if (parameter.valueMode !== "CALCULATED") {
    if (parameter.value === undefined) findings.push({ severity: "error", check: "No value", item, detail: "Type the frequency, estimate it here, or import IE's value.", target });
    else if (ccTwo && parameter.isRiskSignificant === true && parameter.uncertainty?.distribution === undefined) findings.push({ severity: "error", check: "No distribution", item, detail: "A risk-significant initiator needs a mean and an uncertainty distribution at CC-II (IE-C19).", target });
    return;
  }
  const basis = parameter.frequency;
  if (basis?.category === undefined) findings.push({ severity: "warning", check: "No category", item, detail: "Sort the group into category I to IV by how much existing experience applies.", target });
  else if (blank(basis.categoryReason)) findings.push({ severity: "warning", check: "No category reason", item, detail: "Say why the group sits in this category.", target });
  if (modules > 1 && basis?.siteWide === undefined) findings.push({ severity: "warning", check: "Site-wide not stated", item, detail: `The plant has ${modules} modules. Say whether one event strikes them all, so it is not multiplied by the module count (IE-C8).`, target });
  if (basis?.siteWide === true && blank(basis.siteWideReason)) findings.push({ severity: "warning", check: "No site-wide reason", item, detail: "Say why one event strikes every module.", target });
  const estimate = frequencyEstimate(da, parameter);
  if (estimate.problem !== undefined) findings.push({ severity: "error", check: "Cannot estimate", item, detail: estimate.problem, target });
  for (const part of estimate.parts) {
    const what = part.part.label;
    if (part.share.missing.length > 0) findings.push({ severity: "warning", check: "State missing", item, detail: `${what}: ${part.share.missing.join(", ")} has no imported POS duration, so it adds nothing to the share.`, target });
    if (part.share.ignored.length > 0) findings.push({ severity: "note", check: "States left out", item, detail: `${what}: ${part.share.ignored.join(", ")} ${part.share.ignored.length === 1 ? "is" : "are"} not ${part.part.per === "CRITICAL_YEAR" ? "a power state" : "a shutdown state"}, so ${part.share.ignored.length === 1 ? "it does" : "they do"} not count toward the ${perLabel(part.part.per)} share.`, target });
    const widened = part.form === "CONSTRAINED_NONINFORMATIVE";
    if ((basis?.category === "II" || basis?.category === "III") && !widened && part.form !== "JEFFREYS" && blank(part.part.reason)) findings.push({ severity: "warning", check: "Uncertainty not widened", item, detail: `${what}: category ${basis.category} keeps the industry mean but widens it with a constrained noninformative prior, since the design differs from the plants behind the data.`, target });
    const used = part.evidence.filter((evidence) => evidence.evidence.included && evidence.term !== undefined);
    if (part.part.method === "PRIOR" && used.length > 0) findings.push({ severity: ccTwo ? "error" : "warning", check: "Events not used", item, detail: `${what}: events are listed but the source is used as it is. Update it, even with zero events (DA-D1).`, target });
    for (const evidence of part.evidence) {
      if (evidence.problem !== undefined) findings.push({ severity: "error", check: "Evidence problem", item, detail: `${what} · ${evidence.label}: ${evidence.problem}`, target });
      if (!evidence.evidence.included && blank(evidence.evidence.exclusionReason)) findings.push({ severity: "error", check: "No exclusion reason", item, detail: `${what} · ${evidence.label}: say why it is left out.`, target });
      if (blank(evidence.evidence.reason)) findings.push({ severity: "warning", check: "No evidence reason", item, detail: `${what} · ${evidence.label}: say why these counts apply.`, target });
    }
  }
  if (ccTwo && parameter.isRiskSignificant === true && estimate.distribution?.type === DistributionType.POINT_ESTIMATE) findings.push({ severity: "error", check: "No distribution", item, detail: "A risk-significant initiator needs an uncertainty distribution at CC-II (IE-C19).", target });
  for (const comparison of estimate.comparisons) {
    if (comparison.problem !== undefined) {
      findings.push({ severity: "warning", check: "Comparison problem", item, detail: `${comparison.label}: ${comparison.problem}`, target });
      continue;
    }
    const ratio = comparison.ratio;
    if (ratio !== undefined && (ratio >= GAP || ratio <= 1 / GAP) && blank(comparison.comparison.reason)) findings.push({ severity: "warning", check: "Comparison gap", item, detail: `The estimate is ${ratio >= 1 ? `${Number(ratio.toPrecision(2))} times` : `1/${Number((1 / ratio).toPrecision(2))} of`} ${comparison.label} (${sci(comparison.value ?? 0)}). Explain a gap of a factor of ${GAP} or more (IE-C16).`, target });
  }
  const need = initiatorFor(da, parameter);
  if (need?.valueHeldBy === "TYPED" && need.meanFrequency !== undefined && estimate.mean !== undefined && need.meanFrequency > 0) {
    const ratio = estimate.mean / need.meanFrequency;
    if (ratio >= GAP || ratio <= 1 / GAP) findings.push({ severity: "note", check: "IE value differs", item, detail: `IE types ${sci(need.meanFrequency)} for ${need.id}, a factor of ${Number(Math.max(ratio, 1 / ratio).toPrecision(2))} from this estimate. IE can import the estimate in its frequency step.`, target });
  }
}

function frequencyFindings(da: DataAnalysis): DaNeedFinding[] {
  const cached = findingCache.get(da);
  if (cached !== undefined) return cached;
  const findings: DaNeedFinding[] = [];
  const parameters = frequencyParameters(da);
  for (const parameter of parameters) parameterFindings(da, parameter, findings);
  const needs = da.dataNeeds?.initiators ?? [];
  const ids = new Set(parameters.map((parameter) => parameter.uuid));
  for (const need of needs) {
    if (!need.included) continue;
    if (need.parameterId === undefined || !ids.has(need.parameterId)) findings.push({ severity: "error", check: "No parameter", item: need.id, detail: "This IE group has no frequency parameter. Add one, then estimate it, type it or import IE's value.", target: { kind: "needInitiator", id: need.id } });
  }
  const mapped = needs.filter((need) => need.included && need.parameterId !== undefined);
  for (const need of mapped) {
    const shared = mapped.filter((other) => other.parameterId === need.parameterId);
    if (shared.length > 1 && shared[0] === need) findings.push({ severity: "warning", check: "Parameter shared", item: need.parameterId ?? need.id, detail: `${shared.map((other) => other.id).join(", ")} use one frequency parameter. Each group needs its own.`, target: { kind: "needInitiator", id: need.id } });
  }
  const sorted = findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => RANK[a.finding.severity] - RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
  findingCache.set(da, sorted);
  return sorted;
}

function frequenciesComplete(da: DataAnalysis): boolean {
  const decision = (da.scopeDecisions ?? []).find((candidate) => candidate.kind === "INITIATING_EVENT");
  if (decision !== undefined && !decision.included) return true;
  if (frequencyParameters(da).length === 0) return false;
  return !frequencyFindings(da).some((finding) => finding.severity === "error");
}

export {
  frequenciesComplete,
  frequencyEstimate,
  frequencyFindings,
  frequencyParameters,
  isFrequencyParameter,
  modulesOf,
  perLabel,
  shareOf,
  stateShares,
  withFrequencies,
  type DaFrequencyComparisonResult,
  type DaFrequencyEstimate,
  type DaFrequencyEvidence,
  type DaFrequencyPartEstimate,
};
