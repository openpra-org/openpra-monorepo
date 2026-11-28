import type {
  DependencyModels,
  EsTimingSource,
  EventSequence,
  EventSequenceAnalysis,
  LinkedOperatorActionDetail,
  LinkedPhenomenonDetail,
  OperatorActionWindow,
  PhenomenologicalDependencyModel,
  SequenceTiming,
} from "./event-sequence-analysis";
import type { HumanReliabilityAnalysis } from "../hr/human-reliability-analysis";
import type { SuccessCriteriaDevelopment } from "../sc/success-criteria-development";

export interface EsLinkedSources {
  sc?: SuccessCriteriaDevelopment;
  hr?: HumanReliabilityAnalysis;
  scMissionHours?: ReadonlyMap<string, number>;
}

type EsWindowField =
  | "action"
  | "cue"
  | "cueMinutes"
  | "windowStartMinutes"
  | "windowEndMinutes"
  | "requiredMinutes"
  | "applicableInitiatingEvents"
  | "applicablePlantOperatingStates";

interface EsLinkedWindow {
  row: OperatorActionWindow;
  provided: ReadonlySet<EsWindowField>;
}

interface EsLinkedCondition {
  uuid: string;
  name: string;
  phenomenon: string;
  references: string[];
}

const SC_MILESTONE_PREFIX = "sc-mission-";

const LINKED_WINDOW_PREFIX = "linked-window-";

const NO_SOURCES: EsLinkedSources = {};

const HR_WINDOW_FIELDS: readonly EsWindowField[] = ["action", "cue", "cueMinutes", "windowStartMinutes", "windowEndMinutes", "requiredMinutes", "applicablePlantOperatingStates"];

const UNIT_MINUTES: { prefix: string; minutes: number }[] = [
  { prefix: "day", minutes: 1440 },
  { prefix: "hour", minutes: 60 },
  { prefix: "hr", minutes: 60 },
  { prefix: "h", minutes: 60 },
  { prefix: "min", minutes: 1 },
  { prefix: "sec", minutes: 1 / 60 },
  { prefix: "s", minutes: 1 / 60 },
];

function parseMinutes(text: string): number | undefined {
  const tokens = text.toLowerCase().split(" ").map((token) => token.trim()).filter((token) => token.length > 0);
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const value = Number((tokens[index] ?? "").split(",").join(""));
    if (!Number.isFinite(value)) continue;
    const unit = tokens[index + 1] ?? "";
    const match = UNIT_MINUTES.find((entry) => unit.startsWith(entry.prefix));
    if (match !== undefined) return value * match.minutes;
  }
  return undefined;
}

function linkedMilestone(sequenceId: string, sources: EsLinkedSources): SequenceTiming | undefined {
  const sc = sources.sc;
  if (sc === undefined) return undefined;
  const mission = sc.missionTimes.find((entry) => entry.eventSequenceReference === sequenceId);
  if (mission === undefined) return undefined;
  const hours = sources.scMissionHours?.get(mission.uuid);
  if (hours === undefined) return undefined;
  const references = [...new Set([
    ...mission.analysisReferences,
    ...(sc.thermalFluidAnalyses ?? []).filter((analysis) => analysis.eventSequencesAnalyzed.includes(sequenceId)).map((analysis) => analysis.engineeringAnalysisId),
  ])];
  return {
    uuid: `${SC_MILESTONE_PREFIX}${mission.uuid}`,
    event: "Mission time",
    timeAfterInitiator: hours * 60,
    category: "MISSION_TIME",
    basis: mission.basis,
    deterministicAnalysisReferences: references,
    importedFrom: ["SC"],
  };
}

function ownMilestone(entry: SequenceTiming): boolean {
  return entry.overridesLink === true || (entry.importedFrom === undefined && !entry.uuid.startsWith(SC_MILESTONE_PREFIX));
}

