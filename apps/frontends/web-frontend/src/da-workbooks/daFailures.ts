import type {
  DataAnalysis,
  DataAnalysisParameter,
  DaEstimateQuantity,
  DaEvidence,
  DaEvidenceUnit,
  DaFailureRecord,
  DaPriorForm,
  DaQuantificationModel,
  DaRecordSet,
  DaSourceEntry,
} from "interfaces-mef-types/da/data-analysis";
import {
  canonicalJson,
  evidenceFailures,
  modelArguments,
  type BaseLaw,
  type DiscreteOutcome,
  type EmpiricalBayesLaw,
  type EvidenceTerm,
  type Law,
  type PopulationLaw,
  type TrendBin,
  type TruncatedLaw,
  type UncertainExpression,
  type UncertainUnit,
} from "interfaces-mef-types/core/uncertainty";
import type { UncertaintyLawSummary } from "interfaces-shared-types/newly-developed-methods/shared";
import { uncertaintyVersion, type UncertaintyState } from "../newly-developed-methods/shared/useUncertainty";
import { constrainedLaw, daParameterTableVersion, expressionPoint, lawSummary, parameterPriorLaw, quantileOf, useLabel } from "./daLaws";
import { priorParts } from "./daSourcing";
import { conflictCheck, countEvidence, countTerm, countedRecords, decimalYear, highestCount, homogeneityCheck, recordCount, recordTrendCheck, termsFailures, typedCount, type DaCounted } from "./daEvidenceChecks";
import type { DaFindingSeverity, DaNeedFinding } from "./daSelectors";

const FAILURE_MODELS: ReadonlySet<DaQuantificationModel> = new Set(["DEMAND_PROBABILITY", "RUNNING_RATE", "MISSION_PROBABILITY", "STANDBY_RATE", "OTHER_PROBABILITY", "HUMAN_ERROR"]);

const RANK: Record<DaFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const JEFFREYS_PROBABILITY: BaseLaw = { family: "BETA", alpha: 0.5, beta: 0.5, lower: 0, upper: 1 };

const SIGMA_LOW = 0.025;

const SIGMA_HIGH = 3;

const MU_REACH = 5;

const RATE_QUANTITIES: ReadonlySet<DaEstimateQuantity> = new Set(["PER_HOUR"]);

const PROBABILITY_QUANTITIES: ReadonlySet<DaEstimateQuantity> = new Set(["PER_DEMAND", "PROBABILITY", "FRACTION"]);

const QUANTITY_TEXT: Record<DaEstimateQuantity, string> = {
  PER_DEMAND: "per demand",
  PROBABILITY: "a probability",
  FRACTION: "a fraction",
  PER_HOUR: "per hour",
  PER_YEAR: "per year",
  HOURS: "in hours",
  FACTOR: "a factor",
};

type DaScale = "PROBABILITY" | "RATE";

type DaFailureMethod = "PRIOR" | "BAYES" | "POPULATION" | "EMPIRICAL_BAYES" | "TREND" | "TYPED";

type DaFailureComputation = "PRIOR" | "POSTERIOR" | "POPULATION" | "EMPIRICAL_BAYES" | "TREND";

interface DaResolvedEvidence {
  evidence: DaEvidence;
  label: string;
  failures?: number;
  outcomes?: DiscreteOutcome[];
  exposure?: number;
  unit?: DaEvidenceUnit;
  yearsFrom?: string;
  yearsTo?: string;
  term?: EvidenceTerm;
  waiting?: boolean;
  problem?: string;
}

type DaMissionHours = { status: "ready"; hours: number } | { status: "pending" } | { status: "missing"; problem: string };

interface DaPublishedPrior {
  law: Law;
  quantity: DaEstimateQuantity;
  label: string;
}

interface DaFailureEstimate {
  scale?: DaScale;
  missionTime?: UncertainExpression;
  unit: string;
  thetaUnit: string;
  lawUnit?: UncertainUnit;
  published?: DaPublishedPrior;
  form: DaPriorForm;
  prior?: Law;
  priorPending: boolean;
  priorProblem?: string;
  evidence: DaResolvedEvidence[];
  terms: EvidenceTerm[];
  trendBins?: TrendBin[];
  method?: DaFailureMethod;
  computation?: DaFailureComputation;
  posterior?: Law;
  estimate?: UncertainExpression;
  pending: boolean;
  problem?: string;
}

interface DaPublishedState {
  published?: DaPublishedPrior;
  pending: boolean;
  problem?: string;
}

interface DaPriorChoice {
  prior?: Law | null;
  pending: boolean;
  problem?: string;
}

interface DaFailureCheck {
  findings: DaNeedFinding[];
  pending: boolean;
}

const estimateCache = new WeakMap<DataAnalysis, { version: string; values: Map<string, DaFailureEstimate> }>();

const checkCache = new WeakMap<DataAnalysis, { version: string; check: DaFailureCheck }>();

function cacheVersion(): string {
  return `${uncertaintyVersion()}:${daParameterTableVersion()}`;
}

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function isFailureParameter(parameter: DataAnalysisParameter): boolean {
  return parameter.quantificationModel !== undefined && FAILURE_MODELS.has(parameter.quantificationModel) && parameter.valueMode !== "LINKED";
}

function failureParameters(da: DataAnalysis): DataAnalysisParameter[] {
  return da.parameters.filter(isFailureParameter);
}

function methodOf(parameter: DataAnalysisParameter): DaFailureMethod | undefined {
  if (parameter.valueMode === "CALCULATED") return parameter.estimateMethod;
  if (parameter.valueMode === "TYPED" || (parameter.valueMode === undefined && parameter.estimate !== undefined)) return "TYPED";
  return undefined;
}

function formOf(parameter: DataAnalysisParameter): DaPriorForm {
  return parameter.priorForm ?? "AS_PUBLISHED";
}

function publishedState(da: DataAnalysis, parameter: DataAnalysisParameter): DaPublishedState {
  const state = parameterPriorLaw(da, parameter);
  if (state.status === "pending") return { pending: true };
  if (state.status === "failed") return { pending: false, problem: `PRAXIS could not form the prior: ${state.error}` };
  if (state.status === "missing") return { pending: false, problem: state.problem };
  return { pending: false, published: { law: state.value.law, quantity: state.value.quantity, label: priorParts(parameter).map((part) => useLabel(part.use)).join(" + ") } };
}

function entryOf(da: DataAnalysis, sourceId: string | undefined, entryId: string | undefined): DaSourceEntry | undefined {
  if (sourceId === undefined || entryId === undefined) return undefined;
  return (da.sources ?? []).find((source) => source.id === sourceId)?.entries.find((entry) => entry.id === entryId);
}

function recordSetOf(da: DataAnalysis, id: string | undefined): DaRecordSet | undefined {
  return id === undefined ? undefined : (da.recordSets ?? []).find((set) => set.id === id);
}

