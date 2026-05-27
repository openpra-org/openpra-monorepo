import {
  type PlantOperatingState,
  type ParameterRange,
  BarrierStatus,
} from "interfaces-mef-types/pos/plant-operating-states-analysis";
import { POS_ANALYSIS } from "./posData";
import {
  POS_STEPS,
  POS_UI_STATE,
  EVOLUTION_UI,
  CONFORMANCE_ITEMS,
  CC_SCORES,
  type ConformanceItem,
  type PosWorkflowStatus,
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

export {
  type Stage,
  type RcsView,
  type StateView,
  type EvolutionView,
  type GroupView,
  type InterviewView,
  type ScreeningView,
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
};
