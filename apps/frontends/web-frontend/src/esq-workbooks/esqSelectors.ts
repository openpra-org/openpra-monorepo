import {
  ESQ_PLAN_DEFAULTS,
  type EsqFrequencyBasis,
  type EsqModuleCounting,
  type EsqQuantificationPlan,
  type EsqScopeAspect,
  type EsqScopeExclusion,
  type EsqStateWeighting,
  type EventSequenceQuantification,
  type ModelIntegration,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { EMPTY_UPSTREAM, type EsqUpstream } from "./esqLinks";
import { modelComplete, sameItem, transferEntryInitiators } from "./esqModel";
import { logicComplete } from "./esqLogic";
import { barriersComplete } from "./esqBarriers";
import { solveComplete } from "./esqSolve";
import { postComplete } from "./esqPost";
import { resultsComplete } from "./esqResults";
import { uncertaintyComplete } from "./esqUncertainty";
import { sensitivityComplete } from "./esqSensitivity";
import { handoffComplete } from "./esqHandoff";
import {
  CONFORMANCE_ITEMS,
  ESQ_EXTERNAL_HAZARD_GROUPS,
  ESQ_HAZARD_GROUPS,
  ESQ_PLAN_LABELS,
  ESQ_SCOPE_ASPECTS,
  ESQ_STEPS,
  ESQ_PERSONA_STEPS,
  type ConformanceItem,
  type EsqPersona,
  type EsqPlanKey,
  type EsqStep,
  type Stage,
} from "./esqViewData";

interface CommentView {
  id: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorTitle?: string;
  when: string;
  createdAt: string;
  associatedSr?: string;
  section: string;
  targetLabel: string;
  text: string;
  severity: "MAJOR" | "MINOR" | "OBSERVATION";
  resolved: boolean;
  resolution?: string;
}

interface CcScore {
  applicable: number;
  met: number;
  warn: number;
  blocked: number;
  na: number;
  ready: number;
  total: number;
  percent: number;
}

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

function initialsOf(name: string): string {
  const cleaned = name.startsWith("Dr. ") ? name.slice(4) : name;
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeFrom(iso: string, now: Date): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < MS_PER_HOUR) {
    const m = Math.max(1, Math.round(diff / (1000 * 60)));
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diff < MS_PER_DAY) {
    const h = Math.round(diff / MS_PER_HOUR);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (diff < MS_PER_DAY * 2) return "yesterday";
  const d = Math.round(diff / MS_PER_DAY);
  return `${d} days ago`;
}

type EsqScopeState = "included" | "excluded" | "unset";

interface EsqScopeRow {
  key: string;
  label: string;
  detail?: string;
  inEs?: boolean;
  byHand: boolean;
  state: EsqScopeState;
  reason: string;
}

interface ScopeCandidate {
  key: string;
  label: string;
}

type ScopeCoverage = ModelIntegration["scopeCoverage"];

function rowMatches(row: ScopeCandidate, item: string): boolean {
  return sameItem(row.key, item) || sameItem(row.label, item);
}

function includedList(esq: EventSequenceQuantification, aspect: EsqScopeAspect): string[] {
  const coverage = esq.modelIntegration.scopeCoverage;
  if (aspect === "HAZARD_GROUP") return coverage.hazardGroups;
  if (aspect === "OPERATING_STATE") return coverage.plantOperatingStates;
  if (aspect === "SOURCE") return coverage.radionuclideSources;
  return coverage.initiatingEventGroups;
}

function withIncludedList(coverage: ScopeCoverage, aspect: EsqScopeAspect, list: string[]): ScopeCoverage {
  if (aspect === "HAZARD_GROUP") return { ...coverage, hazardGroups: list };
  if (aspect === "OPERATING_STATE") return { ...coverage, plantOperatingStates: list };
  if (aspect === "SOURCE") return { ...coverage, radionuclideSources: list };
  return { ...coverage, initiatingEventGroups: list };
}

function uniqueIds(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (id.trim().length > 0 && !out.some((seen) => sameItem(seen, id))) out.push(id);
  }
  return out;
}

