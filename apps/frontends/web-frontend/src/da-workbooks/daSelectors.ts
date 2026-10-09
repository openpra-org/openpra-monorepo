import {
  type DaBasicEventNeed,
  type DaCcfGroupNeed,
  type DaDataNeeds,
  type DaHumanErrorNeed,
  type DaInitiatorNeed,
  type DaLinkCode,
  type DaManualEntry,
  type DaNeedChange,
  type DaNeedElement,
  type DaNeedKind,
  type DaNeedSource,
  type DaQuantificationModel,
  type DaScopeDecision,
  type DaScopeKind,
  type DaStateNeed,
  type DaValueHolder,
  type DataAnalysis,
  type DataAnalysisParameter,
  type ParameterType,
} from "interfaces-mef-types/da/data-analysis";
import { carriesUncertainExpression, type SystemBasicEvent, type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { canonicalJson, expressionReferences, lawBounds, modelArguments, unitBounds, type UncertainExpression, type UncertainUnit, type UncertainValue } from "interfaces-mef-types/core/uncertainty";
import { familyText } from "../newly-developed-methods/shared/uncertainText";
import { holdsEstimate } from "interfaces-mef-types/da/data-analysis";
import { FrequencyUnit } from "interfaces-mef-types/core/events";
import { componentUnit, daMissionTimes, lawParameter, parameterPoint, pointState, readyNumber } from "./daLaws";
import { type WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import { legacyExpression } from "interfaces-mef-types/core/legacy-uncertainty-adapter";
import { basicEventMissionTime } from "../sy-workbooks/syMissionTimes";
import { systemFaultTreeBasicEventIds } from "interfaces-mef-types/sy/system-models";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type QuantificationTimeUnit } from "interfaces-mef-types/modeling";
import { type Workbook } from "interfaces-shared-types";
import { type DaUpstream } from "./daWorkbookContext";
import { sourcesComplete } from "./daSourcing";
import { failuresComplete } from "./daFailures";
import { unavailabilityComplete } from "./daUnavailability";
import { ccfComplete } from "./daCcf";
import { frequenciesComplete, stateShares } from "./daFrequencies";
import { uncertaintyComplete } from "./daUncertainty";
import {
  CONFORMANCE_ITEMS,
  DA_SCOPE_KINDS,
  DA_STEPS,
  DA_PERSONA_STEPS,
  NEED_ELEMENT_LABELS,
  MODELS_FOR_KIND,
  QUANTIFICATION_MODELS,
  exampleLinkLabel,
  type DaModelSpec,
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

function scopeDecisionOf(da: DataAnalysis, kind: DaScopeKind): DaScopeDecision | undefined {
  return (da.scopeDecisions ?? []).find((decision) => decision.kind === kind);
}

function excludedScopeSrs(da: DataAnalysis): Map<string, string> {
  const excluded = new Map<string, string>();
  for (const spec of DA_SCOPE_KINDS) {
    const decision = scopeDecisionOf(da, spec.kind);
    if (decision === undefined || decision.included) continue;
    const reason = (decision.exclusionReason ?? "").trim();
    for (const sr of spec.srs) excluded.set(sr, reason.length > 0 ? `Out of scope · ${reason}` : "Out of scope");
  }
  return excluded;
}

function scopeItemsToComplete(da: DataAnalysis): string[] {
  const items: string[] = [];
  if (da.praScope.trim().length === 0) items.push("Write the PRA scope.");
  for (const spec of DA_SCOPE_KINDS) {
    const decision = scopeDecisionOf(da, spec.kind);
    const label = spec.label.toLowerCase();
    if (decision === undefined) items.push(`Set Included or Excluded for ${label}.`);
    else if (!decision.included && (decision.exclusionReason ?? "").trim().length === 0) items.push(`Give a reason for excluding ${label}.`);
  }
  const plan = da.dataPlan ?? {};
  if ((plan.freezeDate ?? "").length === 0) items.push("Set the data freeze date.");
  if (da.plantStage === "OPERATIONAL") {
    const start = plan.dataWindowStart ?? "";
    const end = plan.dataWindowEnd ?? "";
    if (start.length === 0 || end.length === 0) items.push("Set the start and end of the data window.");
    else if (start >= end) items.push("End the data window after it starts.");
  }
  if (plan.modulesPerPlant === undefined) items.push("Set the number of modules per plant.");
  return items;
}

const NEED_ELEMENTS: DaNeedElement[] = ["SY", "IE", "HRA", "POS"];

const HOURS_PER_UNIT: Record<QuantificationTimeUnit, number> = {
  SECOND: 1 / 3600,
  MINUTE: 1 / 60,
  HOUR: 1,
  DAY: 24,
  YEAR: 8760,
};

const HOURS_PER_TIME_UNIT: Partial<Record<UncertainUnit, number>> = {
  HOURS: 1,
  MINUTES: 1 / 60,
  YEARS: 8760,
};

const KIND_BY_FAILURE_MODE: Record<string, DaNeedKind> = {
  FAILURE_TO_START: "DEMAND",
  FAILURE_TO_RUN: "RUNNING",
  TEST_MAINTENANCE: "UNAVAILABILITY",
  HUMAN_ERROR: "HUMAN_ERROR",
  COMMON_CAUSE_FAILURE: "COMMON_CAUSE",
  EXTERNAL_EVENT: "OTHER",
  OTHER: "OTHER",
};

const KIND_SCOPE: Partial<Record<DaNeedKind, DaScopeKind>> = {
  UNAVAILABILITY: "TEST_MAINTENANCE",
  HUMAN_ERROR: "HUMAN_ERROR",
  RECOVERY: "REPAIR_RECOVERY",
  COMMON_CAUSE: "COMMON_CAUSE",
};

function emptyNeeds(): DaDataNeeds {
  return { sources: [], basicEvents: [], initiators: [], humanErrors: [], ccfGroups: [], states: [] };
}

function withNeeds(da: DataAnalysis, fn: (needs: DaDataNeeds) => DaDataNeeds): DataAnalysis {
  return { ...da, dataNeeds: fn(da.dataNeeds ?? emptyNeeds()) };
}

function nextNeedId(prefix: string, ids: readonly string[]): string {
  const taken = new Set(ids.map((id) => id.toLowerCase()));
  let n = ids.length + 1;
  while (taken.has(`${prefix}-${String(n).padStart(2, "0")}`.toLowerCase())) n += 1;
  return `${prefix}-${String(n).padStart(2, "0")}`;
}

function failureModeOf(event: SystemBasicEvent): string | undefined {
  const mode = event.failureMode;
  return typeof mode === "string" && mode.trim().length > 0 ? mode : undefined;
}

function timeHours(expression: UncertainExpression): number | undefined {
  if (expression.node !== "VALUE" || expression.value.law.family !== "POINT") return undefined;
  const factor = HOURS_PER_TIME_UNIT[expression.value.unit];
  return factor === undefined ? undefined : expression.value.law.value * factor;
}

function modelTimes(expression: UncertainExpression | undefined): { kind?: DaNeedKind; testIntervalHours?: number } {
  if (expression?.node !== "MODEL") return {};
  const model = expression.model;
  if (model.form === "MISSION") return { kind: "RUNNING" };
  if (model.form === "STANDBY") return { kind: "STANDBY", testIntervalHours: timeHours(model.testInterval) };
  return {};
}

function missionModelTime(estimate: UncertainExpression | undefined): UncertainExpression | undefined {
  return estimate?.node === "MODEL" && estimate.model.form === "MISSION" ? estimate.model.missionTime : undefined;
}

function missionTimeText(expression: UncertainExpression, hours: number | undefined): string {
  if (expression.node === "PARAMETER") return `mission time ${expression.reference.entityId}`;
  return hours === undefined ? "another mission time" : `${Number(hours.toPrecision(6))} h`;
}

function scTimeOf(reference: WorkbookParameterReference): { component: boolean; sequence: string } | undefined {
  for (const source of daMissionTimes().sources) {
    if (source.workbookId !== reference.workbookId) continue;
    const mission = source.sc.missionTimes.find((entry) => entry.uuid === reference.entityId);
    if (mission !== undefined) return { component: false, sequence: mission.eventSequenceReference };
    const component = (source.sc.componentMissionTimes ?? []).find((entry) => entry.uuid === reference.entityId);
    if (component !== undefined) return { component: true, sequence: component.eventSequenceReference };
  }
  return undefined;
}

function justifiedComponentTime(estimate: UncertainExpression, need: UncertainExpression): boolean {
  if (estimate.node !== "PARAMETER" || need.node !== "PARAMETER") return false;
  const component = scTimeOf(estimate.reference);
  const mission = scTimeOf(need.reference);
  if (component?.component !== true || mission === undefined || mission.component) return false;
  if (component.sequence === mission.sequence) return true;
  const families = daMissionTimes().families;
  const ofComponent = families.get(component.sequence) ?? [];
  const ofMission = families.get(mission.sequence) ?? [];
  return ofComponent.includes(mission.sequence) || ofComponent.some((family) => ofMission.includes(family));
}

function missionTimeDiffers(estimate: UncertainExpression | undefined, need: UncertainExpression | undefined): { need: string; estimate: string } | undefined {
  if (estimate === undefined || need === undefined || canonicalJson(estimate) === canonicalJson(need)) return undefined;
  if (justifiedComponentTime(estimate, need)) return undefined;
  const ours = readyNumber(pointState(estimate, "HOURS"));
  const theirs = readyNumber(pointState(need, "HOURS"));
  if (estimate.node === "PARAMETER" && need.node === "PARAMETER") return { need: missionTimeText(need, theirs), estimate: missionTimeText(estimate, ours) };
  if (ours === undefined || theirs === undefined || ours === theirs) return undefined;
  return { need: missionTimeText(need, theirs), estimate: missionTimeText(estimate, ours) };
}

function expressionValueUnit(expression: UncertainExpression | undefined): "PROBABILITY" | "PER_HOUR" | undefined {
  if (expression === undefined) return undefined;
  if (expression.node === "MODEL") return expression.model.form === "MISSION" || expression.model.form === "STANDBY" ? "PER_HOUR" : "PROBABILITY";
  if (expression.node === "VALUE") return expression.value.unit === "PER_HOUR" || expression.value.unit === "PER_YEAR" ? "PER_HOUR" : "PROBABILITY";
  return "PROBABILITY";
}

function linkedEstimate(expression: UncertainExpression, unit: UncertainUnit | undefined): UncertainExpression {
  if (unit !== "PER_HOUR" || expression.node !== "MODEL") return expression;
  const model = expression.model;
  return model.form === "MISSION" || model.form === "STANDBY" ? model.rate : expression;
}

function importedKindOf(event: SystemBasicEvent): DaNeedKind | undefined {
  if (carriesUncertainExpression(event.failureMode)) {
    const kind = modelTimes(event.expression).kind;
    if (kind !== undefined) return kind;
  }
  if (event.quantificationBasis?.kind === "FAILURE_RATE") return "RUNNING";
  const mode = failureModeOf(event);
  return mode === undefined ? undefined : KIND_BY_FAILURE_MODE[mode];
}

function eventValue(event: SystemBasicEvent): Pick<DaBasicEventNeed, "value" | "valueUnit" | "expression"> {
  if (carriesUncertainExpression(event.failureMode)) return event.expression === undefined ? {} : { expression: event.expression };
  const basis = event.quantificationBasis;
  if (basis?.kind === "FAILURE_RATE") return { value: basis.failureRate.value / HOURS_PER_UNIT[basis.failureRate.unit], valueUnit: "PER_HOUR" };
  return typeof event.probability === "number" && Number.isFinite(event.probability) ? { value: event.probability, valueUnit: "PROBABILITY" } : {};
}

function eventHolder(event: SystemBasicEvent, parameterIds: ReadonlySet<string>, hfeIds: ReadonlySet<string>): Pick<DaBasicEventNeed, "valueHeldBy" | "valueHolderId"> {
  if (carriesUncertainExpression(event.failureMode)) {
    const held = (event.expression === undefined ? [] : expressionReferences(event.expression)).find((reference) => parameterIds.has(reference.entityId.trim()));
    return held === undefined ? { valueHeldBy: "TYPED" } : { valueHeldBy: "DA", valueHolderId: held.entityId.trim() };
  }
  const source = event.controlledDataSource;
  if (source?.referenceType === "WORKBOOK_PARAMETER") return { valueHeldBy: "DA", valueHolderId: source.entityId };
  if (source?.referenceType === "HUMAN_FAILURE_EVENT") return { valueHeldBy: "HRA", valueHolderId: source.entityId };
  const legacy = event.dataAnalysisBasicEventRef;
  if (typeof legacy === "string" && parameterIds.has(legacy)) return { valueHeldBy: "DA", valueHolderId: legacy };
  if (typeof legacy === "string" && hfeIds.has(legacy)) return { valueHeldBy: "HRA", valueHolderId: legacy };
  return { valueHeldBy: "TYPED" };
}

function basicEventNeeds(sy: SystemsAnalysis, parameterIds: ReadonlySet<string>, hfeIds: ReadonlySet<string>): DaBasicEventNeed[] {
  const systemOf = new Map<string, string>();
  for (const model of sy.systemLogicModels) {
    for (const id of systemFaultTreeBasicEventIds(model)) {
      if (!systemOf.has(id)) systemOf.set(id, model.systemReference);
    }
  }
  const definitions = new Map(sy.systemDefinitions.map((definition) => [definition.uuid, definition]));
  return sy.systemBasicEvents.map((event) => {
    const systemId = systemOf.get(event.uuid);
    const definition = systemId === undefined ? undefined : definitions.get(systemId);
    const basis = event.quantificationBasis;
    const times = carriesUncertainExpression(event.failureMode) ? modelTimes(event.expression) : {};
    const missionTime = basicEventMissionTime(sy, event) ?? (basis?.kind === "FAILURE_RATE" ? legacyExpression("HOURS", basis.missionTime.value * HOURS_PER_UNIT[basis.missionTime.unit]) : undefined);
    const kind = importedKindOf(event);
    const mode = failureModeOf(event);
    const need: DaBasicEventNeed = { id: event.uuid, code: event.code, name: event.name, included: true, ...eventValue(event), ...eventHolder(event, parameterIds, hfeIds) };
    if (systemId !== undefined) need.systemId = systemId;
    if (definition !== undefined) need.systemName = definition.abbreviation ?? definition.name;
    if (mode !== undefined) need.failureMode = mode;
    if (kind !== undefined) {
      need.importedKind = kind;
      need.kind = kind;
    }
    if (missionTime !== undefined) {
      need.importedMissionTime = structuredClone(missionTime);
      need.missionTime = structuredClone(missionTime);
    }
    if (times.testIntervalHours !== undefined && Number.isFinite(times.testIntervalHours)) need.testIntervalHours = times.testIntervalHours;
    if (event.repairModeled === true) {
      need.repairCredited = true;
      if (typeof event.meanTimeToRepair === "number") need.meanTimeToRepairHours = event.meanTimeToRepair;
    }
    return need;
  });
}

function initiatorNeeds(ie: InitiatingEventsAnalysis): DaInitiatorNeed[] {
  return ie.initiatingEventGroups.map((group) => {
    const need: DaInitiatorNeed = { id: group.uuid, name: group.name, stateIds: [...group.applicableStates], memberIds: [...group.memberInitiatorIds], included: true };
    if (group.frequency !== undefined) need.frequency = { expression: group.frequency.expression, basis: group.frequency.basis };
    const basis = ie.quantifications.find((quantification) => quantification.initiatorOrGroupId === group.uuid)?.basis;
    if (basis !== undefined) need.frequencyBasis = basis;
    const source = group.controlledDataSource;
    need.valueHeldBy = source === undefined ? "TYPED" : "DA";
    if (source !== undefined) need.valueHolderId = source.entityId;
    return need;
  });
}

function humanErrorNeeds(hr: HumanReliabilityAnalysis): DaHumanErrorNeed[] {
  const events = new Map(hr.humanFailureEvents.map((event) => [event.uuid, event]));
  const recoveries = new Map((hr.recoveryActions ?? []).map((recovery) => [recovery.hepQuantificationId, recovery]));
  const quantified = new Set<string>();
  const rows = hr.hepQuantifications.map((quantification): DaHumanErrorNeed => {
    quantified.add(quantification.hfeId);
    const event = events.get(quantification.hfeId);
    const recovery = recoveries.get(quantification.uuid);
    const need: DaHumanErrorNeed = {
      id: quantification.uuid,
      hfeId: quantification.hfeId,
      name: recovery?.name ?? event?.name ?? quantification.hfeId,
      kind: recovery === undefined ? "HUMAN_ERROR" : "RECOVERY",
      stateIds: [...(event?.applicablePlantOperatingStates ?? [])],
      method: quantification.methodology,
      included: true,
    };
    if (event !== undefined) need.timing = event.hfeTiming;
    const source = quantification.controlledDataSource;
    need.valueHeldBy = source === undefined ? "TYPED" : "DA";
    if (source !== undefined) need.valueHolderId = source.entityId;
    if (typeof quantification.meanHep === "number") {
      need.value = quantification.meanHep;
      need.valueKind = "MEAN";
    } else if (typeof quantification.pointEstimateHep === "number") {
      need.value = quantification.pointEstimateHep;
      need.valueKind = "POINT_ESTIMATE";
    }
    return need;
  });
  const unquantified = hr.humanFailureEvents
    .filter((event) => !quantified.has(event.uuid))
    .map((event): DaHumanErrorNeed => ({ id: event.uuid, hfeId: event.uuid, name: event.name, timing: event.hfeTiming, kind: "HUMAN_ERROR", stateIds: [...event.applicablePlantOperatingStates], included: true }));
  return [...rows, ...unquantified];
}

function ccfGroupNeeds(sy: SystemsAnalysis): DaCcfGroupNeed[] {
  return sy.commonCauseFailureGroups.map((group) => {
    const need: DaCcfGroupNeed = { id: group.uuid, name: group.name, systemIds: [...group.affectedSystems], memberIds: (group.members?.basicEvents ?? []).map((member) => member.id), included: true, factors: group.factors, total: group.total };
    const reference = group.dataAnalysisCCFParameterRef;
    if (typeof reference === "string" && reference.length > 0) need.estimateRef = reference;
    return need;
  });
}

function stateNeeds(pos: PlantOperatingStatesAnalysis): DaStateNeed[] {
  return pos.plantOperatingStates.map((state) => {
    const need: DaStateNeed = { id: state.uuid, name: state.name, mode: state.operatingMode, included: true };
    if (Number.isFinite(state.meanDurationHours)) need.durationHours = state.meanDurationHours;
    const entries = typeof state.meanEntryFrequency === "number" ? state.meanEntryFrequency : state.meanEntryFrequency.value;
    if (Number.isFinite(entries)) need.entriesPerYear = entries;
    need.valueHeldBy = state.outageSource === undefined ? "TYPED" : "DA";
    return need;
  });
}

function upstreamLoaded(upstream: DaUpstream, element: DaNeedElement): boolean {
  switch (element) {
    case "SY": return upstream.sy !== undefined;
    case "IE": return upstream.ie !== undefined;
    case "HRA": return upstream.hr !== undefined;
    case "POS": return upstream.pos !== undefined;
  }
}

function daNeedsLinked(da: DataAnalysis): DaNeedElement[] {
  const links = da.linkedWorkbooks ?? {};
  return NEED_ELEMENTS.filter((element) => links[element] !== undefined);
}

function daNeedsImportReady(da: DataAnalysis, upstream: DaUpstream): boolean {
  const linked = daNeedsLinked(da);
  return linked.length > 0 && linked.every((element) => upstreamLoaded(upstream, element));
}

function daImportNeeds(da: DataAnalysis, upstream: DaUpstream, now: string): DaDataNeeds {
  const links = da.linkedWorkbooks ?? {};
  const sources: DaNeedSource[] = [];
  for (const element of NEED_ELEMENTS) {
    const id = links[element];
    if (id === undefined || !upstreamLoaded(upstream, element)) continue;
    const option = upstream.options[element].find((workbook) => workbook.id === id);
    const source: DaNeedSource = { element, workbookId: id, workbookName: option?.name ?? exampleLinkLabel(id) ?? id };
    if (option !== undefined) source.updatedAt = option.updatedAt;
    sources.push(source);
  }
  const parameterIds = new Set(da.parameters.map((parameter) => parameter.uuid));
  const hfeIds = new Set((upstream.hr?.humanFailureEvents ?? []).map((event) => event.uuid));
  const sy = links.SY === undefined ? undefined : upstream.sy;
  const ie = links.IE === undefined ? undefined : upstream.ie;
  const hr = links.HRA === undefined ? undefined : upstream.hr;
  const pos = links.POS === undefined ? undefined : upstream.pos;
  return {
    importedAt: now,
    sources,
    basicEvents: sy === undefined ? [] : basicEventNeeds(sy, parameterIds, hfeIds),
    initiators: ie === undefined ? [] : initiatorNeeds(ie),
    humanErrors: hr === undefined ? [] : humanErrorNeeds(hr),
    ccfGroups: sy === undefined ? [] : ccfGroupNeeds(sy),
    states: pos === undefined ? [] : stateNeeds(pos),
  };
}

function basicEventKey(need: DaBasicEventNeed): string {
  return JSON.stringify([need.code, need.name, need.systemId, need.failureMode, need.importedKind, need.importedMissionTime === undefined ? null : canonicalJson(need.importedMissionTime), need.value, need.valueUnit, need.expression === undefined ? null : canonicalJson(need.expression), need.valueHeldBy, need.valueHolderId, need.repairCredited, need.meanTimeToRepairHours]);
}

function initiatorKey(need: DaInitiatorNeed): string {
  return JSON.stringify([need.name, need.stateIds, need.memberIds, need.frequency === undefined ? null : canonicalJson(need.frequency), need.frequencyBasis, need.valueHeldBy, need.valueHolderId]);
}

function humanErrorKey(need: DaHumanErrorNeed): string {
  return JSON.stringify([need.hfeId, need.name, need.timing, need.kind, need.value, need.valueKind, need.method, need.stateIds, need.valueHeldBy, need.valueHolderId]);
}

function ccfGroupKey(need: DaCcfGroupNeed): string {
  return JSON.stringify([need.name, need.systemIds, need.memberIds, need.factors === undefined ? null : canonicalJson(need.factors), need.total === undefined ? null : canonicalJson(need.total), need.estimateRef]);
}

function stateKey(need: DaStateNeed): string {
  return JSON.stringify([need.name, need.mode, need.durationHours, need.entriesPerYear, need.valueHeldBy]);
}

function mergeBasicEvents(previous: readonly DaBasicEventNeed[], next: readonly DaBasicEventNeed[], changes: DaNeedChange[]): DaBasicEventNeed[] {
  const before = new Map(previous.filter((need) => need.manual === undefined).map((need) => [need.id, need]));
  const nextIds = new Set(next.map((need) => need.id));
  const merged = next.map((need) => {
    const old = before.get(need.id);
    if (old === undefined) {
      changes.push({ element: "SY", id: need.id, change: "ADDED" });
      return need;
    }
    if (basicEventKey(old) !== basicEventKey(need)) changes.push({ element: "SY", id: need.id, change: "CHANGED" });
    const kind = old.kind !== old.importedKind ? old.kind : need.importedKind;
    const missionTime = sameMissionTime(old.missionTime, old.importedMissionTime) ? need.importedMissionTime : old.missionTime;
    const { kind: _kind, missionTime: _missionTime, ...base } = need;
    const result: DaBasicEventNeed = { ...base, included: old.included };
    if (kind !== undefined) result.kind = kind;
    if (missionTime !== undefined) result.missionTime = missionTime;
    if (old.testIntervalHours !== undefined) result.testIntervalHours = old.testIntervalHours;
    else if (need.testIntervalHours !== undefined) result.testIntervalHours = need.testIntervalHours;
    if (old.changeReason !== undefined) result.changeReason = old.changeReason;
    if (old.exclusionReason !== undefined) result.exclusionReason = old.exclusionReason;
    if (old.parameterId !== undefined) result.parameterId = old.parameterId;
    return result;
  });
  for (const old of before.values()) {
    if (!nextIds.has(old.id)) changes.push({ element: "SY", id: old.id, change: "REMOVED", label: old.code });
  }
  return [...merged, ...previous.filter((need) => need.manual !== undefined)];
}

function mergeRows<T extends { id: string; included: boolean; exclusionReason?: string; parameterId?: string; manual?: DaManualEntry }>(
  element: DaNeedElement,
  previous: readonly T[],
  next: readonly T[],
  keyOf: (row: T) => string,
  changes: DaNeedChange[],
): T[] {
  const before = new Map(previous.filter((row) => row.manual === undefined).map((row) => [row.id, row]));
  const nextIds = new Set(next.map((row) => row.id));
  const merged = next.map((row): T => {
    const old = before.get(row.id);
    if (old === undefined) {
      changes.push({ element, id: row.id, change: "ADDED" });
      return row;
    }
    if (keyOf(old) !== keyOf(row)) changes.push({ element, id: row.id, change: "CHANGED" });
    const kept = old.parameterId === undefined ? { ...row, included: old.included } : { ...row, included: old.included, parameterId: old.parameterId };
    return old.exclusionReason === undefined ? kept : { ...kept, exclusionReason: old.exclusionReason };
  });
  for (const old of before.values()) {
    if (!nextIds.has(old.id)) changes.push({ element, id: old.id, change: "REMOVED" });
  }
  return [...merged, ...previous.filter((row) => row.manual !== undefined)];
}

function withNeedsMerged(previous: DaDataNeeds | undefined, next: DaDataNeeds): DaDataNeeds {
  if (previous === undefined) return next;
  const changes: DaNeedChange[] = [];
  const merged: DaDataNeeds = {
    ...next,
    basicEvents: mergeBasicEvents(previous.basicEvents, next.basicEvents, changes),
    initiators: mergeRows("IE", previous.initiators, next.initiators, initiatorKey, changes),
    humanErrors: mergeRows("HRA", previous.humanErrors, next.humanErrors, humanErrorKey, changes),
    ccfGroups: mergeRows("SY", previous.ccfGroups, next.ccfGroups, ccfGroupKey, changes),
    states: mergeRows("POS", previous.states, next.states, stateKey, changes),
  };
  return previous.importedAt === undefined ? merged : { ...merged, changes };
}

function sameMissionTime(left: UncertainExpression | undefined, right: UncertainExpression | undefined): boolean {
  return left === undefined || right === undefined ? left === right : canonicalJson(left) === canonicalJson(right);
}

function basicEventEdited(need: DaBasicEventNeed): boolean {
  return need.manual === undefined && (need.kind !== need.importedKind || !sameMissionTime(need.missionTime, need.importedMissionTime));
}

function needManualCount(needs: DaDataNeeds | undefined): number {
  if (needs === undefined) return 0;
  return [needs.basicEvents, needs.initiators, needs.humanErrors, needs.ccfGroups, needs.states]
    .reduce((count, rows) => count + rows.filter((row) => row.manual !== undefined).length, 0);
}

function needChangeOf(needs: DaDataNeeds, element: DaNeedElement, id: string): DaNeedChange["change"] | undefined {
  return needs.changes?.find((change) => change.element === element && change.id === id)?.change;
}

type DaFindingSeverity = "error" | "warning" | "note";

type DaNeedWindowKind = "needEvent" | "needInitiator" | "needHuman" | "needCcf" | "needState" | "daParameter" | "daBoundary" | "daFailureMode" | "daGroup" | "daOutlier" | "daSource" | "daEntry" | "daSourcing" | "daElicitation" | "daPrior" | "daEvidence" | "daEstimate" | "daRecordSet" | "daRecord" | "daRule" | "daDesignChange" | "daDemand" | "daHours" | "daMaintenance" | "daRestoration" | "daOutage" | "daCcfGroup" | "daCcfEvents" | "daCcfFactors" | "daFrequency" | "daDistribution" | "daUncertaintySource" | "daSensitivity" | "daAssumption" | "daImportance";

interface DaNeedFinding {
  severity: DaFindingSeverity;
  check: string;
  item: string;
  detail: string;
  target?: { kind: DaNeedWindowKind; id: string };
}

const FINDING_RANK: Record<DaFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function repeatedKeys(keys: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const key of keys) {
    const normal = key.trim().toLowerCase();
    if (seen.has(normal)) repeated.add(key);
    seen.add(normal);
  }
  return [...repeated];
}

function scopeIsExcluded(da: DataAnalysis, kind: DaScopeKind): boolean {
  const decision = scopeDecisionOf(da, kind);
  return decision !== undefined && !decision.included;
}

function scopeIsIncluded(da: DataAnalysis, kind: DaScopeKind): boolean {
  return scopeDecisionOf(da, kind)?.included === true;
}

function scopeLabel(kind: DaScopeKind): string {
  return (DA_SCOPE_KINDS.find((spec) => spec.kind === kind)?.label ?? kind).toLowerCase();
}

function frequencyUnitText(unit: FrequencyUnit): string {
  return unit.split("-").join(" ");
}

function manualFindings(row: { name: string; manual?: DaManualEntry }, item: string, noun: string, target: DaNeedFinding["target"]): DaNeedFinding[] {
  if (row.manual === undefined) return [];
  const findings: DaNeedFinding[] = [];
  if (blank(row.name)) findings.push({ severity: "warning", check: "No name", item, detail: `Name the ${noun}.`, target });
  if (blank(row.manual.source)) findings.push({ severity: "warning", check: "Source not given", item, detail: "Say where this need comes from.", target });
  return findings;
}

function sourceFindings(da: DataAnalysis, needs: DaDataNeeds, options?: Record<DaLinkCode, Workbook[]>): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  const links = da.linkedWorkbooks ?? {};
  for (const source of needs.sources) {
    const label = NEED_ELEMENT_LABELS[source.element];
    const linkedId = links[source.element];
    if (linkedId !== source.workbookId) {
      findings.push({ severity: "warning", check: "Link changed", item: label, detail: linkedId === undefined ? `${label} is no longer linked. Its items stay until you import again.` : `Step 01 now links a different ${label} workbook. Import again to use it.` });
      continue;
    }
    const option = options?.[source.element].find((workbook) => workbook.id === source.workbookId);
    if (option !== undefined && source.updatedAt !== undefined && option.updatedAt > source.updatedAt) {
      findings.push({ severity: "warning", check: "Source changed", item: label, detail: `The ${label} workbook changed after the import. Import again to bring in the changes.` });
    }
  }
  if (needs.importedAt !== undefined) {
    for (const element of NEED_ELEMENTS) {
      if (links[element] !== undefined && !needs.sources.some((source) => source.element === element)) {
        findings.push({ severity: "warning", check: "Not imported", item: NEED_ELEMENT_LABELS[element], detail: `${NEED_ELEMENT_LABELS[element]} is linked, but nothing was imported from it. Import again.` });
      }
    }
  }
  return findings;
}

