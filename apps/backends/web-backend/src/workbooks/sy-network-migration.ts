import { esqStableId, sameItem } from "interfaces-mef-types/esq/esq-run-inputs";
import { CONFIGURATIONS, NETWORKS, holdsNetworks, modelIds, records, texts } from "./es-network-migration";
import { arrayField, field, isRecord, jsonTextOf, rawText, recordField, textField, withArray, withRecord, without, type Json, type JsonRecord } from "./uncertainty-migration-json";

interface EsqPlacement {
  workbookId: string;
  projectId: string;
  sySource?: string;
}

interface NetworkConversion {
  mef: JsonRecord;
  notes: string[];
}

const NETWORK_SIDE: readonly string[] = ["bayesianNetwork", "bayesianNetworkNode"];

function realWorkbook(id: string | undefined): string | undefined {
  return id === undefined || id.startsWith("example") ? undefined : id;
}

function sySourceOf(esq: JsonRecord): string | undefined {
  const links = recordField(esq, "linkedWorkbooks");
  const linked = realWorkbook(links === undefined ? undefined : textField(links, "SY"));
  if (linked !== undefined) return linked;
  const model = recordField(esq, "model");
  const imported = records(model === undefined ? undefined : arrayField(model, "sources")).find((source) => field(source, "element") === "SY");
  return realWorkbook(imported === undefined ? undefined : textField(imported, "workbookId"));
}

function esqTargets(syId: string, projectId: string, placements: readonly EsqPlacement[]): string[] {
  const linked = placements.filter((placement) => placement.sySource === syId);
  const chosen = linked.length > 0 ? linked : placements.filter((placement) => placement.projectId === projectId);
  return chosen.map((placement) => placement.workbookId);
}

function networkSideMoved(value: Json, syId: string, esqId: string): Json {
  if (Array.isArray(value)) return value.map((item) => networkSideMoved(item, syId, esqId));
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const moved = networkSideMoved(item, syId, esqId);
    return [key, NETWORK_SIDE.includes(key) && isRecord(moved) && field(moved, "workbookId") === syId ? { ...moved, workbookId: esqId } : moved] as const;
  }));
}

function movedConfiguration(configuration: JsonRecord, syId: string, esqId: string): JsonRecord {
  const moved = networkSideMoved(configuration, syId, esqId);
  return isRecord(moved) ? moved : configuration;
}

function replacedByModel(held: readonly JsonRecord[], incoming: readonly JsonRecord[]): JsonRecord[] {
  const replaced = modelIds(incoming);
  return [...held.filter((entry) => !replaced.has(textField(entry, "modelId") ?? "")), ...incoming];
}

function receiveSyNetworks(esq: JsonRecord, esqId: string, sy: JsonRecord, syId: string): JsonRecord {
  const configurations = records(arrayField(sy, CONFIGURATIONS)).map((configuration) => movedConfiguration(configuration, syId, esqId));
  const received = {
    bayesianNetworks: replacedByModel(records(arrayField(esq, "bayesianNetworks")), records(arrayField(sy, NETWORKS))),
    hclConfigurations: replacedByModel(records(arrayField(esq, "hclConfigurations")), configurations),
  };
  const held = { bayesianNetworks: field(esq, "bayesianNetworks") ?? null, hclConfigurations: field(esq, "hclConfigurations") ?? null };
  return jsonTextOf(received) === jsonTextOf(held) ? esq : { ...esq, ...received };
}

function heldSyNetworks(live: JsonRecord, prior: JsonRecord | undefined): JsonRecord | undefined {
  if (!holdsNetworks(live) && (prior === undefined || !holdsNetworks(prior))) return undefined;
  const merged = (key: string): JsonRecord[] => replacedByModel(records(prior === undefined ? undefined : arrayField(prior, key)), records(arrayField(live, key)));
  return { [NETWORKS]: merged(NETWORKS), [CONFIGURATIONS]: merged(CONFIGURATIONS) };
}

function withoutNetworks(holder: JsonRecord): JsonRecord {
  return holdsNetworks(holder) ? without(holder, [NETWORKS, CONFIGURATIONS]) : holder;
}

function nodeLinkKey(treeId: string, modelId: string, nodeId: string): string {
  return JSON.stringify([treeId, modelId, nodeId]);
}

function withoutTreeNetworkNodes(tree: JsonRecord, dropped?: (tree: JsonRecord, event: JsonRecord) => void): JsonRecord {
  return withRecord(tree, "functionalEvents", (events) => {
    let changed = false;
    const kept = Object.fromEntries(Object.entries(events).map(([key, event]) => {
      if (!isRecord(event) || field(event, "networkNode") === undefined) return [key, event] as const;
      changed = true;
      dropped?.(tree, event);
      return [key, without(event, ["networkNode"])] as const;
    }));
    return changed ? kept : events;
  });
}

