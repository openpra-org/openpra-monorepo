import {
  type PlantOperatingState,
  type PlantOperatingStatesAnalysis,
  type ParameterRange,
  BarrierStatus,
} from "interfaces-mef-types/pos/plant-operating-states-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import {
  POS_STEPS,
  CONFORMANCE_ITEMS,
  PERSONA_STEPS,
  type ConformanceItem,
  type ConformanceStatus,
  type PosWorkflowStatus,
  type PosPersona,
  type PosStep,
} from "./posViewData";

type Stage = "pre_operational" | "operational";

interface RcsView {
  temp: string;
  press: string;
  power: string;
}

interface StateView {
  id: string;
  name: string;
  evolutionId: string;
  description: string;
  mode: string;
  rcs: RcsView;
  sources: string[];
  barriers: string[];
  duration: string;
  frequency: string;
  instrumentation: number;
  sscRequired: number;
  retained: boolean;
  status: PosWorkflowStatus;
  statusMessage?: string;
  docsLinked: number;
  hasPreopAssumption: boolean;
}

interface EvolutionView {
  id: string;
  name: string;
  type: string;
  description: string;
  statesCount: number;
  durationFraction: number;
  fromDoc: string;
}

interface GroupView {
  id: string;
  name: string;
  members: string[];
  rationale: string;
  boundingCharacteristic: string;
  durationSum: string;
  status: "ok" | "warn";
  statusMessage?: string;
  hasPreopAssumption: boolean;
}

interface InterviewView {
  id: string;
  date: string;
  evolutionId: string | null;
  method: string;
  personnel: string[];
  findings: string;
  overlooked: number;
}