function timelineView(sequence: EventSequence, sources: EsLinkedSources): EventSequence {
  const linked = linkedMilestone(sequence.uuid, sources);
  if (sequence.timing === undefined && linked === undefined) return sequence;
  const own = (sequence.timing ?? []).filter(ownMilestone);
  return { ...sequence, timing: linked === undefined || own.some((entry) => entry.uuid === linked.uuid) ? own : [...own, linked] };
}

function timelineSaved(sequence: EventSequence): EventSequence {
  if (sequence.timing === undefined) return sequence;
  const { timing, ...rest } = sequence;
  const kept = timing.filter((entry) => entry.overridesLink === true || entry.importedFrom === undefined);
  return kept.length === 0 ? rest : { ...rest, timing: kept };
}

function esMilestoneIsLinked(sequenceId: string, uuid: string, sources: EsLinkedSources): boolean {
  return linkedMilestone(sequenceId, sources)?.uuid === uuid;
}

function linkedActionIds(sources: EsLinkedSources): string[] {
  const fromHr = (sources.hr?.humanFailureEvents ?? []).filter((hfe) => hfe.hfeTiming === "POST_INITIATOR").map((hfe) => hfe.uuid);
  const fromSc = (sources.sc?.humanActionSuccessCriteria ?? []).map((criterion) => criterion.humanActionId);
  return [...new Set([...fromHr, ...fromSc])];
}

function blankWindow(humanActionId: string): OperatorActionWindow {
  return { uuid: `${LINKED_WINDOW_PREFIX}${humanActionId}`, humanActionId, action: "", windowStartMinutes: 0, windowEndMinutes: 0, requiredMinutes: 0, implementsSrs: [] };
}

function linkedWindow(base: OperatorActionWindow, sources: EsLinkedSources): EsLinkedWindow {
  const provided = new Set<EsWindowField>();
  const from: EsTimingSource[] = [];
  let row = base;
  const hr = sources.hr;
  const hfe = hr?.humanFailureEvents.find((candidate) => candidate.uuid === base.humanActionId && candidate.hfeTiming === "POST_INITIATOR");
  if (hr !== undefined && hfe !== undefined) {
    const recoveries = new Set((hr.recoveryActions ?? []).map((recovery) => recovery.hepQuantificationId));
    const quantification = hr.hepQuantifications.find((candidate) => candidate.hfeId === hfe.uuid && !recoveries.has(candidate.uuid));
    const sequenceCues = (hfe.responseDetail?.cueTimingBySequence ?? []).flatMap((entry) => (entry.cueTimeMinutes === undefined ? [] : [entry.cueTimeMinutes]));
    const cueMinutes = quantification?.cueArrivalTimeMinutes ?? (sequenceCues.length === 0 ? undefined : Math.min(...sequenceCues));
    const cue = hfe.responseDetail?.cueDescription ?? "";
    const start = cueMinutes ?? 0;
    const { cue: _cue, cueMinutes: _cueMinutes, ...kept } = row;
    row = {
      ...kept,
      action: hfe.name,
      ...(cue.length > 0 ? { cue } : {}),
      ...(cueMinutes === undefined ? {} : { cueMinutes }),
      windowStartMinutes: start,
      windowEndMinutes: start + (quantification?.timeAvailableMinutes ?? 0),
      requiredMinutes: quantification?.timeRequiredMinutes ?? 0,
      ...(hfe.applicableInitiatingEvents === undefined ? {} : { applicableInitiatingEvents: hfe.applicableInitiatingEvents }),
      applicablePlantOperatingStates: hfe.applicablePlantOperatingStates,
    };
    from.push("HRA");
    for (const field of HR_WINDOW_FIELDS) provided.add(field);
    if (hfe.applicableInitiatingEvents !== undefined) provided.add("applicableInitiatingEvents");
  }
  const criterion = (sources.sc?.humanActionSuccessCriteria ?? []).find((candidate) => candidate.humanActionId === base.humanActionId);
  if (criterion !== undefined) {
    const available = parseMinutes(criterion.timeAvailable);
    const closes = available !== undefined ? row.windowStartMinutes + available : provided.has("windowEndMinutes") ? row.windowEndMinutes : row.windowStartMinutes;
    row = {
      ...row,
      ...(provided.has("action") ? {} : { action: criterion.description }),
      windowEndMinutes: closes,
    };
    from.push("SC");
    provided.add("action");
    provided.add("windowEndMinutes");
  }
  return { row: { ...row, uuid: `${LINKED_WINDOW_PREFIX}${base.humanActionId}`, importedFrom: from }, provided };
}

