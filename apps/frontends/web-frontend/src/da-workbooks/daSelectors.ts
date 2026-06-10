import { type DataAnalysis, type DataAnalysisParameter, type BayesianUpdate, type Uncertainty } from "interfaces-mef-types/da/data-analysis";
import { type ParameterDistribution, DistributionType } from "interfaces-mef-types/core/events";
import {
  CONFORMANCE_ITEMS,
  DA_STEPS,
  DA_PERSONA_STEPS,
  type ConformanceItem,
  type DaPersona,
  type DaStep,
  type Stage,
} from "./daViewData";

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

function fmtValue(v: number | undefined | null): string {
  if (v === undefined || v === null) return "—";
  return v.toExponential(1).replace("e", "E");
}

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

function filterConformance(da: DataAnalysis, ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  const statusBySr = new Map<string, string>();
  for (const entry of da.conformanceMatrix) {
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

function ccScore(da: DataAnalysis, ccId: string, stage: Stage): CcScore {
  const items = filterConformance(da, ccId, stage);
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

function commentsView(da: DataAnalysis, now: Date = new Date()): CommentView[] {
  const reviewers = da.metadata.reviewers;
  return da.internalReviewComments.comments.map((c) => {
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

function stepsForPersona(persona: DaPersona): DaStep[] {
  const ids = DA_PERSONA_STEPS[persona];
  return DA_STEPS.filter((s) => ids.includes(s.id));
}

function stepsFromMef(da: DataAnalysis, persona: DaPersona): DaStep[] {
  const base = stepsForPersona(persona);
  const scopeComplete = da.praScope.length > 0 || da.parameters.length > 0;
  const defineComplete = da.parameters.length > 0;
  const groupComplete = (da.componentGroupings?.length ?? 0) > 0;
  const genericComplete = (da.externalDataSources?.length ?? 0) > 0;
  const countsComplete = (da.demandCountRecords?.length ?? 0) > 0 || (da.exposureTimeRecords?.length ?? 0) > 0;
  const unavailComplete = (da.unavailabilityDataRecords?.length ?? 0) > 0;
  const estimateComplete = da.parameters.some((p) => p.probabilityModel !== undefined);
  const ccfComplete = (da.ccfParameterEstimations?.length ?? 0) > 0;
  const uncertComplete = (da.preOperationalAssumptions?.length ?? 0) > 0 || da.modelUncertainty.uncertaintySources.length > 0;
  const draftComplete = da.workflowState !== "DRAFT" && da.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = da.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "scope": return { ...s, status: status(scopeComplete) };
      case "define": return { ...s, status: status(defineComplete) };
      case "group": return { ...s, status: status(groupComplete) };
      case "generic": return { ...s, status: status(genericComplete) };
      case "counts": return { ...s, status: status(countsComplete) };
      case "unavail": return { ...s, status: status(unavailComplete) };
      case "estimate": return { ...s, status: status(estimateComplete) };
      case "ccf": return { ...s, status: status(ccfComplete) };
      case "uncert": return { ...s, status: status(uncertComplete) };
      case "draft": return { ...s, status: status(draftComplete) };
      case "review": return { ...s, status: status(reviewComplete) };
      default: return { ...s, status: "idle" as const };
    }
  });
}

function distLabel(dist: ParameterDistribution | undefined): string {
  if (dist === undefined) return "—";
  switch (dist.type) {
    case DistributionType.BETA: return "Beta";
    case DistributionType.GAMMA: return "Gamma";
    case DistributionType.LOGNORMAL: return "Lognormal";
    case DistributionType.LOGNORMAL_TIME: return "Lognormal";
    case DistributionType.NORMAL: return "Normal";
    case DistributionType.UNIFORM: return "Uniform";
    case DistributionType.EXPONENTIAL: return "Exponential";
    case DistributionType.WEIBULL: return "Weibull";
    case DistributionType.POISSON: return "Poisson";
    case DistributionType.BINOMIAL: return "Binomial";
    case DistributionType.POINT_ESTIMATE: return "Point estimate";
    default: return "—";
  }
}

function modelBasis(param: DataAnalysisParameter): "DEMAND" | "TIME" {
  return param.probabilityModel?.distribution.type === DistributionType.BETA ? "DEMAND" : "TIME";
}

function modelLabel(param: DataAnalysisParameter): string {
  const t = param.probabilityModel?.distribution.type;
  if (t === DistributionType.BETA) return "Constant demand probability";
  if (t === DistributionType.GAMMA) return param.parameterType === "FREQUENCY" ? "Event frequency" : "Failure rate";
  return "Probability model";
}

function paramIsWarn(param: DataAnalysisParameter): boolean {
  return param.similarEquipmentAdjustment !== undefined && param.valueType === "POINT_ESTIMATE";
}

function methodIdsForParameter(param: DataAnalysisParameter): string[] {
  const bu = param.bayesianUpdate;
  if (bu !== undefined && bu.performed) {
    const method = bu.method.toLowerCase();
    const prior = method.includes("empirical") || method.includes("population") ? "empbayes" : method.includes("jeffreys") ? "jeffreys" : "bayes";
    return ["bayes", prior];
  }
  return ["mle"];
}

function uncertaintyText(uncertainty: Uncertainty | undefined, riskSignificant: boolean): string {
  const dist = uncertainty?.distribution;
  if (dist !== undefined && dist.type === DistributionType.LOGNORMAL) {
    return `Lognormal with an error factor of ${dist.errorFactor}${riskSignificant ? ", risk-significant." : "."}`;
  }
  return "Point value with a stated bound at CC-I.";
}

function posteriorText(bu: BayesianUpdate): string {
  const dist = bu.posterior?.distribution;
  if (dist !== undefined && dist.type === DistributionType.LOGNORMAL) {
    return `${fmtValue(dist.median)} · EF ${dist.errorFactor}`;
  }
  return "Posterior estimated";
}

export {
  filterConformance,
  groupBySection,
  ccScore,
  commentsView,
  stepsForPersona,
  stepsFromMef,
  initialsOf,
  fmtValue,
  distLabel,
  modelBasis,
  modelLabel,
  paramIsWarn,
  methodIdsForParameter,
  uncertaintyText,
  posteriorText,
  type CommentView,
  type CcScore,
};
