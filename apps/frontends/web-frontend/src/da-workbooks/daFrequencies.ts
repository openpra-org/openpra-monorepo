import type {
  DataAnalysis,
  DataAnalysisParameter,
  DaEvidence,
  DaFrequencyComparison,
  DaFrequencyMethod,
  DaFrequencyPart,
  DaFrequencyPer,
  DaInitiatorNeed,
  DaPriorForm,
  DaSourceUse,
  DaStateNeed,
} from "interfaces-mef-types/da/data-analysis";
import { canonicalJson, expressionReferences, type DiscreteOutcome, type EvidenceTerm, type Law, type UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { uncertaintyVersion, type UncertaintyState } from "../newly-developed-methods/shared/useUncertainty";
import { constrainedLaw, lawSummary, operationLaw, pointState, sourceUseLaw, weightedUseLaw } from "./daLaws";
import { hasSpread, pooledLaw, posteriorOf } from "./daFailures";
import { weightedUses } from "./daSourcing";
import { conflictCheck, countTerm, countedRecords, homogeneityCheck, recordCount, recordTrendCheck, typedCount, type DaCounted } from "./daEvidenceChecks";
import type { DaFindingSeverity, DaNeedFinding } from "./daSelectors";

const RANK: Record<DaFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const CRITICAL_MODES: ReadonlySet<string> = new Set(["POWER", "STARTUP"]);

const SHUTDOWN_MODES: ReadonlySet<string> = new Set(["SHUTDOWN", "REFUELING", "MAINTENANCE"]);

const GAP = 5;

type DaFrequencyComputation = "PRIOR" | "POSTERIOR" | "POPULATION" | "EMPIRICAL_BAYES";

interface DaFrequencyEvidence {
  evidence: DaEvidence;
  label: string;
  failures?: number;
  outcomes?: DiscreteOutcome[];
  exposure?: number;
  term?: EvidenceTerm;
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
  uses: DaSourceUse[];
  published?: Law;
  form: DaPriorForm;
  prior?: Law;
  evidence: DaFrequencyEvidence[];
  terms: EvidenceTerm[];
  method?: DaFrequencyMethod;
  computation?: DaFrequencyComputation;
  posterior?: Law;
  share: DaPartShare;
  factor?: number;
  law?: Law;
  pending: boolean;
  problem?: string;
}

interface DaFrequencyComparisonResult {
  comparison: DaFrequencyComparison;
  label: string;
  value?: number;
  ratio?: number;
  pending: boolean;
  problem?: string;
}

interface DaFrequencyEstimate {
  modules: number;
  siteWide: boolean;
  parts: DaFrequencyPartEstimate[];
  estimate?: UncertainExpression;
  comparisons: DaFrequencyComparisonResult[];
  pending: boolean;
  problem?: string;
}

interface DaFrequencyCheck {
  findings: DaNeedFinding[];
  pending: boolean;
}

const estimateCache = new WeakMap<DataAnalysis, { version: number; values: Map<string, DaFrequencyEstimate> }>();

const checkCache = new WeakMap<DataAnalysis, { version: number; check: DaFrequencyCheck }>();

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function isFrequencyParameter(parameter: DataAnalysisParameter): boolean {
  return parameter.quantificationModel === "FREQUENCY";
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

function entryOf(da: DataAnalysis, sourceId: string | undefined, entryId: string | undefined): { failures?: number; exposure?: number; quantity: string } | undefined {
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
    let counted: DaCounted | undefined;
    if (evidence.failuresFrom === "TYPED") counted = evidence.failures === undefined ? undefined : { failures: evidence.failures };
    else if (evidence.failuresFrom === "UNCERTAIN") {
      counted = typedCount(evidence.failureOutcomes);
      if (counted === undefined) return { ...resolved, problem: "Give each possible count with a weight above zero." };
    } else if (evidence.failuresFrom === "ENTRY") {
      if (entry === undefined) return { ...resolved, problem: "Pick the library estimate the event count comes from." };
      counted = entry.failures === undefined ? undefined : { failures: entry.failures };
    } else {
      const set = (da.recordSets ?? []).find((candidate) => candidate.id === evidence.recordSetId);
      if (set === undefined) return { ...resolved, problem: "Pick the record set the events are counted from." };
      counted = recordCount(countedRecords(set, parameter.uuid));
    }
    if (counted !== undefined) {
      resolved.failures = counted.failures;
      resolved.outcomes = counted.outcomes;
    }
    if (evidence.exposureFrom === "ENTRY") {
      if (entry === undefined) return { ...resolved, problem: "Pick the library estimate the exposure comes from." };
      if (entry.quantity !== "PER_YEAR") return { ...resolved, problem: "This estimate does not count events in years." };
      resolved.exposure = entry.exposure;
    } else if (evidence.exposureFrom === "TYPED") {
      if (evidence.unit !== undefined && evidence.unit !== "YEARS") return { ...resolved, problem: "Initiating events are counted over years." };
      resolved.exposure = evidence.exposure;
    } else return { ...resolved, problem: "Count the exposure in years, typed or from a library estimate." };
    if (counted === undefined) return { ...resolved, problem: "Enter the number of events." };
    if (resolved.exposure === undefined) return { ...resolved, problem: "Enter the years the events happened in." };
    if (!(resolved.exposure > 0)) return { ...resolved, problem: "The exposure must be more than zero." };
    if (counted.failures < 0) return { ...resolved, problem: "The event count cannot be negative." };
    return { ...resolved, term: countTerm("POISSON", counted, resolved.exposure) };
  });
}