function withoutNetworkNodes(mef: JsonRecord): JsonRecord {
  const drawn = withArray(mef, "eventTrees", (tree) => withoutTreeNetworkNodes(tree));
  return withRecord(drawn, "modelDecisions", (decisions) => withArray(decisions, "typedTrees", (tree) => withoutTreeNetworkNodes(tree)));
}

function ruleMatches(rule: JsonRecord, tree: JsonRecord): boolean {
  const treeIds = texts(arrayField(rule, "treeIds"));
  if (treeIds.length > 0) return treeIds.some((id) => id === field(tree, "id"));
  const groups = texts(arrayField(rule, "groupIds"));
  const states = texts(arrayField(rule, "stateIds"));
  const initiator = rawText(tree, "initiatorId") ?? "";
  const state = rawText(tree, "stateId");
  return (groups.length === 0 || groups.some((id) => sameItem(id, initiator)))
    && (states.length === 0 || (state !== undefined && states.some((id) => sameItem(id, state))));
}

function nodeRule(functionId: string, treeId: string, link: JsonRecord, esqId: string): JsonRecord | undefined {
  const node = recordField(link, "node");
  const modelId = node === undefined ? undefined : textField(node, "modelId");
  const nodeId = node === undefined ? undefined : textField(node, "nodeId");
  const trueStateIds = texts(arrayField(link, "trueStateIds")).filter((id) => id.length > 0);
  if (modelId === undefined || nodeId === undefined || trueStateIds.length === 0) return undefined;
  return {
    id: esqStableId(`node-link:${functionId}:${treeId}`),
    treeIds: [treeId],
    groupIds: [],
    stateIds: [],
    target: { kind: "NETWORK_NODE", node: { workbookId: esqId, modelId, nodeId }, trueStateIds },
    reason: "",
  };
}

function nodeRules(record: JsonRecord, functionId: string, link: JsonRecord | undefined, trees: readonly JsonRecord[], esqId: string, notes: string[]): JsonRecord[] {
  const rules = link === undefined ? [] : records(arrayField(link, "rules"));
  const defaulted = link !== undefined && isRecord(field(link, "target"));
  const esLinks = records(arrayField(record, "esLinks"));
  const seen = new Set<string>();
  const added: JsonRecord[] = [];
  for (const nodeLink of records(arrayField(record, "nodeLinks"))) {
    const treeId = rawText(nodeLink, "treeId");
    const tree = treeId === undefined ? undefined : trees.find((candidate) => field(candidate, "id") === treeId);
    if (treeId === undefined || tree === undefined || seen.has(treeId)) continue;
    seen.add(treeId);
    if (defaulted || rules.some((rule) => ruleMatches(rule, tree)) || esLinks.some((entry) => field(entry, "treeId") === treeId)) continue;
    const rule = nodeRule(functionId, treeId, nodeLink, esqId);
    if (rule === undefined) notes.push(`Function ${textField(record, "name") ?? functionId} had a network node link with no node or no failing state in event tree ${textField(tree, "code") ?? treeId}. It was dropped.`);
    else added.push(rule);
  }
  return added;
}

function withNodeRules(esq: JsonRecord, esqId: string, notes: string[]): JsonRecord {
  const model = recordField(esq, "model");
  const functions = model === undefined ? undefined : arrayField(model, "functions");
  if (model === undefined || functions === undefined || !functions.some((record) => isRecord(record) && field(record, "nodeLinks") !== undefined)) return esq;
  const trees = records(arrayField(model, "trees"));
  const decisions = recordField(esq, "modelDecisions") ?? {};
  const links = arrayField(decisions, "functionLinks") ?? [];
  const added = new Map<string, JsonRecord[]>();
  for (const record of records(functions)) {
    const functionId = rawText(record, "id");
    if (functionId === undefined) continue;
    const link = records(links).find((candidate) => field(candidate, "functionId") === functionId);
    const rules = nodeRules(record, functionId, link, trees, esqId, notes);
    if (rules.length > 0) added.set(functionId, rules);
  }
  const cleaned = { ...esq, model: { ...model, functions: functions.map((record) => (isRecord(record) ? without(record, ["nodeLinks"]) : record)) } };
  if (added.size === 0) return cleaned;
  const linked = new Set(records(links).flatMap((link) => {
    const functionId = rawText(link, "functionId");
    return functionId === undefined ? [] : [functionId];
  }));
  const extended = links.map((link) => {
    const rules = isRecord(link) ? added.get(rawText(link, "functionId") ?? "") : undefined;
    return isRecord(link) && rules !== undefined ? { ...link, rules: [...(arrayField(link, "rules") ?? []), ...rules] } : link;
  });
  const created = [...added].filter(([functionId]) => !linked.has(functionId)).map(([functionId, rules]) => ({ functionId, rules }));
  return { ...cleaned, modelDecisions: { ...decisions, functionLinks: [...extended, ...created] } };
}

