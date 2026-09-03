import type {
  BayesianNetworkConditionalProbabilityTable,
  BayesianNetworkCptRow,
  BayesianNetworkNode,
  BayesianNetworkParentReference,
} from "interfaces-mef-types/modeling";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";

function newId(): string {
  return crypto.randomUUID();
}

function uniqueCode(prefix: string, codes: readonly string[]): string {
  const normalized = new Set(codes.map((code) => code.trim().toUpperCase()));
  let suffix = normalized.size + 1;
  while (normalized.has(`${prefix}-${String(suffix)}`)) suffix += 1;
  return `${prefix}-${String(suffix)}`;
}

function createEmptyBayesianNetwork(name = "New Bayesian network"): BayesianNetworkModel {
  return {
    modelId: newId(),
    code: "BN-1",
    name,
    description: "",
    nodes: [],
    edges: [],
    conditionalProbabilityTables: [],
    nodePositions: [],
    layout: {
      viewport: { x: 0, y: 0, zoom: 1 },
      mode: "AUTOMATIC",
      direction: "LEFT_TO_RIGHT",
    },
  };
}

function createDefaultNode(model: BayesianNetworkModel): BayesianNetworkNode {
  const code = uniqueCode("N", model.nodes.map((node) => node.code));
  return {
    id: newId(),
    kind: "CHANCE_NODE",
    code,
    name: "New node",
    description: "",
    states: [
      { id: newId(), code: "FALSE", name: "False" },
      { id: newId(), code: "TRUE", name: "True" },
    ],
  };
}

function cartesianStateSelections(
  model: BayesianNetworkModel,
  parents: readonly BayesianNetworkParentReference[],
): Array<Array<{ parentNodeId: string; stateId: string }>> {
  return [...parents]
    .sort((left, right) => left.order - right.order)
    .reduce<Array<Array<{ parentNodeId: string; stateId: string }>>>((rows, parent) => {
      const node = model.nodes.find(({ id }) => id === parent.nodeId);
      if (node === undefined) return [];
      return rows.flatMap((row) =>
        node.states.map((state) => [...row, { parentNodeId: node.id, stateId: state.id }]),
      );
    }, [[]]);
}

function createUniformCpt(
  model: BayesianNetworkModel,
  nodeId: string,
  parents?: readonly BayesianNetworkParentReference[],
): BayesianNetworkConditionalProbabilityTable {
  const node = model.nodes.find(({ id }) => id === nodeId);
  if (node === undefined) throw new Error("Cannot build a CPT for a missing node.");
  const current = model.conditionalProbabilityTables.find((table) => table.nodeId === nodeId);
  const incomingIds = new Set(
    model.edges.filter((edge) => edge.childNodeId === nodeId).map((edge) => edge.parentNodeId),
  );
  const orderedParents = parents === undefined
    ? [
        ...(current?.parents ?? []).filter((parent) => incomingIds.has(parent.nodeId)),
        ...[...incomingIds]
          .filter((parentId) => !(current?.parents ?? []).some((parent) => parent.nodeId === parentId))
          .map((parentId) => ({ nodeId: parentId, order: Number.MAX_SAFE_INTEGER })),
      ].map((parent, order) => ({ nodeId: parent.nodeId, order }))
    : parents.map((parent, order) => ({ nodeId: parent.nodeId, order }));
  const probability = 1 / node.states.length;
  const rows: BayesianNetworkCptRow[] = cartesianStateSelections(model, orderedParents).map(
    (parentStates) => ({
      id: newId(),
      parentStates,
      values: node.states.map((state) => ({ stateId: state.id, probability })) as BayesianNetworkCptRow["values"],
    }),
  );
  return { nodeId, parents: orderedParents, rows };
}

function replaceCpt(
  model: BayesianNetworkModel,
  nodeId: string,
  table: BayesianNetworkConditionalProbabilityTable,
): BayesianNetworkModel {
  return {
    ...model,
    conditionalProbabilityTables: [
      ...model.conditionalProbabilityTables.filter((candidate) => candidate.nodeId !== nodeId),
      table,
    ],
  };
}

function rebuildCpt(
  model: BayesianNetworkModel,
  nodeId: string,
  parents?: readonly BayesianNetworkParentReference[],
): BayesianNetworkModel {
  return replaceCpt(model, nodeId, createUniformCpt(model, nodeId, parents));
}

function addNode(model: BayesianNetworkModel): { model: BayesianNetworkModel; nodeId: string } {
  const node = createDefaultNode(model);
  const index = model.nodes.length;
  const withNode: BayesianNetworkModel = {
    ...model,
    nodes: [...model.nodes, node],
    nodePositions: [
      ...model.nodePositions,
      { nodeId: node.id, position: { x: 40 + (index % 3) * 230, y: 40 + Math.floor(index / 3) * 150 } },
    ],
  };
  return { model: rebuildCpt(withNode, node.id), nodeId: node.id };
}

function descendants(model: BayesianNetworkModel, nodeId: string): Set<string> {
  const found = new Set<string>();
  const visit = (parentId: string): void => {
    model.edges
      .filter((edge) => edge.parentNodeId === parentId)
      .forEach((edge) => {
        if (found.has(edge.childNodeId)) return;
        found.add(edge.childNodeId);
        visit(edge.childNodeId);
      });
  };
  visit(nodeId);
  return found;
}