function frequencyValue(law: Law): UncertainExpression {
  return { node: "VALUE", value: { unit: "PER_YEAR", law } };
}

function priorOf(form: DaPriorForm, published: Law | undefined): { prior?: Law | null; pending: boolean; problem?: string } {
  if (form === "JEFFREYS") return { prior: null, pending: false };
  if (published === undefined) return { pending: false, problem: "Choose the source this part starts from." };
  if (form === "AS_PUBLISHED") return { prior: published, pending: false };
  const widened = constrainedLaw(published, "POISSON");
  if (widened.status === "pending") return { pending: true };
  if (widened.status === "failed") return { pending: false, problem: `PRAXIS could not form the constrained noninformative prior: ${widened.error}` };
  if (widened.status === "missing") return { pending: false, problem: widened.problem };
  return { prior: widened.law, pending: false };
}

function estimatePart(da: DataAnalysis, parameter: DataAnalysisParameter, part: DaFrequencyPart, modules: number, siteWide: boolean): DaFrequencyPartEstimate {
  const use = part.useId === undefined ? undefined : (parameter.sourceUses ?? []).find((candidate) => candidate.id === part.useId);
  const weighted = weightedUses(parameter.sourceUses ?? [], part.useId, part.priorParts);
  const form = part.priorForm ?? "AS_PUBLISHED";
  const evidence = resolveEvidence(da, parameter, part);
  const terms = evidence.flatMap((item) => (item.evidence.included && item.term !== undefined ? [item.term] : []));
  const share = shareOf(da, part.per, part.stateIds ?? []);
  const base: DaFrequencyPartEstimate = { part, use, uses: weighted.map((item) => item.use), form, evidence, terms, method: part.method, share, pending: false };
  if (part.useId !== undefined && use === undefined) return { ...base, problem: "The chosen source is no longer considered. Check it in Step 04 Applicability." };
  let published: Law | undefined;
  if (use !== undefined) {
    const state = weightedUseLaw(da, weighted);
    if (state.status === "pending") return { ...base, pending: true };
    if (state.status === "failed") return { ...base, problem: `PRAXIS could not read the source: ${state.error}` };
    if (state.status === "missing") return { ...base, problem: `${state.problem} Check it in Step 04 Applicability.` };
    if (state.value.quantity !== "PER_YEAR") return { ...base, problem: "The source is not a frequency per year." };
    published = state.value.law;
  }
  const withPublished: DaFrequencyPartEstimate = { ...base, published };
  if (part.method === undefined) return { ...withPublished, problem: "Choose how this part is estimated." };
  if (part.method === "POPULATION" || part.method === "EMPIRICAL_BAYES") {
    const pooled = pooledLaw(part.method, part, evidence, terms, false);
    if ("problem" in pooled) return { ...withPublished, problem: pooled.problem };
    return toPlant({ ...withPublished, posterior: pooled.law, computation: part.method }, pooled.law, share, modules, siteWide);
  }
  const chosen = priorOf(form, published);
  const withPrior: DaFrequencyPartEstimate = { ...withPublished, prior: chosen.prior ?? undefined };
  if (chosen.pending) return { ...withPrior, pending: true };
  if (chosen.prior === undefined) return { ...withPrior, problem: chosen.problem ?? "No prior." };
  const prior = chosen.prior;
  let posterior: Law;
  let computation: DaFrequencyComputation;
  if (part.method === "PRIOR" || terms.length === 0) {
    if (prior === null) return { ...withPrior, problem: "A Jeffreys prior needs events to update." };
    posterior = prior;
    computation = "PRIOR";
  } else {
    if (prior !== null && prior.family === "POINT") return { ...withPrior, problem: "A point value cannot be updated. Use the constrained noninformative form." };
    const updated = posteriorOf(prior, terms);
    if (typeof updated === "string") return { ...withPrior, problem: updated };
    posterior = updated;
    computation = "POSTERIOR";
  }
  return toPlant({ ...withPrior, posterior, computation }, posterior, share, modules, siteWide);
}

