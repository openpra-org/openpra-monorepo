import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import {
  CONFORMANCE_ITEMS,
  SC_STEPS,
  SC_PERSONA_STEPS,
  type ConformanceItem,
  type ScPersona,
  type ScStep,
  type Stage,
} from "./scViewData";

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

function filterConformance(sc: SuccessCriteriaDevelopment, ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  const statusBySr = new Map<string, string>();
  for (const entry of sc.conformanceMatrix) {
    const ccUpper = ccId.replace("cc-", "").toUpperCase();
    if (entry.capabilityCategory === `CC-${ccUpper}`) statusBySr.set(entry.sr, entry.status);
  }
  return CONFORMANCE_ITEMS.filter((it) => it.requiredAt.includes(ccId)).map((it) => {
    if (!it.stages.includes(stageKey)) return { ...it, status: "na" as const };
    const matrixStatus = statusBySr.get(it.id);
    if (matrixStatus === "MET") return { ...it, status: "ok" as const };
    if (matrixStatus === "NOT_MET") return { ...it, status: "blocked" as const };
    if (matrixStatus === "NOT_APPLICABLE") return { ...it, status: "na" as const };
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

function ccScore(sc: SuccessCriteriaDevelopment, ccId: string, stage: Stage): CcScore {
  const items = filterConformance(sc, ccId, stage);
  const applicable = items.filter((it) => it.status !== "na").length;
  const met = items.filter((it) => it.status === "ok").length;
  const warn = items.filter((it) => it.status === "warn").length;
  const blocked = items.filter((it) => it.status === "blocked").length;
  const na = items.filter((it) => it.status === "na").length;
  const percent = applicable === 0 ? 0 : Math.round((met / applicable) * 100);
  return { applicable, met, warn, blocked, na, percent };
}

function commentsView(sc: SuccessCriteriaDevelopment, now: Date = new Date()): CommentView[] {
  const reviewers = sc.metadata.reviewers;
  return sc.internalReviewComments.comments.map((c) => {
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
      section: item?.section ?? "Documentation (HLR-SC-C)",
      targetLabel: item?.text ?? "General",
      text: c.text,
      severity: c.severity ?? "OBSERVATION",
      resolved: c.resolved,
      resolution: c.resolution,
    };
  });
}

function stepsForPersona(persona: ScPersona): ScStep[] {
  const ids = SC_PERSONA_STEPS[persona];
  return SC_STEPS.filter((s) => ids.includes(s.id));
}

function stepsFromMef(sc: SuccessCriteriaDevelopment, persona: ScPersona): ScStep[] {
  const base = stepsForPersona(persona);
  const scopeComplete = sc.praScope.length > 0 || sc.radionuclideBarrierCriteria.length > 0;
  const stableComplete = sc.safeStableStateDefinition.definition.length > 0 || sc.endStateDefinitions.length > 0;
  const criteriaComplete = sc.safetyFunctionSuccessCriteria.length > 0;
  const missionComplete = sc.missionTimes.length > 0;
  const basesComplete = sc.engineeringAnalyses.length > 0;
  const passiveComplete = (sc.passiveSafetyFunctionCriteria?.length ?? 0) > 0;
  const consistencyComplete = (sc.consistencyVerifications?.length ?? 0) > 0 || sc.analysisDetailConsistency.basis.length > 0;
  const draftComplete = sc.workflowState !== "DRAFT" && sc.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = sc.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "scope": return { ...s, status: status(scopeComplete) };
      case "stable": return { ...s, status: status(stableComplete) };
      case "criteria": return { ...s, status: status(criteriaComplete) };
      case "mission": return { ...s, status: status(missionComplete) };
      case "bases": return { ...s, status: status(basesComplete) };
      case "passive": return { ...s, status: status(passiveComplete) };
      case "consistency": return { ...s, status: status(consistencyComplete) };
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