function esWindowLink(humanActionId: string, sources: EsLinkedSources): EsLinkedWindow | undefined {
  return linkedActionIds(sources).includes(humanActionId) ? linkedWindow(blankWindow(humanActionId), sources) : undefined;
}

function withoutWindowTag(row: OperatorActionWindow): OperatorActionWindow {
  const { importedFrom: _from, ...rest } = row;
  return rest;
}

function typedWindowDetail(row: OperatorActionWindow): LinkedOperatorActionDetail {
  const groups = row.applicableInitiatingEvents ?? [];
  const states = row.applicablePlantOperatingStates ?? [];
  const feasibility = row.feasibility ?? {};
  return {
    humanActionId: row.humanActionId,
    ...(row.cue === undefined || row.cue.length === 0 ? {} : { cue: row.cue }),
    ...(row.cueMinutes === undefined ? {} : { cueMinutes: row.cueMinutes }),
    ...(row.windowStartMinutes === 0 ? {} : { windowStartMinutes: row.windowStartMinutes }),
    ...(row.windowEndMinutes === 0 ? {} : { windowEndMinutes: row.windowEndMinutes }),
    ...(row.requiredMinutes === 0 ? {} : { requiredMinutes: row.requiredMinutes }),
    ...(row.hepPointEstimate === undefined ? {} : { hepPointEstimate: row.hepPointEstimate }),
    ...(Object.keys(feasibility).length === 0 ? {} : { feasibility }),
    ...(groups.length === 0 ? {} : { applicableInitiatingEvents: groups }),
    ...(states.length === 0 ? {} : { applicablePlantOperatingStates: states }),
    ...(row.note === undefined || row.note.length === 0 ? {} : { note: row.note }),
  };
}

function linkedWindowDetail(row: OperatorActionWindow, sources: EsLinkedSources): LinkedOperatorActionDetail {
  const baseline = linkedWindow(blankWindow(row.humanActionId), sources);
  const typed = (field: EsWindowField): boolean => !baseline.provided.has(field);
  const groups = row.applicableInitiatingEvents ?? [];
  const states = row.applicablePlantOperatingStates ?? [];
  const feasibility = row.feasibility ?? {};
  return {
    humanActionId: row.humanActionId,
    ...(typed("cue") && row.cue !== undefined && row.cue.length > 0 ? { cue: row.cue } : {}),
    ...(typed("cueMinutes") && row.cueMinutes !== undefined ? { cueMinutes: row.cueMinutes } : {}),
    ...(typed("windowStartMinutes") && row.windowStartMinutes !== baseline.row.windowStartMinutes ? { windowStartMinutes: row.windowStartMinutes } : {}),
    ...(typed("windowEndMinutes") && row.windowEndMinutes !== baseline.row.windowEndMinutes ? { windowEndMinutes: row.windowEndMinutes } : {}),
    ...(typed("requiredMinutes") && row.requiredMinutes !== baseline.row.requiredMinutes ? { requiredMinutes: row.requiredMinutes } : {}),
    ...(row.hepPointEstimate === undefined ? {} : { hepPointEstimate: row.hepPointEstimate }),
    ...(Object.keys(feasibility).length === 0 ? {} : { feasibility }),
    ...(typed("applicableInitiatingEvents") && groups.length > 0 ? { applicableInitiatingEvents: groups } : {}),
    ...(typed("applicablePlantOperatingStates") && states.length > 0 ? { applicablePlantOperatingStates: states } : {}),
    ...(row.note === undefined || row.note.length === 0 ? {} : { note: row.note }),
  };
}

