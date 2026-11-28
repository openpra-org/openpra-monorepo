import type {
  CcfParameterEstimation,
  DaDataNeeds,
  DaImportance,
  DaInitiatorNeed,
  DaNeedElement,
  DaNeedList,
  DaNeedSource,
  DaQuantificationModel,
  DataAnalysis,
  DataAnalysisParameter,
} from "interfaces-mef-types/da/data-analysis";
import { canonicalJson } from "interfaces-mef-types/core/uncertainty";
import {
  NEED_ELEMENTS,
  daNeedRows,
  daNeedsLinked,
  daNeedsSaved,
  daNeedsView,
  daShowsSavedCopies,
  daUnmapped,
  daWithLinkedValues,
  daWithoutLinkedValue,
  mappableNeeds,
  type DaMapElement,
  type DaMappableNeed,
} from "interfaces-mef-types/da/da-linked-needs";
import { type DaUpstream } from "./daWorkbookContext";
import { defaultModelFor, linkedParameter, withModel } from "./daSelectors";
import { memberParameterIds } from "./daCcf";
import { measuresByTarget, significant } from "./daHandoffs";
import { exampleLinkLabel } from "./daViewData";

type DaMapList = "BASIC_EVENT" | "INITIATOR" | "HUMAN_ERROR";

interface DaViewDerived {
  mapping: Map<string, string>;
  parameters: Map<string, string>;
  estimates: Map<string, string>;
  significance: Set<string>;
  importance: Map<string, DaImportance | undefined>;
}

interface DaMapping {
  mapping: Map<string, string>;
  virtual: DataAnalysisParameter[];
}

interface DaRanked {
  uuid: string;
  isRiskSignificant?: boolean;
  importance?: DaImportance;
}

const LIST_OF: Record<DaMapElement, DaMapList> = { SY: "BASIC_EVENT", IE: "INITIATOR", HRA: "HUMAN_ERROR" };

const DERIVED = new WeakMap<DataAnalysis, DaViewDerived>();

function mappingKey(list: DaNeedList, id: string): string {
  return `${list}:${id}`;
}

function loaded(upstream: DaUpstream, element: DaNeedElement): boolean {
  switch (element) {
    case "SY": return upstream.sy !== undefined;
    case "IE": return upstream.ie !== undefined;
    case "HRA": return upstream.hr !== undefined;
    case "POS": return upstream.pos !== undefined;
  }
}

function needSources(da: DataAnalysis, upstream: DaUpstream): DaNeedSource[] {
  const links = da.linkedWorkbooks ?? {};
  return NEED_ELEMENTS.flatMap((element): DaNeedSource[] => {
    const id = links[element];
    if (id === undefined || !loaded(upstream, element)) return [];
    const option = upstream.options[element].find((workbook) => workbook.id === id);
    return [{ element, workbookId: id, workbookName: option?.name ?? exampleLinkLabel(id) ?? id, ...(option === undefined ? {} : { updatedAt: option.updatedAt }) }];
  });
}

function virtualIdOf(need: DaMappableNeed): string {
  const code = need.code.trim().length > 0 ? need.code.trim() : need.id;
  return `DA-${need.element}-${code}`;
}

function frequencyIdOf(need: DaInitiatorNeed): string {
  return `DA-IE-${need.id}`;
}

function estimateIdOf(need: { id: string; estimateRef?: string }): string {
  return need.estimateRef ?? `DA-CCF-${need.id}`;
}

