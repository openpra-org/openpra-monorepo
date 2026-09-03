import type {
  BayesianNetworkConditionalProbabilityTable,
  BayesianNetworkModuleInputBinding,
  BayesianNetworkModuleInputPort,
  BayesianNetworkModuleInstance,
  BayesianNetworkModuleNodeMapping,
  BayesianNetworkModuleTemplate,
  BayesianNetworkNode,
} from "interfaces-mef-types/modeling";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { descendants, newId } from "./bayesianNetworkOperations";

type IdFactory = () => string;

interface BayesianNetworkModuleInstantiationOptions {
  code?: string;
  name?: string;
  inputBindings?: BayesianNetworkModuleInputBinding[];
}

function normalizedCode(value: string): string {
  return value.trim().toUpperCase();
}

function uniqueTextCode(base: string, existing: readonly string[]): string {
  const used = new Set(existing.map(normalizedCode));
  const cleaned = base.trim().replace(/\s+/g, "-").slice(0, 64) || "MODULE";
  if (!used.has(normalizedCode(cleaned))) return cleaned;
  let suffix = 2;
  while (true) {
    const suffixText = `-${String(suffix)}`;
    const candidate = `${cleaned.slice(0, 64 - suffixText.length)}${suffixText}`;
    if (!used.has(normalizedCode(candidate))) return candidate;
    suffix += 1;
  }
}

function cloneNode(
  node: BayesianNetworkNode,
  idFactory: IdFactory,
): {
  node: BayesianNetworkNode;
  stateIds: Map<string, string>;
} {
  const stateIds = new Map<string, string>();
  const states = node.states.map((state) => {
    const id = idFactory();
    stateIds.set(state.id, id);
    return { ...state, id };
  }) as BayesianNetworkNode["states"];
  return { node: { ...node, id: idFactory(), states }, stateIds };
}

function cloneTable(
  table: BayesianNetworkConditionalProbabilityTable,
  nodeIds: ReadonlyMap<string, string>,
  stateIds: ReadonlyMap<string, ReadonlyMap<string, string>>,
  idFactory: IdFactory,
): BayesianNetworkConditionalProbabilityTable {
  const nodeId = nodeIds.get(table.nodeId);
  if (nodeId === undefined) throw new Error("A module CPT references a node outside its interface.");
  return {
    nodeId,
    parents: table.parents.map((parent) => {
      const mapped = nodeIds.get(parent.nodeId);
      if (mapped === undefined) throw new Error("A module CPT parent is not exposed as an input port.");
      return { ...parent, nodeId: mapped };
    }),
    rows: table.rows.map((row) => ({
      id: idFactory(),
      parentStates: row.parentStates.map((selection) => {
        const mappedNodeId = nodeIds.get(selection.parentNodeId);
        const mappedStateId = stateIds.get(selection.parentNodeId)?.get(selection.stateId);
        if (mappedNodeId === undefined || mappedStateId === undefined) {
          throw new Error("A module CPT row contains an unresolved parent state.");
        }
        return { parentNodeId: mappedNodeId, stateId: mappedStateId };
      }),
      values: row.values.map((value) => {
        const mappedStateId = stateIds.get(table.nodeId)?.get(value.stateId);
        if (mappedStateId === undefined) throw new Error("A module CPT row contains an unresolved node state.");
        return { ...value, stateId: mappedStateId };
      }) as typeof row.values,
    })),
  };
}

/**
 * Captures the selected node and all of its descendants. Incoming parents are
 * represented as virtual input ports, so the module can be rebound safely in
 * another part of the same network.
 */