function unitOfQuantity(quantity: DaEstimateQuantity): DaEvidenceUnit | undefined {
  if (quantity === "PER_DEMAND" || quantity === "PROBABILITY") return "DEMANDS";
  if (quantity === "PER_HOUR") return "HOURS";
  if (quantity === "PER_YEAR") return "YEARS";
  return undefined;
}

function demandModel(parameter: DataAnalysisParameter): boolean {
  return parameter.quantificationModel === "DEMAND_PROBABILITY" || parameter.quantificationModel === "OTHER_PROBABILITY" || parameter.quantificationModel === "HUMAN_ERROR";
}

function yearsBetween(start: string | undefined, end: string | undefined): number | undefined {
  if (start === undefined || end === undefined) return undefined;
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from)) return undefined;
  return (to - from) / (365.25 * 24 * 3600 * 1000);
}

function populationExposure(da: DataAnalysis, parameter: DataAnalysisParameter): { exposure?: number; unit?: DaEvidenceUnit; problem?: string } {
  const groupId = parameter.componentGroupRef;
  if (groupId === undefined) return { problem: "Exposure from demands and hours needs the parameter's population (Step 03)." };
  const window = yearsBetween(da.dataPlan?.dataWindowStart, da.dataPlan?.dataWindowEnd);
  if (demandModel(parameter)) {
    const mode = parameter.failureModeRef;
    if (mode === undefined) return { problem: "Exposure from demands needs the parameter's failure mode (Step 03)." };
    const rows = (da.demandCounts ?? []).filter((row) => row.groupId === groupId && row.failureModeIds.includes(mode));
    if (rows.length === 0) return { problem: `No demand in population ${groupId} tests this failure mode (DA-C12).` };
    if (window === undefined && rows.some((row) => row.basis !== "RECORDS")) return { problem: "Planned demands are per year. Set the data window in Step 01 to total them." };
    return { exposure: rows.reduce((total, row) => total + row.count * (row.basis === "RECORDS" ? 1 : window ?? 0), 0), unit: "DEMANDS" };
  }
  const rows = (da.hourCounts ?? []).filter((row) => row.groupId === groupId);
  const standby = parameter.quantificationModel === "STANDBY_RATE";
  const counted = rows.filter((row) => (standby ? row.standbyHours : row.runHours) !== undefined);
  if (counted.length === 0) return { problem: `No ${standby ? "standby" : "run"} hours are recorded for population ${groupId}.` };
  if (window === undefined && counted.some((row) => row.basis !== "RECORDS")) return { problem: "Planned hours are per year. Set the data window in Step 01 to total them." };
  return { exposure: counted.reduce((total, row) => total + (standby ? row.standbyHours ?? 0 : row.runHours ?? 0) * (row.basis === "RECORDS" ? 1 : window ?? 0), 0), unit: "HOURS" };
}

function evidenceLabel(da: DataAnalysis, evidence: DaEvidence): string {
  if (!blank(evidence.label)) return evidence.label ?? "";
  if (evidence.failuresFrom === "RECORDS" && evidence.recordSetId !== undefined) {
    const set = recordSetOf(da, evidence.recordSetId);
    return set === undefined ? evidence.recordSetId : `${set.id} · ${set.name}`;
  }
  if (evidence.sourceId !== undefined && evidence.entryId !== undefined) return `${evidence.sourceId} · ${evidence.entryId}`;
  return evidence.origin === "PLANT_RECORDS" ? "Plant counts" : "Typed counts";
}

function scaleOf(da: DataAnalysis, parameter: DataAnalysisParameter, published: DaPublishedPrior | undefined): DaScale | undefined {
  const model = parameter.quantificationModel;
  if (model === "RUNNING_RATE" || model === "STANDBY_RATE") return "RATE";
  if (model === "DEMAND_PROBABILITY" || model === "OTHER_PROBABILITY" || model === "HUMAN_ERROR") return "PROBABILITY";
  if (model !== "MISSION_PROBABILITY") return undefined;
  if (published !== undefined && formOf(parameter) !== "JEFFREYS") return RATE_QUANTITIES.has(published.quantity) ? "RATE" : "PROBABILITY";
  const units = (parameter.evidence ?? []).map((evidence) => evidence.exposureFrom === "ENTRY" ? unitOfQuantity(entryOf(da, evidence.sourceId, evidence.entryId)?.quantity ?? "FACTOR") : evidence.exposureFrom === "DEMANDS_AND_HOURS" ? "HOURS" : evidence.unit);
  return units.includes("DEMANDS") ? "PROBABILITY" : "RATE";
}

function parameterScale(da: DataAnalysis, parameter: DataAnalysisParameter): DaScale | undefined {
  return scaleOf(da, parameter, publishedState(da, parameter).published);
}

function estimateMissionTime(da: DataAnalysis, parameter: DataAnalysisParameter): { missionTime?: UncertainExpression; problem?: string } {
  const needs = (da.dataNeeds?.basicEvents ?? []).filter((need) => need.included && need.parameterId === parameter.uuid);
  const times = needs.flatMap((need) => (need.missionTime === undefined ? [] : [need.missionTime]));
  const [first] = times;
  const estimate = parameter.estimate;
  const linked = estimate?.node === "MODEL" && estimate.model.form === "MISSION" ? estimate.model.missionTime : undefined;
  if (linked !== undefined) return { missionTime: linked };
  if (first === undefined) return { problem: needs.length === 0 ? "Map a basic event to this parameter. Its mission time sets the mission of the estimate." : "The basic events mapped to this parameter give no mission time. Set it in Step 02." };
  if (times.length < needs.length || times.some((time) => canonicalJson(time) !== canonicalJson(first))) return { problem: "The basic events mapped to this parameter have different mission times. Align them in Step 02 or split the parameter." };
  return { missionTime: first };
}

function linkedTestInterval(da: DataAnalysis, parameter: DataAnalysisParameter): number | undefined {
  const needs = (da.dataNeeds?.basicEvents ?? []).filter((need) => need.included && need.parameterId === parameter.uuid);
  const intervals = needs.flatMap((need) => (need.testIntervalHours === undefined ? [] : [need.testIntervalHours]));
  const [first] = intervals;
  return first !== undefined && intervals.length === needs.length && intervals.every((interval) => interval === first) ? first : undefined;
}

function missionHoursOf(missionTime: UncertainExpression | undefined, problem: string | undefined): DaMissionHours {
  if (missionTime === undefined) return { status: "missing", problem: problem ?? "No mission time." };
  const state = expressionPoint(missionTime, "HOURS");
  if (state.status === "pending") return { status: "pending" };
  if (state.status === "failed") return { status: "missing", problem: `PRAXIS could not give the mission time: ${state.error}` };
  return { status: "ready", hours: state.value.point };
}

