import { DistributionType, type ParameterDistribution } from "interfaces-mef-types/core/events";
import type {
  DataAnalysis,
  DataAnalysisParameter,
  DaMaintenanceActivity,
  DaMaintenanceKind,
  DaMaintenanceMethod,
  DaOutage,
  DaRestorationFrom,
  DaRestorationKind,
  DaRestorationPart,
  DaScopeKind,
  DaSourceEntry,
} from "interfaces-mef-types/da/data-analysis";
import { canonicalJson, lawWithinUnit, type Law, type UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { distributionCdf, distributionQuantile, gammaQ, normalCdf, validDistribution } from "./daDistributions";
import { betaFromMoments, constrainedNoninformative } from "./daEstimates";
import { expressionSpread, lawSummary, operationLaw, parameterPriorLaw, quantityUnit, type DaSpread } from "./daLaws";
import { hasSpread } from "./daFailures";
import { sourceUseBase, sourceUseResult } from "./daSourcing";
import { uncertaintyVersion, type UncertaintyState } from "../newly-developed-methods/shared/useUncertainty";
import type { DaFindingSeverity, DaNeedFinding } from "./daSelectors";

const RANK: Record<DaFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const Z95 = 1.6448536269514722;

const Z_STEP = 0.01;

const NO_WINDOW = "Enter the time available.";

const Z_GRID: number[] = Array.from({ length: 1601 }, (_, index) => -8 + index * Z_STEP);

const Z_WEIGHTS: number[] = Z_GRID.map((z, index) => (index === 0 || index === Z_GRID.length - 1 ? 0.5 : 1) * Z_STEP * Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI));

type DaStepMethod = DaMaintenanceMethod | DaRestorationFrom | "TYPED";

type DaUnavailabilityFit = "CONSTRAINED" | "MOMENTS" | "PUBLISHED" | "TYPED";

interface DaUnavailabilityOutput {
  mean: number;
  distribution: ParameterDistribution;
  p05?: number;
  p95?: number;
  fit: DaUnavailabilityFit;
}

interface DaCountedItem {
  id: string;
  label: string;
  hours: number;
}

interface DaLeftItem {
  id: string;
  label: string;
  why: "NOT_DISABLING" | "SUPPORT";
  chargedTo?: string;
}

interface DaMaintenanceEstimate {
  kind: DaMaintenanceKind;
  method?: DaMaintenanceMethod | "TYPED";
  trains: number;
  counted: DaCountedItem[];
  left: DaLeftItem[];
  countedHours?: number;
  overlapHours?: number;
  requiredHours?: number;
  years?: number;
  perTrain?: number;
  published?: Law;
  estimate?: UncertainExpression;
  cutShift?: number;
  pending: boolean;
  problem?: string;
}

interface DaPartResult {
  part: DaRestorationPart;
  label: string;
  distribution?: ParameterDistribution;
  rawWeight?: number;
  weight?: number;
  survival?: number;
  mean?: number;
  variance?: number;
  pending?: boolean;
  problem?: string;
}

interface DaRecordFit {
  median: number;
  sigma: number;
  count: number;
}

interface DaRestorationEstimate {
  kind: DaRestorationKind;
  method?: DaRestorationFrom | "TYPED";
  window?: number;
  parts: DaPartResult[];
  comparison: DaPartResult[];
  comparisonMean?: number;
  fit?: DaRecordFit;
  output?: DaUnavailabilityOutput;
  pending: boolean;
  problem?: string;
}

const maintenanceCache = new WeakMap<DataAnalysis, { version: number; values: Map<string, DaMaintenanceEstimate> }>();

const restorationCache = new WeakMap<DataAnalysis, { version: number; values: Map<string, DaRestorationEstimate> }>();

const findingCache = new WeakMap<DataAnalysis, { version: number; check: { findings: DaNeedFinding[]; pending: boolean } }>();

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function sci(value: number): string {
  return Number(value.toPrecision(2)).toExponential().replace("e+", "E").replace("e", "E");
}

function hoursText(value: number): string {
  return `${Number(value.toPrecision(4)).toLocaleString()} h`;
}

function isMaintenanceParameter(parameter: DataAnalysisParameter): boolean {
  return parameter.quantificationModel === "UNAVAILABILITY" && parameter.valueMode !== "LINKED";
}

function isRestorationParameter(parameter: DataAnalysisParameter): boolean {
  return parameter.quantificationModel === "NON_RECOVERY" && parameter.valueMode !== "LINKED";
}

function maintenanceParameters(da: DataAnalysis): DataAnalysisParameter[] {
  return da.parameters.filter(isMaintenanceParameter);
}

function trainParameters(da: DataAnalysis): DataAnalysisParameter[] {
  return maintenanceParameters(da).filter((parameter) => parameter.maintenance?.kind !== "COINCIDENT");
}

function coincidentParameters(da: DataAnalysis): DataAnalysisParameter[] {
  return maintenanceParameters(da).filter((parameter) => parameter.maintenance?.kind === "COINCIDENT");
}

function restorationParameters(da: DataAnalysis, kind?: DaRestorationKind): DataAnalysisParameter[] {
  return da.parameters.filter((parameter) => isRestorationParameter(parameter) && (kind === undefined || (parameter.restoration?.kind ?? "RECOVERY") === kind));
}

function typedMode(parameter: DataAnalysisParameter): boolean {
  return parameter.valueMode === "TYPED" || (parameter.valueMode === undefined && (parameter.value !== undefined || parameter.estimate !== undefined));
}

function maintenanceMethodOf(parameter: DataAnalysisParameter): DaMaintenanceMethod | "TYPED" | undefined {
  if (typedMode(parameter)) return "TYPED";
  return parameter.valueMode === "CALCULATED" ? parameter.maintenance?.method : undefined;
}

function restorationMethodOf(parameter: DataAnalysisParameter): DaRestorationFrom | "TYPED" | undefined {
  if (typedMode(parameter)) return "TYPED";
  return parameter.valueMode === "CALCULATED" ? parameter.restoration?.from : undefined;
}

function yearsBetween(start: string | undefined, end: string | undefined): number | undefined {
  if (start === undefined || end === undefined) return undefined;
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from)) return undefined;
  return (to - from) / (365.25 * 24 * 3600 * 1000);
}