function createBayesianNetworkModuleFromBranch(
  model: BayesianNetworkModel,
  rootNodeId: string,
  idFactory: IdFactory = newId,
): { model: BayesianNetworkModel; templateId: string } {
  const root = model.nodes.find((node) => node.id === rootNodeId);
  if (root === undefined) throw new Error("Select a node before creating a reusable module.");

  const selectedIds = new Set([rootNodeId, ...descendants(model, rootNodeId)]);
  const missingCptNode = model.nodes.find(
    (node) => selectedIds.has(node.id)
      && model.conditionalProbabilityTables.filter((table) => table.nodeId === node.id).length !== 1,
  );
  if (missingCptNode !== undefined) {
    throw new Error(`Node ${missingCptNode.code} needs one valid CPT before its branch can become a module.`);
  }
  const externalParentIds = new Set(
    model.edges
      .filter((edge) => selectedIds.has(edge.childNodeId) && !selectedIds.has(edge.parentNodeId))
      .map((edge) => edge.parentNodeId),
  );
  const sourceNodes = [
    ...model.nodes.filter((node) => selectedIds.has(node.id)),
    ...model.nodes.filter((node) => externalParentIds.has(node.id)),
  ];
  const nodeIds = new Map<string, string>();
  const stateIds = new Map<string, Map<string, string>>();
  const clonedBySourceId = new Map<string, BayesianNetworkNode>();
  sourceNodes.forEach((sourceNode) => {
    const cloned = cloneNode(sourceNode, idFactory);
    nodeIds.set(sourceNode.id, cloned.node.id);
    stateIds.set(sourceNode.id, cloned.stateIds);
    clonedBySourceId.set(sourceNode.id, cloned.node);
  });

  const internalNodes = model.nodes
    .filter((node) => selectedIds.has(node.id))
    .map((node) => clonedBySourceId.get(node.id)!);
  const inputPorts: BayesianNetworkModuleInputPort[] = model.nodes
    .filter((node) => externalParentIds.has(node.id))
    .map((node) => ({
      id: idFactory(),
      code: node.code,
      name: node.name,
      description: node.description,
      node: clonedBySourceId.get(node.id)!,
    }));
  const includedSourceIds = new Set([...selectedIds, ...externalParentIds]);
  const includedEdges = model.edges.filter(
    (edge) => selectedIds.has(edge.childNodeId) && includedSourceIds.has(edge.parentNodeId),
  );
  const edges = includedEdges.map((edge) => ({
    id: idFactory(),
    parentNodeId: nodeIds.get(edge.parentNodeId)!,
    childNodeId: nodeIds.get(edge.childNodeId)!,
  }));
  const conditionalProbabilityTables = model.conditionalProbabilityTables
    .filter((table) => selectedIds.has(table.nodeId))
    .map((table) => cloneTable(table, nodeIds, stateIds, idFactory));

  const selectedPositions = model.nodePositions.filter((entry) => selectedIds.has(entry.nodeId));
  const minX = Math.min(...selectedPositions.map((entry) => entry.position.x), 0);
  const minY = Math.min(...selectedPositions.map((entry) => entry.position.y), 0);
  const nodePositions = selectedPositions.map((entry) => ({
    nodeId: nodeIds.get(entry.nodeId)!,
    position: { x: entry.position.x - minX + 40, y: entry.position.y - minY + 40 },
  }));
  const outputNodes = model.nodes.filter(
    (node) => selectedIds.has(node.id)
      && !model.edges.some((edge) => edge.parentNodeId === node.id && selectedIds.has(edge.childNodeId)),
  );
  const existingTemplates = model.moduleTemplates ?? [];
  const templateCode = uniqueTextCode(`MOD-${root.code}`, existingTemplates.map((template) => template.code));
  const template: BayesianNetworkModuleTemplate = {
    id: idFactory(),
    code: templateCode,
    name: `${root.name} module`,
    description: `Reusable Bayesian-network branch rooted at ${root.code}.`,
    nodes: internalNodes,
    edges,
    conditionalProbabilityTables,
    nodePositions,
    inputPorts,
    outputPorts: outputNodes.map((node) => ({
      id: idFactory(),
      code: node.code,
      name: node.name,
      description: node.description,
      nodeId: nodeIds.get(node.id)!,
    })),
  };
  return {
    model: { ...model, moduleTemplates: [...existingTemplates, template] },
    templateId: template.id,
  };
}