function resolveEvidence(da: DataAnalysis, parameter: DataAnalysisParameter, scale: DaScale | undefined, mission: () => DaMissionHours): DaResolvedEvidence[] {
  return (parameter.evidence ?? []).map((evidence) => {
    const label = evidenceLabel(da, evidence);
    const entry = entryOf(da, evidence.sourceId, evidence.entryId);
    const set = recordSetOf(da, evidence.recordSetId);
    const resolved: DaResolvedEvidence = { evidence, label, yearsFrom: evidence.yearsFrom ?? (evidence.failuresFrom === "RECORDS" ? set?.yearsFrom : entry?.yearsFrom), yearsTo: evidence.yearsTo ?? (evidence.failuresFrom === "RECORDS" ? set?.yearsTo : entry?.yearsTo) };
    let counted: DaCounted | undefined;
    if (evidence.failuresFrom === "TYPED") counted = evidence.failures === undefined ? undefined : { failures: evidence.failures };
    else if (evidence.failuresFrom === "UNCERTAIN") {
      counted = typedCount(evidence.failureOutcomes);
      if (counted === undefined) return { ...resolved, problem: "Give each possible count with a weight above zero." };
    } else if (evidence.failuresFrom === "ENTRY") {
      if (entry === undefined) return { ...resolved, problem: "Pick the library estimate the counts come from." };
      counted = entry.failures === undefined ? undefined : { failures: entry.failures };
    } else {
      if (set === undefined) return { ...resolved, problem: "Pick the record set the failures are counted from." };
      counted = recordCount(countedRecords(set, parameter.uuid));
    }
    if (counted !== undefined) {
      resolved.failures = counted.failures;
      resolved.outcomes = counted.outcomes;
    }
    if (evidence.exposureFrom === "TYPED") {
      resolved.exposure = evidence.exposure;
      resolved.unit = evidence.unit;
    } else if (evidence.exposureFrom === "ENTRY") {
      if (entry === undefined) return { ...resolved, problem: "Pick the library estimate the exposure comes from." };
      resolved.exposure = entry.exposure;
      resolved.unit = unitOfQuantity(entry.quantity);
      if (resolved.unit === undefined) return { ...resolved, problem: "This estimate does not count failures in demands or in time." };
    } else {
      const counted = populationExposure(da, parameter);
      if (counted.problem !== undefined) return { ...resolved, problem: counted.problem };
      resolved.exposure = counted.exposure;
      resolved.unit = counted.unit;
    }
    if (counted === undefined) return { ...resolved, problem: "Enter the number of failures." };
    if (resolved.exposure === undefined || resolved.unit === undefined) return { ...resolved, problem: "Enter the demands or hours the failures happened in." };
    if (!(resolved.exposure > 0)) return { ...resolved, problem: "The exposure must be more than zero." };
    if (counted.failures < 0) return { ...resolved, problem: "The failure count cannot be negative." };
    if (scale === undefined) return resolved;
    const exposure = resolved.exposure;
    if (scale === "RATE") {
      if (resolved.unit === "DEMANDS") {
        if (parameter.quantificationModel !== "STANDBY_RATE") return { ...resolved, problem: "Failures in demands cannot update a rate per hour." };
        if (counted.outcomes !== undefined) return { ...resolved, problem: "Test demands take one failure count. Give a single count." };
        const interval = evidence.testIntervalHours ?? linkedTestInterval(da, parameter);
        if (interval === undefined || !(interval > 0)) return { ...resolved, problem: "Enter the test interval in hours. It turns the demands into standby time." };
        if (counted.failures > exposure) return { ...resolved, problem: "There are more failures than demands." };
        return { ...resolved, term: { likelihood: "STANDBY_DEMAND", demand: evidence.standbyDemand ?? "TEST", failures: counted.failures, exposure, testInterval: interval } };
      }
      if (resolved.unit === "YEARS") {
        if (evidence.hoursPerYear === undefined || !(evidence.hoursPerYear > 0)) return { ...resolved, problem: "Enter the hours of exposure in a year, 8760 for a calendar year." };
        return { ...resolved, term: countTerm("POISSON", counted, exposure * evidence.hoursPerYear) };
      }
      return { ...resolved, term: countTerm("POISSON", counted, exposure) };
    }
    if (resolved.unit === "DEMANDS") {
      if (highestCount(counted) > exposure) return { ...resolved, problem: "There are more failures than demands." };
      return { ...resolved, term: countTerm("BINOMIAL", counted, exposure) };
    }
    const missionHours = evidence.hoursPerDemand === undefined && parameter.quantificationModel === "MISSION_PROBABILITY" ? mission() : undefined;
    if (missionHours?.status === "pending") return { ...resolved, waiting: true };
    if (missionHours?.status === "missing") return { ...resolved, problem: missionHours.problem };
    const perDemand = evidence.hoursPerDemand ?? (missionHours?.status === "ready" ? missionHours.hours : undefined);
    if (perDemand === undefined || !(perDemand > 0)) return { ...resolved, problem: "Enter the hours each demand covers, half the test interval for a standby failure." };
    if (resolved.unit === "YEARS") {
      if (evidence.hoursPerYear === undefined || !(evidence.hoursPerYear > 0)) return { ...resolved, problem: "Enter the hours of exposure in a year, 8760 for a calendar year." };
      return { ...resolved, term: countTerm("POISSON", counted, (exposure * evidence.hoursPerYear) / perDemand) };
    }
    return { ...resolved, term: countTerm("POISSON", counted, exposure / perDemand) };
  });
}

function unitLabel(parameter: DataAnalysisParameter, scale: DaScale | undefined): string {
  if (parameter.quantificationModel === "MISSION_PROBABILITY") return "per mission";
  return scale === "RATE" ? "per hour" : "per demand";
}

function thetaLabel(parameter: DataAnalysisParameter, scale: DaScale | undefined): string {
  if (scale === "RATE") return "per hour";
  return parameter.quantificationModel === "MISSION_PROBABILITY" ? unitLabel(parameter, scale) : "per demand";
}

function scaleUnit(scale: DaScale): UncertainUnit {
  return scale === "RATE" ? "PER_HOUR" : "PROBABILITY";
}

function fitsScale(quantity: DaEstimateQuantity, scale: DaScale): boolean {
  return scale === "RATE" ? RATE_QUANTITIES.has(quantity) : PROBABILITY_QUANTITIES.has(quantity);
}

