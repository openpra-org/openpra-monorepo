import {
  RiskSignificantContributorType,
  type ConsistencyReviewRecord,
  type CutsetLogicReviewRecord,
  type EsqCell,
  type EsqFamilyValueSource,
  type EsqHandoffResponse,
  type EsqHandoffWork,
  type EsqModel,
  type EsqResponseStatus,
  type EsqSolveRun,
  type EsqUncertaintyRecord,
  type EventSequenceFamilyQuantification,
  type EventSequenceQuantification,
  type ImportanceAnalysisRecord,
  type ImportanceMeasureEntry,
  type ImportanceReviewRecord,
  type ModelUncertaintySourceAssessment,
  type NonSignificantSampleReview,
  type RiskIntegrationFeedback,
  type RiskSignificantContributor,
  type RuleLogicReviewRecord,
  type SimilarPlantComparison,
  type UncertaintyPropagation,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import type { PreOperationalAssumption } from "interfaces-mef-types/core/documentation";
import type { RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { holdsEstimate } from "interfaces-mef-types/da/data-analysis";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { hash32 } from "interfaces-mef-types/esq/esq-run-inputs";
import { resolvedCombinations, resolvedRecoveries } from "interfaces-mef-types/esq/esq-post-inputs";
import { solveInputsKey, solveWorkOf } from "interfaces-mef-types/esq/esq-solve-inputs";
import { hasUncertainty, sampledInputsOf, uncertaintyInputsKey } from "interfaces-mef-types/esq/esq-measure-inputs";
import type { EsqImportanceRunResult, EsqImportanceTarget, EsqModelRunResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { EsqUpstream } from "./esqLinks";
import type { EsqDaCaseOption } from "./esqDaLinks";
import { modelViewOf, type EsqFamilyView, type EsqFindingSeverity } from "./esqModel";
import { convergenceOf, familyValueOf, type EsqSolveWindowKind } from "./esqSolve";
import {
  CONSISTENCY_LABELS,
  contributorRows,
  cutSetRunIdOf,
  measureRows,
  releaseFamilyIds,
  resultsViewOf,
  reviewOf,
  thresholdsOf,
  type EsqMeasureRow,
} from "./esqResults";
import { uncertaintyWorkOf } from "./esqUncertainty";
import { sensitivityViewOf, type EsqRegisterEntry } from "./esqSensitivity";

type EsqHandoffWindowKind = "esqHandoffResponse";

interface EsqHandoffFinding {
  severity: EsqFindingSeverity;
  check: string;
  item: string;
  detail: string;
  target?: { kind: EsqHandoffWindowKind | EsqSolveWindowKind; id: string };
}

interface EsqHandoffFamilyRow {
  family: EsqFamilyView;
  value?: number;
  source?: EsqFamilyValueSource;
  mean?: number;
  p05?: number;
  p50?: number;
  p95?: number;
  sokc: boolean;
  convergedAt?: number;
  register: number;
  cells: EsqCell[];
}

interface EsqFeedbackItem {
  id: string;
  kind: "FAMILY" | "CONTRIBUTOR" | "GENERAL";
  ref: string;
  label: string;
  significance?: ImportanceLevel;
  reason?: string;
  insights: string[];
  recommendations: string[];
  owner?: string;
  response?: EsqHandoffResponse;
}

interface EsqCreatedValue {
  key: string;
  item: string;
  value?: number;
  expression?: UncertainExpression;
  where: string;
  source: string;
}

interface EsqHandoffView {
  model: EsqModel;
  work: EsqHandoffWork;
  families: EsqHandoffFamilyRow[];
  run?: EsqSolveRun;
  runStale: boolean;
  importanceCurrent: boolean;
  uncertaintyCurrent: boolean;
  published: boolean;
  publishedStale: boolean;
  inputs: string;
  feedback: EsqFeedbackItem[];
  created: EsqCreatedValue[];
  findings: EsqHandoffFinding[];
}

interface EsqPublishInput {
  upstream: EsqUpstream;
  daCases: readonly EsqDaCaseOption[];
  importance?: EsqImportanceRunResult;
  summary?: EsqModelRunResult;
  at: string;
  revision: number;
}

const FINDING_RANK: Record<EsqFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const RESPONSE_LABELS: Record<EsqResponseStatus, string> = { PENDING: "Pending", IN_PROGRESS: "In progress", COMPLETED: "Completed" };

const OWNER_ELEMENTS = ["SY", "DA", "HR", "IE", "ES", "POS", "SC", "MS"];

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function handoffWorkOf(esq: EventSequenceQuantification): EsqHandoffWork {
  return esq.handoffWork ?? {};
}

function withHandoffWork(esq: EventSequenceQuantification, fn: (work: EsqHandoffWork) => EsqHandoffWork): EventSequenceQuantification {
  return { ...esq, handoffWork: fn(handoffWorkOf(esq)) };
}

function figures(value: number): string {
  if (!Number.isFinite(value) || value === 0) return String(value);
  const [mantissa, exponent] = value.toExponential(2).split("e");
  const power = Number(exponent);
  const digits = String(Number(mantissa));
  return power === 0 ? digits : `${digits}E${power}`;
}

function handoffInputsKey(esq: EventSequenceQuantification): string {
  const text = JSON.stringify([
    solveInputsKey(esq),
    solveWorkOf(esq).families,
    solveWorkOf(esq).run?.runId ?? null,
    esq.review ?? null,
    esq.uncertaintyWork ?? null,
    esq.sensitivityWork ?? null,
  ]);
  return `${hash32(text, 2166136261).toString(16).padStart(8, "0")}${hash32(text, 374761393).toString(16).padStart(8, "0")}`;
}

function currentUncertainty(esq: EventSequenceQuantification): EsqUncertaintyRecord | undefined {
  const run = uncertaintyWorkOf(esq).run;
  return run !== undefined && run.inputs === uncertaintyInputsKey(esq) && run.correlation === "SHARED" ? run : undefined;
}

function entityName(esq: EventSequenceQuantification, target: EsqImportanceTarget): string {
  if (target.kind !== "EVENT") return target.label;
  const eventId = target.id.slice("EVENT:".length);
  const event = esq.model?.events.find((candidate) => candidate.id === eventId);
  if (event === undefined) return target.label;
  return blank(event.name) ? event.code : `${event.name} (${event.code})`;
}

function heldByHuman(esq: EventSequenceQuantification, target: EsqImportanceTarget): boolean {
  if (target.role === "RECOVERY" || target.role === "JOINT" || target.role === "INDEPENDENT_PART") return true;
  const eventId = target.id.slice("EVENT:".length);
  const binding = esq.modelDecisions?.valueBindings?.find((entry) => entry.eventId === eventId);
  const record = esq.model?.events.find((event) => event.id === eventId);
  return (binding?.heldBy ?? record?.heldBy) === "HRA";
}

function contributorTypeOf(esq: EventSequenceQuantification, target: EsqImportanceTarget): string | undefined {
  switch (target.kind) {
    case "CCF_GROUP": return "CCF";
    case "HFE": return "HUMAN_FAILURE_EVENT";
    case "PARAMETER":
    case "SYSTEM": return undefined;
    case "EVENT":
      if (target.role === "CCF_TERM") return undefined;
      if (target.role === "SPLIT") return target.ref?.startsWith("CELL:") === true ? "BARRIER_FAILURE_MODE" : undefined;
      if (heldByHuman(esq, target)) return target.role === "INDEPENDENT_PART" ? undefined : "HUMAN_FAILURE_EVENT";
      return "EQUIPMENT_FAILURE";
  }
}

function entityTypeOf(esq: EventSequenceQuantification, target: EsqImportanceTarget): ImportanceMeasureEntry["entityType"] {
  switch (target.kind) {
    case "CCF_GROUP": return "CCF_GROUP";
    case "HFE": return "HUMAN_FAILURE_EVENT";
    case "SYSTEM": return "SYSTEM";
    case "PARAMETER": return "COMPONENT";
    case "EVENT": return heldByHuman(esq, target) ? "HUMAN_FAILURE_EVENT" : "BASIC_EVENT";
  }
}

function measureEntry(esq: EventSequenceQuantification, row: EsqMeasureRow): ImportanceMeasureEntry {
  const target = row.target;
  const entry: ImportanceMeasureEntry = {
    entityType: entityTypeOf(esq, target),
    entityRef: entityName(esq, target),
    fussellVesely: row.fussellVesely,
    riskAchievementWorth: row.riskAchievementWorth,
    birnbaum: row.birnbaum,
  };
  if (Number.isFinite(row.riskReductionWorth)) entry.riskReductionWorth = row.riskReductionWorth;
  if (target.kind === "PARAMETER" && target.ref !== null) entry.dataAnalysisParameterRef = target.ref;
  if (target.kind === "CCF_GROUP" && target.ref !== null) {
    const estimate = esq.model?.ccfGroups.find((group) => group.id === target.ref)?.estimateRef;
    if (estimate !== undefined) entry.dataAnalysisParameterRef = estimate;
  }
  if (target.kind === "SYSTEM" && target.ref !== null) entry.systemRef = target.ref;
  if (target.kind === "HFE" && target.ref !== null) entry.humanFailureEventRef = target.ref;
  return entry;
}

function importanceAnalysesOf(esq: EventSequenceQuantification, result: EsqImportanceRunResult, releaseIds: readonly string[], thresholds: ReturnType<typeof thresholdsOf>): ImportanceAnalysisRecord[] {
  const overall: ImportanceAnalysisRecord = {
    uuid: "IA-OVERALL",
    scope: "OVERALL",
    measures: measureRows(result, releaseIds, thresholds).filter((row) => row.target.role !== "CCF_TERM").map((row) => measureEntry(esq, row)),
    significanceCutoff: thresholds.fussellVesely,
    implementsSrs: [{ sr: "ESQ-D6", hlr: "D" }, { sr: "ESQ-F2", hlr: "F" }],
  };
  const perFamily = releaseIds.flatMap((familyId): ImportanceAnalysisRecord[] => {
    const rows = measureRows(result, [familyId], thresholds).filter((row) => row.significant && row.target.role !== "CCF_TERM");
    if (rows.length === 0) return [];
    return [{ uuid: `IA-${familyId}`, scope: "PER_FAMILY", familyRef: familyId, measures: rows.map((row) => measureEntry(esq, row)), significanceCutoff: thresholds.fussellVesely, implementsSrs: [{ sr: "ESQ-D6", hlr: "D" }] }];
  });
  return [overall, ...perFamily];
}

function contributorKind(esq: EventSequenceQuantification, target: EsqImportanceTarget): RiskSignificantContributorType {
  if (target.kind === "CCF_GROUP") return RiskSignificantContributorType.CCF;
  if (target.kind === "HFE") return RiskSignificantContributorType.HUMAN_FAILURE_EVENT;
  if (target.kind === "EVENT" && target.role === "SPLIT" && target.ref?.startsWith("CELL:") === true) return RiskSignificantContributorType.BARRIER_FAILURE_MODE;
  if (target.kind === "EVENT" && heldByHuman(esq, target)) return RiskSignificantContributorType.HUMAN_FAILURE_EVENT;
  return RiskSignificantContributorType.EQUIPMENT_FAILURE;
}

function significantContributorsOf(esq: EventSequenceQuantification, result: EsqImportanceRunResult, releaseIds: readonly string[], thresholds: ReturnType<typeof thresholdsOf>): RiskSignificantContributor[] {
  const total = measureRows(result, releaseIds, thresholds);
  const notes = new Map((reviewOf(esq).reconciliations ?? []).map((entry) => [entry.targetId, entry.note]));
  const basis = `FV above ${figures(thresholds.fussellVesely)} or RAW above ${figures(thresholds.riskAchievementWorth)}, from ${thresholds.source}.`;
  return total.flatMap((row): RiskSignificantContributor[] => {
    if (row.target.role === "CCF_TERM") return [];
    const families = releaseIds.filter((familyId) => measureRows(result, [familyId], thresholds).some((entry) => entry.target.id === row.target.id && entry.significant));
    if (!row.significant && families.length === 0) return [];
    return [{
      uuid: `RSC-${row.target.id}`,
      contributorType: contributorKind(esq, row.target),
      entityRef: entityName(esq, row.target),
      applicableFamilyRefs: families,
      fractionalContribution: row.fussellVesely,
      riskSignificanceCriteriaBasis: basis,
      basis: notes.get(row.target.id) ?? `FV ${figures(row.fussellVesely)} and RAW ${figures(row.riskAchievementWorth)} over the release families.`,
      implementsSrs: [{ sr: "ESQ-D6", hlr: "D" }, { sr: "ESQ-F2", hlr: "F" }],
    }];
  });
}

function breakdownOf(esq: EventSequenceQuantification, familyId: string, input: EsqPublishInput): EventSequenceFamilyQuantification["contributionBreakdown"] {
  const rows = contributorRows({
    esq,
    familyIds: [familyId],
    ...(input.summary === undefined ? {} : { summary: input.summary }),
  });
  const partition = rows.flatMap((row) => {
    const type = row.kind === "STATE" ? "PLANT_OPERATING_STATE" : row.kind === "INITIATOR" ? "INITIATING_EVENT" : row.kind === "SEQUENCE" ? "EVENT_SEQUENCE" : undefined;
    return type === undefined || !(row.fraction > 0) ? [] : [{ contributorRef: row.label, contributorType: type, fractionalContribution: row.fraction }];
  });
  const result = input.importance;
  if (result === undefined) return partition;
  const events = measureRows(result, [familyId], { fussellVesely: 1, riskAchievementWorth: Number.POSITIVE_INFINITY }).flatMap((row) => {
    const type = contributorTypeOf(esq, row.target);
    return type === undefined || !(row.fussellVesely > 0) ? [] : [{ contributorRef: entityName(esq, row.target), contributorType: type, fractionalContribution: row.fussellVesely }];
  });
  return [...partition, ...events];
}

function familyQuantificationsOf(esq: EventSequenceQuantification, input: EsqPublishInput, register: readonly EsqRegisterEntry[]): EventSequenceFamilyQuantification[] {
  const families = modelViewOf(esq)?.families ?? [];
  const uncertainty = currentUncertainty(esq);
  const categoryTwo = esq.capabilityCategory !== "CC-I";
  const refOf = (quantification: EventSequenceFamilyQuantification): string => quantification.eventSequenceFamilyReference?.entityId ?? quantification.eventSequenceFamilyRef;
  return families.flatMap((family): EventSequenceFamilyQuantification[] => {
    const solve = solveWorkOf(esq).families.find((entry) => entry.familyId === family.id);
    const value = familyValueOf(solve);
    if (value === undefined) return [];
    const prior = esq.familyQuantifications.find((quantification) => refOf(quantification) === family.id);
    const stats = uncertainty?.families.find((entry) => entry.familyId === family.id);
    const useMean = categoryTwo && stats !== undefined;
    const record: EventSequenceFamilyQuantification = {
      uuid: `EFQ-${family.id}`,
      name: blank(family.name) ? family.id : family.name,
      eventSequenceFamilyRef: family.id,
      dependenciesConsideredInGrouping: prior?.dependenciesConsideredInGrouping ?? true,
      quantificationBasis: useMean ? "MEAN_PROPAGATED_SOKC" : "POINT_ESTIMATE",
      meanFrequency: useMean && stats !== undefined ? stats.mean : value,
      implementsSrs: [{ sr: "ESQ-A4", hlr: "A" }, { sr: "ESQ-A5", hlr: "A" }, { sr: "ESQ-E2", hlr: "E" }, { sr: "ESQ-F1", hlr: "F" }],
    };
    if (stats !== undefined) {
      record.percentile05 = stats.p05;
      record.percentile50 = stats.p50;
      record.percentile95 = stats.p95;
    }
    const sources = register.filter((entry) => (entry.decision?.key ?? entry.upstreamKey) && (entry.decision?.familyIds ?? []).includes(family.id)).map((entry) => entry.text);
    if (sources.length > 0) record.significantUncertaintySources = sources;
    const breakdown = breakdownOf(esq, family.id, input);
    if (breakdown !== undefined && breakdown.length > 0) record.contributionBreakdown = breakdown;
    if (prior?.eventSequenceFamilyReference !== undefined) record.eventSequenceFamilyReference = prior.eventSequenceFamilyReference;
    if (prior?.crossSourceGroupingJustification !== undefined) record.crossSourceGroupingJustification = prior.crossSourceGroupingJustification;
    if (prior?.crossPosGroupingJustification !== undefined) record.crossPosGroupingJustification = prior.crossPosGroupingJustification;
    if (prior?.representativeSequenceSelectionBasis !== undefined) record.representativeSequenceSelectionBasis = prior.representativeSequenceSelectionBasis;
    return [record];
  });
}

function assessmentsOf(register: readonly EsqRegisterEntry[], familyName: (id: string) => string): ModelUncertaintySourceAssessment[] {
  return register.map((entry) => {
    const decision = entry.decision;
    const families = (decision?.familyIds ?? []).map(familyName);
    const effect = entry.daRef !== undefined
      ? entry.impact
      : [entry.impact.trim(), families.length === 0 ? "" : `Could move ${families.join(", ")}.`, blank(decision?.reason) ? "" : decision?.reason?.trim() ?? ""].filter((part) => part.length > 0).join(" ");
    const assessment: ModelUncertaintySourceAssessment = {
      uuid: `MU-${entry.id}`,
      sourceElementCode: entry.origin,
      uncertaintySource: entry.text,
      relatedAssumptions: entry.kind === "ASSUMPTION" ? [entry.text] : [],
      evaluationType: (decision?.caseIds.length ?? 0) > 0 ? "QUANTITATIVE" : "QUALITATIVE",
      evaluationScope: "INDIVIDUAL",
      effectOnFamilyFrequencies: effect,
      implementsSrs: [{ sr: "ESQ-E1", hlr: "E" }, { sr: "ESQ-F3", hlr: "F" }],
    };
    if (entry.daRef !== undefined) assessment.dataAnalysisSourceRef = { ...entry.daRef };
    return assessment;
  });
}

function caseResultText(values: readonly { familyId: string; annualFrequency: number }[], base: ReadonlyMap<string, number>, releaseIds: readonly string[]): string {
  const total = releaseIds.reduce((sum, id) => sum + (values.find((entry) => entry.familyId === id)?.annualFrequency ?? 0), 0);
  const baseTotal = releaseIds.reduce((sum, id) => sum + (base.get(id) ?? 0), 0);
  const ratio = baseTotal > 0 ? ` (${String(Number((total / baseTotal).toPrecision(3)))} times the base)` : "";
  return `Release total ${figures(total)} per year${ratio}.`;
}

function studiesOf(esq: EventSequenceQuantification, upstream: EsqUpstream, daCases: readonly EsqDaCaseOption[]): SensitivityStudy[] {
  const view = sensitivityViewOf(esq, upstream);
  if (view === undefined) return [];
  const studies: SensitivityStudy[] = [];
  const byDa = new Map<string, typeof view.cases>();
  for (const entry of view.cases) {
    const ref = entry.entry.daCaseRef;
    if (ref === undefined) {
      const run = entry.entry.run;
      studies.push({
        uuid: entry.entry.id,
        name: entry.entry.name,
        description: entry.entry.basis,
        variedParameters: entry.entry.target === undefined ? [] : [entry.entry.target],
        parameterRanges: {},
        ...(run === undefined ? {} : { results: caseResultText(run.families, view.base, view.releaseIds) }),
        implementsSrs: [{ sr: "ESQ-E1", hlr: "E" }, { sr: "ESQ-F3", hlr: "F" }],
      });
      continue;
    }
    const key = JSON.stringify([ref.workbookId, ref.caseId]);
    byDa.set(key, [...(byDa.get(key) ?? []), entry]);
  }
  for (const entries of byDa.values()) {
    const first = entries[0];
    const ref = first?.entry.daCaseRef;
    if (first === undefined || ref === undefined) continue;
    const option = daCases.find((candidate) => candidate.workbookId === ref.workbookId && candidate.item.id === ref.caseId);
    const target = option?.item.parameterId ?? option?.item.estimateId ?? option?.item.id ?? first.entry.target ?? ref.caseId;
    const ranges: Record<string, [number, number]> = option?.low !== undefined && option.high !== undefined ? { [target]: [option.low, option.high] } : {};
    const results = entries.flatMap((entry) => (entry.entry.run === undefined ? [] : [`${entry.entry.name}: ${caseResultText(entry.entry.run.families, view.base, view.releaseIds)}`]));
    studies.push({
      uuid: `DA-${ref.caseId}`,
      name: option?.item.name ?? first.entry.name,
      description: option?.item.reason ?? first.entry.basis,
      variedParameters: [target],
      parameterRanges: ranges,
      ...(results.length === 0 ? {} : { results: results.join(" ") }),
      dataAnalysisCaseRef: { workbookId: ref.workbookId, caseId: ref.caseId },
      implementsSrs: [{ sr: "ESQ-E1", hlr: "E" }, { sr: "ESQ-F3", hlr: "F" }],
    });
  }
  return studies;
}

function preOperationalOf(esq: EventSequenceQuantification, upstream: EsqUpstream): PreOperationalAssumption[] {
  const view = sensitivityViewOf(esq, upstream);
  if (view === undefined) return [];
  const caseRatio = new Map(view.results.map((row) => [row.caseId, row.total !== undefined && view.baseTotal > 0 ? row.total / view.baseTotal : undefined]));
  return view.preOperational.map((entry) => {
    const decision = entry.decision;
    const ratios = (decision?.caseIds ?? []).flatMap((caseId) => {
      const ratio = caseRatio.get(caseId);
      return ratio === undefined ? [] : [Math.max(ratio, 1 / ratio)];
    });
    const largest = ratios.length === 0 ? undefined : Math.max(...ratios);
    const riskImpact = largest === undefined ? entry.riskImpact ?? ImportanceLevel.MEDIUM : largest >= 2 ? ImportanceLevel.HIGH : largest >= 1.1 ? ImportanceLevel.MEDIUM : ImportanceLevel.LOW;
    const closure = blank(decision?.closure) ? entry.closure : decision?.closure ?? "";
    return {
      uuid: `PA-${entry.id}`,
      assumptionId: entry.id,
      description: entry.text,
      status: decision?.status ?? entry.upstreamStatus ?? "OPEN",
      limitations: blank(entry.limitation) ? [] : [entry.limitation],
      influenceOnDefinition: `${entry.origin} assumption carried into the family frequencies.`,
      riskImpact,
      closureBasis: closure,
      plannedClosureActions: blank(entry.closure) ? [] : [entry.closure],
      affectedElementIds: decision?.caseIds ?? [],
      affectedTechnicalElementCodes: [entry.origin],
      isPreOperational: true,
      implementsSrs: [{ sr: "ESQ-C17", hlr: "C" }, { sr: "ESQ-F5", hlr: "F" }],
    };
  });
}

function propagationOf(esq: EventSequenceQuantification, independentMean: number | undefined): UncertaintyPropagation {
  const prior = esq.uncertaintyPropagation;
  const run = currentUncertainty(esq);
  const model = esq.model;
  const shared = new Map<string, number>();
  for (const event of model?.events ?? []) {
    const binding = esq.modelDecisions?.valueBindings?.find((entry) => entry.eventId === event.id);
    const holder = binding?.holderId ?? event.holderId;
    if ((binding?.heldBy ?? event.heldBy) === "DA" && holder !== undefined) shared.set(holder, (shared.get(holder) ?? 0) + 1);
  }
  const parameterUncertainties = (model?.parameters ?? []).flatMap((parameter): UncertaintyPropagation["parameterUncertainties"] => {
    const basis = `DA parameter ${parameter.name}, sampled once per trial for every event bound to it.`;
    if (holdsEstimate(parameter.quantificationModel)) {
      const estimate = parameter.estimate;
      return estimate === undefined || !hasUncertainty(estimate) ? [] : [{ parameterRef: parameter.id, estimate, basis }];
    }
    const distribution = parameter.distribution;
    return distribution === undefined ? [] : [{ parameterRef: parameter.id, distribution, basis }];
  });
  const total = run?.total;
  const propagation: UncertaintyPropagation = {
    uuid: prior.uuid,
    propagationMethod: run?.method ?? prior.propagationMethod,
    modelUncertainties: prior.modelUncertainties,
    characterizationLevel: run !== undefined && esq.capabilityCategory !== "CC-I" ? "PROPAGATED_RISK_SIGNIFICANT_SOKC" : "CHARACTERIZED",
    parameterUncertainties,
    stateOfKnowledgeCorrelation: run === undefined
      ? { isConsidered: false, justificationIfNotConsidered: "No current sampling run with shared draws." }
      : {
        isConsidered: true,
        handlingMethod: "PARAMETER_GROUPING",
        handlingDescription: "PRAXIS draws each DA parameter once per trial and gives that draw to every basic event bound to it. Common cause terms scale with their group total, which follows the members' shared estimate.",
        correlatedParameterGroups: [...shared.entries()].filter(([, count]) => count > 1).map(([parameterId]) => [parameterId]),
        ...(total === undefined ? {} : { impactAssessment: independentMean === undefined ? `The release total mean is ${figures(total.mean)} per year with shared draws.` : `The release total mean is ${figures(total.mean)} per year with shared draws and ${figures(independentMean)} with independent draws.` }),
      },
    implementsSrs: [{ sr: "ESQ-A5", hlr: "A" }, { sr: "ESQ-E2", hlr: "E" }],
  };
  if (run !== undefined) {
    propagation.numberOfSamples = run.trials;
    propagation.randomSeed = run.seed;
  }
  return propagation;
}

function reviewRecordsOf(esq: EventSequenceQuantification): Pick<EventSequenceQuantification, "cutsetLogicReviews" | "nonSignificantSampleReviews" | "consistencyReviews" | "ruleLogicReviews" | "similarPlantComparisons"> {
  const review = reviewOf(esq);
  const codes = new Map((esq.model?.events ?? []).map((event) => [event.id, event.code]));
  const sample = (familyId: string, eventIds: readonly string[], frequency: number): string => `${familyId} · ${eventIds.map((id) => codes.get(id) ?? id).join(" · ")} · ${figures(frequency)} per year`;
  const reviewed = (review.cutSetReviews ?? []).filter((entry) => entry.verdict !== undefined);
  const cutsetLogicReviews: CutsetLogicReviewRecord[] = reviewed.filter((entry) => entry.significant).map((entry, index) => ({
    uuid: `CLR-${index + 1}`,
    sampleDescription: sample(entry.familyId, entry.eventIds, entry.annualFrequency),
    logicCorrect: entry.verdict === "CORRECT",
    findings: entry.note,
    implementsSrs: [{ sr: "ESQ-D1", hlr: "D" }],
  }));
  const nonSignificantSampleReviews: NonSignificantSampleReview[] = reviewed.filter((entry) => !entry.significant).map((entry, index) => ({
    uuid: `NSR-${index + 1}`,
    sampleDescription: sample(entry.familyId, entry.eventIds, entry.annualFrequency),
    physicallyMeaningful: entry.verdict === "CORRECT",
    findings: entry.note,
    implementsSrs: [{ sr: "ESQ-D5", hlr: "D" }],
  }));
  const topic = (key: "SYSTEMS" | "SUCCESS_CRITERIA" | "PROCEDURES" | "RULES") => review.consistency?.find((entry) => entry.topic === key);
  const notes = (keys: ("SYSTEMS" | "SUCCESS_CRITERIA" | "PROCEDURES")[]): string => keys.flatMap((key) => {
    const entry = topic(key);
    return entry === undefined || blank(entry.note) ? [] : [`${CONSISTENCY_LABELS[key]}: ${entry.note.trim()}`];
  }).join(" ");
  const consistencyReviews: ConsistencyReviewRecord[] = review.consistency === undefined ? esq.consistencyReviews : [{
    uuid: "CR-1",
    modelingConsistencyConfirmed: topic("SYSTEMS")?.consistent === true && topic("SUCCESS_CRITERIA")?.consistent === true,
    modelingFindings: notes(["SYSTEMS", "SUCCESS_CRITERIA"]),
    operationalConsistencyConfirmed: topic("PROCEDURES")?.consistent === true,
    operationalFindings: notes(["PROCEDURES"]),
    implementsSrs: [{ sr: "ESQ-D2", hlr: "D" }],
  }];
  const rules = topic("RULES");
  const ruleLogicReviews: RuleLogicReviewRecord[] = rules === undefined ? esq.ruleLogicReviews : [{
    uuid: "RLR-1",
    flagSettingsReviewed: rules.consistent !== undefined,
    mutuallyExclusiveRulesReviewed: rules.consistent !== undefined,
    recoveryRulesReviewed: rules.consistent !== undefined,
    logicalResultsConfirmed: rules.consistent === true,
    findings: rules.note,
    implementsSrs: [{ sr: "ESQ-D3", hlr: "D" }],
  }];
  const comparison = review.comparison;
  const similarPlantComparisons: SimilarPlantComparison[] = comparison === undefined || !comparison.possible ? [] : [{
    uuid: "SPC-1",
    comparisonPlants: comparison.plants.map((plant) => (blank(plant.name) ? plant.id : plant.name)),
    keyDifferences: comparison.plants.map((plant) => plant.note),
    implementsSrs: [{ sr: "ESQ-D4", hlr: "D" }],
  }];
  return { cutsetLogicReviews, nonSignificantSampleReviews, consistencyReviews, ruleLogicReviews, similarPlantComparisons };
}

function feedbackItems(esq: EventSequenceQuantification, ri: RiskIntegration | undefined): EsqFeedbackItem[] {
  const dispatch = ri?.riskIntegrationFeedbackDispatch?.eventSequenceQuantificationFeedback;
  const responses = new Map((handoffWorkOf(esq).responses ?? []).map((entry) => [entry.id, entry]));
  const significant = esq.review?.importance?.significant ?? [];
  const ownerOf = (name: string): string | undefined => {
    const target = significant.find((entry) => entry.label === name || name.includes(entry.label));
    if (target === undefined) return undefined;
    if (target.kind === "PARAMETER") return "DA";
    if (target.kind === "HFE") return "HR";
    return "SY";
  };
  const items: EsqFeedbackItem[] = [];
  const names = new Map((esq.model?.families ?? []).map((family) => [family.id, family.name]));
  for (const entry of dispatch?.familyFeedback ?? []) {
    const id = `FAMILY:${entry.familyRef}`;
    const item: EsqFeedbackItem = { id, kind: "FAMILY", ref: entry.familyRef, label: blank(names.get(entry.familyRef)) ? entry.familyRef : `${entry.familyRef} · ${names.get(entry.familyRef) ?? ""}`, insights: entry.insights ?? [], recommendations: entry.recommendations ?? [] };
    if (entry.riskSignificance !== undefined) item.significance = entry.riskSignificance;
    if (!blank(entry.significanceReason)) item.reason = entry.significanceReason;
    const response = responses.get(id);
    if (response !== undefined) item.response = response;
    items.push(item);
  }
  for (const entry of dispatch?.contributorFeedback ?? []) {
    const id = `CONTRIBUTOR:${entry.entityRef}`;
    const item: EsqFeedbackItem = { id, kind: "CONTRIBUTOR", ref: entry.entityRef, label: entry.entityRef, insights: entry.insights ?? [], recommendations: entry.recommendations ?? [] };
    if (entry.riskSignificance !== undefined) item.significance = entry.riskSignificance;
    if (!blank(entry.significanceReason)) item.reason = entry.significanceReason;
    const owner = ownerOf(entry.entityRef);
    if (owner !== undefined) item.owner = owner;
    const response = responses.get(id);
    if (response !== undefined) item.response = response;
    items.push(item);
  }
  if (!blank(dispatch?.generalFeedback)) {
    const item: EsqFeedbackItem = { id: "GENERAL", kind: "GENERAL", ref: "GENERAL", label: "General feedback", reason: dispatch?.generalFeedback, insights: [], recommendations: [] };
    const response = responses.get("GENERAL");
    if (response !== undefined) item.response = response;
    items.push(item);
  }
  return items;
}

function riFeedbackOf(esq: EventSequenceQuantification, ri: RiskIntegration | undefined): RiskIntegrationFeedback | undefined {
  const riId = esq.linkedWorkbooks?.RI;
  const items = feedbackItems(esq, ri);
  if (riId === undefined || items.length === 0) return esq.riskIntegrationFeedback;
  const responded = items.filter((item) => item.response !== undefined && !blank(item.response.response));
  const statuses = items.map((item) => item.response?.status ?? "PENDING");
  const status: EsqResponseStatus = statuses.every((entry) => entry === "COMPLETED") ? "COMPLETED" : statuses.some((entry) => entry !== "PENDING") ? "IN_PROGRESS" : "PENDING";
  const contributors = items.filter((item) => item.kind === "CONTRIBUTOR").map((item) => `${item.label}${item.significance === undefined ? "" : ` (${item.significance.toLowerCase()})`}${item.reason === undefined ? "" : `: ${item.reason}`}`);
  const general = items.find((item) => item.kind === "GENERAL")?.reason;
  const feedback: RiskIntegrationFeedback = {
    analysisRef: riId,
    sequenceFeedback: items.filter((item) => item.kind === "FAMILY").map((item) => ({
      sequenceRef: item.ref,
      ...(item.significance === undefined ? {} : { riskSignificance: item.significance }),
      insights: item.insights,
      recommendations: item.recommendations,
    })),
    generalFeedback: [general ?? "", contributors.length === 0 ? "" : `Contributors: ${contributors.join("; ")}.`].filter((part) => part.length > 0).join(" "),
    response: {
      description: responded.map((item) => `${item.label}: ${item.response?.response.trim() ?? ""}`).join(" "),
      changes: responded.flatMap((item) => (item.response?.sentTo === undefined ? [] : [`${item.label} sent to ${item.response.sentTo}`])),
      status,
    },
  };
  const dispatchDate = ri?.riskIntegrationFeedbackDispatch?.dispatchDate;
  if (dispatchDate !== undefined) feedback.feedbackDate = dispatchDate;
  return feedback;
}

function screenedAssessmentOf(esq: EventSequenceQuantification, upstream: EsqUpstream): EventSequenceQuantification["screenedEventCumulativeAssessment"] {
  const view = resultsViewOf(esq, upstream.ri, upstream.ie);
  if (view === undefined || view.screened.length === 0) return esq.screenedEventCumulativeAssessment;
  const share = view.total > 0 ? view.screenedTotal / view.total : undefined;
  const failing = view.screened.filter((row) => row.scr1 === false && row.scr2 === false);
  return {
    screenedInitiatingEventRefs: view.screened.map((row) => row.groupId),
    cumulativeImpactAssessment: `The screened initiators together bound ${figures(view.screenedTotal)} per year${share === undefined ? "" : `, ${String(Number((100 * share).toPrecision(3)))}% of the release total`}.`,
    affectsRiskSignificantContributors: failing.length > 0 || (share !== undefined && share > 0.05),
    basis: view.screened.map((row) => `${row.name}: ${row.bound?.basis ?? "no bound"}`).join(" "),
    implementsSrs: [{ sr: "ESQ-D8", hlr: "D" }],
  };
}

function publishEsq(esq: EventSequenceQuantification, input: EsqPublishInput): EventSequenceQuantification {
  const families = modelViewOf(esq)?.families ?? [];
  const releaseIds = releaseFamilyIds(families);
  const thresholds = thresholdsOf(esq, input.upstream.ri);
  const sensitivity = sensitivityViewOf(esq, input.upstream);
  const register = sensitivity?.register ?? [];
  const names = new Map(families.map((family) => [family.id, family.name]));
  const familyName = (id: string): string => (blank(names.get(id)) ? id : `${names.get(id) ?? ""} (${id})`);
  const independent = uncertaintyWorkOf(esq).independent;
  const familyQuantifications = familyQuantificationsOf(esq, input, register);
  const notes = reviewOf(esq).reconciliations ?? [];
  const importance = input.importance;
  const importanceReviews: ImportanceReviewRecord[] = importance === undefined ? esq.importanceReviews ?? [] : [{
    uuid: "IR-1",
    scope: "Release families",
    riCriteriaBasis: `FV above ${figures(thresholds.fussellVesely)} or RAW above ${figures(thresholds.riskAchievementWorth)}, from ${thresholds.source}.`,
    consistentWithExpectations: notes.length === 0,
    unexpectedResults: notes.map((entry) => {
      const target = importance.targets.find((candidate) => candidate.id === entry.targetId);
      return { entityRef: target === undefined ? entry.targetId : entityName(esq, target), description: "Noted in the importance review.", reconciliation: entry.note };
    }),
    implementsSrs: [{ sr: "ESQ-D7", hlr: "D" }],
  }];
  const comparison = reviewOf(esq).comparison;
  const feedback = riFeedbackOf(esq, input.upstream.ri);
  const screened = screenedAssessmentOf(esq, input.upstream);
  const next: EventSequenceQuantification = {
    ...esq,
    ...reviewRecordsOf(esq),
    familyQuantifications: [
      ...esq.familyQuantifications.filter((quantification) => !familyQuantifications.some((record) => record.eventSequenceFamilyRef === (quantification.eventSequenceFamilyReference?.entityId ?? quantification.eventSequenceFamilyRef))),
      ...familyQuantifications,
    ],
    riskSignificantContributors: importance === undefined ? esq.riskSignificantContributors : significantContributorsOf(esq, importance, releaseIds, thresholds),
    importanceAnalyses: importance === undefined ? esq.importanceAnalyses ?? [] : importanceAnalysesOf(esq, importance, releaseIds, thresholds),
    importanceReviews,
    modelUncertaintySourceAssessments: assessmentsOf(register, familyName),
    sensitivityStudies: studiesOf(esq, input.upstream, input.daCases),
    preOperationalAssumptions: preOperationalOf(esq, input.upstream),
    uncertaintyPropagation: propagationOf(esq, independent?.total?.mean),
    documentation: comparison !== undefined && !comparison.possible ? { ...esq.documentation, similarPlantComparison: comparison.reason } : esq.documentation,
  };
  if (feedback !== undefined) next.riskIntegrationFeedback = feedback;
  if (screened !== undefined) next.screenedEventCumulativeAssessment = screened;
  return withHandoffWork(next, (work) => ({
    ...work,
    published: {
      at: input.at,
      revision: input.revision,
      inputs: handoffInputsKey(esq),
      families: familyQuantifications.length,
      measures: next.importanceAnalyses?.reduce((sum, record) => sum + record.measures.length, 0) ?? 0,
    },
  }));
}

function withResponse(esq: EventSequenceQuantification, response: EsqHandoffResponse | undefined, id: string): EventSequenceQuantification {
  return withHandoffWork(esq, (work) => {
    const others = (work.responses ?? []).filter((entry) => entry.id !== id);
    return { ...work, responses: response === undefined ? others : [...others, response] };
  });
}

function createdValues(esq: EventSequenceQuantification): EsqCreatedValue[] {
  const model = esq.model;
  if (model === undefined) return [];
  const out: EsqCreatedValue[] = [];
  const legacyKeys = new Set(sampledInputsOf(esq).flatMap((input) => (input.contract ? [] : [input.key])));
  for (const spread of uncertaintyWorkOf(esq).spreads ?? []) {
    if (!legacyKeys.has(spread.key)) continue;
    out.push({ key: `spread:${spread.key}`, item: spread.key, value: spread.errorFactor, where: "Step 08 error factor", source: spread.source });
  }
  for (const choice of esq.modelDecisions?.initiatorChoices ?? []) {
    if (choice.source !== "TYPED" || choice.expression === undefined) continue;
    out.push({ key: `initiator:${choice.groupId}`, item: choice.groupId, expression: choice.expression, where: "Step 02 initiator frequency", source: choice.basis ?? "" });
  }
  for (const cell of esq.barrierWork?.cells ?? []) {
    if (cell.ofRecord !== "TYPED" || cell.typed === undefined) continue;
    out.push({ key: `cell:${cell.id}`, item: `Cell ${cell.id}`, expression: cell.typed.expression, where: "Step 04 split fraction", source: cell.typed.basis });
  }
  for (const combination of resolvedCombinations(esq)) {
    if (combination.source !== "TYPED" || combination.joint === undefined) continue;
    out.push({ key: `joint:${combination.combination.id}`, item: combination.combination.id, value: combination.joint, where: "Step 06 joint HEP", source: combination.combination.typed?.source ?? "" });
  }
  for (const recovery of resolvedRecoveries(esq)) {
    if (recovery.source !== "TYPED" || recovery.value === undefined) continue;
    out.push({ key: `recovery:${recovery.id}`, item: `NR-${recovery.id}`, value: recovery.value, where: "Step 06 non-recovery HEP", source: recovery.rule?.typed?.source ?? "" });
  }
  return out;
}

function handoffViewOf(esq: EventSequenceQuantification, upstream: EsqUpstream): EsqHandoffView | undefined {
  const modelView = modelViewOf(esq);
  if (modelView === undefined) return undefined;
  const work = handoffWorkOf(esq);
  const run = solveWorkOf(esq).run;
  const inputs = handoffInputsKey(esq);
  const uncertainty = currentUncertainty(esq);
  const stepPercent = esq.quantificationPlan?.convergenceStepPercent?.value ?? 5;
  const sensitivity = sensitivityViewOf(esq, upstream);
  const cells = esq.barrierWork?.cells ?? [];
  const families = modelView.families.map((family): EsqHandoffFamilyRow => {
    const solve = solveWorkOf(esq).families.find((entry) => entry.familyId === family.id);
    const value = familyValueOf(solve);
    const stats = uncertainty?.families.find((entry) => entry.familyId === family.id);
    const row: EsqHandoffFamilyRow = {
      family,
      sokc: stats !== undefined,
      register: (sensitivity?.register ?? []).filter((entry) => (entry.decision?.familyIds ?? []).includes(family.id)).length,
      cells: cells.filter((cell) => cell.familyId === family.id),
    };
    if (value !== undefined) row.value = value;
    if (solve?.ofRecord !== undefined) row.source = solve.ofRecord;
    if (stats !== undefined) {
      row.mean = stats.mean;
      row.p05 = stats.p05;
      row.p50 = stats.p50;
      row.p95 = stats.p95;
    }
    const sweep = solve?.run?.sweep ?? [];
    if (sweep.length > 0) {
      const convergedAt = convergenceOf(sweep, stepPercent).convergedAt;
      if (convergedAt !== undefined) row.convergedAt = convergedAt;
    }
    return row;
  });
  const record = esq.review?.importance;
  const partial: Omit<EsqHandoffView, "findings"> = {
    model: modelView.model,
    work,
    families,
    runStale: run !== undefined && run.inputs !== solveInputsKey(esq),
    importanceCurrent: record !== undefined && record.inputs === solveInputsKey(esq),
    uncertaintyCurrent: uncertainty !== undefined,
    published: work.published !== undefined,
    publishedStale: work.published !== undefined && work.published.inputs !== inputs,
    inputs,
    feedback: feedbackItems(esq, upstream.ri),
    created: createdValues(esq),
  };
  const full = run === undefined ? partial : { ...partial, run };
  const findings: EsqHandoffFinding[] = [];
  for (const row of families) {
    const needsValue = row.family.manual || row.family.members.length > 0;
    if (needsValue && row.value === undefined) findings.push({ severity: "error", check: "Family without a value of record", item: row.family.id, detail: "Give the family a value of record in Step 05 before it is handed off.", target: { kind: "esqSolveFamily", id: row.family.id } });
    if (row.family.manual) findings.push({ severity: "warning", check: "Family not keyed to ES", item: row.family.id, detail: "The family exists only in ESQ, so RI cannot key it to an ES family. Add it in ES." });
  }
  if (run === undefined) findings.push({ severity: "error", check: "No run of record", item: "Run of record", detail: "Run the model in Step 05 and use the run." });
  else if (full.runStale) findings.push({ severity: "error", check: "Value of record older than its inputs", item: "Run of record", detail: "The model, logic or values changed after the run of record. Run the model again in Step 05.", target: { kind: "esqSolveRun", id: "run" } });
  if (!full.importanceCurrent) findings.push({ severity: "warning", check: "Importance not current", item: "Importance", detail: "RI and DA receive no current importance. Rank again in Step 07." });
  if (!full.uncertaintyCurrent) findings.push({ severity: esq.capabilityCategory === "CC-I" ? "warning" : "error", check: "No current propagated mean", item: "Uncertainty", detail: "The families go out without a current sampled mean and percentiles. Sample again in Step 08." });
  if (!full.published) findings.push({ severity: "error", check: "Not published", item: "Hand-off", detail: "Publish the family package so RI, MS, DA, HR and IE read it." });
  else if (full.publishedStale) findings.push({ severity: "error", check: "Published package older than the workbook", item: "Hand-off", detail: "Results, reviews or cases changed after the last publication. Publish again." });
  for (const item of full.feedback) {
    const response = item.response;
    if (response === undefined || blank(response.response)) findings.push({ severity: "warning", check: "RI feedback with no response", item: item.label, detail: `${item.significance === undefined ? "" : `RI rates it ${item.significance.toLowerCase()}. `}Record the response and where it goes.`, target: { kind: "esqHandoffResponse", id: item.id } });
    else if (item.significance === ImportanceLevel.HIGH && item.kind === "CONTRIBUTOR" && response.sentTo === undefined) findings.push({ severity: "note", check: "Significant item not routed", item: item.label, detail: "Send it to the element that owns it.", target: { kind: "esqHandoffResponse", id: item.id } });
  }
  if (cutSetRunIdOf(esq) === undefined && run !== undefined) findings.push({ severity: "note", check: "No cut sets behind the review", item: "Cut sets", detail: "Step 07 has no cut set list, so the published reviews hold no cut set." });
  return { ...full, findings: findings.sort((a, b) => FINDING_RANK[a.severity] - FINDING_RANK[b.severity]) };
}

function handoffComplete(esq: EventSequenceQuantification, upstream: EsqUpstream): boolean {
  const view = handoffViewOf(esq, upstream);
  return view !== undefined && view.published && !view.findings.some((finding) => finding.severity === "error");
}

export {
  OWNER_ELEMENTS,
  RESPONSE_LABELS,
  createdValues,
  feedbackItems,
  figures,
  handoffComplete,
  handoffInputsKey,
  handoffViewOf,
  handoffWorkOf,
  publishEsq,
  withResponse,
  type EsqCreatedValue,
  type EsqFeedbackItem,
  type EsqHandoffFamilyRow,
  type EsqHandoffFinding,
  type EsqHandoffView,
  type EsqHandoffWindowKind,
  type EsqPublishInput,
};