function compatibleBayesianNetworkModuleInputNodes(
  model: BayesianNetworkModel,
  port: BayesianNetworkModuleInputPort,
): BayesianNetworkNode[] {
  const expected = new Set(port.node.states.map((state) => normalizedCode(state.code)));
  return model.nodes.filter((node) => {
    const actual = new Set(node.states.map((state) => normalizedCode(state.code)));
    return actual.size === expected.size && [...expected].every((code) => actual.has(code));
  });
}

function stateMappingByCode(
  templateNode: BayesianNetworkNode,
  targetNode: BayesianNetworkNode,
): Map<string, string> {
  const targetStateByCode = new Map(
    targetNode.states.map((state) => [normalizedCode(state.code), state.id]),
  );
  const mapping = new Map<string, string>();
  templateNode.states.forEach((state) => {
    const stateId = targetStateByCode.get(normalizedCode(state.code));
    if (stateId === undefined) {
      throw new Error(
        `Input ${templateNode.code} requires states ${templateNode.states.map(({ code }) => code).join(", ")}.`,
      );
    }
    mapping.set(state.id, stateId);
  });
  if (targetNode.states.length !== templateNode.states.length) {
    throw new Error(
      `Input ${templateNode.code} requires exactly ${String(templateNode.states.length)} states.`,
    );
  }
  return mapping;
}

function wouldCreateCycle(
  edges: readonly { parentNodeId: string; childNodeId: string }[],
  parentNodeId: string,
  childNodeId: string,
): boolean {
  const visited = new Set<string>();
  const visit = (nodeId: string): boolean => {
    if (nodeId === parentNodeId) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    return edges
      .filter((edge) => edge.parentNodeId === nodeId)
      .some((edge) => visit(edge.childNodeId));
  };
  return visit(childNodeId);
}