function priorChoice(form: DaPriorForm, state: DaPublishedState, scale: DaScale): DaPriorChoice {
  if (form === "JEFFREYS") return { prior: scale === "RATE" ? null : JEFFREYS_PROBABILITY, pending: false };
  if (state.pending) return { pending: true };
  const published = state.published;
  if (published === undefined) return { pending: false, problem: state.problem ?? "No prior. Choose the source the estimate starts from in Step 04 Applicability." };
  if (!fitsScale(published.quantity, scale)) return { pending: false, problem: `The Step 04 prior is ${QUANTITY_TEXT[published.quantity]}, but this parameter needs a value ${scale === "RATE" ? "per hour" : "per demand"}. Convert it in Step 04 Applicability.` };
  if (form === "AS_PUBLISHED") return { prior: published.law, pending: false };
  const constrained = constrainedLaw(published.law, scale === "PROBABILITY" ? "BINOMIAL" : "POISSON");
  if (constrained.status === "pending") return { pending: true };
  if (constrained.status === "failed") return { pending: false, problem: `PRAXIS could not form the constrained noninformative prior: ${constrained.error}` };
  if (constrained.status === "missing") return { pending: false, problem: constrained.problem };
  return { prior: constrained.law, pending: false };
}

function posteriorOf(prior: Law | null, terms: readonly EvidenceTerm[]): Law | string {
  if (prior === null) return { family: "POSTERIOR", prior: null, evidence: [...terms] };
  switch (prior.family) {
    case "POSTERIOR":
      return { family: "POSTERIOR", prior: prior.prior, evidence: [...prior.evidence, ...terms] };
    case "POPULATION":
      return "A population law cannot be updated again. Use it as published or pick a source with its own law.";
    case "EMPIRICAL_BAYES":
    case "DURATION":
    case "TREND":
      return "This law is already fitted to data. It cannot be updated again. Use it as published or pick a source with its own law.";
    default:
      return { family: "POSTERIOR", prior, evidence: [...terms] };
  }
}

function termCenter(term: EvidenceTerm): number {
  const failures = evidenceFailures(term) + 0.5;
  if (term.likelihood === "STANDBY_DEMAND") return Math.log(failures / (term.exposure * (term.demand === "TEST" ? term.testInterval : term.testInterval / 2)));
  return Math.log(failures / term.exposure);
}

function defaultHyperprior(terms: readonly EvidenceTerm[]): { mu: BaseLaw | TruncatedLaw; sigma: BaseLaw | TruncatedLaw } {
  const centers = terms.map(termCenter);
  return {
    mu: { family: "UNIFORM", lower: Math.min(...centers) - MU_REACH, upper: Math.max(...centers) + MU_REACH },
    sigma: { family: "UNIFORM", lower: SIGMA_LOW, upper: SIGMA_HIGH },
  };
}

function hyperpriorOf(parameter: Pick<DataAnalysisParameter, "populationHyperprior">, terms: readonly EvidenceTerm[]): { mu: BaseLaw | TruncatedLaw; sigma: BaseLaw | TruncatedLaw } {
  return parameter.populationHyperprior ?? defaultHyperprior(terms);
}

function targetIndex(items: readonly { evidence: DaEvidence; term?: EvidenceTerm }[], targetId: string | undefined): number | null {
  if (targetId === undefined) return null;
  return items.filter((item) => item.evidence.included && item.term !== undefined).findIndex((item) => item.evidence.id === targetId);
}

type DaPooledLaw = { law: PopulationLaw | EmpiricalBayesLaw } | { problem: string };

function pooledLaw(method: "POPULATION" | "EMPIRICAL_BAYES", holder: Pick<DataAnalysisParameter, "populationHyperprior" | "populationTargetId">, items: readonly { evidence: DaEvidence; term?: EvidenceTerm }[], terms: readonly EvidenceTerm[], probability: boolean): DaPooledLaw {
  const name = method === "POPULATION" ? "Population variability" : "Empirical Bayes";
  if (terms.length < 2) return { problem: `${name} needs at least two evidence sets in the update.` };
  if (!(termsFailures(terms) > 0)) return { problem: `${name} needs at least one failure across the sets.` };
  const target = targetIndex(items, holder.populationTargetId);
  if (target === -1) return { problem: `The ${method === "POPULATION" ? "population" : "empirical Bayes"} target is not among the evidence sets in the update.` };
  if (method === "POPULATION") {
    const hyper = hyperpriorOf(holder, terms);
    return { law: { family: "POPULATION", mu: hyper.mu, sigma: hyper.sigma, upper: probability ? 1 : null, evidence: [...terms], target } };
  }
  const counts = countEvidence(terms);
  if (counts === undefined) return { problem: "Empirical Bayes needs plain counts of one kind in every set, all in demands or all in hours. Give single counts, not test demands or several possible counts." };
  return { law: { family: "EMPIRICAL_BAYES", evidence: counts, target } };
}

function trendBinsOf(da: DataAnalysis, parameter: DataAnalysisParameter): { bins: TrendBin[]; at: number } | { problem: string } {
  const basis = parameter.trend;
  if (basis === undefined || basis.bins.length === 0) return { problem: "Add the failures and hours of each year for the trend." };
  let counted: Map<number, number> | undefined;
  if (basis.failuresFrom === "RECORDS") {
    const set = recordSetOf(da, basis.recordSetId);
    if (set === undefined) return { problem: "Pick the record set the yearly failures are counted from." };
    counted = new Map();
    for (const record of countedRecords(set, parameter.uuid)) {
      const at = decimalYear(record.date);
      if (at === undefined) return { problem: `Record ${record.id} has no date, so it falls in no year.` };
      const year = Math.floor(at);
      counted.set(year, (counted.get(year) ?? 0) + recordCount([record]).failures);
    }
    const years = new Set(basis.bins.map((bin) => bin.year));
    const outside = [...counted.keys()].filter((year) => !years.has(year));
    if (outside.length > 0) return { problem: `Counted failures fall in ${outside.join(", ")}, which has no row. Add the year and its hours.` };
  }
  const bins: TrendBin[] = [];
  for (const bin of basis.bins) {
    const failures = counted === undefined ? bin.failures : counted.get(bin.year) ?? 0;
    if (failures === undefined || failures < 0) return { problem: `Enter the failures of ${bin.year}.` };
    if (!(bin.exposure > 0)) return { problem: `The hours of ${bin.year} must be more than zero.` };
    bins.push({ time: bin.year, failures, exposure: bin.exposure });
  }
  if (new Set(bins.map((bin) => bin.time)).size < 2) return { problem: "A trend needs at least two different years." };
  if (!bins.some((bin) => bin.failures > 0)) return { problem: "A trend needs at least one failure." };
  if (basis.at === undefined) return { problem: "Choose the year the estimate is for." };
  return { bins, at: basis.at };
}

function lawExpression(unit: UncertainUnit, law: Law, missionTime: UncertainExpression | undefined): UncertainExpression {
  const value: UncertainExpression = { node: "VALUE", value: { unit, law } };
  if (missionTime === undefined) return value;
  return { node: "MODEL", model: { form: "MISSION", rate: value, missionTime } };
}

function estimateExpression(estimate: DaFailureEstimate, law: Law): UncertainExpression | undefined {
  return estimate.lawUnit === undefined ? undefined : lawExpression(estimate.lawUnit, law, estimate.missionTime);
}

