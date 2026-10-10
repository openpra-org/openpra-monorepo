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
import {
  canonicalJson,
  lawWithinUnit,
  type BaseLaw,
  type DurationModel,
  type DurationPrior,
  type Law,
  type MixtureLaw,
  type ProductLaw,
  type TruncatedLaw,
  type UncertainExpression,
} from "interfaces-mef-types/core/uncertainty";
import { normalQuantile } from "./daDistributions";
import { expressionSpread, lawSummary, operationLaw, parameterPriorLaw, quantityUnit, sourceUseLaw, type DaSpread } from "./daLaws";
import { hasSpread } from "./daFailures";
import { sourceUseBase } from "./daSourcing";
import { uncertaintyVersion, type UncertaintyState } from "../newly-developed-methods/shared/useUncertainty";
import type { DaFindingSeverity, DaNeedFinding } from "./daSelectors";

const RANK: Record<DaFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const NO_WINDOW = "Enter the time available.";

const RESTORATION_MODEL: DurationModel = "LOGNORMAL";

const OUTAGE_MODEL: DurationModel = "EXPONENTIAL";

type DaStepMethod = DaMaintenanceMethod | DaRestorationFrom | "TYPED";

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
  outages?: number;
  meanHours?: number;
  durationModel?: DurationModel;
  published?: Law;
  estimate?: UncertainExpression;
  cutShift?: number;
  pending: boolean;
  problem?: string;
}

interface DaDurationPrior {
  model: DurationModel;
  priors: DurationPrior[];
}

interface DaWeightedPrior {
  weight: number;
  prior: DaDurationPrior;
}

interface DaPartResult {
  part: DaRestorationPart;
  label: string;
  source?: Law;
  priors?: DaWeightedPrior[];
  rawWeight?: number;
  weight?: number;
  pending?: boolean;
  problem?: string;
}

interface DaRestorationEstimate {
  kind: DaRestorationKind;
  method?: DaRestorationFrom | "TYPED";
  window?: number;
  model?: DurationModel;
  times: number[];
  censored: number[];
  parts: DaPartResult[];
  comparison: DaPartResult[];
  estimate?: UncertainExpression;
  spread?: DaSpread;
  comparisonMean?: number;
  pending: boolean;
  problem?: string;
}

interface DaSurvivalSeries {
  key: string;
  label: string;
  values: number[];
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

function probabilityValue(law: Law): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law } };
}

function operation(kind: "ADD" | "SUBTRACT" | "MULTIPLY" | "DIVIDE", operands: UncertainExpression[]): UncertainExpression {
  return { node: "OPERATION", operation: kind, operands };
}

function timesTrains(expression: UncertainExpression, trains: number): UncertainExpression {
  return trains === 1 ? expression : operation("MULTIPLY", [factorValue(trains), expression]);
}

function plannedExpression(activities: readonly DaMaintenanceActivity[], overlapHours: number, requiredHours: number, trains: number): UncertainExpression {
  const terms = activities.map((activity) => (activity.perYear === 1 ? hoursValue(hoursLaw(activity)) : operation("MULTIPLY", [factorValue(activity.perYear), hoursValue(hoursLaw(activity))])));
  const first = terms[0];
  const total: UncertainExpression = terms.length === 1 && first !== undefined ? first : operation("ADD", terms);
  const net: UncertainExpression = overlapHours > 0 ? operation("SUBTRACT", [total, hoursValue({ family: "POINT", value: overlapHours })]) : total;
  return timesTrains(operation("DIVIDE", [net, hoursValue({ family: "POINT", value: requiredHours })]), trains);
}

function constrainedExpression(mean: number): UncertainExpression {
  return fractionValue({ family: "CONSTRAINED_NONINFORMATIVE", mean });
}