function detailHasContent(detail: LinkedOperatorActionDetail | LinkedPhenomenonDetail): boolean {
  return Object.keys(detail).length > 1;
}

function windowFromDetail(base: OperatorActionWindow, detail: LinkedOperatorActionDetail | undefined): OperatorActionWindow {
  if (detail === undefined) return base;
  const { humanActionId: _id, ...fields } = detail;
  return { ...base, ...fields };
}

function windowsView(es: EventSequenceAnalysis, sources: EsLinkedSources): { rows: OperatorActionWindow[]; orphans: LinkedOperatorActionDetail[] } {
  const saved = es.operatorActionWindows ?? [];
  const details = es.linkedOperatorActionDetails ?? [];
  const ids = linkedActionIds(sources);
  const consumed = new Set<OperatorActionWindow>();
  const linked = ids.map((humanActionId) => {
    const override = saved.find((row) => row.humanActionId === humanActionId && row.overridesLink === true);
    if (override !== undefined) {
      consumed.add(override);
      return override;
    }
    const typed = saved.find((row) => row.humanActionId === humanActionId);
    if (typed !== undefined) consumed.add(typed);
    const base = windowFromDetail(typed ?? blankWindow(humanActionId), details.find((detail) => detail.humanActionId === humanActionId));
    return linkedWindow(base, sources).row;
  });
  const loose = saved.filter((row) => !consumed.has(row));
  const copies = loose.filter((row) => row.importedFrom !== undefined && row.overridesLink !== true).map(typedWindowDetail).filter(detailHasContent);
  const kept = details.filter((detail) => !ids.includes(detail.humanActionId) && !copies.some((copy) => copy.humanActionId === detail.humanActionId));
  return {
    rows: [...linked, ...loose.filter((row) => row.importedFrom === undefined || row.overridesLink === true).map(withoutWindowTag)],
    orphans: [...kept, ...copies],
  };
}

function windowsSaved(es: EventSequenceAnalysis, sources: EsLinkedSources): { rows: OperatorActionWindow[]; details: LinkedOperatorActionDetail[] } {
  const ids = new Set(linkedActionIds(sources));
  const rows: OperatorActionWindow[] = [];
  const details: LinkedOperatorActionDetail[] = [];
  const seen = new Set<string>();
  for (const row of es.operatorActionWindows ?? []) {
    if (row.overridesLink === true || !ids.has(row.humanActionId) || seen.has(row.humanActionId)) {
      rows.push(withoutWindowTag(row));
      if (row.overridesLink === true) seen.add(row.humanActionId);
      continue;
    }
    seen.add(row.humanActionId);
    const detail = linkedWindowDetail(row, sources);
    if (detailHasContent(detail)) details.push(detail);
  }
  for (const orphan of es.linkedOperatorActionDetails ?? []) {
    if (!ids.has(orphan.humanActionId) && !details.some((detail) => detail.humanActionId === orphan.humanActionId)) details.push(orphan);
  }
  return { rows, details };
}

function linkedConditions(sources: EsLinkedSources): EsLinkedCondition[] {
  return (sources.sc?.radionuclideBarrierCriteria ?? []).flatMap((barrier) => barrier.challengeLoads.map((load, index) => ({
    uuid: `${barrier.uuid}-load-${String(index + 1)}`,
    name: load.loadDescription,
    phenomenon: load.physicalAttributes.join(", "),
    references: barrier.engineeringAnalysisReferences,
  })));
}

function esConditionIsLinked(uuid: string, sources: EsLinkedSources): boolean {
  return linkedConditions(sources).some((condition) => condition.uuid === uuid);
}

function withoutConditionTag(row: PhenomenologicalDependencyModel): PhenomenologicalDependencyModel {
  const { importedFrom: _from, ...rest } = row;
  return rest;
}

