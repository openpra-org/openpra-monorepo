import { DistributionType, type ParameterDistribution } from "interfaces-mef-types/core/events";
import { z } from "zod";
import type {
  CcfParameterEstimation,
  DataAnalysis,
  DataAnalysisParameter,
  DaElicitation,
  DaEstimateQuantity,
  DaEvidenceKind,
  DaQuantificationModel,
  DaSource,
  DaSourceEntry,
  DaSourceUse,
} from "interfaces-mef-types/da/data-analysis";
import { DaSourceEntrySchema } from "interfaces-mef-types/zod/da/data-analysis";
import { DA_SOURCE_CATALOG } from "interfaces-mef-types/da/generic-sources";
import { distributionMean, distributionQuantile, judgmentComponent, lognormalFromMean, poolJudgments, scaleDistribution, validDistribution, type LogComponent, type PooledJudgment } from "./daDistributions";
import type { DaFindingSeverity, DaNeedFinding } from "./daSelectors";
import { templateEntryIds } from "./daCcf";

const EVIDENCE_ORDER: DaEvidenceKind[] = ["PLANT_RECORDS", "TECHNOLOGY", "GENERIC_NUCLEAR", "ANALOGOUS_INDUSTRY", "ENGINEERING_MODEL", "EXPERT_JUDGMENT"];

const QUANTITIES_FOR_MODEL: Record<DaQuantificationModel, DaEstimateQuantity[]> = {
  DEMAND_PROBABILITY: ["PER_DEMAND"],
  RUNNING_RATE: ["PER_HOUR"],
  MISSION_PROBABILITY: ["PER_HOUR", "PROBABILITY"],
  STANDBY_RATE: ["PER_HOUR"],
  UNAVAILABILITY: ["FRACTION"],
  HUMAN_ERROR: ["PER_DEMAND", "PROBABILITY"],
  NON_RECOVERY: ["PROBABILITY", "HOURS"],
  FREQUENCY: ["PER_YEAR"],
  OTHER_PROBABILITY: ["PROBABILITY", "PER_DEMAND"],
};

const RANK: Record<DaFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const OUTER_TO_ERROR_FACTOR = 1.6448536269514722 / (2 * 1.959963984540054);

