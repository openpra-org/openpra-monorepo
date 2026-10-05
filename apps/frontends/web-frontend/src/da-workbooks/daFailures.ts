import { DistributionType, type ParameterDistribution } from "interfaces-mef-types/core/events";
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
import { isCurve, shapeMean, shapePoint, shapeQuantile, type DaShape } from "./daDistributions";
import {
  bayesUpdate,
  conflictProbability,
  constrainedNoninformative,
  evidenceAlone,
  laplaceTest,
  outputFor,
  peakCount,
  poolTest,
  populationUpdate,
  predictive,
  priorWeight,
  type DaOutput,
  type DaScale,
  type DaTerm,
  type DaUpdatePrior,
} from "./daEstimates";
import { parameterPrior, priorUse } from "./daSourcing";
import type { DaFindingSeverity, DaNeedFinding } from "./daSelectors";

const FAILURE_MODELS: ReadonlySet<DaQuantificationModel> = new Set(["DEMAND_PROBABILITY", "RUNNING_RATE", "MISSION_PROBABILITY", "STANDBY_RATE", "OTHER_PROBABILITY"]);

const RANK: Record<DaFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

type DaFailureMethod = "PRIOR" | "BAYES" | "POPULATION" | "TYPED";

type DaFailureComputation = "PRIOR" | "CONJUGATE" | "NUMERICAL" | "HIERARCHICAL";

interface DaResolvedEvidence {
  evidence: DaEvidence;
  label: string;
  failures?: number;
  exposure?: number;
  unit?: DaEvidenceUnit;
  yearsFrom?: string;
  yearsTo?: string;
  term?: DaTerm;
  problem?: string;
}

interface DaPublishedPrior {
  shape: ParameterDistribution;
  quantity: DaEstimateQuantity;
  label: string;
}

interface DaFailureEstimate {
  scale?: DaScale;
  missionHours?: number;
  unit: string;
  thetaUnit: string;
  published?: DaPublishedPrior;
  form: DaPriorForm;
  prior?: DaShape;
  evidence: DaResolvedEvidence[];
  terms: DaTerm[];
  method?: DaFailureMethod;
  computation?: DaFailureComputation;
  posterior?: DaShape;
  output?: DaOutput;
  problem?: string;
}

interface DaHeavyResult {
  computation?: DaFailureComputation;
  posterior?: DaShape;
  output?: DaOutput;
  problem?: string;
}

const heavyCache = new Map<string, DaHeavyResult>();

const estimateCache = new WeakMap<DataAnalysis, Map<string, DaFailureEstimate>>();

const findingCache = new WeakMap<DataAnalysis, DaNeedFinding[]>();

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
  if (parameter.valueMode === "TYPED" || (parameter.valueMode === undefined && parameter.value !== undefined)) return "TYPED";
  return undefined;
}

function formOf(parameter: DataAnalysisParameter): DaPriorForm {
  return parameter.priorForm ?? "AS_PUBLISHED";
}

function publishedPrior(da: DataAnalysis, parameter: DataAnalysisParameter): DaPublishedPrior | undefined {
  const result = parameterPrior(da, parameter);
  const use = priorUse(parameter);
  if (result === undefined || use === undefined) return undefined;
  return { shape: result.distribution, quantity: result.quantity, label: use.elicitationId ?? `${use.sourceId ?? "?"} · ${use.entryId ?? "?"}` };
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
  return parameter.quantificationModel === "DEMAND_PROBABILITY" || parameter.quantificationModel === "OTHER_PROBABILITY";
}

function yearsBetween(start: string | undefined, end: string | undefined): number | undefined {
  if (start === undefined || end === undefined) return undefined;
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from)) return undefined;
  return (to - from) / (365.25 * 24 * 3600 * 1000);
}

function decimalYear(text: string | undefined): number | undefined {
  if (text === undefined || text.trim().length === 0) return undefined;
  const parts = text.trim().split("-").map((part) => Number(part));
  const year = parts[0];
  if (year === undefined || !Number.isFinite(year)) return undefined;
  const month = parts[1];
  const day = parts[2];
  if (month === undefined || !Number.isFinite(month)) return year + 0.5;
  if (day === undefined || !Number.isFinite(day)) return year + (month - 0.5) / 12;
  return year + (month - 1) / 12 + (day - 0.5) / 365.25;
}