/** Materializes an independent, solver-ready copy of a module. */
function instantiateBayesianNetworkModule(
  model: BayesianNetworkModel,
  templateId: string,
  options: BayesianNetworkModuleInstantiationOptions = {},
  idFactory: IdFactory = newId,
): { model: BayesianNetworkModel; instanceId: string; outputNodeIds: string[] } {
  const template = model.moduleTemplates?.find((candidate) => candidate.id === templateId);
  if (template === undefined) throw new Error("The selected reusable module no longer exists.");

  const suppliedBindings = options.inputBindings ?? [];
  const bindingByPortId = new Map(suppliedBindings.map((binding) => [binding.portId, binding.nodeId]));
  if (bindingByPortId.size !== suppliedBindings.length) {
    throw new Error("Each module input can be bound only once.");
  }
  const unexpectedBinding = suppliedBindings.find(
    (binding) => !template.inputPorts.some((port) => port.id === binding.portId),
  );
  if (unexpectedBinding !== undefined) throw new Error("A module input binding references an unknown port.");

  const nodeIds = new Map<string, string>();
  const stateIds = new Map<string, Map<string, string>>();
  template.inputPorts.forEach((port) => {
    const bindingNodeId = bindingByPortId.get(port.id);
    if (bindingNodeId === undefined) throw new Error(`Choose a network node for input ${port.code}.`);
    const bindingNode = model.nodes.find((node) => node.id === bindingNodeId);
    if (bindingNode === undefined) throw new Error(`Input ${port.code} references a missing network node.`);
    nodeIds.set(port.node.id, bindingNode.id);
    stateIds.set(port.node.id, stateMappingByCode(port.node, bindingNode));
  });

  const existingInstances = model.moduleInstances ?? [];
  const instanceCode = uniqueTextCode(
    options.code ?? `${template.code}-1`,
    [...existingInstances.map((instance) => instance.code), ...model.nodes.map((node) => node.code)],
  );
  const instanceName = options.name?.trim() || `${template.name} instance`;
  const usedNodeCodes = [...model.nodes.map((node) => node.code)];
  const materializedNodes: BayesianNetworkNode[] = [];
  const nodeMappings: BayesianNetworkModuleNodeMapping[] = [];
  template.nodes.forEach((templateNode) => {
    const cloned = cloneNode(templateNode, idFactory);
    cloned.node.code = uniqueTextCode(`${instanceCode}-${templateNode.code}`, usedNodeCodes);
    usedNodeCodes.push(cloned.node.code);
    cloned.node.name = `${instanceName} · ${templateNode.name}`.slice(0, 200);
    nodeIds.set(templateNode.id, cloned.node.id);
    stateIds.set(templateNode.id, cloned.stateIds);
    materializedNodes.push(cloned.node);
    nodeMappings.push({
      templateNodeId: templateNode.id,
      nodeId: cloned.node.id,
      stateMappings: templateNode.states.map((state) => ({
        templateStateId: state.id,
        stateId: cloned.stateIds.get(state.id)!,
      })),
    });
  });

  const mappedEdges = template.edges.map((edge) => {
    const parentNodeId = nodeIds.get(edge.parentNodeId);
    const childNodeId = nodeIds.get(edge.childNodeId);
    if (parentNodeId === undefined || childNodeId === undefined) {
      throw new Error("The module contains an edge outside its declared interface.");
    }
    return { id: idFactory(), parentNodeId, childNodeId };
  });
  const allEdges = [...model.edges];
  mappedEdges.forEach((edge) => {
    if (
      allEdges.some(
        (candidate) => candidate.parentNodeId === edge.parentNodeId && candidate.childNodeId === edge.childNodeId,
      )
      || wouldCreateCycle(allEdges, edge.parentNodeId, edge.childNodeId)
    ) {
      throw new Error("These module input bindings would create a duplicate edge or directed cycle.");
    }
    allEdges.push(edge);
  });

  const materializedTables = template.conditionalProbabilityTables.map((table) =>
    cloneTable(table, nodeIds, stateIds, idFactory),
  );
  const templatePositionByNodeId = new Map(
    template.nodePositions.map((entry) => [entry.nodeId, entry.position]),
  );
  const minX = Math.min(...template.nodePositions.map((entry) => entry.position.x), 0);
  const minY = Math.min(...template.nodePositions.map((entry) => entry.position.y), 0);
  const maxHostX = Math.max(...model.nodePositions.map((entry) => entry.position.x), 0);
  const positionOffset = { x: maxHostX + 260 - minX, y: 40 - minY };
  const materializedPositions = template.nodes.map((node, index) => {
    const position = templatePositionByNodeId.get(node.id) ?? {
      x: 40 + (index % 3) * 230,
      y: 40 + Math.floor(index / 3) * 140,
    };
    return {
      nodeId: nodeIds.get(node.id)!,
      position: { x: position.x + positionOffset.x, y: position.y + positionOffset.y },
    };
  });
  const outputBindings = template.outputPorts.map((port) => {
    const nodeId = nodeIds.get(port.nodeId);
    if (nodeId === undefined) throw new Error(`Output ${port.code} references a missing module node.`);
    return { portId: port.id, nodeId };
  });
  const instance: BayesianNetworkModuleInstance = {
    id: idFactory(),
    templateId: template.id,
    code: instanceCode,
    name: instanceName,
    description: `Materialized from reusable module ${template.code}.`,
    inputBindings: template.inputPorts.map((port) => ({
      portId: port.id,
      nodeId: bindingByPortId.get(port.id)!,
    })),
    nodeMappings,
    outputBindings,
  };
  return {
    model: {
      ...model,
      nodes: [...model.nodes, ...materializedNodes],
      edges: allEdges,
      conditionalProbabilityTables: [...model.conditionalProbabilityTables, ...materializedTables],
      nodePositions: [...model.nodePositions, ...materializedPositions],
      moduleInstances: [...existingInstances, instance],
    },
    instanceId: instance.id,
    outputNodeIds: outputBindings.map((binding) => binding.nodeId),
  };
}

