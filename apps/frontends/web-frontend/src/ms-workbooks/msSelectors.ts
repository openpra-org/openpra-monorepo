import { type MechanisticSourceTermAnalysis, type ReleaseCategory, type SourceTermDefinition, type TransportBarrierAssessment } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
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

const SR_MET: Record<string, (ms: MechanisticSourceTermAnalysis) => boolean> = {
  "MS-A1": (ms) => ms.releaseCategories.length > 0 && ms.releaseCategories.every((r) => (r.timingClassification ?? "").length > 0 && (r.magnitudeClassification ?? "").length > 0 && r.boundingSequenceReference.length > 0),
  "MS-A2": (ms) => ms.releaseCategoryCompletenessAssessment.setReasonablyComplete && ms.releaseCategoryCompletenessAssessment.basis.length > 0,
  "MS-A3": (ms) => ms.releaseCategories.length > 0 && !ms.releaseCategories.some((r) => (r.groupingJustification ?? "").toLowerCase().includes("under review")),
  "MS-A4": (ms) => ms.releaseCategories.length > 0 && ms.releaseCategories.every((r) => r.releaseTerminationTime.justification.length > 0),
  "MS-A5": (ms) => ms.releaseCategories.length > 0 && ms.releaseCategories.every((r) => r.boundingSequenceReference.length > 0),
  "MS-B1": (ms) => ms.sourceInventories.length > 0 && ms.sourceInventories.every((s) => s.inventory.length > 0),
  "MS-B2": (ms) => ms.transportBarrierAssessments.length > 0,
  "MS-B3": (ms) => ms.transportBarrierAssessments.length > 0 && ms.transportBarrierAssessments.every((b) => (b.failureModes ?? []).length > 0),
  "MS-B4": (ms) => ms.transportBarrierAssessments.length > 0 && ms.transportBarrierAssessments.every((b) => b.transportCharacteristics.length > 0),
  "MS-B5": (ms) => ms.transportPhenomenaAssessments.length > 0 && ms.transportPhenomenaAssessments.every((a) => a.phenomenaChecklist.length > 0),
  "MS-B6": (ms) => (ms.modelUncertaintyAssessments ?? []).some((u) => u.sourceBlock === "BARRIER_TRANSPORT_ASSESSMENT"),
  "MS-B7": (ms) => (ms.preOperationalAssumptions ?? []).length > 0,
  "MS-C1": (ms) => ms.sourceTermDefinitions.length > 0,
  "MS-C2": (ms) => ms.sourceTermDefinitions.length > 0 && ms.sourceTermDefinitions.filter((s) => s.sourceTermBasis === "GENERIC_APPLICABLE").every((s) => (s.genericApplicabilityJustification ?? "").length > 0),
  "MS-C3": (ms) => ms.sourceTermDefinitions.some((s) => s.sourceTermBasis === "PLANT_SPECIFIC_MECHANISTIC"),
  "MS-C4": (ms) => ms.transportPhenomenaAssessments.some((a) => a.consequenceQuantificationSupport.adequacyJustification.length > 0),
  "MS-C5": (ms) => (ms.sourceTermModels ?? []).length > 0,
  "MS-C6": (ms) => (ms.modelUncertaintyAssessments ?? []).some((u) => u.sourceBlock === "SOURCE_TERM_CALCULATION"),
  "MS-C7": (ms) => (ms.preOperationalAssumptions ?? []).length > 0,
  "MS-D1": (ms) => ms.uncertaintyAnalyses.some((u) => u.uncertainInputParameters.length > 0),
  "MS-D2": (ms) => ms.uncertaintyAnalyses.length > 0 && ms.uncertaintyAnalyses.every((u) => u.componentEstimates.length > 0),
  "MS-D3": (ms) => (ms.modelUncertaintyAssessments ?? []).length > 0,
  "MS-D4": (ms) => ms.uncertaintyAnalyses.some((u) => u.characterizationLevel === "PROPAGATED_WITH_PHENOMENA_DEPENDENCIES"),
  "MS-E1": (ms) => ms.documentation.processDescription.length > 0 && ms.documentation.resultsSummary.length > 0,
  "MS-E2": (ms) => ms.sourceTermDefinitions.some((s) => s.radionuclideReleases.length > 0),
  "MS-E3": (ms) => (ms.modelUncertaintyAssessments ?? []).length > 0 && (ms.sensitivityStudies ?? []).length > 0,
  "MS-E4": (ms) => (ms.preOperationalAssumptions ?? []).length > 0,
};