function outageExpression(outages: number, requiredHours: number, durations: readonly number[], model: DurationModel, trains: number): UncertainExpression {
  const frequency: UncertainExpression = { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POSTERIOR", prior: null, evidence: [{ likelihood: "POISSON", failures: outages, exposure: requiredHours }] } } };
  const duration = hoursValue({ family: "DURATION", model, times: [...durations], censored: [], priors: [], output: { kind: "MEAN" } });
  const ratio = operation("ADD", [factorValue(1), operation("MULTIPLY", [frequency, duration])]);
  return timesTrains(operation("SUBTRACT", [factorValue(1), operation("DIVIDE", [factorValue(1), ratio])]), trains);
}

function priorLaw(law: Law): BaseLaw | TruncatedLaw | MixtureLaw | ProductLaw | undefined {
  switch (law.family) {
    case "POSTERIOR":
    case "POPULATION":
    case "EMPIRICAL_BAYES":
    case "DURATION":
    case "TREND":
      return undefined;
    case "POINT":
      return { family: "CONSTRAINED_NONINFORMATIVE", mean: law.value };
    default:
      return law;
  }
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

function scaledEstimate(base: DaMaintenanceEstimate, law: Law, mean: number, trains: number, what: string): DaMaintenanceEstimate {
  if (trains === 1) return { ...base, estimate: fractionValue(law) };
  const scaled = operationLaw({ kind: "SCALE", law, factor: trains });
  if (scaled.status === "pending") return { ...base, pending: true };
  if (scaled.status === "failed") return { ...base, problem: `PRAXIS could not scale the ${what}: ${scaled.error}` };
  if (scaled.status === "missing") return { ...base, problem: scaled.problem };
  const kept = lawWithinUnit("FRACTION", scaled.law);
  if (kept === scaled.law) return { ...base, estimate: fractionValue(kept) };
  const cut = expressionSpread(fractionValue(kept), "FRACTION");
  if (cut.status === "pending") return { ...base, pending: true };
  if (cut.status === "failed") return { ...base, problem: `PRAXIS could not summarize the scaled value: ${cut.error}` };
  return { ...base, estimate: fractionValue(kept), cutShift: 1 - cut.value.mean / mean };
}

function lawEstimate(base: DaMaintenanceEstimate, law: Law, trains: number, what: string): DaMaintenanceEstimate {
  const spread = expressionSpread(fractionValue(law), "FRACTION");
  if (spread.status === "pending") return { ...base, pending: true };
  if (spread.status === "failed") return { ...base, problem: `PRAXIS could not summarize the ${what}: ${spread.error}` };
  const perTrain = spread.value.mean;
  const mean = perTrain * trains;
  const withMean: DaMaintenanceEstimate = { ...base, perTrain };
  if (!(mean > 0 && mean < 1)) return { ...withMean, problem: `The trains times the ${what} must lie between 0 and 1.` };
  if (law.family === "POINT") return { ...withMean, estimate: constrainedExpression(mean) };
  return scaledEstimate(withMean, law, mean, trains, what);
}

function publishedLaw(da: DataAnalysis, parameter: DataAnalysisParameter, base: DaMaintenanceEstimate): Law | DaMaintenanceEstimate {
  const prior = parameterPriorLaw(da, parameter);
  if (prior.status === "pending") return { ...base, pending: true };
  if (prior.status === "failed") return { ...base, problem: `PRAXIS could not form the published value: ${prior.error}` };
  if (prior.status === "missing") return { ...base, problem: prior.problem.startsWith("No prior") ? "No published value. Choose it in Step 04 Applicability." : prior.problem };
  if (prior.value.quantity !== "FRACTION") return { ...base, problem: "The published value is not a fraction of time out of service." };
  return prior.value.law;
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
    const published = publishedLaw(da, parameter, base);
    if (!("family" in published)) return published;
    return lawEstimate({ ...base, published }, published, trains, "published value");
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
  const recorded = method === "RECORDS" || method === "BAYES";
  const years = recorded ? yearsBetween(da.dataPlan?.dataWindowStart, da.dataPlan?.dataWindowEnd) : undefined;
  const countedHours = sum(counted.map((item) => item.hours));
  const durations = counted.map((item) => item.hours).filter((hours) => hours > 0);
  const withCounts: DaMaintenanceEstimate = { ...base, counted, left, countedHours, years, ...(recorded ? { outages: durations.length, ...(durations.length > 0 ? { meanHours: countedHours / durations.length } : {}) } : {}) };
  if (recorded && years === undefined) return { ...withCounts, problem: "Records are counted over the data window. Set it in Step 01." };
  const span = recorded ? years ?? 1 : 1;
  const overlapHours = kind === "TRAIN" ? overlapHoursOf(da, parameter, depth) * span : 0;
  const requiredHours = required * span;
  const perTrain = (countedHours - overlapHours) / requiredHours;
  const filled: DaMaintenanceEstimate = { ...withCounts, overlapHours, requiredHours, perTrain };
  if (counted.length === 0) return { ...filled, problem: method === "PLANNED" ? "No activity takes the function out of service." : "No record takes the function out of service." };
  if (perTrain < 0) return { ...filled, problem: "The coincident hours taken out are more than the train's own hours." };
  const mean = perTrain * trains;
  if (!(mean > 0)) return { ...filled, problem: "The hours out of service add up to zero." };
  if (!(mean < 1)) return { ...filled, problem: "The function is out of service for more hours than it is required." };
  if (method === "PLANNED") {
    const spread = activities.some((activity) => hoursLaw(activity).family !== "POINT");
    return { ...filled, estimate: spread ? plannedExpression(activities, overlapHours, requiredHours, trains) : constrainedExpression(mean) };
  }
  const meanHours = countedHours / durations.length;
  const net = (countedHours - overlapHours) / countedHours;
  if (method === "BAYES") {
    const published = publishedLaw(da, parameter, filled);
    if (!("family" in published)) return published;
    const prior = priorLaw(published);
    const withPublished: DaMaintenanceEstimate = { ...filled, published, perTrain: undefined };
    if (prior === undefined) return { ...withPublished, problem: "The published value is already updated with data, so it cannot be a prior here." };
    const updated: Law = { family: "POSTERIOR", prior, evidence: [{ likelihood: "BINOMIAL", failures: (countedHours - overlapHours) / meanHours, exposure: requiredHours / meanHours }] };
    return lawEstimate(withPublished, updated, trains, "updated value");
  }
  const durationModel = basis?.durationModel ?? OUTAGE_MODEL;
  const withModel: DaMaintenanceEstimate = { ...filled, durationModel };
  if (durations.length < 2) return { ...withModel, problem: "The outage duration needs two or more records with hours." };
  if (durationModel !== "EXPONENTIAL" && new Set(durations).size < 2) return { ...withModel, problem: "The outage hours are all the same, so they give no spread for this model." };
  return { ...withModel, estimate: outageExpression(durations.length * net, requiredHours, durations, durationModel, trains) };
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

function point(value: number): BaseLaw {
  return { family: "POINT", value };
}

function lognormalPrior(mu: number, sigma: number, sampleSize: number | undefined): DaDurationPrior {
  const location: BaseLaw = sampleSize !== undefined && sampleSize >= 1 ? { family: "NORMAL", mean: mu, standardDeviation: sigma / Math.sqrt(sampleSize) } : point(mu);
  return { model: "LOGNORMAL", priors: [{ parameter: "MU", law: location }, { parameter: "SIGMA", law: point(sigma) }] };
}

function metalogPrior(law: Extract<Law, { family: "METALOG" }>, sampleSize: number | undefined): DaDurationPrior | string {
  const at = (probability: number): number | undefined => law.points.find((entry) => entry.probability === probability)?.value;
  const low = at(0.05);
  const median = at(0.5);
  const high = at(0.95);
  if (law.points.length !== 3 || low === undefined || median === undefined || high === undefined || !(low > 0 && median > low && high > median)) return "This judgment gives no 5th, 50th and 95th percentile time to fit.";
  return lognormalPrior(Math.log(median), Math.log(high / low) / (2 * normalQuantile(0.95)), sampleSize);
}

function durationPrior(law: Law, sampleSize: number | undefined): DaWeightedPrior[] | string {
  if (law.family !== "MIXTURE") {
    const single = singleDurationPrior(law, sampleSize);
    return typeof single === "string" ? single : [{ weight: 1, prior: single }];
  }
  const total = law.components.reduce((sum, component) => sum + component.weight, 0);
  if (!(total > 0)) return "The mixture weights add up to zero.";
  const parts: DaWeightedPrior[] = [];
  for (const component of law.components) {
    if (!(component.weight > 0)) continue;
    const single = singleDurationPrior(component.law, sampleSize);
    if (typeof single === "string") return single;
    parts.push({ weight: component.weight / total, prior: single });
  }
  return parts;
}

function singleDurationPrior(law: Law, sampleSize: number | undefined): DaDurationPrior | string {
  switch (law.family) {
    case "LOGNORMAL": {
      const sigma = law.level > 0.5 && law.level < 1 ? Math.log(law.errorFactor) / normalQuantile(law.level) : Number.NaN;
      if (!(sigma > 0) || !(law.mean > 0)) return "This source gives no spread of the time.";
      return lognormalPrior(Math.log(law.mean) - (sigma * sigma) / 2, sigma, sampleSize);
    }
    case "METALOG":
      return metalogPrior(law, sampleSize);
    case "GAMMA":
      return { model: "GAMMA", priors: [{ parameter: "SHAPE", law: point(law.shape) }, { parameter: "RATE", law: point(law.rate) }] };
    case "WEIBULL":
      if (law.location !== 0) return "A Weibull time that starts after zero cannot be updated.";
      return { model: "WEIBULL", priors: [{ parameter: "SHAPE", law: point(law.shape) }, { parameter: "SCALE", law: point(law.scale) }] };
    case "POINT":
      return "This source gives one value, not a time distribution.";
    default:
      return "This source is not a lognormal, gamma, Weibull or three-percentile time.";
  }
}

function durationLaw(prior: DaDurationPrior, times: readonly number[], censored: readonly number[], at: number): Law {
  return { family: "DURATION", model: prior.model, times: [...times], censored: [...censored], priors: prior.priors, output: { kind: "EXCEEDANCE", time: at } };
}

function evaluateParts(da: DataAnalysis, parameter: DataAnalysisParameter, parts: readonly DaRestorationPart[]): { results: DaPartResult[]; pending?: boolean; problem?: string } {
  const results: DaPartResult[] = parts.map((part) => {
    const label = partLabel(da, parameter, part);
    const use = (parameter.sourceUses ?? []).find((candidate) => candidate.id === part.useId);
    if (use === undefined) return { part, label, problem: "Pick the source this part uses." };
    if (use.verdict === "REJECTED") return { part, label, problem: "This source is marked as not applying." };
    if (sourceUseBase(da, use) === undefined) return { part, label, problem: "The source or estimate no longer exists." };
    const state = sourceUseLaw(da, use);
    if (state.status === "pending") return { part, label, pending: true };
    if (state.status === "failed") return { part, label, problem: `PRAXIS could not read the source: ${state.error}` };
    if (state.status === "missing") return { part, label, problem: state.problem };
    if (state.value.quantity !== "HOURS") return { part, label, problem: "This source is not a time in hours." };
    const priors = durationPrior(state.value.law, part.sampleSize);
    const weighted = partWeight(da, part);
    const withSource: DaPartResult = { part, label, source: state.value.law, rawWeight: weighted.weight };
    if (typeof priors === "string") return { ...withSource, problem: priors };
    if (weighted.pending === true) return { ...withSource, priors, pending: true };
    if (weighted.problem !== undefined) return { ...withSource, priors, problem: weighted.problem };
    return { ...withSource, priors };
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
  return { results: results.map((result, index) => ({ ...result, weight: (raw[index] ?? 0) / total })) };
}

function partsExpression(parts: readonly DaPartResult[], times: readonly number[], censored: readonly number[], at: number): UncertainExpression | undefined {
  if (parts.some((part) => part.priors === undefined || part.priors.length === 0)) return undefined;
  const weighted = parts.flatMap((part) => (part.priors ?? []).map((entry) => ({ weight: (parts.length === 1 ? 1 : part.weight ?? 0) * entry.weight, prior: entry.prior })));
  const terms = weighted.map((entry) => {
    const value = probabilityValue(durationLaw(entry.prior, times, censored, at));
    return weighted.length === 1 ? value : operation("MULTIPLY", [factorValue(entry.weight), value]);
  });
  const first = terms[0];
  if (first === undefined) return undefined;
  return terms.length === 1 ? first : operation("ADD", terms);
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

function withSpread(base: DaRestorationEstimate, estimate: UncertainExpression): DaRestorationEstimate {
  const spread = expressionSpread(estimate, "PROBABILITY");
  if (spread.status === "pending") return { ...base, estimate, pending: true };
  if (spread.status === "failed") return { ...base, estimate, problem: `PRAXIS could not compute the chance of not restoring: ${spread.error}` };
  return { ...base, estimate, spread: spread.value };
}

function computeRestoration(da: DataAnalysis, parameter: DataAnalysisParameter): DaRestorationEstimate {
  const basis = parameter.restoration;
  const kind = basis?.kind ?? "RECOVERY";
  const method = restorationMethodOf(parameter);
  const window = basis?.windowHours !== undefined && basis.windowHours > 0 ? basis.windowHours : undefined;
  const records = (basis?.times ?? []).filter((time) => time.hours > 0);
  const times = records.filter((time) => time.censored !== true).map((time) => time.hours);
  const censored = records.filter((time) => time.censored === true).map((time) => time.hours);
  const base: DaRestorationEstimate = { kind, method, window, times, censored, parts: [], comparison: [], pending: false };
  if (method === undefined) return { ...base, problem: "Choose how the chance of not restoring is found." };
  if (method === "TYPED") return parameter.estimate === undefined ? { ...base, problem: "Type the probability." } : withSpread(base, parameter.estimate);
  if (method === "RECORDS") {
    const model = basis?.model ?? RESTORATION_MODEL;
    const withModel: DaRestorationEstimate = { ...base, model };
    if (model === "EXPONENTIAL" ? times.length < 1 : times.length < 2) return { ...withModel, problem: model === "EXPONENTIAL" ? "The model needs at least one completed restoration time." : "The model needs at least two completed restoration times." };
    if (model !== "EXPONENTIAL" && new Set(times).size < 2) return { ...withModel, problem: "The times are all the same, so they give no spread." };
    if (window === undefined) return { ...withModel, problem: NO_WINDOW };
    return withSpread(withModel, probabilityValue(durationLaw({ model, priors: [] }, times, censored, window)));
  }
  const primary = evaluateParts(da, parameter, basis?.parts ?? []);
  const comparison = evaluateParts(da, parameter, basis?.comparison ?? []);
  const comparisonExpression = window === undefined || comparison.problem !== undefined || comparison.pending === true ? undefined : partsExpression(comparison.results, [], [], window);
  const comparisonSpread = comparisonExpression === undefined ? undefined : expressionSpread(comparisonExpression, "PROBABILITY");
  const withParts: DaRestorationEstimate = {
    ...base,
    parts: primary.results,
    comparison: comparison.results,
    ...(comparisonSpread?.status === "ready" ? { comparisonMean: comparisonSpread.value.mean } : {}),
    pending: primary.pending === true || comparison.pending === true || comparisonSpread?.status === "pending",
  };
  if (primary.results.length === 0) return { ...withParts, problem: "Add the source parts the estimate is built from." };
  if (primary.pending === true) return withParts;
  if (primary.problem !== undefined) return { ...withParts, problem: primary.problem };
  if (window === undefined) return { ...withParts, problem: NO_WINDOW };
  const estimate = partsExpression(primary.results, times, censored, window);
  return estimate === undefined ? { ...withParts, problem: "A part gives no time distribution." } : withSpread(withParts, estimate);
}

function curveOf(prior: DaDurationPrior, times: readonly number[], censored: readonly number[], hours: readonly number[]): number[] | "pending" | undefined {
  const values: number[] = [];
  let pending = false;
  for (const at of hours) {
    const state = lawSummary("PROBABILITY", durationLaw(prior, times, censored, at));
    if (state.status === "pending") pending = true;
    else if (state.status === "failed") return undefined;
    else values.push(state.value.mean);
  }
  return pending ? "pending" : values;
}

function weightedCurve(curves: readonly (readonly number[])[], weights: readonly number[], hours: readonly number[]): number[] {
  return hours.map((_, index) => sum(curves.map((values, part) => (weights[part] ?? 0) * (values[index] ?? 0))));
}

function partCurves(parts: readonly DaPartResult[], times: readonly number[], censored: readonly number[], hours: readonly number[]): number[][] | "pending" | undefined {
  const curves: number[][] = [];
  let pending = false;
  for (const part of parts) {
    if (part.priors === undefined || part.problem !== undefined) return undefined;
    const components: number[][] = [];
    for (const entry of part.priors) {
      const curve = curveOf(entry.prior, times, censored, hours);
      if (curve === undefined) return undefined;
      if (curve === "pending") pending = true;
      else components.push(curve);
    }
    if (components.length === part.priors.length) curves.push(weightedCurve(components, part.priors.map((entry) => entry.weight), hours));
  }
  return pending ? "pending" : curves;
}

function survivalCurve(da: DataAnalysis, parameter: DataAnalysisParameter, hours: readonly number[]): { series: DaSurvivalSeries[]; pending: boolean } {
  const estimate = restorationEstimate(da, parameter);
  const updated = estimate.times.length + estimate.censored.length > 0;
  if (estimate.method === "RECORDS" && estimate.model !== undefined && estimate.problem === undefined) {
    const curve = curveOf({ model: estimate.model, priors: [] }, estimate.times, estimate.censored, hours);
    if (curve === "pending") return { series: [], pending: true };
    return { series: curve === undefined ? [] : [{ key: "RECORDS", label: "From the times", values: curve }], pending: false };
  }
  if (estimate.method !== "SOURCES" || estimate.parts.length === 0) return { series: [], pending: false };
  const primary = partCurves(estimate.parts, estimate.times, estimate.censored, hours);
  const comparison = estimate.comparison.length === 0 ? [] : partCurves(estimate.comparison, [], [], hours);
  if (primary === "pending" || comparison === "pending") return { series: [], pending: true };
  if (primary === undefined) return { series: [], pending: false };
  const series: DaSurvivalSeries[] = [];
  const weights = estimate.parts.map((part) => part.weight ?? 0);
  if (primary.length > 1) series.push({ key: "WEIGHTED", label: updated ? "Weighted, updated" : "Weighted", values: weightedCurve(primary, weights, hours) });
  primary.forEach((values, index) => series.push({ key: `PART-${index}`, label: `${estimate.parts[index]?.label ?? ""}${updated ? ", updated" : ""}`, values }));
  if (comparison !== undefined && comparison.length > 0) series.push({ key: "COMPARISON", label: "Comparison", values: weightedCurve(comparison, estimate.comparison.map((part) => part.weight ?? 0), hours) });
  return { series, pending: false };
}

function sameNumber(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a === b || Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));
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

function withEstimate(parameter: DataAnalysisParameter, expression: UncertainExpression | undefined): DataAnalysisParameter {
  if (expression === undefined) return parameter;
  if (parameter.estimate !== undefined && canonicalJson(parameter.estimate) === canonicalJson(expression) && parameter.value === undefined && parameter.valueType === undefined && parameter.uncertainty === undefined) return parameter;
  const next: DataAnalysisParameter = { ...parameter, estimate: expression };
  delete next.value;
  delete next.valueType;
  delete next.uncertainty;
  return next;
}

function settledExpression(estimate: { estimate?: UncertainExpression; pending: boolean; problem?: string }): UncertainExpression | undefined {
  return estimate.pending || estimate.problem !== undefined ? undefined : estimate.estimate;
}

function withUnavailability(input: DataAnalysis): DataAnalysis {
  const da = withOutagesFromPos(input);
  let changed = false;
  const parameters = da.parameters.map((parameter) => {
    if (parameter.valueMode !== "CALCULATED") return parameter;
    const expression = isMaintenanceParameter(parameter) ? settledExpression(maintenanceEstimate(da, parameter)) : isRestorationParameter(parameter) ? settledExpression(restorationEstimate(da, parameter)) : undefined;
    const next = withEstimate(parameter, expression);
    if (next !== parameter) changed = true;
    return next;
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
  if (method === "GENERIC" || method === "BAYES") {
    if (!operating && blank(basis?.basis)) findings.push({ severity: "warning", check: "Generic value not justified", item, detail: "Say why the published value fits this design and its maintenance program (DA-C14).", target });
    if (operating && method === "GENERIC") findings.push({ severity: "warning", check: "Generic value", item, detail: "An operating plant counts its own time out of service (DA-C13, DA-C16).", target });
  }
  if (method === "PLANNED" && operating) findings.push({ severity: "warning", check: "Planned values", item, detail: "An operating plant counts the actual time out of service, not the plan (DA-C16).", target });
  if ((method === "RECORDS" || method === "BAYES") && !operating && (parameter.evidenceKind ?? "PLANT_RECORDS") === "PLANT_RECORDS") findings.push({ severity: "warning", check: "Records before operation", item, detail: "A plant that does not operate has no records of its own. Use the planned program and record its assumptions (DA-C17).", target });
  if (method !== "GENERIC" && basis?.requiredHoursPerYear !== undefined && blank(basis.requiredReason)) findings.push({ severity: "warning", check: "No reason for the required hours", item, detail: "Say which operating states the required hours cover.", target });
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
  if (method === "RECORDS" || method === "BAYES") {
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
    const recorded = trainParameters(da).filter((train) => (maintenanceMethodOf(train) === "RECORDS" || maintenanceMethodOf(train) === "BAYES") && train.systemReference !== undefined && train.systemReference === parameter.systemReference && !(train.maintenance?.overlapIds ?? []).includes(parameter.uuid));
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
    if (parameter.estimate === undefined) findings.push({ severity: "error", check: "No value", item, detail: "Type the probability, or let DA calculate it.", target });
    else if (!hasSpread(parameter.estimate)) findings.push({ severity: "warning", check: "No uncertainty", item, detail: "Give the typed probability a distribution (DA-D3).", target });
    if (blank(parameter.estimateReason) && blank(basis?.basis)) findings.push({ severity: "warning", check: "No basis", item, detail: "Say where the typed probability comes from.", target });
  }
  if (basis?.windowHours === undefined || !(basis.windowHours > 0)) findings.push({ severity: method === "TYPED" ? "warning" : "error", check: "No time window", item, detail: `Enter the time available for the ${noun} in its operating state and sequence (DA-D6).`, target });
  else if (blank(basis.windowReason)) findings.push({ severity: "warning", check: "No window reason", item, detail: "Say where the time available comes from (DA-D6).", target });
  if (blank(basis?.sequence)) findings.push({ severity: "warning", check: "No sequence", item, detail: `Name the operating state and sequence the ${noun} is credited in (DA-D6).`, target });
  const states = parameter.stateIds ?? (parameter.plantOperatingStateRef === undefined ? [] : [parameter.plantOperatingStateRef]);
  if (states.length > 1) findings.push({ severity: "note", check: "One window for several states", item, detail: `One window serves ${states.join(", ")}. ${kind === "REPAIR" ? "Repair" : "Recovery"} depends on the operating state, so check it holds in each (DA-D6).`, target });
  if (method === "TYPED") return;
  if (estimate.problem !== undefined && estimate.problem !== NO_WINDOW) findings.push({ severity: "error", check: "Cannot estimate", item, detail: estimate.problem, target });
  const records = basis?.times ?? [];
  if (method === "RECORDS" || records.length > 0) {
    if (!operating && (parameter.evidenceKind ?? "PLANT_RECORDS") === "PLANT_RECORDS") findings.push({ severity: "warning", check: "Records before operation", item, detail: kind === "REPAIR" ? "A plant that does not operate has no repair records. Use applicable industry experience and record its basis (DA-C21)." : "A plant that does not operate has no recovery records. Use generic data (DA-C23).", target });
    for (const time of records) if (!(time.hours > 0)) findings.push({ severity: "error", check: "Bad time", item, detail: `Time ${time.id} must be more than zero hours.`, target });
  }
  if (method === "SOURCES") {
    for (const part of [...estimate.parts, ...estimate.comparison]) {
      if (part.part.sampleSize !== undefined && part.priors !== undefined && part.priors.every((entry) => entry.prior.model !== "LOGNORMAL")) findings.push({ severity: "note", check: "Sample size not used", item, detail: `${part.label} is not a lognormal, so its event count adds no spread.`, target });
    }
    const comparisonProblem = estimate.comparison.find((part) => part.problem !== undefined);
    if (comparisonProblem !== undefined) findings.push({ severity: "warning", check: "Comparison incomplete", item, detail: `${comparisonProblem.label}: ${comparisonProblem.problem ?? ""}`, target });
    const learns = estimate.parts.some((part) => (part.priors ?? []).some((entry) => entry.prior.priors.some((prior) => prior.law.family !== "POINT")));
    if (!learns && estimate.estimate !== undefined) findings.push({ severity: "note", check: records.length > 0 ? "Records not used" : "No spread", item, detail: records.length > 0 ? "No part gives its event count, so the published times are taken as known and the plant times cannot update them." : "No part gives its event count, so the published times are taken as known and the result has no spread.", target });
    const mean = estimate.spread?.mean;
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
  if (restorationParameters(da).some((parameter) => parameter.estimate === undefined)) return false;
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
  survivalCurve,
  trainParameters,
  unavailabilityComplete,
  unavailabilityFindings,
  withUnavailability,
  type DaMaintenanceEstimate,
  type DaPartResult,
  type DaRestorationEstimate,
  type DaStepMethod,
  type DaSurvivalSeries,
};