function withOwnRunConfiguration(esq: JsonRecord, esqId: string): JsonRecord {
  const held = modelIds(records(arrayField(esq, "hclConfigurations")));
  return withRecord(esq, "solve", (solve) => withRecord(solve, "run", (run) => withRecord(run, "hcl", (hcl) => {
    const modelId = textField(hcl, "modelId");
    return field(hcl, "workbookId") === esqId || modelId === undefined || !held.has(modelId) ? hcl : { ...hcl, workbookId: esqId };
  })));
}

function convertEsqNetworkLinks(esq: JsonRecord, esqId: string): NetworkConversion {
  const notes: string[] = [];
  return { mef: withOwnRunConfiguration(withoutNetworkNodes(withNodeRules(esq, esqId, notes)), esqId), notes };
}

function carriedNodeLinks(esq: JsonRecord): string[] {
  const model = recordField(esq, "model");
  const decisions = recordField(esq, "modelDecisions");
  const imported = records(model === undefined ? undefined : arrayField(model, "functions")).flatMap((record) => records(arrayField(record, "nodeLinks")).flatMap((link) => {
    const node = recordField(link, "node");
    const treeId = rawText(link, "treeId");
    const modelId = node === undefined ? undefined : textField(node, "modelId");
    const nodeId = node === undefined ? undefined : textField(node, "nodeId");
    return treeId === undefined || modelId === undefined || nodeId === undefined ? [] : [nodeLinkKey(treeId, modelId, nodeId)];
  }));
  const ruled = records(decisions === undefined ? undefined : arrayField(decisions, "functionLinks")).flatMap((link) => records(arrayField(link, "rules")).flatMap((rule) => {
    const target = recordField(rule, "target");
    const node = target === undefined || field(target, "kind") !== "NETWORK_NODE" ? undefined : recordField(target, "node");
    const modelId = node === undefined ? undefined : textField(node, "modelId");
    const nodeId = node === undefined ? undefined : textField(node, "nodeId");
    return modelId === undefined || nodeId === undefined ? [] : texts(arrayField(rule, "treeIds")).map((treeId) => nodeLinkKey(treeId, modelId, nodeId));
  }));
  return [...imported, ...ruled];
}

function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function stripEsNetworks(es: JsonRecord, carried: ReadonlySet<string>): NetworkConversion {
  const notes: string[] = [];
  const stripped = withArray(es, "eventTrees", (tree) => withoutTreeNetworkNodes(tree, (owner, event) => {
    const node = recordField(recordField(event, "networkNode") ?? {}, "bayesianNetworkNode");
    const treeId = rawText(owner, "uuid");
    const modelId = node === undefined ? undefined : textField(node, "modelId");
    const nodeId = node === undefined ? undefined : textField(node, "entityId");
    if (treeId !== undefined && modelId !== undefined && nodeId !== undefined && carried.has(nodeLinkKey(treeId, modelId, nodeId))) return;
    notes.push(`Functional event ${textField(event, "label") ?? textField(event, "name") ?? textField(event, "uuid") ?? "?"} in event tree ${textField(owner, "label") ?? textField(owner, "name") ?? treeId ?? "?"} lost its network node link. No ESQ workbook had imported it.`);
  }));
  if (!holdsNetworks(stripped)) return { mef: stripped, notes };
  notes.push(`Its ${counted(records(arrayField(stripped, NETWORKS)).length, "dependency network")} and ${counted(records(arrayField(stripped, CONFIGURATIONS)).length, "dependency configuration")} reached no ESQ workbook and were removed. The backup keeps them.`);
  return { mef: withoutNetworks(stripped), notes };
}

export {
  carriedNodeLinks,
  convertEsqNetworkLinks,
  esqTargets,
  heldSyNetworks,
  nodeLinkKey,
  receiveSyNetworks,
  stripEsNetworks,
  sySourceOf,
  withoutNetworks,
  withoutNetworkNodes,
};
export type { EsqPlacement, NetworkConversion };