function deleteBayesianNetworkModuleInstance(
  model: BayesianNetworkModel,
  instanceId: string,
): BayesianNetworkModel {
  const instance = model.moduleInstances?.find((candidate) => candidate.id === instanceId);
  if (instance === undefined) return model;
  const materializedNodeIds = new Set(instance.nodeMappings.map((mapping) => mapping.nodeId));
  const dependentInstance = model.moduleInstances?.find(
    (candidate) => candidate.id !== instanceId
      && candidate.inputBindings.some((binding) => materializedNodeIds.has(binding.nodeId)),
  );
  if (dependentInstance !== undefined) {
    throw new Error(`Delete dependent module instance ${dependentInstance.code} first.`);
  }
  const affectedChildIds = new Set(
    model.edges
      .filter(
        (edge) => materializedNodeIds.has(edge.parentNodeId) && !materializedNodeIds.has(edge.childNodeId),
      )
      .map((edge) => edge.childNodeId),
  );
  let next: BayesianNetworkModel = {
    ...model,
    nodes: model.nodes.filter((node) => !materializedNodeIds.has(node.id)),
    edges: model.edges.filter(
      (edge) => !materializedNodeIds.has(edge.parentNodeId) && !materializedNodeIds.has(edge.childNodeId),
    ),
    conditionalProbabilityTables: model.conditionalProbabilityTables.filter(
      (table) => !materializedNodeIds.has(table.nodeId),
    ),
    nodePositions: model.nodePositions.filter((entry) => !materializedNodeIds.has(entry.nodeId)),
    moduleInstances: model.moduleInstances?.filter((candidate) => candidate.id !== instanceId),
    ...(model.xdslMetadata === undefined
      ? {}
      : {
          xdslMetadata: {
            ...model.xdslMetadata,
            nodeIdentifiers: model.xdslMetadata.nodeIdentifiers.filter(
              (identifier) => !materializedNodeIds.has(identifier.nodeId),
            ),
          },
        }),
  };
  affectedChildIds.forEach((childId) => {
    const child = next.nodes.find((node) => node.id === childId);
    if (child === undefined) return;
    const incomingIds = new Set(
      next.edges.filter((edge) => edge.childNodeId === childId).map((edge) => edge.parentNodeId),
    );
    const current = next.conditionalProbabilityTables.find((table) => table.nodeId === childId);
    const parents = (current?.parents ?? [])
      .filter((parent) => incomingIds.has(parent.nodeId))
      .map((parent, order) => ({ nodeId: parent.nodeId, order }));
    const probability = 1 / child.states.length;
    let combinations: Array<Array<{ parentNodeId: string; stateId: string }>> = [[]];
    parents.forEach((parent) => {
      const parentNode = next.nodes.find((node) => node.id === parent.nodeId);
      combinations = parentNode === undefined
        ? []
        : combinations.flatMap((combination) =>
            parentNode.states.map((state) => [
              ...combination,
              { parentNodeId: parent.nodeId, stateId: state.id },
            ]),
          );
    });
    const rebuilt: BayesianNetworkConditionalProbabilityTable = {
      nodeId: childId,
      parents,
      rows: combinations.map((parentStates) => ({
        id: newId(),
        parentStates,
        values: child.states.map((state) => ({ stateId: state.id, probability })) as BayesianNetworkConditionalProbabilityTable["rows"][number]["values"],
      })),
    };
    next = {
      ...next,
      conditionalProbabilityTables: [
        ...next.conditionalProbabilityTables.filter((table) => table.nodeId !== childId),
        rebuilt,
      ],
    };
  });
  return next;
}

function deleteBayesianNetworkModuleTemplate(
  model: BayesianNetworkModel,
  templateId: string,
): BayesianNetworkModel {
  if (model.moduleInstances?.some((instance) => instance.templateId === templateId) === true) {
    throw new Error("Delete this module's instances before deleting its template.");
  }
  return {
    ...model,
    moduleTemplates: model.moduleTemplates?.filter((template) => template.id !== templateId),
  };
}

export {
  compatibleBayesianNetworkModuleInputNodes,
  createBayesianNetworkModuleFromBranch,
  deleteBayesianNetworkModuleInstance,
  deleteBayesianNetworkModuleTemplate,
  instantiateBayesianNetworkModule,
};
export type { BayesianNetworkModuleInstantiationOptions };