function summarize(mean: number, distribution: ParameterDistribution, fit: DaUnavailabilityFit): DaUnavailabilityOutput {
  return { mean, distribution, p05: distributionQuantile(distribution, 0.05), p95: distributionQuantile(distribution, 0.95), fit };
}

function probabilityOutput(mean: number, variance: number): DaUnavailabilityOutput | undefined {
  if (!(mean > 0 && mean < 1)) return undefined;
  const fitted = variance > 0 ? betaFromMoments(mean, variance) : undefined;
  if (fitted !== undefined) return summarize(mean, fitted, "MOMENTS");
  const constrained = constrainedNoninformative(mean, "PROBABILITY");
  return constrained === undefined ? undefined : summarize(mean, constrained, "CONSTRAINED");
}

function typedOutput(parameter: DataAnalysisParameter): DaUnavailabilityOutput | undefined {
  const value = parameter.value;
  if (value === undefined) return undefined;
  const distribution = parameter.uncertainty?.distribution ?? { type: DistributionType.POINT_ESTIMATE, value };
  return summarize(value, distribution, "TYPED");
}

function hoursLaw(activity: DaMaintenanceActivity): Law {
  const low = activity.hoursLow;
  const high = activity.hoursHigh;
  if (low === undefined || high === undefined || !(low > 0) || !(high > low) || !(activity.hoursEach > 0)) return { family: "POINT", value: activity.hoursEach };
  return { family: "LOGNORMAL", mean: activity.hoursEach, errorFactor: Math.sqrt(high / low), level: 0.95 };
}

function factorValue(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value } } };
}

function hoursValue(law: Law): UncertainExpression {
  return { node: "VALUE", value: { unit: "HOURS", law } };
}

function fractionValue(law: Law): UncertainExpression {
  return { node: "VALUE", value: { unit: "FRACTION", law } };
}

function timesTrains(expression: UncertainExpression, trains: number): UncertainExpression {
  return trains === 1 ? expression : { node: "OPERATION", operation: "MULTIPLY", operands: [factorValue(trains), expression] };
}

function plannedExpression(activities: readonly DaMaintenanceActivity[], overlapHours: number, requiredHours: number, trains: number): UncertainExpression {
  const terms = activities.map((activity) => (activity.perYear === 1 ? hoursValue(hoursLaw(activity)) : { node: "OPERATION" as const, operation: "MULTIPLY" as const, operands: [factorValue(activity.perYear), hoursValue(hoursLaw(activity))] }));
  const first = terms[0];
  const total: UncertainExpression = terms.length === 1 && first !== undefined ? first : { node: "OPERATION", operation: "ADD", operands: terms };
  const net: UncertainExpression = overlapHours > 0 ? { node: "OPERATION", operation: "SUBTRACT", operands: [total, hoursValue({ family: "POINT", value: overlapHours })] } : total;
  return timesTrains({ node: "OPERATION", operation: "DIVIDE", operands: [net, hoursValue({ family: "POINT", value: requiredHours })] }, trains);
}

function constrainedExpression(mean: number): UncertainExpression {
  return fractionValue({ family: "CONSTRAINED_NONINFORMATIVE", mean });
}

function overlapHoursOf(da: DataAnalysis, parameter: DataAnalysisParameter, depth: number): number {
  if (depth > 0) return 0;
  return sum((parameter.maintenance?.overlapIds ?? []).map((id) => {
    const other = da.parameters.find((candidate) => candidate.uuid === id);
    if (other === undefined || other.maintenance?.kind !== "COINCIDENT") return 0;
    return computeMaintenance(da, other, depth + 1).countedHours ?? 0;
  }));
}

function maintenanceEstimate(da: DataAnalysis, parameter: DataAnalysisParameter): DaMaintenanceEstimate {
  const version = uncertaintyVersion();
  let cached = maintenanceCache.get(da);
  if (cached === undefined || cached.version !== version) {
    cached = { version, values: new Map() };
    maintenanceCache.set(da, cached);
  }
  const known = cached.values.get(parameter.uuid);
  if (known !== undefined) return known;
  const estimate = computeMaintenance(da, parameter, 0);
  cached.values.set(parameter.uuid, estimate);
  return estimate;
}

function maintenanceSpread(estimate: DaMaintenanceEstimate): UncertaintyState<DaSpread> | undefined {
  return estimate.estimate === undefined ? undefined : expressionSpread(estimate.estimate, "FRACTION");
}

