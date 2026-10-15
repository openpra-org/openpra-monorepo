import type {
  EsqSequenceRecord,
  EsqSolveWork,
  EventSequenceQuantification,
} from "./event-sequence-quantification";
import { canonicalJson, type CanonicalValue } from "../core/uncertainty";
import { cellExpressionOfRecord } from "./esq-barrier-inputs";
import { esqStableId, hash32 } from "./esq-run-inputs";

interface SolveInputsOptions {
  combinations: boolean;
}

interface ListSpec<T> {
  keyOf: (item: T) => string;
  plural: string;
  added: (key: string) => string;
  removed: (key: string) => string;
  changed: (key: string, field: string, from: CanonicalValue, to: CanonicalValue) => string;
}

type Lookup = (esq: EventSequenceQuantification, key: string) => string | undefined;

const FIELD_TEXT: ReadonlyMap<string, string> = new Map([
  ["heldBy", "source"],
  ["holderId", "source"],
  ["expression", "value"],
  ["target", "target"],
  ["rules", "tree rules"],
  ["shares", "state shares"],
  ["parameterId", "DA parameter"],
  ["familyId", "family"],
  ["eventIds", "events"],
  ["groupIds", "initiator groups"],
  ["stateIds", "operating states"],
  ["treeIds", "event trees"],
  ["functionIds", "functional events"],
  ["initiatorId", "initiator group"],
  ["stateId", "operating state"],
  ["endState", "end state"],
  ["transferTreeId", "transfer"],
  ["missionTime", "mission time"],
  ["esMissionTime", "ES mission time"],
  ["memberIds", "members"],
  ["hep", "HEP"],
  ["hfeId", "HFE"],
  ["hfeIds", "HFEs"],
  ["credited", "credit"],
  ["typed", "typed value"],
  ["ofRecord", "value of record"],
  ["waived", "floor waiver"],
  ["jointHep", "joint HEP"],
  ["dependencyId", "HR dependency"],
  ["includesRecovery", "recovery link"],
  ["level", "dependence level"],
  ["manual", "typed entry"],
  ["repair", "repair setting"],
]);

function esqModelRunId(): string {
  return esqStableId("model-run");
}

function sequenceFamilyOf(esq: EventSequenceQuantification, record: EsqSequenceRecord): string | undefined {
  if (record.transferTreeId !== undefined) return undefined;
  const choice = esq.modelDecisions?.sequenceChoices?.find((entry) => entry.sequenceId === record.id);
  return choice?.familyId ?? record.familyId;
}

function solveInputsOf(esq: EventSequenceQuantification, options: SolveInputsOptions = { combinations: true }) {
  const model = esq.model;
  const post = esq.postWork ?? {};
  const decisions = esq.modelDecisions ?? {};
  const logic = esq.logic ?? {};
  const plan = esq.quantificationPlan ?? {};
  return {
    model: model === undefined ? null : {
      trees: model.trees,
      sequences: model.sequences,
      functions: model.functions,
      tops: model.tops,
      initiators: model.initiators,
      states: model.states,
      events: model.events,
      ccfGroups: model.ccfGroups,
      parameters: model.parameters.map((parameter) => parameter.id),
      humanEvents: model.humanEvents,
      recoveries: model.recoveries,
      repairs: model.repairs,
      dependencies: model.dependencies,
      jointFloor: model.jointFloor?.value,
    },
    links: (decisions.functionLinks ?? []).map((link) => ({
      functionId: link.functionId,
      target: link.target,
      rules: (link.rules ?? []).map((rule) => ({ id: rule.id, treeIds: rule.treeIds, groupIds: rule.groupIds, stateIds: rule.stateIds, target: rule.target })),
    })),
    initiators: (decisions.initiatorChoices ?? []).map((choice) => ({
      groupId: choice.groupId,
      source: choice.source,
      parameterId: choice.parameterId,
      expression: choice.expression,
      shares: choice.shares,
    })),
    sequences: (decisions.sequenceChoices ?? []).map((choice) => ({ sequenceId: choice.sequenceId, familyId: choice.familyId })),
    values: (decisions.valueBindings ?? []).map((binding) => ({ eventId: binding.eventId, heldBy: binding.heldBy, holderId: binding.holderId, expression: binding.expression })),
    flags: (logic.flags ?? []).map((flag) => ({ id: flag.id, target: flag.target, state: flag.state, groupIds: flag.groupIds, stateIds: flag.stateIds })),
    loopBreaks: (logic.loopBreaks ?? []).map((entry) => ({ fromModelId: entry.fromModelId, toModelId: entry.toModelId, state: entry.state })),
    exclusions: (logic.exclusions ?? []).map((exclusion) => ({ id: exclusion.id, eventIds: exclusion.eventIds })),
    cells: (esq.barrierWork?.cells ?? []).map((cell) => ({ id: cell.id, value: cellExpressionOfRecord(cell) ?? null })),
    scope: (esq.modelIntegration.scopeExclusions ?? []).map((exclusion) => ({ aspect: exclusion.aspect, item: exclusion.item })),
    recoveries: post.recoveries?.map((rule) => ({
      id: rule.id,
      manual: rule.manual !== undefined,
      repair: rule.manual?.repair,
      eventIds: rule.eventIds,
      groupIds: rule.groupIds,
      stateIds: rule.stateIds,
      credited: rule.credited,
      feasibility: rule.feasibility,
      parameterId: rule.parameterId,
      typed: rule.typed?.expression,
      ofRecord: rule.ofRecord,
    })),
    combinations: options.combinations ? post.combinations?.map((combination) => ({
      id: combination.id,
      eventIds: combination.eventIds,
      dependencyId: combination.dependencyId,
      level: combination.level,
      typed: combination.typed?.joint,
      ofRecord: combination.ofRecord,
      waived: combination.floorWaiver !== undefined && combination.floorWaiver.trim().length > 0,
      groupIds: combination.groupIds,
      stateIds: combination.stateIds,
    })) : undefined,
    floor: options.combinations ? post.floor?.value : undefined,
    plan: {
      stateWeighting: plan.stateWeighting?.value,
      modulesPerPlant: plan.modulesPerPlant?.value,
    },
  };
}