function basicEventFindings(da: DataAnalysis, needs: DaDataNeeds): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  const hfeIds = new Set(needs.humanErrors.map((need) => need.hfeId));
  const parameterIds = new Set(da.parameters.map((parameter) => parameter.uuid));
  for (const code of repeatedKeys(needs.basicEvents.map((need) => need.code))) {
    const id = needs.basicEvents.find((need) => need.code === code)?.id ?? code;
    findings.push({ severity: "error", check: "Duplicate ID", item: code, detail: "Two basic events share this ID. Give each its own ID.", target: { kind: "needEvent", id } });
  }
  for (const need of needs.basicEvents) {
    const target = { kind: "needEvent" as const, id: need.id };
    const item = need.code.trim().length > 0 ? need.code : need.id;
    findings.push(...manualFindings(need, item, "basic event", target));
    if (!need.included) {
      if (blank(need.exclusionReason)) findings.push({ severity: "error", check: "Excluded without a reason", item, detail: "Give the reason this event is left out.", target });
      continue;
    }
    if (basicEventEdited(need) && blank(need.changeReason)) findings.push({ severity: "error", check: "Edited without a reason", item, detail: "The event type or mission time differs from SY. Give the reason.", target });
    if (need.kind === undefined) findings.push({ severity: "error", check: "No event type", item, detail: "SY gives no failure mode that sets the event type. Set the event type.", target });
    if (need.kind === "RUNNING" && need.missionTime === undefined) findings.push({ severity: "error", check: "No mission time", item, detail: "Enter the mission time for this running failure.", target });
    if (need.kind === "STANDBY" && (need.testIntervalHours === undefined || need.testIntervalHours <= 0)) findings.push({ severity: "error", check: "No test interval", item, detail: "Enter the test interval for this standby failure.", target });
    const scope = need.kind === undefined ? undefined : KIND_SCOPE[need.kind];
    if (scope !== undefined && scopeIsExcluded(da, scope)) findings.push({ severity: "warning", check: "Out of scope", item, detail: `Step 01 leaves ${scopeLabel(scope)} out of scope, but SY models this event.`, target });
    if (need.repairCredited === true && scopeIsExcluded(da, "REPAIR_RECOVERY")) findings.push({ severity: "warning", check: "Out of scope", item, detail: "SY credits repair here, but Step 01 leaves repair and recovery out of scope.", target });
    if (need.valueHeldBy === "HRA" && need.valueHolderId !== undefined && !hfeIds.has(need.valueHolderId)) findings.push({ severity: "warning", check: "HR event missing", item, detail: `SY takes this value from HR event ${need.valueHolderId}, which is not among the human failure events.`, target });
    if (need.valueHeldBy === "DA" && need.valueHolderId !== undefined && !parameterIds.has(need.valueHolderId)) findings.push({ severity: "warning", check: "DA parameter missing", item, detail: `SY takes this value from DA parameter ${need.valueHolderId}, which this workbook does not hold.`, target });
    if (need.manual === undefined && need.valueHeldBy === "TYPED" && need.value === undefined) findings.push({ severity: "note", check: "No value yet", item, detail: "SY holds no value for this event yet.", target });
  }
  if (scopeIsIncluded(da, "TEST_MAINTENANCE") && !needs.basicEvents.some((need) => need.included && need.kind === "UNAVAILABILITY")) {
    findings.push({ severity: "note", check: "Nothing listed", item: "Basic events", detail: "Step 01 includes test and maintenance, but no basic event has that event type." });
  }
  return findings;
}