function derivedMapping(needs: DaDataNeeds, own: readonly DataAnalysisParameter[], choices: boolean): DaMapping {
  const views = mappableNeeds(needs);
  const ids = new Set(own.map((parameter) => parameter.uuid));
  const mapping = new Map<string, string>();
  const virtual: DataAnalysisParameter[] = [];
  const keyOf = (need: DaMappableNeed): string => mappingKey(LIST_OF[need.element], need.id);
  const settled = (need: DaMappableNeed): boolean => choices && (need.parameterId !== undefined || daUnmapped(needs, LIST_OF[need.element], need.id));
  const holderOf = (need: DaMappableNeed): string | undefined => (need.heldBy === "DA" && need.holderId !== undefined && ids.has(need.holderId) ? need.holderId : undefined);
  const linkedTo = (need: DaMappableNeed): string | undefined => own.find((parameter) => parameter.valueMode === "LINKED" && parameter.valueLink?.element === need.element && parameter.valueLink.needId === need.id)?.uuid;
  const create = (need: DaMappableNeed, model: DaQuantificationModel | undefined): string | undefined => {
    if (!need.ownerTyped || model === undefined) return undefined;
    const id = virtualIdOf(need);
    if (ids.has(id)) return undefined;
    ids.add(id);
    virtual.push(linkedParameter(id, need, model));
    return id;
  };
  const assign = (need: DaMappableNeed, id: string | undefined): void => {
    if (id !== undefined) mapping.set(keyOf(need), id);
  };
  const hepByHfe = new Map<string, string>();
  for (const need of views.filter((candidate) => candidate.element === "HRA")) {
    if (!need.included) continue;
    if (settled(need)) {
      if (need.parameterId !== undefined && need.kind === "HUMAN_ERROR") hepByHfe.set(need.code, need.parameterId);
      continue;
    }
    const existing = own.find((parameter) => parameter.basicEventRef === need.code && parameter.parameterType === "HUMAN_ERROR_PROBABILITY")?.uuid;
    const id = holderOf(need) ?? existing ?? linkedTo(need) ?? create(need, need.kind === "RECOVERY" ? "NON_RECOVERY" : "HUMAN_ERROR");
    assign(need, id);
    if (id !== undefined && need.kind === "HUMAN_ERROR") hepByHfe.set(need.code, id);
  }
  for (const need of views.filter((candidate) => candidate.element === "IE")) {
    if (!need.included || settled(need)) continue;
    const row = needs.initiators.find((candidate) => candidate.id === need.id);
    const only = row?.memberIds.length === 1 ? row.memberIds[0] : undefined;
    const existing = own.find((parameter) => parameter.parameterType === "FREQUENCY" && parameter.basicEventRef !== undefined && (parameter.basicEventRef === need.id || parameter.basicEventRef === only))?.uuid;
    assign(need, holderOf(need) ?? existing ?? linkedTo(need) ?? create(need, "FREQUENCY"));
  }
  for (const need of views.filter((candidate) => candidate.element === "SY")) {
    if (!need.included || settled(need)) continue;
    const holder = need.holderId;
    const hep = need.heldBy === "HRA" && holder !== undefined ? hepByHfe.get(holder) : undefined;
    assign(need, holderOf(need) ?? hep ?? linkedTo(need) ?? create(need, defaultModelFor(need)));
  }
  return { mapping, virtual };
}

function withMapping<T extends { id: string; parameterId?: string }>(list: DaMapList, rows: T[], mapping: ReadonlyMap<string, string>): T[] {
  return rows.map((row) => {
    const id = mapping.get(mappingKey(list, row.id));
    return id === undefined ? row : { ...row, parameterId: id };
  });
}

function withMappingView(da: DataAnalysis, choices: boolean): { da: DataAnalysis; mapping: Map<string, string>; virtual: string[] } {
  const needs = da.dataNeeds;
  if (needs === undefined) return { da, mapping: new Map(), virtual: [] };
  const derived = derivedMapping(needs, da.parameters, choices);
  if (derived.mapping.size === 0 && derived.virtual.length === 0) return { da, mapping: derived.mapping, virtual: [] };
  const nextNeeds: DaDataNeeds = {
    ...needs,
    basicEvents: withMapping("BASIC_EVENT", needs.basicEvents, derived.mapping),
    initiators: withMapping("INITIATOR", needs.initiators, derived.mapping),
    humanErrors: withMapping("HUMAN_ERROR", needs.humanErrors, derived.mapping),
  };
  const mapped = mappableNeeds(nextNeeds);
  const parameters = [...da.parameters, ...derived.virtual].map((parameter) => {
    if (parameter.quantificationModel !== undefined) return parameter;
    const first = mapped.find((need) => need.parameterId === parameter.uuid);
    return first === undefined ? parameter : withModel(parameter, defaultModelFor(first, parameter.parameterType));
  });
  return { da: { ...da, dataNeeds: nextNeeds, parameters }, mapping: derived.mapping, virtual: derived.virtual.map((parameter) => parameter.uuid) };
}

function frequencyParameterFor(need: DaInitiatorNeed, id: string): DataAnalysisParameter {
  return {
    uuid: id,
    name: need.name,
    parameterType: "FREQUENCY",
    quantificationModel: "FREQUENCY",
    valueMode: "CALCULATED",
    stateIds: [...need.stateIds],
    basicEventRef: need.id,
    frequency: { parts: [] },
    implementsSrs: [{ sr: "DA-D1", hlr: "D" }, { sr: "DA-D3", hlr: "D" }],
  };
}