interface ScreeningView {
  id: string;
  posId: string;
  retained: boolean;
  criterion: string | null;
  justification: string;
  riskImpact: string;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function formatRange(r: ParameterRange): string {
  const units = r.units ?? "";
  const suffix = units === "%" ? " %" : units === "" ? "" : ` ${units}`;
  if (r.min === r.max) return `${r.min}${suffix}`;
  return `${r.min}–${r.max}${suffix}`;
}

function formatDuration(hours: number): string {
  return `${formatNumber(hours)} h/yr`;
}

function formatFrequency(perYear: number): string {
  if (perYear === 0) return "—";
  return `${perYear}/yr`;
}

function barrierLabels(state: PlantOperatingState): string[] {
  return state.radionuclideTransportBarriers.map((b) => (b.status === undefined ? `${b.name} ?` : `${b.name} ${b.status}`));
}

function isBarrierBroken(label: string): boolean {
  const broken = [
    ` ${BarrierStatus.OPEN}`,
    ` ${BarrierStatus.DEINERTED}`,
    ` ${BarrierStatus.DRAINED}`,
    ` ${BarrierStatus.BYPASSED}`,
    ` ${BarrierStatus.BREACHED}`,
    " ?",
  ];
  return broken.some((suffix) => label.endsWith(suffix));
}

function deriveStateStatus(s: PlantOperatingState): PosWorkflowStatus {
  const hasBarriers = s.radionuclideTransportBarriers.length > 0;
  const hasUnknownBarrier = s.radionuclideTransportBarriers.some((b) => b.status === undefined);
  const hasDuration = s.meanDurationHours > 0;
  const freqVal = typeof s.meanEntryFrequency === "number" ? s.meanEntryFrequency : s.meanEntryFrequency.value;
  const hasFrequency = freqVal > 0;
  if (!hasBarriers || !hasDuration || !hasFrequency) return "draft";
  if (hasUnknownBarrier) return "warn";
  return "ok";
}

function statesView(pos: PlantOperatingStatesAnalysis): StateView[] {
  const screenedOut = new Set(pos.screeningRecords.filter((r) => !r.retained).map((r) => r.posId));
  return pos.plantOperatingStates.map((s) => ({
    id: s.uuid,
    name: s.name,
    evolutionId: s.evolutionId,
    description: s.description,
    mode: s.operatingMode,
    rcs: {
      temp: formatRange(s.rcsParameters.reactorCoolantTemperature),
      press: formatRange(s.rcsParameters.coolantPressure),
      power: formatRange(s.rcsParameters.powerLevel),
    },
    sources: s.radioactiveMaterialSources.map((src) => src.name),
    barriers: barrierLabels(s),
    duration: `${formatDuration(s.meanDurationHours)} (mean)`,
    frequency: formatFrequency(typeof s.meanEntryFrequency === "number" ? s.meanEntryFrequency : s.meanEntryFrequency.value),
    instrumentation: s.availableInstrumentation.length,
    sscRequired: s.sscOperationalCharacteristics.length,
    retained: !screenedOut.has(s.uuid),
    status: s.uiStatus ?? deriveStateStatus(s),
    statusMessage: s.uiStatusMessage,
    docsLinked: s.docsLinked ?? 0,
    hasPreopAssumption: (s.preOperationalAssumptions ?? []).length > 0,
  }));
}

function evolutionsView(pos: PlantOperatingStatesAnalysis): EvolutionView[] {
  const stateById = new Map(pos.plantOperatingStates.map((s) => [s.uuid, s] as const));
  const cycleTotal = pos.plantOperatingStates.reduce((acc, s) => acc + s.meanDurationHours, 0);
  return pos.plantEvolutions.map((e) => {
    const sumHours = e.plantOperatingStateIds.reduce((acc, id) => acc + (stateById.get(id)?.meanDurationHours ?? 0), 0);
    const computedFraction = cycleTotal > 0 ? sumHours / cycleTotal : 0;
    return {
      id: e.uuid,
      name: e.name,
      type: e.type,
      description: e.description,
      statesCount: e.plantOperatingStateIds.length,
      durationFraction: e.durationFractionHint ?? computedFraction,
      fromDoc: e.sourceDocumentRef ?? "",
    };
  });
}

function groupsView(pos: PlantOperatingStatesAnalysis): GroupView[] {
  const groups = pos.plantOperatingStateGroups ?? [];
  return groups.map((g) => {
    const bounded = g.doesNotMaskRiskSignificantContributors;
    const pending = g.boundingCharacteristics.some((c) => c.startsWith("Pending"));
    return {
      id: g.uuid,
      name: g.name,
      members: g.memberPosIds,
      rationale: g.similarityBasis,
      boundingCharacteristic: g.boundingCharacteristics[0] ?? "",
      durationSum: formatDuration(g.summedDurationHours),
      status: bounded && !pending ? "ok" : "warn",
      statusMessage: pending ? "Bounding rationale for fuel-handling phase still to be entered." : undefined,
      hasPreopAssumption: (g.preOperationalAssumptions ?? []).length > 0,
    };
  });
}

function interviewsView(pos: PlantOperatingStatesAnalysis): InterviewView[] {
  const records = pos.interviewRecords ?? [];
  return records.map((r, i) => ({
    id: `IV-${String(i + 1).padStart(2, "0")}`,
    date: r.date,
    evolutionId: r.evolutionId ?? null,
    method: r.method,
    personnel: r.personnelRoles,
    findings: r.findings,
    overlooked: r.overlookedEvolutionsIdentified.length,
  }));
}

function screeningView(pos: PlantOperatingStatesAnalysis): ScreeningView[] {
  return pos.screeningRecords.map((r, i) => {
    const impact = r.retained
      ? r.posId === "POS-05"
        ? "High"
        : "Medium"
      : "Low";
    return {
      id: `SCR-${i + 1}`,
      posId: r.posId,
      retained: r.retained,
      criterion: r.retained ? null : "Qualitative — subsumed",
      justification: r.justification,
      riskImpact: impact,
    };
  });
}

function stepIndexById(id: string): number {
  return POS_STEPS.findIndex((s) => s.id === id);
}

function srStatusToTone(status: string): ConformanceStatus {
  if (status === "MET") return "ok";
  if (status === "PARTIAL") return "warn";
  if (status === "NOT_MET") return "blocked";
  if (status === "NOT_APPLICABLE") return "na";
  return "warn";
}

function filterConformance(pos: PlantOperatingStatesAnalysis, ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  const ccUpper = ccId.replace("cc-", "").toUpperCase();
  const matrixBySr = new Map<string, { status: string }>();
  for (const entry of pos.conformanceMatrix) {
    if (entry.capabilityCategory === `CC-${ccUpper}` as never) matrixBySr.set(entry.sr, entry);
  }
  return CONFORMANCE_ITEMS.filter((it) => it.requiredAt.includes(ccId)).map((it) => {
    const inStage = it.stages.includes("both") || it.stages.includes(stageKey);
    if (!inStage) return { ...it, status: "na" as const, meta: "Not applicable to current plant stage" };
    const srs = it.sr ?? [];
    if (srs.length === 0) return { ...it, status: "warn" as const, meta: "Awaiting evidence" };
    const statuses = srs.map((sr) => matrixBySr.get(sr)?.status);
    if (statuses.every((s) => s === undefined)) return { ...it, status: "warn" as const, meta: "Awaiting evidence" };
    const tones = statuses.map((s) => s === undefined ? "warn" : srStatusToTone(s));
    if (tones.includes("blocked")) return { ...it, status: "blocked" as const };
    if (tones.includes("warn")) return { ...it, status: "warn" as const };
    if (tones.every((t) => t === "na")) return { ...it, status: "na" as const };
    return { ...it, status: "ok" as const };
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

function ccScore(pos: PlantOperatingStatesAnalysis, ccId: string, stage: Stage): { percent: number; met: number; applicable: number; warn: number; blocked: number; na: number } {
  const items = filterConformance(pos, ccId, stage);
  const applicable = items.filter((it) => it.status !== "na").length;
  const met = items.filter((it) => it.status === "ok").length;
  const warn = items.filter((it) => it.status === "warn").length;
  const blocked = items.filter((it) => it.status === "blocked").length;
  const na = items.filter((it) => it.status === "na").length;
  const percent = applicable === 0 ? 0 : Math.round((met / applicable) * 100);
  return { percent, met, applicable, warn, blocked, na };
}

function stepsForPersona(persona: PosPersona): PosStep[] {
  const ids = PERSONA_STEPS[persona];
  return POS_STEPS.filter((s) => ids.includes(s.id));
}

function stepsFromMef(pos: PlantOperatingStatesAnalysis, persona: PosPersona, documentCount: number): PosStep[] {
  const base = stepsForPersona(persona);
  const pi = pos.metadata.plantIdentity;
  const setupComplete = pi !== undefined && pi.name.length > 0 && pi.vendor.length > 0 && pi.reactorType.length > 0 && pi.thermalPower.length > 0 && pi.primaryCoolant.length > 0;
  const setupInProgress = !setupComplete && (pi !== undefined || pos.praScope.length > 0 || pos.capabilityCategory !== undefined);

  const documentsComplete = documentCount > 0;

  const evolutionsComplete = pos.plantEvolutions.length > 0;
  const statesComplete = pos.plantOperatingStates.length > 0;
  const interviewsComplete = (pos.interviewRecords ?? []).length > 0;
  const screeningComplete = pos.screeningRecords.length > 0;
  const groupingComplete = (pos.plantOperatingStateGroups ?? []).length > 0;

  const allStatesWithDuration = pos.plantOperatingStates.length > 0 && pos.plantOperatingStates.every((s) => s.meanDurationHours > 0);
  const allStatesWithFreq = pos.plantOperatingStates.length > 0 && pos.plantOperatingStates.every((s) => {
    const v = typeof s.meanEntryFrequency === "number" ? s.meanEntryFrequency : s.meanEntryFrequency.value;
    return v > 0;
  });
  const frequencyComplete = allStatesWithDuration && allStatesWithFreq;

  const lpsdStates = pos.plantOperatingStates.filter((s) => s.operatingMode !== "POWER");
  const characterizedSet = new Set(pos.decayHeatCharacterizations.map((d) => d.posId));
  const decayheatComplete = lpsdStates.length > 0 && lpsdStates.every((s) => characterizedSet.has(s.uuid));

  const draftComplete = pos.workflowState !== "DRAFT" && pos.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = pos.workflowState === "FINAL";

  function status(complete: boolean, inProgress: boolean): "complete" | "in-progress" | "idle" {
    if (complete) return "complete";
    if (inProgress) return "in-progress";
    return "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "setup": return { ...s, status: status(setupComplete, setupInProgress) };
      case "documents": return { ...s, status: status(documentsComplete, false) };
      case "evolutions": return { ...s, status: status(evolutionsComplete, false) };
      case "states": return { ...s, status: status(statesComplete, false) };
      case "interviews": return { ...s, status: status(interviewsComplete, false) };
      case "screening": return { ...s, status: status(screeningComplete, false) };
      case "grouping": return { ...s, status: status(groupingComplete, false) };
      case "frequency": return { ...s, status: status(frequencyComplete, allStatesWithDuration || allStatesWithFreq) };
      case "decayheat": return { ...s, status: status(decayheatComplete, characterizedSet.size > 0) };
      case "draft": return { ...s, status: status(draftComplete, false) };
      case "review": return { ...s, status: status(reviewComplete, pos.workflowState === "INTERNAL_TECHNICAL_REVIEW" || pos.workflowState === "INTERNAL_APPROVAL") };
      default: return { ...s, status: "idle" as const };
    }
  });
}

interface ReviewerView {
  id: string;
  name: string;
  initials: string;
  title?: string;
  organization?: string;
  qualification?: string;
  roleEnum: "INTERNAL_REVIEWER" | "INTERNAL_APPROVER" | "EXTERNAL_PEER_REVIEWER" | "EXTERNAL_AUDITOR";
}

function initialsOf(name: string): string {
  const cleaned = name.startsWith("Dr. ") ? name.slice(4) : name;
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function internalReviewersView(pos: PlantOperatingStatesAnalysis): ReviewerView[] {
  return pos.metadata.reviewers
    .filter((r) => r.role === "INTERNAL_REVIEWER")
    .map((r) => ({
      id: r.id,
      name: r.name,
      initials: initialsOf(r.name),
      title: r.title,
      organization: r.organization,
      roleEnum: r.role,
    }));
}

function internalApproverView(pos: PlantOperatingStatesAnalysis): ReviewerView | null {
  const r = pos.metadata.reviewers.find((x) => x.role === "INTERNAL_APPROVER");
  if (r === undefined) return null;
  return {
    id: r.id,
    name: r.name,
    initials: initialsOf(r.name),
    title: r.title,
    organization: r.organization,
    qualification: r.qualification,
    roleEnum: r.role,
  };
}

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
  linkedNM?: string;
}

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

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

function commentsView(pos: PlantOperatingStatesAnalysis, now: Date = new Date()): CommentView[] {
  const reviewers = pos.metadata.reviewers;
  return pos.internalReviewComments.comments.map((c) => {
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
      section: item?.section ?? "Documentation",
      targetLabel: item?.text ?? "General — documentation",
      text: c.text,
      severity: c.severity ?? "OBSERVATION",
      resolved: c.resolved,
      resolution: c.resolution,
      linkedNM: item?.linkedNM,
    };
  });
}

interface CcSnapshotView {
  id: string;
  label: string;
  date: string;
  plantRev: string;
  codes: number;
  pendingChanges: number;
}

function ccSnapshotView(cc: PRAConfigurationControl): CcSnapshotView {
  return {
    id: cc.uuid,
    label: cc.name,
    date: cc.freezeDate,
    plantRev: cc.plantConfigurationRevision ?? "—",
    codes: cc.computerCodeControls.length,
    pendingChanges: cc.pendingChangeAssessments.length,
  };
}

interface NewlyDevelopedMethodView {
  id: string;
  name: string;
  hlrCoverage: string;
  status: "approved" | "in_review" | "draft";
}

function nmViews(nms: NewlyDevelopedMethod[]): NewlyDevelopedMethodView[] {
  return nms.map((nm) => {
    const hlrs = new Set<string>();
    const collect = (refs: { hlr: string }[]): void => { for (const r of refs) hlrs.add(r.hlr); };
    collect(nm.scopeAndLimitations.implementsSrs);
    collect(nm.engineeringAndScienceBasis.implementsSrs);
    collect(nm.methodData.implementsSrs);
    collect(nm.uncertaintyCharacterization.implementsSrs);
    collect(nm.resultsQuality.implementsSrs);
    collect(nm.documentation.implementsSrs);
    const ordered = ["A", "B", "C", "D", "E", "F"].filter((h) => hlrs.has(h));
    const status = nm.workflowState === "FINAL" ? "approved" as const : nm.workflowState === "INTERNAL_TECHNICAL_REVIEW" ? "in_review" as const : "draft" as const;
    return {
      id: nm.uuid,
      name: nm.name,
      hlrCoverage: ordered.join("·"),
      status,
    };
  });
}

function nmViewById(nms: NewlyDevelopedMethod[], id: string): NewlyDevelopedMethodView | undefined {
  return nmViews(nms).find((v) => v.id === id);
}

interface PreOpAssumptionView {
  id: string;
  ownerLabel: string;
  appliesTo: string;
  source: string;
  closurePlan: string;
  description: string;
  ownerName?: string;
  affected: string;
}

function preOpsForState(pos: PlantOperatingStatesAnalysis, stateId: string): PreOpAssumptionView[] {
  const s = pos.plantOperatingStates.find((x) => x.uuid === stateId);
  if (s === undefined || s.preOperationalAssumptions === undefined) return [];
  return s.preOperationalAssumptions.map((a) => ({
    id: a.uuid,
    ownerLabel: stateId,
    appliesTo: a.influenceOnDefinition,
    source: a.closureBasis,
    closurePlan: a.plannedClosureActions[0] ?? "",
    description: a.description,
    ownerName: a.owner,
    affected: a.affectedElementIds[0] ?? stateId,
  }));
}

function preOpsForGroup(pos: PlantOperatingStatesAnalysis, groupId: string): PreOpAssumptionView[] {
  const g = (pos.plantOperatingStateGroups ?? []).find((x) => x.uuid === groupId);
  if (g === undefined || g.preOperationalAssumptions === undefined) return [];
  return g.preOperationalAssumptions.map((a) => ({
    id: a.uuid,
    ownerLabel: groupId,
    appliesTo: a.influenceOnDefinition,
    source: a.closureBasis,
    closurePlan: a.plannedClosureActions[0] ?? "",
    description: a.description,
    ownerName: a.owner,
    affected: a.affectedElementIds[0] ?? groupId,
  }));
}

export {
  type Stage,
  type RcsView,
  type StateView,
  type EvolutionView,
  type GroupView,
  type InterviewView,
  type ScreeningView,
  type ReviewerView,
  type CommentView,
  type CcSnapshotView,
  type NewlyDevelopedMethodView,
  type PreOpAssumptionView,
  statesView,
  evolutionsView,
  groupsView,
  interviewsView,
  screeningView,
  stepIndexById,
  filterConformance,
  groupBySection,
  ccScore,
  isBarrierBroken,
  formatNumber,
  formatRange,
  formatDuration,
  formatFrequency,
  stepsForPersona,
  stepsFromMef,
  internalReviewersView,
  internalApproverView,
  commentsView,
  ccSnapshotView,
  nmViews,
  nmViewById,
  preOpsForState,
  preOpsForGroup,
};