function initiatorFindings(da: DataAnalysis, needs: DaDataNeeds): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  const stateIds = new Set(needs.states.map((state) => state.id));
  for (const id of repeatedKeys(needs.initiators.map((need) => need.id))) {
    findings.push({ severity: "error", check: "Duplicate ID", item: id, detail: "Two initiator groups share this ID. Give each its own ID.", target: { kind: "needInitiator", id } });
  }
  for (const need of needs.initiators) {
    const target = { kind: "needInitiator" as const, id: need.id };
    findings.push(...manualFindings(need, need.id, "initiator group", target));
    if (!need.included) {
      if (blank(need.exclusionReason)) findings.push({ severity: "error", check: "Excluded without a reason", item: need.id, detail: "Give the reason this group is left out.", target });
      continue;
    }
    if (need.frequency === undefined) findings.push({ severity: "note", check: "No frequency yet", item: need.id, detail: need.manual === undefined ? "IE holds no frequency for this group yet." : "DA estimates this frequency.", target });
    if (need.frequency !== undefined && need.frequency.basis !== FrequencyUnit.PER_PLANT_YEAR) findings.push({ severity: "warning", check: "Frequency unit", item: need.id, detail: `IE gives this frequency ${frequencyUnitText(need.frequency.basis)}. DA works per plant-year.`, target });
    const strayStates = stateIds.size === 0 ? [] : need.stateIds.filter((state) => !stateIds.has(state));
    if (strayStates.length > 0) findings.push({ severity: "warning", check: "Unknown state", item: need.id, detail: `${strayStates.join(", ")} ${strayStates.length === 1 ? "is" : "are"} not among the operating states.`, target });
  }
  const listed = needs.initiators.filter((need) => need.included).length;
  if (scopeIsExcluded(da, "INITIATING_EVENT") && listed > 0) findings.push({ severity: "warning", check: "Out of scope", item: "Initiators", detail: `Step 01 leaves initiating event frequencies out of scope, but ${listed} ${listed === 1 ? "group is" : "groups are"} listed.` });
  if (scopeIsIncluded(da, "INITIATING_EVENT") && needs.initiators.length === 0) findings.push({ severity: "warning", check: "Nothing listed", item: "Initiators", detail: "Step 01 includes initiating event frequencies, but no initiator group is listed. Link IE and import, or add them by hand." });
  return findings;
}

