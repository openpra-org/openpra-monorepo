import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import {
  CONFORMANCE_ITEMS,
  IE_STEPS,
  IE_PERSONA_STEPS,
  type ConformanceItem,
  type ConformanceStatus,
  type IePersona,
  type IeStep,
  type Stage,
} from "./ieViewData";

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

interface CcSnapshotView {
  id: string;
  label: string;
}

interface NmView {
  id: string;
  name: string;
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

function filterConformance(ie: InitiatingEventsAnalysis, ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  const statusBySr = new Map<string, string>();
  for (const entry of ie.conformanceMatrix) {
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

function ccScore(ie: InitiatingEventsAnalysis, ccId: string, stage: Stage): CcScore {
  const items = filterConformance(ie, ccId, stage);
  const applicable = items.filter((it) => it.status !== "na").length;
  const met = items.filter((it) => it.status === "ok").length;
  const warn = items.filter((it) => it.status === "warn").length;
  const blocked = items.filter((it) => it.status === "blocked").length;
  const na = items.filter((it) => it.status === "na").length;
  const percent = applicable === 0 ? 0 : Math.round((met / applicable) * 100);
  return { applicable, met, warn, blocked, na, percent };
}

function commentsView(ie: InitiatingEventsAnalysis, now: Date = new Date()): CommentView[] {
  const reviewers = ie.metadata.reviewers;
  return ie.internalReviewComments.comments.map((c) => {
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
      section: item?.section ?? "Documentation (HLR-IE-D)",
      targetLabel: item?.text ?? "General",
      text: c.text,
      severity: c.severity ?? "OBSERVATION",
      resolved: c.resolved,
      resolution: c.resolution,
    };
  });
}

function ccSnapshotView(cc: PRAConfigurationControl): CcSnapshotView {
  return { id: cc.uuid, label: cc.name };
}

function nmViews(nms: NewlyDevelopedMethod[]): NmView[] {
  return nms.map((nm) => ({ id: nm.uuid, name: nm.name }));
}

function stepsForPersona(persona: IePersona): IeStep[] {
  const ids = IE_PERSONA_STEPS[persona];
  return IE_STEPS.filter((s) => ids.includes(s.id));
}

function stepsFromMef(ie: InitiatingEventsAnalysis, persona: IePersona): IeStep[] {
  const base = stepsForPersona(persona);
  const scopeComplete = ie.praScope.length > 0;
  const statesComplete = ie.applicablePlantOperatingStates.length > 0;
  const identifyComplete = ie.initiators.length > 0;
  const groupingComplete = ie.initiatingEventGroups.length > 0;
  const screeningComplete = ie.screeningRecords.length > 0;
  const frequencyComplete = ie.quantifications.length > 0;
  const hazardsComplete = (ie.hazardAnalyses ?? []).length > 0;
  const completenessComplete = ie.completenessSearch.functionalCategoriesCovered.length > 0;
  const draftComplete = ie.workflowState !== "DRAFT" && ie.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = ie.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "scope": return { ...s, status: status(scopeComplete) };
      case "states": return { ...s, status: status(statesComplete) };
      case "methods": return { ...s, status: status(identifyComplete) };
      case "identify": return { ...s, status: status(identifyComplete) };
      case "completeness": return { ...s, status: status(completenessComplete) };
      case "hazards": return { ...s, status: status(hazardsComplete) };
      case "grouping": return { ...s, status: status(groupingComplete) };
      case "screening": return { ...s, status: status(screeningComplete) };
      case "frequency": return { ...s, status: status(frequencyComplete) };
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
  ccSnapshotView,
  nmViews,
  stepsForPersona,
  stepsFromMef,
  initialsOf,
  type CommentView,
  type CcScore,
  type CcSnapshotView,
  type NmView,
};