function withFrequencyParameters(da: DataAnalysis, choices: boolean): { da: DataAnalysis; mapping: Map<string, string>; virtual: string[] } {
  const needs = da.dataNeeds;
  const mapping = new Map<string, string>();
  if (needs === undefined) return { da, mapping, virtual: [] };
  const ids = new Set(da.parameters.map((parameter) => parameter.uuid));
  const added: DataAnalysisParameter[] = [];
  const initiators = needs.initiators.map((need) => {
    if (!need.included || (need.parameterId !== undefined && ids.has(need.parameterId))) return need;
    if (choices && daUnmapped(needs, "INITIATOR", need.id)) return need;
    const id = frequencyIdOf(need);
    if (ids.has(id)) return need;
    ids.add(id);
    added.push(frequencyParameterFor(need, id));
    mapping.set(mappingKey("INITIATOR", need.id), id);
    return { ...need, parameterId: id };
  });
  if (added.length === 0) return { da, mapping, virtual: [] };
  return { da: { ...da, parameters: [...da.parameters, ...added], dataNeeds: { ...needs, initiators } }, mapping, virtual: added.map((parameter) => parameter.uuid) };
}

function newEstimate(da: DataAnalysis, id: string, groupId: string, name: string, size: number | undefined, memberParameterId: string | undefined): CcfParameterEstimation {
  const estimate: CcfParameterEstimation = {
    uuid: id,
    ccfGroupReference: groupId,
    name,
    parameterSource: da.plantStage === "OPERATIONAL" ? "PLANT_EXPERIENCE_CONSISTENT" : "GENERIC",
    componentBoundaryConsistencyBasis: "",
    implementsSrs: [{ sr: "DA-D7", hlr: "D" }, { sr: "DA-D8", hlr: "D" }],
  };
  if (size !== undefined) estimate.groupSize = size;
  if (memberParameterId !== undefined) estimate.memberParameterId = memberParameterId;
  return estimate;
}

function withGroupEstimates(da: DataAnalysis): { da: DataAnalysis; virtual: string[] } {
  const needs = da.dataNeeds;
  if (needs === undefined) return { da, virtual: [] };
  const estimates = da.ccfParameterEstimations ?? [];
  const byGroup = new Set(estimates.map((estimate) => estimate.ccfGroupReference));
  const taken = new Set(estimates.map((estimate) => estimate.uuid));
  const added = needs.ccfGroups.flatMap((need): CcfParameterEstimation[] => {
    if (!need.included || byGroup.has(need.id) || (need.estimateRef !== undefined && taken.has(need.estimateRef))) return [];
    const id = estimateIdOf(need);
    if (taken.has(id)) return [];
    taken.add(id);
    const parameterIds = memberParameterIds(needs, need.memberIds);
    return [newEstimate(da, id, need.id, need.name, need.memberIds.length, parameterIds.length === 1 ? parameterIds[0] : undefined)];
  });
  if (added.length === 0) return { da, virtual: [] };
  return { da: { ...da, ccfParameterEstimations: [...estimates, ...added] }, virtual: added.map((estimate) => estimate.uuid) };
}

function oldSignificance<T extends DaRanked>(item: T): T {
  const copy = item.importance;
  if (copy?.from !== "ESQ" || (copy.fussellVesely === undefined && copy.riskAchievementWorth === undefined)) return item;
  const handChanged = item.isRiskSignificant !== undefined && item.isRiskSignificant !== significant(copy.fussellVesely, copy.riskAchievementWorth);
  return { ...item, importance: { from: "ESQ" }, isRiskSignificant: handChanged ? item.isRiskSignificant : undefined };
}

function rankedView<T extends DaRanked>(prefix: string, item: T, measures: ReadonlyMap<string, { entries: string[]; fv?: number; raw?: number }>, derived: DaViewDerived): T {
  const cleaned = oldSignificance(item);
  const read = measures.get(cleaned.uuid);
  if (read === undefined || cleaned.importance?.from === "TYPED") return cleaned;
  const key = `${prefix}:${cleaned.uuid}`;
  derived.importance.set(key, cleaned.importance);
  const importance: DaImportance = { from: "ESQ", ...(read.fv === undefined ? {} : { fussellVesely: read.fv }), ...(read.raw === undefined ? {} : { riskAchievementWorth: read.raw }), entryIds: read.entries };
  if (cleaned.isRiskSignificant !== undefined) return { ...cleaned, importance };
  derived.significance.add(key);
  return { ...cleaned, importance, isRiskSignificant: significant(read.fv, read.raw) };
}

function withImportanceView(da: DataAnalysis, upstream: DaUpstream, derived: DaViewDerived): DataAnalysis {
  const measures = measuresByTarget(da, upstream);
  const parameters = da.parameters.map((parameter) => rankedView("P", parameter, measures, derived));
  const estimates = da.ccfParameterEstimations?.map((estimate) => rankedView("E", estimate, measures, derived));
  return { ...da, parameters, ...(estimates === undefined ? {} : { ccfParameterEstimations: estimates }) };
}