function humanErrorFindings(da: DataAnalysis, needs: DaDataNeeds): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  for (const id of repeatedKeys(needs.humanErrors.map((need) => need.id))) {
    findings.push({ severity: "error", check: "Duplicate ID", item: id, detail: "Two human error rows share this ID. Give each its own ID.", target: { kind: "needHuman", id } });
  }
  for (const need of needs.humanErrors) {
    const target = { kind: "needHuman" as const, id: need.id };
    findings.push(...manualFindings(need, need.hfeId, "human failure event", target));
    if (!need.included) {
      if (blank(need.exclusionReason)) findings.push({ severity: "error", check: "Excluded without a reason", item: need.hfeId, detail: "Give the reason this event is left out.", target });
      continue;
    }
    if (need.value === undefined) findings.push({ severity: "note", check: "No HEP yet", item: need.hfeId, detail: need.manual === undefined ? "HR holds no probability for this event yet." : "DA holds this probability once it is entered.", target });
    if (need.kind === "RECOVERY" && scopeIsExcluded(da, "REPAIR_RECOVERY")) findings.push({ severity: "warning", check: "Out of scope", item: need.hfeId, detail: "HR credits a recovery here, but Step 01 leaves repair and recovery out of scope.", target });
  }
  const listed = needs.humanErrors.filter((need) => need.included).length;
  if (scopeIsExcluded(da, "HUMAN_ERROR") && listed > 0) findings.push({ severity: "warning", check: "Out of scope", item: "Human errors", detail: `Step 01 leaves human error probabilities out of scope, but ${listed} ${listed === 1 ? "row is" : "rows are"} listed.` });
  if (scopeIsIncluded(da, "HUMAN_ERROR") && needs.humanErrors.length === 0) findings.push({ severity: "warning", check: "Nothing listed", item: "Human errors", detail: "Step 01 includes human error probabilities, but no human failure event is listed. Link HR and import, or add them by hand." });
  if (scopeIsIncluded(da, "REPAIR_RECOVERY") && !needs.basicEvents.some((need) => need.included && (need.repairCredited === true || need.kind === "RECOVERY")) && !needs.humanErrors.some((need) => need.included && need.kind === "RECOVERY")) {
    findings.push({ severity: "note", check: "Nothing listed", item: "Repair and recovery", detail: "Step 01 includes repair and recovery, but no event credits repair or recovery." });
  }
  return findings;
}