function computeMaintenance(da: DataAnalysis, parameter: DataAnalysisParameter, depth: number): DaMaintenanceEstimate {
  const basis = parameter.maintenance;
  const kind = basis?.kind ?? "TRAIN";
  const trains = kind === "COINCIDENT" ? 1 : basis?.trains ?? 1;
  const method = maintenanceMethodOf(parameter);
  const base: DaMaintenanceEstimate = { kind, method, trains, counted: [], left: [], pending: false };
  if (method === undefined) return { ...base, problem: "Choose how the unavailability is found." };
  if (method === "TYPED") return parameter.estimate === undefined ? { ...base, problem: "Type the unavailability." } : { ...base, estimate: parameter.estimate };
  if (!(trains > 0)) return { ...base, problem: "The number of trains must be more than zero." };
  if (method === "GENERIC") {
    const prior = parameterPriorLaw(da, parameter);
    if (prior.status === "pending") return { ...base, pending: true };
    if (prior.status === "failed") return { ...base, problem: `PRAXIS could not form the published value: ${prior.error}` };
    if (prior.status === "missing") return { ...base, problem: prior.problem.startsWith("No prior") ? "No published value. Choose it in Step 04 Applicability." : prior.problem };
    if (prior.value.quantity !== "FRACTION") return { ...base, problem: "The published value is not a fraction of time out of service." };
    const published = prior.value.law;
    const withPublished: DaMaintenanceEstimate = { ...base, published };
    const spread = expressionSpread(fractionValue(published), "FRACTION");
    if (spread.status === "pending") return { ...withPublished, pending: true };
    if (spread.status === "failed") return { ...withPublished, problem: `PRAXIS could not summarize the published value: ${spread.error}` };
    const perTrain = spread.value.mean;
    const mean = perTrain * trains;
    const withMean: DaMaintenanceEstimate = { ...withPublished, perTrain };
    if (!(mean > 0 && mean < 1)) return { ...withMean, problem: "The trains times the published value must lie between 0 and 1." };
    if (published.family === "POINT") return { ...withMean, estimate: constrainedExpression(mean) };
    if (trains === 1) return { ...withMean, estimate: fractionValue(published) };
    const scaled = operationLaw({ kind: "SCALE", law: published, factor: trains });
    if (scaled.status === "pending") return { ...withMean, pending: true };
    if (scaled.status === "failed") return { ...withMean, problem: `PRAXIS could not scale the published value: ${scaled.error}` };
    if (scaled.status === "missing") return { ...withMean, problem: scaled.problem };
    const kept = lawWithinUnit("FRACTION", scaled.law);
    if (kept === scaled.law) return { ...withMean, estimate: fractionValue(kept) };
    const cut = expressionSpread(fractionValue(kept), "FRACTION");
    if (cut.status === "pending") return { ...withMean, pending: true };
    if (cut.status === "failed") return { ...withMean, problem: `PRAXIS could not summarize the scaled value: ${cut.error}` };
    return { ...withMean, estimate: fractionValue(kept), cutShift: 1 - cut.value.mean / mean };
  }
  const required = basis?.requiredHoursPerYear;
  if (required === undefined || !(required > 0)) return { ...base, problem: "Enter the hours a year the function is required." };
  const counted: DaCountedItem[] = [];
  const left: DaLeftItem[] = [];
  const activities: DaMaintenanceActivity[] = [];
  if (method === "PLANNED") {
    for (const activity of basis?.activities ?? []) {
      const label = blank(activity.activity) ? activity.id : activity.activity;
      if (!activity.disablesFunction) left.push({ id: activity.id, label, why: "NOT_DISABLING" });
      else if (!blank(activity.chargedTo)) left.push({ id: activity.id, label, why: "SUPPORT", chargedTo: activity.chargedTo });
      else if (activity.perYear >= 0 && activity.hoursEach >= 0) {
        counted.push({ id: activity.id, label, hours: activity.perYear * activity.hoursEach });
        if (activity.perYear > 0 && activity.hoursEach > 0) activities.push(activity);
      }
    }
  } else {
    for (const record of basis?.records ?? []) {
      const label = blank(record.activity) ? record.id : record.activity;
      if (!record.disablesFunction) left.push({ id: record.id, label, why: "NOT_DISABLING" });
      else if (!blank(record.chargedTo)) left.push({ id: record.id, label, why: "SUPPORT", chargedTo: record.chargedTo });
      else if (record.hours >= 0) counted.push({ id: record.id, label, hours: record.hours });
    }
  }
  const years = method === "RECORDS" ? yearsBetween(da.dataPlan?.dataWindowStart, da.dataPlan?.dataWindowEnd) : undefined;
  const countedHours = sum(counted.map((item) => item.hours));
  const withCounts: DaMaintenanceEstimate = { ...base, counted, left, countedHours, years };
  if (method === "RECORDS" && years === undefined) return { ...withCounts, problem: "Records are counted over the data window. Set it in Step 01." };
  const span = method === "RECORDS" ? years ?? 1 : 1;
  const overlapHours = kind === "TRAIN" ? overlapHoursOf(da, parameter, depth) * span : 0;
  const requiredHours = required * span;
  const perTrain = (countedHours - overlapHours) / requiredHours;
  const filled: DaMaintenanceEstimate = { ...withCounts, overlapHours, requiredHours, perTrain };
  if (counted.length === 0) return { ...filled, problem: method === "PLANNED" ? "No activity takes the function out of service." : "No record takes the function out of service." };
  if (perTrain < 0) return { ...filled, problem: "The coincident hours taken out are more than the train's own hours." };
  const mean = perTrain * trains;
  if (!(mean > 0)) return { ...filled, problem: "The hours out of service add up to zero." };
  if (!(mean < 1)) return { ...filled, problem: "The function is out of service for more hours than it is required." };
  const spread = activities.some((activity) => hoursLaw(activity).family !== "POINT");
  if (method === "RECORDS" || !spread) return { ...filled, estimate: constrainedExpression(mean) };
  return { ...filled, estimate: plannedExpression(activities, overlapHours, requiredHours, trains) };
}

function survivalAt(distribution: ParameterDistribution, hours: number): number | undefined {
  if (!validDistribution(distribution)) return undefined;
  switch (distribution.type) {
    case DistributionType.LOGNORMAL: {
      const sigma = Math.log(distribution.errorFactor) / Z95;
      if (!(sigma > 0)) return hours < distribution.median ? 1 : 0;
      return normalCdf((Math.log(distribution.median) - Math.log(hours)) / sigma);
    }
    case DistributionType.WEIBULL: return hours <= distribution.location ? 1 : Math.exp(-Math.pow((hours - distribution.location) / distribution.scale, distribution.shape));
    case DistributionType.EXPONENTIAL: return Math.exp(-distribution.failureRate * hours);
    case DistributionType.GAMMA: return gammaQ(distribution.shape, distribution.rate * hours);
    case DistributionType.POINT_ESTIMATE: return undefined;
    default: {
      const cdf = distributionCdf(distribution, hours);
      return cdf === undefined ? undefined : Math.max(0, 1 - cdf);
    }
  }
}

function survivalMoments(distribution: ParameterDistribution, hours: number, count: number | undefined): { survival: number; mean: number; variance: number } | undefined {
  const survival = survivalAt(distribution, hours);
  if (survival === undefined) return undefined;
  if (distribution.type !== DistributionType.LOGNORMAL || count === undefined || !(count >= 2)) return { survival, mean: survival, variance: 0 };
  const sigma = Math.log(distribution.errorFactor) / Z95;
  if (!(sigma > 0)) return { survival, mean: survival, variance: 0 };
  const a = (Math.log(distribution.median) - Math.log(hours)) / sigma;
  const b = 1 / Math.sqrt(count);
  const mean = normalCdf(a / Math.sqrt(1 + b * b));
  let second = 0;
  for (let index = 0; index < Z_GRID.length; index += 1) {
    const p = normalCdf(a + b * (Z_GRID[index] ?? 0));
    second += (Z_WEIGHTS[index] ?? 0) * p * p;
  }
  return { survival, mean, variance: Math.max(0, second - mean * mean) };
}

function entryOf(da: DataAnalysis, sourceId: string | undefined, entryId: string | undefined): DaSourceEntry | undefined {
  if (sourceId === undefined || entryId === undefined) return undefined;
  return (da.sources ?? []).find((source) => source.id === sourceId)?.entries.find((entry) => entry.id === entryId);
}