function evidenceAloneLaw(terms: readonly EvidenceTerm[], scale: DaScale): Law | undefined {
  if (terms.length === 0) return undefined;
  return { family: "POSTERIOR", prior: scale === "RATE" ? null : JEFFREYS_PROBABILITY, evidence: [...terms] };
}

function summaryOf(estimate: DaFailureEstimate, law: Law | undefined): UncertaintyState<UncertaintyLawSummary> | undefined {
  return law === undefined || estimate.lawUnit === undefined ? undefined : lawSummary(estimate.lawUnit, law, true);
}

function finish(base: DaFailureEstimate, computation: DaFailureComputation, law: Law): DaFailureEstimate {
  const lawUnit = base.lawUnit;
  if (lawUnit === undefined) return { ...base, problem: "The parameter has no failure model." };
  const done: DaFailureEstimate = { ...base, computation, posterior: law, estimate: lawExpression(lawUnit, law, base.missionTime) };
  const summary = lawSummary(lawUnit, law, true);
  if (summary.status === "pending") return { ...done, pending: true };
  if (summary.status === "failed") return { ...done, problem: `PRAXIS could not compute the estimate: ${summary.error}` };
  return done;
}

function computeEstimate(da: DataAnalysis, parameter: DataAnalysisParameter): DaFailureEstimate {
  const state = publishedState(da, parameter);
  const scale = scaleOf(da, parameter, state.published);
  const form = formOf(parameter);
  const mission: { missionTime?: UncertainExpression; problem?: string } = parameter.quantificationModel === "MISSION_PROBABILITY" ? estimateMissionTime(da, parameter) : {};
  let missionHours: DaMissionHours | undefined;
  const evidence = resolveEvidence(da, parameter, scale, () => {
    missionHours = missionHours ?? missionHoursOf(mission.missionTime, mission.problem);
    return missionHours;
  });
  const terms = evidence.flatMap((item) => (item.evidence.included && item.term !== undefined ? [item.term] : []));
  const method = methodOf(parameter);
  const missionTime = scale === "RATE" ? mission.missionTime : undefined;
  const base: DaFailureEstimate = { scale, missionTime, unit: unitLabel(parameter, scale), thetaUnit: thetaLabel(parameter, scale), lawUnit: scale === undefined ? undefined : scaleUnit(scale), published: state.published, form, priorPending: false, evidence, terms, method, pending: false };
  if (scale === undefined) return { ...base, problem: "The parameter has no failure model." };
  if (method !== "TYPED" && evidence.some((item) => item.evidence.included && item.waiting === true)) return { ...base, pending: true };
  if (parameter.quantificationModel === "MISSION_PROBABILITY" && scale === "RATE" && method !== "TYPED" && mission.missionTime === undefined) return { ...base, problem: mission.problem ?? "No mission time." };
  const chosen = priorChoice(form, state, scale);
  const withPrior: DaFailureEstimate = { ...base, prior: chosen.prior ?? undefined, priorPending: chosen.pending, priorProblem: chosen.problem };
  if (method === undefined) return { ...withPrior, problem: "Choose how the estimate is made." };
  if (method === "TYPED") return { ...withPrior, estimate: parameter.estimate };
  if (method === "POPULATION" || method === "EMPIRICAL_BAYES") {
    const pooled = pooledLaw(method, parameter, evidence, terms, scale === "PROBABILITY");
    if ("problem" in pooled) return { ...withPrior, problem: pooled.problem };
    return finish(withPrior, method, pooled.law);
  }
  if (method === "TREND") {
    if (scale !== "RATE") return { ...withPrior, problem: "A trend estimate needs a rate per hour. Use it for running, standby and mission rates." };
    const trend = trendBinsOf(da, parameter);
    if ("problem" in trend) return { ...withPrior, problem: trend.problem };
    return finish({ ...withPrior, trendBins: trend.bins }, "TREND", { family: "TREND", bins: trend.bins, at: trend.at });
  }
  if (chosen.pending) return { ...withPrior, pending: true };
  if (chosen.problem !== undefined || chosen.prior === undefined) return { ...withPrior, problem: chosen.problem ?? "No prior." };
  const prior = chosen.prior;
  if (method === "PRIOR") {
    if (prior === null || form === "JEFFREYS") return { ...withPrior, problem: "A Jeffreys prior is not an estimate on its own. Use it in a Bayes update." };
    return finish(withPrior, "PRIOR", prior);
  }
  if (prior !== null && prior.family === "POINT") return { ...withPrior, problem: "A point value cannot be updated. Use the constrained noninformative form." };
  if (terms.length === 0) {
    if (prior === null || form === "JEFFREYS") return { ...withPrior, problem: "A Jeffreys prior needs evidence to update." };
    return finish(withPrior, "PRIOR", prior);
  }
  const posterior = posteriorOf(prior, terms);
  if (typeof posterior === "string") return { ...withPrior, problem: posterior };
  return finish(withPrior, "POSTERIOR", posterior);
}

function parameterEstimate(da: DataAnalysis, parameter: DataAnalysisParameter): DaFailureEstimate {
  const version = cacheVersion();
  let cached = estimateCache.get(da);
  if (cached === undefined || cached.version !== version) {
    cached = { version, values: new Map() };
    estimateCache.set(da, cached);
  }
  const known = cached.values.get(parameter.uuid);
  if (known !== undefined) return known;
  const estimate = computeEstimate(da, parameter);
  cached.values.set(parameter.uuid, estimate);
  return estimate;
}

function estimateSummary(estimate: DaFailureEstimate): UncertaintyState<UncertaintyLawSummary> | undefined {
  return summaryOf(estimate, estimate.posterior);
}

function priorSummary(estimate: DaFailureEstimate): UncertaintyState<UncertaintyLawSummary> | undefined {
  return summaryOf(estimate, estimate.prior);
}

function publishedSummary(estimate: DaFailureEstimate): UncertaintyState<UncertaintyLawSummary> | undefined {
  return estimate.published === undefined || estimate.scale === undefined || !fitsScale(estimate.published.quantity, estimate.scale) ? undefined : summaryOf(estimate, estimate.published.law);
}

function priorWorth(summary: UncertaintyLawSummary, scale: DaScale): number | undefined {
  const deviation = summary.standardDeviation;
  if (deviation === null || !(deviation > 0) || !(summary.mean > 0)) return undefined;
  const variance = deviation * deviation;
  const worth = scale === "RATE" ? summary.mean / variance : (summary.mean * (1 - summary.mean)) / variance - 1;
  return worth > 0 && Number.isFinite(worth) ? worth : undefined;
}

function peakCount(summary: UncertaintyLawSummary): number {
  const top = Math.max(0, ...summary.peaks.map((peak) => peak.density));
  const peaks = summary.peaks.filter((peak) => peak.density > 0.05 * top).sort((left, right) => left.x - right.x);
  let count = peaks.length > 0 ? 1 : 0;
  for (let index = 1; index < peaks.length; index += 1) {
    const left = peaks[index - 1];
    const right = peaks[index];
    if (left === undefined || right === undefined) continue;
    const between = summary.valleys.filter((valley) => valley.x > left.x && valley.x < right.x).map((valley) => valley.density);
    if (between.length > 0 && Math.min(...between) < 0.8 * Math.min(left.density, right.density)) count += 1;
  }
  return count;
}