function toPlant(withPosterior: DaFrequencyPartEstimate, posterior: Law, share: DaPartShare, modules: number, siteWide: boolean): DaFrequencyPartEstimate {
  const part = withPosterior.part;
  if (share.share === undefined) return { ...withPosterior, problem: part.per === "CALENDAR_YEAR" ? "No share of the year." : `No ${part.per === "CRITICAL_YEAR" ? "power" : "shutdown"} state with a duration covers this part. Check its states and the POS import in Step 02.` };
  const factor = share.share * (siteWide ? 1 : modules);
  let law = posterior;
  if (factor !== 1) {
    const scaled = operationLaw({ kind: "SCALE", law: posterior, factor });
    if (scaled.status === "pending") return { ...withPosterior, factor, pending: true };
    if (scaled.status === "failed") return { ...withPosterior, factor, problem: `PRAXIS could not scale the part to the plant: ${scaled.error}` };
    if (scaled.status === "missing") return { ...withPosterior, factor, problem: scaled.problem };
    law = scaled.law;
  }
  const summary = lawSummary("PER_YEAR", law, true);
  if (summary.status === "pending") return { ...withPosterior, factor, law, pending: true };
  if (summary.status === "failed") return { ...withPosterior, factor, problem: `PRAXIS could not compute the part: ${summary.error}` };
  return { ...withPosterior, factor, law };
}

function useLabel(use: DaSourceUse): string {
  return use.elicitationId ?? `${use.sourceId ?? "?"} · ${use.entryId ?? "?"}`;
}

function comparisonResult(da: DataAnalysis, parameter: DataAnalysisParameter, comparison: DaFrequencyComparison, mean: UncertaintyState<number> | undefined, modules: number, siteWide: boolean): DaFrequencyComparisonResult {
  const use = (parameter.sourceUses ?? []).find((candidate) => candidate.id === comparison.useId);
  const label = use === undefined ? comparison.useId : useLabel(use);
  const base: DaFrequencyComparisonResult = { comparison, label, pending: false };
  if (use === undefined) return { ...base, problem: "The comparison source cannot be read." };
  const state = sourceUseLaw(da, use);
  if (state.status === "pending") return { ...base, pending: true };
  if (state.status !== "ready") return { ...base, problem: "The comparison source cannot be read." };
  if (state.value.quantity !== "PER_YEAR") return { ...base, problem: "The comparison is not a frequency per year." };
  const share = shareOf(da, comparison.per, parameter.stateIds ?? []);
  if (share.share === undefined) return { ...base, problem: "None of the group's states fits this comparison's basis." };
  const summary = lawSummary("PER_YEAR", state.value.law);
  if (summary.status === "pending") return { ...base, pending: true };
  if (summary.status === "failed") return { ...base, problem: `PRAXIS could not read the comparison: ${summary.error}` };
  const value = summary.value.mean * share.share * (siteWide ? 1 : modules);
  if (mean?.status === "pending") return { ...base, value, pending: true };
  return { ...base, value, ratio: mean?.status === "ready" && value > 0 ? mean.value / value : undefined };
}

