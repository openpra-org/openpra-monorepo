import type { EsqTreeRecord, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import {
  ccfInputKey,
  eventInputKey,
  importanceGroupsOf,
  initiatorInputKey,
  type EsqImportanceGroup,
  type EsqSampledInput,
  type EsqSamplingLaw,
} from "interfaces-mef-types/esq/esq-measure-inputs";
import type {
  EsqEventTreeRunLogic,
  EsqUncertaintyCorrelation,
  EsqUncertaintyUnsampled,
  EventTreeSamplingMethod,
} from "interfaces-shared-types/newly-developed-methods";
import type { EsqCaseOverrides } from "interfaces-mef-types/esq/esq-sensitivity-inputs";
import type { EsqRunBuild, EsqRunEventValue } from "./esq-model-run-builder";

interface EsqImportanceSpecGroup {
  key: string;
  events: string[];
  ccfGroups: string[];
}

interface EsqSamplingSpec {
  trials: number;
  seed: number;
  method: EventTreeSamplingMethod;
  keys: { key: string; distribution: EsqSamplingLaw }[];
  events: { id: string; key: string; form: "PROBABILITY" | "RATE"; scale: number }[];
  ccfGroups: { id: string; key: string; scale: number }[];
  initiator?: { key: string; scale: number };
}

interface EsqSamplingSettings {
  trials: number;
  seed: number;
  method: EventTreeSamplingMethod;
  correlation: EsqUncertaintyCorrelation;
}

interface EsqSamplingUse {
  input: EsqSampledInput;
  law: EsqSamplingLaw;
  events: Set<string>;
}

interface EsqSamplingTally {
  used: Map<string, EsqSamplingUse>;
  unsampled: Map<string, EsqUncertaintyUnsampled>;
}

function importanceGroupsFor(esq: EventSequenceQuantification, logic: EsqEventTreeRunLogic): EsqImportanceGroup[] {
  const groups = importanceGroupsOf(esq);
  if (logic.expandCcf) return groups;
  const members = new Map((esq.model?.ccfGroups ?? []).map((group) => [group.id, group.memberIds]));
  return groups.map((group) => ({
    ...group,
    events: [...new Set([...group.events, ...group.ccfGroups.flatMap((groupId) => members.get(groupId) ?? [])])],
    ccfGroups: [],
  }));
}

function importanceSpecFor(groups: readonly EsqImportanceGroup[], build: EsqRunBuild): EsqImportanceSpecGroup[] {
  const events = new Set(build.values.map((value) => value.id));
  const ccfGroups = new Set(build.ccfGroups.map((group) => group.id));
  return groups.flatMap((group) => {
    const present = group.events.filter((id) => events.has(id));
    const presentGroups = group.ccfGroups.filter((id) => ccfGroups.has(id));
    return present.length === 0 && presentGroups.length === 0 ? [] : [{ key: group.key, events: present, ccfGroups: presentGroups }];
  });
}

function caseOverridesFor(overrides: EsqCaseOverrides | undefined, build: EsqRunBuild): EsqCaseOverrides | undefined {
  if (overrides === undefined) return undefined;
  const events = new Set(build.values.map((value) => value.id));
  const ccfGroups = new Set(build.ccfGroups.map((group) => group.id));
  const present: EsqCaseOverrides = {
    events: overrides.events.filter((item) => events.has(item.id)).map((item) => ({ ...item })),
    ccfGroups: overrides.ccfGroups.filter((item) => ccfGroups.has(item.id)).map((item) => ({ ...item })),
  };
  return present.events.length === 0 && present.ccfGroups.length === 0 ? undefined : present;
}

function baseKeyOf(esq: EventSequenceQuantification, value: EsqRunEventValue): string | undefined {
  const model = esq.model;
  if (model === undefined) return undefined;
  if (value.role === "RECOVERY") return value.recoveryId === undefined ? undefined : `RECOVERY:${value.recoveryId}`;
  if (value.role === "SPLIT") return value.splitKey;
  if (value.role === "JOINT" || value.role === "INDEPENDENT_PART") return value.baseEventId === undefined ? undefined : eventInputKey(esq, model, value.baseEventId);
  return eventInputKey(esq, model, value.id);
}

function samplingSpecFor(input: {
  esq: EventSequenceQuantification;
  build: EsqRunBuild;
  root: EsqTreeRecord;
  logic: EsqEventTreeRunLogic;
  settings: EsqSamplingSettings;
  inputs: ReadonlyMap<string, EsqSampledInput>;
  tally: EsqSamplingTally;
}): EsqSamplingSpec {
  const { esq, build, settings, inputs, tally } = input;
  const model = esq.model;
  const keys = new Map<string, EsqSamplingLaw>();
  const spec: EsqSamplingSpec = { trials: settings.trials, seed: settings.seed, method: settings.method, keys: [], events: [], ccfGroups: [] };
  const lawFor = (baseKey: string, user: string): { input: EsqSampledInput; law: EsqSamplingLaw; point: number } | undefined => {
    const known = inputs.get(baseKey);
    if (known === undefined) {
      tally.unsampled.set(baseKey, { id: baseKey, label: baseKey, reason: "The value has no input record. It stays at its point value." });
      return undefined;
    }
    if (known.law === undefined) {
      tally.unsampled.set(baseKey, { id: baseKey, label: known.label, reason: known.missing ?? "No distribution." });
      return undefined;
    }
    if (known.point === undefined || !(known.point > 0)) {
      tally.unsampled.set(baseKey, { id: baseKey, label: known.label, reason: "The point value is zero, so the draws cannot be scaled to it." });
      return undefined;
    }
    const use = tally.used.get(baseKey) ?? { input: known, law: known.law, events: new Set<string>() };
    use.events.add(user);
    tally.used.set(baseKey, use);
    return { input: known, law: known.law, point: known.point };
  };
  const keyFor = (baseKey: string, own: string, law: EsqSamplingLaw): string => {
    const key = settings.correlation === "SHARED" ? baseKey : `${baseKey}@${own}`;
    keys.set(key, law);
    return key;
  };
  const expanded = new Set(input.logic.expandCcf
    ? build.ccfGroups.flatMap((group) => model?.ccfGroups.find((record) => record.id === group.id)?.memberIds ?? [])
    : []);
  for (const value of build.values) {
    if (value.role === "BASIC" && expanded.has(value.id)) continue;
    const baseKey = baseKeyOf(esq, value);
    if (baseKey === undefined) continue;
    const found = lawFor(baseKey, value.id);
    if (found === undefined) continue;
    const rate = value.rate !== undefined && value.exposure !== undefined && value.rate > 0;
    const scale = rate ? ((value.exposure ?? 0) * (value.rate ?? 0)) / found.point : value.probability / found.point;
    if (!(Number.isFinite(scale) && scale > 0)) continue;
    spec.events.push({ id: value.id, key: keyFor(baseKey, value.id, found.law), form: rate ? "RATE" : "PROBABILITY", scale });
  }
  if (input.logic.expandCcf && model !== undefined) {
    for (const group of build.ccfGroups) {
      const baseKey = ccfInputKey(esq, model, group.id);
      const found = lawFor(baseKey, `ccf:${group.id}`);
      if (found === undefined) continue;
      const scale = group.total / found.point;
      if (!(Number.isFinite(scale) && scale > 0)) continue;
      spec.ccfGroups.push({ id: group.id, key: keyFor(baseKey, `ccf:${group.id}`, found.law), scale });
    }
  }
  const initiatorKey = initiatorInputKey(esq, input.root.initiatorId);
  const initiator = lawFor(initiatorKey, `initiator:${input.root.initiatorId}`);
  if (initiator !== undefined) {
    const scale = build.frequency / initiator.point;
    if (Number.isFinite(scale) && scale > 0) {
      keys.set(initiatorKey, initiator.law);
      spec.initiator = { key: initiatorKey, scale };
    }
  }
  spec.keys = [...keys.entries()].map(([key, distribution]) => ({ key, distribution }));
  return spec;
}

export {
  caseOverridesFor,
  importanceGroupsFor,
  importanceSpecFor,
  samplingSpecFor,
  type EsqImportanceSpecGroup,
  type EsqSamplingSettings,
  type EsqSamplingSpec,
  type EsqSamplingTally,
  type EsqSamplingUse,
};