function conditionDetail(row: PhenomenologicalDependencyModel): LinkedPhenomenonDetail {
  const conditions = row.environmentalConditions ?? [];
  const impacts = row.systemSpecificImpacts ?? {};
  return {
    conditionId: row.uuid,
    ...(row.description.length === 0 ? {} : { description: row.description }),
    ...(row.onsetTiming === undefined || row.onsetTiming.length === 0 ? {} : { onsetTiming: row.onsetTiming }),
    ...(row.affectedSystems.length === 0 ? {} : { affectedSystems: row.affectedSystems }),
    ...(conditions.length === 0 ? {} : { environmentalConditions: conditions }),
    ...(Object.keys(impacts).length === 0 ? {} : { systemSpecificImpacts: impacts }),
  };
}

function conditionFromDetail(base: PhenomenologicalDependencyModel, detail: LinkedPhenomenonDetail | undefined): PhenomenologicalDependencyModel {
  if (detail === undefined) return base;
  const { conditionId: _id, ...fields } = detail;
  return { ...base, ...fields };
}

function conditionsView(es: EventSequenceAnalysis, sources: EsLinkedSources): { rows: PhenomenologicalDependencyModel[]; orphans: LinkedPhenomenonDetail[] } {
  const saved = es.dependencyModels?.phenomenologicalDependencies ?? [];
  const details = es.linkedPhenomenonDetails ?? [];
  const linked = linkedConditions(sources);
  const consumed = new Set<PhenomenologicalDependencyModel>();
  const rows = linked.map((condition): PhenomenologicalDependencyModel => {
    const current = saved.find((row) => row.uuid === condition.uuid);
    if (current !== undefined) consumed.add(current);
    if (current?.overridesLink === true) return current;
    const blank: PhenomenologicalDependencyModel = { uuid: condition.uuid, name: "", description: "", phenomenon: "", affectedSystems: [], implementsSrs: [] };
    const base = conditionFromDetail(current ?? blank, details.find((detail) => detail.conditionId === condition.uuid));
    return { ...base, name: condition.name, phenomenon: condition.phenomenon, deterministicAnalysisReferences: condition.references, importedFrom: ["SC"] };
  });
  const loose = saved.filter((row) => !consumed.has(row));
  const copies = loose.filter((row) => row.importedFrom !== undefined && row.overridesLink !== true).map(conditionDetail).filter(detailHasContent);
  const kept = details.filter((detail) => !linked.some((condition) => condition.uuid === detail.conditionId) && !copies.some((copy) => copy.conditionId === detail.conditionId));
  return {
    rows: [...rows, ...loose.filter((row) => row.importedFrom === undefined || row.overridesLink === true).map(withoutConditionTag)],
    orphans: [...kept, ...copies],
  };
}

function conditionsSaved(es: EventSequenceAnalysis, sources: EsLinkedSources): { rows: PhenomenologicalDependencyModel[]; details: LinkedPhenomenonDetail[] } {
  const ids = new Set(linkedConditions(sources).map((condition) => condition.uuid));
  const rows: PhenomenologicalDependencyModel[] = [];
  const details: LinkedPhenomenonDetail[] = [];
  for (const row of es.dependencyModels?.phenomenologicalDependencies ?? []) {
    if (row.overridesLink === true || !ids.has(row.uuid)) {
      rows.push(withoutConditionTag(row));
      continue;
    }
    const detail = conditionDetail(row);
    if (detailHasContent(detail)) details.push(detail);
  }
  for (const orphan of es.linkedPhenomenonDetails ?? []) {
    if (!ids.has(orphan.conditionId) && !details.some((detail) => detail.conditionId === orphan.conditionId)) details.push(orphan);
  }
  return { rows, details };
}