function esInitiatorIds(es: EventSequenceAnalysis): string[] {
  const entries = transferEntryInitiators(es);
  return uniqueIds([
    ...es.scopeDefinition.initiatingEventIds,
    ...(es.eventTrees ?? []).map((tree) => tree.initiatingEventId),
    ...es.eventSequences.map((sequence) => sequence.initiatingEventId),
  ]).filter((id) => !entries.some((entry) => sameItem(entry, id)));
}

function esStateIds(es: EventSequenceAnalysis): string[] {
  return uniqueIds([
    ...es.scopeDefinition.plantOperatingStateIds,
    ...(es.eventTrees ?? []).flatMap((tree) => (tree.plantOperatingStateId === undefined ? [] : [tree.plantOperatingStateId])),
    ...es.eventSequences.map((sequence) => sequence.plantOperatingStateId),
  ]);
}

function scopeCandidates(upstream: EsqUpstream, aspect: EsqScopeAspect): ScopeCandidate[] {
  const out: ScopeCandidate[] = [];
  function add(key: string, label: string): void {
    if (key.trim().length === 0) return;
    if (out.some((candidate) => rowMatches(candidate, key) || rowMatches(candidate, label))) return;
    out.push({ key, label });
  }
  if (aspect === "HAZARD_GROUP") {
    for (const group of ESQ_HAZARD_GROUPS) add(group, group);
    for (const review of upstream.pos?.hazardGroupReviews ?? []) add(review.hazardGroup, review.hazardGroup);
  }
  if (aspect === "OPERATING_STATE") {
    for (const state of upstream.pos?.plantOperatingStates ?? []) add(state.uuid, state.name);
    if (upstream.es !== undefined) for (const id of esStateIds(upstream.es)) add(id, id);
  }
  if (aspect === "SOURCE") {
    if (upstream.pos !== undefined) {
      for (const state of upstream.pos.plantOperatingStates) {
        for (const source of state.radioactiveMaterialSources) add(source.name, source.name);
      }
    } else if (upstream.es !== undefined) {
      for (const source of upstream.es.scopeDefinition.radioactiveMaterialSources) add(source, source);
    }
  }
  if (aspect === "INITIATOR_GROUP") {
    for (const group of upstream.ie?.initiatingEventGroups ?? []) add(group.uuid, group.name);
    if (upstream.es !== undefined) for (const id of esInitiatorIds(upstream.es)) add(id, id);
  }
  return out;
}

function inEsFor(upstream: EsqUpstream, aspect: EsqScopeAspect, row: ScopeCandidate): boolean | undefined {
  const es = upstream.es;
  if (es === undefined) return undefined;
  if (aspect === "INITIATOR_GROUP") return esInitiatorIds(es).some((id) => rowMatches(row, id));
  if (aspect === "OPERATING_STATE") return esStateIds(es).some((id) => rowMatches(row, id));
  return undefined;
}

function scopeExclusionsOf(esq: EventSequenceQuantification): EsqScopeExclusion[] {
  return esq.modelIntegration.scopeExclusions ?? [];
}