function ccfGroupFindings(da: DataAnalysis, needs: DaDataNeeds): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  const eventKeys = new Set(needs.basicEvents.flatMap((need) => [need.id, need.code]));
  const estimates = new Set((da.ccfParameterEstimations ?? []).map((estimate) => estimate.uuid));
  for (const id of repeatedKeys(needs.ccfGroups.map((need) => need.id))) {
    findings.push({ severity: "error", check: "Duplicate ID", item: id, detail: "Two common cause groups share this ID. Give each its own ID.", target: { kind: "needCcf", id } });
  }
  for (const need of needs.ccfGroups) {
    const target = { kind: "needCcf" as const, id: need.id };
    findings.push(...manualFindings(need, need.id, "common cause group", target));
    if (!need.included) {
      if (blank(need.exclusionReason)) findings.push({ severity: "error", check: "Excluded without a reason", item: need.id, detail: "Give the reason this group is left out.", target });
      continue;
    }
    if (need.memberIds.length < 2) findings.push({ severity: "error", check: "Too few members", item: need.id, detail: "A common cause group needs at least two members.", target });
    const strayMembers = need.memberIds.filter((member) => !eventKeys.has(member));
    if (strayMembers.length > 0) findings.push({ severity: "error", check: "Unknown member", item: need.id, detail: `${strayMembers.join(", ")} ${strayMembers.length === 1 ? "is" : "are"} not among the basic events.`, target });
    if (need.estimateRef !== undefined && !estimates.has(need.estimateRef)) findings.push({ severity: "warning", check: "DA estimate missing", item: need.id, detail: `SY refers to DA estimate ${need.estimateRef}, which this workbook does not hold.`, target });
  }
  const listed = needs.ccfGroups.filter((need) => need.included).length;
  if (scopeIsExcluded(da, "COMMON_CAUSE") && listed > 0) findings.push({ severity: "warning", check: "Out of scope", item: "Common cause groups", detail: `Step 01 leaves common cause failures out of scope, but ${listed} ${listed === 1 ? "group is" : "groups are"} listed.` });
  if (scopeIsIncluded(da, "COMMON_CAUSE") && needs.ccfGroups.length === 0) findings.push({ severity: "warning", check: "Nothing listed", item: "Common cause groups", detail: "Step 01 includes common cause failures, but no group is listed. Link SY and import, or add them by hand." });
  return findings;
}

function stateFindings(da: DataAnalysis, needs: DaDataNeeds): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  for (const id of repeatedKeys(needs.states.map((need) => need.id))) {
    findings.push({ severity: "error", check: "Duplicate ID", item: id, detail: "Two operating states share this ID. Give each its own ID.", target: { kind: "needState", id } });
  }
  for (const need of needs.states) {
    const target = { kind: "needState" as const, id: need.id };
    findings.push(...manualFindings(need, need.id, "operating state", target));
    if (!need.included) {
      if (blank(need.exclusionReason)) findings.push({ severity: "error", check: "Excluded without a reason", item: need.id, detail: "Give the reason this state is left out.", target });
      continue;
    }
    if (need.durationHours === undefined || need.durationHours <= 0) findings.push({ severity: "warning", check: "No duration", item: need.id, detail: "Enter the hours the plant spends in this state.", target });
  }
  if (scopeIsIncluded(da, "OUTAGE") && needs.states.length === 0) findings.push({ severity: "warning", check: "Nothing listed", item: "Operating states", detail: "Step 01 includes outage data, but no operating state is listed. Link POS and import, or add them by hand." });
  return findings;
}

function daNeedChecks(da: DataAnalysis, options?: Record<DaLinkCode, Workbook[]>): DaNeedFinding[] {
  const needs = da.dataNeeds;
  if (needs === undefined) return [];
  const findings = [
    ...sourceFindings(da, needs, options),
    ...basicEventFindings(da, needs),
    ...initiatorFindings(da, needs),
    ...humanErrorFindings(da, needs),
    ...ccfGroupFindings(da, needs),
    ...stateFindings(da, needs),
  ];
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => FINDING_RANK[a.finding.severity] - FINDING_RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
}

function needsComplete(da: DataAnalysis): boolean {
  const needs = da.dataNeeds;
  if (needs === undefined) return false;
  const listed = needs.basicEvents.length + needs.initiators.length + needs.humanErrors.length + needs.ccfGroups.length;
  return listed > 0 && !daNeedChecks(da).some((finding) => finding.severity === "error");
}

type DaMapElement = "SY" | "IE" | "HRA";

interface DaMappableNeed {
  element: DaMapElement;
  id: string;
  code: string;
  name: string;
  kind?: DaNeedKind;
  included: boolean;
  value?: number;
  expression?: UncertainExpression;
  valueType: "MEAN" | "POINT_ESTIMATE";
  ownerTyped: boolean;
  heldBy?: DaValueHolder;
  parameterId?: string;
  missionTime?: UncertainExpression;
  valueUnit?: "PROBABILITY" | "PER_HOUR";
  stateIds: string[];
  systemId?: string;
  systemName?: string;
}

const COMPONENT_MODELS: ReadonlySet<DaQuantificationModel> = new Set(["DEMAND_PROBABILITY", "RUNNING_RATE", "MISSION_PROBABILITY", "STANDBY_RATE"]);

const PROBABILITY_MODELS_SET: ReadonlySet<DaQuantificationModel> = new Set(["DEMAND_PROBABILITY", "MISSION_PROBABILITY", "UNAVAILABILITY", "HUMAN_ERROR", "NON_RECOVERY", "OTHER_PROBABILITY"]);

