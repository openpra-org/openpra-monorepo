import { type EventSequenceQuantification, type EventSequenceFamilyQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import {
  CONFORMANCE_ITEMS,
  ESQ_STEPS,
  ESQ_PERSONA_STEPS,
  type ConformanceItem,
  type EsqPersona,
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

function filterConformance(esq: EventSequenceQuantification, ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  const statusBySr = new Map<string, string>();
  for (const entry of esq.conformanceMatrix) {
    const ccUpper = ccId.replace("cc-", "").toUpperCase();
    if (entry.capabilityCategory === `CC-${ccUpper}`) statusBySr.set(entry.sr, entry.status);
  }
  return CONFORMANCE_ITEMS.filter((it) => it.requiredAt.includes(ccId)).map((it) => {
    if (!it.stages.includes(stageKey)) return { ...it, status: "na" as const, meta: "Not applicable to current plant stage" };
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

function stepsFromMef(esq: EventSequenceQuantification, persona: EsqPersona): EsqStep[] {
  const base = stepsForPersona(persona);
  const scopeComplete = esq.praScope.length > 0;
  const integrateComplete = esq.familyQuantifications.length > 0;
  const solveComplete = esq.quantificationMethods.computerCodes.length > 0;
  const logicComplete = (esq.flagEventSettings?.length ?? 0) > 0 || (esq.mutuallyExclusiveEventRules?.length ?? 0) > 0;
  const dependComplete = (esq.multiHfeCutsetIdentifications?.length ?? 0) > 0 || (esq.phenomenaDependencyAssessments?.length ?? 0) > 0;
  const barriersComplete = esq.barrierQuantifications.length > 0;
  const resultsComplete = esq.riskSignificantContributors.length > 0;
  const uncertComplete = (esq.modelUncertaintySourceAssessments?.length ?? 0) > 0 || (esq.preOperationalAssumptions?.length ?? 0) > 0;
  const draftComplete = esq.workflowState !== "DRAFT" && esq.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = esq.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "scope": return { ...s, status: status(scopeComplete) };
      case "integrate": return { ...s, status: status(integrateComplete) };
      case "solve": return { ...s, status: status(solveComplete) };
      case "logic": return { ...s, status: status(logicComplete) };
      case "depend": return { ...s, status: status(dependComplete) };
      case "barriers": return { ...s, status: status(barriersComplete) };
      case "results": return { ...s, status: status(resultsComplete) };
      case "uncert": return { ...s, status: status(uncertComplete) };
      case "draft": return { ...s, status: status(draftComplete) };
      case "review": return { ...s, status: status(reviewComplete) };
      default: return { ...s, status: "idle" as const };
    }
  });
}

function familyMeanFrequency(family: EventSequenceFamilyQuantification): number {
  return typeof family.meanFrequency === "number" ? family.meanFrequency : family.meanFrequency.value;
}

function familyIsRiskSignificant(family: EventSequenceFamilyQuantification): boolean {
  return family.quantificationBasis !== "POINT_ESTIMATE";
}

function familyIsWarn(family: EventSequenceFamilyQuantification): boolean {
  return (family.crossSourceGroupingJustification ?? "").toLowerCase().includes("under review");
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
  familyMeanFrequency,
  familyIsRiskSignificant,
  familyIsWarn,
  importanceLevel,
  type CommentView,
  type CcScore,
};