function scopeRowsView(esq: EventSequenceQuantification, upstream: EsqUpstream, aspect: EsqScopeAspect): EsqScopeRow[] {
  const included = includedList(esq, aspect);
  const exclusions = scopeExclusionsOf(esq).filter((exclusion) => exclusion.aspect === aspect);
  const candidates = scopeCandidates(upstream, aspect);
  const extras: ScopeCandidate[] = [];
  for (const item of [...included, ...exclusions.map((exclusion) => exclusion.item)]) {
    if (candidates.some((candidate) => rowMatches(candidate, item)) || extras.some((candidate) => rowMatches(candidate, item))) continue;
    extras.push({ key: item, label: item });
  }
  const rows = [
    ...candidates.map((candidate) => ({ candidate, byHand: false })),
    ...extras.map((candidate) => ({ candidate, byHand: true })),
  ];
  return rows.map(({ candidate, byHand }) => {
    const exclusion = exclusions.find((entry) => rowMatches(candidate, entry.item));
    const state: EsqScopeState = included.some((item) => rowMatches(candidate, item))
      ? "included"
      : exclusion !== undefined ? "excluded" : "unset";
    return {
      key: candidate.key,
      label: candidate.label,
      detail: sameItem(candidate.key, candidate.label) ? undefined : candidate.key,
      inEs: inEsFor(upstream, aspect, candidate),
      byHand,
      state,
      reason: exclusion?.reason ?? "",
    };
  });
}

function withScope(esq: EventSequenceQuantification, aspect: EsqScopeAspect, included: string[], exclusions: EsqScopeExclusion[]): EventSequenceQuantification {
  return {
    ...esq,
    modelIntegration: {
      ...esq.modelIntegration,
      scopeCoverage: withIncludedList(esq.modelIntegration.scopeCoverage, aspect, included),
      scopeExclusions: exclusions,
    },
  };
}

function withScopeState(esq: EventSequenceQuantification, aspect: EsqScopeAspect, row: ScopeCandidate, next: EsqScopeState): EventSequenceQuantification {
  const candidate: ScopeCandidate = { key: row.key, label: row.label };
  const all = scopeExclusionsOf(esq);
  const previous = all.find((exclusion) => exclusion.aspect === aspect && rowMatches(candidate, exclusion.item));
  const included = includedList(esq, aspect).filter((item) => !rowMatches(candidate, item));
  const exclusions = all.filter((exclusion) => exclusion.aspect !== aspect || !rowMatches(candidate, exclusion.item));
  if (next === "included") included.push(row.key);
  if (next === "excluded") exclusions.push({ aspect, item: row.key, reason: previous?.reason ?? "" });
  return withScope(esq, aspect, included, exclusions);
}

function withScopeReason(esq: EventSequenceQuantification, aspect: EsqScopeAspect, row: ScopeCandidate, reason: string): EventSequenceQuantification {
  const candidate: ScopeCandidate = { key: row.key, label: row.label };
  const exclusions = scopeExclusionsOf(esq).map((exclusion) => (
    exclusion.aspect === aspect && rowMatches(candidate, exclusion.item) ? { ...exclusion, reason } : exclusion
  ));
  return { ...esq, modelIntegration: { ...esq.modelIntegration, scopeExclusions: exclusions } };
}

function withScopeItemAdded(esq: EventSequenceQuantification, aspect: EsqScopeAspect, label: string): EventSequenceQuantification {
  const name = label.trim();
  if (name.length === 0) return esq;
  const included = includedList(esq, aspect);
  const recorded = included.some((item) => sameItem(item, name))
    || scopeExclusionsOf(esq).some((exclusion) => exclusion.aspect === aspect && sameItem(exclusion.item, name));
  if (recorded) return esq;
  return withScope(esq, aspect, [...included, name], scopeExclusionsOf(esq));
}

function withRestIncluded(esq: EventSequenceQuantification, aspect: EsqScopeAspect, rows: EsqScopeRow[]): EventSequenceQuantification {
  const unset = rows.filter((row) => row.state === "unset").map((row) => row.key);
  if (unset.length === 0) return esq;
  return withScope(esq, aspect, [...includedList(esq, aspect), ...unset], scopeExclusionsOf(esq));
}

interface EsqPlanValues {
  frequencyBasis: EsqFrequencyBasis;
  stateWeighting: EsqStateWeighting;
  moduleCounting: EsqModuleCounting;
  reportingFloorPerYear: number;
  convergenceStepPercent: number;
}

const ESQ_PLAN_KEYS: EsqPlanKey[] = ["frequencyBasis", "stateWeighting", "moduleCounting", "reportingFloorPerYear", "convergenceStepPercent"];