function countedRecords(set: DaRecordSet | undefined, parameterId: string): DaFailureRecord[] {
  return (set?.records ?? []).filter((record) => record.judgment === "FAILURE" && record.parameterId === parameterId);
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

function parameterScale(da: DataAnalysis, parameter: DataAnalysisParameter): DaScale | undefined {
  const model = parameter.quantificationModel;
  if (model === "RUNNING_RATE" || model === "STANDBY_RATE") return "RATE";
  if (model === "DEMAND_PROBABILITY" || model === "OTHER_PROBABILITY") return "PROBABILITY";
  if (model !== "MISSION_PROBABILITY") return undefined;
  const published = publishedPrior(da, parameter);
  if (published !== undefined && formOf(parameter) !== "JEFFREYS") return published.quantity === "PER_HOUR" ? "RATE" : "PROBABILITY";
  const units = (parameter.evidence ?? []).map((evidence) => evidence.exposureFrom === "ENTRY" ? unitOfQuantity(entryOf(da, evidence.sourceId, evidence.entryId)?.quantity ?? "FACTOR") : evidence.exposureFrom === "DEMANDS_AND_HOURS" ? "HOURS" : evidence.unit);
  return units.includes("DEMANDS") ? "PROBABILITY" : "RATE";
}

function resolveEvidence(da: DataAnalysis, parameter: DataAnalysisParameter, scale: DaScale | undefined): DaResolvedEvidence[] {
  return (parameter.evidence ?? []).map((evidence) => {
    const label = evidenceLabel(da, evidence);
    const entry = entryOf(da, evidence.sourceId, evidence.entryId);
    const set = recordSetOf(da, evidence.recordSetId);
    const resolved: DaResolvedEvidence = { evidence, label, yearsFrom: evidence.yearsFrom ?? (evidence.failuresFrom === "RECORDS" ? set?.yearsFrom : entry?.yearsFrom), yearsTo: evidence.yearsTo ?? (evidence.failuresFrom === "RECORDS" ? set?.yearsTo : entry?.yearsTo) };
    if (evidence.failuresFrom === "TYPED") resolved.failures = evidence.failures;
    else if (evidence.failuresFrom === "ENTRY") {
      if (entry === undefined) return { ...resolved, problem: "Pick the library estimate the counts come from." };
      resolved.failures = entry.failures;
    } else {
      if (set === undefined) return { ...resolved, problem: "Pick the record set the failures are counted from." };
      resolved.failures = countedRecords(set, parameter.uuid).length;
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
    if (resolved.failures === undefined) return { ...resolved, problem: "Enter the number of failures." };
    if (resolved.exposure === undefined || resolved.unit === undefined) return { ...resolved, problem: "Enter the demands or hours the failures happened in." };
    if (!(resolved.exposure > 0)) return { ...resolved, problem: "The exposure must be more than zero." };
    if (resolved.failures < 0) return { ...resolved, problem: "The failure count cannot be negative." };
    if (scale === undefined) return resolved;
    const failures = resolved.failures;
    const exposure = resolved.exposure;
    if (scale === "RATE") {
      if (resolved.unit === "DEMANDS") return { ...resolved, problem: "Failures in demands cannot update a rate per hour." };
      if (resolved.unit === "YEARS") {
        if (evidence.hoursPerYear === undefined || !(evidence.hoursPerYear > 0)) return { ...resolved, problem: "Enter the hours of exposure in a year, 8760 for a calendar year." };
        return { ...resolved, term: { kind: "POISSON", failures, exposure: exposure * evidence.hoursPerYear } };
      }
      return { ...resolved, term: { kind: "POISSON", failures, exposure } };
    }
    if (resolved.unit === "DEMANDS") {
      if (failures > exposure) return { ...resolved, problem: "There are more failures than demands." };
      return { ...resolved, term: { kind: "BINOMIAL", failures, exposure } };
    }
    const perDemand = evidence.hoursPerDemand ?? (parameter.quantificationModel === "MISSION_PROBABILITY" ? parameter.missionTimeHours : undefined);
    if (perDemand === undefined || !(perDemand > 0)) return { ...resolved, problem: "Enter the hours each demand covers, half the test interval for a standby failure." };
    if (resolved.unit === "YEARS") {
      if (evidence.hoursPerYear === undefined || !(evidence.hoursPerYear > 0)) return { ...resolved, problem: "Enter the hours of exposure in a year, 8760 for a calendar year." };
      return { ...resolved, term: { kind: "POISSON", failures, exposure: (exposure * evidence.hoursPerYear) / perDemand } };
    }
    return { ...resolved, term: { kind: "POISSON", failures, exposure: exposure / perDemand } };
  });
}

function unitLabel(parameter: DataAnalysisParameter, scale: DaScale | undefined): string {
  if (parameter.quantificationModel === "MISSION_PROBABILITY") return parameter.missionTimeHours === undefined ? "per mission" : `per ${Number(parameter.missionTimeHours.toPrecision(6))} h mission`;
  return scale === "RATE" ? "per hour" : "per demand";
}

function thetaLabel(parameter: DataAnalysisParameter, scale: DaScale | undefined): string {
  if (scale === "RATE") return "per hour";
  return parameter.quantificationModel === "MISSION_PROBABILITY" ? unitLabel(parameter, scale) : "per demand";
}

function updatePrior(form: DaPriorForm, published: DaPublishedPrior | undefined, scale: DaScale): { prior?: DaUpdatePrior; shape?: DaShape; problem?: string } {
  if (form === "JEFFREYS") {
    if (scale === "RATE") return { prior: { kind: "JEFFREYS_RATE" } };
    const shape: ParameterDistribution = { type: DistributionType.BETA, alpha: 0.5, betaParam: 0.5 };
    return { prior: { kind: "PROPER", shape }, shape };
  }
  if (published === undefined) return { problem: "No prior. Choose the source the estimate starts from in Step 04 Applicability." };
  if (form === "AS_PUBLISHED") return { prior: { kind: "PROPER", shape: published.shape }, shape: published.shape };
  const mean = shapeMean(published.shape);
  const cni = mean === undefined ? undefined : constrainedNoninformative(mean, scale);
  if (cni === undefined) return { problem: "The prior's mean cannot carry a constrained noninformative prior." };
  return { prior: { kind: "PROPER", shape: cni }, shape: cni };
}

function heavyKey(parts: Record<string, string | number | boolean | undefined>, shape: DaShape | undefined, terms: readonly DaTerm[]): string {
  const shapeKey = shape === undefined ? "" : isCurve(shape) ? `curve:${shape.mean}:${shape.us.length}:${shape.us[0] ?? 0}` : JSON.stringify(shape);
  return JSON.stringify({ parts, shapeKey, terms });
}

function heavy(key: string, run: () => DaHeavyResult): DaHeavyResult {
  const cached = heavyCache.get(key);
  if (cached !== undefined) return cached;
  const result = run();
  if (heavyCache.size > 400) heavyCache.clear();
  heavyCache.set(key, result);
  return result;
}

function parameterEstimate(da: DataAnalysis, parameter: DataAnalysisParameter): DaFailureEstimate {
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

function computeEstimate(da: DataAnalysis, parameter: DataAnalysisParameter): DaFailureEstimate {
  const scale = parameterScale(da, parameter);
  const form = formOf(parameter);
  const published = publishedPrior(da, parameter);
  const evidence = resolveEvidence(da, parameter, scale);
  const terms = evidence.flatMap((item) => (item.evidence.included && item.term !== undefined ? [item.term] : []));
  const method = methodOf(parameter);
  const missionHours = scale === "RATE" && parameter.quantificationModel === "MISSION_PROBABILITY" ? parameter.missionTimeHours : undefined;
  const base: DaFailureEstimate = { scale, missionHours, unit: unitLabel(parameter, scale), thetaUnit: thetaLabel(parameter, scale), published, form, evidence, terms, method };
  if (scale === undefined) return { ...base, problem: "The parameter has no failure model." };
  if (parameter.quantificationModel === "MISSION_PROBABILITY" && scale === "RATE" && !(parameter.missionTimeHours !== undefined && parameter.missionTimeHours > 0)) return { ...base, problem: "Enter the mission time in Step 03." };
  const chosen = updatePrior(form, published, scale);
  const withPrior: DaFailureEstimate = { ...base, prior: chosen.shape };
  if (method === undefined) return { ...withPrior, problem: "Choose how the estimate is made." };
  if (method === "TYPED") return withPrior;
  if (method === "POPULATION") {
    if (terms.length < 2) return { ...withPrior, problem: "Population variability needs at least two evidence sets in the update." };
    const targetIndex = parameter.populationTargetId === undefined ? undefined : evidence.filter((item) => item.evidence.included && item.term !== undefined).findIndex((item) => item.evidence.id === parameter.populationTargetId);
    if (targetIndex === -1) return { ...withPrior, problem: "The population target is not among the evidence sets in the update." };
    const key = heavyKey({ method, scale, missionHours, targetIndex }, undefined, terms);
    const result = heavy(key, () => {
      const population = populationUpdate(terms, scale, targetIndex);
      if (population === undefined) return { problem: "Population variability needs at least one failure across the sets." };
      const posterior = population.target ?? population.predictive;
      const output = outputFor(posterior, missionHours);
      return output === undefined ? { problem: "The estimate cannot be summarized." } : { computation: "HIERARCHICAL", posterior, output };
    });
    return { ...withPrior, ...result };
  }
  if (chosen.problem !== undefined || chosen.prior === undefined) return { ...withPrior, problem: chosen.problem ?? "No prior." };
  const prior = chosen.prior;
  if (method === "PRIOR") {
    if (prior.kind !== "PROPER" || form === "JEFFREYS") return { ...withPrior, problem: "A Jeffreys prior is not an estimate on its own. Use it in a Bayes update." };
    const shape = prior.shape;
    const key = heavyKey({ method, scale, missionHours }, shape, []);
    return { ...withPrior, ...heavy(key, () => {
      const output = outputFor(shape, missionHours);
      return output === undefined ? { problem: "The prior cannot be summarized." } : { computation: "PRIOR", posterior: shape, output };
    }) };
  }
  if (prior.kind === "PROPER" && shapePoint(prior.shape) !== undefined) return { ...withPrior, problem: "A point value cannot be updated. Use the constrained noninformative form." };
  if (terms.length === 0) {
    if (prior.kind !== "PROPER" || form === "JEFFREYS") return { ...withPrior, problem: "A Jeffreys prior needs evidence to update." };
    const shape = prior.shape;
    const key = heavyKey({ method: "PRIOR", scale, missionHours }, shape, []);
    return { ...withPrior, ...heavy(key, () => {
      const output = outputFor(shape, missionHours);
      return output === undefined ? { problem: "The prior cannot be summarized." } : { computation: "PRIOR", posterior: shape, output };
    }) };
  }
  const key = heavyKey({ method, scale, missionHours, prior: prior.kind }, prior.kind === "PROPER" ? prior.shape : undefined, terms);
  return { ...withPrior, ...heavy(key, () => {
    const update = bayesUpdate(prior, terms, scale);
    if (update === undefined) return { problem: "The update cannot be computed with this prior and evidence." };
    const output = outputFor(update.shape, missionHours);
    return output === undefined ? { problem: "The estimate cannot be summarized." } : { computation: update.computation, posterior: update.shape, output };
  }) };
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

function withEstimates(da: DataAnalysis): DataAnalysis {
  let changed = false;
  const parameters = da.parameters.map((parameter) => {
    if (!isFailureParameter(parameter) || parameter.valueMode !== "CALCULATED") return parameter;
    const output = parameterEstimate(da, parameter).output;
    if (output === undefined) return parameter;
    const value = output.summary.mean;
    const distribution = output.distribution;
    if (sameNumber(parameter.value, value) && parameter.valueType === "MEAN" && sameDistribution(parameter.uncertainty?.distribution, distribution)) return parameter;
    changed = true;
    return { ...parameter, value, valueType: "MEAN" as const, uncertainty: { ...(parameter.uncertainty ?? {}), distribution } };
  });
  return changed ? { ...da, parameters } : da;
}

function sciShort(value: number): string {
  return Number(value.toPrecision(2)).toExponential().replace("e+", "E").replace("e", "E");
}

function shapeRange90(shape: DaShape | undefined): [number, number] | undefined {
  if (shape === undefined) return undefined;
  const low = shapeQuantile(shape, 0.05);
  const high = shapeQuantile(shape, 0.95);
  return low === undefined || high === undefined ? undefined : [low, high];
}

function parameterFindingsFor(da: DataAnalysis, parameter: DataAnalysisParameter, findings: DaNeedFinding[]): void {
  const item = parameter.uuid;
  const estimateTarget = { kind: "daEstimate" as const, id: parameter.uuid };
  const evidenceTarget = { kind: "daEvidence" as const, id: parameter.uuid };
  const priorTarget = { kind: "daPrior" as const, id: parameter.uuid };
  const estimate = parameterEstimate(da, parameter);
  const method = estimate.method;
  const ccTwo = da.capabilityCategory !== "CC-I";
  const operating = da.plantStage === "OPERATIONAL";
  if (method === undefined) {
    findings.push({ severity: "error", check: "No estimate", item, detail: "Choose how the estimate is made: the prior as is, a Bayes update, population variability, or a typed value.", target: estimateTarget });
    return;
  }
  for (const resolved of estimate.evidence) {
    const evidence = resolved.evidence;
    const what = resolved.label;
    if (evidence.included && resolved.problem !== undefined) findings.push({ severity: "error", check: "Evidence incomplete", item, detail: `${what}: ${resolved.problem}`, target: evidenceTarget });
    if (blank(evidence.reason)) findings.push({ severity: "error", check: "No reason", item, detail: `Say why ${what} applies to this parameter.`, target: evidenceTarget });
    if (!evidence.included && blank(evidence.exclusionReason)) findings.push({ severity: "error", check: "No exclusion reason", item, detail: `Say why ${what} is left out of the update (DA-C4).`, target: evidenceTarget });
    if (evidence.included && evidence.boundary === "DIFFERENT") findings.push({ severity: "error", check: "Boundary differs", item, detail: `${what} covers a different boundary. Leave it out or adjust it (DA-A2).`, target: evidenceTarget });
    if (evidence.included && !operating && evidence.origin === "PLANT_RECORDS") findings.push({ severity: "warning", check: "Plant records before operation", item, detail: `${what} is marked as plant records, but the plant does not operate yet.`, target: evidenceTarget });
    if (evidence.included && !operating && evidence.exposureFrom === "DEMANDS_AND_HOURS") findings.push({ severity: "warning", check: "Planned exposure", item, detail: `Before operation, the demands and hours are planned values, not experience. Type the exposure ${what} was observed over.`, target: evidenceTarget });
    const use = priorUse(parameter);
    if (evidence.included && use !== undefined && evidence.sourceId !== undefined && evidence.sourceId === use.sourceId) {
      if (evidence.entryId === use.entryId) findings.push({ severity: "error", check: "Counted twice", item, detail: `${what} is also the prior. Its failures are already inside it.`, target: evidenceTarget });
      else findings.push({ severity: "warning", check: "Same source as the prior", item, detail: `${what} comes from the same source as the prior. Make sure they share no failures.`, target: evidenceTarget });
    }
  }
  if (method === "TYPED") {
    const distribution = parameter.uncertainty?.distribution;
    if (parameter.value === undefined) findings.push({ severity: "error", check: "No value", item, detail: "Type the estimate, or let DA calculate it.", target: estimateTarget });
    if (distribution === undefined || distribution.type === DistributionType.POINT_ESTIMATE) findings.push({ severity: "warning", check: "No uncertainty", item, detail: "Give the typed estimate a distribution (DA-D3).", target: estimateTarget });
    else {
      const mean = shapeMean(distribution);
      if (mean !== undefined && parameter.value !== undefined && Math.abs(mean - parameter.value) > 0.05 * Math.abs(parameter.value)) findings.push({ severity: "warning", check: "Mean differs", item, detail: `The value is ${sciShort(parameter.value)}, but the distribution's mean is ${sciShort(mean)}.`, target: estimateTarget });
    }
    if (blank(parameter.estimateReason)) findings.push({ severity: "warning", check: "No basis", item, detail: "Say where the typed estimate comes from.", target: estimateTarget });
    return;
  }
  if (estimate.problem !== undefined) {
    findings.push({ severity: "error", check: "Cannot estimate", item, detail: estimate.problem, target: estimate.problem.startsWith("No prior") ? { kind: "daSourcing", id: parameter.uuid } : estimateTarget });
    return;
  }
  if (estimate.form !== "AS_PUBLISHED" && blank(parameter.priorFormReason)) findings.push({ severity: "warning", check: "No prior reason", item, detail: "Say why the prior is not used as published.", target: priorTarget });
  const includedEvidence = estimate.evidence.filter((resolved) => resolved.evidence.included);
  const posterior = estimate.posterior;
  const output = estimate.output;
  if (method === "PRIOR") {
    if (includedEvidence.length > 0) findings.push({ severity: ccTwo ? "error" : "warning", check: "Evidence not used", item, detail: "Evidence is in the update but the prior is used as is. Update it, even with zero failures (DA-D1).", target: estimateTarget });
    if (estimate.prior !== undefined && shapePoint(estimate.prior) !== undefined) findings.push({ severity: "warning", check: "No uncertainty", item, detail: "A point value carries no uncertainty (DA-D3). Use the constrained noninformative form or another source.", target: priorTarget });
    if (parameter.isRiskSignificant === true && ccTwo && includedEvidence.length === 0) findings.push({ severity: "note", check: "Generic estimate", item, detail: "This risk-significant parameter has no plant or technology evidence yet, so the generic estimate stands (DA-D1).", target: evidenceTarget });
  }
  if (method === "BAYES" && estimate.terms.length === 0) findings.push({ severity: "note", check: "Nothing to update", item, detail: "No evidence is in the update, so the estimate equals the prior.", target: evidenceTarget });
  if (method === "BAYES" && estimate.terms.length > 0 && estimate.prior !== undefined && estimate.form !== "JEFFREYS") {
    const pooled = estimate.terms.every((term) => term.kind === "POISSON") ? { kind: "POISSON" as const } : estimate.terms.every((term) => term.kind === "BINOMIAL") ? { kind: "BINOMIAL" as const } : undefined;
    if (pooled !== undefined) {
      const failures = estimate.terms.reduce((total, term) => total + term.failures, 0);
      const exposure = estimate.terms.reduce((total, term) => total + term.exposure, 0);
      const check = estimate.scale === undefined ? undefined : predictive(estimate.prior, { kind: pooled.kind, failures, exposure }, estimate.scale);
      if (check !== undefined) {
        const p = conflictProbability(check, failures);
        if (p < 0.05) findings.push({ severity: blank(parameter.estimateReason) ? "warning" : "note", check: "Prior and evidence conflict", item, detail: `${failures} ${failures === 1 ? "failure" : "failures"} against ${Number(check.expected.toPrecision(3))} expected under the prior, P = ${sciShort(p)}. Investigate before updating (${operating ? "DA-D4" : "DA-D5"}).`, target: priorTarget });
      }
    }
  }
  if (method === "BAYES" && estimate.form === "JEFFREYS" && estimate.published !== undefined && output !== undefined) {
    const failures = estimate.terms.reduce((total, term) => total + term.failures, 0);
    const publishedMean = shapeMean(estimate.published.shape);
    const thetaMean = posterior === undefined ? undefined : shapeMean(posterior);
    if (failures === 0 && publishedMean !== undefined && thetaMean !== undefined && thetaMean > 3 * publishedMean) findings.push({ severity: "warning", check: "Too little exposure", item, detail: "With zero failures and little exposure, the Jeffreys estimate overstates a reliable component's failure probability.", target: priorTarget });
  }
  if ((method === "BAYES" || method === "POPULATION") && estimate.terms.length >= 2) {
    const test = poolTest(estimate.terms);
    if (test !== undefined && test.p < 0.05 && method === "BAYES") findings.push({ severity: "warning", check: "Sets differ", item, detail: `The evidence sets do not pool (chi-square P = ${sciShort(test.p)}${test.small ? ", small counts" : ""}). Use population variability or split the parameter (DA-B2).`, target: evidenceTarget });
  }
  for (const resolved of includedEvidence) {
    if (resolved.evidence.failuresFrom !== "RECORDS") continue;
    const set = recordSetOf(da, resolved.evidence.recordSetId);
    const times = countedRecords(set, parameter.uuid).flatMap((record) => {
      const at = decimalYear(record.date);
      return at === undefined ? [] : [at];
    });
    const start = decimalYear(resolved.yearsFrom);
    const endYear = decimalYear(resolved.yearsTo);
    if (start === undefined || endYear === undefined) continue;
    const trend = laplaceTest(times, Math.floor(start), Math.floor(endYear) + 1);
    if (trend !== undefined && trend.p < 0.05) findings.push({ severity: "warning", check: "Trend", item, detail: `The counted failures in ${resolved.label} ${trend.u > 0 ? "rise" : "fall"} over time (Laplace test P = ${sciShort(trend.p)}). A constant rate may not hold (DA-B2).`, target: evidenceTarget });
  }
  if (posterior !== undefined && isCurve(posterior) && peakCount(posterior) > 1) findings.push({ severity: "warning", check: "Two peaks", item, detail: "The posterior has more than one peak. The prior and the evidence may describe different equipment.", target: estimateTarget });
  if (method === "BAYES" && posterior !== undefined && estimate.terms.length > 0) {
    const range = shapeRange90(estimate.prior);
    const mean = shapeMean(posterior);
    if (range !== undefined && mean !== undefined && (mean < range[0] || mean > range[1]) && blank(parameter.estimateReason)) findings.push({ severity: "warning", check: "Outside the prior", item, detail: "The posterior mean lies outside the prior's 5th to 95th range. Say why in the estimate's reason (DA-N-27).", target: estimateTarget });
  }
  if (output !== undefined && estimate.published !== undefined) {
    const published = estimate.published.shape;
    const missionHours = estimate.missionHours;
    const before = heavy(heavyKey({ method: "PUBLISHED", missionHours }, published, []), () => {
      const result = outputFor(published, missionHours);
      return result === undefined ? {} : { output: result };
    }).output?.summary.mean;
    const after = output.summary.mean;
    if (before !== undefined && before > 0 && after > 0) {
      const ratio = Math.max(after / before, before / after);
      if (ratio >= 5 && blank(parameter.estimateReason)) findings.push({ severity: "warning", check: "Far from the prior", item, detail: `The estimate is ${Number(ratio.toPrecision(2))} times ${after > before ? "higher" : "lower"} than the Step 04 prior. Explain the difference in the estimate's reason.`, target: estimateTarget });
    }
  }
  if (output !== undefined && output.fitError !== undefined && output.fitError > 0.1) findings.push({ severity: "note", check: "Fitted distribution", item, detail: `The stored ${output.fit === "BETA" ? "beta" : "lognormal"} differs from the exact result by ${Math.round(output.fitError * 100)}% at the 5th or 95th percentile.`, target: estimateTarget });
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

function failureFindings(da: DataAnalysis): DaNeedFinding[] {
  const cached = findingCache.get(da);
  if (cached !== undefined) return cached;
  const findings: DaNeedFinding[] = [];
  for (const parameter of failureParameters(da)) parameterFindingsFor(da, parameter, findings);
  recordFindings(da, findings);
  exposureFindings(da, findings);
  const sorted = findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => RANK[a.finding.severity] - RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
  findingCache.set(da, sorted);
  return sorted;
}

function failuresComplete(da: DataAnalysis): boolean {
  const parameters = failureParameters(da);
  if (parameters.length === 0) return false;
  if (parameters.some((parameter) => parameter.value === undefined)) return false;
  return !failureFindings(da).some((finding) => finding.severity === "error");
}

function recordUsers(da: DataAnalysis, setId: string): string[] {
  return da.parameters.filter((parameter) => (parameter.evidence ?? []).some((evidence) => evidence.recordSetId === setId)).map((parameter) => parameter.uuid);
}

function withoutRecordSet(da: DataAnalysis, setId: string): DataAnalysis {
  return {
    ...da,
    recordSets: (da.recordSets ?? []).filter((set) => set.id !== setId),
    parameters: da.parameters.map((parameter) => {
      const evidence = parameter.evidence ?? [];
      if (!evidence.some((item) => item.recordSetId === setId)) return parameter;
      return { ...parameter, evidence: evidence.map((item) => (item.recordSetId === setId ? { ...item, recordSetId: undefined } : item)) };
    }),
  };
}

export {
  FAILURE_MODELS,
  countedRecords,
  decimalYear,
  evidenceAlone,
  failureFindings,
  failureParameters,
  failuresComplete,
  isFailureParameter,
  methodOf,
  parameterEstimate,
  parameterScale,
  priorWeight,
  recordUsers,
  withEstimates,
  withoutRecordSet,
  type DaFailureComputation,
  type DaFailureEstimate,
  type DaFailureMethod,
  type DaPublishedPrior,
  type DaResolvedEvidence,
};