function solveInputsKey(esq: EventSequenceQuantification, options: SolveInputsOptions = { combinations: true }): string {
  const text = canonicalJson(solveInputsOf(esq, options));
  return [0x9747b28c, 0x2f1e3d4c].map((seed) => hash32(text, seed).toString(16).padStart(8, "0")).join("");
}

function words(key: string): string {
  let out = "";
  for (const character of key) {
    const lower = character.toLowerCase();
    if (lower !== character && out.length > 0 && !out.endsWith(" ")) out += " ";
    out += lower;
  }
  return out;
}

function fieldText(field: string): string {
  return FIELD_TEXT.get(field) ?? words(field);
}

function numberText(value: number): string {
  if (!Number.isFinite(value) || value === 0 || (Number.isInteger(value) && Math.abs(value) < 1e6)) return String(value);
  const [mantissa, exponent] = value.toExponential(2).split("e");
  const power = Number(exponent);
  const digits = String(Number(mantissa));
  return power === 0 ? digits : `${digits}E${power}`;
}

function pointValue(value: CanonicalValue): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value !== "object" || value === null || !("node" in value) || value.node !== "VALUE" || !("value" in value)) return undefined;
  const inner = value.value;
  if (typeof inner !== "object" || inner === null || !("law" in inner)) return undefined;
  const law = inner.law;
  if (typeof law !== "object" || law === null || !("family" in law) || law.family !== "POINT" || !("value" in law) || typeof law.value !== "number") return undefined;
  return law.value;
}

function fromTo(from: CanonicalValue, to: CanonicalValue): string {
  const before = pointValue(from);
  const after = pointValue(to);
  return before === undefined || after === undefined ? "" : ` from ${numberText(before)} to ${numberText(after)}`;
}

function fieldsOf(item: object): Map<string, CanonicalValue> {
  return new Map(Object.entries(item).filter(([, value]) => value !== undefined));
}

function changedField(before: object | string, after: object | string): { field: string; from: CanonicalValue; to: CanonicalValue } {
  if (typeof before === "string" || typeof after === "string") return { field: "", from: before, to: after };
  const left = fieldsOf(before);
  const right = fieldsOf(after);
  const field = [...new Set([...left.keys(), ...right.keys()])].sort().find((key) => canonicalJson(left.get(key) ?? null) !== canonicalJson(right.get(key) ?? null)) ?? "";
  return { field, from: left.get(field), to: right.get(field) };
}

function listChanges<T extends object | string>(before: readonly T[] | undefined, after: readonly T[] | undefined, spec: ListSpec<T>): string[] {
  const earlier = new Map<string, T>();
  const later = new Map<string, T>();
  for (const item of before ?? []) if (!earlier.has(spec.keyOf(item))) earlier.set(spec.keyOf(item), item);
  for (const item of after ?? []) if (!later.has(spec.keyOf(item))) later.set(spec.keyOf(item), item);
  const found: string[] = [];
  for (const [key, item] of earlier) {
    const next = later.get(key);
    if (next === undefined) {
      found.push(spec.removed(key));
      continue;
    }
    if (canonicalJson(item) === canonicalJson(next)) continue;
    const change = changedField(item, next);
    found.push(spec.changed(key, change.field, change.from, change.to));
  }
  for (const key of later.keys()) if (!earlier.has(key)) found.push(spec.added(key));
  if (found.length > 0 || canonicalJson(before ?? null) === canonicalJson(after ?? null)) return found;
  return [(before ?? []).length === (after ?? []).length ? `The order of the ${spec.plural} changed` : `The list of ${spec.plural} changed`];
}