function partWeight(da: DataAnalysis, part: DaRestorationPart): { weight?: number; pending?: boolean; problem?: string } {
  if (part.weightSourceId !== undefined || part.weightEntryId !== undefined) {
    const entry = entryOf(da, part.weightSourceId, part.weightEntryId);
    if (entry === undefined) return { problem: "Pick the frequency that weights this part." };
    if (entry.quantity !== "PER_YEAR") return { problem: `${entry.id} is not a frequency per year.` };
    if (entry.law === undefined) return { problem: `${entry.id} has no law.` };
    const summary = lawSummary(quantityUnit(entry.quantity), lawWithinUnit(quantityUnit(entry.quantity), entry.law));
    if (summary.status === "pending") return { pending: true };
    if (summary.status === "failed") return { problem: `PRAXIS could not read ${entry.id}: ${summary.error}` };
    return summary.value.mean > 0 ? { weight: summary.value.mean } : { problem: `${entry.id} has no positive mean frequency.` };
  }
  if (part.weight !== undefined) return part.weight > 0 ? { weight: part.weight } : { problem: "A weight must be more than zero." };
  return {};
}

function partLabel(da: DataAnalysis, parameter: DataAnalysisParameter, part: DaRestorationPart): string {
  const use = (parameter.sourceUses ?? []).find((candidate) => candidate.id === part.useId);
  if (use === undefined) return part.useId;
  if (use.elicitationId !== undefined) return use.elicitationId;
  const entry = entryOf(da, use.sourceId, use.entryId);
  return entry === undefined ? `${use.sourceId ?? "?"} · ${use.entryId ?? "?"}` : `${entry.id} · ${entry.component}`;
}

function evaluateParts(da: DataAnalysis, parameter: DataAnalysisParameter, parts: readonly DaRestorationPart[], window: number | undefined): { results: DaPartResult[]; mean?: number; variance?: number; pending?: boolean; problem?: string } {
  const results: DaPartResult[] = parts.map((part) => {
    const label = partLabel(da, parameter, part);
    const use = (parameter.sourceUses ?? []).find((candidate) => candidate.id === part.useId);
    if (use === undefined) return { part, label, problem: "Pick the source this part uses." };
    if (use.verdict === "REJECTED") return { part, label, problem: "This source is marked as not applying." };
    const result = sourceUseResult(da, use);
    if (result === undefined) return { part, label, problem: sourceUseBase(da, use) === undefined ? "The source or estimate no longer exists." : "The source cannot be scaled this far." };
    if (result.quantity !== "HOURS") return { part, label, problem: "This source is not a time in hours." };
    const weighted = partWeight(da, part);
    const withWeight: DaPartResult = { part, label, distribution: result.distribution, rawWeight: weighted.weight };
    if (weighted.pending === true) return { ...withWeight, pending: true };
    if (weighted.problem !== undefined) return { ...withWeight, problem: weighted.problem };
    if (window === undefined) return withWeight;
    const moments = survivalMoments(result.distribution, window, part.sampleSize);
    if (moments === undefined) return { ...withWeight, problem: "This source gives one value, not a time distribution." };
    return { ...withWeight, survival: moments.survival, mean: moments.mean, variance: moments.variance };
  });
  if (results.length === 0) return { results };
  if (results.some((result) => result.pending === true)) return { results, pending: true };
  const weighted = results.filter((result) => result.part.weight !== undefined || result.part.weightEntryId !== undefined || result.part.weightSourceId !== undefined).length;
  if (weighted > 0 && weighted < results.length) return { results, problem: "Weight every part, or none for equal weights." };
  const failed = results.find((result) => result.problem !== undefined);
  if (failed !== undefined) return { results, problem: `${failed.label}: ${failed.problem ?? ""}` };
  const raw = results.map((result) => (weighted === 0 ? 1 : result.rawWeight ?? 0));
  const total = sum(raw);
  if (!(total > 0)) return { results, problem: "The weights add up to zero." };
  const normalized = results.map((result, index) => ({ ...result, weight: (raw[index] ?? 0) / total }));
  if (window === undefined) return { results: normalized };
  const mean = sum(normalized.map((result) => (result.weight ?? 0) * (result.mean ?? 0)));
  const variance = sum(normalized.map((result) => (result.weight ?? 0) * (result.weight ?? 0) * (result.variance ?? 0)));
  return { results: normalized, mean, variance };
}

function recordFit(times: readonly number[]): DaRecordFit | undefined {
  const logs = times.filter((hours) => hours > 0).map((hours) => Math.log(hours));
  if (logs.length < 2) return undefined;
  const mu = sum(logs) / logs.length;
  const sigma = Math.sqrt(sum(logs.map((value) => (value - mu) * (value - mu))) / (logs.length - 1));
  return sigma > 0 ? { median: Math.exp(mu), sigma, count: logs.length } : undefined;
}

function restorationEstimate(da: DataAnalysis, parameter: DataAnalysisParameter): DaRestorationEstimate {
  const version = uncertaintyVersion();
  let cached = restorationCache.get(da);
  if (cached === undefined || cached.version !== version) {
    cached = { version, values: new Map() };
    restorationCache.set(da, cached);
  }
  const known = cached.values.get(parameter.uuid);
  if (known !== undefined) return known;
  const estimate = computeRestoration(da, parameter);
  cached.values.set(parameter.uuid, estimate);
  return estimate;
}

