import { stringifyJson } from "interfaces-shared-types/json";
import type { WorkbookCrossReferenceType } from "interfaces-mef-types/modeling/references";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type {
  AnalysisRunContribution,
  WorkbookCrossReference,
  WorkbookMethodHostType,
} from "interfaces-shared-types/newly-developed-methods";
import { adaptSyFaultTreeSnapshot, WorkbookPraxisAdapterError } from "./praxis-snapshot-adapters";

type Json = null | boolean | number | string | Json[] | JsonRecord;

interface JsonRecord {
  [key: string]: Json;
}

interface ChangedSource {
  hostType: WorkbookMethodHostType;
  workbookId: string;
  saved: Json;
  current: Json | null;
  savedSy: SystemsAnalysis | null;
  currentSy: SystemsAnalysis | null;
}

interface FoundRecord {
  record: JsonRecord;
  collection: string;
}

interface IndexedSource {
  source: ChangedSource;
  saved: ReadonlyMap<string, FoundRecord>;
  current: ReadonlyMap<string, FoundRecord> | null;
}

interface TreeView {
  snapshot: JsonRecord;
  basicEvents: Map<string, Json>;
  groups: Map<string, JsonRecord>;
}

const IGNORED_KEYS: ReadonlySet<string> = new Set([
  "code",
  "name",
  "label",
  "abbreviation",
  "description",
  "notes",
  "layout",
  "viewport",
  "position",
  "nodePositions",
  "implementsSrs",
]);

const COLLECTION_TEXT: ReadonlyMap<string, string> = new Map([
  ["systemLogicModels", "fault tree"],
  ["systemBasicEvents", "basic event"],
  ["systemDefinitions", "system"],
  ["commonCauseFailureGroups", "common cause group"],
  ["eventTrees", "event tree"],
  ["functionalEvents", "functional event"],
  ["bayesianNetworks", "Bayesian network"],
  ["dependencyBayesianNetworks", "Bayesian network"],
  ["hclConfigurations", "HCL configuration"],
  ["dependencyHclConfigurations", "HCL configuration"],
  ["bindings", "HCL binding"],
  ["nodes", "BN node"],
  ["gates", "gate"],
  ["parameters", "parameter"],
  ["missionTimes", "mission time"],
  ["componentMissionTimes", "component mission time"],
  ["ccfFactors", "common cause factor"],
  ["ccfVectors", "common cause vector"],
  ["humanFailureEvents", "human failure event"],
]);

const REFERENCE_TEXT: Readonly<Record<WorkbookCrossReferenceType, string>> = {
  FAULT_TREE_TOP_EVENT: "top event",
  FAULT_TREE_BASIC_EVENT: "basic event",
  EVENT_TREE_FUNCTIONAL_EVENT: "functional event",
  BAYESIAN_NETWORK_NODE: "BN node",
  HCL_BINDING: "HCL binding",
  WORKBOOK_PARAMETER: "parameter",
  HUMAN_FAILURE_EVENT: "human failure event",
  EVENT_SEQUENCE_FAMILY: "event sequence family",
  EVENT_SEQUENCE_FAMILY_QUANTIFICATION: "family quantification",
  RADIOLOGICAL_CONSEQUENCE_RESULT: "consequence result",
  INTEGRATED_RISK_RESULT: "risk result",
};

const LEAF_TEXT: ReadonlyMap<string, string> = new Map([
  ["BASIC_EVENT_REFERENCE", "Basic event"],
  ["HOUSE_EVENT", "House event"],
  ["UNDEVELOPED_EVENT", "Undeveloped event"],
]);

function jsonOf(value: object): Json {
  const parsed: Json = JSON.parse(stringifyJson(value) ?? "null");
  return parsed;
}

