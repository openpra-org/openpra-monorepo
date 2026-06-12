import { type MechanisticSourceTermAnalysis, type ReleaseCategory, type SourceTermDefinition } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import { type ParameterDistribution, DistributionType } from "interfaces-mef-types/core/events";
import {
  CONFORMANCE_ITEMS,
  MS_STEPS,
  MS_PERSONA_STEPS,
  type ConformanceItem,
  type MsPersona,
  type MsStep,
  type Stage,
} from "./msViewData";

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

function filterConformance(ms: MechanisticSourceTermAnalysis, ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  const statusBySr = new Map<string, string>();
  for (const entry of ms.conformanceMatrix) {
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

function ccScore(ms: MechanisticSourceTermAnalysis, ccId: string, stage: Stage): CcScore {
  const items = filterConformance(ms, ccId, stage);
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

function commentsView(ms: MechanisticSourceTermAnalysis, now: Date = new Date()): CommentView[] {
  const reviewers = ms.metadata.reviewers;
  return ms.internalReviewComments.comments.map((c) => {
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
      section: item?.section ?? "Document (HLR-E)",
      targetLabel: item?.text ?? "General",
      text: c.text,
      severity: c.severity ?? "OBSERVATION",
      resolved: c.resolved,
      resolution: c.resolution,
    };
  });
}

function stepsForPersona(persona: MsPersona): MsStep[] {
  const ids = MS_PERSONA_STEPS[persona];
  return MS_STEPS.filter((s) => ids.includes(s.id));
}

function stepsFromMef(ms: MechanisticSourceTermAnalysis, persona: MsPersona): MsStep[] {
  const base = stepsForPersona(persona);
  const scopeComplete = ms.praScope.length > 0;
  const categoriesComplete = ms.releaseCategories.length > 0;
  const sourcesComplete = ms.sourceInventories.length > 0 || ms.transportBarrierAssessments.length > 0;
  const transportComplete = ms.transportPhenomenaAssessments.length > 0;
  const sourcetermComplete = ms.sourceTermDefinitions.length > 0;
  const uncertComplete = ms.uncertaintyAnalyses.length > 0 || (ms.preOperationalAssumptions?.length ?? 0) > 0;
  const draftComplete = ms.workflowState !== "DRAFT" && ms.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = ms.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "scope": return { ...s, status: status(scopeComplete) };
      case "categories": return { ...s, status: status(categoriesComplete) };
      case "sources": return { ...s, status: status(sourcesComplete) };
      case "transport": return { ...s, status: status(transportComplete) };
      case "sourceterm": return { ...s, status: status(sourcetermComplete) };
      case "uncert": return { ...s, status: status(uncertComplete) };
      case "draft": return { ...s, status: status(draftComplete) };
      case "review": return { ...s, status: status(reviewComplete) };
      default: return { ...s, status: "idle" as const };
    }
  });
}

function categoryIsRiskSignificant(category: ReleaseCategory): boolean {
  return category.differentiationBasis === "CONSEQUENCE_METRIC_AND_RISK_SIGNIFICANT_DIFFERENTIATION";
}

function categoryIsWarn(category: ReleaseCategory): boolean {
  return (category.groupingJustification ?? "").toLowerCase().includes("under review");
}

function assignedFamilies(category: ReleaseCategory): string[] {
  return category.supportingReferences ?? [];
}

function sourceTermForCategory(ms: MechanisticSourceTermAnalysis, categoryUuid: string): SourceTermDefinition | undefined {
  return ms.sourceTermDefinitions.find((st) => st.releaseCategoryReference === categoryUuid);
}

function speciesTotals(st: SourceTermDefinition): Map<string, number> {
  const totals = new Map<string, number>();
  for (const phase of st.radionuclideReleases) {
    for (const q of phase.quantities) {
      totals.set(q.radionuclide, (totals.get(q.radionuclide) ?? 0) + q.quantity);
    }
  }
  return totals;
}

function phaseQuantity(st: SourceTermDefinition, phaseId: string, radionuclide: string): number | undefined {
  const phase = st.radionuclideReleases.find((p) => p.phaseId === phaseId);
  return phase?.quantities.find((q) => q.radionuclide === radionuclide)?.quantity;
}

function headlineRelease(ms: MechanisticSourceTermAnalysis, categoryUuid: string): number | undefined {
  const st = sourceTermForCategory(ms, categoryUuid);
  if (st === undefined) return undefined;
  const totals = speciesTotals(st);
  const cs = totals.get("Cs-137");
  if (cs !== undefined) return cs;
  const first = st.releaseForms[0]?.radionuclide;
  return first !== undefined ? totals.get(first) : undefined;
}

function lognormalBounds(distribution: ParameterDistribution | undefined): { mean: number; p05: number; p95: number } | undefined {
  if (distribution === undefined || distribution.type !== DistributionType.LOGNORMAL) return undefined;
  return {
    mean: distribution.median,
    p05: distribution.median / distribution.errorFactor,
    p95: distribution.median * distribution.errorFactor,
  };
}

export {
  filterConformance,
  groupBySection,
  ccScore,
  commentsView,
  stepsForPersona,
  stepsFromMef,
  initialsOf,
  categoryIsRiskSignificant,
  categoryIsWarn,
  assignedFamilies,
  sourceTermForCategory,
  speciesTotals,
  phaseQuantity,
  headlineRelease,
  lognormalBounds,
  type CommentView,
  type CcScore,
};
