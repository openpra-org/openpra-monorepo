import type {
  FaultTreeBasicEvent,
  FaultTreeDefinition,
  FaultTreeGate,
  FaultTreeGateInput,
  FaultTreeLeafNode,
} from "../modeling/fault-tree";
import type { SystemBasicEvent, SystemLogicModel, SystemsAnalysis } from "./systems-analysis";

type UnknownRecord = Record<string, unknown>;

const AUTOMATIC_FAULT_TREE_LAYOUT = {
  viewport: { x: 0, y: 0, zoom: 1 },
  mode: "AUTOMATIC" as const,
  direction: "TOP_TO_BOTTOM" as const,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function deterministicWorkbookLocalId(seed: string): string {
  const words = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35].map((initial, wordIndex) => {
    let hash = initial ^ (wordIndex * 0x27d4eb2d);
    for (let index = 0; index < seed.length; index += 1) {
      hash = Math.imul(hash ^ seed.charCodeAt(index), 0x01000193);
      hash ^= hash >>> 13;
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    return (hash ^ (hash >>> 16)) >>> 0;
  });
  const characters = words.map((word) => word.toString(16).padStart(8, "0")).join("").split("");
  characters[12] = "5";
  characters[16] = (((Number.parseInt(characters[16], 16) & 0x3) | 0x8)).toString(16);
  const hex = characters.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function canonicalWorkbookLocalId(scope: string, value: string): string {
  return UUID_PATTERN.test(value) ? value : deterministicWorkbookLocalId(`${scope}:${value}`);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function finiteProbability(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function visitLegacyFaultTreeBasicEvents(value: unknown, visit: (node: UnknownRecord) => void): void {
  if (!isRecord(value)) return;
  if (value.type === "BE") {
    visit(value);
    return;
  }
  if (!Array.isArray(value.children)) return;
  value.children.forEach((child) => visitLegacyFaultTreeBasicEvents(child, visit));
}

function migrateBasicEventFromLeaf(node: UnknownRecord): SystemBasicEvent | undefined {
  const uuid = nonEmptyString(node.basicEventId) ?? nonEmptyString(node.be);
  const name = nonEmptyString(node.name);
  if (uuid === undefined || name === undefined) return undefined;

  const probability = finiteProbability(node.prob);
  const failureMode = nonEmptyString(node.mode);
  const dataAnalysisBasicEventRef = nonEmptyString(node.source);
  return {
    uuid,
    code: uuid,
    name,
    eventType: "BASIC",
    ...(failureMode === undefined ? {} : { failureMode }),
    ...(probability === undefined ? {} : { probability }),
    ...(dataAnalysisBasicEventRef === undefined ? {} : { dataAnalysisBasicEventRef }),
    repairModeled: false,
    implementsSrs: [],
  };
}

function migrateBasicEventCode(event: UnknownRecord): UnknownRecord {
  const uuid = nonEmptyString(event.uuid);
  return event.code === undefined && uuid !== undefined ? { ...event, code: uuid } : event;
}

function mergeLegacyBasicEvents(rootEvents: unknown[], models: UnknownRecord[]): unknown[] {
  const localById = new Map<string, UnknownRecord>();
  models.forEach((model) => {
    if (!Array.isArray(model.basicEvents)) return;
    model.basicEvents.forEach((event) => {
      if (!isRecord(event)) return;
      const uuid = nonEmptyString(event.uuid);
      if (uuid !== undefined) localById.set(uuid, migrateBasicEventCode(event));
    });
  });

  const merged = rootEvents.map((event) => {
    if (!isRecord(event)) return event;
    const uuid = nonEmptyString(event.uuid);
    return uuid === undefined
      ? event
      : (localById.get(uuid) ?? migrateBasicEventCode(event));
  });
  const rootIds = new Set(
    rootEvents.flatMap((event) =>
      isRecord(event) && nonEmptyString(event.uuid) !== undefined ? [event.uuid as string] : [],
    ),
  );
  localById.forEach((event, uuid) => {
    if (!rootIds.has(uuid)) merged.push(event);
  });

  const eventIndex = new Map<string, number>();
  merged.forEach((event, index) => {
    if (!isRecord(event)) return;
    const uuid = nonEmptyString(event.uuid);
    if (uuid !== undefined && !eventIndex.has(uuid)) eventIndex.set(uuid, index);
  });

  models.forEach((model) => {
    visitLegacyFaultTreeBasicEvents(model.faultTree, (leaf) => {
      const uuid = nonEmptyString(leaf.basicEventId) ?? nonEmptyString(leaf.be);
      if (uuid === undefined) return;
      const existingIndex = eventIndex.get(uuid);
      if (existingIndex === undefined) {
        const migrated = migrateBasicEventFromLeaf(leaf);
        if (migrated !== undefined) {
          eventIndex.set(uuid, merged.length);
          merged.push(migrated);
        }
        return;
      }

      const existing = merged[existingIndex];
      const source = nonEmptyString(leaf.source);
      if (!isRecord(existing) || source === undefined || existing.dataAnalysisBasicEventRef !== undefined) return;
      merged[existingIndex] = { ...existing, dataAnalysisBasicEventRef: source };
    });
  });

  return merged;
}

interface LegacyTransferTarget {
  modelId: string;
  topGateId: string;
}

function legacyTopGateId(model: UnknownRecord): string | undefined {
  if (isRecord(model.topGate)) return nonEmptyString(model.topGate.gateId);
  if (!isRecord(model.faultTree)) return undefined;
  const type = model.faultTree.type;
  return type === "OR" || type === "AND" || type === "KN"
    ? nonEmptyString(model.faultTree.id)
    : undefined;
}

function transferTargetsBySystem(models: UnknownRecord[]): Map<string, LegacyTransferTarget[]> {
  const targets = new Map<string, LegacyTransferTarget[]>();
  models.forEach((model) => {
    const systemReference = nonEmptyString(model.systemReference);
    const modelId = nonEmptyString(model.uuid);
    const topGateId = legacyTopGateId(model);
    if (systemReference === undefined || modelId === undefined || topGateId === undefined) return;
    const matches = targets.get(systemReference) ?? [];
    matches.push({ modelId, topGateId });
    targets.set(systemReference, matches);
  });
  return targets;
}

function unresolvedTransferTarget(legacyTarget: string): LegacyTransferTarget {
  const deterministicId = `unresolved:${legacyTarget}`;
  return { modelId: deterministicId, topGateId: deterministicId };
}

function flattenLegacyFaultTree(
  root: unknown,
  transferTargets: Map<string, LegacyTransferTarget[]>,
): FaultTreeDefinition | undefined {
  if (!isRecord(root)) return undefined;

  const gates: FaultTreeGate[] = [];
  const leafNodes: FaultTreeLeafNode[] = [];
  const gateInputs: FaultTreeGateInput[] = [];

  function visit(node: unknown): string | undefined {
    if (!isRecord(node)) return undefined;
    const id = nonEmptyString(node.id);
    if (id === undefined) return undefined;

    if (node.type === "BE") {
      const basicEventId = nonEmptyString(node.basicEventId) ?? nonEmptyString(node.be);
      if (basicEventId === undefined) return undefined;
      leafNodes.push({ id, kind: "BASIC_EVENT_REFERENCE", basicEventId });
      return id;
    }

    if (node.type === "TR") {
      const name = nonEmptyString(node.name);
      const legacyTarget = nonEmptyString(node.transfer);
      if (name === undefined || legacyTarget === undefined) return undefined;
      const matches = transferTargets.get(legacyTarget) ?? [];
      const resolved = matches.length === 1 ? matches[0] : undefined;
      const target = resolved ?? unresolvedTransferTarget(legacyTarget);
      leafNodes.push({
        id,
        code: id,
        name,
        description: `Transfer to ${legacyTarget}`,
        kind: "TRANSFER_REFERENCE",
        target: { modelId: target.modelId, entityId: target.topGateId },
      });
      return id;
    }

    if (node.type !== "OR" && node.type !== "AND" && node.type !== "KN") return undefined;
    const name = nonEmptyString(node.name);
    if (name === undefined || !Array.isArray(node.children)) return undefined;
    if (node.type === "KN") {
      const k = typeof node.k === "number" && Number.isInteger(node.k) && node.k > 0 ? node.k : 1;
      gates.push({ id, code: id, name, description: name, kind: "GATE", gateType: "K_OF_N", k });
    } else {
      gates.push({ id, code: id, name, description: name, kind: "GATE", gateType: node.type });
    }

    for (const [order, child] of node.children.entries()) {
      const childId = visit(child);
      if (childId === undefined) return undefined;
      gateInputs.push({
        id: `${id}:${childId}:${order}`,
        gateId: id,
        childId,
        order,
      });
    }
    return id;
  }

  const rootId = visit(root);
  if (rootId === undefined) return undefined;
  const rootIsGate = gates.some((gate) => gate.id === rootId);
  return {
    topGate: rootIsGate ? { gateId: rootId } : null,
    gates,
    leafNodes,
    gateInputs,
    nodePositions: [],
    layout: {
      ...AUTOMATIC_FAULT_TREE_LAYOUT,
      viewport: { ...AUTOMATIC_FAULT_TREE_LAYOUT.viewport },
    },
  };
}

function hasNormalizedFaultTree(model: UnknownRecord): boolean {
  return (
    model.topGate !== undefined &&
    model.gates !== undefined &&
    model.leafNodes !== undefined &&
    model.gateInputs !== undefined &&
    model.nodePositions !== undefined &&
    model.layout !== undefined
  );
}

function emptyFaultTreeDefinition(): FaultTreeDefinition {
  return {
    topGate: null,
    gates: [],
    leafNodes: [],
    gateInputs: [],
    nodePositions: [],
    layout: {
      ...AUTOMATIC_FAULT_TREE_LAYOUT,
      viewport: { ...AUTOMATIC_FAULT_TREE_LAYOUT.viewport },
    },
  };
}

function normalizeSystemLogicModelWithTargets(
  model: UnknownRecord,
  transferTargets: Map<string, LegacyTransferTarget[]>,
): unknown {
  const hasMalformedLocalCatalogue = model.basicEvents !== undefined && !Array.isArray(model.basicEvents);
  const canonicalModel = hasMalformedLocalCatalogue
    ? { ...model }
    : (({ basicEvents: _legacyBasicEvents, ...rest }) => rest)(model);

  const root = isRecord(model.faultTree) ? model.faultTree : undefined;
  const definition = hasNormalizedFaultTree(model)
    ? null
    : model.faultTree === undefined
      ? emptyFaultTreeDefinition()
      : flattenLegacyFaultTree(model.faultTree, transferTargets);
  if (!hasNormalizedFaultTree(model) && definition === undefined) return canonicalModel;

  const { faultTree: _legacyFaultTree, ...withoutLegacyTree } = canonicalModel;
  const rootId = root === undefined ? undefined : nonEmptyString(root.id);
  const rootName = root === undefined ? undefined : nonEmptyString(root.name);
  const code = nonEmptyString(model.code) ?? rootId ?? nonEmptyString(model.uuid) ?? nonEmptyString(model.systemReference);
  const name = nonEmptyString(model.name) ?? rootName ?? nonEmptyString(model.description) ?? code;

  return {
    ...withoutLegacyTree,
    ...(code === undefined ? {} : { code }),
    ...(name === undefined ? {} : { name }),
    ...(definition ?? {}),
  };
}

function canonicalizeNormalizedFaultTreeIds(value: UnknownRecord): UnknownRecord {
  if (!Array.isArray(value.systemLogicModels) || !Array.isArray(value.systemBasicEvents)) return value;

  const basicEventIds = new Map<string, string>();
  const systemBasicEvents = value.systemBasicEvents.map((event) => {
    if (!isRecord(event)) return event;
    const id = nonEmptyString(event.uuid);
    if (id === undefined) return event;
    const canonicalId = canonicalWorkbookLocalId("sy-basic-event", id);
    basicEventIds.set(id, canonicalId);
    return canonicalId === id ? event : { ...event, uuid: canonicalId };
  });

  const modelIds = new Map<string, string>();
  const nodeIdsByModel = new Map<string, Map<string, string>>();
  value.systemLogicModels.forEach((model) => {
    if (!isRecord(model)) return;
    const modelId = nonEmptyString(model.uuid);
    if (modelId === undefined) return;
    modelIds.set(modelId, canonicalWorkbookLocalId("sy-fault-tree-model", modelId));
    const nodeIds = new Map<string, string>();
    const registerNode = (node: unknown): void => {
      if (!isRecord(node)) return;
      const nodeId = nonEmptyString(node.id);
      if (nodeId !== undefined) {
        nodeIds.set(nodeId, canonicalWorkbookLocalId(`sy-fault-tree-node:${modelId}`, nodeId));
      }
    };
    if (Array.isArray(model.gates)) model.gates.forEach(registerNode);
    if (Array.isArray(model.leafNodes)) model.leafNodes.forEach(registerNode);
    nodeIdsByModel.set(modelId, nodeIds);
  });

  const systemLogicModels = value.systemLogicModels.map((model) => {
    if (!isRecord(model)) return model;
    const originalModelId = nonEmptyString(model.uuid);
    if (originalModelId === undefined) return model;
    const modelId = modelIds.get(originalModelId) ?? originalModelId;
    const nodeIds = nodeIdsByModel.get(originalModelId) ?? new Map<string, string>();
    const nodeId = (candidate: unknown): unknown =>
      typeof candidate === "string" ? (nodeIds.get(candidate) ?? candidate) : candidate;
    const canonicalizeIdentity = (entity: unknown): unknown => {
      if (!isRecord(entity)) return entity;
      const id = nonEmptyString(entity.id);
      return id === undefined ? entity : { ...entity, id: nodeIds.get(id) ?? id };
    };

    const gates = Array.isArray(model.gates) ? model.gates.map(canonicalizeIdentity) : model.gates;
    const leafNodes = Array.isArray(model.leafNodes)
      ? model.leafNodes.map((leaf) => {
          if (!isRecord(leaf)) return leaf;
          const canonicalLeaf = canonicalizeIdentity(leaf);
          if (!isRecord(canonicalLeaf)) return canonicalLeaf;
          if (canonicalLeaf.kind === "BASIC_EVENT_REFERENCE") {
            const referencedId = nonEmptyString(canonicalLeaf.basicEventId);
            return referencedId === undefined
              ? canonicalLeaf
              : { ...canonicalLeaf, basicEventId: basicEventIds.get(referencedId) ?? referencedId };
          }
          if (canonicalLeaf.kind !== "TRANSFER_REFERENCE" || !isRecord(canonicalLeaf.target)) {
            return canonicalLeaf;
          }
          const targetModelId = nonEmptyString(canonicalLeaf.target.modelId);
          const targetEntityId = nonEmptyString(canonicalLeaf.target.entityId);
          if (targetModelId === undefined || targetEntityId === undefined) return canonicalLeaf;
          const canonicalTargetModelId = modelIds.get(targetModelId)
            ?? canonicalWorkbookLocalId("sy-fault-tree-model", targetModelId);
          const canonicalTargetEntityId = nodeIdsByModel.get(targetModelId)?.get(targetEntityId)
            ?? canonicalWorkbookLocalId(`sy-fault-tree-node:${targetModelId}`, targetEntityId);
          return {
            ...canonicalLeaf,
            target: { modelId: canonicalTargetModelId, entityId: canonicalTargetEntityId },
          };
        })
      : model.leafNodes;
    const gateInputs = Array.isArray(model.gateInputs)
      ? model.gateInputs.map((input) => {
          if (!isRecord(input)) return input;
          const inputId = nonEmptyString(input.id);
          return {
            ...input,
            ...(inputId === undefined
              ? {}
              : { id: canonicalWorkbookLocalId(`sy-fault-tree-input:${originalModelId}`, inputId) }),
            gateId: nodeId(input.gateId),
            childId: nodeId(input.childId),
          };
        })
      : model.gateInputs;
    const nodePositions = Array.isArray(model.nodePositions)
      ? model.nodePositions.map((position) =>
          isRecord(position) ? { ...position, nodeId: nodeId(position.nodeId) } : position,
        )
      : model.nodePositions;
    const topGate = isRecord(model.topGate)
      ? { ...model.topGate, gateId: nodeId(model.topGate.gateId) }
      : model.topGate;

    return {
      ...model,
      uuid: modelId,
      topGate,
      gates,
      leafNodes,
      gateInputs,
      nodePositions,
    };
  });

  const commonCauseFailureGroups = Array.isArray(value.commonCauseFailureGroups)
    ? value.commonCauseFailureGroups.map((group) => {
        if (!isRecord(group) || !isRecord(group.members) || !Array.isArray(group.members.basicEvents)) {
          return group;
        }
        return {
          ...group,
          members: {
            ...group.members,
            basicEvents: group.members.basicEvents.map((event) => {
              if (!isRecord(event)) return event;
              const id = nonEmptyString(event.id);
              return id === undefined ? event : { ...event, id: basicEventIds.get(id) ?? id };
            }),
          },
        };
      })
    : value.commonCauseFailureGroups;

  return {
    ...value,
    systemLogicModels,
    systemBasicEvents,
    ...(commonCauseFailureGroups === undefined ? {} : { commonCauseFailureGroups }),
  };
}

/**
 * Normalizes a standalone SY logic model. Legacy transfers cannot be resolved
 * without the workbook's complete model collection, so their original system
 * reference is retained in a deterministic unresolved target.
 */
function normalizeSystemLogicModel(value: unknown): unknown {
  return isRecord(value) ? normalizeSystemLogicModelWithTargets(value, new Map()) : value;
}

function normalizeSystemsAnalysisModels(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.systemLogicModels)) return value;
  if (value.systemBasicEvents !== undefined && !Array.isArray(value.systemBasicEvents)) return value;
  const models = value.systemLogicModels.map((model) => (isRecord(model) ? model : {}));
  const rootEvents = value.systemBasicEvents ?? [];
  const systemBasicEvents = mergeLegacyBasicEvents(rootEvents, models);
  const transferTargets = transferTargetsBySystem(models);
  const systemLogicModels = value.systemLogicModels.map((model) =>
    isRecord(model) ? normalizeSystemLogicModelWithTargets(model, transferTargets) : model,
  );

  return canonicalizeNormalizedFaultTreeIds({
    ...value,
    systemLogicModels,
    systemBasicEvents,
  });
}

function systemFaultTreeBasicEventIds(
  model: Pick<SystemLogicModel, "leafNodes"> | undefined,
): string[] {
  if (model === undefined) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  model.leafNodes.forEach((leaf) => {
    if (leaf.kind !== "BASIC_EVENT_REFERENCE" || seen.has(leaf.basicEventId)) return;
    seen.add(leaf.basicEventId);
    ids.push(leaf.basicEventId);
  });
  return ids;
}

function systemLogicModelBasicEvents(
  analysis: Pick<SystemsAnalysis, "systemBasicEvents">,
  model: Pick<SystemLogicModel, "leafNodes">,
): SystemBasicEvent[] {
  const catalogue = new Map(analysis.systemBasicEvents.map((event) => [event.uuid, event]));
  return systemFaultTreeBasicEventIds(model).flatMap((id) => {
    const event = catalogue.get(id);
    return event === undefined ? [] : [event];
  });
}

/**
 * Projects the sole persisted SY catalogue entry into the reusable FT contract.
 * A missing draft probability is represented as NaN in memory so validation can
 * reject analysis without inventing and persisting a zero-probability value.
 */
function systemBasicEventToFaultTreeBasicEvent(event: SystemBasicEvent): FaultTreeBasicEvent {
  return {
    id: event.uuid,
    code: event.code,
    name: event.name,
    description: event.description ?? "",
    probability: {
      value: event.probability ?? Number.NaN,
      ...(event.quantificationBasis === undefined
        ? {}
        : { quantificationBasis: structuredClone(event.quantificationBasis) }),
      ...(event.controlledDataSource === undefined
        ? {}
        : { controlledDataSource: { ...event.controlledDataSource } }),
    },
  };
}

/** Applies reusable FT fields back onto the same SY catalogue record. */
function applyFaultTreeBasicEventToSystemBasicEvent(
  current: SystemBasicEvent,
  event: FaultTreeBasicEvent,
): SystemBasicEvent {
  if (event.id !== current.uuid) {
    throw new Error("A fault-tree basic-event edit cannot change its SY catalogue id");
  }
  const probability = Number.isFinite(event.probability.value) ? event.probability.value : undefined;
  return {
    ...current,
    code: event.code,
    name: event.name,
    ...(event.description.length === 0 && current.description === undefined
      ? {}
      : { description: event.description }),
    ...(probability === undefined ? { probability: undefined } : { probability }),
    ...(event.probability.quantificationBasis === undefined
      ? { quantificationBasis: undefined }
      : { quantificationBasis: structuredClone(event.probability.quantificationBasis) }),
    ...(event.probability.controlledDataSource === undefined
      ? { controlledDataSource: undefined }
      : { controlledDataSource: { ...event.probability.controlledDataSource } }),
  };
}

export {
  applyFaultTreeBasicEventToSystemBasicEvent,
  normalizeSystemLogicModel,
  normalizeSystemsAnalysisModels,
  systemBasicEventToFaultTreeBasicEvent,
  systemFaultTreeBasicEventIds,
  systemLogicModelBasicEvents,
};