function isRecord(value: Json | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function field(record: JsonRecord, key: string): Json | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function text(record: JsonRecord, key: string): string | undefined {
  const value = field(record, key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function filled(value: string | undefined): string | undefined {
  return value !== undefined && value.trim().length > 0 ? value.trim() : undefined;
}

function arrayOf(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}

function recordList(value: Json | undefined): JsonRecord[] {
  return arrayOf(value).filter(isRecord);
}

function idOf(record: JsonRecord): string | undefined {
  if (Object.hasOwn(record, "workbookId") || Object.hasOwn(record, "referenceType")) return undefined;
  return text(record, "uuid") ?? text(record, "id") ?? text(record, "modelId");
}

function labelOf(record: JsonRecord): string | undefined {
  return text(record, "code") ?? text(record, "label") ?? text(record, "abbreviation") ?? text(record, "name");
}

function canonical(value: Json | undefined): string {
  if (value === undefined) return "-";
  if (Array.isArray(value)) return `[${value.map((entry) => canonical(entry)).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .filter((key) => !IGNORED_KEYS.has(key))
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(field(value, key))}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function words(key: string): string {
  let out = "";
  for (const character of key) {
    if (character === "_" || character === "-") {
      out += " ";
      continue;
    }
    const lower = character.toLowerCase();
    if (lower !== character && out.length > 0 && !out.endsWith(" ")) out += " ";
    out += lower;
  }
  return out.trim();
}

function sentence(value: string): string {
  return value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function kindOf(collection: string): string | undefined {
  return COLLECTION_TEXT.get(collection);
}

function findRecord(value: Json, id: string, collection: string): FoundRecord | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findRecord(entry, id, collection);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  if (idOf(value) === id) return { record: value, collection };
  for (const [key, entry] of Object.entries(value)) {
    const keyed = isRecord(entry) && idOf(entry) === key;
    const found = findRecord(entry, id, keyed ? collection : key);
    if (found !== undefined) return found;
  }
  return undefined;
}

function indexRecords(root: Json): ReadonlyMap<string, FoundRecord> {
  const index = new Map<string, FoundRecord>();
  const visit = (value: Json, collection: string): void => {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, collection);
      return;
    }
    if (!isRecord(value)) return;
    const id = idOf(value);
    if (id !== undefined && !index.has(id)) index.set(id, { record: value, collection });
    for (const [key, entry] of Object.entries(value)) {
      visit(entry, isRecord(entry) && idOf(entry) === key ? collection : key);
    }
  };
  visit(root, "");
  return index;
}

function within(model: FoundRecord | undefined, id: string): FoundRecord | undefined {
  return model === undefined ? undefined : findRecord(model.record, id, model.collection);
}

function recordsById(list: Json[]): Map<string, JsonRecord> {
  const records = new Map<string, JsonRecord>();
  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const id = idOf(entry);
    if (id !== undefined && !records.has(id)) records.set(id, entry);
  }
  return records;
}

function changedKey(before: JsonRecord, after: JsonRecord): string | undefined {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !IGNORED_KEYS.has(key))
    .sort();
  return keys.find((key) => canonical(field(before, key)) !== canonical(field(after, key)));
}

function recordChange(kind: string, before: JsonRecord, after: JsonRecord | undefined, fallback: string): string | null {
  const label = labelOf(after ?? before) ?? fallback;
  if (after === undefined) return `${sentence(kind)} ${label} was deleted.`;
  const key = changedKey(before, after);
  return key === undefined ? null : `The ${words(key)} of ${kind} ${label} changed.`;
}

function pointOf(expression: Json | undefined): number | undefined {
  if (!isRecord(expression) || text(expression, "node") !== "VALUE") return undefined;
  const value = field(expression, "value");
  const law = isRecord(value) ? field(value, "law") : undefined;
  if (!isRecord(law) || text(law, "family") !== "POINT") return undefined;
  const point = field(law, "value");
  return typeof point === "number" ? point : undefined;
}

function pointText(value: number): string {
  return value.toExponential(2).toUpperCase();
}

function basicEventCode(mef: SystemsAnalysis, id: string): string {
  return filled(mef.systemBasicEvents.find((event) => event.uuid === id)?.code) ?? id;
}

function groupName(mef: SystemsAnalysis, id: string): string {
  return filled(mef.commonCauseFailureGroups.find((group) => group.uuid === id)?.name) ?? id;
}

function adaptedTree(mef: SystemsAnalysis, modelId: string): TreeView | null {
  try {
    const adapted = adaptSyFaultTreeSnapshot({ workbookId: "change", workbookRevision: 0, mef }, modelId, { collectOnly: true });
    const snapshot = jsonOf(adapted.modelSnapshot);
    const catalogue = jsonOf(adapted.basicEventCatalogue);
    if (!isRecord(snapshot) || !isRecord(catalogue)) return null;
    const basicEvents = new Map<string, Json>();
    for (const event of recordList(field(catalogue, "basicEvents"))) {
      const id = text(event, "id");
      if (id !== undefined) basicEvents.set(id, field(event, "expression") ?? null);
    }
    return { snapshot, basicEvents, groups: recordsById(arrayOf(field(catalogue, "commonCauseFailureGroups"))) };
  } catch (error) {
    if (error instanceof WorkbookPraxisAdapterError) return null;
    throw error;
  }
}

function inputsByGate(snapshot: JsonRecord): Map<string, string> {
  const lists = new Map<string, string[]>();
  for (const input of recordList(field(snapshot, "gateInputs"))) {
    const gateId = text(input, "gateId");
    if (gateId === undefined) continue;
    const edge = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "id" && key !== "gateId"));
    lists.set(gateId, [...(lists.get(gateId) ?? []), canonical(edge)]);
  }
  return new Map([...lists].map(([gateId, edges]) => [gateId, edges.sort().join("|")]));
}

function leafName(leaf: JsonRecord, mef: SystemsAnalysis): string {
  const basicEventId = text(leaf, "basicEventId");
  const code = basicEventId === undefined ? labelOf(leaf) ?? text(leaf, "id") ?? "" : basicEventCode(mef, basicEventId);
  return `${LEAF_TEXT.get(text(leaf, "kind") ?? "") ?? "Event"} ${code}`;
}

function structureChange(
  tree: string,
  before: TreeView,
  after: TreeView,
  saved: SystemsAnalysis,
  current: SystemsAnalysis,
): string | null {
  const gatesBefore = recordsById(arrayOf(field(before.snapshot, "gates")));
  const gatesAfter = recordsById(arrayOf(field(after.snapshot, "gates")));
  const gateName = (id: string): string => {
    const gate = gatesAfter.get(id) ?? gatesBefore.get(id);
    return (gate === undefined ? undefined : labelOf(gate)) ?? id;
  };
  const topOf = (view: TreeView): string | undefined => {
    const top = field(view.snapshot, "topGate");
    return isRecord(top) ? text(top, "gateId") : undefined;
  };
  const topAfter = topOf(after);
  if (topOf(before) !== topAfter && topAfter !== undefined) return `The top gate of ${tree} changed to ${gateName(topAfter)}.`;
  for (const [id, gate] of gatesBefore) {
    const next = gatesAfter.get(id);
    if (next === undefined) return `Gate ${gateName(id)} was removed from ${tree}.`;
    if (canonical(gate) === canonical(next)) continue;
    const fromType = text(gate, "gateType");
    const toType = text(next, "gateType");
    if (fromType !== toType) return `Gate ${gateName(id)} in ${tree} changed from ${fromType ?? "no type"} to ${toType ?? "no type"}.`;
    const fromK = field(gate, "k");
    const toK = field(next, "k");
    if (canonical(fromK) !== canonical(toK)) return `The K of gate ${gateName(id)} in ${tree} changed from ${canonical(fromK)} to ${canonical(toK)}.`;
    return `Gate ${gateName(id)} in ${tree} changed.`;
  }
  for (const id of gatesAfter.keys()) {
    if (!gatesBefore.has(id)) return `Gate ${gateName(id)} was added to ${tree}.`;
  }
  const leavesBefore = recordsById(arrayOf(field(before.snapshot, "leafNodes")));
  const leavesAfter = recordsById(arrayOf(field(after.snapshot, "leafNodes")));
  for (const [id, leaf] of leavesBefore) {
    const next = leavesAfter.get(id);
    if (next === undefined) return `${leafName(leaf, saved)} was removed from ${tree}.`;
    if (canonical(leaf) === canonical(next)) continue;
    const fromState = field(leaf, "state");
    const toState = field(next, "state");
    if (typeof fromState === "boolean" && typeof toState === "boolean" && fromState !== toState) {
      return `${leafName(next, current)} in ${tree} changed from ${String(fromState)} to ${String(toState)}.`;
    }
    return `${leafName(next, current)} in ${tree} changed.`;
  }
  for (const [id, leaf] of leavesAfter) {
    if (!leavesBefore.has(id)) return `${leafName(leaf, current)} was added to ${tree}.`;
  }
  const inputsBefore = inputsByGate(before.snapshot);
  const inputsAfter = inputsByGate(after.snapshot);
  for (const gateId of new Set([...inputsBefore.keys(), ...inputsAfter.keys()])) {
    if ((inputsBefore.get(gateId) ?? "") !== (inputsAfter.get(gateId) ?? "")) return `The inputs of gate ${gateName(gateId)} in ${tree} changed.`;
  }
  return null;
}

function valueChange(before: TreeView, after: TreeView, saved: SystemsAnalysis, current: SystemsAnalysis): string | null {
  for (const [id, expression] of before.basicEvents) {
    const next = after.basicEvents.get(id);
    if (next === undefined || canonical(expression) === canonical(next)) continue;
    const from = pointOf(expression);
    const to = pointOf(next);
    return from !== undefined && to !== undefined
      ? `The value of basic event ${basicEventCode(current, id)} changed from ${pointText(from)} to ${pointText(to)}.`
      : `The value of basic event ${basicEventCode(current, id)} changed.`;
  }
  for (const id of after.basicEvents.keys()) {
    if (!before.basicEvents.has(id)) return `The value of basic event ${basicEventCode(current, id)} changed.`;
  }
  for (const [id, group] of before.groups) {
    const next = after.groups.get(id);
    if (next === undefined) return `Common cause group ${groupName(saved, id)} was removed.`;
    if (canonical(group) !== canonical(next)) return `Common cause group ${groupName(current, id)} changed.`;
  }
  for (const id of after.groups.keys()) {
    if (!before.groups.has(id)) return `Common cause group ${groupName(current, id)} was added.`;
  }
  return null;
}

function faultTreeChange(saved: SystemsAnalysis, current: SystemsAnalysis, modelId: string): string | null {
  const savedModel = saved.systemLogicModels.find((model) => model.uuid === modelId);
  if (savedModel === undefined) return null;
  const currentModel = current.systemLogicModels.find((model) => model.uuid === modelId);
  const tree = `fault tree ${filled(currentModel?.code) ?? filled(savedModel.code) ?? savedModel.name}`;
  if (currentModel === undefined) return `${sentence(tree)} was deleted.`;
  if (currentModel.topGate === null) return `The top gate of ${tree} was removed.`;
  const before = adaptedTree(saved, modelId);
  if (before === null) return null;
  const after = adaptedTree(current, modelId);
  if (after === null) return `${sentence(tree)} is no longer a valid fault tree.`;
  return structureChange(tree, before, after, saved, current) ?? valueChange(before, after, saved, current);
}

function modelChange(indexed: IndexedSource, modelId: string): string | null {
  const { source } = indexed;
  if (source.savedSy !== null && source.currentSy !== null && source.savedSy.systemLogicModels.some((model) => model.uuid === modelId)) {
    return faultTreeChange(source.savedSy, source.currentSy, modelId);
  }
  if (indexed.current === null) return null;
  const before = indexed.saved.get(modelId);
  if (before === undefined) return null;
  const after = indexed.current.get(modelId);
  return recordChange(`${source.hostType} ${kindOf(before.collection) ?? "model"}`, before.record, after?.record, modelId);
}

function entityChange(indexed: IndexedSource, entity: WorkbookCrossReference): string | null {
  const current = indexed.current;
  if (current === null) return null;
  const before = "modelId" in entity ? within(indexed.saved.get(entity.modelId), entity.entityId) : indexed.saved.get(entity.entityId);
  if (before === undefined) return null;
  const after = "modelId" in entity ? within(current.get(entity.modelId), entity.entityId) : current.get(entity.entityId);
  const kind = `${indexed.source.hostType} ${kindOf(before.collection) ?? REFERENCE_TEXT[entity.referenceType]}`;
  if (entity.referenceType === "HUMAN_FAILURE_EVENT" && after !== undefined) {
    const label = labelOf(after.record) ?? entity.entityId;
    const quantifiedBefore = findRecord(before.record, entity.quantificationId, "");
    const quantifiedAfter = findRecord(after.record, entity.quantificationId, "");
    if (quantifiedBefore !== undefined) {
      if (quantifiedAfter === undefined) return `The quantification of ${kind} ${label} was deleted.`;
      const key = changedKey(quantifiedBefore.record, quantifiedAfter.record);
      return key === undefined ? null : `The ${words(key)} of ${kind} ${label} changed.`;
    }
  }
  return recordChange(kind, before.record, after?.record, entity.entityId);
}

function listChange(kind: string, before: Json[], after: Json[]): string | null {
  const earlier = recordsById(before);
  const later = recordsById(after);
  for (const [id, record] of earlier) {
    const change = recordChange(kind, record, later.get(id), id);
    if (change !== null) return change;
  }
  for (const [id, record] of later) {
    if (!earlier.has(id)) return `${sentence(kind)} ${labelOf(record) ?? id} was added.`;
  }
  return null;
}

function workbookChange(source: ChangedSource): string | null {
  const saved = source.saved;
  const current = source.current;
  if (!isRecord(saved) || current === null || !isRecord(current)) return null;
  const keys = [...new Set([...Object.keys(saved), ...Object.keys(current)])]
    .filter((key) => !IGNORED_KEYS.has(key))
    .sort();
  for (const key of keys) {
    const before = field(saved, key);
    const after = field(current, key);
    if (canonical(before) === canonical(after)) continue;
    if (Array.isArray(before) && Array.isArray(after)) {
      const change = listChange(`${source.hostType} ${kindOf(key) ?? words(key)}`, before, after);
      if (change !== null) return change;
    }
    return `The ${words(key)} in the ${source.hostType} workbook changed.`;
  }
  return null;
}

function workbookName(mef: Json): string | undefined {
  return isRecord(mef) ? text(mef, "name") : undefined;
}

function describeRunChange(
  contributions: readonly AnalysisRunContribution[] | null,
  sources: readonly ChangedSource[],
): string | null {
  const removed = sources.find((source) => source.current === null);
  if (removed !== undefined) {
    const name = workbookName(removed.saved);
    return name === undefined ? `The ${removed.hostType} workbook was deleted.` : `The ${removed.hostType} workbook ${name} was deleted.`;
  }
  if (contributions === null) {
    for (const source of sources) {
      const change = workbookChange(source);
      if (change !== null) return change;
    }
    return null;
  }
  const bySource = new Map(sources.map((source) => [source.workbookId, source]));
  for (const contribution of contributions) {
    const source = bySource.get(contribution.workbook.workbookId);
    if (source === undefined) continue;
    const indexed: IndexedSource = {
      source,
      saved: indexRecords(source.saved),
      current: source.current === null ? null : indexRecords(source.current),
    };
    for (const model of contribution.models) {
      const change = modelChange(indexed, model.modelId);
      if (change !== null) return change;
    }
    for (const entity of contribution.entities) {
      const change = entityChange(indexed, entity);
      if (change !== null) return change;
    }
  }
  return null;
}

export { describeRunChange, jsonOf };
export type { ChangedSource };
