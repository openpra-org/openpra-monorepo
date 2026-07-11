import {
  type PlantOperatingState,
  type PlantOperatingStatesAnalysis,
  type ParameterRange,
  type ScreeningCriterion,
  BarrierStatus,
  POS_SR_CATALOG,
} from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type SRConformance, type SRStatus } from "interfaces-mef-types/core/pra-common";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { type Frequency, type FrequencyWithDistribution } from "interfaces-mef-types/core/events";
import { type ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
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
  members: { id: string; label: string }[];
  rationale: string;
  boundingCharacteristic: string;
  durationSum: string;
  status: "ok" | "warn";
  statusMessage?: string;
  hasPreopAssumption: boolean;
}

interface InterviewView {
  id: string;
  uuid: string;
  date: string;
  evolutionId: string | null;
  method: string;
  personnel: string[];
  findings: string;
  overlooked: number;
}

interface ScreeningEditorView {
  posId: string;
  name: string;
  description: string;
  mode: string;
  retained: boolean;
  criterion: ScreeningCriterion | null;
  riskSignificance: ImportanceLevel | null;
  riskLabel: string;
  justification: string;
  quantitativeBasis: number | null;
  alternateCriterionJustification: string;
  needsBasis: boolean;
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

function formatImportance(level: ImportanceLevel): string {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

function stateLabel(name: string): string {
  return name.trim().length > 0 ? name : "Untitled state";
}

function evolutionLabel(name: string): string {
  return name.trim().length > 0 ? name : "Untitled evolution";
}

function groupLabel(name: string): string {
  return name.trim().length > 0 ? name : "Untitled group";
}

function methodLabel(method: string): string {
  if (method === "WALKDOWN") return "Walkdown";
  if (method === "COMPUTERIZED_WALKDOWN") return "Computerised walkdown";
  if (method === "INTERVIEW") return "Interview";
  return "Tabletop";
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
  const cycleTotal = pos.plantOperatingStates.reduce((acc, s) => acc + s.meanDurationHours, 0);
  return pos.plantEvolutions.map((e) => {
    const members = pos.plantOperatingStates.filter((s) => s.evolutionId === e.uuid);
    const sumHours = members.reduce((acc, s) => acc + s.meanDurationHours, 0);
    const computedFraction = cycleTotal > 0 ? sumHours / cycleTotal : 0;
    return {
      id: e.uuid,
      name: e.name,
      type: e.type,
      description: e.description,
      statesCount: members.length,
      durationFraction: computedFraction,
      fromDoc: e.sourceDocumentRef ?? "",
    };
  });
}

function groupsView(pos: PlantOperatingStatesAnalysis): GroupView[] {
  const groups = pos.plantOperatingStateGroups ?? [];
  const nameById = new Map(pos.plantOperatingStates.map((s) => [s.uuid, stateLabel(s.name)]));
  return groups.map((g) => {
    const incomplete = g.boundingCharacteristics.length === 0 || g.similarityBasis.trim().length === 0 || !g.doesNotMaskRiskSignificantContributors;
    return {
      id: g.uuid,
      name: groupLabel(g.name),
      members: g.memberPosIds.map((id) => ({ id, label: nameById.get(id) ?? stateLabel("") })),
      rationale: g.similarityBasis,
      boundingCharacteristic: g.boundingCharacteristics[0] ?? "",
      durationSum: formatDuration(g.summedDurationHours),
      status: incomplete ? "warn" : "ok",
      statusMessage: incomplete ? `${groupLabel(g.name)} still needs its bounding rationale or attestation.` : undefined,
      hasPreopAssumption: (g.preOperationalAssumptions ?? []).length > 0,
    };
  });
}

function interviewsView(pos: PlantOperatingStatesAnalysis): InterviewView[] {
  const records = pos.interviewRecords ?? [];
  return records.map((r, i) => ({
    id: `IV-${String(i + 1).padStart(2, "0")}`,
    uuid: r.uuid ?? "",
    date: r.date,
    evolutionId: r.evolutionId ?? null,
    method: r.method,
    personnel: r.personnelRoles,
    findings: r.findings,
    overlooked: r.overlookedEvolutionsIdentified.length,
  }));
}

function screeningEditorView(pos: PlantOperatingStatesAnalysis): ScreeningEditorView[] {
  const byPos = new Map(pos.screeningRecords.map((r) => [r.posId, r]));
  return pos.plantOperatingStates.map((s) => {
    const rec = byPos.get(s.uuid);
    const retained = rec ? rec.retained : true;
    const riskSignificance = rec?.riskSignificance ?? null;
    const criterion = rec?.criterion ?? null;
    const justification = rec?.justification ?? "";
    return {
      posId: s.uuid,
      name: s.name,
      description: s.description,
      mode: s.operatingMode,
      retained,
      criterion,
      riskSignificance,
      riskLabel: riskSignificance !== null ? formatImportance(riskSignificance) : retained ? "Unrated" : "—",
      justification,
      quantitativeBasis: rec?.quantitativeBasis ?? null,
      alternateCriterionJustification: rec?.alternateCriterionJustification ?? "",
      needsBasis: !retained && (criterion === null || justification.trim() === ""),
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

// Maps each supporting requirement to the element data its conformance is judged
// against. Documentation only; the live derivation reads the data directly.
const SR_PATHS: Record<string, string[]> = {
  "POS-A1": ["plantEvolutions"],
  "POS-A2": ["plantEvolutions[].reviewedDocumentation"],
  "POS-A3": ["plantOperatingStates"],
  "POS-A5": ["plantOperatingStates"],
  "POS-A8": ["interviewRecords"],
  "POS-A9": ["plantOperatingStates[].successCriteriaIds"],
  "POS-A10": ["praScope"],
  "POS-A11": ["plantOperatingStates[].sscOperationalCharacteristics"],
  "POS-A12": ["modelUncertainty"],
  "POS-A13": ["plantOperatingStates[].preOperationalAssumptions"],
  "POS-B1": ["plantOperatingStateGroups"],
  "POS-B2": ["screeningRecords"],
  "POS-B3": ["plantOperatingStateGroups[].doesNotMaskRiskSignificantContributors"],
  "POS-B4": ["separationRecords"],
  "POS-B5": ["demandTimeBasedRecords"],
  "POS-B6": ["plantOperatingStateGroups[].boundingCharacteristics"],
  "POS-B7": ["modelUncertainty"],
  "POS-B8": ["plantOperatingStateGroups[].preOperationalAssumptions"],
  "POS-C1": ["plantOperatingStates[].meanDurationHours"],
  "POS-C2": ["plantOperatingStates[].preOperationalAssumptions"],
  "POS-C3": ["plantOperatingStateGroups[].summedDurationHours"],
  "POS-C4": ["decayHeatCharacterizations"],
  "POS-D1": ["documentation"],
  "POS-D2": ["modelUncertainty"],
  "POS-D3": ["plantRepresentationAccuracy"],
};

function triStatus(done: number, total: number): SRStatus {
  if (total === 0) return "NOT_MET";
  if (done >= total) return "MET";
  if (done === 0) return "NOT_MET";
  return "PARTIAL";
}

function deriveConformance(pos: PlantOperatingStatesAnalysis): SRConformance[] {
  const states = pos.plantOperatingStates;
  const screenedOut = new Set(pos.screeningRecords.filter((r) => !r.retained).map((r) => r.posId));
  const retained = states.filter((s) => !screenedOut.has(s.uuid));
  const lpsdRetained = retained.filter((s) => s.operatingMode !== "POWER");
  const evolutions = pos.plantEvolutions;
  const groups = pos.plantOperatingStateGroups ?? [];
  const separations = pos.separationRecords ?? [];
  const demandTimeBased = pos.demandTimeBasedRecords ?? [];
  const interviews = pos.interviewRecords ?? [];
  const decayHeatPosIds = new Set(pos.decayHeatCharacterizations.map((d) => d.posId));
  const muSources = pos.modelUncertainty.uncertaintySources.length;
  const doc = pos.documentation;
  const groupAssumptions = groups.some((g) => (g.preOperationalAssumptions ?? []).length > 0);
  const anyAssumption = groupAssumptions || states.some((s) => (s.preOperationalAssumptions ?? []).length > 0);

  const evWithDoc = evolutions.filter((e) => {
    if ((e.sourceDocumentRef ?? "").trim().length > 0) return true;
    const r = e.reviewedDocumentation;
    return r !== undefined && Object.values(r).some((arr) => Array.isArray(arr) && arr.length > 0);
  }).length;
  const statesCharacterised = states.filter((s) => s.radionuclideTransportBarriers.length > 0).length;
  const statesWithSc = retained.filter((s) => s.successCriteriaIds.length > 0).length;
  const statesWithSsc = states.filter((s) => s.sscOperationalCharacteristics.length > 0).length;
  const screenedOutRecs = pos.screeningRecords.filter((r) => !r.retained);
  const screenedJustified = screenedOutRecs.filter((r) => r.justification.trim().length > 0).length;
  const groupsNotMasking = groups.filter((g) => g.doesNotMaskRiskSignificantContributors).length;
  const groupsBounded = groups.filter((g) => g.boundingCharacteristics.length > 0 && g.similarityBasis.trim().length > 0 && g.doesNotMaskRiskSignificantContributors).length;
  const statesWithDuration = retained.filter((s) => s.meanDurationHours > 0 && (s.operatingMode === "POWER" || s.meanTimeAfterShutdownHours !== undefined)).length;
  const statesWithDurationBasis = retained.filter((s) => (s.preOperationalAssumptions ?? []).some((a) => a.influenceOnDefinition.toLowerCase().includes("duration"))).length;
  const groupsWithDuration = groups.filter((g) => g.summedDurationHours > 0).length;
  const lpsdCharacterised = lpsdRetained.filter((s) => decayHeatPosIds.has(s.uuid)).length;
  const docFields = [doc.processDescription, doc.posIdentificationProcessAndCriteria, doc.posGroupingProcessAndCriteria, doc.durationsTimesSinceShutdownFrequencies, doc.decayHeatPerPos];
  const docFilled = docFields.filter((f) => f.trim().length > 0).length;
  const plural = (n: number): string => (n === 1 ? "" : "s");
  const screeningStatus: SRStatus = pos.screeningRecords.length === 0 ? "NOT_MET" : screenedOutRecs.length === 0 ? "MET" : triStatus(screenedJustified, screenedOutRecs.length);

  const rules: Record<string, { status: SRStatus; evidence: string }> = {
    "POS-A1": { status: evolutions.length > 0 ? "MET" : "NOT_MET", evidence: `${evolutions.length} plant evolution${plural(evolutions.length)} identified.` },
    "POS-A2": { status: triStatus(evWithDoc, evolutions.length), evidence: `${evWithDoc} of ${evolutions.length} evolution${plural(evolutions.length)} traced to source documents.` },
    "POS-A3": { status: triStatus(statesCharacterised, states.length), evidence: `${statesCharacterised} of ${states.length} state${plural(states.length)} characterised by mode, parameters, and barriers.` },
    "POS-A4": { status: pos.plantRepresentationAccuracy.scope === "OPERATING" ? "MET" : "NOT_MET", evidence: pos.plantRepresentationAccuracy.scope === "OPERATING" ? "State delineation is consistent with the as-operated plant configuration." : "As-built consistency applies once the plant is operating." },
    "POS-A5": { status: states.length > 0 && evolutions.length > 0 ? "MET" : "NOT_MET", evidence: states.length > 0 && evolutions.length > 0 ? "States delineated from the reviewed design evolutions." : "Define evolutions and states from the design basis." },
    "POS-A6": { status: interviews.length > 0 && evWithDoc > 0 ? "MET" : "NOT_MET", evidence: interviews.length > 0 && evWithDoc > 0 ? "Known future evolutions reviewed through the documented evolution set and operating-staff interviews." : "Review known future evolutions so the state selections stay valid." },
    "POS-A7": { status: interviews.length > 0 ? "MET" : "NOT_MET", evidence: interviews.length > 0 ? `${interviews.length} operating-staff interview session${plural(interviews.length)} logged for overlooked evolutions.` : "Interview operating-plant personnel for overlooked past or future evolutions." },
    "POS-A8": { status: interviews.length > 0 ? "MET" : "NOT_MET", evidence: `${interviews.length} engineering interview session${plural(interviews.length)} logged.` },
    "POS-A9": { status: triStatus(statesWithSc, retained.length), evidence: `${statesWithSc} of ${retained.length} retained state${plural(retained.length)} carry success criteria for downstream analysis.` },
    "POS-A10": { status: states.length === 0 ? "NOT_MET" : !pos.includesNonInternalHazardGroups ? "MET" : "PARTIAL", evidence: states.length === 0 ? "Define operating states before reviewing hazard-group sufficiency." : !pos.includesNonInternalHazardGroups ? "Scope is internal events; no further hazard groups in scope." : "Confirm state conditions cover the in-scope hazard groups." },
    "POS-A11": { status: triStatus(statesWithSsc, states.length), evidence: `${statesWithSsc} of ${states.length} state${plural(states.length)} record SSC operational characteristics.` },
    "POS-A12": { status: muSources > 0 ? "MET" : "NOT_MET", evidence: `${muSources} model-uncertainty source${plural(muSources)} logged.` },
    "POS-A13": { status: anyAssumption ? "MET" : "NOT_MET", evidence: anyAssumption ? "Pre-operational assumptions logged with closure plans." : "Log assumptions arising from missing as-built detail." },
    "POS-B1": { status: groups.length > 0 ? "MET" : "NOT_MET", evidence: `${groups.length} representative group${plural(groups.length)} defined.` },
    "POS-B2": { status: screeningStatus, evidence: pos.screeningRecords.length === 0 ? "No screening decisions recorded yet." : `${screenedOutRecs.length} state${plural(screenedOutRecs.length)} screened out, each with a documented basis.` },
    "POS-B3": { status: triStatus(groupsNotMasking, groups.length), evidence: `${groupsNotMasking} of ${groups.length} group${plural(groups.length)} confirmed not to mask risk-significant contributors.` },
    "POS-B4": { status: separations.length > 0 ? "MET" : "NOT_MET", evidence: separations.length > 0 ? `${separations.length} separation record${plural(separations.length)} documented.` : "Document any states kept separate for differing response." },
    "POS-B5": { status: demandTimeBased.length > 0 ? "MET" : states.length > 0 ? "PARTIAL" : "NOT_MET", evidence: demandTimeBased.length > 0 ? `${demandTimeBased.length} demand/time-based separation record${plural(demandTimeBased.length)} documented.` : "Record demand-based and time-based states kept separate to avoid averaging." },
    "POS-B6": { status: triStatus(groupsBounded, groups.length), evidence: `${groupsBounded} of ${groups.length} group${plural(groups.length)} carry a complete bounding rationale.` },
    "POS-B7": { status: muSources > 0 ? "MET" : "NOT_MET", evidence: "Screening and grouping uncertainty captured in the model-uncertainty log." },
    "POS-B8": { status: groupAssumptions ? "MET" : "NOT_MET", evidence: groupAssumptions ? "Grouping assumptions logged with closure plans." : "Log grouping assumptions from missing as-built detail." },
    "POS-C1": { status: triStatus(statesWithDuration, retained.length), evidence: `${statesWithDuration} of ${retained.length} retained state${plural(retained.length)} carry mean duration and time after shutdown.` },
    "POS-C2": { status: triStatus(statesWithDurationBasis, retained.length), evidence: `${statesWithDurationBasis} of ${retained.length} retained state${plural(retained.length)} document a duration basis.` },
    "POS-C3": { status: triStatus(groupsWithDuration, groups.length), evidence: `${groupsWithDuration} of ${groups.length} group${plural(groups.length)} carry a summed duration.` },
    "POS-C4": { status: triStatus(lpsdCharacterised, lpsdRetained.length), evidence: `${lpsdCharacterised} of ${lpsdRetained.length} retained LPSD state${plural(lpsdRetained.length)} have a decay-heat characterisation.` },
    "POS-C5": { status: statesWithDuration > 0 && lpsdCharacterised > 0 ? "MET" : "NOT_MET", evidence: statesWithDuration > 0 && lpsdCharacterised > 0 ? "Operating plans and schedules reviewed. Durations and decay-heat levels confirmed against operating data." : "Review future plans and schedules so the assumed decay-heat and durations stay valid." },
    "POS-D1": { status: triStatus(docFilled, docFields.length), evidence: `${docFilled} of ${docFields.length} core documentation field${plural(docFields.length)} written.` },
    "POS-D2": { status: muSources > 0 ? "MET" : "NOT_MET", evidence: "Model-uncertainty sources documented with treatments." },
    "POS-D3": { status: anyAssumption ? "MET" : "NOT_MET", evidence: anyAssumption ? "Assumptions and limitations documented with closure plans." : "Document assumptions and limitations from missing as-built detail." },
  };

  return Object.entries(POS_SR_CATALOG).map(([sr, meta]) => {
    const rule = rules[sr] ?? { status: "NOT_MET" as SRStatus, evidence: "Not yet assessed." };
    return { sr, hlr: meta.hlr, capabilityCategory: pos.capabilityCategory ?? "CC-II", applicableToStage: meta.stages, status: rule.status, satisfiedByElementPaths: SR_PATHS[sr] ?? [], evidence: rule.evidence };
  });
}

function filterConformance(pos: PlantOperatingStatesAnalysis, ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  const bySr = new Map(deriveConformance(pos).map((e) => [e.sr, e] as const));
  return CONFORMANCE_ITEMS.filter((it) => it.requiredAt.includes(ccId)).map((it) => {
    const inStage = it.stages.includes("both") || it.stages.includes(stageKey);
    if (!inStage) return { ...it, status: "na" as const, meta: "Not applicable to current plant stage" };
    const entries = (it.sr ?? []).map((sr) => bySr.get(sr)).filter((e): e is SRConformance => e !== undefined);
    if (entries.length === 0) return { ...it, status: "warn" as const, meta: "Awaiting evidence" };
    const meta = entries.map((e) => e.evidence).join(" ");
    const tones = entries.map((e) => (ccId === "cc-i" && e.status === "PARTIAL" ? "ok" : srStatusToTone(e.status)));
    if (tones.includes("blocked")) return { ...it, status: "blocked" as const, meta };
    if (tones.includes("warn")) return { ...it, status: "warn" as const, meta };
    if (tones.every((t) => t === "na")) return { ...it, status: "na" as const, meta };
    return { ...it, status: "ok" as const, meta };
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

function stepsFromMef(pos: PlantOperatingStatesAnalysis, persona: PosPersona): PosStep[] {
  const base = stepsForPersona(persona);
  const pi = pos.metadata.plantIdentity;
  const setupComplete = pi !== undefined && pi.name.length > 0 && pi.vendor.length > 0 && pi.reactorType.length > 0 && pi.thermalPower.length > 0 && pi.primaryCoolant.length > 0;
  const setupInProgress = !setupComplete && (pi !== undefined || pos.praScope.length > 0 || pos.capabilityCategory !== undefined);

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

const HOURS_PER_YEAR = 8760;

function cycleHours(pos: PlantOperatingStatesAnalysis): number {
  const stored = pos.validationRules.collectiveExhaustivity.totalCycleHours;
  return stored > 0 ? stored : HOURS_PER_YEAR;
}

interface CoverageView {
  summedHours: number;
  totalCycleHours: number;
  coverageFraction: number;
  gapHours: number;
  covered: boolean;
}

function coverageView(pos: PlantOperatingStatesAnalysis): CoverageView {
  const summedHours = pos.plantOperatingStates.reduce((acc, s) => acc + s.meanDurationHours, 0);
  const totalCycleHours = cycleHours(pos);
  const coverageFraction = totalCycleHours > 0 ? summedHours / totalCycleHours : 0;
  const deltaHours = totalCycleHours - summedHours;
  const gapHours = Math.max(0, deltaHours);
  const covered = Math.abs(deltaHours) <= 1;
  return { summedHours, totalCycleHours, coverageFraction, gapHours, covered };
}

function rangesOverlap(a: ParameterRange, b: ParameterRange): boolean {
  if (a.min === a.max && b.min === b.max) return a.min === b.min;
  return a.max > b.min && b.max > a.min;
}

function barrierSignature(s: PlantOperatingState): string {
  return s.radionuclideTransportBarriers
    .map((bar) => `${bar.name}:${bar.status ?? "?"}`)
    .sort()
    .join("|");
}

const DELINEATION_PARAMETER_OPTIONS = ["Operating mode", "Power level", "Reactor coolant temperature", "Coolant pressure", "Decay heat level", "Barrier status"];
const DELINEATION_PARAMETERS = new Set(DELINEATION_PARAMETER_OPTIONS);

function overlapsOnParameter(a: PlantOperatingState, b: PlantOperatingState, param: string): boolean {
  switch (param) {
    case "Operating mode": return a.operatingMode === b.operatingMode;
    case "Power level": return rangesOverlap(a.rcsParameters.powerLevel, b.rcsParameters.powerLevel);
    case "Reactor coolant temperature": return rangesOverlap(a.rcsParameters.reactorCoolantTemperature, b.rcsParameters.reactorCoolantTemperature);
    case "Coolant pressure": return rangesOverlap(a.rcsParameters.coolantPressure, b.rcsParameters.coolantPressure);
    case "Decay heat level": return rangesOverlap(a.rcsParameters.decayHeatLevel, b.rcsParameters.decayHeatLevel);
    case "Barrier status": return barrierSignature(a) === barrierSignature(b);
    default: return true;
  }
}

interface MutualExclusivityView {
  delineationParameters: string[];
  recognizedParameters: string[];
  configured: boolean;
  statesChecked: number;
  overlaps: { aId: string; aName: string; bId: string; bName: string }[];
  allSeparable: boolean;
}

function mutualExclusivityView(pos: PlantOperatingStatesAnalysis): MutualExclusivityView {
  const screenedOut = new Set(pos.screeningRecords.filter((r) => !r.retained).map((r) => r.posId));
  const states = pos.plantOperatingStates.filter((s) => !screenedOut.has(s.uuid));
  const declared = pos.validationRules.mutualExclusivity.delineationParameters;
  const recognized = declared.filter((p) => DELINEATION_PARAMETERS.has(p));
  const overlaps: { aId: string; aName: string; bId: string; bName: string }[] = [];
  if (recognized.length > 0) {
    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const a = states[i];
        const b = states[j];
        if (recognized.every((p) => overlapsOnParameter(a, b, p))) {
          overlaps.push({ aId: a.uuid, aName: stateLabel(a.name), bId: b.uuid, bName: stateLabel(b.name) });
        }
      }
    }
  }
  return {
    delineationParameters: declared,
    recognizedParameters: recognized,
    configured: recognized.length > 0,
    statesChecked: states.length,
    overlaps,
    allSeparable: overlaps.length === 0,
  };
}

interface TransitionValidationView {
  totalStates: number;
  unreachable: { id: string; name: string }[];
  nonExitable: { id: string; name: string }[];
  danglingTargets: { from: string; to: string }[];
  staleSources: { id: string; name: string }[];
  allValid: boolean;
}

function transitionValidationView(pos: PlantOperatingStatesAnalysis): TransitionValidationView {
  const screenedOut = new Set(pos.screeningRecords.filter((r) => !r.retained).map((r) => r.posId));
  const states = pos.plantOperatingStates.filter((s) => !screenedOut.has(s.uuid));
  const ids = new Set(states.map((s) => s.uuid));
  const nameById = new Map(pos.plantOperatingStates.map((s) => [s.uuid, stateLabel(s.name)]));
  const matrix = pos.validationRules.transitions.transitionMatrix;
  const adjacency = new Map<string, string[]>();
  const danglingTargets: { from: string; to: string }[] = [];
  const staleSources: { id: string; name: string }[] = [];
  for (const from of Object.keys(matrix)) {
    const targets = matrix[from] ?? [];
    if (!ids.has(from)) {
      staleSources.push({ id: from, name: nameById.get(from) ?? from });
      continue;
    }
    const valid: string[] = [];
    for (const to of targets) {
      if (ids.has(to)) valid.push(to);
      else danglingTargets.push({ from, to });
    }
    adjacency.set(from, valid);
  }
  const hasIncoming = new Set<string>();
  for (const targets of adjacency.values()) {
    for (const to of targets) hasIncoming.add(to);
  }
  const entries = states
    .filter((s) => s.operatingMode === "POWER" || !hasIncoming.has(s.uuid))
    .map((s) => s.uuid);
  const first = states[0];
  if (entries.length === 0 && first !== undefined) entries.push(first.uuid);
  const reachable = new Set<string>(entries);
  const queue = [...entries];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const to of adjacency.get(current) ?? []) {
      if (!reachable.has(to)) {
        reachable.add(to);
        queue.push(to);
      }
    }
  }
  const unreachable = states.filter((s) => !reachable.has(s.uuid)).map((s) => ({ id: s.uuid, name: stateLabel(s.name) }));
  const nonExitable = states.filter((s) => (adjacency.get(s.uuid) ?? []).length === 0).map((s) => ({ id: s.uuid, name: stateLabel(s.name) }));
  return {
    totalStates: states.length,
    unreachable,
    nonExitable,
    danglingTargets,
    staleSources,
    allValid: unreachable.length === 0 && nonExitable.length === 0 && danglingTargets.length === 0 && staleSources.length === 0,
  };
}

function dhrStatuses(s: PlantOperatingState): string[] {
  const dhr = s.decayHeatRemoval;
  return [
    ...Object.values(dhr.primaryCoolingSystems),
    ...Object.values(dhr.secondaryCoolingSystems),
    ...Object.values(dhr.passiveMechanisms),
  ];
}

function trainsInService(s: PlantOperatingState): number {
  return dhrStatuses(s).filter((status) => status === "YES").length;
}

function trainsAvailable(s: PlantOperatingState): number {
  return dhrStatuses(s).filter((status) => status === "YES" || status === "STANDBY").length;
}

function barrierSummary(s: PlantOperatingState): string {
  if (s.radionuclideTransportBarriers.length === 0) return "—";
  const counts = new Map<string, number>();
  for (const bar of s.radionuclideTransportBarriers) {
    const status = (bar.status ?? "unknown").toLowerCase();
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([status, n]) => `${n} ${status}`).join(" · ");
}

interface HandoffLane {
  code: string;
  element: string;
  role: string;
  columns: string[];
  rows: { posId: string; name: string; values: string[] }[];
}

interface HandoffBundleView {
  retainedCount: number;
  lanes: HandoffLane[];
}

function handoffBundleView(pos: PlantOperatingStatesAnalysis): HandoffBundleView {
  const screenedOut = new Set(pos.screeningRecords.filter((r) => !r.retained).map((r) => r.posId));
  const states = pos.plantOperatingStates.filter((s) => !screenedOut.has(s.uuid));
  const dhByPos = new Map(pos.decayHeatCharacterizations.map((d) => [d.posId, d]));
  const matrix = pos.validationRules.transitions.transitionMatrix;
  const outgoing = (uuid: string): number => (matrix[uuid] ?? []).length;
  const row = (s: PlantOperatingState, values: string[]): { posId: string; name: string; values: string[] } => ({ posId: s.uuid, name: stateLabel(s.name), values });
  const timeFraction = (s: PlantOperatingState): string => `${((s.meanDurationHours / cycleHours(pos)) * 100).toFixed(1)} %`;
  const lanes: HandoffLane[] = [
    {
      code: "IE",
      element: "Initiating Events",
      role: "States & frequencies",
      columns: ["State", "Entry frequency", "Time fraction", "Initiators", "Transitions out"],
      rows: states.map((s) => {
        const freq = frequencyValue(s.meanEntryFrequency);
        const freqLabel = freq === 0 && s.operatingMode === "POWER" ? "Base state" : formatFrequency(freq);
        return row(s, [freqLabel, timeFraction(s), String(s.applicableInitiatingEvents.length), String(outgoing(s.uuid))]);
      }),
    },
    {
      code: "ES",
      element: "Event Sequence",
      role: "Sequences & barriers",
      columns: ["State", "Safety functions", "Success criteria", "Barriers"],
      rows: states.map((s) => row(s, [String(s.safetyFunctions.length), String(s.successCriteriaIds.length), barrierSummary(s)])),
    },
    {
      code: "SC",
      element: "Success Criteria",
      role: "Decay heat & conditions",
      columns: ["State", "Success criteria", "Decay heat", "Coolant temp", "Pressure"],
      rows: states.map((s) => {
        const dh = dhByPos.get(s.uuid);
        return row(s, [
          String(s.successCriteriaIds.length),
          dh !== undefined ? formatRange(dh.decayHeatLevel) : "—",
          formatRange(s.rcsParameters.reactorCoolantTemperature),
          formatRange(s.rcsParameters.coolantPressure),
        ]);
      }),
    },
    {
      code: "SY",
      element: "Systems Analysis",
      role: "Alignments & SSCs",
      columns: ["State", "Trains in service", "Trains available", "SSCs characterised"],
      rows: states.map((s) => row(s, [String(trainsInService(s)), String(trainsAvailable(s)), String(s.sscOperationalCharacteristics.length)])),
    },
    {
      code: "HR",
      element: "Human Reliability",
      role: "Timing & cues",
      columns: ["State", "Time after shutdown", "Decay heat", "Instruments"],
      rows: states.map((s) => {
        const dh = dhByPos.get(s.uuid);
        const time = dh !== undefined ? `${dh.timeAfterShutdownHours} h` : s.operatingMode === "POWER" ? "At power" : "—";
        return row(s, [time, dh !== undefined ? formatRange(dh.decayHeatLevel) : "—", String(s.availableInstrumentation.length)]);
      }),
    },
    {
      code: "DA",
      element: "Data Analysis",
      role: "Durations & timelines",
      columns: ["State", "Duration", "Time fraction"],
      rows: states.map((s) => row(s, [formatDuration(s.meanDurationHours), timeFraction(s)])),
    },
  ];
  return { retainedCount: states.length, lanes };
}

function frequencyValue(freq: Frequency | FrequencyWithDistribution): number {
  return typeof freq === "number" ? freq : freq.value;
}

interface CycleReconciliationView {
  summedHours: number;
  totalCycleHours: number;
  deltaHours: number;
  withinTolerance: boolean;
}

function cycleReconciliation(pos: PlantOperatingStatesAnalysis): CycleReconciliationView {
  const summedHours = pos.plantOperatingStates.reduce((acc, s) => acc + s.meanDurationHours, 0);
  const totalCycleHours = cycleHours(pos);
  const deltaHours = summedHours - totalCycleHours;
  const withinTolerance = Math.abs(deltaHours) <= 1;
  return { summedHours, totalCycleHours, deltaHours, withinTolerance };
}

interface QuantStateView {
  uuid: string;
  name: string;
  description: string;
  mode: string;
  durationHours: number;
  frequencyPerYear: number;
  basis: string;
  durationFraction: number;
  retained: boolean;
  hasPreopAssumption: boolean;
}

function quantStatesView(pos: PlantOperatingStatesAnalysis): QuantStateView[] {
  const screenedOut = new Set(pos.screeningRecords.filter((r) => !r.retained).map((r) => r.posId));
  const cycle = cycleHours(pos);
  return pos.plantOperatingStates.map((s) => ({
    uuid: s.uuid,
    name: s.name,
    description: s.description,
    mode: s.operatingMode,
    durationHours: s.meanDurationHours,
    frequencyPerYear: frequencyValue(s.meanEntryFrequency),
    basis: s.durationAndCycleTimingBasis ?? "",
    durationFraction: s.meanDurationHours / cycle,
    retained: !screenedOut.has(s.uuid),
    hasPreopAssumption: (s.preOperationalAssumptions ?? []).length > 0,
  }));
}

interface GroupRollupView {
  id: string;
  name: string;
  memberCount: number;
  storedDurationHours: number;
  memberDurationHours: number;
  durationMatches: boolean;
  entryFreqPerYear: number;
}

function groupRollupView(pos: PlantOperatingStatesAnalysis): GroupRollupView[] {
  const byId = new Map(pos.plantOperatingStates.map((s) => [s.uuid, s]));
  return (pos.plantOperatingStateGroups ?? []).map((g) => {
    const members = g.memberPosIds
      .map((id) => byId.get(id))
      .filter((s): s is PlantOperatingState => s !== undefined);
    const memberDurationHours = members.reduce((acc, s) => acc + s.meanDurationHours, 0);
    const storedDurationHours = g.summedDurationHours;
    return {
      id: g.uuid,
      name: groupLabel(g.name),
      memberCount: members.length,
      storedDurationHours,
      memberDurationHours,
      durationMatches: Math.abs(storedDurationHours - memberDurationHours) <= 1,
      entryFreqPerYear: frequencyValue(g.entryFrequency),
    };
  });
}

function decayHeatFraction(timeAfterShutdownHours: number, operatingDays: number): number {
  if (timeAfterShutdownHours <= 0 || operatingDays <= 0) return 0;
  const t = timeAfterShutdownHours * 3600;
  const ts = operatingDays * 24 * 3600;
  return 0.0622 * (Math.pow(t, -0.2) - Math.pow(ts + t, -0.2));
}

function decayHeatWignerWay(timeAfterShutdownHours: number, operatingPowerMw: number, operatingDays: number): number {
  return decayHeatFraction(timeAfterShutdownHours, operatingDays) * operatingPowerMw;
}

interface DecayHeatMethod {
  id: string;
  label: string;
  needsOperatingDays: boolean;
  compute: (timeAfterShutdownHours: number, operatingPowerMw: number, operatingDays: number) => number;
}

const DECAY_HEAT_METHODS: DecayHeatMethod[] = [
  { id: "wigner-way", label: "Wigner-Way correlation", needsOperatingDays: true, compute: decayHeatWignerWay },
];

function decayHeatFromCurve(points: { hours: number; fractionOfPower: number }[], timeAfterShutdownHours: number, operatingPowerMw: number): number {
  const usable = points.filter((p) => p.hours > 0 && p.fractionOfPower > 0).sort((a, b) => a.hours - b.hours);
  if (usable.length === 0) return 0;
  const t = timeAfterShutdownHours;
  if (t <= usable[0].hours) return usable[0].fractionOfPower * operatingPowerMw;
  const last = usable[usable.length - 1];
  if (t >= last.hours) return last.fractionOfPower * operatingPowerMw;
  for (let i = 0; i < usable.length - 1; i++) {
    const a = usable[i];
    const b = usable[i + 1];
    if (t >= a.hours && t <= b.hours) {
      const u = (Math.log(t) - Math.log(a.hours)) / (Math.log(b.hours) - Math.log(a.hours));
      const lf = Math.log(a.fractionOfPower) + u * (Math.log(b.fractionOfPower) - Math.log(a.fractionOfPower));
      return Math.exp(lf) * operatingPowerMw;
    }
  }
  return last.fractionOfPower * operatingPowerMw;
}

export {
  type Stage,
  type CoverageView,
  type DecayHeatMethod,
  type CycleReconciliationView,
  type QuantStateView,
  type GroupRollupView,
  type MutualExclusivityView,
  type TransitionValidationView,
  type HandoffBundleView,
  coverageView,
  mutualExclusivityView,
  transitionValidationView,
  DELINEATION_PARAMETER_OPTIONS,
  handoffBundleView,
  cycleReconciliation,
  quantStatesView,
  groupRollupView,
  DECAY_HEAT_METHODS,
  decayHeatFromCurve,
  type RcsView,
  type StateView,
  type EvolutionView,
  type GroupView,
  type InterviewView,
  type ScreeningEditorView,
  type ReviewerView,
  type CommentView,
  type CcSnapshotView,
  type NewlyDevelopedMethodView,
  type PreOpAssumptionView,
  statesView,
  evolutionsView,
  groupsView,
  interviewsView,
  screeningEditorView,
  stepIndexById,
  filterConformance,
  deriveConformance,
  groupBySection,
  ccScore,
  isBarrierBroken,
  stateLabel,
  evolutionLabel,
  groupLabel,
  methodLabel,
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
