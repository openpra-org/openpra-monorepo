import {
  daEstimateUnit,
  holdsEstimate,
  type DaBasicEventNeed,
  type DaCcfGroupNeed,
  type DaDataNeeds,
  type DaHumanErrorNeed,
  type DaInitiatorNeed,
  type DaLinkedNeedDetail,
  type DaManualEntry,
  type DaNeedElement,
  type DaNeedKind,
  type DaNeedList,
  type DaNeedSource,
  type DaStateNeed,
  type DaValueHolder,
  type DataAnalysis,
  type DataAnalysisParameter,
} from "./data-analysis";
import { carriesUncertainExpression, type SystemBasicEvent, type SystemsAnalysis } from "../sy/systems-analysis";
import { basicEventMissionTime, systemFaultTreeBasicEventIds } from "../sy/system-models";
import { canonicalJson, expressionReferences, type UncertainExpression, type UncertainUnit } from "../core/uncertainty";
import { legacyExpression } from "../core/legacy-uncertainty-adapter";
import type { QuantificationTimeUnit } from "../modeling/quantitative-semantics";
import type { InitiatingEventsAnalysis } from "../ie/initiating-event-analysis";
import type { HumanReliabilityAnalysis } from "../hr/human-reliability-analysis";
import type { PlantOperatingStatesAnalysis } from "../pos/plant-operating-state-analysis";

interface DaNeedSources {
  sy?: SystemsAnalysis;
  ie?: InitiatingEventsAnalysis;
  hr?: HumanReliabilityAnalysis;
  pos?: PlantOperatingStatesAnalysis;
}

interface DaNeedRows {
  basicEvents: DaBasicEventNeed[];
  initiators: DaInitiatorNeed[];
  humanErrors: DaHumanErrorNeed[];
  ccfGroups: DaCcfGroupNeed[];
  states: DaStateNeed[];
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
  holderId?: string;
  parameterId?: string;
  missionTime?: UncertainExpression;
  valueUnit?: "PROBABILITY" | "PER_HOUR";
  stateIds: string[];
  systemId?: string;
  systemName?: string;
}

interface DaNeedsSaveContext {
  rows: DaNeedRows;
  derivedParameterOf: (list: DaNeedList, id: string) => string | undefined;
}

interface DaOwnedRow {
  id: string;
  included: boolean;
  exclusionReason?: string;
  parameterId?: string;
}

const NEED_ELEMENTS: DaNeedElement[] = ["SY", "IE", "HRA", "POS"];

