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
import { distributionCdf, distributionMean, distributionQuantile, distributionVariance, gammaQ, normalCdf, scaleDistribution, validDistribution } from "./daDistributions";
import { betaFromMoments, constrainedNoninformative } from "./daEstimates";
import { entryDistribution, parameterPrior, sourceUseBase, sourceUseResult } from "./daSourcing";
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
  published?: ParameterDistribution;
  output?: DaUnavailabilityOutput;
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
  problem?: string;
}

const maintenanceCache = new WeakMap<DataAnalysis, Map<string, DaMaintenanceEstimate>>();

const restorationCache = new WeakMap<DataAnalysis, Map<string, DaRestorationEstimate>>();

const findingCache = new WeakMap<DataAnalysis, DaNeedFinding[]>();

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
  return parameter.valueMode === "TYPED" || (parameter.valueMode === undefined && parameter.value !== undefined);
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

function activityVariance(activity: DaMaintenanceActivity): number {
  const low = activity.hoursLow;
  const high = activity.hoursHigh;
  if (low === undefined || high === undefined || !(low > 0) || !(high > low)) return 0;
  const sigma = Math.log(high / low) / (2 * Z95);
  return activity.hoursEach * activity.hoursEach * Math.expm1(sigma * sigma);
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
  let byParameter = maintenanceCache.get(da);
  if (byParameter === undefined) {
    byParameter = new Map();
    maintenanceCache.set(da, byParameter);
  }
  const cached = byParameter.get(parameter.uuid);
  if (cached !== undefined) return cached;
  const estimate = computeMaintenance(da, parameter, 0);
  byParameter.set(parameter.uuid, estimate);
  return estimate;
}