function computeEstimate(da: DataAnalysis, parameter: DataAnalysisParameter): DaFrequencyEstimate {
  const basis = parameter.frequency;
  const modules = modulesOf(da);
  const siteWide = basis?.siteWide === true;
  const parts = (basis?.parts ?? []).map((part) => estimatePart(da, parameter, part, modules, siteWide));
  const base: DaFrequencyEstimate = { modules, siteWide, parts, comparisons: [], pending: false };
  const withComparisons = (mean: UncertaintyState<number> | undefined): DaFrequencyComparisonResult[] => (basis?.comparisons ?? []).map((comparison) => comparisonResult(da, parameter, comparison, mean, modules, siteWide));
  if (basis === undefined || parts.length === 0) return { ...base, comparisons: withComparisons(undefined), problem: "Add the part or parts the frequency is built from." };
  const broken = parts.find((part) => part.problem !== undefined);
  if (broken !== undefined) return { ...base, comparisons: withComparisons(undefined), problem: `${broken.part.label}: ${broken.problem ?? "cannot be estimated."}` };
  const laws = parts.flatMap((part) => (part.pending || part.law === undefined ? [] : [part.law]));
  if (laws.length < parts.length) return { ...base, comparisons: withComparisons(undefined), pending: true };
  const values = laws.map(frequencyValue);
  const first = values[0];
  const estimate: UncertainExpression | undefined = values.length === 1 ? first : { node: "OPERATION", operation: "ADD", operands: values };
  if (estimate === undefined) return { ...base, comparisons: withComparisons(undefined), problem: "Add the part or parts the frequency is built from." };
  return { ...base, estimate, comparisons: withComparisons(pointState(estimate, "PER_YEAR")) };
}