function deriveSrStatus(ms: MechanisticSourceTermAnalysis, sr: string): "ok" | "warn" {
  const pred = SR_MET[sr];
  return pred !== undefined && pred(ms) ? "ok" : "warn";
}

function countLabel(n: number, singular: string, plural: string): string {
  return `${String(n)} ${n === 1 ? singular : plural}`;
}

const SR_META: Record<string, (ms: MechanisticSourceTermAnalysis) => string> = {
  "MS-A1": () => "7 attributes",
  "MS-A4": (ms) => countLabel(ms.releaseCategories.length, "category", "categories"),
  "MS-B1": (ms) => countLabel(ms.sourceInventories.length, "source", "sources"),
  "MS-B2": (ms) => countLabel(ms.transportBarrierAssessments.length, "barrier", "barriers"),
  "MS-B5": (ms) => countLabel(ms.transportPhenomenaAssessments.length, "assessment", "assessments"),
  "MS-C3": (ms) => countLabel(ms.sourceTermDefinitions.filter((s) => s.sourceTermBasis === "PLANT_SPECIFIC_MECHANISTIC").length, "category", "categories"),
  "MS-C5": (ms) => countLabel((ms.sourceTermModels ?? []).length, "model", "models"),
  "MS-D3": (ms) => countLabel((ms.modelUncertaintyAssessments ?? []).length, "source", "sources"),
  "MS-E2": (ms) => countLabel(ms.sourceTermDefinitions.length, "table", "tables"),
};

function deriveSrMeta(ms: MechanisticSourceTermAnalysis, sr: string, fallback?: string): string | undefined {
  const fn = SR_META[sr];
  return fn !== undefined ? fn(ms) : fallback;
}

function filterConformance(ms: MechanisticSourceTermAnalysis, ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  return CONFORMANCE_ITEMS.filter((it) => it.requiredAt.includes(ccId)).map((it) => {
    if (!it.stages.includes(stageKey)) return { ...it, status: "na" as const, meta: "Not applicable to current plant stage" };
    return { ...it, status: deriveSrStatus(ms, it.id), meta: deriveSrMeta(ms, it.id, it.meta) };
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

function barrierPassFraction(barrier: TransportBarrierAssessment): number {
  const df = barrier.decontaminationFactor;
  if (df === undefined || df <= 0) return 1;
  return 1 / df;
}

function barriersForCategory(ms: MechanisticSourceTermAnalysis, categoryRef: string): TransportBarrierAssessment[] {
  return ms.transportBarrierAssessments.filter((b) => b.releaseCategoryReference === categoryRef);
}

function retentionChainNet(ms: MechanisticSourceTermAnalysis, categoryRef: string): number {
  return barriersForCategory(ms, categoryRef).reduce((frac, b) => frac * barrierPassFraction(b), 1);
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
  return headlineReleaseDetail(ms, categoryUuid)?.value;
}

function headlineReleaseDetail(ms: MechanisticSourceTermAnalysis, categoryUuid: string): { species: string; value: number } | undefined {
  const st = sourceTermForCategory(ms, categoryUuid);
  if (st === undefined) return undefined;
  const totals = speciesTotals(st);
  const cs = totals.get("Cs-137");
  if (cs !== undefined) return { species: "Cs-137", value: cs };
  const first = st.releaseForms[0]?.radionuclide;
  if (first === undefined) return undefined;
  const value = totals.get(first);
  return value === undefined ? undefined : { species: first, value };
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
  barrierPassFraction,
  barriersForCategory,
  retentionChainNet,
  sourceTermForCategory,
  speciesTotals,
  phaseQuantity,
  headlineRelease,
  headlineReleaseDetail,
  lognormalBounds,
  type CommentView,
  type CcScore,
};