function blankText(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function nextCode(prefix: string, taken: readonly string[], width = 2): string {
  const used = new Set(taken);
  let n = 1;
  while (used.has(`${prefix}-${String(n).padStart(width, "0")}`)) n += 1;
  return `${prefix}-${String(n).padStart(width, "0")}`;
}

type DaFitBasis = "PRINTED" | "MEDIAN_P95" | "MEAN_P05_P95" | "MEAN_INTERVAL" | "COUNTS" | "MEAN" | "MEDIAN";

interface DaEntryFit {
  distribution: ParameterDistribution;
  basis: DaFitBasis;
}

function entryFit(entry: DaSourceEntry): DaEntryFit | undefined {
  if (entry.distribution !== undefined && validDistribution(entry.distribution)) return { distribution: entry.distribution, basis: "PRINTED" };
  if (entry.median !== undefined && entry.p95 !== undefined && entry.p95 > entry.median && entry.median > 0) return { distribution: { type: DistributionType.LOGNORMAL, median: entry.median, errorFactor: entry.p95 / entry.median }, basis: "MEDIAN_P95" };
  if (entry.mean !== undefined && entry.p05 !== undefined && entry.p95 !== undefined && entry.p05 > 0 && entry.p95 > entry.p05) return { distribution: lognormalFromMean(entry.mean, Math.sqrt(entry.p95 / entry.p05)), basis: "MEAN_P05_P95" };
  if (entry.mean !== undefined && entry.p025 !== undefined && entry.p975 !== undefined && entry.p025 > 0 && entry.p975 > entry.p025) return { distribution: lognormalFromMean(entry.mean, Math.pow(entry.p975 / entry.p025, OUTER_TO_ERROR_FACTOR)), basis: "MEAN_INTERVAL" };
  const failures = entry.failures;
  const exposure = entry.exposure;
  if (failures !== undefined && exposure !== undefined && failures >= 0 && exposure > 0) {
    if (entry.quantity !== "PER_DEMAND" && entry.quantity !== "PROBABILITY") return { distribution: { type: DistributionType.GAMMA, shape: failures + 0.5, rate: exposure }, basis: "COUNTS" };
    if (failures <= exposure) return { distribution: { type: DistributionType.BETA, alpha: failures + 0.5, betaParam: exposure - failures + 0.5 }, basis: "COUNTS" };
  }
  if (entry.mean !== undefined) return { distribution: { type: DistributionType.POINT_ESTIMATE, value: entry.mean }, basis: "MEAN" };
  if (entry.median !== undefined) return { distribution: { type: DistributionType.POINT_ESTIMATE, value: entry.median }, basis: "MEDIAN" };
  return undefined;
}

function entryDistribution(entry: DaSourceEntry): ParameterDistribution | undefined {
  return entryFit(entry)?.distribution;
}

function elicitationWeights(elicitation: DaElicitation): LogComponent[] {
  const evaluators = elicitation.experts.filter((expert) => expert.role === "EVALUATOR");
  const stated = evaluators.some((expert) => expert.weight !== undefined);
  return evaluators.flatMap((expert) => {
    if (expert.p05 === undefined || expert.median === undefined || expert.p95 === undefined) return [];
    const part = judgmentComponent(expert.p05, expert.median, expert.p95, stated ? expert.weight ?? 0 : 1);
    return part === undefined ? [] : [part];
  });
}

function elicitationResult(elicitation: DaElicitation): PooledJudgment | undefined {
  return poolJudgments(elicitationWeights(elicitation), elicitation.pooling);
}

interface DaUseBase {
  distribution: ParameterDistribution;
  quantity: DaEstimateQuantity;
  sourceKind: DaEvidenceKind;
  label: string;
}

function sourceUseBase(da: DataAnalysis, use: DaSourceUse): DaUseBase | undefined {
  if (use.elicitationId !== undefined) {
    const elicitation = (da.elicitations ?? []).find((candidate) => candidate.id === use.elicitationId);
    const result = elicitation === undefined ? undefined : elicitationResult(elicitation);
    if (elicitation === undefined || result === undefined) return undefined;
    return { distribution: result.distribution, quantity: elicitation.quantity, sourceKind: "EXPERT_JUDGMENT", label: elicitation.id };
  }
  const source = (da.sources ?? []).find((candidate) => candidate.id === use.sourceId);
  const entry = source?.entries.find((candidate) => candidate.id === use.entryId);
  if (source === undefined || entry === undefined) return undefined;
  const distribution = entryDistribution(entry);
  if (distribution === undefined) return undefined;
  return { distribution, quantity: entry.quantity, sourceKind: source.kind, label: `${source.name} · ${entry.id}` };
}

type DaFactorPick = "nominal" | "low" | "high";

interface DaUseResult {
  distribution: ParameterDistribution;
  quantity: DaEstimateQuantity;
  mean: number;
  p05: number;
  p95: number;
}

function sourceUseResult(da: DataAnalysis, use: DaSourceUse, pick: DaFactorPick = "nominal"): DaUseResult | undefined {
  const base = sourceUseBase(da, use);
  if (base === undefined) return undefined;
  let quantity = base.quantity;
  let factor = 1;
  if (use.hoursPerYear !== undefined && use.hoursPerYear > 0 && quantity === "PER_YEAR") {
    factor /= use.hoursPerYear;
    quantity = "PER_HOUR";
  }
  if (use.standbyHours !== undefined && quantity === "PER_HOUR") {
    factor *= use.standbyHours;
    quantity = "PER_DEMAND";
  }
  if (use.verdict === "SCALED") {
    for (const item of use.factors ?? []) factor *= pick === "low" ? item.low : pick === "high" ? item.high : item.nominal;
  }
  const distribution = factor === 1 ? base.distribution : scaleDistribution(base.distribution, factor);
  if (distribution === undefined) return undefined;
  const mean = distributionMean(distribution);
  const p05 = distributionQuantile(distribution, 0.05);
  const p95 = distributionQuantile(distribution, 0.95);
  if (mean === undefined || p05 === undefined || p95 === undefined) return undefined;
  return { distribution, quantity, mean, p05, p95 };
}

function priorUse(parameter: DataAnalysisParameter): DaSourceUse | undefined {
  const id = parameter.priorUseId;
  return id === undefined ? undefined : (parameter.sourceUses ?? []).find((use) => use.id === id);
}

function parameterPrior(da: DataAnalysis, parameter: DataAnalysisParameter): DaUseResult | undefined {
  const use = priorUse(parameter);
  return use === undefined ? undefined : sourceUseResult(da, use);
}

function hourlyQuantity(base: DaUseBase, use: DaSourceUse): DaEstimateQuantity {
  return use.hoursPerYear !== undefined && base.quantity === "PER_YEAR" ? "PER_HOUR" : base.quantity;
}

function sourceUseQuantity(da: DataAnalysis, use: DaSourceUse): DaEstimateQuantity | undefined {
  const base = sourceUseBase(da, use);
  if (base === undefined) return undefined;
  const hourly = hourlyQuantity(base, use);
  return use.standbyHours !== undefined && hourly === "PER_HOUR" ? "PER_DEMAND" : hourly;
}

function needsHoursPerYear(da: DataAnalysis, use: DaSourceUse, model: DaQuantificationModel | undefined): boolean {
  const base = sourceUseBase(da, use);
  if (base === undefined || model === undefined || base.quantity !== "PER_YEAR") return false;
  return !QUANTITIES_FOR_MODEL[model].includes("PER_YEAR") && QUANTITIES_FOR_MODEL[model].includes("PER_HOUR");
}

function needsStandbyHours(da: DataAnalysis, use: DaSourceUse, model: DaQuantificationModel | undefined): boolean {
  const base = sourceUseBase(da, use);
  if (base === undefined || model === undefined || hourlyQuantity(base, use) !== "PER_HOUR") return false;
  return !QUANTITIES_FOR_MODEL[model].includes("PER_HOUR") && QUANTITIES_FOR_MODEL[model].includes("PER_DEMAND");
}

function templateUses(estimate: CcfParameterEstimation, sourceId: string, entryId?: string): boolean {
  if (estimate.priorSourceId !== sourceId || estimate.priorTemplate === undefined) return false;
  if (entryId === undefined) return true;
  return estimate.groupSize !== undefined && templateEntryIds(estimate.priorTemplate, estimate.groupSize).includes(entryId);
}

function sourceUsers(da: DataAnalysis, sourceId: string): string[] {
  const parameters = da.parameters.filter((parameter) => (parameter.sourceUses ?? []).some((use) => use.sourceId === sourceId)).map((parameter) => parameter.uuid);
  return [...parameters, ...(da.ccfParameterEstimations ?? []).filter((estimate) => templateUses(estimate, sourceId)).map((estimate) => estimate.uuid)];
}

function entryUsers(da: DataAnalysis, sourceId: string, entryId: string): string[] {
  const parameters = da.parameters.filter((parameter) => (parameter.sourceUses ?? []).some((use) => use.sourceId === sourceId && use.entryId === entryId)).map((parameter) => parameter.uuid);
  return [...parameters, ...(da.ccfParameterEstimations ?? []).filter((estimate) => templateUses(estimate, sourceId, entryId)).map((estimate) => estimate.uuid)];
}

function elicitationUsers(da: DataAnalysis, elicitationId: string): string[] {
  return da.parameters.filter((parameter) => (parameter.sourceUses ?? []).some((use) => use.elicitationId === elicitationId)).map((parameter) => parameter.uuid);
}

function needsSourcing(parameter: DataAnalysisParameter): boolean {
  if (parameter.valueMode === "LINKED") return false;
  if (parameter.quantificationModel === "UNAVAILABILITY") return parameter.valueMode === "CALCULATED" && parameter.maintenance?.method === "GENERIC";
  if (parameter.quantificationModel === "NON_RECOVERY") return parameter.valueMode === "CALCULATED" && parameter.restoration?.from === "SOURCES";
  if (parameter.quantificationModel === "FREQUENCY") return parameter.valueMode === "CALCULATED";
  return true;
}

function needsPrior(parameter: DataAnalysisParameter): boolean {
  return needsSourcing(parameter) && parameter.quantificationModel !== "NON_RECOVERY" && parameter.quantificationModel !== "FREQUENCY";
}

function sourceFindings(da: DataAnalysis): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  const sources = da.sources ?? [];
  const preOperational = da.plantStage === "PRE_OPERATIONAL";
  for (const source of sources) {
    const target = { kind: "daSource" as const, id: source.id };
    const missing = [
      blankText(source.covers) ? "what it covers" : "",
      source.yearsFrom === undefined && source.yearsTo === undefined && source.kind !== "EXPERT_JUDGMENT" && source.kind !== "ENGINEERING_MODEL" ? "its years" : "",
      blankText(source.boundaryConvention) ? "how it draws boundaries" : "",
      blankText(source.failureCounting) ? "how it counts failures" : "",
      blankText(source.quality) ? "its quality" : "",
    ].filter((part) => part.length > 0);
    if (missing.length > 0) findings.push({ severity: "warning", check: "Source incomplete", item: source.id, detail: `Record ${missing.join(", ")} (DA-C1).`, target });
    if (preOperational && source.kind === "PLANT_RECORDS") findings.push({ severity: "warning", check: "Plant records before operation", item: source.id, detail: "A plant that is not operating has no records of its own. Classify this source by what it really is.", target });
    const seen = new Set<string>();
    for (const entry of source.entries) {
      const item = `${source.id} · ${entry.id}`;
      const entryTarget = { kind: "daEntry" as const, id: `${source.id}|${entry.id}` };
      if (seen.has(entry.id)) findings.push({ severity: "error", check: "Duplicate estimate", item, detail: "Two estimates in this source share an ID.", target: entryTarget });
      seen.add(entry.id);
      if (entry.distribution !== undefined && !validDistribution(entry.distribution)) findings.push({ severity: "error", check: "Bad distribution", item, detail: "The distribution parameters must be positive.", target: entryTarget });
      const distribution = entryDistribution(entry);
      if (distribution === undefined) {
        findings.push({ severity: "error", check: "No estimate", item, detail: "Give a distribution, a mean or median, or the failures and exposure.", target: entryTarget });
        continue;
      }
      const derived = distributionMean(distribution);
      if (entry.mean !== undefined && derived !== undefined && entry.distribution !== undefined && Math.abs(derived - entry.mean) > 0.05 * Math.abs(entry.mean)) {
        findings.push({ severity: "warning", check: "Mean differs", item, detail: `The recorded mean is ${Number(entry.mean.toPrecision(3))}, but the distribution gives ${Number(derived.toPrecision(3))}.`, target: entryTarget });
      }
    }
  }
  for (const parameter of da.parameters) {
    if (!needsSourcing(parameter)) continue;
    const target = { kind: "daSourcing" as const, id: parameter.uuid };
    const item = parameter.uuid;
    const uses = parameter.sourceUses ?? [];
    const model = parameter.quantificationModel;
    if (uses.length === 0) {
      findings.push({ severity: "error", check: "No source", item, detail: "Consider at least one source for this parameter (DA-C1, DA-D2).", target });
      continue;
    }
    const prior = priorUse(parameter);
    if (prior === undefined) {
      if (needsPrior(parameter)) findings.push({ severity: "error", check: "No prior", item, detail: "Choose the source the estimate starts from.", target });
    } else if (prior.verdict === "REJECTED") findings.push({ severity: "error", check: "Rejected prior", item, detail: "The prior comes from a source marked as not applying.", target });
    const usedKinds: DaEvidenceKind[] = [];
    for (const use of uses) {
      const base = sourceUseBase(da, use);
      if (base === undefined) {
        findings.push({ severity: "error", check: "Source missing", item, detail: "A considered source or estimate no longer exists.", target });
        continue;
      }
      if (use.verdict !== "REJECTED") usedKinds.push(base.sourceKind);
      if (blankText(use.reason)) findings.push({ severity: "error", check: "No reason", item, detail: `Say why ${base.label} ${use.verdict === "REJECTED" ? "does not apply" : "applies"}.`, target });
      if (use.verdict === "REJECTED") continue;
      if (use.boundary === "DIFFERENT") findings.push({ severity: "error", check: "Boundary differs", item, detail: `${base.label} draws a different boundary. Adjust it or reject the source (DA-A2, DA-C1).`, target });
      if (model !== undefined) {
        if (needsHoursPerYear(da, use, model) && use.hoursPerYear === undefined) findings.push({ severity: "error", check: "No hours per year", item, detail: `${base.label} is a frequency per year. Enter the hours of exposure in a year, 8760 for a calendar year, to turn it into a rate per hour.`, target });
        if (needsStandbyHours(da, use, model) && use.standbyHours === undefined) findings.push({ severity: "error", check: "No exposure hours", item, detail: `${base.label} is a rate per hour. Enter the exposure hours per demand, half the test interval for a standby failure, to turn it into a probability per demand.`, target });
        const quantity = sourceUseQuantity(da, use);
        const waiting = (needsStandbyHours(da, use, model) && use.standbyHours === undefined) || (needsHoursPerYear(da, use, model) && use.hoursPerYear === undefined);
        if (quantity !== undefined && !waiting && !QUANTITIES_FOR_MODEL[model].includes(quantity)) findings.push({ severity: "error", check: "Units do not fit", item, detail: `${base.label} is not in a unit this parameter's model can use.`, target });
      }
      if (use.verdict === "SCALED") {
        const factors = use.factors ?? [];
        if (factors.length === 0) findings.push({ severity: "error", check: "No factors", item, detail: `${base.label} is scaled, so list each factor with a low and a high value.`, target });
        for (const factor of factors) {
          if (blankText(factor.name) || !(factor.low > 0) || !(factor.low <= factor.nominal && factor.nominal <= factor.high)) findings.push({ severity: "error", check: "Factor bounds", item, detail: `Factor ${factor.name.trim().length > 0 ? factor.name : factor.id} needs a name and positive values with low ≤ nominal ≤ high.`, target });
          else if (blankText(factor.basis)) findings.push({ severity: "warning", check: "Factor basis", item, detail: `Say what supports factor ${factor.name}.`, target });
        }
        if (sourceUseResult(da, use) === undefined && factors.length > 0) findings.push({ severity: "error", check: "Scaling fails", item, detail: `${base.label} cannot be scaled this far. A probability would exceed one.`, target });
      }
    }
    const kind = parameter.evidenceKind;
    if (kind === undefined) findings.push({ severity: "warning", check: "No evidence rung", item, detail: "Record the most direct rung of the evidence ladder this parameter stands on.", target });
    else {
      if (usedKinds.length > 0 && !usedKinds.includes(kind)) findings.push({ severity: "warning", check: "Rung not supported", item, detail: "No applicable source sits on the recorded rung.", target });
      if (kind !== "PLANT_RECORDS" && blankText(parameter.evidenceReason)) findings.push({ severity: "warning", check: "No rung reason", item, detail: "Say why more direct evidence is not available.", target });
    }
  }
  for (const elicitation of da.elicitations ?? []) {
    const target = { kind: "daElicitation" as const, id: elicitation.id };
    const item = elicitation.id;
    const evaluators = elicitation.experts.filter((expert) => expert.role === "EVALUATOR");
    if (blankText(elicitation.issue)) findings.push({ severity: "error", check: "No issue", item, detail: "State the technical issue the experts address (4.2.2).", target });
    if (blankText(elicitation.objective)) findings.push({ severity: "error", check: "No objective", item, detail: "State the objective and how the result will be used (4.2.1).", target });
    if (evaluators.length === 0) findings.push({ severity: "error", check: "No evaluator", item, detail: "Name at least one evaluator expert (4.2.5).", target });
    if (elicitation.structure === "PANEL" && evaluators.length < 2) findings.push({ severity: "warning", check: "Panel too small", item, detail: "A panel needs at least two evaluators (4.2.4).", target });
    for (const expert of evaluators) {
      const valid = expert.p05 !== undefined && expert.median !== undefined && expert.p95 !== undefined && judgmentComponent(expert.p05, expert.median, expert.p95, 1) !== undefined;
      if (!valid) findings.push({ severity: "error", check: "Judgment incomplete", item, detail: `${expert.name.trim().length > 0 ? expert.name : expert.id} needs a 5th, 50th and 95th percentile in rising order.`, target });
      if (!expert.acceptsResponsibility) findings.push({ severity: "warning", check: "Responsibility", item, detail: `${expert.name.trim().length > 0 ? expert.name : expert.id} has not accepted responsibility for the judgment (4.2.7).`, target });
    }
    if (elicitation.pooling === "LINEAR" && evaluators.some((expert) => expert.weight !== undefined) && evaluators.every((expert) => (expert.weight ?? 0) <= 0)) findings.push({ severity: "error", check: "Weights", item, detail: "At least one evaluator needs a positive weight.", target });
    if (blankText(elicitation.integrator)) findings.push({ severity: "error", check: "No owner", item, detail: "Name who owns the result (4.2.7).", target });
    const outside = elicitation.experts.some((expert) => expert.outside);
    if (outside && blankText(elicitation.outsideReason)) findings.push({ severity: "warning", check: "Outside experts", item, detail: "Say why experts outside the team were used (4.2.3).", target });
    if (!outside && elicitation.importance === "HIGH" && blankText(elicitation.outsideReason)) findings.push({ severity: "warning", check: "Outside experts", item, detail: "The issue is of high importance. Use outside experts or say why the team's own judgment is enough (4.2.3).", target });
    if (elicitationUsers(da, elicitation.id).length === 0) findings.push({ severity: "note", check: "Not used", item, detail: "No parameter uses this elicitation yet.", target });
  }
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => RANK[a.finding.severity] - RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
}

