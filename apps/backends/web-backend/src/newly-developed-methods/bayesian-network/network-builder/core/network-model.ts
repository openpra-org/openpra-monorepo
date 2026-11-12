import { valueError } from "./errors";
import { isClose } from "./math-functions";
import { compareText, formatGeneral, repr, sortedText, sum } from "./spec-values";
import type { SpecMapping } from "./spec-values";

interface NetworkNode {
  nodeId: string;
  kind: string;
  states: string[];
  metadata: SpecMapping;
}

interface NetworkEdge {
  parent: string;
  child: string;
}

interface NetworkCpd {
  node: string;
  parents: string[];
  table: number[];
}

interface NetworkModel {
  schemaVersion: string;
  modelId: string;
  description: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  cpds: NetworkCpd[];
  metadata: SpecMapping;
}

interface ValidationIssue {
  code: string;
  message: string;
}

const nodeMap = (model: NetworkModel): Map<string, NetworkNode> =>
  new Map(model.nodes.map((node) => [node.nodeId, node]));

const cpdMap = (model: NetworkModel): Map<string, NetworkCpd> => new Map(model.cpds.map((cpd) => [cpd.node, cpd]));

const countValues = (values: readonly string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
};

const detectCycle = (nodeIds: Set<string>, edges: readonly NetworkEdge[]): boolean => {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const nodeId of nodeIds) {
    indegree.set(nodeId, 0);
    adjacency.set(nodeId, []);
  }
  for (const edge of edges) {
    if (!nodeIds.has(edge.parent) || !nodeIds.has(edge.child)) continue;
    adjacency.get(edge.parent)?.push(edge.child);
    indegree.set(edge.child, (indegree.get(edge.child) ?? 0) + 1);
  }
  const queue = Array.from(indegree.entries())
    .filter(([, degree]) => degree === 0)
    .map(([nodeId]) => nodeId);
  let visited = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    visited += 1;
    for (const next of adjacency.get(queue[cursor]) ?? []) {
      const degree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }
  return visited !== nodeIds.size;
};

const sameMembers = (left: Set<string>, right: Set<string>): boolean =>
  left.size === right.size && Array.from(left).every((item) => right.has(item));