function hasSpread(expression: UncertainExpression): boolean {
  switch (expression.node) {
    case "VALUE":
      return expression.value.law.family !== "POINT";
    case "PARAMETER":
      return true;
    case "OPERATION":
      return expression.operands.some(hasSpread);
    case "MODEL":
      return modelArguments(expression.model).some(hasSpread);
  }
}

function sameExpression(left: UncertainExpression | undefined, right: UncertainExpression | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return canonicalJson(left) === canonicalJson(right);
}

function withEstimates(da: DataAnalysis): DataAnalysis {
  let changed = false;
  const parameters = da.parameters.map((parameter) => {
    if (!isFailureParameter(parameter) || parameter.valueMode !== "CALCULATED") return parameter;
    const estimate = parameterEstimate(da, parameter);
    if (estimate.estimate === undefined || estimate.pending || estimate.problem !== undefined) return parameter;
    if (sameExpression(parameter.estimate, estimate.estimate) && parameter.value === undefined && parameter.valueType === undefined && parameter.uncertainty === undefined) return parameter;
    changed = true;
    const next: DataAnalysisParameter = { ...parameter, estimate: estimate.estimate };
    delete next.value;
    delete next.valueType;
    delete next.uncertainty;
    return next;
  });
  return changed ? { ...da, parameters } : da;
}

function readyLaw(state: UncertaintyState<UncertaintyLawSummary> | undefined, check: DaFailureCheck): UncertaintyLawSummary | undefined {
  if (state === undefined) return undefined;
  if (state.status === "pending") {
    check.pending = true;
    return undefined;
  }
  return state.status === "ready" ? state.value : undefined;
}

function pointOf(expression: UncertainExpression | undefined, unit: UncertainUnit, check: DaFailureCheck): number | undefined {
  if (expression === undefined) return undefined;
  const state = expressionPoint(expression, unit);
  if (state.status === "pending") {
    check.pending = true;
    return undefined;
  }
  return state.status === "ready" ? state.value.point : undefined;
}

function estimateUnit(estimate: DaFailureEstimate): UncertainUnit | undefined {
  if (estimate.lawUnit === undefined) return undefined;
  return estimate.missionTime === undefined ? estimate.lawUnit : "PROBABILITY";
}

function parameterFindingsFor(da: DataAnalysis, parameter: DataAnalysisParameter, check: DaFailureCheck): void {
  const findings = check.findings;
  const item = parameter.uuid;
  const estimateTarget = { kind: "daEstimate" as const, id: parameter.uuid };
  const evidenceTarget = { kind: "daEvidence" as const, id: parameter.uuid };
  const priorTarget = { kind: "daPrior" as const, id: parameter.uuid };
  const estimate = parameterEstimate(da, parameter);
  const method = estimate.method;
  const ccTwo = da.capabilityCategory !== "CC-I";
  const operating = da.plantStage === "OPERATIONAL";
  if (method === undefined) {
    findings.push({ severity: "error", check: "No estimate", item, detail: "Choose how the estimate is made: the prior as is, a Bayes update, population variability, empirical Bayes, a trend, or a typed value.", target: estimateTarget });
    return;
  }
  const priorUses = priorParts(parameter).map((part) => part.use);
  for (const resolved of estimate.evidence) {
    const evidence = resolved.evidence;
    const what = resolved.label;
    if (evidence.included && resolved.problem !== undefined) findings.push({ severity: "error", check: "Evidence incomplete", item, detail: `${what}: ${resolved.problem}`, target: evidenceTarget });
    if (blank(evidence.reason)) findings.push({ severity: "error", check: "No reason", item, detail: `Say why ${what} applies to this parameter.`, target: evidenceTarget });
    if (!evidence.included && blank(evidence.exclusionReason)) findings.push({ severity: "error", check: "No exclusion reason", item, detail: `Say why ${what} is left out of the update (DA-C4).`, target: evidenceTarget });
    if (evidence.included && evidence.boundary === "DIFFERENT") findings.push({ severity: "error", check: "Boundary differs", item, detail: `${what} covers a different boundary. Leave it out or adjust it (DA-A2).`, target: evidenceTarget });
    if (evidence.included && !operating && evidence.origin === "PLANT_RECORDS") findings.push({ severity: "warning", check: "Plant records before operation", item, detail: `${what} is marked as plant records, but the plant does not operate yet.`, target: evidenceTarget });
    if (evidence.included && !operating && evidence.exposureFrom === "DEMANDS_AND_HOURS") findings.push({ severity: "warning", check: "Planned exposure", item, detail: `Before operation, the demands and hours are planned values, not experience. Type the exposure ${what} was observed over.`, target: evidenceTarget });
    if (!evidence.included || evidence.sourceId === undefined) continue;
    const same = priorUses.filter((use) => use.sourceId === evidence.sourceId);
    if (same.some((use) => use.entryId === evidence.entryId)) findings.push({ severity: "error", check: "Counted twice", item, detail: `${what} is also the prior. Its failures are already inside it.`, target: evidenceTarget });
    else if (same.length > 0) findings.push({ severity: "warning", check: "Same source as the prior", item, detail: `${what} comes from the same source as the prior. Make sure they share no failures.`, target: evidenceTarget });
  }
  if (method === "TYPED") {
    const typed = parameter.estimate;
    if (typed === undefined) findings.push({ severity: "error", check: "No value", item, detail: "Type the estimate, or let DA calculate it.", target: estimateTarget });
    else if (!hasSpread(typed)) findings.push({ severity: "warning", check: "No uncertainty", item, detail: "Give the typed estimate a distribution (DA-D3).", target: estimateTarget });
    if (blank(parameter.estimateReason)) findings.push({ severity: "warning", check: "No basis", item, detail: "Say where the typed estimate comes from.", target: estimateTarget });
    return;
  }
  if (estimate.pending) {
    check.pending = true;
    return;
  }
  if (estimate.problem !== undefined) {
    findings.push({ severity: "error", check: "Cannot estimate", item, detail: estimate.problem, target: estimate.problem.startsWith("No prior") ? { kind: "daSourcing", id: parameter.uuid } : estimateTarget });
    return;
  }
  if (estimate.form !== "AS_PUBLISHED" && blank(parameter.priorFormReason)) findings.push({ severity: "warning", check: "No prior reason", item, detail: "Say why the prior is not used as published.", target: priorTarget });
  const includedEvidence = estimate.evidence.filter((resolved) => resolved.evidence.included);
  const scale = estimate.scale;
  const posterior = readyLaw(estimateSummary(estimate), check);
  const priorFree = method === "POPULATION" || method === "EMPIRICAL_BAYES" || method === "TREND";
  const prior = priorFree ? undefined : readyLaw(priorSummary(estimate), check);
  if (method === "PRIOR") {
    if (includedEvidence.length > 0) findings.push({ severity: ccTwo ? "error" : "warning", check: "Evidence not used", item, detail: "Evidence is in the update but the prior is used as is. Update it, even with zero failures (DA-D1).", target: estimateTarget });
    if (estimate.prior !== undefined && estimate.prior.family === "POINT") findings.push({ severity: "warning", check: "No uncertainty", item, detail: "A point value carries no uncertainty (DA-D3). Use the constrained noninformative form or another source.", target: priorTarget });
    if (parameter.isRiskSignificant === true && ccTwo && includedEvidence.length === 0) findings.push({ severity: "note", check: "Generic estimate", item, detail: "This risk-significant parameter has no plant or technology evidence yet, so the generic estimate stands (DA-D1).", target: evidenceTarget });
  }
  if (method === "TREND" && includedEvidence.length > 0) findings.push({ severity: "note", check: "Evidence not in the trend", item, detail: "The trend uses its own yearly rows. The evidence sets do not enter it.", target: estimateTarget });
  if (method === "BAYES" && estimate.terms.length === 0) findings.push({ severity: "note", check: "Nothing to update", item, detail: "No evidence is in the update, so the estimate equals the prior.", target: evidenceTarget });
  if (method === "BAYES" && estimate.terms.length > 0 && estimate.prior !== undefined && estimate.form !== "JEFFREYS") conflictCheck(check, estimate.prior, estimate.terms, item, priorTarget, !blank(parameter.estimateReason), operating);
  if (method === "BAYES" && estimate.form === "JEFFREYS" && estimate.published !== undefined && posterior !== undefined) {
    const published = readyLaw(publishedSummary(estimate), check);
    if (termsFailures(estimate.terms) === 0 && published !== undefined && posterior.mean > 3 * published.mean) findings.push({ severity: "warning", check: "Too little exposure", item, detail: "With zero failures and little exposure, the Jeffreys estimate overstates a reliable component's failure probability.", target: priorTarget });
  }
  if (method === "BAYES") homogeneityCheck(check, estimate.terms, item, evidenceTarget);
  if (method !== "TREND") {
    for (const resolved of includedEvidence) {
      if (resolved.evidence.failuresFrom === "RECORDS") recordTrendCheck(check, recordSetOf(da, resolved.evidence.recordSetId), parameter.uuid, resolved.label, resolved.yearsFrom, resolved.yearsTo, item, evidenceTarget);
    }
  }
  if (posterior !== undefined && peakCount(posterior) > 1) findings.push({ severity: "warning", check: "Two peaks", item, detail: "The estimate has more than one peak. The prior and the evidence may describe different equipment.", target: estimateTarget });
  if (method === "BAYES" && posterior !== undefined && prior !== undefined && estimate.terms.length > 0) {
    const low = quantileOf(prior, 0.05);
    const high = quantileOf(prior, 0.95);
    if (low !== undefined && high !== undefined && (posterior.mean < low || posterior.mean > high) && blank(parameter.estimateReason)) findings.push({ severity: "warning", check: "Outside the prior", item, detail: "The posterior mean lies outside the prior's 5th to 95th range. Say why in the estimate's reason (DA-N-27).", target: estimateTarget });
  }
  const unit = estimateUnit(estimate);
  if (unit !== undefined && scale !== undefined && estimate.published !== undefined && fitsScale(estimate.published.quantity, scale)) {
    const after = pointOf(estimate.estimate, unit, check);
    const before = pointOf(estimateExpression(estimate, estimate.published.law), unit, check);
    if (before !== undefined && after !== undefined && before > 0 && after > 0) {
      const ratio = Math.max(after / before, before / after);
      if (ratio >= 5 && blank(parameter.estimateReason)) findings.push({ severity: "warning", check: "Far from the prior", item, detail: `The estimate is ${Number(ratio.toPrecision(2))} times ${after > before ? "higher" : "lower"} than the Step 04 prior. Explain the difference in the estimate's reason.`, target: estimateTarget });
    }
  }
}

