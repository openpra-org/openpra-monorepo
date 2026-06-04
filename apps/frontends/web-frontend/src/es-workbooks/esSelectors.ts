import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import {
  CONFORMANCE_ITEMS,
  ES_STEPS,
  ES_PERSONA_STEPS,
  type ConformanceItem,
  type ConformanceStatus,
  type EsPersona,
  type EsStep,
  type Stage,
} from "./esViewData";

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

function filterConformance(es: EventSequenceAnalysis, ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  const statusBySr = new Map<string, string>();
  for (const entry of es.conformanceMatrix) {
    const ccUpper = ccId.replace("cc-", "").toUpperCase();
    if (entry.capabilityCategory === `CC-${ccUpper}`) statusBySr.set(entry.sr, entry.status);
  }
  return CONFORMANCE_ITEMS.filter((it) => it.requiredAt.includes(ccId)).map((it) => {
    const hasStage = it.stages.includes(stageKey) || it.stages.includes("operational") && it.stages.includes("pre_operational");
    if (!hasStage) return { ...it, status: "na" as const };
    const matrixStatus = statusBySr.get(it.id.toUpperCase().replace(/^es-/, "ES-"));
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

function ccScore(es: EventSequenceAnalysis, ccId: string, stage: Stage): CcScore {
  const items = filterConformance(es, ccId, stage);
  const applicable = items.filter((it) => it.status !== "na").length;
  const met = items.filter((it) => it.status === "ok").length;
  const warn = items.filter((it) => it.status === "warn").length;
  const blocked = items.filter((it) => it.status === "blocked").length;
  const na = items.filter((it) => it.status === "na").length;
  const percent = applicable === 0 ? 0 : Math.round((met / applicable) * 100);
  return { applicable, met, warn, blocked, na, percent };
}

function commentsView(es: EventSequenceAnalysis, now: Date = new Date()): CommentView[] {
  const reviewers = es.metadata.reviewers;
  return es.internalReviewComments.comments.map((c) => {
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
      section: item?.section ?? "Documentation (HLR-ES-D)",
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

function stepsForPersona(persona: EsPersona): EsStep[] {
  const ids = ES_PERSONA_STEPS[persona];
  return ES_STEPS.filter((s) => ids.includes(s.id));
}

function stepsFromMef(es: EventSequenceAnalysis, persona: EsPersona): EsStep[] {
  const base = stepsForPersona(persona);
  const scopeComplete = es.praScope.length > 0;
  const sequencesComplete = es.eventSequences.length > 0;
  const depsComplete = (es.dependencyModels?.functionalDependencies?.length ?? 0) > 0 ||
    (es.dependencyModels?.phenomenologicalDependencies?.length ?? 0) > 0 ||
    (es.dependencyModels?.humanDependencies?.length ?? 0) > 0;
  const timingComplete = (es.eventTrees?.length ?? 0) > 0;
  const endStatesComplete = (es.releaseCategoryMappings?.length ?? 0) > 0;
  const familiesComplete = es.eventSequenceFamilies.length > 0;
  const screeningComplete = es.screeningRecords.length > 0;
  const quantComplete = es.eventSequenceFamilies.some((f) => f.meanFrequency !== undefined);
  const draftComplete = es.workflowState !== "DRAFT" && es.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = es.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "scope":     return { ...s, status: status(scopeComplete) };
      case "sequences": return { ...s, status: status(sequencesComplete) };
      case "deps":      return { ...s, status: status(depsComplete) };
      case "timing":    return { ...s, status: status(timingComplete) };
      case "endstates": return { ...s, status: status(endStatesComplete) };
      case "families":  return { ...s, status: status(familiesComplete) };
      case "screening": return { ...s, status: status(screeningComplete) };
      case "quant":     return { ...s, status: status(quantComplete) };
      case "draft":     return { ...s, status: status(draftComplete) };
      case "review":    return { ...s, status: status(reviewComplete) };
      default:          return { ...s, status: "idle" as const };
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
