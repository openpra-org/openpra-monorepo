import { functionalEventBindingId } from "interfaces-mef-types/es/es-dependency-bindings";
import { arrayField, field, isRecord, present, recordField, textField, without, type Json, type JsonRecord } from "./uncertainty-migration-json";

interface EsNetworkMove {
  es: JsonRecord;
  sy: JsonRecord;
  notes: string[];
}

interface NodeBinding {
  configuration: JsonRecord;
  binding: JsonRecord;
}

const NETWORKS = "dependencyBayesianNetworks";

const CONFIGURATIONS = "dependencyHclConfigurations";

function records(values: Json[] | undefined): JsonRecord[] {
  return (values ?? []).flatMap((value) => (isRecord(value) ? [value] : []));
}

function texts(values: Json[] | undefined): string[] {
  return (values ?? []).flatMap((value) => (typeof value === "string" ? [value] : []));
}

function heldBy(value: Json | undefined, workbookId: string): boolean {
  return isRecord(value) && field(value, "workbookId") === workbookId;
}

function repointed(value: Json, from: string, to: string): Json {
  if (Array.isArray(value)) return value.map((item) => repointed(item, from, to));
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === "workbookId" && item === from ? to : repointed(item, from, to)] as const));
}

function repointedRecord(value: JsonRecord, from: string, to: string): JsonRecord {
  const moved = repointed(value, from, to);
  return isRecord(moved) ? moved : value;
}

function modelIds(values: readonly JsonRecord[]): Set<string> {
  return new Set(values.flatMap((value) => {
    const id = textField(value, "modelId");
    return id === undefined ? [] : [id];
  }));
}

function holdsNetworks(es: JsonRecord): boolean {
  return records(arrayField(es, NETWORKS)).length > 0 || records(arrayField(es, CONFIGURATIONS)).length > 0;
}

function inScope(configuration: JsonRecord, tree: JsonRecord): boolean {
  const scope = recordField(configuration, "eventTreeScope");
  if (scope === undefined) return true;
  const initiators = texts(arrayField(scope, "initiatingEventIds"));
  const states = texts(arrayField(scope, "plantOperatingStateIds"));
  const initiator = textField(tree, "initiatingEventId");
  const state = textField(tree, "plantOperatingStateId");
  return (initiators.length === 0 || (initiator !== undefined && initiators.includes(initiator)))
    && (states.length === 0 || (state !== undefined && states.includes(state)));
}

function movedConfiguration(configuration: JsonRecord, esId: string, syId: string): JsonRecord {
  const solverSettings = recordField(configuration, "solverSettings");
  const uncertainty = solverSettings === undefined ? undefined : recordField(solverSettings, "uncertainty");
  const basicEvents = uncertainty === undefined ? undefined : arrayField(uncertainty, "basicEvents");
  const settings = solverSettings === undefined || uncertainty === undefined || basicEvents === undefined
    ? solverSettings
    : { ...solverSettings, uncertainty: { ...uncertainty, basicEvents: records(basicEvents).filter((entry) => !heldBy(field(entry, "faultTreeBasicEvent"), esId)) } };
  const kept: JsonRecord = {
    ...without(configuration, ["eventTreeScope"]),
    faultTrees: records(arrayField(configuration, "faultTrees")).filter((reference) => !heldBy(reference, esId)),
    bindings: records(arrayField(configuration, "bindings")).filter((binding) => !heldBy(field(binding, "faultTreeBasicEvent"), esId)),
    ...(settings === undefined ? {} : { solverSettings: settings }),
  };
  return repointedRecord(kept, esId, syId);
}

function nodeBindings(configurations: readonly JsonRecord[], esId: string): Map<string, NodeBinding[]> {
  const out = new Map<string, NodeBinding[]>();
  for (const configuration of configurations) {
    for (const binding of records(arrayField(configuration, "bindings"))) {
      const event = recordField(binding, "faultTreeBasicEvent");
      const entityId = event === undefined || !heldBy(event, esId) ? undefined : textField(event, "entityId");
      if (entityId === undefined) continue;
      out.set(entityId, [...(out.get(entityId) ?? []), { configuration, binding }]);
    }
  }
  return out;
}

function linkedEvent(key: string, value: JsonRecord, tree: JsonRecord, bindings: ReadonlyMap<string, NodeBinding[]>, esId: string, syId: string, notes: string[]): JsonRecord {
  const uuid = textField(value, "uuid") ?? key;
  const candidates = (bindings.get(functionalEventBindingId(uuid)) ?? []).filter((entry) => inScope(entry.configuration, tree));
  if (candidates.length === 0 || present(value, "networkNode")) return value;
  const name = textField(value, "label") ?? textField(value, "name") ?? uuid;
  if (present(value, "faultTreeTopEvent") || present(value, "faultTreeId")) {
    notes.push(`Functional event ${name} links to a fault tree, so its network binding was dropped.`);
    return value;
  }
  if (candidates.length > 1) notes.push(`Functional event ${name} had ${candidates.length} network bindings. It keeps the first.`);
  const chosen = candidates[0];
  const node = recordField(chosen.binding, "bayesianNetworkNode");
  const states = texts(arrayField(chosen.binding, "trueStateIds"));
  if (node === undefined || states.length === 0) {
    notes.push(`Functional event ${name} had a network binding with no node or no failing state, so it was dropped.`);
    return value;
  }
  return { ...value, networkNode: { bayesianNetworkNode: repointedRecord(node, esId, syId), trueStateIds: states } };
}

function withNodeLinks(es: JsonRecord, configurations: readonly JsonRecord[], esId: string, syId: string, notes: string[]): JsonRecord {
  const bindings = nodeBindings(configurations, esId);
  const trees = arrayField(es, "eventTrees");
  if (bindings.size === 0 || trees === undefined) return es;
  return {
    ...es,
    eventTrees: trees.map((tree) => {
      if (!isRecord(tree)) return tree;
      const functionalEvents = recordField(tree, "functionalEvents");
      if (functionalEvents === undefined) return tree;
      return {
        ...tree,
        functionalEvents: Object.fromEntries(Object.entries(functionalEvents).map(([key, value]) => [key, isRecord(value) ? linkedEvent(key, value, tree, bindings, esId, syId, notes) : value] as const)),
      };
    }),
  };
}

function moveEsNetworks(es: JsonRecord, esId: string, sy: JsonRecord, syId: string): EsNetworkMove {
  const notes: string[] = [];
  const networks = records(arrayField(es, NETWORKS));
  const configurations = records(arrayField(es, CONFIGURATIONS));
  const syNetworks = records(arrayField(sy, NETWORKS));
  const syConfigurations = records(arrayField(sy, CONFIGURATIONS));
  const heldNetworks = modelIds(syNetworks);
  const heldConfigurations = modelIds(syConfigurations);
  const addedNetworks = networks.filter((network) => !heldNetworks.has(textField(network, "modelId") ?? "")).map((network) => repointedRecord(network, esId, syId));
  const addedConfigurations = configurations.filter((configuration) => !heldConfigurations.has(textField(configuration, "modelId") ?? "")).map((configuration) => movedConfiguration(configuration, esId, syId));
  return {
    es: without(withNodeLinks(es, configurations, esId, syId, notes), [NETWORKS, CONFIGURATIONS]),
    sy: { ...sy, [NETWORKS]: [...syNetworks, ...addedNetworks], [CONFIGURATIONS]: [...syConfigurations, ...addedConfigurations] },
    notes,
  };
}

export { holdsNetworks, moveEsNetworks };
export type { EsNetworkMove };