function recordFindings(da: DataAnalysis, findings: DaNeedFinding[]): void {
  const operating = da.plantStage === "OPERATIONAL";
  const parameters = new Map(da.parameters.map((parameter) => [parameter.uuid, parameter]));
  const sets = da.recordSets ?? [];
  const discards = (da.dataModificationAdjustments ?? []).filter((change) => change.pastDataDisposition === "DISCARDED" && change.effectiveDate !== undefined);
  if (sets.length > 0 && (da.failureEventClassifications ?? []).length === 0) findings.push({ severity: "warning", check: "No counting rules", item: "Records", detail: "Write down what counts as a failure before judging records (DA-C5)." });
  for (const set of sets) {
    const setTarget = { kind: "daRecordSet" as const, id: set.id };
    if (blank(set.name)) findings.push({ severity: "warning", check: "No name", item: set.id, detail: "Name the record set.", target: setTarget });
    if (blank(set.reference)) findings.push({ severity: "warning", check: "No reference", item: set.id, detail: "Say where the records come from.", target: setTarget });
    if (set.origin === "PLANT_RECORDS" && !operating) findings.push({ severity: "warning", check: "Plant records before operation", item: set.id, detail: "A plant that does not operate has no records of its own. Mark the set as technology evidence.", target: setTarget });
    const open = set.records.filter((record) => record.judgment === "OPEN").length;
    if (open > 0) findings.push({ severity: "warning", check: "Not judged", item: set.id, detail: `${open} ${open === 1 ? "record is" : "records are"} not judged yet (DA-C5).`, target: setTarget });
    const seen = new Set<string>();
    const ids = new Set(set.records.map((record) => record.id));
    for (const record of set.records) {
      const target = { kind: "daRecord" as const, id: `${set.id}|${record.id}` };
      const item = `${set.id} · ${record.id}`;
      if (seen.has(record.id)) findings.push({ severity: "error", check: "Duplicate record", item, detail: "Two records in this set share an ID.", target });
      seen.add(record.id);
      if (record.judgment === "FAILURE") {
        const parameter = record.parameterId === undefined ? undefined : parameters.get(record.parameterId);
        if (parameter === undefined) findings.push({ severity: "error", check: "No parameter", item, detail: "Say which parameter this failure counts against.", target });
        else if (!(parameter.evidence ?? []).some((evidence) => evidence.recordSetId === set.id && evidence.failuresFrom === "RECORDS")) findings.push({ severity: "warning", check: "Not used", item, detail: `This failure counts against ${parameter.uuid}, but ${parameter.uuid} does not count failures from ${set.id}.`, target });
        const at = decimalYear(record.date);
        for (const change of discards) {
          const effective = decimalYear(change.effectiveDate);
          if (at !== undefined && effective !== undefined && at < effective && record.parameterId !== undefined && change.affectedParameterIds.includes(record.parameterId)) findings.push({ severity: "warning", check: "Before a design change", item, detail: `This failure predates design change ${change.uuid}, which discards older data for ${record.parameterId} (DA-D10).`, target });
        }
      }
      if ((record.judgment === "NOT_FAILURE" || record.judgment === "EXCLUDED" || record.judgment === "REPEAT") && blank(record.reason)) findings.push({ severity: "error", check: "No reason", item, detail: "Give the reason for this judgment (DA-C4, DA-C5).", target });
      if (record.judgment === "REPEAT" && (record.repeatOf === undefined || !ids.has(record.repeatOf) || record.repeatOf === record.id)) findings.push({ severity: "error", check: "Repeat of what", item, detail: "Name the record this one repeats (DA-C6).", target });
    }
  }
  for (const rule of da.failureEventClassifications ?? []) {
    if (blank(rule.failureDefinitionBasis)) findings.push({ severity: "warning", check: "No definition", item: rule.uuid, detail: "State when a component state counts as a failure (DA-C5).", target: { kind: "daRule", id: rule.uuid } });
  }
  for (const change of da.dataModificationAdjustments ?? []) {
    const target = { kind: "daDesignChange" as const, id: change.uuid };
    if (blank(change.modificationDescription) || blank(change.basis)) findings.push({ severity: "warning", check: "Design change incomplete", item: change.uuid, detail: "Describe the change and the basis for its treatment of old data (DA-D10).", target });
    if (change.pastDataDisposition === "DISCARDED" && change.effectiveDate === undefined) findings.push({ severity: "warning", check: "No date", item: change.uuid, detail: "Give the date the change took effect, so older failures can be found.", target });
  }
}