function computeRestoration(da: DataAnalysis, parameter: DataAnalysisParameter): DaRestorationEstimate {
  const basis = parameter.restoration;
  const kind = basis?.kind ?? "RECOVERY";
  const method = restorationMethodOf(parameter);
  const window = basis?.windowHours !== undefined && basis.windowHours > 0 ? basis.windowHours : undefined;
  const base: DaRestorationEstimate = { kind, method, window, parts: [], comparison: [], pending: false };
  if (method === undefined) return { ...base, problem: "Choose how the chance of not restoring is found." };
  if (method === "TYPED") {
    const output = typedOutput(parameter);
    return output === undefined ? { ...base, problem: "Type the probability." } : { ...base, output };
  }
  if (method === "RECORDS") {
    const times = (basis?.times ?? []).map((time) => time.hours);
    const fit = recordFit(times);
    if (fit === undefined) return { ...base, problem: times.filter((hours) => hours > 0).length < 2 ? "A fit needs at least two restoration times." : "The times are all the same, so they give no spread." };
    const withFit = { ...base, fit };
    if (window === undefined) return { ...withFit, problem: NO_WINDOW };
    const distribution: ParameterDistribution = { type: DistributionType.LOGNORMAL, median: fit.median, errorFactor: Math.exp(fit.sigma * Z95) };
    const moments = survivalMoments(distribution, window, fit.count);
    if (moments === undefined) return { ...withFit, problem: "The fit cannot be evaluated." };
    const output = probabilityOutput(moments.mean, moments.variance);
    return output === undefined ? { ...withFit, problem: "The chance of not restoring is zero to machine precision." } : { ...withFit, output };
  }
  const primary = evaluateParts(da, parameter, basis?.parts ?? [], window);
  const comparison = evaluateParts(da, parameter, basis?.comparison ?? [], window);
  const withParts: DaRestorationEstimate = { ...base, parts: primary.results, comparison: comparison.results, comparisonMean: comparison.problem === undefined ? comparison.mean : undefined, pending: primary.pending === true || comparison.pending === true };
  if (primary.results.length === 0) return { ...withParts, problem: "Add the source parts the estimate is built from." };
  if (primary.pending === true) return withParts;
  if (primary.problem !== undefined) return { ...withParts, problem: primary.problem };
  if (window === undefined || primary.mean === undefined) return { ...withParts, problem: NO_WINDOW };
  const output = probabilityOutput(primary.mean, primary.variance ?? 0);
  return output === undefined ? { ...withParts, problem: "The chance of not restoring is zero to machine precision." } : { ...withParts, output };
}

function weightedCurve(parts: readonly DaPartResult[], hours: readonly number[]): number[] | undefined {
  if (parts.length === 0 || parts.some((part) => part.distribution === undefined || part.problem !== undefined)) return undefined;
  return hours.map((time) => sum(parts.map((part) => (part.weight ?? 1 / parts.length) * (part.distribution === undefined ? 0 : survivalAt(part.distribution, time) ?? 0))));
}

