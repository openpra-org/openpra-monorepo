import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import {
  CONFORMANCE_ITEMS,
  HR_STEPS,
  HR_PERSONA_STEPS,
  type ConformanceItem,
  type HrPersona,
  type HrStep,
  type Stage,
} from "./hrViewData";

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

function filterConformance(hr: HumanReliabilityAnalysis, ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  const statusBySr = new Map<string, string>();
  for (const entry of hr.conformanceMatrix) {
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

function ccScore(hr: HumanReliabilityAnalysis, ccId: string, stage: Stage): CcScore {
  const items = filterConformance(hr, ccId, stage);
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

function commentsView(hr: HumanReliabilityAnalysis, now: Date = new Date()): CommentView[] {
  const reviewers = hr.metadata.reviewers;
  return hr.internalReviewComments.comments.map((c) => {
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
      section: item?.section ?? "Document (HLR-I)",
      targetLabel: item?.text ?? "General",
      text: c.text,
      severity: c.severity ?? "OBSERVATION",
      resolved: c.resolved,
      resolution: c.resolution,
    };
  });
}

function stepsForPersona(persona: HrPersona): HrStep[] {
  const ids = HR_PERSONA_STEPS[persona];
  return HR_STEPS.filter((s) => ids.includes(s.id));
}

function stepsFromMef(hr: HumanReliabilityAnalysis, persona: HrPersona): HrStep[] {
  const base = stepsForPersona(persona);
  const scopeComplete = hr.praScope.length > 0 || hr.routineActivities.length > 0;
  const preidComplete = hr.routineActivities.length > 0;
  const predefComplete = hr.preInitiatorScreeningRecords.length > 0 || hr.humanFailureEvents.some((h) => h.hfeTiming === "PRE_INITIATOR");
  const prequantComplete = hr.hepQuantifications.length > 0;
  const respidComplete = hr.responseIdentificationReviews.length > 0;
  const respdefComplete = hr.humanFailureEvents.some((h) => h.hfeTiming !== "PRE_INITIATOR");
  const respquantComplete = hr.dependencyAssessments.length > 0;
  const recoveryComplete = (hr.recoveryActions?.length ?? 0) > 0;
  const uncertComplete = (hr.preOperationalAssumptions?.length ?? 0) > 0 || hr.modelUncertainty.uncertaintySources.length > 0;
  const draftComplete = hr.workflowState !== "DRAFT" && hr.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = hr.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "scope": return { ...s, status: status(scopeComplete) };
      case "preid": return { ...s, status: status(preidComplete) };
      case "predef": return { ...s, status: status(predefComplete) };
      case "prequant": return { ...s, status: status(prequantComplete) };
      case "respid": return { ...s, status: status(respidComplete) };
      case "respdef": return { ...s, status: status(respdefComplete) };
      case "respquant": return { ...s, status: status(respquantComplete) };
      case "recovery": return { ...s, status: status(recoveryComplete) };
      case "uncert": return { ...s, status: status(uncertComplete) };
      case "draft": return { ...s, status: status(draftComplete) };
      case "review": return { ...s, status: status(reviewComplete) };
      default: return { ...s, status: "idle" as const };
    }
  });
}

export {
  filterConformance,
  groupBySection,
  ccScore,
  commentsView,
  stepsForPersona,
  stepsFromMef,
  initialsOf,
  type CommentView,
  type CcScore,
};
