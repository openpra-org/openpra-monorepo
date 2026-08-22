import type { SystemBasicEvent, SystemFaultTreeNode, SystemLogicModel, SystemsAnalysis } from "./systems-analysis";

type UnknownRecord = Record<string, unknown>;

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

function normalizeFaultTreeNode(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const id = value.id;
  const type = value.type;

  if (type === "BE") {
    return {
      id,
      type,
      basicEventId: value.basicEventId ?? value.be,
    };
  }

  if (type === "OR" || type === "AND" || type === "KN") {
    return {
      id,
      type,
      name: value.name,
      ...(value.k === undefined ? {} : { k: value.k }),
      children: Array.isArray(value.children) ? value.children.map(normalizeFaultTreeNode) : value.children,
    };
  }

  if (type === "TR") {
    return {
      id,
      type,
      name: value.name,
      transfer: value.transfer,
    };
  }

  return value;
}

function visitFaultTreeBasicEvents(value: unknown, visit: (node: UnknownRecord) => void): void {
  if (!isRecord(value)) return;
  if (value.type === "BE") {
    visit(value);
    return;
  }
  if (!Array.isArray(value.children)) return;
  value.children.forEach((child) => visitFaultTreeBasicEvents(child, visit));
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
    name,
    eventType: "BASIC",
    ...(failureMode === undefined ? {} : { failureMode }),
    ...(probability === undefined ? {} : { probability }),
    ...(dataAnalysisBasicEventRef === undefined ? {} : { dataAnalysisBasicEventRef }),
    repairModeled: false,
    implementsSrs: [],
  };
}

function mergeLegacyBasicEvents(rootEvents: unknown[], models: UnknownRecord[]): unknown[] {
  const localById = new Map<string, UnknownRecord>();
  models.forEach((model) => {
    if (!Array.isArray(model.basicEvents)) return;
    model.basicEvents.forEach((event) => {
      if (!isRecord(event)) return;
      const uuid = nonEmptyString(event.uuid);
      if (uuid !== undefined) localById.set(uuid, event);
    });
  });

  const merged = rootEvents.map((event) => {
    if (!isRecord(event)) return event;
    const uuid = nonEmptyString(event.uuid);
    return uuid === undefined ? event : (localById.get(uuid) ?? event);
  });
  const rootIds = new Set(
    rootEvents.flatMap((event) => (isRecord(event) && nonEmptyString(event.uuid) !== undefined ? [event.uuid as string] : [])),
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
    visitFaultTreeBasicEvents(model.faultTree, (leaf) => {
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

function normalizeSystemsAnalysisBasicEventCatalogue(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.systemLogicModels)) return value;
  if (value.systemBasicEvents !== undefined && !Array.isArray(value.systemBasicEvents)) return value;
  const models = value.systemLogicModels.map((model) => (isRecord(model) ? model : {}));
  const rootEvents = value.systemBasicEvents ?? [];
  const systemBasicEvents = mergeLegacyBasicEvents(rootEvents, models);
  const systemLogicModels = value.systemLogicModels.map((model) => {
    if (!isRecord(model)) return model;
    if (model.basicEvents !== undefined && !Array.isArray(model.basicEvents)) {
      return {
        ...model,
        ...(model.faultTree === undefined ? {} : { faultTree: normalizeFaultTreeNode(model.faultTree) }),
      };
    }
    const { basicEvents: _legacyBasicEvents, ...canonicalModel } = model;
    return {
      ...canonicalModel,
      ...(model.faultTree === undefined ? {} : { faultTree: normalizeFaultTreeNode(model.faultTree) }),
    };
  });

  return {
    ...value,
    systemLogicModels,
    systemBasicEvents,
  };
}

function systemFaultTreeBasicEventIds(tree: SystemFaultTreeNode | undefined): string[] {
  if (tree === undefined) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  const visit = (node: SystemFaultTreeNode): void => {
    if (node.type === "BE") {
      if (!seen.has(node.basicEventId)) {
        seen.add(node.basicEventId);
        ids.push(node.basicEventId);
      }
      return;
    }
    if (node.type !== "TR") node.children.forEach(visit);
  };
  visit(tree);
  return ids;
}

function systemLogicModelBasicEvents(
  analysis: Pick<SystemsAnalysis, "systemBasicEvents">,
  model: Pick<SystemLogicModel, "faultTree">,
): SystemBasicEvent[] {
  const catalogue = new Map(analysis.systemBasicEvents.map((event) => [event.uuid, event]));
  return systemFaultTreeBasicEventIds(model.faultTree).flatMap((id) => {
    const event = catalogue.get(id);
    return event === undefined ? [] : [event];
  });
}

export {
  normalizeSystemsAnalysisBasicEventCatalogue,
  systemFaultTreeBasicEventIds,
  systemLogicModelBasicEvents,
};