function survivalCurve(da: DataAnalysis, parameter: DataAnalysisParameter, hours: readonly number[]): { key: string; label: string; values: number[] }[] {
  const estimate = restorationEstimate(da, parameter);
  if (estimate.method === "RECORDS" && estimate.fit !== undefined) {
    const distribution: ParameterDistribution = { type: DistributionType.LOGNORMAL, median: estimate.fit.median, errorFactor: Math.exp(estimate.fit.sigma * Z95) };
    return [{ key: "FIT", label: "Fit to the times", values: hours.map((time) => survivalAt(distribution, time) ?? 0) }];
  }
  if (estimate.method !== "SOURCES") return [];
  const parts = estimate.parts.filter((part) => part.distribution !== undefined && part.problem === undefined);
  if (parts.length === 0) return [];
  const series: { key: string; label: string; values: number[] }[] = [];
  const weighted = parts.length > 1 ? weightedCurve(estimate.parts, hours) : undefined;
  if (weighted !== undefined) series.push({ key: "WEIGHTED", label: "Weighted", values: weighted });
  parts.forEach((part, index) => series.push({ key: `PART-${index}`, label: part.label, values: hours.map((time) => (part.distribution === undefined ? 0 : survivalAt(part.distribution, time) ?? 0)) }));
  const comparison = weightedCurve(estimate.comparison, hours);
  if (comparison !== undefined) series.push({ key: "COMPARISON", label: "Comparison", values: comparison });
  return series;
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

function outageFromPos(da: DataAnalysis, outage: DaOutage): { hours: number; perYear: number } | undefined {
  if (outage.valueFrom !== "POS" || outage.stateId === undefined) return undefined;
  const state = (da.dataNeeds?.states ?? []).find((candidate) => candidate.id === outage.stateId);
  if (state === undefined || state.valueHeldBy === "DA") return undefined;
  const entries = state.entriesPerYear;
  const hours = state.durationHours;
  if (entries === undefined || hours === undefined || !(entries > 0) || !(hours > 0)) return undefined;
  return { hours: hours / entries, perYear: entries };
}

function withOutagesFromPos(da: DataAnalysis): DataAnalysis {
  const outages = da.outages;
  if (outages === undefined) return da;
  let changed = false;
  const next = outages.map((outage) => {
    const linked = outageFromPos(da, outage);
    if (linked === undefined || (sameNumber(outage.hours, linked.hours) && sameNumber(outage.perYear, linked.perYear))) return outage;
    changed = true;
    return { ...outage, hours: linked.hours, perYear: linked.perYear };
  });
  return changed ? { ...da, outages: next } : da;
}

function withMaintenanceEstimate(da: DataAnalysis, parameter: DataAnalysisParameter): DataAnalysisParameter {
  const estimate = maintenanceEstimate(da, parameter);
  const expression = estimate.estimate;
  if (expression === undefined || estimate.pending || estimate.problem !== undefined) return parameter;
  if (parameter.estimate !== undefined && canonicalJson(parameter.estimate) === canonicalJson(expression) && parameter.value === undefined && parameter.valueType === undefined && parameter.uncertainty === undefined) return parameter;
  const next: DataAnalysisParameter = { ...parameter, estimate: expression };
  delete next.value;
  delete next.valueType;
  delete next.uncertainty;
  return next;
}

function withUnavailability(input: DataAnalysis): DataAnalysis {
  const da = withOutagesFromPos(input);
  let changed = false;
  const parameters = da.parameters.map((parameter) => {
    if (parameter.valueMode !== "CALCULATED") return parameter;
    if (isMaintenanceParameter(parameter)) {
      const next = withMaintenanceEstimate(da, parameter);
      if (next !== parameter) changed = true;
      return next;
    }
    const output = isRestorationParameter(parameter) ? restorationEstimate(da, parameter).output : undefined;
    if (output === undefined) return parameter;
    if (sameNumber(parameter.value, output.mean) && parameter.valueType === "MEAN" && sameDistribution(parameter.uncertainty?.distribution, output.distribution)) return parameter;
    changed = true;
    return { ...parameter, value: output.mean, valueType: "MEAN" as const, uncertainty: { ...(parameter.uncertainty ?? {}), distribution: output.distribution } };
  });
  return changed ? { ...da, parameters } : da;
}

function systemsWithMaintenance(da: DataAnalysis): Set<string> {
  return new Set(trainParameters(da).flatMap((parameter) => (parameter.systemReference === undefined ? [] : [parameter.systemReference])));
}

function maintenanceFindingsFor(da: DataAnalysis, parameter: DataAnalysisParameter, findings: DaNeedFinding[], pending: { value: boolean }): void {
  const item = parameter.uuid;
  const target = { kind: "daMaintenance" as const, id: parameter.uuid };
  const basis = parameter.maintenance;
  const estimate = maintenanceEstimate(da, parameter);
  const method = estimate.method;
  const operating = da.plantStage === "OPERATIONAL";
  const ccTwo = da.capabilityCategory !== "CC-I";
  if (method === undefined) {
    findings.push({ severity: "error", check: "No method", item, detail: "Choose the planned program, plant records, a published value or a typed value.", target });
    return;
  }
  if (method === "TYPED") {
    const typed = parameter.estimate;
    if (typed === undefined) findings.push({ severity: "error", check: "No value", item, detail: "Type the unavailability, or let DA calculate it.", target });
    else if (!hasSpread(typed)) findings.push({ severity: "warning", check: "No uncertainty", item, detail: "Give the typed unavailability a distribution (DA-D3).", target });
    if (blank(parameter.estimateReason) && blank(basis?.basis)) findings.push({ severity: "warning", check: "No basis", item, detail: "Say where the typed unavailability comes from.", target });
    return;
  }
  if (estimate.pending) pending.value = true;
  if (estimate.problem !== undefined) findings.push({ severity: "error", check: "Cannot estimate", item, detail: estimate.problem, target: estimate.problem.startsWith("No published value") ? { kind: "daSourcing", id: parameter.uuid } : target });
  if (estimate.cutShift !== undefined) findings.push({ severity: estimate.cutShift >= 0.05 ? "warning" : "note", check: "Cut at one", item, detail: `${estimate.trains} trains times the published value can pass one, so the law is cut at one. This lowers the mean by ${Number((estimate.cutShift * 100).toPrecision(2))}%.`, target });
  if (method === "GENERIC") {
    if (!operating && blank(basis?.basis)) findings.push({ severity: "warning", check: "Generic value not justified", item, detail: "Say why the published value fits this design and its maintenance program (DA-C14).", target });
    if (operating) findings.push({ severity: "warning", check: "Generic value", item, detail: "An operating plant counts its own time out of service (DA-C13, DA-C16).", target });
  }
  if (method === "PLANNED" && operating) findings.push({ severity: "warning", check: "Planned values", item, detail: "An operating plant counts the actual time out of service, not the plan (DA-C16).", target });
  if (method === "RECORDS" && !operating) findings.push({ severity: "warning", check: "Records before operation", item, detail: "A plant that does not operate has no records of its own. Use the planned program and record its assumptions (DA-C17).", target });
  if ((method === "PLANNED" || method === "RECORDS") && basis?.requiredHoursPerYear !== undefined && blank(basis.requiredReason)) findings.push({ severity: "warning", check: "No reason for the required hours", item, detail: "Say which operating states the required hours cover.", target });
  if (estimate.kind === "TRAIN" && (basis?.trains ?? 1) !== 1 && blank(basis?.trainsReason)) findings.push({ severity: "warning", check: "No reason for the trains", item, detail: "Say why the event covers more than one train, and that they are out one at a time.", target });
  if (method === "PLANNED") {
    for (const activity of basis?.activities ?? []) {
      const what = blank(activity.activity) ? activity.id : activity.activity;
      if (blank(activity.activity)) findings.push({ severity: "warning", check: "No activity", item, detail: `Name activity ${activity.id}.`, target });
      if (!(activity.perYear >= 0) || !(activity.hoursEach >= 0)) findings.push({ severity: "error", check: "Bad count", item, detail: `${what} needs a count per year and hours each that are not negative.`, target });
      if (activity.hoursLow !== undefined || activity.hoursHigh !== undefined) {
        const low = activity.hoursLow;
        const high = activity.hoursHigh;
        if (low === undefined || high === undefined || !(low > 0) || !(low <= activity.hoursEach && activity.hoursEach <= high) || !(high > low)) findings.push({ severity: "error", check: "Bad range", item, detail: `${what} needs a range with 0 < low ≤ hours each ≤ high.`, target });
      }
      if (!activity.disablesFunction && blank(activity.reason)) findings.push({ severity: "warning", check: "Why it does not count", item, detail: `Say why ${what} leaves the function available (DA-C13).`, target });
      if (activity.disablesFunction && blank(activity.chargedTo) && !operating && blank(activity.reason) && blank(activity.reference)) findings.push({ severity: "warning", check: "No assumption", item, detail: `Give the assumption or the plan behind ${what} (${estimate.kind === "COINCIDENT" ? "DA-C19" : "DA-C17"}).`, target });
      if (activity.disablesFunction && blank(activity.chargedTo) && ccTwo && parameter.isRiskSignificant === true && (activity.hoursLow === undefined || activity.hoursHigh === undefined)) findings.push({ severity: "warning", check: "No range", item, detail: `${what} is part of a risk-significant event. Give a range for its duration (${operating ? "DA-C16" : "DA-C17"}).`, target });
    }
  }
  if (method === "RECORDS") {
    const seen = new Set<string>();
    for (const record of basis?.records ?? []) {
      if (seen.has(record.id)) findings.push({ severity: "error", check: "Duplicate record", item, detail: `Two records share the ID ${record.id}.`, target });
      seen.add(record.id);
      if (!(record.hours >= 0)) findings.push({ severity: "error", check: "Bad hours", item, detail: `Record ${record.id} needs hours that are not negative.`, target });
    }
  }
  const supported = systemsWithMaintenance(da);
  for (const left of estimate.left) {
    if (left.why !== "SUPPORT" || left.chargedTo === undefined) continue;
    if (left.chargedTo === parameter.systemReference) findings.push({ severity: "error", check: "Charged to itself", item, detail: `${left.label} is charged to the parameter's own system. Count it here instead.`, target });
    else if (!supported.has(left.chargedTo)) findings.push({ severity: "warning", check: "Support outage not carried", item, detail: `${left.label} is charged to ${left.chargedTo}, but no unavailability parameter of ${left.chargedTo} carries it (DA-C15).`, target });
  }
  if (estimate.kind === "COINCIDENT") {
    if ((basis?.equipment ?? []).filter((name) => !blank(name)).length < 2) findings.push({ severity: "warning", check: "No equipment", item, detail: "List the redundant equipment the activity takes out together (DA-C18).", target });
    const recorded = trainParameters(da).filter((train) => maintenanceMethodOf(train) === "RECORDS" && train.systemReference !== undefined && train.systemReference === parameter.systemReference && !(train.maintenance?.overlapIds ?? []).includes(parameter.uuid));
    if (recorded.length > 0) findings.push({ severity: "warning", check: "Overlap", item, detail: `The records of ${recorded.map((train) => train.uuid).join(", ")} may include this joint activity. List it under their overlaps so its hours count once (DA-C18).`, target });
  }
  for (const id of basis?.overlapIds ?? []) {
    const other = da.parameters.find((candidate) => candidate.uuid === id);
    if (other === undefined || other.maintenance?.kind !== "COINCIDENT") findings.push({ severity: "error", check: "Overlap missing", item, detail: `${id} is not a coincident maintenance parameter.`, target });
  }
}

function restorationFindingsFor(da: DataAnalysis, parameter: DataAnalysisParameter, findings: DaNeedFinding[], pending: { value: boolean }): void {
  const item = parameter.uuid;
  const target = { kind: "daRestoration" as const, id: parameter.uuid };
  const basis = parameter.restoration;
  const estimate = restorationEstimate(da, parameter);
  if (estimate.pending) pending.value = true;
  const method = estimate.method;
  const operating = da.plantStage === "OPERATIONAL";
  const kind = estimate.kind;
  const noun = kind === "REPAIR" ? "repair" : "recovery";
  if (method === undefined) {
    findings.push({ severity: "error", check: "No method", item, detail: "Choose library sources, restoration times or a typed value.", target });
    return;
  }
  if (basis === undefined || blank(basis.subject)) findings.push({ severity: "warning", check: "No subject", item, detail: `Name what is ${kind === "REPAIR" ? "repaired" : "recovered"}.`, target });
  if (method === "TYPED") {
    if (parameter.value === undefined) findings.push({ severity: "error", check: "No value", item, detail: "Type the probability, or let DA calculate it.", target });
    if (blank(parameter.estimateReason) && blank(basis?.basis)) findings.push({ severity: "warning", check: "No basis", item, detail: "Say where the typed probability comes from.", target });
  }
  if (basis?.windowHours === undefined || !(basis.windowHours > 0)) findings.push({ severity: method === "TYPED" ? "warning" : "error", check: "No time window", item, detail: `Enter the time available for the ${noun} in its operating state and sequence (DA-D6).`, target });
  else if (blank(basis.windowReason)) findings.push({ severity: "warning", check: "No window reason", item, detail: "Say where the time available comes from (DA-D6).", target });
  if (blank(basis?.sequence)) findings.push({ severity: "warning", check: "No sequence", item, detail: `Name the operating state and sequence the ${noun} is credited in (DA-D6).`, target });
  const states = parameter.stateIds ?? (parameter.plantOperatingStateRef === undefined ? [] : [parameter.plantOperatingStateRef]);
  if (states.length > 1) findings.push({ severity: "note", check: "One window for several states", item, detail: `One window serves ${states.join(", ")}. ${kind === "REPAIR" ? "Repair" : "Recovery"} depends on the operating state, so check it holds in each (DA-D6).`, target });
  if (method === "TYPED") return;
  if (estimate.problem !== undefined && estimate.problem !== NO_WINDOW) findings.push({ severity: "error", check: "Cannot estimate", item, detail: estimate.problem, target });
  if (method === "RECORDS") {
    if (!operating) findings.push({ severity: "warning", check: "Records before operation", item, detail: kind === "REPAIR" ? "A plant that does not operate has no repair records. Use applicable industry experience and record its basis (DA-C21)." : "A plant that does not operate has no recovery records. Use generic data (DA-C23).", target });
    for (const time of basis?.times ?? []) if (!(time.hours > 0)) findings.push({ severity: "error", check: "Bad time", item, detail: `Time ${time.id} must be more than zero hours.`, target });
  }
  if (method === "SOURCES") {
    for (const part of [...estimate.parts, ...estimate.comparison]) {
      if (part.part.sampleSize !== undefined && part.distribution !== undefined && part.distribution.type !== DistributionType.LOGNORMAL) findings.push({ severity: "note", check: "Sample size not used", item, detail: `${part.label} is not a lognormal, so its event count adds no spread.`, target });
    }
    const comparisonProblem = estimate.comparison.find((part) => part.problem !== undefined);
    if (comparisonProblem !== undefined) findings.push({ severity: "warning", check: "Comparison incomplete", item, detail: `${comparisonProblem.label}: ${comparisonProblem.problem ?? ""}`, target });
    if (!estimate.parts.some((part) => part.part.sampleSize !== undefined && part.distribution?.type === DistributionType.LOGNORMAL) && estimate.output !== undefined) findings.push({ severity: "note", check: "Assumed spread", item, detail: "No part gives its event count, so the spread is the constrained noninformative beta.", target });
    const mean = estimate.output?.mean;
    const other = estimate.comparisonMean;
    if (mean !== undefined && other !== undefined && mean > 0 && other > 0) {
      const ratio = Math.max(mean / other, other / mean);
      if (ratio >= 2 && blank(parameter.estimateReason) && blank(basis?.basis)) findings.push({ severity: "warning", check: "Sources disagree", item, detail: `The comparison gives ${sci(other)}, ${Number(ratio.toPrecision(2))} times ${other > mean ? "higher" : "lower"} than the estimate. Say why the chosen source is preferred.`, target });
    }
  }
}

function outageFindings(da: DataAnalysis, findings: DaNeedFinding[]): void {
  const operating = da.plantStage === "OPERATIONAL";
  const states = new Map((da.dataNeeds?.states ?? []).map((state) => [state.id, state]));
  const seen = new Set<string>();
  const outages = da.outages ?? [];
  for (const outage of outages) {
    const target = { kind: "daOutage" as const, id: outage.id };
    const item = outage.id;
    if (seen.has(outage.id)) findings.push({ severity: "error", check: "Duplicate outage", item, detail: "Two outages share this ID.", target });
    seen.add(outage.id);
    if (blank(outage.evolution)) findings.push({ severity: "warning", check: "No evolution", item, detail: "Name the shutdown evolution (DA-C24).", target });
    if (blank(outage.outageType)) findings.push({ severity: "warning", check: "No outage type", item, detail: "Give the outage type, refuelling, maintenance or forced (DA-C26).", target });
    if (!(outage.hours > 0)) findings.push({ severity: "error", check: "Bad duration", item, detail: "The duration must be more than zero hours.", target });
    if (!(outage.perYear >= 0)) findings.push({ severity: "error", check: "Bad count", item, detail: "The outages per calendar year cannot be negative.", target });
    if (!operating && outage.basis === "RECORDS") findings.push({ severity: "warning", check: "Records before operation", item, detail: "A plant that does not operate has no outage records. Use the planned outage schedule.", target });
    if (operating && outage.basis === "PLANNED_SCHEDULE") findings.push({ severity: "warning", check: "Planned values", item, detail: "An operating plant collects its outage timelines and counts from experience (DA-C24, DA-C26).", target });
    if (outage.stateId === undefined) {
      findings.push({ severity: "warning", check: "No state", item, detail: "Name the operating state this outage spends its time in (POS-C1).", target });
      continue;
    }
    const state = states.get(outage.stateId);
    if (states.size > 0 && state === undefined) {
      findings.push({ severity: "warning", check: "Unknown state", item, detail: `${outage.stateId} is not among the operating states imported in Step 02.`, target });
      continue;
    }
    if (outage.valueFrom === "POS") {
      if (state === undefined) findings.push({ severity: "error", check: "State missing", item, detail: "Import the POS states in Step 02 to take the hours from POS.", target });
      else if (state.valueHeldBy === "DA") findings.push({ severity: "error", check: "Circular link", item, detail: `POS takes the hours of ${state.id} from DA's outages, and this outage takes them back from POS. One side has to own them.`, target });
      else if (outageFromPos(da, outage) === undefined) findings.push({ severity: "error", check: "No POS hours", item, detail: `POS gives ${state.id} no hours or entries a year to import.`, target });
      continue;
    }
    if (state === undefined) continue;
    if (state.entriesPerYear !== undefined && state.entriesPerYear > 0 && outage.perYear > 0 && Math.abs(outage.perYear - state.entriesPerYear) > 0.05 * state.entriesPerYear) findings.push({ severity: "warning", check: "Count differs", item, detail: `${outage.id} happens ${Number(outage.perYear.toPrecision(3))} times a year, but POS enters ${state.id} ${Number(state.entriesPerYear.toPrecision(3))} times a year (POS-C1).`, target });
    const yearly = outage.hours * outage.perYear;
    if (state.durationHours !== undefined && state.durationHours > 0 && yearly > 0 && Math.abs(yearly - state.durationHours) > 0.05 * state.durationHours) findings.push({ severity: "warning", check: "Hours differ", item, detail: `${outage.id} spends ${hoursText(yearly)} a year in ${state.id}, but POS gives it ${hoursText(state.durationHours)} a year (POS-C1).`, target });
  }
  const used = new Set(outages.flatMap((outage) => (outage.stateId === undefined ? [] : [outage.stateId])));
  const shutdown = (da.dataNeeds?.states ?? []).filter((state) => state.included && (state.mode === "REFUELING" || state.mode === "MAINTENANCE") && !used.has(state.id));
  if (operating && outages.length > 0) for (const state of shutdown) findings.push({ severity: "note", check: "State without outage", item: state.id, detail: `No outage timeline covers ${state.id} ${state.name} (DA-C24).`, target: { kind: "needState", id: state.id } });
}

function unavailabilityCheck(da: DataAnalysis): { findings: DaNeedFinding[]; pending: boolean } {
  const version = uncertaintyVersion();
  const cached = findingCache.get(da);
  if (cached !== undefined && cached.version === version) return cached.check;
  const findings: DaNeedFinding[] = [];
  const pending = { value: false };
  for (const parameter of maintenanceParameters(da)) maintenanceFindingsFor(da, parameter, findings, pending);
  for (const parameter of restorationParameters(da)) restorationFindingsFor(da, parameter, findings, pending);
  outageFindings(da, findings);
  const sorted = findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => RANK[a.finding.severity] - RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
  const check = { findings: sorted, pending: pending.value };
  findingCache.set(da, { version, check });
  return check;
}

function unavailabilityFindings(da: DataAnalysis): DaNeedFinding[] {
  return unavailabilityCheck(da).findings;
}

function scopeExcluded(da: DataAnalysis, kind: DaScopeKind): boolean {
  const decision = (da.scopeDecisions ?? []).find((candidate) => candidate.kind === kind);
  return decision !== undefined && !decision.included;
}

function unavailabilityComplete(da: DataAnalysis): boolean {
  const parameters = [...maintenanceParameters(da), ...restorationParameters(da)];
  if (parameters.length === 0 && (da.outages ?? []).length === 0) return scopeExcluded(da, "TEST_MAINTENANCE") && scopeExcluded(da, "REPAIR_RECOVERY");
  if (maintenanceParameters(da).some((parameter) => parameter.estimate === undefined)) return false;
  if (restorationParameters(da).some((parameter) => parameter.value === undefined)) return false;
  const check = unavailabilityCheck(da);
  return !check.pending && !check.findings.some((finding) => finding.severity === "error");
}

function outageUsers(da: DataAnalysis, stateId: string): DaOutage[] {
  return (da.outages ?? []).filter((outage) => outage.stateId === stateId);
}

export {
  coincidentParameters,
  isMaintenanceParameter,
  isRestorationParameter,
  maintenanceEstimate,
  maintenanceMethodOf,
  maintenanceParameters,
  maintenanceSpread,
  outageUsers,
  restorationEstimate,
  restorationMethodOf,
  restorationParameters,
  survivalAt,
  survivalCurve,
  survivalMoments,
  trainParameters,
  unavailabilityComplete,
  unavailabilityFindings,
  withUnavailability,
  type DaMaintenanceEstimate,
  type DaPartResult,
  type DaRecordFit,
  type DaRestorationEstimate,
  type DaStepMethod,
  type DaUnavailabilityFit,
  type DaUnavailabilityOutput,
};
