import type {
  BayesianNetworkConditionalProbabilityTable,
  BayesianNetworkNode,
  BayesianNetworkParentReference,
} from "interfaces-mef-types/modeling";
import {
  BayesianNetworkModelSchema,
  type BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { createEmptyBayesianNetwork, createUniformCpt, newId } from "./bayesianNetworkOperations";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function exportBayesianNetworkXdsl(model: BayesianNetworkModel): string {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const nodes = model.nodes.map((node) => {
    const table = model.conditionalProbabilityTables.find(({ nodeId }) => nodeId === node.id);
    if (table === undefined) throw new Error(`Node ${node.code} has no CPT to export.`);
    const parents = [...table.parents]
      .sort((left, right) => left.order - right.order)
      .map((parent) => nodeById.get(parent.nodeId)?.code)
      .filter((code): code is string => code !== undefined);
    const probabilities = table.rows
      .flatMap((row) => node.states.map((state) =>
        row.values.find((value) => value.stateId === state.id)?.probability,
      ))
      .map((value) => {
        if (value === undefined) throw new Error(`Node ${node.code} has an incomplete CPT.`);
        return String(value);
      })
      .join(" ");
    return [
      `    <cpt id="${escapeXml(node.code)}">`,
      ...node.states.map((state) => `      <state id="${escapeXml(state.code)}"/>`),
      ...(parents.length === 0 ? [] : [`      <parents>${parents.map(escapeXml).join(" ")}</parents>`]),
      `      <probabilities>${probabilities}</probabilities>`,
      "    </cpt>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<smile version="1.0" id="${escapeXml(model.code)}">`,
    "  <nodes>",
    ...nodes,
    "  </nodes>",
    "</smile>",
  ].join("\n");
}

function childElements(parent: Element, tagName: string): Element[] {
  return [...parent.children].filter((child) => child.tagName.toLowerCase() === tagName);
}

function importBayesianNetworkXdsl(xml: string, current?: BayesianNetworkModel): BayesianNetworkModel {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = document.querySelector("parsererror");
  if (parserError !== null) throw new Error("The XDSL file is not valid XML.");
  const root = document.documentElement;
  if (root.tagName.toLowerCase() !== "smile") throw new Error("The XDSL root element must be <smile>.");
  const nodesElement = childElements(root, "nodes")[0];
  if (nodesElement === undefined) throw new Error("The XDSL file has no <nodes> collection.");
  const unsupported = [...nodesElement.children].find((node) => node.tagName.toLowerCase() !== "cpt");
  if (unsupported !== undefined) {
    throw new Error(`Unsupported XDSL node type '${unsupported.tagName.toLowerCase()}'. Only discrete CPT nodes are supported.`);
  }
  const cptElements = childElements(nodesElement, "cpt");
  if (cptElements.length === 0) throw new Error("The XDSL network must contain at least one CPT node.");
  const codes = new Set<string>();
  const nodes: BayesianNetworkNode[] = cptElements.map((element) => {
    const code = element.getAttribute("id")?.trim() ?? "";
    if (code === "") throw new Error("Every XDSL CPT node requires an id.");
    if (codes.has(code)) throw new Error(`XDSL node id '${code}' is duplicated.`);
    codes.add(code);
    const states = childElements(element, "state").map((state) => {
      const stateCode = state.getAttribute("id")?.trim() ?? "";
      if (stateCode === "") throw new Error(`XDSL node '${code}' contains a state without an id.`);
      return { id: newId(), code: stateCode, name: stateCode };
    });
    if (states.length < 2) throw new Error(`XDSL node '${code}' must contain at least two states.`);
    return {
      id: newId(),
      kind: "CHANCE_NODE",
      code,
      name: code,
      description: "",
      states: states as BayesianNetworkNode["states"],
    };
  });
  const nodeByCode = new Map(nodes.map((node) => [node.code, node]));
  let model: BayesianNetworkModel = {
    ...(current ?? createEmptyBayesianNetwork(root.getAttribute("id") ?? "Imported Bayesian network")),
    code: root.getAttribute("id")?.trim() || current?.code || "BN-IMPORTED",
    nodes,
    edges: [],
    conditionalProbabilityTables: [],
    nodePositions: nodes.map((node, index) => ({
      nodeId: node.id,
      position: { x: 44 + (index % 3) * 250, y: 44 + Math.floor(index / 3) * 140 },
    })),
  };

  const tables: BayesianNetworkConditionalProbabilityTable[] = [];
  cptElements.forEach((element) => {
    const code = element.getAttribute("id")!;
    const node = nodeByCode.get(code)!;
    const parentCodes = childElements(element, "parents")[0]?.textContent?.trim().split(/\s+/).filter(Boolean) ?? [];
    const parents: BayesianNetworkParentReference[] = parentCodes.map((parentCode, order) => {
      const parent = nodeByCode.get(parentCode);
      if (parent === undefined) throw new Error(`XDSL node '${code}' references missing parent '${parentCode}'.`);
      return { nodeId: parent.id, order };
    });
    model = {
      ...model,
      edges: [
        ...model.edges,
        ...parents.map((parent) => ({ id: newId(), parentNodeId: parent.nodeId, childNodeId: node.id })),
      ],
    };
    const uniform = createUniformCpt(model, node.id, parents);
    const values = (childElements(element, "probabilities")[0]?.textContent ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);
    const expected = uniform.rows.length * node.states.length;
    if (values.length !== expected || values.some((value) => !Number.isFinite(value))) {
      throw new Error(`XDSL node '${code}' requires ${String(expected)} finite probability values.`);
    }
    tables.push({
      ...uniform,
      rows: uniform.rows.map((row, rowIndex) => ({
        ...row,
        values: row.values.map((value, stateIndex) => ({
          ...value,
          probability: values[rowIndex * node.states.length + stateIndex]!,
        })) as typeof row.values,
      })),
    });
  });
  return BayesianNetworkModelSchema.parse({ ...model, conditionalProbabilityTables: tables });
}

function exportBayesianNetworkJson(model: BayesianNetworkModel): string {
  return JSON.stringify(model, null, 2);
}

function importBayesianNetworkJson(json: string): BayesianNetworkModel {
  return BayesianNetworkModelSchema.parse(JSON.parse(json) as unknown);
}

export {
  exportBayesianNetworkJson,
  exportBayesianNetworkXdsl,
  importBayesianNetworkJson,
  importBayesianNetworkXdsl,
};