function esWithLinkedTiming(saved: EventSequenceAnalysis, sources: EsLinkedSources = NO_SOURCES): EventSequenceAnalysis {
  const windows = windowsView(saved, sources);
  const conditions = conditionsView(saved, sources);
  const { operatorActionWindows: _windows, linkedOperatorActionDetails: _actions, linkedPhenomenonDetails: _phenomena, dependencyModels, ...rest } = saved;
  const held: DependencyModels = dependencyModels ?? {};
  const { phenomenologicalDependencies: _conditions, ...models } = held;
  return {
    ...rest,
    eventSequences: saved.eventSequences.map((sequence) => timelineView(sequence, sources)),
    ...(windows.rows.length === 0 ? {} : { operatorActionWindows: windows.rows }),
    ...(windows.orphans.length === 0 ? {} : { linkedOperatorActionDetails: windows.orphans }),
    ...(dependencyModels === undefined && conditions.rows.length === 0 ? {} : { dependencyModels: conditions.rows.length === 0 ? models : { ...models, phenomenologicalDependencies: conditions.rows } }),
    ...(conditions.orphans.length === 0 ? {} : { linkedPhenomenonDetails: conditions.orphans }),
  };
}

function esWithoutLinkedTiming(view: EventSequenceAnalysis, sources: EsLinkedSources = NO_SOURCES): EventSequenceAnalysis {
  const windows = windowsSaved(view, sources);
  const conditions = conditionsSaved(view, sources);
  const { operatorActionWindows: _windows, linkedOperatorActionDetails: _actions, linkedPhenomenonDetails: _phenomena, dependencyModels, ...rest } = view;
  const held: DependencyModels = dependencyModels ?? {};
  const { phenomenologicalDependencies: _conditions, ...models } = held;
  return {
    ...rest,
    eventSequences: view.eventSequences.map(timelineSaved),
    ...(windows.rows.length === 0 ? {} : { operatorActionWindows: windows.rows }),
    ...(windows.details.length === 0 ? {} : { linkedOperatorActionDetails: windows.details }),
    ...(dependencyModels === undefined ? {} : { dependencyModels: conditions.rows.length === 0 ? models : { ...models, phenomenologicalDependencies: conditions.rows } }),
    ...(conditions.details.length === 0 ? {} : { linkedPhenomenonDetails: conditions.details }),
  };
}

function esHoldsSavedCopies(es: EventSequenceAnalysis): boolean {
  return es.eventSequences.some((sequence) => (sequence.timing ?? []).some((entry) => entry.importedFrom !== undefined))
    || (es.operatorActionWindows ?? []).some((row) => row.importedFrom !== undefined)
    || (es.dependencyModels?.phenomenologicalDependencies ?? []).some((row) => row.importedFrom !== undefined);
}

function esShowsSavedCopies(es: EventSequenceAnalysis): boolean {
  return es.workflowState !== "DRAFT" && es.workflowState !== "REVISION_REQUIRED" && esHoldsSavedCopies(es);
}

function esTypedWindows(es: EventSequenceAnalysis): OperatorActionWindow[] {
  return (es.operatorActionWindows ?? []).filter((row) => row.importedFrom === undefined && row.overridesLink !== true);
}

function esWithTypedWindowsReplaced(es: EventSequenceAnalysis, sources: EsLinkedSources): EventSequenceAnalysis {
  const typed = esTypedWindows(es);
  if (typed.length === 0) return es;
  const linked = new Set(linkedActionIds(sources));
  const moved = typed.filter((row) => linked.has(row.humanActionId)).map((row) => linkedWindowDetail(row, sources)).filter(detailHasContent);
  const kept = (es.linkedOperatorActionDetails ?? []).filter((detail) => !moved.some((entry) => entry.humanActionId === detail.humanActionId));
  const { operatorActionWindows, linkedOperatorActionDetails: _details, ...rest } = es;
  const rows = (operatorActionWindows ?? []).filter((row) => !typed.includes(row));
  const details = [...kept, ...moved];
  return {
    ...rest,
    ...(rows.length === 0 ? {} : { operatorActionWindows: rows }),
    ...(details.length === 0 ? {} : { linkedOperatorActionDetails: details }),
  };
}

export {
  esConditionIsLinked,
  esMilestoneIsLinked,
  esShowsSavedCopies,
  esTypedWindows,
  esWindowLink,
  esWithLinkedTiming,
  esWithTypedWindowsReplaced,
  esWithoutLinkedTiming,
  type EsLinkedWindow,
  type EsWindowField,
};