function frequencyEstimate(da: DataAnalysis, parameter: DataAnalysisParameter): DaFrequencyEstimate {
  const version = uncertaintyVersion();
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

function sameExpression(left: UncertainExpression | undefined, right: UncertainExpression | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return canonicalJson(left) === canonicalJson(right);
}

function withFrequencies(da: DataAnalysis): DataAnalysis {
  let changed = false;
  const parameters = da.parameters.map((parameter) => {
    if (!isFrequencyParameter(parameter) || parameter.valueMode !== "CALCULATED") return parameter;
    const estimate = frequencyEstimate(da, parameter);
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

function sci(value: number): string {
  return Number(value.toPrecision(3)).toExponential().replace("e+", "E").replace("e", "E");
}

function initiatorFor(da: DataAnalysis, parameter: DataAnalysisParameter): DaInitiatorNeed | undefined {
  const needs = da.dataNeeds?.initiators ?? [];
  if (parameter.valueLink?.element === "IE") return needs.find((need) => need.id === parameter.valueLink?.needId);
  return needs.find((need) => need.parameterId === parameter.uuid);
}

function needPoint(need: DaInitiatorNeed): UncertaintyState<number> | undefined {
  const expression = need.frequency?.expression;
  if (expression === undefined || expressionReferences(expression).length > 0) return undefined;
  return pointState(expression, "PER_YEAR");
}

function parameterFindings(da: DataAnalysis, parameter: DataAnalysisParameter, check: DaFrequencyCheck): void {
  const findings = check.findings;
  const item = parameter.uuid;
  const target = { kind: "daFrequency" as const, id: parameter.uuid };
  const ccTwo = da.capabilityCategory !== "CC-I";
  const operating = da.plantStage === "OPERATIONAL";
  const modules = modulesOf(da);
  if (parameter.valueMode === "LINKED") {
    const need = initiatorFor(da, parameter);
    if (parameter.valueLink?.element !== "IE" || need === undefined) findings.push({ severity: "error", check: "Link missing", item, detail: "The parameter imports its value from an IE group that is not among the imported groups.", target });
    else if (need.valueHeldBy === "DA") findings.push({ severity: "error", check: "Circular link", item, detail: `IE imports ${need.id} from DA, and this parameter imports it back from IE. One side has to own the value.`, target });
    return;
  }
  if (parameter.valueMode !== "CALCULATED") {
    if (parameter.estimate === undefined) findings.push({ severity: "error", check: "No value", item, detail: "Type the frequency, estimate it here, or import IE's value.", target });
    else if (ccTwo && parameter.isRiskSignificant === true && !hasSpread(parameter.estimate)) findings.push({ severity: "error", check: "No distribution", item, detail: "A risk-significant initiator needs a mean and an uncertainty distribution at CC-II (IE-C19).", target });
    return;
  }
  const basis = parameter.frequency;
  if (basis?.category === undefined) findings.push({ severity: "warning", check: "No category", item, detail: "Sort the group into category I to IV by how much existing experience applies.", target });
  else if (blank(basis.categoryReason)) findings.push({ severity: "warning", check: "No category reason", item, detail: "Say why the group sits in this category.", target });
  if (modules > 1 && basis?.siteWide === undefined) findings.push({ severity: "warning", check: "Site-wide not stated", item, detail: `The plant has ${modules} modules. Say whether one event strikes them all, so it is not multiplied by the module count (IE-C8).`, target });
  if (basis?.siteWide === true && blank(basis.siteWideReason)) findings.push({ severity: "warning", check: "No site-wide reason", item, detail: "Say why one event strikes every module.", target });
  const estimate = frequencyEstimate(da, parameter);
  if (estimate.pending) check.pending = true;
  if (estimate.problem !== undefined) findings.push({ severity: "error", check: "Cannot estimate", item, detail: estimate.problem, target });
  for (const part of estimate.parts) {
    const what = part.part.label;
    if (part.share.missing.length > 0) findings.push({ severity: "warning", check: "State missing", item, detail: `${what}: ${part.share.missing.join(", ")} has no imported POS duration, so it adds nothing to the share.`, target });
    if (part.share.ignored.length > 0) findings.push({ severity: "note", check: "States left out", item, detail: `${what}: ${part.share.ignored.join(", ")} ${part.share.ignored.length === 1 ? "is" : "are"} not ${part.part.per === "CRITICAL_YEAR" ? "a power state" : "a shutdown state"}, so ${part.share.ignored.length === 1 ? "it does" : "they do"} not count toward the ${perLabel(part.part.per)} share.`, target });
    const widened = part.form === "CONSTRAINED_NONINFORMATIVE";
    if ((basis?.category === "II" || basis?.category === "III") && !widened && part.form !== "JEFFREYS" && blank(part.part.reason)) findings.push({ severity: "warning", check: "Uncertainty not widened", item, detail: `${what}: category ${basis.category} keeps the industry mean but widens it with a constrained noninformative prior, since the design differs from the plants behind the data.`, target });
    const used = part.evidence.filter((evidence) => evidence.evidence.included && evidence.term !== undefined);
    if (part.part.method === "PRIOR" && used.length > 0) findings.push({ severity: ccTwo ? "error" : "warning", check: "Events not used", item, detail: `${what}: events are listed but the source is used as it is. Update it, even with zero events (DA-D1).`, target });
    if (part.part.method === "BAYES" && part.prior !== undefined && part.form !== "JEFFREYS" && part.terms.length > 0) conflictCheck(check, part.prior, part.terms, item, target, !blank(part.part.reason), operating);
    if (part.part.method === "BAYES") homogeneityCheck(check, part.terms, item, target);
    for (const evidence of part.evidence) {
      if (evidence.evidence.included && evidence.evidence.failuresFrom === "RECORDS") {
        const set = (da.recordSets ?? []).find((candidate) => candidate.id === evidence.evidence.recordSetId);
        recordTrendCheck(check, set, parameter.uuid, `${what} · ${evidence.label}`, evidence.evidence.yearsFrom ?? set?.yearsFrom, evidence.evidence.yearsTo ?? set?.yearsTo, item, target);
      }
      if (evidence.problem !== undefined) findings.push({ severity: "error", check: "Evidence problem", item, detail: `${what} · ${evidence.label}: ${evidence.problem}`, target });
      if (!evidence.evidence.included && blank(evidence.evidence.exclusionReason)) findings.push({ severity: "error", check: "No exclusion reason", item, detail: `${what} · ${evidence.label}: say why it is left out.`, target });
      if (blank(evidence.evidence.reason)) findings.push({ severity: "warning", check: "No evidence reason", item, detail: `${what} · ${evidence.label}: say why these counts apply.`, target });
    }
  }
  if (ccTwo && parameter.isRiskSignificant === true && estimate.estimate !== undefined && !hasSpread(estimate.estimate)) findings.push({ severity: "error", check: "No distribution", item, detail: "A risk-significant initiator needs an uncertainty distribution at CC-II (IE-C19).", target });
  for (const comparison of estimate.comparisons) {
    if (comparison.pending) check.pending = true;
    if (comparison.problem !== undefined) {
      findings.push({ severity: "warning", check: "Comparison problem", item, detail: `${comparison.label}: ${comparison.problem}`, target });
      continue;
    }
    const ratio = comparison.ratio;
    if (ratio !== undefined && (ratio >= GAP || ratio <= 1 / GAP) && blank(comparison.comparison.reason)) findings.push({ severity: "warning", check: "Comparison gap", item, detail: `The estimate is ${ratio >= 1 ? `${Number(ratio.toPrecision(2))} times` : `1/${Number((1 / ratio).toPrecision(2))} of`} ${comparison.label} (${sci(comparison.value ?? 0)}). Explain a gap of a factor of ${GAP} or more (IE-C16).`, target });
  }
  const need = initiatorFor(da, parameter);
  if (need?.valueHeldBy !== "TYPED" || estimate.estimate === undefined) return;
  const theirs = needPoint(need);
  const ours = pointState(estimate.estimate, "PER_YEAR");
  if (theirs?.status === "pending" || ours.status === "pending") {
    check.pending = true;
    return;
  }
  if (theirs?.status !== "ready" || ours.status !== "ready" || !(theirs.value > 0)) return;
  const ratio = ours.value / theirs.value;
  if (ratio >= GAP || ratio <= 1 / GAP) findings.push({ severity: "note", check: "IE value differs", item, detail: `IE types ${sci(theirs.value)} for ${need.id}, a factor of ${Number(Math.max(ratio, 1 / ratio).toPrecision(2))} from this estimate. IE can import the estimate in its frequency step.`, target });
}

function frequencyCheck(da: DataAnalysis): DaFrequencyCheck {
  const version = uncertaintyVersion();
  const cached = checkCache.get(da);
  if (cached !== undefined && cached.version === version) return cached.check;
  const check: DaFrequencyCheck = { findings: [], pending: false };
  const parameters = frequencyParameters(da);
  for (const parameter of parameters) parameterFindings(da, parameter, check);
  const needs = da.dataNeeds?.initiators ?? [];
  const ids = new Set(parameters.map((parameter) => parameter.uuid));
  for (const need of needs) {
    if (!need.included) continue;
    if (need.parameterId === undefined || !ids.has(need.parameterId)) check.findings.push({ severity: "error", check: "No parameter", item: need.id, detail: "This IE group has no frequency parameter. Add one, then estimate it, type it or import IE's value.", target: { kind: "needInitiator", id: need.id } });
  }
  const mapped = needs.filter((need) => need.included && need.parameterId !== undefined);
  for (const need of mapped) {
    const shared = mapped.filter((other) => other.parameterId === need.parameterId);
    if (shared.length > 1 && shared[0] === need) check.findings.push({ severity: "warning", check: "Parameter shared", item: need.parameterId ?? need.id, detail: `${shared.map((other) => other.id).join(", ")} use one frequency parameter. Each group needs its own.`, target: { kind: "needInitiator", id: need.id } });
  }
  const sorted = check.findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => RANK[a.finding.severity] - RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
  const result = { findings: sorted, pending: check.pending };
  checkCache.set(da, { version, check: result });
  return result;
}

function frequencyFindings(da: DataAnalysis): DaNeedFinding[] {
  return frequencyCheck(da).findings;
}

function frequenciesComplete(da: DataAnalysis): boolean {
  const decision = (da.scopeDecisions ?? []).find((candidate) => candidate.kind === "INITIATING_EVENT");
  if (decision !== undefined && !decision.included) return true;
  const parameters = frequencyParameters(da);
  if (parameters.length === 0) return false;
  if (parameters.some((parameter) => parameter.valueMode !== "LINKED" && parameter.estimate === undefined)) return false;
  const check = frequencyCheck(da);
  return !check.pending && !check.findings.some((finding) => finding.severity === "error");
}

export {
  frequenciesComplete,
  frequencyEstimate,
  frequencyFindings,
  frequencyParameters,
  frequencyValue,
  isFrequencyParameter,
  modulesOf,
  perLabel,
  shareOf,
  stateShares,
  withFrequencies,
  type DaFrequencyComparisonResult,
  type DaFrequencyComputation,
  type DaFrequencyEstimate,
  type DaFrequencyEvidence,
  type DaFrequencyPartEstimate,
};
