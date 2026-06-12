import { type RadiologicalConsequenceAnalysis, type ReleaseCategoryInputs } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { type ParameterDistribution, DistributionType } from "interfaces-mef-types/core/events";
import {
  CONFORMANCE_ITEMS,
  RC_STEPS,
  RC_PERSONA_STEPS,
  type ConformanceItem,
  type RcPersona,
  type RcStep,
  type SiteBasis,
} from "./rcViewData";

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

function siteFromMef(rc: RadiologicalConsequenceAnalysis): SiteBasis {
  return rc.releaseCategoryToConsequence.siteInformation.isBounding ? "bounding_site" : "actual_site";
}

function filterConformance(rc: RadiologicalConsequenceAnalysis, ccId: string, site: SiteBasis): ConformanceItem[] {
  const statusBySr = new Map<string, string>();
  for (const entry of rc.conformanceMatrix) {
    const ccUpper = ccId.replace("cc-", "").toUpperCase();
    if (entry.capabilityCategory === `CC-${ccUpper}`) statusBySr.set(entry.sr, entry.status);
  }
  return CONFORMANCE_ITEMS.filter((it) => it.requiredAt.includes(ccId)).map((it) => {
    if (it.boundingOnly && site === "actual_site") {
      return { ...it, status: "na" as const, meta: "Not applicable to the identified site" };
    }
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

function ccScore(rc: RadiologicalConsequenceAnalysis, ccId: string, site: SiteBasis): CcScore {
  const items = filterConformance(rc, ccId, site);
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

function commentsView(rc: RadiologicalConsequenceAnalysis, now: Date = new Date()): CommentView[] {
  const reviewers = rc.metadata.reviewers;
  return rc.internalReviewComments.comments.map((c) => {
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
      section: item?.section ?? "Consequence quantification (RCQ)",
      targetLabel: item?.text ?? "General",
      text: c.text,
      severity: c.severity ?? "OBSERVATION",
      resolved: c.resolved,
      resolution: c.resolution,
    };
  });
}

function stepsForPersona(persona: RcPersona): RcStep[] {
  const ids = RC_PERSONA_STEPS[persona];
  return RC_STEPS.filter((s) => ids.includes(s.id));
}

function stepsFromMef(rc: RadiologicalConsequenceAnalysis, persona: RcPersona): RcStep[] {
  const base = stepsForPersona(persona);
  const handoffComplete = rc.praScope.length > 0 && rc.releaseCategoryToConsequence.releaseCategoryInputs.length > 0;
  const protectiveComplete = rc.protectiveActionParameters.protectiveActionsIncluded.length > 0;
  const weatherComplete = rc.meteorologicalData.dataSource.length > 0;
  const dispersionComplete = rc.atmosphericTransportAndDispersion.dispersionModel.justification.length > 0;
  const doseComplete = rc.dosimetry.exposurePathways.length > 0;
  const healthComplete = rc.healthEffects.earlyHealthEffects.length > 0;
  const economicsComplete = rc.economicFactors.costCategories.length > 0;
  const quantifyComplete = rc.consequenceQuantification.eventSequenceConsequences.length > 0;
  const draftComplete = rc.workflowState !== "DRAFT" && rc.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = rc.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "handoff": return { ...s, status: status(handoffComplete) };
      case "protective": return { ...s, status: status(protectiveComplete) };
      case "weather": return { ...s, status: status(weatherComplete) };
      case "dispersion": return { ...s, status: status(dispersionComplete) };
      case "dose": return { ...s, status: status(doseComplete) };
      case "health": return { ...s, status: status(healthComplete) };
      case "economics": return { ...s, status: status(economicsComplete) };
      case "quantify": return { ...s, status: status(quantifyComplete) };
      case "draft": return { ...s, status: status(draftComplete) };
      case "review": return { ...s, status: status(reviewComplete) };
      default: return { ...s, status: "idle" as const };
    }
  });
}

function categoryInputById(rc: RadiologicalConsequenceAnalysis, categoryId: string): ReleaseCategoryInputs | undefined {
  return rc.releaseCategoryToConsequence.releaseCategoryInputs.find((c) => c.releaseCategory === categoryId);
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
  siteFromMef,
  categoryInputById,
  lognormalBounds,
  type CommentView,
  type CcScore,
};