const EDITABLE_STATES: ReadonlySet<string> = new Set(["DRAFT", "REVISION_REQUIRED"]);

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
    const hep = quantification.hep;
    const source = hep?.node === "PARAMETER" ? hep.reference : undefined;
    need.valueHeldBy = source === undefined ? "TYPED" : "DA";
    if (source !== undefined) need.valueHolderId = source.entityId;
    const held = hep?.node === "VALUE" ? hep.value.law : undefined;
    const law = held?.family === "TRUNCATED" && held.lower === null && held.upper === 1 ? held.law : held;
    if (law?.family === "POINT") {
      need.value = law.value;
      need.valueKind = "POINT_ESTIMATE";
    } else if (law !== undefined && "mean" in law) {
      need.value = law.mean;
      need.valueKind = "MEAN";
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

function daNeedRows(da: Pick<DataAnalysis, "linkedWorkbooks" | "parameters">, sources: DaNeedSources): DaNeedRows {
  const links = da.linkedWorkbooks ?? {};
  const parameterIds = new Set(da.parameters.map((parameter) => parameter.uuid));
  const hfeIds = new Set((sources.hr?.humanFailureEvents ?? []).map((event) => event.uuid));
  const sy = links.SY === undefined ? undefined : sources.sy;
  const ie = links.IE === undefined ? undefined : sources.ie;
  const hr = links.HRA === undefined ? undefined : sources.hr;
  const pos = links.POS === undefined ? undefined : sources.pos;
  return {
    basicEvents: sy === undefined ? [] : basicEventNeeds(sy, parameterIds, hfeIds),
    initiators: ie === undefined ? [] : initiatorNeeds(ie),
    humanErrors: hr === undefined ? [] : humanErrorNeeds(hr),
    ccfGroups: sy === undefined ? [] : ccfGroupNeeds(sy),
    states: pos === undefined ? [] : stateNeeds(pos),
  };
}

function daNeedsLinked(da: Pick<DataAnalysis, "linkedWorkbooks">): DaNeedElement[] {
  const links = da.linkedWorkbooks ?? {};
  return NEED_ELEMENTS.filter((element) => links[element] !== undefined);
}

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function sameExpression(left: UncertainExpression | undefined, right: UncertainExpression | undefined): boolean {
  return left === undefined || right === undefined ? left === right : canonicalJson(left) === canonicalJson(right);
}

function detailKey(list: DaNeedList, id: string): string {
  return `${list}:${id}`;
}

function hasOwnWork(detail: DaLinkedNeedDetail): boolean {
  return Object.keys(detail).length > 2;
}

function ownedDetail(list: DaNeedList, row: DaOwnedRow): DaLinkedNeedDetail {
  return {
    list,
    id: row.id,
    ...(row.included ? {} : { included: false }),
    ...(blank(row.exclusionReason) ? {} : { exclusionReason: row.exclusionReason }),
    ...(row.parameterId === undefined ? {} : { parameterId: row.parameterId }),
  };
}

function oldBasicEventDetail(row: DaBasicEventNeed, live: DaBasicEventNeed | undefined): DaLinkedNeedDetail {
  return {
    ...ownedDetail("BASIC_EVENT", row),
    ...(blank(row.changeReason) ? {} : { changeReason: row.changeReason }),
    ...(row.kind === undefined || row.kind === row.importedKind ? {} : { kind: row.kind }),
    ...(row.missionTime === undefined || sameExpression(row.missionTime, row.importedMissionTime) ? {} : { missionTime: row.missionTime }),
    ...(row.testIntervalHours === undefined || live?.testIntervalHours === row.testIntervalHours ? {} : { testIntervalHours: row.testIntervalHours }),
  };
}

function savedDetails(saved: DaDataNeeds | undefined, rows: DaNeedRows): DaLinkedNeedDetail[] {
  if (saved === undefined) return [];
  const details = new Map<string, DaLinkedNeedDetail>();
  for (const detail of saved.linkedDetails ?? []) details.set(detailKey(detail.list, detail.id), detail);
  const keep = (detail: DaLinkedNeedDetail): void => {
    const key = detailKey(detail.list, detail.id);
    if (!details.has(key) && hasOwnWork(detail)) details.set(key, detail);
  };
  const liveEvents = new Map(rows.basicEvents.map((row) => [row.id, row]));
  for (const row of saved.basicEvents) if (row.manual === undefined) keep(oldBasicEventDetail(row, liveEvents.get(row.id)));
  for (const row of saved.initiators) if (row.manual === undefined) keep(ownedDetail("INITIATOR", row));
  for (const row of saved.humanErrors) if (row.manual === undefined) keep(ownedDetail("HUMAN_ERROR", row));
  for (const row of saved.ccfGroups) if (row.manual === undefined) keep(ownedDetail("CCF_GROUP", row));
  for (const row of saved.states) if (row.manual === undefined) keep(ownedDetail("STATE", row));
  return [...details.values()];
}

function basicEventView(row: DaBasicEventNeed, detail: DaLinkedNeedDetail | undefined): DaBasicEventNeed {
  if (detail === undefined) return row;
  const next: DaBasicEventNeed = { ...row };
  if (detail.included !== undefined) next.included = detail.included;
  if (detail.exclusionReason !== undefined) next.exclusionReason = detail.exclusionReason;
  if (detail.parameterId !== undefined) next.parameterId = detail.parameterId;
  if (detail.changeReason !== undefined) next.changeReason = detail.changeReason;
  if (detail.kind !== undefined) next.kind = detail.kind;
  if (detail.missionTime !== undefined) next.missionTime = structuredClone(detail.missionTime);
  if (detail.testIntervalHours !== undefined) next.testIntervalHours = detail.testIntervalHours;
  return next;
}

function rowView<T extends { included: boolean; exclusionReason?: string }>(row: T, detail: DaLinkedNeedDetail | undefined): T {
  if (detail === undefined) return row;
  return {
    ...row,
    ...(detail.included === undefined ? {} : { included: detail.included }),
    ...(detail.exclusionReason === undefined ? {} : { exclusionReason: detail.exclusionReason }),
  };
}

function mappedView<T extends DaOwnedRow>(row: T, detail: DaLinkedNeedDetail | undefined): T {
  const base = rowView(row, detail);
  return detail?.parameterId === undefined ? base : { ...base, parameterId: detail.parameterId };
}

function manualRows<T extends { manual?: DaManualEntry }>(rows: readonly T[] | undefined): T[] {
  return (rows ?? []).filter((row) => row.manual !== undefined);
}

function daNeedsView(saved: DaDataNeeds | undefined, rows: DaNeedRows, sources: DaNeedSource[]): DaDataNeeds {
  const details = savedDetails(saved, rows);
  const byKey = new Map(details.map((detail) => [detailKey(detail.list, detail.id), detail]));
  const find = (list: DaNeedList, id: string): DaLinkedNeedDetail | undefined => byKey.get(detailKey(list, id));
  return {
    sources,
    basicEvents: [...rows.basicEvents.map((row) => basicEventView(row, find("BASIC_EVENT", row.id))), ...manualRows(saved?.basicEvents)],
    initiators: [...rows.initiators.map((row) => mappedView(row, find("INITIATOR", row.id))), ...manualRows(saved?.initiators)],
    humanErrors: [...rows.humanErrors.map((row) => mappedView(row, find("HUMAN_ERROR", row.id))), ...manualRows(saved?.humanErrors)],
    ccfGroups: [...rows.ccfGroups.map((row) => rowView(row, find("CCF_GROUP", row.id))), ...manualRows(saved?.ccfGroups)],
    states: [...rows.states.map((row) => rowView(row, find("STATE", row.id))), ...manualRows(saved?.states)],
    ...(details.length === 0 ? {} : { linkedDetails: details }),
  };
}

function mappingDetail(row: DaOwnedRow, derived: string | undefined): Pick<DaLinkedNeedDetail, "parameterId" | "unmapped"> {
  if (row.parameterId === derived) return {};
  return row.parameterId === undefined ? { unmapped: true } : { parameterId: row.parameterId };
}

function rowDetail(list: DaNeedList, row: DaOwnedRow): DaLinkedNeedDetail {
  return {
    list,
    id: row.id,
    ...(row.included ? {} : { included: false }),
    ...(blank(row.exclusionReason) ? {} : { exclusionReason: row.exclusionReason }),
  };
}

function basicEventDetail(row: DaBasicEventNeed, live: DaBasicEventNeed, derived: string | undefined): DaLinkedNeedDetail {
  return {
    ...rowDetail("BASIC_EVENT", row),
    ...mappingDetail(row, derived),
    ...(blank(row.changeReason) ? {} : { changeReason: row.changeReason }),
    ...(row.kind === undefined || row.kind === live.importedKind ? {} : { kind: row.kind }),
    ...(row.missionTime === undefined || sameExpression(row.missionTime, live.importedMissionTime) ? {} : { missionTime: row.missionTime }),
    ...(row.testIntervalHours === undefined || row.testIntervalHours === live.testIntervalHours ? {} : { testIntervalHours: row.testIntervalHours }),
  };
}

function daNeedsSaved(view: DaDataNeeds | undefined, context: DaNeedsSaveContext): DaDataNeeds | undefined {
  if (view === undefined) return undefined;
  const { rows, derivedParameterOf } = context;
  const liveEvents = new Map(rows.basicEvents.map((row) => [row.id, row]));
  const recomputed = new Set<string>();
  const details: DaLinkedNeedDetail[] = [];
  const add = (detail: DaLinkedNeedDetail): void => {
    recomputed.add(detailKey(detail.list, detail.id));
    if (hasOwnWork(detail)) details.push(detail);
  };
  for (const row of view.basicEvents) {
    const live = row.manual === undefined ? liveEvents.get(row.id) : undefined;
    if (live !== undefined) add(basicEventDetail(row, live, derivedParameterOf("BASIC_EVENT", row.id)));
  }
  for (const row of view.initiators) {
    if (row.manual === undefined) add({ ...rowDetail("INITIATOR", row), ...mappingDetail(row, derivedParameterOf("INITIATOR", row.id)) });
  }
  for (const row of view.humanErrors) {
    if (row.manual === undefined) add({ ...rowDetail("HUMAN_ERROR", row), ...mappingDetail(row, derivedParameterOf("HUMAN_ERROR", row.id)) });
  }
  for (const row of view.ccfGroups) {
    if (row.manual === undefined) add(rowDetail("CCF_GROUP", row));
  }
  for (const row of view.states) {
    if (row.manual === undefined) add(rowDetail("STATE", row));
  }
  for (const detail of view.linkedDetails ?? []) {
    if (!recomputed.has(detailKey(detail.list, detail.id))) details.push(detail);
  }
  const saved: DaDataNeeds = {
    sources: [],
    basicEvents: manualRows(view.basicEvents),
    initiators: manualRows(view.initiators),
    humanErrors: manualRows(view.humanErrors),
    ccfGroups: manualRows(view.ccfGroups),
    states: manualRows(view.states),
    ...(details.length === 0 ? {} : { linkedDetails: details }),
  };
  const empty = details.length === 0 && saved.basicEvents.length + saved.initiators.length + saved.humanErrors.length + saved.ccfGroups.length + saved.states.length === 0;
  return empty ? undefined : saved;
}

function daLinkedDetailMissing(needs: DaDataNeeds): DaLinkedNeedDetail[] {
  const shown = new Set<string>([
    ...needs.basicEvents.map((row) => detailKey("BASIC_EVENT", row.id)),
    ...needs.initiators.map((row) => detailKey("INITIATOR", row.id)),
    ...needs.humanErrors.map((row) => detailKey("HUMAN_ERROR", row.id)),
    ...needs.ccfGroups.map((row) => detailKey("CCF_GROUP", row.id)),
    ...needs.states.map((row) => detailKey("STATE", row.id)),
  ]);
  return (needs.linkedDetails ?? []).filter((detail) => !shown.has(detailKey(detail.list, detail.id)));
}

function daUnmapped(needs: DaDataNeeds | undefined, list: DaNeedList, id: string): boolean {
  return (needs?.linkedDetails ?? []).some((detail) => detail.list === list && detail.id === id && detail.unmapped === true);
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
      holderId: need.valueHolderId,
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
    holderId: need.valueHolderId,
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
    expression: need.value === undefined ? undefined : { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: need.value } } },
    valueType: need.valueKind === "MEAN" ? "MEAN" : "POINT_ESTIMATE",
    ownerTyped: need.manual === undefined && need.valueHeldBy !== "DA" && need.value !== undefined,
    heldBy: need.valueHeldBy,
    holderId: need.valueHolderId,
    parameterId: need.parameterId,
    stateIds: need.stateIds,
  }));
  return [...events, ...initiators, ...humanErrors];
}