const validateNetworkModel = (model: NetworkModel, probabilityTolerance = 1e-9): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const nodeCounts = countValues(model.nodes.map((node) => node.nodeId));
  for (const duplicate of sortedText(Array.from(nodeCounts.keys()).filter((id) => (nodeCounts.get(id) ?? 0) > 1))) {
    issues.push({ code: "duplicate_node_id", message: `Node id '${duplicate}' appears multiple times.` });
  }
  const nodes = nodeMap(model);
  const knownNodes = new Set(nodes.keys());
  if (knownNodes.size === 0) issues.push({ code: "empty_model", message: "Model has no nodes." });

  const edgeCounts = new Map<string, { edge: NetworkEdge; count: number }>();
  for (const edge of model.edges) {
    const key = JSON.stringify([edge.parent, edge.child]);
    const entry = edgeCounts.get(key);
    if (entry === undefined) edgeCounts.set(key, { edge, count: 1 });
    else entry.count += 1;
  }
  const duplicateEdges = Array.from(edgeCounts.values())
    .filter((entry) => entry.count > 1)
    .map((entry) => entry.edge)
    .sort((left, right) => compareText(left.parent, right.parent) || compareText(left.child, right.child));
  for (const edge of duplicateEdges) {
    issues.push({ code: "duplicate_edge", message: `Duplicate edge '${edge.parent} -> ${edge.child}'.` });
  }
  for (const edge of model.edges) {
    if (!knownNodes.has(edge.parent)) {
      issues.push({ code: "edge_parent_missing", message: `Edge parent '${edge.parent}' does not exist.` });
    }
    if (!knownNodes.has(edge.child)) {
      issues.push({ code: "edge_child_missing", message: `Edge child '${edge.child}' does not exist.` });
    }
    if (edge.parent === edge.child) {
      issues.push({ code: "self_loop", message: `Self-loop detected at node '${edge.parent}'.` });
    }
  }
  if (knownNodes.size > 0 && detectCycle(knownNodes, model.edges)) {
    issues.push({ code: "cycle_detected", message: "Directed cycle detected in graph." });
  }

  const cpdCounts = countValues(model.cpds.map((cpd) => cpd.node));
  for (const nodeId of sortedText(cpdCounts.keys())) {
    const count = cpdCounts.get(nodeId) ?? 0;
    if (count > 1) {
      issues.push({
        code: "duplicate_cpd",
        message: `Node '${nodeId}' has ${count} CPD entries; expected exactly one.`,
      });
    }
  }
  const cpds = cpdMap(model);
  for (const nodeId of sortedText(knownNodes)) {
    if (!cpds.has(nodeId)) {
      issues.push({ code: "missing_cpd", message: `Node '${nodeId}' is missing a CPD entry.` });
    }
  }
  for (const cpdNode of sortedText(cpds.keys())) {
    if (!knownNodes.has(cpdNode)) {
      issues.push({ code: "cpd_unknown_node", message: `CPD references unknown node '${cpdNode}'.` });
    }
  }

  const incoming = new Map<string, string[]>();
  for (const edge of model.edges) {
    const parents = incoming.get(edge.child);
    if (parents === undefined) incoming.set(edge.child, [edge.parent]);
    else parents.push(edge.parent);
  }
  for (const cpd of model.cpds) {
    const child = nodes.get(cpd.node);
    if (child === undefined) continue;
    if (child.kind !== "chance_cpt") {
      issues.push({
        code: "unsupported_node_kind",
        message: `Node '${child.nodeId}' has unsupported kind '${child.kind}' for Step 0.`,
      });
    }
    const parentList = Array.from(cpd.parents);
    if (parentList.length !== new Set(parentList).size) {
      issues.push({ code: "cpd_duplicate_parent", message: `CPD for '${cpd.node}' has duplicated parent ids.` });
    }
    for (const parent of parentList) {
      if (!knownNodes.has(parent)) {
        issues.push({
          code: "cpd_parent_missing",
          message: `CPD for '${cpd.node}' references unknown parent '${parent}'.`,
        });
      }
    }
    const graphParents = new Set(incoming.get(cpd.node) ?? []);
    const cpdParents = new Set(parentList);
    if (!sameMembers(graphParents, cpdParents)) {
      issues.push({
        code: "cpd_parent_mismatch",
        message: `CPD parent set mismatch for '${cpd.node}': graph=${repr(sortedText(graphParents))} vs cpd=${repr(sortedText(cpdParents))}.`,
      });
    }
    const parentCards: number[] = [];
    let missingCard = false;
    for (const parentId of parentList) {
      const parentNode = nodes.get(parentId);
      if (parentNode === undefined) {
        missingCard = true;
        break;
      }
      if (parentNode.states.length <= 0) {
        issues.push({
          code: "invalid_parent_cardinality",
          message: `Parent '${parentId}' has invalid cardinality ${parentNode.states.length}.`,
        });
        missingCard = true;
        break;
      }
      parentCards.push(parentNode.states.length);
    }
    const childCard = child.states.length;
    if (childCard <= 0) {
      issues.push({
        code: "invalid_child_cardinality",
        message: `Node '${child.nodeId}' has invalid cardinality ${childCard}.`,
      });
      continue;
    }
    if (missingCard) continue;
    const rowCount = parentCards.reduce((product, card) => product * card, 1);
    const expectedSize = rowCount * childCard;
    if (cpd.table.length !== expectedSize) {
      issues.push({
        code: "cpd_table_size_mismatch",
        message: `CPD size mismatch for '${cpd.node}': got ${cpd.table.length}, expected ${expectedSize}.`,
      });
      continue;
    }
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = cpd.table.slice(rowIndex * childCard, rowIndex * childCard + childCard);
      if (row.some((value) => value < -probabilityTolerance || value > 1 + probabilityTolerance)) {
        issues.push({
          code: "cpd_probability_out_of_bounds",
          message: `CPD row ${rowIndex} for '${cpd.node}' has values outside [0, 1].`,
        });
      }
      const rowSum = sum(row);
      if (!isClose(rowSum, 1, 0, probabilityTolerance)) {
        issues.push({
          code: "cpd_row_not_normalized",
          message: `CPD row ${rowIndex} for '${cpd.node}' sums to ${formatGeneral(rowSum, 12)}; expected 1.0.`,
        });
      }
    }
  }
  return issues;
};

const assertValidNetworkModel = (model: NetworkModel, probabilityTolerance = 1e-9): void => {
  const issues = validateNetworkModel(model, probabilityTolerance);
  if (issues.length === 0) return;
  const lines = ["BN-IR validation failed:"];
  issues.forEach((issue, index) => lines.push(`${index + 1}. [${issue.code}] ${issue.message}`));
  throw valueError(lines.join("\n"));
};

export type { NetworkCpd, NetworkEdge, NetworkModel, NetworkNode, ValidationIssue };
export { assertValidNetworkModel, cpdMap, nodeMap, validateNetworkModel };