function modelSpecOf(model: DaQuantificationModel | undefined): DaModelSpec | undefined {
  return model === undefined ? undefined : QUANTIFICATION_MODELS.find((spec) => spec.model === model);
}

function mappableNeeds(needs: DaDataNeeds | undefined): DaMappableNeed[] {
  if (needs === undefined) return [];
  const events = needs.basicEvents
    .filter((need) => need.kind !== "COMMON_CAUSE")
    .map((need): DaMappableNeed => ({
      element: "SY",
      id: need.id,
      code: need.code,
      name: need.name,
      kind: need.kind,
      included: need.included,
      value: need.value,
      expression: need.expression,
      valueType: "POINT_ESTIMATE",
      ownerTyped: need.manual === undefined && need.valueHeldBy === "TYPED" && (need.value !== undefined || need.expression !== undefined),
      heldBy: need.valueHeldBy,
      parameterId: need.parameterId,
      missionTime: need.missionTime,
      valueUnit: need.valueUnit ?? expressionValueUnit(need.expression),
      stateIds: [],
      systemId: need.systemId,
      systemName: need.systemName,
    }));
  const initiators = needs.initiators.map((need): DaMappableNeed => ({
    element: "IE",
    id: need.id,
    code: need.id,
    name: need.name,
    included: need.included,
    expression: need.frequency?.expression,
    valueType: "MEAN",
    ownerTyped: need.manual === undefined && need.valueHeldBy !== "DA" && need.frequency !== undefined,
    heldBy: need.valueHeldBy,
    parameterId: need.parameterId,
    stateIds: need.stateIds,
  }));
  const humanErrors = needs.humanErrors.map((need): DaMappableNeed => ({
    element: "HRA",
    id: need.id,
    code: need.hfeId,
    name: need.name,
    kind: need.kind,
    included: need.included,
    value: need.value,
    valueType: need.valueKind === "MEAN" ? "MEAN" : "POINT_ESTIMATE",
    ownerTyped: need.manual === undefined && need.valueHeldBy !== "DA" && need.value !== undefined,
    heldBy: need.valueHeldBy,
    parameterId: need.parameterId,
    stateIds: need.stateIds,
  }));
  return [...events, ...initiators, ...humanErrors];
}

function modelsForNeed(need: DaMappableNeed): DaQuantificationModel[] {
  if (need.element === "IE") return ["FREQUENCY"];
  return need.kind === undefined ? [] : MODELS_FOR_KIND[need.kind];
}

function defaultModelFor(need: DaMappableNeed, parameterType?: ParameterType): DaQuantificationModel | undefined {
  if (need.element === "IE") return "FREQUENCY";
  if (need.kind === "RUNNING") return parameterType === "FAILURE_RATE" || need.valueUnit === "PER_HOUR" ? "RUNNING_RATE" : "MISSION_PROBABILITY";
  return need.kind === undefined ? undefined : MODELS_FOR_KIND[need.kind][0];
}

function parameterStates(parameter: DataAnalysisParameter): string[] {
  if (parameter.stateIds !== undefined) return parameter.stateIds;
  return parameter.plantOperatingStateRef === undefined ? [] : [parameter.plantOperatingStateRef];
}

function withNeedParameter(da: DataAnalysis, element: DaMapElement, needId: string, parameterId: string | undefined): DataAnalysis {
  const needs = da.dataNeeds;
  if (needs === undefined) return da;
  const assign = <T extends { id: string; parameterId?: string }>(rows: T[]): T[] => rows.map((row): T => {
    if (row.id !== needId) return row;
    return { ...row, parameterId };
  });
  const nextNeeds: DaDataNeeds = {
    ...needs,
    basicEvents: element === "SY" ? assign(needs.basicEvents) : needs.basicEvents,
    initiators: element === "IE" ? assign(needs.initiators) : needs.initiators,
    humanErrors: element === "HRA" ? assign(needs.humanErrors) : needs.humanErrors,
  };
  const need = mappableNeeds(nextNeeds).find((candidate) => candidate.element === element && candidate.id === needId);
  const parameters = da.parameters.map((parameter) => {
    if (parameter.uuid !== parameterId || parameter.quantificationModel !== undefined || need === undefined) return parameter;
    return withModel(parameter, defaultModelFor(need, parameter.parameterType));
  });
  return { ...da, dataNeeds: nextNeeds, parameters };
}

function withModel(parameter: DataAnalysisParameter, model: DaQuantificationModel | undefined): DataAnalysisParameter {
  const spec = modelSpecOf(model);
  if (model === undefined || spec === undefined) return parameter;
  const next: DataAnalysisParameter = { ...parameter, quantificationModel: model, parameterType: spec.parameterType };
  if (holdsEstimate(model)) {
    const unit = componentUnit(next);
    if (next.estimate === undefined && next.value !== undefined && unit !== undefined) next.estimate = { node: "VALUE", value: { unit, law: { family: "POINT", value: next.value } } };
    delete next.value;
    delete next.valueType;
    delete next.uncertainty;
  }
  return next;
}

function nextParameterId(ids: ReadonlySet<string>): string {
  let highest = 0;
  for (const id of ids) {
    if (!id.startsWith("DA-P-")) continue;
    const n = Number(id.slice(5));
    if (Number.isInteger(n) && n > highest) highest = n;
  }
  return `DA-P-${String(highest + 1).padStart(3, "0")}`;
}

function linkedParameter(id: string, need: DaMappableNeed, model: DaQuantificationModel): DataAnalysisParameter {
  const spec = modelSpecOf(model);
  const parameter: DataAnalysisParameter = {
    uuid: id,
    name: need.name.trim().length > 0 ? need.name : need.code,
    parameterType: spec?.parameterType ?? "PROBABILITY",
    quantificationModel: model,
    valueMode: "LINKED",
    valueLink: { element: need.element, needId: need.id },
    implementsSrs: [{ sr: "DA-A1", hlr: "A" }],
  };
  if (holdsEstimate(model)) {
    if (need.expression !== undefined) parameter.estimate = linkedEstimate(need.expression, componentUnit(parameter));
  } else {
    parameter.valueType = need.valueType;
    if (need.value !== undefined) parameter.value = need.value;
  }
  if (need.stateIds.length > 0) parameter.stateIds = [...need.stateIds];
  if (need.systemId !== undefined) parameter.systemReference = need.systemId;
  return parameter;
}

function withAutoMapping(da: DataAnalysis): DataAnalysis {
  const needs = da.dataNeeds;
  if (needs === undefined) return da;
  const parameters = [...da.parameters];
  const ids = new Set(parameters.map((parameter) => parameter.uuid));
  const create = (need: DaMappableNeed, model: DaQuantificationModel): string => {
    const id = nextParameterId(ids);
    ids.add(id);
    parameters.push(linkedParameter(id, need, model));
    return id;
  };
  const views = mappableNeeds(needs);
  const viewOf = (element: DaMapElement, id: string): DaMappableNeed | undefined => views.find((view) => view.element === element && view.id === id);

  const humanErrors = needs.humanErrors.map((need) => {
    const view = viewOf("HRA", need.id);
    if (!need.included || need.parameterId !== undefined || view === undefined) return need;
    if (need.valueHeldBy === "DA" && need.valueHolderId !== undefined && ids.has(need.valueHolderId)) return { ...need, parameterId: need.valueHolderId };
    const existing = parameters.find((parameter) => parameter.basicEventRef === need.hfeId && parameter.parameterType === "HUMAN_ERROR_PROBABILITY");
    if (existing !== undefined) return { ...need, parameterId: existing.uuid };
    if (!view.ownerTyped) return need;
    return { ...need, parameterId: create(view, need.kind === "RECOVERY" ? "NON_RECOVERY" : "HUMAN_ERROR") };
  });
  const hepByHfe = new Map(humanErrors.flatMap((need) => (need.kind === "HUMAN_ERROR" && need.parameterId !== undefined ? [[need.hfeId, need.parameterId] as const] : [])));

  const initiators = needs.initiators.map((need) => {
    const view = viewOf("IE", need.id);
    if (!need.included || need.parameterId !== undefined || view === undefined) return need;
    if (need.valueHeldBy === "DA" && need.valueHolderId !== undefined && ids.has(need.valueHolderId)) return { ...need, parameterId: need.valueHolderId };
    const only = need.memberIds.length === 1 ? need.memberIds[0] : undefined;
    const existing = parameters.find((parameter) => parameter.parameterType === "FREQUENCY" && parameter.basicEventRef !== undefined && (parameter.basicEventRef === need.id || parameter.basicEventRef === only));
    if (existing !== undefined) return { ...need, parameterId: existing.uuid };
    if (!view.ownerTyped) return need;
    return { ...need, parameterId: create(view, "FREQUENCY") };
  });

  const basicEvents = needs.basicEvents.map((need) => {
    const view = viewOf("SY", need.id);
    if (!need.included || need.parameterId !== undefined || view === undefined) return need;
    const holder = need.valueHolderId;
    if (need.valueHeldBy === "DA" && holder !== undefined && ids.has(holder)) return { ...need, parameterId: holder };
    if (need.valueHeldBy === "HRA" && holder !== undefined) {
      const hep = hepByHfe.get(holder);
      if (hep !== undefined) return { ...need, parameterId: hep };
    }
    const model = defaultModelFor(view);
    if (!view.ownerTyped || model === undefined) return need;
    return { ...need, parameterId: create(view, model) };
  });

  const nextNeeds: DaDataNeeds = { ...needs, basicEvents, initiators, humanErrors };
  const mapped = mappableNeeds(nextNeeds);
  const withModels = parameters.map((parameter) => {
    if (parameter.quantificationModel !== undefined) return parameter;
    const first = mapped.find((need) => need.parameterId === parameter.uuid);
    return first === undefined ? parameter : withModel(parameter, defaultModelFor(first, parameter.parameterType));
  });
  return { ...da, parameters: withModels, dataNeeds: nextNeeds };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

function sameValue(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));
}

