import type {
  BayesianNetworkModel,
  BayesianNetworkModuleInstance,
  BayesianNetworkModuleTemplate,
} from "./bayesian-network-model";
import type { ValidationIssue } from "../shared";

/** Application metadata must describe the ordinary BN graph actually sent to PRAXIS. */
function validateBayesianNetworkModuleWiring(
  model: BayesianNetworkModel,
  template: BayesianNetworkModuleTemplate,
  instance: BayesianNetworkModuleInstance,
  instanceIndex: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const bindings = new Map(instance.inputBindings.map((binding) => [binding.portId, binding.nodeId]));
  const nodeIds = new Map([
    ...template.inputPorts.map((port) => [port.node.id, bindings.get(port.id)] as const),
    ...instance.nodeMappings.map((mapping) => [mapping.templateNodeId, mapping.nodeId] as const),
  ]);
  for (const node of template.nodes) {
    const nodeId = nodeIds.get(node.id);
    if (nodeId === undefined) continue; // The existing mapping validator reports missing nodes.
    const source = template.conditionalProbabilityTables.filter((table) => table.nodeId === node.id);
    const target = model.conditionalProbabilityTables.filter((table) => table.nodeId === nodeId);
    const expected =
      source.length === 1 ?
        [...source[0]!.parents].sort((a, b) => a.order - b.order).map((parent) => nodeIds.get(parent.nodeId))
      : [];
    const actual =
      target.length === 1 ?
        [...target[0]!.parents].sort((a, b) => a.order - b.order).map((parent) => parent.nodeId)
      : [];
    if (
      source.length !== 1 ||
      target.length !== 1 ||
      expected.some((id) => id === undefined) ||
      new Set(expected).size !== expected.length ||
      expected.length !== actual.length ||
      new Set(actual).size !== actual.length ||
      expected.some((id) => id === undefined || !actual.includes(id))
    ) {
      issues.push({
        code: "BN_MODULE_CPT_WIRING_MISMATCH",
        severity: "ERROR",
        entityId: nodeId,
        message: `Module ${instance.code}: CPT parents for ${node.code} do not match its declared inputs and internal connections`,
        fieldPath: ["moduleInstances", instanceIndex, "inputBindings"],
      });
    }
    const expectedEdges = template.edges
      .filter((edge) => edge.childNodeId === node.id)
      .map((edge) => nodeIds.get(edge.parentNodeId));
    const actualEdges = model.edges.filter((edge) => edge.childNodeId === nodeId).map((edge) => edge.parentNodeId);
    if (
      expectedEdges.some((id) => id === undefined) ||
      new Set(expectedEdges).size !== expectedEdges.length ||
      new Set(actualEdges).size !== actualEdges.length ||
      expectedEdges.length !== actualEdges.length ||
      expectedEdges.some((id) => id === undefined || !actualEdges.includes(id))
    ) {
      issues.push({
        code: "BN_MODULE_EDGE_WIRING_MISMATCH",
        severity: "ERROR",
        entityId: nodeId,
        message: `Module ${instance.code}: graph parents for ${node.code} do not match its declared inputs and internal connections`,
        fieldPath: ["moduleInstances", instanceIndex, "inputBindings"],
      });
    }
  }
  return issues;
}

export { validateBayesianNetworkModuleWiring };