function sourcesComplete(da: DataAnalysis): boolean {
  if ((da.sources ?? []).length === 0) return false;
  if (da.parameters.some((parameter) => needsPrior(parameter) && priorUse(parameter) === undefined)) return false;
  return !sourceFindings(da).some((finding) => finding.severity === "error");
}

function evidenceRank(kind: DaEvidenceKind): number {
  return EVIDENCE_ORDER.indexOf(kind) + 1;
}

function parseDelimited(text: string): string[][] {
  const firstLine = text.split("\n")[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? "";
    if (quoted) {
      if (ch === "\"" && text[i + 1] === "\"") {
        cell += "\"";
        i += 1;
      } else if (ch === "\"") quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === "\"" && cell.length === 0) quoted = true;
    else if (ch === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

type DaImportField = "id" | "component" | "failureMode" | "quantity" | "distribution" | "alpha" | "beta" | "median" | "errorFactor" | "mean" | "p05" | "p95" | "failures" | "exposure" | "yearsFrom" | "yearsTo" | "method" | "boundaryNote";

const IMPORT_FIELDS: { field: DaImportField; label: string; guesses: string[] }[] = [
  { field: "id", label: "Code", guesses: ["code", "id", "identifier", "failuremode code", "componentfailuremode"] },
  { field: "component", label: "Component", guesses: ["component", "componenttype", "equipment", "type"] },
  { field: "failureMode", label: "Failure mode", guesses: ["failuremode", "description", "mode"] },
  { field: "quantity", label: "Unit", guesses: ["unit", "dorh", "units", "basis"] },
  { field: "distribution", label: "Distribution", guesses: ["distribution", "dist"] },
  { field: "alpha", label: "α or shape", guesses: ["alpha", "α", "shape", "a"] },
  { field: "beta", label: "β or rate", guesses: ["beta", "β", "rate", "b"] },
  { field: "median", label: "Median", guesses: ["median", "50th", "p50"] },
  { field: "errorFactor", label: "Error factor", guesses: ["errorfactor", "ef"] },
  { field: "mean", label: "Mean", guesses: ["mean", "average"] },
  { field: "p05", label: "5th", guesses: ["5th", "p05", "p5", "lower"] },
  { field: "p95", label: "95th", guesses: ["95th", "p95", "upper"] },
  { field: "failures", label: "Failures", guesses: ["failures", "events", "numberofevents", "count"] },
  { field: "exposure", label: "Demands or hours", guesses: ["demandsorhours", "exposure", "demands", "hours", "criticalyears", "time"] },
  { field: "yearsFrom", label: "Years from", guesses: ["yearsfrom", "from", "startyear"] },
  { field: "yearsTo", label: "Years to", guesses: ["yearsto", "to", "endyear"] },
  { field: "method", label: "Method", guesses: ["method", "analysistype", "analysis"] },
  { field: "boundaryNote", label: "Boundary notes", guesses: ["boundary", "boundarynotes", "notes"] },
];

function headerKey(text: string): string {
  let out = "";
  for (const ch of text.toLowerCase()) {
    if ((ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9") || ch === "α" || ch === "β") out += ch;
  }
  return out;
}

function guessMapping(headers: readonly string[]): Partial<Record<DaImportField, number>> {
  const keys = headers.map(headerKey);
  const mapping: Partial<Record<DaImportField, number>> = {};
  const taken = new Set<number>();
  for (const spec of IMPORT_FIELDS) {
    for (const guess of spec.guesses) {
      const index = keys.findIndex((key, i) => !taken.has(i) && key === headerKey(guess));
      if (index !== -1) {
        mapping[spec.field] = index;
        taken.add(index);
        break;
      }
    }
  }
  return mapping;
}

function numberCell(text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  let cleaned = "";
  for (const ch of text) if (ch !== "," && ch !== " ") cleaned += ch;
  if (cleaned.length === 0 || cleaned === "--" || cleaned === "-") return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

function quantityFromText(text: string | undefined): DaEstimateQuantity | undefined {
  const key = headerKey(text ?? "");
  if (key === "d" || key.startsWith("demand") || key === "perdemand") return "PER_DEMAND";
  if (key === "h" || key.startsWith("hour") || key === "perhour") return "PER_HOUR";
  if (key === "y" || key === "rcry" || key === "rsy" || key.startsWith("year") || key === "peryear") return "PER_YEAR";
  if (key.startsWith("fraction") || key.startsWith("unavail")) return "FRACTION";
  if (key.startsWith("prob")) return "PROBABILITY";
  return undefined;
}

function distributionFromCells(kind: string, alpha: number | undefined, beta: number | undefined, median: number | undefined, errorFactor: number | undefined, mean: number | undefined): ParameterDistribution | undefined {
  const key = headerKey(kind);
  if (key.startsWith("beta") && alpha !== undefined && beta !== undefined) return { type: DistributionType.BETA, alpha, betaParam: beta };
  if (key.startsWith("gamma") && alpha !== undefined && beta !== undefined) return { type: DistributionType.GAMMA, shape: alpha, rate: beta };
  if (key.startsWith("lognormal")) {
    if (median !== undefined && errorFactor !== undefined) return { type: DistributionType.LOGNORMAL, median, errorFactor };
    if (mean !== undefined && errorFactor !== undefined) return lognormalFromMean(mean, errorFactor);
  }
  if (key.startsWith("point") && mean !== undefined) return { type: DistributionType.POINT_ESTIMATE, value: mean };
  return undefined;
}

function entriesFromRows(rows: readonly string[][], mapping: Partial<Record<DaImportField, number>>, fixedQuantity: DaEstimateQuantity | undefined, taken: readonly string[]): { entries: DaSourceEntry[]; skipped: number } {
  const entries: DaSourceEntry[] = [];
  const ids = new Set(taken);
  let skipped = 0;
  const cell = (row: readonly string[], field: DaImportField): string | undefined => {
    const index = mapping[field];
    return index === undefined ? undefined : row[index];
  };
  for (const row of rows) {
    const component = cell(row, "component") ?? "";
    const failureMode = cell(row, "failureMode") ?? "";
    const quantity = fixedQuantity ?? quantityFromText(cell(row, "quantity")) ?? (headerKey(cell(row, "distribution") ?? "").startsWith("beta") ? "PER_DEMAND" : headerKey(cell(row, "distribution") ?? "").startsWith("gamma") ? "PER_HOUR" : undefined);
    const alpha = numberCell(cell(row, "alpha"));
    const beta = numberCell(cell(row, "beta"));
    const median = numberCell(cell(row, "median"));
    const errorFactor = numberCell(cell(row, "errorFactor"));
    const mean = numberCell(cell(row, "mean"));
    const distribution = distributionFromCells(cell(row, "distribution") ?? (errorFactor !== undefined ? "lognormal" : ""), alpha, beta, median, errorFactor, mean);
    const failures = numberCell(cell(row, "failures"));
    const exposure = numberCell(cell(row, "exposure"));
    if (quantity === undefined || (component.length === 0 && failureMode.length === 0) || (distribution === undefined && mean === undefined && (failures === undefined || exposure === undefined))) {
      skipped += 1;
      continue;
    }
    let id = cell(row, "id") ?? "";
    if (id.length === 0 || ids.has(id)) id = nextCode("E", [...ids], 3);
    ids.add(id);
    const entry: DaSourceEntry = { id, component, failureMode, quantity };
    if (distribution !== undefined) entry.distribution = distribution;
    if (mean !== undefined) entry.mean = mean;
    const p05 = numberCell(cell(row, "p05"));
    const p95 = numberCell(cell(row, "p95"));
    if (p05 !== undefined) entry.p05 = p05;
    if (median !== undefined) entry.median = median;
    if (p95 !== undefined) entry.p95 = p95;
    if (failures !== undefined) entry.failures = failures;
    if (exposure !== undefined) entry.exposure = exposure;
    const yearsFrom = cell(row, "yearsFrom");
    const yearsTo = cell(row, "yearsTo");
    if (yearsFrom !== undefined && yearsFrom.length > 0) entry.yearsFrom = yearsFrom;
    if (yearsTo !== undefined && yearsTo.length > 0) entry.yearsTo = yearsTo;
    const method = cell(row, "method");
    if (method !== undefined && method.length > 0) entry.method = method;
    const boundaryNote = cell(row, "boundaryNote");
    if (boundaryNote !== undefined && boundaryNote.length > 0) entry.boundaryNote = boundaryNote;
    entries.push(entry);
  }
  return { entries, skipped };
}

const DaSourceEntryListSchema = z.array(DaSourceEntrySchema);

const catalogLoads = new Map<string, Promise<DaSourceEntry[]>>();

function catalogDataset(catalogId: string | undefined): string | undefined {
  return catalogId === undefined ? undefined : DA_SOURCE_CATALOG.find((source) => source.id === catalogId)?.dataset;
}

async function fetchCatalogEntries(dataset: string): Promise<DaSourceEntry[]> {
  const { daCatalogUrls } = await import("./daCatalogAssets.mjs");
  const url = daCatalogUrls[dataset];
  if (url === undefined) return [];
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${dataset}`);
  return DaSourceEntryListSchema.parse(await response.json());
}

function catalogEntries(catalogId: string): Promise<DaSourceEntry[]> {
  const dataset = catalogDataset(catalogId);
  if (dataset === undefined) return Promise.resolve([]);
  const cached = catalogLoads.get(dataset);
  if (cached !== undefined) return cached;
  const load = fetchCatalogEntries(dataset);
  catalogLoads.set(dataset, load);
  load.catch(() => catalogLoads.delete(dataset));
  return load;
}

function libraryEntries(source: DaSource, builtIn: readonly DaSourceEntry[] | undefined): DaSourceEntry[] {
  if (builtIn === undefined || builtIn.length === 0) return source.entries;
  const stored = new Map(source.entries.map((entry) => [entry.id, entry]));
  const published = new Set(builtIn.map((entry) => entry.id));
  return [...builtIn.map((entry) => stored.get(entry.id) ?? entry), ...source.entries.filter((entry) => !published.has(entry.id))];
}

function libraryCount(source: DaSource): number {
  const estimates = DA_SOURCE_CATALOG.find((candidate) => candidate.id === source.catalogId)?.estimates;
  if (estimates === undefined) return source.entries.length;
  return estimates + source.entries.filter((entry) => entry.catalogCode === undefined).length;
}

function withStoredEntry(da: DataAnalysis, sourceId: string, entry: DaSourceEntry): DataAnalysis {
  return {
    ...da,
    sources: (da.sources ?? []).map((source) => (source.id !== sourceId || source.entries.some((stored) => stored.id === entry.id) ? source : { ...source, entries: [...source.entries, entry] })),
  };
}

function withoutSource(da: DataAnalysis, sourceId: string, entryId?: string): DataAnalysis {
  const matches = (use: DaSourceUse): boolean => use.sourceId === sourceId && (entryId === undefined || use.entryId === entryId);
  return {
    ...da,
    parameters: da.parameters.map((parameter) => {
      const uses = parameter.sourceUses ?? [];
      if (!uses.some(matches)) return parameter;
      const kept = uses.filter((use) => !matches(use));
      const next: DataAnalysisParameter = { ...parameter, sourceUses: kept };
      if (parameter.priorUseId !== undefined && !kept.some((use) => use.id === parameter.priorUseId)) next.priorUseId = undefined;
      return next;
    }),
    ccfParameterEstimations: da.ccfParameterEstimations?.map((estimate) => (templateUses(estimate, sourceId, entryId) ? { ...estimate, priorSourceId: undefined, priorTemplate: undefined } : estimate)),
  };
}

function withoutElicitation(da: DataAnalysis, elicitationId: string): DataAnalysis {
  return {
    ...da,
    elicitations: (da.elicitations ?? []).filter((candidate) => candidate.id !== elicitationId),
    parameters: da.parameters.map((parameter) => {
      const uses = parameter.sourceUses ?? [];
      if (!uses.some((use) => use.elicitationId === elicitationId)) return parameter;
      const kept = uses.filter((use) => use.elicitationId !== elicitationId);
      const next: DataAnalysisParameter = { ...parameter, sourceUses: kept };
      if (parameter.priorUseId !== undefined && !kept.some((use) => use.id === parameter.priorUseId)) next.priorUseId = undefined;
      return next;
    }),
  };
}

export {
  EVIDENCE_ORDER,
  IMPORT_FIELDS,
  QUANTITIES_FOR_MODEL,
  catalogDataset,
  catalogEntries,
  elicitationResult,
  elicitationUsers,
  entriesFromRows,
  entryDistribution,
  entryFit,
  entryUsers,
  evidenceRank,
  guessMapping,
  libraryCount,
  libraryEntries,
  needsHoursPerYear,
  needsPrior,
  needsSourcing,
  nextCode,
  parameterPrior,
  parseDelimited,
  priorUse,
  sourceFindings,
  sourceUsers,
  sourcesComplete,
  sourceUseBase,
  needsStandbyHours,
  sourceUseResult,
  withStoredEntry,
  withoutElicitation,
  withoutSource,
  type DaFactorPick,
  type DaFitBasis,
  type DaImportField,
  type DaUseBase,
  type DaUseResult,
};