function planValues(esq: EventSequenceQuantification): EsqPlanValues {
  const plan = esq.quantificationPlan ?? {};
  return {
    frequencyBasis: plan.frequencyBasis?.value ?? ESQ_PLAN_DEFAULTS.frequencyBasis,
    stateWeighting: plan.stateWeighting?.value ?? ESQ_PLAN_DEFAULTS.stateWeighting,
    moduleCounting: plan.moduleCounting?.value ?? ESQ_PLAN_DEFAULTS.moduleCounting,
    reportingFloorPerYear: plan.reportingFloorPerYear?.value ?? ESQ_PLAN_DEFAULTS.reportingFloorPerYear,
    convergenceStepPercent: plan.convergenceStepPercent?.value ?? ESQ_PLAN_DEFAULTS.convergenceStepPercent,
  };
}

function planChanged(esq: EventSequenceQuantification, key: EsqPlanKey): boolean {
  return planValues(esq)[key] !== ESQ_PLAN_DEFAULTS[key];
}

function planReason(esq: EventSequenceQuantification, key: EsqPlanKey): string {
  return esq.quantificationPlan?.[key]?.reason ?? "";
}

function withPlan(esq: EventSequenceQuantification, plan: EsqQuantificationPlan): EventSequenceQuantification {
  return { ...esq, quantificationPlan: plan };
}

function withPlanReason(esq: EventSequenceQuantification, key: EsqPlanKey, reason: string): EventSequenceQuantification {
  const plan = esq.quantificationPlan ?? {};
  if (key === "frequencyBasis") return plan.frequencyBasis === undefined ? esq : withPlan(esq, { ...plan, frequencyBasis: { ...plan.frequencyBasis, reason } });
  if (key === "stateWeighting") return plan.stateWeighting === undefined ? esq : withPlan(esq, { ...plan, stateWeighting: { ...plan.stateWeighting, reason } });
  if (key === "moduleCounting") return plan.moduleCounting === undefined ? esq : withPlan(esq, { ...plan, moduleCounting: { ...plan.moduleCounting, reason } });
  if (key === "reportingFloorPerYear") return plan.reportingFloorPerYear === undefined ? esq : withPlan(esq, { ...plan, reportingFloorPerYear: { ...plan.reportingFloorPerYear, reason } });
  return plan.convergenceStepPercent === undefined ? esq : withPlan(esq, { ...plan, convergenceStepPercent: { ...plan.convergenceStepPercent, reason } });
}