function exposureFindings(da: DataAnalysis, findings: DaNeedFinding[]): void {
  const operating = da.plantStage === "OPERATIONAL";
  const groups = new Set((da.componentGroupings ?? []).map((group) => group.uuid));
  const basisCheck = (basis: string, item: string, target: DaNeedFinding["target"]): void => {
    if (!operating && basis === "RECORDS") findings.push({ severity: "warning", check: "Records before operation", item, detail: "Before operation, demands and hours come from the planned schedule (DA-C9).", target });
    if (operating && basis === "PLANNED_SCHEDULE") findings.push({ severity: "warning", check: "Planned values", item, detail: "An operating plant counts from its records or its annualized plan (DA-C8).", target });
    if (operating && basis === "ANNUALIZED_PLAN" && da.capabilityCategory !== "CC-I") findings.push({ severity: "warning", check: "Annualized plan", item, detail: "Capability Category II counts demands from actual practice (DA-C8).", target });
  };
  for (const row of da.demandCounts ?? []) {
    const target = { kind: "daDemand" as const, id: row.id };
    if (!groups.has(row.groupId)) findings.push({ severity: "error", check: "No population", item: row.id, detail: "Choose the population these demands belong to.", target });
    if (row.failureModeIds.length === 0) findings.push({ severity: "warning", check: "No modes tested", item: row.id, detail: "Say which failure modes these demands test (DA-C12).", target });
    if (blank(row.activity)) findings.push({ severity: "warning", check: "No activity", item: row.id, detail: "Name the test, maintenance act or operation.", target });
    basisCheck(row.basis, row.id, target);
  }
  for (const row of da.hourCounts ?? []) {
    const target = { kind: "daHours" as const, id: row.id };
    if (!groups.has(row.groupId)) findings.push({ severity: "error", check: "No population", item: row.id, detail: "Choose the population these hours belong to.", target });
    if (row.runHours === undefined && row.standbyHours === undefined) findings.push({ severity: "warning", check: "No hours", item: row.id, detail: "Enter the run hours, the standby hours, or both (DA-C10, DA-C11).", target });
    basisCheck(row.basis, row.id, target);
  }
}

function failureCheck(da: DataAnalysis): DaFailureCheck {
  const version = cacheVersion();
  const cached = checkCache.get(da);
  if (cached !== undefined && cached.version === version) return cached.check;
  const check: DaFailureCheck = { findings: [], pending: false };
  for (const parameter of failureParameters(da)) parameterFindingsFor(da, parameter, check);
  recordFindings(da, check.findings);
  exposureFindings(da, check.findings);
  const sorted = check.findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => RANK[a.finding.severity] - RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
  const result = { findings: sorted, pending: check.pending };
  checkCache.set(da, { version, check: result });
  return result;
}

function failureFindings(da: DataAnalysis): DaNeedFinding[] {
  return failureCheck(da).findings;
}

function failuresComplete(da: DataAnalysis): boolean {
  const parameters = failureParameters(da);
  if (parameters.length === 0) return false;
  if (parameters.some((parameter) => parameter.estimate === undefined)) return false;
  const check = failureCheck(da);
  return !check.pending && !check.findings.some((finding) => finding.severity === "error");
}

function recordUsers(da: DataAnalysis, setId: string): string[] {
  return da.parameters.filter((parameter) => parameter.trend?.recordSetId === setId || (parameter.evidence ?? []).some((evidence) => evidence.recordSetId === setId)).map((parameter) => parameter.uuid);
}

function withoutRecordSet(da: DataAnalysis, setId: string): DataAnalysis {
  return {
    ...da,
    recordSets: (da.recordSets ?? []).filter((set) => set.id !== setId),
    parameters: da.parameters.map((parameter) => {
      const evidence = parameter.evidence ?? [];
      const trend = parameter.trend;
      if (!evidence.some((item) => item.recordSetId === setId) && trend?.recordSetId !== setId) return parameter;
      return {
        ...parameter,
        evidence: evidence.map((item) => (item.recordSetId === setId ? { ...item, recordSetId: undefined } : item)),
        trend: trend?.recordSetId === setId ? { ...trend, recordSetId: undefined } : trend,
      };
    }),
  };
}

export {
  FAILURE_MODELS,
  MU_REACH,
  SIGMA_HIGH,
  SIGMA_LOW,
  countedRecords,
  decimalYear,
  estimateExpression,
  estimateSummary,
  estimateUnit,
  evidenceAloneLaw,
  failureFindings,
  failureParameters,
  failuresComplete,
  hasSpread,
  hyperpriorOf,
  isFailureParameter,
  lawExpression,
  linkedTestInterval,
  methodOf,
  estimateMissionTime,
  parameterEstimate,
  parameterScale,
  peakCount,
  pooledLaw,
  posteriorOf,
  priorSummary,
  priorWorth,
  publishedSummary,
  recordUsers,
  withEstimates,
  withoutRecordSet,
  type DaFailureComputation,
  type DaFailureEstimate,
  type DaFailureMethod,
  type DaPublishedPrior,
  type DaResolvedEvidence,
  type DaScale,
};