function withLinkedValuesSynced(da: DataAnalysis): DataAnalysis {
  const views = mappableNeeds(da.dataNeeds);
  let changed = false;
  const parameters = da.parameters.map((parameter) => {
    const link = parameter.valueLink;
    if (parameter.valueMode !== "LINKED" || link === undefined) return parameter;
    const need = views.find((view) => view.element === link.element && view.id === link.needId);
    if (need === undefined || need.heldBy === "DA") return parameter;
    let next = parameter;
    if (lawParameter(parameter)) {
      const expression = need.expression === undefined ? undefined : linkedEstimate(need.expression, componentUnit(parameter));
      if (expression !== undefined && (parameter.estimate === undefined || canonicalJson(parameter.estimate) !== canonicalJson(expression) || parameter.value !== undefined || parameter.valueType !== undefined || parameter.uncertainty !== undefined)) {
        next = { ...next, estimate: expression };
        delete next.value;
        delete next.valueType;
        delete next.uncertainty;
      }
    } else if (need.value !== undefined && (need.value !== parameter.value || need.valueType !== parameter.valueType)) next = { ...next, value: need.value, valueType: need.valueType };
    if (need.stateIds.length > 0 && !sameList(need.stateIds, parameterStates(parameter))) next = { ...next, stateIds: [...need.stateIds] };
    if (next !== parameter) changed = true;
    return next;
  });
  return changed ? { ...da, parameters } : da;
}

function parameterNeeds(da: DataAnalysis, parameterId: string): DaMappableNeed[] {
  return mappableNeeds(da.dataNeeds).filter((need) => need.parameterId === parameterId);
}

function parameterValueText(da: DataAnalysis, parameter: DataAnalysisParameter): string {
  if (parameter.valueMode === "LINKED" && parameter.valueLink !== undefined) {
    const link = parameter.valueLink;
    const need = mappableNeeds(da.dataNeeds).find((view) => view.element === link.element && view.id === link.needId);
    return `Linked · ${NEED_ELEMENT_LABELS[link.element]} ${need?.code ?? link.needId}`;
  }
  if (parameter.valueMode === "CALCULATED") return "Calculated in DA";
  const held = lawParameter(parameter) ? parameter.estimate !== undefined : parameter.value !== undefined;
  return held ? "Typed in DA" : "Not estimated";
}

function valueNodes(expression: UncertainExpression): UncertainValue[] {
  switch (expression.node) {
    case "VALUE": return [expression.value];
    case "PARAMETER": return [];
    case "OPERATION": return expression.operands.flatMap(valueNodes);
    case "MODEL": return modelArguments(expression.model).flatMap(valueNodes);
  }
}

function rangeProblem(expression: UncertainExpression): string | undefined {
  for (const value of valueNodes(expression)) {
    const bounds = lawBounds(value.law);
    const domain = unitBounds(value.unit);
    const law = familyText(value.law.family).toLowerCase();
    if (!(bounds.lower >= domain.lower)) return `The ${law} law goes below 0. Truncate it at 0, or pick a law that stays in range.`;
    if (!(bounds.upper <= domain.upper)) return `The ${law} law goes above 1, but it is a probability. Truncate it at 1, or pick a law that stays in range.`;
  }
  return undefined;
}

function parameterFindings(da: DataAnalysis): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  const needs = mappableNeeds(da.dataNeeds);
  const byId = new Map(da.parameters.map((parameter) => [parameter.uuid, parameter]));
  const boundaries = new Set(da.componentBoundaries.map((boundary) => boundary.uuid));
  const modes = new Set((da.failureModes ?? []).map((mode) => mode.uuid));
  const groups = new Set((da.componentGroupings ?? []).map((group) => group.uuid));
  const stateIds = new Set((da.dataNeeds?.states ?? []).map((state) => state.id));
  for (const id of repeatedKeys(da.parameters.map((parameter) => parameter.uuid))) {
    findings.push({ severity: "error", check: "Duplicate ID", item: id, detail: "Two parameters share this ID.", target: { kind: "daParameter", id } });
  }
  for (const need of needs) {
    if (!need.included) continue;
    const item = need.code;
    if (need.parameterId === undefined) {
      if (modelsForNeed(need).length > 0 || need.element !== "SY") findings.push({ severity: "error", check: "Not mapped", item, detail: "Map this event to a parameter in the event map." });
      continue;
    }
    const parameter = byId.get(need.parameterId);
    if (parameter === undefined) {
      findings.push({ severity: "error", check: "Parameter missing", item, detail: `This event maps to ${need.parameterId}, which does not exist.` });
      continue;
    }
    const model = parameter.quantificationModel;
    if (model !== undefined && !modelsForNeed(need).includes(model)) {
      const allowed = modelsForNeed(need).map((candidate) => modelSpecOf(candidate)?.label.toLowerCase() ?? candidate);
      findings.push({ severity: "error", check: "Model does not fit", item, detail: allowed.length === 0 ? `${parameter.uuid} uses ${modelSpecOf(model)?.label.toLowerCase() ?? model}, but this event has no event type.` : `This event needs ${allowed.join(" or ")}, but ${parameter.uuid} uses ${modelSpecOf(model)?.label.toLowerCase() ?? model}.`, target: { kind: "daParameter", id: parameter.uuid } });
    }
    const differs = model === "MISSION_PROBABILITY" ? missionTimeDiffers(missionModelTime(parameter.estimate), need.missionTime) : undefined;
    if (differs !== undefined) {
      findings.push({ severity: "error", check: "Mission time differs", item, detail: `This event runs ${differs.need}, but the estimate of ${parameter.uuid} is for ${differs.estimate}. Correct the event's mission time in Step 02, link the estimate to the same mission time, or split the parameter.`, target: { kind: "daParameter", id: parameter.uuid } });
    }
    const covered = parameterStates(parameter);
    const uncovered = need.stateIds.filter((state) => !covered.includes(state));
    if (uncovered.length > 0) {
      findings.push({ severity: "error", check: "States not covered", item, detail: `This event applies in ${uncovered.join(", ")}, which ${parameter.uuid} does not cover (DA-A2).`, target: { kind: "daParameter", id: parameter.uuid } });
    }
    const comparable = need.element !== "SY" || (need.valueUnit === "PER_HOUR") === (model === "RUNNING_RATE" || model === "STANDBY_RATE");
    const unit = componentUnit(parameter);
    const theirs = lawParameter(parameter) ? (need.expression === undefined || unit === undefined ? undefined : readyNumber(pointState(linkedEstimate(need.expression, unit), unit))) : need.value;
    const ours = readyNumber(parameterPoint(parameter));
    if (need.ownerTyped && theirs !== undefined && parameter.valueMode !== "LINKED" && ours !== undefined && comparable && !sameValue(theirs, ours)) {
      findings.push({ severity: "warning", check: "Values differ", item, detail: `${NEED_ELEMENT_LABELS[need.element]} holds ${Number(theirs.toPrecision(4))}, but ${parameter.uuid} holds ${Number(ours.toPrecision(4))}. Link the parameter to the ${NEED_ELEMENT_LABELS[need.element]} value, or settle on one value.`, target: { kind: "daParameter", id: parameter.uuid } });
    }
  }
  for (const parameter of da.parameters) {
    const target = { kind: "daParameter" as const, id: parameter.uuid };
    const item = parameter.uuid;
    const mapped = needs.filter((need) => need.parameterId === parameter.uuid);
    const model = parameter.quantificationModel;
    if (model === undefined) findings.push({ severity: "error", check: "No model", item, detail: "Set the quantification model.", target });
    if (model === "MISSION_PROBABILITY" && parameter.valueMode !== "CALCULATED" && parameter.estimate !== undefined && missionModelTime(parameter.estimate) === undefined && !mapped.some((need) => need.missionTime !== undefined)) findings.push({ severity: "error", check: "No mission time", item, detail: "Enter the mission time this probability covers.", target });
    if (mapped.length === 0) findings.push({ severity: "warning", check: "Not used", item, detail: "No event maps to this parameter.", target });
    const link = parameter.valueMode === "LINKED" ? parameter.valueLink : undefined;
    const linkedNeed = link === undefined ? undefined : needs.find((need) => need.element === link.element && need.id === link.needId && need.parameterId === parameter.uuid);
    if (parameter.valueMode === "LINKED") {
      if (linkedNeed === undefined) findings.push({ severity: "error", check: "Link broken", item, detail: "The linked event no longer maps to this parameter. Link another event or type the value.", target });
      else if (linkedNeed.value === undefined && linkedNeed.expression === undefined) findings.push({ severity: "error", check: "Link broken", item, detail: "The linked event no longer holds a value. Type the value instead.", target });
    }
    const component = lawParameter(parameter);
    const value = component ? undefined : parameter.value;
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || (model !== undefined && PROBABILITY_MODELS_SET.has(model) && value > 1))) {
      findings.push({ severity: "error", check: "Out of range", item, detail: model !== undefined && PROBABILITY_MODELS_SET.has(model) ? "A probability must lie between 0 and 1." : "The value cannot be negative.", target });
    }
    const range = component && parameter.estimate !== undefined ? rangeProblem(parameter.estimate) : undefined;
    if (range !== undefined) findings.push({ severity: "error", check: "Out of range", item, detail: range, target });
    if ((component ? parameter.estimate === undefined : value === undefined) && parameter.valueMode !== "LINKED") findings.push({ severity: "note", check: "Not estimated", item, detail: "This parameter has no value yet.", target });
    const states = parameterStates(parameter);
    const statesOwned = linkedNeed !== undefined && linkedNeed.stateIds.length > 0;
    if (!statesOwned && states.length > 1 && blank(parameter.multiPosApplicabilityJustification)) findings.push({ severity: "error", check: "States without a reason", item, detail: "Give the reason this value holds in each of its operating states (DA-C25).", target });
    const strayStates = stateIds.size === 0 ? [] : states.filter((state) => !stateIds.has(state));
    if (strayStates.length > 0) findings.push({ severity: "warning", check: "Unknown state", item, detail: `${strayStates.join(", ")} ${strayStates.length === 1 ? "is" : "are"} not among the operating states.`, target });
    if (model !== undefined && COMPONENT_MODELS.has(model) && parameter.componentBoundaryRef === undefined) findings.push({ severity: "warning", check: "No boundary", item, detail: "Set the component boundary (DA-A2).", target });
    if (parameter.componentBoundaryRef !== undefined && !boundaries.has(parameter.componentBoundaryRef)) findings.push({ severity: "error", check: "Boundary missing", item, detail: `Boundary ${parameter.componentBoundaryRef} does not exist.`, target });
    if (parameter.failureModeRef !== undefined && !modes.has(parameter.failureModeRef)) findings.push({ severity: "error", check: "Failure mode missing", item, detail: `Failure mode ${parameter.failureModeRef} does not exist.`, target });
    if (parameter.componentGroupRef !== undefined && !groups.has(parameter.componentGroupRef)) findings.push({ severity: "error", check: "Group missing", item, detail: `Group ${parameter.componentGroupRef} does not exist.`, target });
  }
  for (const boundary of da.componentBoundaries) {
    const target = { kind: "daBoundary" as const, id: boundary.uuid };
    if (boundary.includedItems.length === 0) findings.push({ severity: "warning", check: "Nothing included", item: boundary.uuid, detail: "List the parts inside the boundary.", target });
    if (blank(boundary.boundaryBasis)) findings.push({ severity: "warning", check: "No basis", item: boundary.uuid, detail: "Say why the boundary is drawn here.", target });
  }
  for (const group of da.componentGroupings ?? []) {
    const target = { kind: "daGroup" as const, id: group.uuid };
    if (da.capabilityCategory === "CC-II" && group.groupingBasis === "TYPE_ONLY") findings.push({ severity: "warning", check: "Type only", item: group.uuid, detail: "Capability Category II groups by type and service conditions (DA-B1).", target });
    if (blank(group.groupingJustification)) findings.push({ severity: "warning", check: "No justification", item: group.uuid, detail: "Say why these components form one population.", target });
    if (group.componentIds.length < 2) findings.push({ severity: "warning", check: "Too few members", item: group.uuid, detail: "A population needs at least two components.", target });
  }
  for (const outlier of da.outlierComponents ?? []) {
    const target = { kind: "daOutlier" as const, id: outlier.uuid };
    if (blank(outlier.exclusionReason)) findings.push({ severity: "error", check: "No reason", item: outlier.uuid, detail: "Give the reason this component is held out (DA-B2).", target });
    if (blank(outlier.alternativeHandling)) findings.push({ severity: "warning", check: "No handling", item: outlier.uuid, detail: "Say how the outlier is treated instead.", target });
  }
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => FINDING_RANK[a.finding.severity] - FINDING_RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
}