function recordSpec<T extends object | string>(kind: string, plural: string, keyOf: (item: T) => string, label: (key: string) => string): ListSpec<T> {
  return {
    keyOf,
    plural,
    added: (key) => `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${label(key)} was added`,
    removed: (key) => `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${label(key)} was removed`,
    changed: (key, field, from, to) => (field.length === 0 ? `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${label(key)} changed` : `The ${fieldText(field)} of ${kind} ${label(key)} changed${fromTo(from, to)}`),
  };
}

function wholeSpec<T extends object | string>(plural: string, keyOf: (item: T) => string, sentence: (key: string) => string): ListSpec<T> {
  return { keyOf, plural, added: sentence, removed: sentence, changed: sentence };
}

function filled(text: string | undefined): string | undefined {
  return text !== undefined && text.trim().length > 0 ? text.trim() : undefined;
}

function solveInputsChange(saved: EventSequenceQuantification, current: EventSequenceQuantification, options: SolveInputsOptions = { combinations: true }): string | undefined {
  const before = solveInputsOf(saved, options);
  const after = solveInputsOf(current, options);
  const name = (lookup: Lookup) => (key: string): string => lookup(current, key) ?? lookup(saved, key) ?? key;
  const tree = name((esq, key) => esq.model?.trees.find((entry) => entry.id === key)?.code);
  const sequence = name((esq, key) => esq.model?.sequences.find((entry) => entry.id === key)?.code);
  const fn = name((esq, key) => filled(esq.model?.functions.find((entry) => entry.id === key)?.name));
  const top = name((esq, key) => esq.model?.tops.find((entry) => `${entry.modelId}:${entry.gateId}` === key || entry.modelId === key)?.code);
  const initiator = name((esq, key) => filled(esq.model?.initiators.find((entry) => entry.id === key)?.name));
  const state = name((esq, key) => filled(esq.model?.states.find((entry) => entry.id === key)?.name));
  const event = name((esq, key) => esq.model?.events.find((entry) => entry.id === key)?.code);
  const group = name((esq, key) => filled(esq.model?.ccfGroups.find((entry) => entry.id === key)?.name));
  const repair = name((esq, key) => filled(esq.model?.repairs?.find((entry) => entry.id === key)?.equipment));
  const flag = name((esq, key) => filled(esq.logic?.flags?.find((entry) => entry.id === key)?.name));
  const breakLabel = (key: string): string => {
    const [fromModelId = "", toModelId = ""] = key.split(">");
    return `from ${top(fromModelId)} to ${top(toModelId)}`;
  };
  const scopeLabel = (key: string): string => {
    const [aspect = "", item = ""] = key.split("|");
    return aspect === "INITIATOR_GROUP" ? `Initiator group ${initiator(item)}` : aspect === "OPERATING_STATE" ? `Operating state ${state(item)}` : aspect === "SOURCE" ? `Source ${item}` : `Hazard group ${item}`;
  };
  const byId = (item: { id: string }): string => item.id;
  const asIs = (key: string): string => key;
  const found: string[] = [];
  const earlierModel = before.model;
  const laterModel = after.model;
  if (earlierModel === null || laterModel === null) {
    if (earlierModel === null && laterModel !== null) found.push("The Step 02 model was imported");
    if (earlierModel !== null && laterModel === null) found.push("The Step 02 model was removed");
  } else {
    found.push(
      ...listChanges(earlierModel.trees, laterModel.trees, recordSpec("event tree", "event trees", byId, tree)),
      ...listChanges(earlierModel.sequences, laterModel.sequences, recordSpec("sequence", "sequences", byId, sequence)),
      ...listChanges(earlierModel.functions, laterModel.functions, recordSpec("function", "functions", byId, fn)),
      ...listChanges(earlierModel.tops, laterModel.tops, recordSpec("fault tree", "fault trees", (item: { modelId: string; gateId: string }) => `${item.modelId}:${item.gateId}`, top)),
      ...listChanges(earlierModel.initiators, laterModel.initiators, recordSpec("initiator group", "initiator groups", byId, initiator)),
      ...listChanges(earlierModel.states, laterModel.states, recordSpec("operating state", "operating states", byId, state)),
      ...listChanges(earlierModel.events, laterModel.events, recordSpec("basic event", "basic events", byId, event)),
      ...listChanges(earlierModel.ccfGroups, laterModel.ccfGroups, recordSpec("common cause group", "common cause groups", byId, group)),
      ...listChanges(earlierModel.parameters, laterModel.parameters, recordSpec("DA parameter", "DA parameters", asIs, asIs)),
      ...listChanges(earlierModel.humanEvents, laterModel.humanEvents, recordSpec("HFE", "HFEs", byId, asIs)),
      ...listChanges(earlierModel.recoveries, laterModel.recoveries, recordSpec("HR recovery", "HR recoveries", byId, asIs)),
      ...listChanges(earlierModel.repairs, laterModel.repairs, recordSpec("ES repair", "ES repairs", byId, repair)),
      ...listChanges(earlierModel.dependencies, laterModel.dependencies, recordSpec("HR dependency", "HR dependencies", byId, asIs)),
    );
    if (earlierModel.jointFloor !== laterModel.jointFloor) found.push(`The HR joint HEP floor changed${fromTo(earlierModel.jointFloor ?? null, laterModel.jointFloor ?? null)}`);
  }
  found.push(
    ...listChanges(before.links, after.links, wholeSpec("function links", (item: { functionId: string }) => item.functionId, (key) => `The link of function ${fn(key)} changed`)),
    ...listChanges(before.initiators, after.initiators, wholeSpec("initiator frequencies", (item: { groupId: string }) => item.groupId, (key) => `The frequency of initiator group ${initiator(key)} changed`)),
    ...listChanges(before.sequences, after.sequences, wholeSpec("family moves", (item: { sequenceId: string }) => item.sequenceId, (key) => `The family of sequence ${sequence(key)} changed`)),
    ...listChanges(before.values, after.values, {
      ...wholeSpec("event values", (item: { eventId: string }) => item.eventId, (key) => `The value of basic event ${event(key)} changed`),
      changed: (key: string, field: string, from: CanonicalValue, to: CanonicalValue) => `The ${fieldText(field)} of basic event ${event(key)} changed${fromTo(from, to)}`,
    }),
    ...listChanges(before.flags, after.flags, recordSpec("flag", "flags", byId, flag)),
    ...listChanges(before.loopBreaks, after.loopBreaks, recordSpec("loop break", "loop breaks", (item: { fromModelId: string; toModelId: string }) => `${item.fromModelId}>${item.toModelId}`, breakLabel)),
    ...listChanges(before.exclusions, after.exclusions, recordSpec("exclusion", "exclusions", byId, asIs)),
    ...listChanges(before.cells, after.cells, {
      ...recordSpec("barrier cell", "barrier cells", byId, asIs),
      changed: (key: string, _field: string, from: CanonicalValue, to: CanonicalValue) => `The value of barrier cell ${key} changed${fromTo(from, to)}`,
    }),
    ...listChanges(before.scope, after.scope, {
      keyOf: (item: { aspect: string; item: string }) => `${item.aspect}|${item.item}`,
      plural: "scope exclusions",
      added: (key: string) => `${scopeLabel(key)} was excluded from the scope`,
      removed: (key: string) => `${scopeLabel(key)} was brought back into the scope`,
      changed: (key: string) => `${scopeLabel(key)} changed in the scope`,
    }),
    ...listChanges(before.recoveries, after.recoveries, recordSpec("recovery", "recoveries", byId, asIs)),
    ...listChanges(before.combinations, after.combinations, recordSpec("HFE combination", "HFE combinations", byId, asIs)),
  );
  if (before.floor !== after.floor) found.push(`The joint HEP floor changed${fromTo(before.floor ?? null, after.floor ?? null)}`);
  if (before.plan.stateWeighting !== after.plan.stateWeighting) found.push("The operating state weighting changed");
  if (before.plan.modulesPerPlant !== after.plan.modulesPerPlant) found.push(`The modules per plant changed${fromTo(before.plan.modulesPerPlant ?? null, after.plan.modulesPerPlant ?? null)}`);
  const [first] = found;
  if (first === undefined) return undefined;
  const others = found.length - 1;
  return others === 0 ? `${first}.` : `${first}, and ${String(others)} other ${others === 1 ? "input" : "inputs"} changed.`;
}

function solveWorkOf(esq: EventSequenceQuantification): EsqSolveWork {
  return esq.solve ?? { families: [] };
}

export { esqModelRunId, sequenceFamilyOf, solveInputsChange, solveInputsKey, solveWorkOf };