function rankedSaved<T extends DaRanked>(prefix: string, item: T, before: ReadonlyMap<string, T>, derived: DaViewDerived | undefined): T {
  const key = `${prefix}:${item.uuid}`;
  if (derived === undefined || !derived.importance.has(key)) return item;
  const shown = before.get(item.uuid);
  const own = derived.importance.get(key);
  const sameImportance = shown !== undefined && canonicalJson(shown.importance) === canonicalJson(item.importance);
  const sameSignificance = shown !== undefined && shown.isRiskSignificant === item.isRiskSignificant;
  const keepSignificance = !(derived.significance.has(key) && sameSignificance);
  return { ...item, importance: sameImportance ? own : item.importance, isRiskSignificant: keepSignificance ? item.isRiskSignificant : undefined };
}

function canonicalById<T extends { uuid: string }>(items: readonly T[], ids: readonly string[]): Map<string, string> {
  const wanted = new Set(ids);
  return new Map(items.filter((item) => wanted.has(item.uuid)).map((item) => [item.uuid, canonicalJson(item)]));
}

function daViewOf(saved: DataAnalysis, upstream: DaUpstream): DataAnalysis {
  if (daShowsSavedCopies(saved)) return saved;
  const derived: DaViewDerived = { mapping: new Map(), parameters: new Map(), estimates: new Map(), significance: new Set(), importance: new Map() };
  const linked = daNeedsLinked(saved).length > 0;
  const needs = linked || saved.dataNeeds !== undefined ? daNeedsView(saved.dataNeeds, daNeedRows(saved, upstream), needSources(saved, upstream)) : undefined;
  const withNeeds: DataAnalysis = needs === undefined ? saved : { ...saved, dataNeeds: needs };
  const mapped = withMappingView(withNeeds, true);
  const synced = daWithLinkedValues(mapped.da);
  const frequencies = withFrequencyParameters(synced, true);
  const groups = withGroupEstimates(frequencies.da);
  const view = withImportanceView(groups.da, upstream, derived);
  for (const [key, id] of [...mapped.mapping, ...frequencies.mapping]) derived.mapping.set(key, id);
  for (const [id, text] of canonicalById(view.parameters, [...mapped.virtual, ...frequencies.virtual])) derived.parameters.set(id, text);
  for (const [id, text] of canonicalById(view.ccfParameterEstimations ?? [], groups.virtual)) derived.estimates.set(id, text);
  DERIVED.set(view, derived);
  return view;
}

function daSavedOf(next: DataAnalysis, before: DataAnalysis, upstream: DaUpstream): DataAnalysis {
  if (daShowsSavedCopies(before)) return next;
  const derived = DERIVED.get(before);
  const rows = daNeedRows(next, upstream);
  const needs = daNeedsSaved(next.dataNeeds, { rows, derivedParameterOf: (list, id) => derived?.mapping.get(mappingKey(list, id)) });
  const views = mappableNeeds(next.dataNeeds);
  const shownParameters = new Map(before.parameters.map((parameter) => [parameter.uuid, parameter]));
  const shownEstimates = new Map((before.ccfParameterEstimations ?? []).map((estimate) => [estimate.uuid, estimate]));
  const untouched = (virtual: ReadonlyMap<string, string> | undefined, id: string, item: { uuid: string }): boolean => {
    const text = virtual?.get(id);
    return text !== undefined && text === canonicalJson(item);
  };
  const parameters = next.parameters
    .filter((parameter) => !untouched(derived?.parameters, parameter.uuid, parameter))
    .map((parameter) => daWithoutLinkedValue(rankedSaved("P", parameter, shownParameters, derived), views));
  const estimates = next.ccfParameterEstimations
    ?.filter((estimate) => !untouched(derived?.estimates, estimate.uuid, estimate))
    .map((estimate) => rankedSaved("E", estimate, shownEstimates, derived));
  const { dataNeeds: _needs, ccfParameterEstimations: _estimates, ...rest } = next;
  const keepEstimates = estimates !== undefined && (estimates.length > 0 || (next.ccfParameterEstimations?.length ?? 0) === 0);
  return {
    ...rest,
    parameters,
    ...(needs === undefined ? {} : { dataNeeds: needs }),
    ...(keepEstimates ? { ccfParameterEstimations: estimates } : {}),
  };
}

function daMappedView(da: DataAnalysis): DataAnalysis {
  return daWithLinkedValues(withMappingView(da, true).da);
}

export { daMappedView, daSavedOf, daViewOf, newEstimate };