function canConnect(model: BayesianNetworkModel, parentNodeId: string, childNodeId: string): boolean {
  if (parentNodeId === childNodeId) return false;
  if (model.edges.some((edge) => edge.parentNodeId === parentNodeId && edge.childNodeId === childNodeId)) {
    return false;
  }
  return !descendants(model, childNodeId).has(parentNodeId);
}

function connectNodes(
  model: BayesianNetworkModel,
  parentNodeId: string,
  childNodeId: string,
): BayesianNetworkModel {
  if (!canConnect(model, parentNodeId, childNodeId)) {
    throw new Error("That connection would duplicate an edge or create a directed cycle.");
  }
  const connected: BayesianNetworkModel = {
    ...model,
    edges: [...model.edges, { id: newId(), parentNodeId, childNodeId }],
  };
  return rebuildCpt(connected, childNodeId);
}

function disconnectNodes(
  model: BayesianNetworkModel,
  parentNodeId: string,
  childNodeId: string,
): BayesianNetworkModel {
  const disconnected: BayesianNetworkModel = {
    ...model,
    edges: model.edges.filter(
      (edge) => !(edge.parentNodeId === parentNodeId && edge.childNodeId === childNodeId),
    ),
  };
  return rebuildCpt(disconnected, childNodeId);
}

function reorderParents(
  model: BayesianNetworkModel,
  nodeId: string,
  parentIds: readonly string[],
): BayesianNetworkModel {
  return rebuildCpt(
    model,
    nodeId,
    parentIds.map((parentId, order) => ({ nodeId: parentId, order })),
  );
}

function rebuildNodeAndChildren(model: BayesianNetworkModel, nodeId: string): BayesianNetworkModel {
  const affected = [
    nodeId,
    ...model.edges.filter((edge) => edge.parentNodeId === nodeId).map((edge) => edge.childNodeId),
  ];
  return affected.reduce((current, affectedNodeId) => rebuildCpt(current, affectedNodeId), model);
}

function deleteNode(model: BayesianNetworkModel, nodeId: string): BayesianNetworkModel {
  const children = model.edges
    .filter((edge) => edge.parentNodeId === nodeId)
    .map((edge) => edge.childNodeId);
  let next: BayesianNetworkModel = {
    ...model,
    nodes: model.nodes.filter((node) => node.id !== nodeId),
    edges: model.edges.filter(
      (edge) => edge.parentNodeId !== nodeId && edge.childNodeId !== nodeId,
    ),
    conditionalProbabilityTables: model.conditionalProbabilityTables.filter(
      (table) => table.nodeId !== nodeId,
    ),
    nodePositions: model.nodePositions.filter((position) => position.nodeId !== nodeId),
  };
  children.forEach((childId) => {
    next = rebuildCpt(next, childId);
  });
  return next;
}

function normalizeCptRow(row: BayesianNetworkCptRow): BayesianNetworkCptRow {
  const weights = row.values.map(({ probability }) => probability);
  if (weights.some((probability) =>
    !Number.isFinite(probability) || probability < 0 || probability > 1,
  )) return row;
  const sum = weights.reduce((total, probability) => total + probability, 0);
  const probabilities = sum === 0
    ? row.values.map(() => 1 / row.values.length)
    : row.values.map(({ probability }) => probability / sum);
  return {
    ...row,
    values: row.values.map((value, index) => ({
      ...value,
      probability: probabilities[index]!,
    })) as BayesianNetworkCptRow["values"],
  };
}

function autoArrange(model: BayesianNetworkModel): BayesianNetworkModel {
  const levels = new Map<string, number>();
  const levelFor = (nodeId: string, visiting = new Set<string>()): number => {
    const known = levels.get(nodeId);
    if (known !== undefined) return known;
    if (visiting.has(nodeId)) return 0;
    const nextVisiting = new Set(visiting).add(nodeId);
    const parents = model.edges.filter((edge) => edge.childNodeId === nodeId);
    const level = parents.length === 0
      ? 0
      : 1 + Math.max(...parents.map((edge) => levelFor(edge.parentNodeId, nextVisiting)));
    levels.set(nodeId, level);
    return level;
  };
  model.nodes.forEach((node) => levelFor(node.id));
  const byLevel = new Map<number, string[]>();
  model.nodes.forEach((node) => {
    const level = levels.get(node.id) ?? 0;
    byLevel.set(level, [...(byLevel.get(level) ?? []), node.id]);
  });
  return {
    ...model,
    nodePositions: model.nodes.map((node) => {
      const level = levels.get(node.id) ?? 0;
      const row = byLevel.get(level)?.indexOf(node.id) ?? 0;
      return { nodeId: node.id, position: { x: 44 + level * 250, y: 44 + row * 140 } };
    }),
    layout: { ...model.layout, mode: "AUTOMATIC", direction: "LEFT_TO_RIGHT" },
  };
}

export {
  addNode,
  autoArrange,
  canConnect,
  connectNodes,
  createEmptyBayesianNetwork,
  createUniformCpt,
  deleteNode,
  descendants,
  disconnectNodes,
  newId,
  normalizeCptRow,
  rebuildCpt,
  rebuildNodeAndChildren,
  reorderParents,
  replaceCpt,
  uniqueCode,
};