function withPlanDefault(esq: EventSequenceQuantification, key: EsqPlanKey): EventSequenceQuantification {
  const plan = esq.quantificationPlan ?? {};
  if (key === "frequencyBasis") return withPlan(esq, { ...plan, frequencyBasis: undefined });
  if (key === "stateWeighting") return withPlan(esq, { ...plan, stateWeighting: undefined });
  if (key === "moduleCounting") return withPlan(esq, { ...plan, moduleCounting: undefined });
  if (key === "reportingFloorPerYear") return withPlan(esq, { ...plan, reportingFloorPerYear: undefined });
  return withPlan(esq, { ...plan, convergenceStepPercent: undefined });
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function scopeItemsToComplete(esq: EventSequenceQuantification, upstream: EsqUpstream): string[] {
  const items: string[] = [];
  if (esq.praScope.trim().length === 0) items.push("Write the PRA scope.");
  if ((esq.linkedWorkbooks?.ES ?? "").length === 0) items.push("Link the ES workbook.");
  for (const spec of ESQ_SCOPE_ASPECTS) {
    const rows = scopeRowsView(esq, upstream, spec.aspect);
    const unset = rows.filter((row) => row.state === "unset").length;
    const noReason = rows.filter((row) => row.state === "excluded" && row.reason.trim().length === 0).length;
    if (!rows.some((row) => row.state === "included")) items.push(`Include at least one ${spec.item}.`);
    if (unset > 0) items.push(`Set Included or Excluded for ${plural(unset, spec.item)}.`);
    if (noReason > 0) items.push(`Give a reason for ${noReason === 1 ? "the excluded" : `the ${noReason} excluded`} ${noReason === 1 ? spec.item : `${spec.item}s`}.`);
  }
  for (const key of ESQ_PLAN_KEYS) {
    if (planChanged(esq, key) && planReason(esq, key).trim().length === 0) items.push(`Give a reason for the changed ${ESQ_PLAN_LABELS[key].toLowerCase()}.`);
  }
  const values = planValues(esq);
  if (!(values.reportingFloorPerYear > 0)) items.push("Set a reporting floor above zero.");
  if (!(values.convergenceStepPercent > 0 && values.convergenceStepPercent < 100)) items.push("Set a convergence step between 0 and 100%.");
  if (esq.quantificationPlan?.modulesPerPlant === undefined) items.push("Set the number of modules per plant.");
  if (!esq.modelIntegration.multiReactorSequencesIncluded && (esq.modelIntegration.multiReactorInclusionBasis ?? "").trim().length === 0) {
    items.push("Give the basis for leaving out sequences with several reactors.");
  }
  return items;
}

function externalHazardInScope(esq: EventSequenceQuantification): boolean {
  return esq.modelIntegration.scopeCoverage.hazardGroups.some((group) => ESQ_EXTERNAL_HAZARD_GROUPS.some((external) => sameItem(external, group)));
}

function outOfScopeSrs(esq: EventSequenceQuantification): Map<string, string> {
  const out = new Map<string, string>();
  if (!externalHazardInScope(esq)) {
    out.set("ESQ-C11", "Out of scope · no external hazard group included");
    out.set("ESQ-C15", "Out of scope · no external hazard group included");
  }
  return out;
}

function filterConformance(esq: EventSequenceQuantification, ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  const statusBySr = new Map<string, string>();
  for (const entry of esq.conformanceMatrix) {
    const ccUpper = ccId.replace("cc-", "").toUpperCase();
    if (entry.capabilityCategory === `CC-${ccUpper}`) statusBySr.set(entry.sr, entry.status);
  }
  const outOfScope = outOfScopeSrs(esq);
  return CONFORMANCE_ITEMS.filter((it) => it.requiredAt.includes(ccId)).map((it) => {
    if (!it.stages.includes(stageKey)) return { ...it, status: "na" as const, meta: "Not applicable to current plant stage" };
    const scopeNote = outOfScope.get(it.id);
    if (scopeNote !== undefined) return { ...it, status: "na" as const, meta: scopeNote };
    const matrixStatus = statusBySr.get(it.id);
    if (matrixStatus === "MET") return { ...it, status: "ok" as const };
    if (matrixStatus === "NOT_MET") return { ...it, status: "blocked" as const };
    if (matrixStatus === "NOT_APPLICABLE") return { ...it, status: "na" as const };
    if (matrixStatus === "PARTIAL") return { ...it, status: "warn" as const };
    return { ...it, status: "warn" as const };
  });
}

function groupBySection(items: ConformanceItem[]): [string, ConformanceItem[]][] {
  const sections = new Map<string, ConformanceItem[]>();
  for (const it of items) {
    const list = sections.get(it.section) ?? [];
    list.push(it);
    sections.set(it.section, list);
  }
  return Array.from(sections.entries());
}

function ccScore(esq: EventSequenceQuantification, ccId: string, stage: Stage): CcScore {
  const items = filterConformance(esq, ccId, stage);
  const total = items.length;
  const na = items.filter((it) => it.status === "na").length;
  const met = items.filter((it) => it.status === "ok").length;
  const warn = items.filter((it) => it.status === "warn").length;
  const blocked = items.filter((it) => it.status === "blocked").length;
  const applicable = total - na;
  const ready = met + na;
  const percent = total === 0 ? 0 : Math.round((ready / total) * 100);
  return { applicable, met, warn, blocked, na, ready, total, percent };
}

function commentsView(esq: EventSequenceQuantification, now: Date = new Date()): CommentView[] {
  const reviewers = esq.metadata.reviewers;
  return esq.internalReviewComments.comments.map((c) => {
    const author = reviewers.find((r) => r.id === c.authorId);
    const item = c.associatedSr !== undefined ? CONFORMANCE_ITEMS.find((it) => it.id === c.associatedSr) : undefined;
    return {
      id: c.uuid,
      authorId: c.authorId,
      authorName: author?.name ?? c.authorId,
      authorInitials: initialsOf(author?.name ?? c.authorId),
      authorTitle: author?.title,
      when: relativeFrom(c.createdAt, now),
      createdAt: c.createdAt,
      associatedSr: c.associatedSr,
      section: item?.section ?? "Document (HLR-F)",
      targetLabel: item?.text ?? "General",
      text: c.text,
      severity: c.severity ?? "OBSERVATION",
      resolved: c.resolved,
      resolution: c.resolution,
    };
  });
}

function stepsForPersona(persona: EsqPersona): EsqStep[] {
  const ids = ESQ_PERSONA_STEPS[persona];
  return ESQ_STEPS.filter((s) => ids.includes(s.id));
}

function stepsFromMef(esq: EventSequenceQuantification, persona: EsqPersona, upstream: EsqUpstream = EMPTY_UPSTREAM): EsqStep[] {
  const base = stepsForPersona(persona);
  const scopeComplete = scopeItemsToComplete(esq, upstream).length === 0;
  const modelDone = modelComplete(esq);
  const solveDone = solveComplete(esq);
  const logicDone = logicComplete(esq);
  const postDone = postComplete(esq);
  const barriersDone = barriersComplete(esq);
  const resultsDone = resultsComplete(esq, upstream.ri, upstream.ie);
  const uncertDone = uncertaintyComplete(esq);
  const sensDone = sensitivityComplete(esq, upstream);
  const handoffDone = handoffComplete(esq, upstream);
  const draftComplete = esq.workflowState !== "DRAFT" && esq.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = esq.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "scope": return { ...s, status: status(scopeComplete) };
      case "model": return { ...s, status: status(modelDone) };
      case "solve": return { ...s, status: status(solveDone) };
      case "logic": return { ...s, status: status(logicDone) };
      case "post": return { ...s, status: status(postDone) };
      case "barriers": return { ...s, status: status(barriersDone) };
      case "results": return { ...s, status: status(resultsDone) };
      case "uncert": return { ...s, status: status(uncertDone) };
      case "sens": return { ...s, status: status(sensDone) };
      case "handoff": return { ...s, status: status(handoffDone) };
      case "draft": return { ...s, status: status(draftComplete) };
      case "review": return { ...s, status: status(reviewComplete) };
      default: return { ...s, status: "idle" as const };
    }
  });
}

function importanceLevel(fussellVesely: number | undefined): "high" | "mid" | "low" {
  const fv = fussellVesely ?? 0;
  if (fv >= 0.15) return "high";
  if (fv >= 0.1) return "mid";
  return "low";
}

export {
  filterConformance,
  groupBySection,
  ccScore,
  commentsView,
  stepsForPersona,
  stepsFromMef,
  initialsOf,
  importanceLevel,
  scopeRowsView,
  withScopeState,
  withScopeReason,
  withScopeItemAdded,
  withRestIncluded,
  planValues,
  planChanged,
  planReason,
  withPlan,
  withPlanReason,
  withPlanDefault,
  scopeItemsToComplete,
  externalHazardInScope,
  ESQ_PLAN_KEYS,
  type CommentView,
  type CcScore,
  type EsqScopeRow,
  type EsqScopeState,
  type EsqPlanValues,
};
