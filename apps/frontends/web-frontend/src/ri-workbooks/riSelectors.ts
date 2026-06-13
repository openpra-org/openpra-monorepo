import { type RiskIntegration, type CompiledRiskInput, type RiskContributor } from "interfaces-mef-types/ri/risk-integration";
import { type ParameterDistribution, DistributionType } from "interfaces-mef-types/core/events";
import {
  CONFORMANCE_ITEMS,
  RI_STEPS,
  RI_PERSONA_STEPS,
  CONTRIBUTOR_ROLLUP,
  type AppTypeId,
  type ConformanceItem,
  type RiPersona,
  type RiStep,
} from "./riViewData";

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

function appTypeFromMef(ri: RiskIntegration): AppTypeId {
  return ri.riskSignificanceCriteria[0]?.applicationType === "BASELINE_RISK" ? "baseline_risk" : "fixed_risk_target";
}

function filterConformance(ri: RiskIntegration, ccId: string, appType: AppTypeId): ConformanceItem[] {
  const statusBySr = new Map<string, string>();
  for (const entry of ri.conformanceMatrix) {
    const ccUpper = ccId.replace("cc-", "").toUpperCase();
    if (entry.capabilityCategory === `CC-${ccUpper}`) statusBySr.set(entry.sr, entry.status);
  }
  return CONFORMANCE_ITEMS.filter((it) => it.requiredAt.includes(ccId)).map((it) => {
    if (it.appOnly !== undefined && it.appOnly !== appType) {
      return { ...it, status: "na" as const, meta: "Not applicable to this application" };
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

function ccScore(ri: RiskIntegration, ccId: string, appType: AppTypeId): CcScore {
  const items = filterConformance(ri, ccId, appType);
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

function commentsView(ri: RiskIntegration, now: Date = new Date()): CommentView[] {
  const reviewers = ri.metadata.reviewers;
  return ri.internalReviewComments.comments.map((c) => {
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
      section: item?.section ?? "Documentation (HLR-RI-D)",
      targetLabel: item?.text ?? "General",
      text: c.text,
      severity: c.severity ?? "OBSERVATION",
      resolved: c.resolved,
      resolution: c.resolution,
    };
  });
}

function stepsForPersona(persona: RiPersona): RiStep[] {
  const ids = RI_PERSONA_STEPS[persona];
  return RI_STEPS.filter((s) => ids.includes(s.id));
}

function stepsFromMef(ri: RiskIntegration, persona: RiPersona): RiStep[] {
  const base = stepsForPersona(persona);
  const convergeComplete = ri.compiledRiskInputs.length > 0;
  const criteriaComplete = ri.riskSignificanceCriteria.length > 0;
  const integrateComplete = ri.integratedRiskResults.metrics.length > 0;
  const aggregateComplete = (ri.significantContributors.significantEventSequenceFamilies?.length ?? 0) > 0;
  const uncertaintyComplete = ri.uncertaintyAnalyses.length > 0;
  const feedbackComplete = ri.riskIntegrationFeedbackDispatch !== undefined;
  const draftComplete = ri.workflowState !== "DRAFT" && ri.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = ri.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "converge": return { ...s, status: status(convergeComplete) };
      case "criteria": return { ...s, status: status(criteriaComplete) };
      case "integrate": return { ...s, status: status(integrateComplete) };
      case "aggregate": return { ...s, status: status(aggregateComplete) };
      case "uncertainty": return { ...s, status: status(uncertaintyComplete) };
      case "feedback": return { ...s, status: status(feedbackComplete) };
      case "draft": return { ...s, status: status(draftComplete) };
      case "review": return { ...s, status: status(reviewComplete) };
      default: return { ...s, status: "idle" as const };
    }
  });
}

function familySignificance(ri: RiskIntegration, familyRef: string): "HIGH" | "MEDIUM" | "LOW" {
  const entry = ri.significantContributors.significantEventSequenceFamilies?.find((f) => f.sourceId === familyRef);
  if (entry?.importanceLevel === "HIGH") return "HIGH";
  if (entry?.importanceLevel === "MEDIUM") return "MEDIUM";
  return "LOW";
}

function compiledById(ri: RiskIntegration, familyRef: string): CompiledRiskInput | undefined {
  return ri.compiledRiskInputs.find((c) => c.eventSequenceFamilyRef === familyRef);
}

function consequenceOf(input: CompiledRiskInput, metric: string): number | undefined {
  return input.consequences.find((c) => c.metric === metric)?.meanValue;
}

function contributorRollup(ri: RiskIntegration): { contributor: RiskContributor; kind: string }[] {
  const sc = ri.significantContributors;
  const buckets: Record<string, RiskContributor[] | undefined> = {
    families: sc.significantEventSequenceFamilies,
    basicEvents: sc.significantBasicEvents,
    humanFailureEvents: sc.significantHumanFailureEvents,
    systems: sc.significantSystems,
  };
  const out: { contributor: RiskContributor; kind: string }[] = [];
  for (const spec of CONTRIBUTOR_ROLLUP) {
    const found = buckets[spec.bucket]?.find((c) => c.sourceId === spec.sourceId);
    if (found !== undefined) out.push({ contributor: found, kind: spec.kind });
  }
  return out;
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
  appTypeFromMef,
  familySignificance,
  compiledById,
  consequenceOf,
  contributorRollup,
  lognormalBounds,
  type CommentView,
  type CcScore,
};