function computeMaintenance(da: DataAnalysis, parameter: DataAnalysisParameter, depth: number): DaMaintenanceEstimate {
  const basis = parameter.maintenance;
  const kind = basis?.kind ?? "TRAIN";
  const trains = kind === "COINCIDENT" ? 1 : basis?.trains ?? 1;
  const method = maintenanceMethodOf(parameter);
  const base: DaMaintenanceEstimate = { kind, method, trains, counted: [], left: [] };
  if (method === undefined) return { ...base, problem: "Choose how the unavailability is found." };
  if (method === "TYPED") {
    const output = typedOutput(parameter);
    return output === undefined ? { ...base, problem: "Type the unavailability." } : { ...base, output };
  }
  if (!(trains > 0)) return { ...base, problem: "The number of trains must be more than zero." };
  if (method === "GENERIC") {
    const prior = parameterPrior(da, parameter);
    if (prior === undefined) return { ...base, problem: "No published value. Choose it in Step 04 Applicability." };
    if (prior.quantity !== "FRACTION") return { ...base, problem: "The published value is not a fraction of time out of service." };
    const mean = prior.mean * trains;
    const withPublished = { ...base, perTrain: prior.mean, published: prior.distribution };
    if (!(mean > 0 && mean < 1)) return { ...withPublished, problem: "The trains times the published value must lie between 0 and 1." };
    if (prior.distribution.type === DistributionType.BETA) {
      const scaled = scaleDistribution(prior.distribution, trains);
      if (scaled !== undefined) return { ...withPublished, output: summarize(distributionMean(scaled) ?? mean, scaled, "PUBLISHED") };
    }
    const variance = (distributionVariance(prior.distribution) ?? 0) * trains * trains;
    const output = probabilityOutput(mean, variance);
    return output === undefined ? { ...withPublished, problem: "The published value cannot be summarized." } : { ...withPublished, output };
  }
  const required = basis?.requiredHoursPerYear;
  if (required === undefined || !(required > 0)) return { ...base, problem: "Enter the hours a year the function is required." };
  const counted: DaCountedItem[] = [];
  const left: DaLeftItem[] = [];
  let variance = 0;
  if (method === "PLANNED") {
    for (const activity of basis?.activities ?? []) {
      const label = blank(activity.activity) ? activity.id : activity.activity;
      if (!activity.disablesFunction) left.push({ id: activity.id, label, why: "NOT_DISABLING" });
      else if (!blank(activity.chargedTo)) left.push({ id: activity.id, label, why: "SUPPORT", chargedTo: activity.chargedTo });
      else if (activity.perYear >= 0 && activity.hoursEach >= 0) {
        counted.push({ id: activity.id, label, hours: activity.perYear * activity.hoursEach });
        variance += activity.perYear * activity.perYear * activityVariance(activity);
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
  const scale = trains / requiredHours;
  const output = probabilityOutput(mean, variance * scale * scale);
  return output === undefined ? { ...filled, problem: "The unavailability cannot be summarized." } : { ...filled, output };
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

function partWeight(da: DataAnalysis, part: DaRestorationPart): { weight?: number; problem?: string } {
  if (part.weightSourceId !== undefined || part.weightEntryId !== undefined) {
    const entry = entryOf(da, part.weightSourceId, part.weightEntryId);
    if (entry === undefined) return { problem: "Pick the frequency that weights this part." };
    if (entry.quantity !== "PER_YEAR") return { problem: `${entry.id} is not a frequency per year.` };
    const distribution = entryDistribution(entry);
    const mean = distribution === undefined ? undefined : distributionMean(distribution);
    return mean !== undefined && mean > 0 ? { weight: mean } : { problem: `${entry.id} has no positive mean frequency.` };
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

function evaluateParts(da: DataAnalysis, parameter: DataAnalysisParameter, parts: readonly DaRestorationPart[], window: number | undefined): { results: DaPartResult[]; mean?: number; variance?: number; problem?: string } {
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
    if (weighted.problem !== undefined) return { ...withWeight, problem: weighted.problem };
    if (window === undefined) return withWeight;
    const moments = survivalMoments(result.distribution, window, part.sampleSize);
    if (moments === undefined) return { ...withWeight, problem: "This source gives one value, not a time distribution." };
    return { ...withWeight, survival: moments.survival, mean: moments.mean, variance: moments.variance };
  });
  if (results.length === 0) return { results };
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
  let byParameter = restorationCache.get(da);
  if (byParameter === undefined) {
    byParameter = new Map();
    restorationCache.set(da, byParameter);
  }
  const cached = byParameter.get(parameter.uuid);
  if (cached !== undefined) return cached;
  const estimate = computeRestoration(da, parameter);
  byParameter.set(parameter.uuid, estimate);
  return estimate;
}

function computeRestoration(da: DataAnalysis, parameter: DataAnalysisParameter): DaRestorationEstimate {
  const basis = parameter.restoration;
  const kind = basis?.kind ?? "RECOVERY";
  const method = restorationMethodOf(parameter);
  const window = basis?.windowHours !== undefined && basis.windowHours > 0 ? basis.windowHours : undefined;
  const base: DaRestorationEstimate = { kind, method, window, parts: [], comparison: [] };
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
  const withParts: DaRestorationEstimate = { ...base, parts: primary.results, comparison: comparison.results, comparisonMean: comparison.problem === undefined ? comparison.mean : undefined };
  if (primary.results.length === 0) return { ...withParts, problem: "Add the source parts the estimate is built from." };
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

function withUnavailability(input: DataAnalysis): DataAnalysis {
  const da = withOutagesFromPos(input);
  let changed = false;
  const parameters = da.parameters.map((parameter) => {
    if (parameter.valueMode !== "CALCULATED") return parameter;
    const output = isMaintenanceParameter(parameter) ? maintenanceEstimate(da, parameter).output : isRestorationParameter(parameter) ? restorationEstimate(da, parameter).output : undefined;
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

function maintenanceFindingsFor(da: DataAnalysis, parameter: DataAnalysisParameter, findings: DaNeedFinding[]): void {
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
    if (parameter.value === undefined) findings.push({ severity: "error", check: "No value", item, detail: "Type the unavailability, or let DA calculate it.", target });
    const distribution = parameter.uncertainty?.distribution;
    if (distribution === undefined || distribution.type === DistributionType.POINT_ESTIMATE) findings.push({ severity: "warning", check: "No uncertainty", item, detail: "Give the typed unavailability a distribution (DA-D3).", target });
    if (blank(parameter.estimateReason) && blank(basis?.basis)) findings.push({ severity: "warning", check: "No basis", item, detail: "Say where the typed unavailability comes from.", target });
    return;
  }
  if (estimate.problem !== undefined) findings.push({ severity: "error", check: "Cannot estimate", item, detail: estimate.problem, target: estimate.problem.startsWith("No published value") ? { kind: "daSourcing", id: parameter.uuid } : target });
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

function restorationFindingsFor(da: DataAnalysis, parameter: DataAnalysisParameter, findings: DaNeedFinding[]): void {
  const item = parameter.uuid;
  const target = { kind: "daRestoration" as const, id: parameter.uuid };
  const basis = parameter.restoration;
  const estimate = restorationEstimate(da, parameter);
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

function unavailabilityFindings(da: DataAnalysis): DaNeedFinding[] {
  const cached = findingCache.get(da);
  if (cached !== undefined) return cached;
  const findings: DaNeedFinding[] = [];
  for (const parameter of maintenanceParameters(da)) maintenanceFindingsFor(da, parameter, findings);
  for (const parameter of restorationParameters(da)) restorationFindingsFor(da, parameter, findings);
  outageFindings(da, findings);
  const sorted = findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => RANK[a.finding.severity] - RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
  findingCache.set(da, sorted);
  return sorted;
}

function scopeExcluded(da: DataAnalysis, kind: DaScopeKind): boolean {
  const decision = (da.scopeDecisions ?? []).find((candidate) => candidate.kind === kind);
  return decision !== undefined && !decision.included;
}

function unavailabilityComplete(da: DataAnalysis): boolean {
  const parameters = [...maintenanceParameters(da), ...restorationParameters(da)];
  if (parameters.length === 0 && (da.outages ?? []).length === 0) return scopeExcluded(da, "TEST_MAINTENANCE") && scopeExcluded(da, "REPAIR_RECOVERY");
  if (parameters.some((parameter) => parameter.value === undefined)) return false;
  return !unavailabilityFindings(da).some((finding) => finding.severity === "error");
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