function parameterStates(parameter: DataAnalysisParameter): string[] {
  if (parameter.stateIds !== undefined) return parameter.stateIds;
  return parameter.plantOperatingStateRef === undefined ? [] : [parameter.plantOperatingStateRef];
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

function linkedNeedOf(parameter: DataAnalysisParameter, views: readonly DaMappableNeed[]): DaMappableNeed | undefined {
  const link = parameter.valueLink;
  if (parameter.valueMode !== "LINKED" || link === undefined) return undefined;
  const need = views.find((view) => view.element === link.element && view.id === link.needId);
  return need === undefined || need.heldBy === "DA" ? undefined : need;
}

function daWithLinkedValues(da: DataAnalysis): DataAnalysis {
  const views = mappableNeeds(da.dataNeeds);
  let changed = false;
  const parameters = da.parameters.map((parameter) => {
    const need = linkedNeedOf(parameter, views);
    if (need === undefined) return parameter;
    let next = parameter;
    if (holdsEstimate(parameter.quantificationModel)) {
      const expression = need.expression === undefined ? undefined : linkedEstimate(need.expression, daEstimateUnit(parameter.quantificationModel));
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

function daWithoutLinkedValue(parameter: DataAnalysisParameter, views: readonly DaMappableNeed[]): DataAnalysisParameter {
  const need = linkedNeedOf(parameter, views);
  if (need === undefined) return parameter;
  const next: DataAnalysisParameter = { ...parameter };
  if (holdsEstimate(parameter.quantificationModel)) {
    if (need.expression !== undefined) delete next.estimate;
  } else if (need.value !== undefined) {
    delete next.value;
    delete next.valueType;
  }
  if (need.stateIds.length > 0) delete next.stateIds;
  return next;
}

function daHoldsSavedCopies(da: DataAnalysis): boolean {
  const needs = da.dataNeeds;
  const copiedRows = needs !== undefined && (needs.importedAt !== undefined || [needs.basicEvents, needs.initiators, needs.humanErrors, needs.ccfGroups, needs.states].some((rows) => rows.some((row) => row.manual === undefined)));
  const copiedImportance = [...da.parameters, ...(da.ccfParameterEstimations ?? [])].some((item) => item.importance?.from === "ESQ" && (item.importance.fussellVesely !== undefined || item.importance.riskAchievementWorth !== undefined));
  return copiedRows || copiedImportance;
}

function daShowsSavedCopies(da: DataAnalysis): boolean {
  return !EDITABLE_STATES.has(da.workflowState ?? "DRAFT") && daHoldsSavedCopies(da);
}

function daLinkedValueElements(da: DataAnalysis): DaMapElement[] {
  const elements = new Set<DaMapElement>();
  for (const parameter of da.parameters) {
    const element = parameter.valueMode === "LINKED" ? parameter.valueLink?.element : undefined;
    if (element === "SY" || element === "IE" || element === "HRA") elements.add(element);
  }
  return [...elements];
}

function daWithLinkedNeeds(da: DataAnalysis, sources: DaNeedSources): DataAnalysis {
  if (daShowsSavedCopies(da)) return da;
  const rows = daNeedRows(da, sources);
  return daWithLinkedValues({ ...da, dataNeeds: daNeedsView(da.dataNeeds, rows, []) });
}

export {
  HOURS_PER_UNIT,
  KIND_BY_FAILURE_MODE,
  NEED_ELEMENTS,
  daHoldsSavedCopies,
  daLinkedDetailMissing,
  daLinkedValueElements,
  daNeedRows,
  daNeedsLinked,
  daNeedsSaved,
  daNeedsView,
  daShowsSavedCopies,
  daUnmapped,
  daWithLinkedNeeds,
  daWithLinkedValues,
  daWithoutLinkedValue,
  expressionValueUnit,
  failureModeOf,
  linkedEstimate,
  mappableNeeds,
  modelTimes,
  parameterStates,
  sameList,
  type DaMapElement,
  type DaMappableNeed,
  type DaNeedRows,
  type DaNeedSources,
  type DaNeedsSaveContext,
};
