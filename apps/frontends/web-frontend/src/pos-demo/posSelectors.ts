import {
  type PlantOperatingState,
  type ParameterRange,
  BarrierStatus,
} from "interfaces-mef-types/pos/plant-operating-states-analysis";
import { POS_ANALYSIS } from "./posData";
import { CC_SNAPSHOT_INSTANCE, NM_INSTANCES, nmById } from "./posCrossCutting";
import {
  POS_STEPS,
  POS_UI_STATE,
  EVOLUTION_UI,
  CONFORMANCE_ITEMS,
  CC_SCORES,
  PERSONA_STEPS,
  type ConformanceItem,
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

function statesView(): StateView[] {
  const screenedOut = new Set(POS_ANALYSIS.screeningRecords.filter((r) => !r.retained).map((r) => r.posId));
  return POS_ANALYSIS.plantOperatingStates.map((s) => {
    const ui = POS_UI_STATE[s.uuid];
    return {
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
      status: ui?.status ?? "ok",
      statusMessage: ui?.statusMessage,
      docsLinked: ui?.docsLinked ?? 0,
      hasPreopAssumption: (s.preOperationalAssumptions ?? []).length > 0,
    };
  });
}

function evolutionsView(): EvolutionView[] {
  return POS_ANALYSIS.plantEvolutions.map((e) => {
    const ui = EVOLUTION_UI[e.uuid];
    return {
      id: e.uuid,
      name: e.name,
      type: e.type,
      description: e.description,
      statesCount: e.plantOperatingStateIds.length,
      durationFraction: ui?.durationFraction ?? 0,
      fromDoc: ui?.fromDoc ?? "",
    };
  });
}

function groupsView(): GroupView[] {
  const groups = POS_ANALYSIS.plantOperatingStateGroups ?? [];
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

function interviewsView(): InterviewView[] {
  const records = POS_ANALYSIS.interviewRecords ?? [];
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

function screeningView(): ScreeningView[] {
  return POS_ANALYSIS.screeningRecords.map((r, i) => {
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

function filterConformance(ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  return CONFORMANCE_ITEMS.filter((it) => it.requiredAt.includes(ccId)).map((it) => {
    const inStage = it.stages.includes("both") || it.stages.includes(stageKey);
    if (!inStage) {
      return { ...it, status: "na" as const, meta: "Not applicable to current plant stage" };
    }
    return it;
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

function ccScore(ccId: string): { percent: number; met: number; applicable: number; warn: number; blocked: number; na: number } {
  return CC_SCORES[ccId] ?? { percent: 0, met: 0, applicable: 0, warn: 0, blocked: 0, na: 0 };
}

function stepsForPersona(persona: PosPersona): PosStep[] {
  const ids = PERSONA_STEPS[persona];
  return POS_STEPS.filter((s) => ids.includes(s.id));
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

function internalReviewersView(): ReviewerView[] {
  return POS_ANALYSIS.metadata.reviewers
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

function internalApproverView(): ReviewerView | null {
  const r = POS_ANALYSIS.metadata.reviewers.find((x) => x.role === "INTERNAL_APPROVER");
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

function commentsView(now: Date = new Date()): CommentView[] {
  const reviewers = POS_ANALYSIS.metadata.reviewers;
  return POS_ANALYSIS.internalReviewComments.comments.map((c) => {
    const author = reviewers.find((r) => r.id === c.authorId);
    const item = c.associatedSr !== undefined ? CONFORMANCE_ITEMS.find((it) => it.id === c.associatedSr) : undefined;
    return {
      id: c.uuid,
      authorId: c.authorId,
      authorName: author?.name ?? c.authorId,
      authorInitials: initialsOf(author?.name ?? c.authorId),
      authorTitle: author?.title,
      when: relativeFrom(c.createdAt, now),
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

function ccSnapshotView(): CcSnapshotView {
  const inst = CC_SNAPSHOT_INSTANCE;
  return {
    id: inst.uuid,
    label: inst.name,
    date: inst.freezeDate,
    plantRev: inst.plantConfigurationRevision ?? "—",
    codes: inst.computerCodeControls.length,
    pendingChanges: inst.pendingChangeAssessments.length,
  };
}

interface NewlyDevelopedMethodView {
  id: string;
  name: string;
  hlrCoverage: string;
  status: "approved" | "in_review" | "draft";
}

function nmViews(): NewlyDevelopedMethodView[] {
  return NM_INSTANCES.map((nm) => {
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

function nmViewById(id: string): NewlyDevelopedMethodView | undefined {
  if (nmById(id) === undefined) return undefined;
  return nmViews().find((v) => v.id === id);
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

function preOpsForState(stateId: string): PreOpAssumptionView[] {
  const s = POS_ANALYSIS.plantOperatingStates.find((x) => x.uuid === stateId);
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

function preOpsForGroup(groupId: string): PreOpAssumptionView[] {
  const g = (POS_ANALYSIS.plantOperatingStateGroups ?? []).find((x) => x.uuid === groupId);
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
  internalReviewersView,
  internalApproverView,
  commentsView,
  ccSnapshotView,
  nmViews,
  nmViewById,
  preOpsForState,
  preOpsForGroup,
};