function withOutlierGroup(da: DataAnalysis, outlierId: string, groupId: string | undefined): DataAnalysis {
  const groups = da.componentGroupings;
  if (groups === undefined) return da;
  let changed = false;
  const next = groups.map((group) => {
    const held = group.excludedOutliers ?? [];
    const kept = held.filter((id) => id !== outlierId);
    const wanted = group.uuid === groupId ? [...kept, outlierId] : kept;
    if (wanted.length === held.length && wanted.every((id, index) => id === held[index])) return group;
    changed = true;
    return { ...group, excludedOutliers: wanted };
  });
  return changed ? { ...da, componentGroupings: next } : da;
}

function parametersComplete(da: DataAnalysis): boolean {
  return da.parameters.length > 0 && da.dataNeeds !== undefined && !parameterFindings(da).some((finding) => finding.severity === "error");
}

function filterConformance(da: DataAnalysis, ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  const statusBySr = new Map<string, string>();
  for (const entry of da.conformanceMatrix) {
    const ccUpper = ccId.replace("cc-", "").toUpperCase();
    if (entry.capabilityCategory === `CC-${ccUpper}`) statusBySr.set(entry.sr, entry.status);
  }
  const outOfScope = excludedScopeSrs(da);
  return CONFORMANCE_ITEMS.filter((it) => it.requiredAt.includes(ccId)).map((it) => {
    if (!it.stages.includes(stageKey)) return { ...it, status: "na" as const, meta: "Not applicable to current plant stage" };
    const scopeNote = outOfScope.get(it.id);
    if (scopeNote !== undefined) return { ...it, status: "na" as const, meta: scopeNote };
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

function stepsFromMef(da: DataAnalysis, persona: DaPersona, handoffsDone = false): DaStep[] {
  const base = stepsForPersona(persona);
  const scopeComplete = scopeItemsToComplete(da).length === 0;
  const needsDone = needsComplete(da);
  const parametersDone = parametersComplete(da);
  const genericComplete = sourcesComplete(da);
  const countsComplete = failuresComplete(da);
  const unavailComplete = unavailabilityComplete(da);
  const commonCauseComplete = ccfComplete(da);
  const initiatorsComplete = frequenciesComplete(da);
  const uncertComplete = uncertaintyComplete(da);
  const draftComplete = da.workflowState !== "DRAFT" && da.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = da.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "scope": return { ...s, status: status(scopeComplete) };
      case "needs": return { ...s, status: status(needsDone) };
      case "define": return { ...s, status: status(parametersDone) };
      case "generic": return { ...s, status: status(genericComplete) };
      case "counts": return { ...s, status: status(countsComplete) };
      case "unavail": return { ...s, status: status(unavailComplete) };
      case "ccf": return { ...s, status: status(commonCauseComplete) };
      case "ie": return { ...s, status: status(initiatorsComplete) };
      case "uncert": return { ...s, status: status(uncertComplete) };
      case "handoffs": return { ...s, status: status(handoffsDone) };
      case "draft": return { ...s, status: status(draftComplete) };
      case "review": return { ...s, status: status(reviewComplete) };
      default: return { ...s, status: "idle" as const };
    }
  });
}

export {
  COMPONENT_MODELS,
  linkedEstimate,
  mappableNeeds,
  modelSpecOf,
  modelsForNeed,
  parameterFindings,
  parameterNeeds,
  parameterStates,
  parameterValueText,
  withAutoMapping,
  withLinkedValuesSynced,
  withModel,
  withNeedParameter,
  withOutlierGroup,
  nextParameterId,
  type DaMapElement,
  type DaMappableNeed,
  NEED_ELEMENTS,
  basicEventEdited,
  daImportNeeds,
  daNeedChecks,
  daNeedsImportReady,
  daNeedsLinked,
  emptyNeeds,
  needChangeOf,
  needManualCount,
  nextNeedId,
  stateShares,
  withNeeds,
  withNeedsMerged,
  type DaFindingSeverity,
  type DaNeedFinding,
  type DaNeedWindowKind,
  scopeDecisionOf,
  scopeItemsToComplete,
  filterConformance,
  groupBySection,
  ccScore,
  commentsView,
  stepsForPersona,
  stepsFromMef,
  initialsOf,
  type CommentView,
  type CcScore,
};
