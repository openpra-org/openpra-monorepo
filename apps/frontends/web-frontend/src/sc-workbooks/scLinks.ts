import type { PlantOperatingState, PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import type { InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { ScLinkedWorkbooks, SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { fetchJson } from "../api/client";
import { listWorkbooks } from "../workbooks/workbookApi";
import { getPosWorkbook } from "../pos-workbooks/posWorkbookApi";
import { getIeWorkbook } from "../ie-workbooks/ieWorkbookApi";
import { getEsWorkbook } from "../es-workbooks/esWorkbookApi";
import type { ScLinkedInputs, ScLinkedSequence } from "./scWorkbookContext";

type ScLinkCode = keyof ScLinkedWorkbooks;

interface ScLinkOption {
  workbookId: string;
  name: string;
}

interface ScLinkActions {
  available: (code: ScLinkCode) => Promise<ScLinkOption[]>;
  setLink: (code: ScLinkCode, workbookId: string | null) => void;
}

interface ScChoice {
  id: string;
  label: string;
}

interface ScChoices {
  states: ScChoice[];
  barriers: ScChoice[];
  initiators: ScChoice[];
  functions: ScChoice[];
}

const SC_LINK_CODES: readonly ScLinkCode[] = ["POS", "IE", "ES"];

const EXAMPLE_PREFIX = "example-";

function exampleVariant(id: string): string | undefined {
  return id.startsWith(EXAMPLE_PREFIX) ? id.split("-").slice(2).join("-") : undefined;
}

async function loadLinkedPos(id: string): Promise<PlantOperatingStatesAnalysis> {
  const variant = exampleVariant(id);
  if (variant !== undefined) return (await fetchJson<{ pos: { mef: PlantOperatingStatesAnalysis } }>(`/api/example-workbooks/pos-bundle?example=${encodeURIComponent(variant)}`)).pos.mef;
  return (await getPosWorkbook(id)).mef;
}

async function loadLinkedIe(id: string): Promise<InitiatingEventsAnalysis> {
  const variant = exampleVariant(id);
  if (variant !== undefined) return (await fetchJson<{ ie: { mef: InitiatingEventsAnalysis } }>(`/api/example-workbooks/ie-bundle?example=${encodeURIComponent(variant)}`)).ie.mef;
  return (await getIeWorkbook(id)).mef;
}

async function loadLinkedEs(id: string): Promise<EventSequenceAnalysis> {
  const variant = exampleVariant(id);
  if (variant !== undefined) return (await fetchJson<{ es: { mef: EventSequenceAnalysis } }>(`/api/example-workbooks/es-bundle?example=${encodeURIComponent(variant)}`)).es.mef;
  return (await getEsWorkbook(id)).mef;
}

async function listScLinkOptions(projectId: string, code: ScLinkCode): Promise<ScLinkOption[]> {
  return (await listWorkbooks(projectId, code)).workbooks.map((workbook) => ({ workbookId: workbook.id, name: workbook.name }));
}

function withLink(links: ScLinkedWorkbooks | undefined, code: ScLinkCode, workbookId: string | null): ScLinkedWorkbooks {
  const next: ScLinkedWorkbooks = {};
  for (const key of SC_LINK_CODES) {
    const value = key === code ? workbookId : links?.[key];
    if (value !== undefined && value !== null) next[key] = value;
  }
  return next;
}

function decayLabel(pos: PlantOperatingStatesAnalysis, state: PlantOperatingState): string {
  const level = pos.decayHeatCharacterizations.find((entry) => entry.posId === state.uuid)?.decayHeatLevel ?? state.rcsParameters.decayHeatLevel;
  const value = level.representative > 0 ? level.representative : level.max;
  return value > 0 ? `${String(value)} ${level.units ?? "MW"}` : "At power";
}

function posBarriers(pos: PlantOperatingStatesAnalysis): string[] {
  return [...new Set(pos.plantOperatingStates.flatMap((state) => [
    ...state.radionuclideTransportBarriers.map((barrier) => barrier.name),
    ...state.radioactiveMaterialSources.flatMap((source) => source.barriers),
  ]))].filter((name) => name.length > 0);
}

function sequenceInfo(es: EventSequenceAnalysis): Record<string, ScLinkedSequence> {
  return Object.fromEntries(es.eventSequences.map((sequence) => [sequence.uuid, {
    scenario: sequence.name.split(" · ")[0],
    ieId: sequence.initiatingEventId,
    states: Object.entries(sequence.functionalEventStates ?? {}).map(([fn, state]) => ({ fn, ok: state === "SUCCESS" })),
    outcome: String(sequence.endState) === "SUCCESSFUL_MITIGATION" ? "safe stable state" : sequence.releaseCategoryId !== undefined ? `release (${sequence.releaseCategoryId})` : "release",
  }]));
}

async function loadScLinkedInputs(links: ScLinkedWorkbooks): Promise<ScLinkedInputs> {
  const [pos, ie, es] = await Promise.all([
    links.POS === undefined ? undefined : loadLinkedPos(links.POS),
    links.IE === undefined ? undefined : loadLinkedIe(links.IE),
    links.ES === undefined ? undefined : loadLinkedEs(links.ES),
  ]);
  return {
    posStates: pos === undefined ? [] : pos.plantOperatingStates.map((state) => ({ id: state.uuid, name: state.name, decayLabel: decayLabel(pos, state) })),
    posBarriers: pos === undefined ? [] : posBarriers(pos),
    ieGroups: (ie?.initiatingEventGroups ?? []).map((group) => ({ id: group.uuid, name: group.name })),
    esFunctions: (es?.keySafetyFunctions ?? []).map((fn) => ({ id: fn.id, name: fn.name, supportingSystems: fn.supportingSystems })),
    esSequenceInfo: es === undefined ? {} : sequenceInfo(es),
  };
}

function withRecorded(choices: readonly ScChoice[], recorded: readonly string[]): ScChoice[] {
  const known = new Set(choices.map((choice) => choice.id));
  const extra = [...new Set(recorded)].filter((id) => id.length > 0 && !known.has(id));
  return [...choices, ...extra.map((id) => ({ id, label: "" }))];
}

function scChoices(sc: SuccessCriteriaDevelopment, links: ScLinkedInputs | null): ScChoices {
  const criteria = sc.safetyFunctionSuccessCriteria;
  return {
    states: withRecorded((links?.posStates ?? []).map((state) => ({ id: state.id, label: `${state.name} · ${state.decayLabel}` })), criteria.map((criterion) => criterion.plantOperatingStateId)),
    barriers: withRecorded((links?.posBarriers ?? []).map((barrier) => ({ id: barrier, label: "" })), sc.radionuclideBarrierCriteria.map((barrier) => barrier.barrierId)),
    initiators: withRecorded((links?.ieGroups ?? []).map((group) => ({ id: group.id, label: group.name })), criteria.map((criterion) => criterion.initiatingEventId)),
    functions: withRecorded(
      (links?.esFunctions ?? []).map((fn) => ({ id: fn.id, label: fn.name })),
      [...criteria.map((criterion) => criterion.safetyFunctionId), ...(sc.passiveSafetyFunctionCriteria ?? []).map((passive) => passive.safetyFunctionId)],
    ),
  };
}

function choiceLabel(choices: readonly ScChoice[], id: string): string {
  if (id.length === 0) return "Not set";
  const label = choices.find((choice) => choice.id === id)?.label ?? "";
  return label.length > 0 ? label : id;
}

function supportingSystems(links: ScLinkedInputs | null, functionId: string): string[] {
  return links?.esFunctions.find((fn) => fn.id === functionId)?.supportingSystems ?? [];
}

export {
  SC_LINK_CODES,
  choiceLabel,
  listScLinkOptions,
  loadScLinkedInputs,
  scChoices,
  supportingSystems,
  withLink,
  type ScChoice,
  type ScChoices,
  type ScLinkActions,
  type ScLinkCode,
  type ScLinkOption,
};
