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

function serializeXml(element: Element): string {
  return new XMLSerializer().serializeToString(element);
}

function descendantElements(parent: Element, tagName: string): Element[] {
  return [...parent.getElementsByTagName("*")]
    .filter((child) => child.tagName.toLowerCase() === tagName);
}

function directText(parent: Element, tagName: string): string | undefined {
  const value = childElements(parent, tagName)[0]?.textContent?.trim();
  return value === undefined || value === "" ? undefined : value;
}

function parseGeniePosition(node: Element | undefined): { x: number; y: number } | undefined {
  if (node === undefined) return undefined;
  const values = (directText(node, "position") ?? "").split(/\s+/).map(Number);
  if (values.length < 2 || !Number.isFinite(values[0]) || !Number.isFinite(values[1])) return undefined;
  return { x: values[0]!, y: values[1]! };
}

function formatCoordinate(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function ensureTextChild(parent: Element, tagName: string, value: string): Element {
  let child = childElements(parent, tagName)[0];
  if (child === undefined) {
    child = parent.ownerDocument.createElement(tagName);
    parent.appendChild(child);
  }
  child.textContent = value;
  return child;
}

function createGenieNode(parent: Element, code: string, name: string, x: number, y: number): Element {
  const document = parent.ownerDocument;
  const node = document.createElement("node");
  node.setAttribute("id", code);
  ensureTextChild(node, "name", name);
  const interior = document.createElement("interior");
  interior.setAttribute("color", "e2e8f0");
  node.appendChild(interior);
  const outline = document.createElement("outline");
  outline.setAttribute("color", "334155");
  node.appendChild(outline);
  const font = document.createElement("font");
  font.setAttribute("color", "000000");
  font.setAttribute("name", "Arial");
  font.setAttribute("size", "10");
  node.appendChild(font);
  ensureTextChild(node, "position", `${formatCoordinate(x)} ${formatCoordinate(y)} ${formatCoordinate(x + 180)} ${formatCoordinate(y + 70)}`);
  parent.appendChild(node);
  return node;
}

function ensureGenieModuleSubmodel(
  genie: Element,
  model: BayesianNetworkModel,
  instance: NonNullable<BayesianNetworkModel["moduleInstances"]>[number],
): Element {
  const existing = descendantElements(genie, "submodel").find(
    (submodel) => submodel.getAttribute("id") === instance.code,
  );
  if (existing !== undefined) return existing;
  const document = genie.ownerDocument;
  const submodel = document.createElement("submodel");
  submodel.setAttribute("id", instance.code);
  ensureTextChild(submodel, "name", instance.name);
  const interior = document.createElement("interior");
  interior.setAttribute("color", "e2e8f0");
  submodel.appendChild(interior);
  const outline = document.createElement("outline");
  outline.setAttribute("color", "64748b");
  submodel.appendChild(outline);
  const font = document.createElement("font");
  font.setAttribute("color", "000000");
  font.setAttribute("name", "Arial");
  font.setAttribute("size", "10");
  submodel.appendChild(font);
  const materializedIds = new Set(instance.nodeMappings.map((mapping) => mapping.nodeId));
  const positions = model.nodePositions
    .filter((entry) => materializedIds.has(entry.nodeId))
    .map((entry) => entry.position);
  const minX = Math.min(...positions.map((position) => position.x), 24);
  const minY = Math.min(...positions.map((position) => position.y), 24);
  const maxX = Math.max(...positions.map((position) => position.x + 180), minX + 210);
  const maxY = Math.max(...positions.map((position) => position.y + 70), minY + 74);
  ensureTextChild(
    submodel,
    "position",
    [minX - 20, minY - 36, maxX + 20, maxY + 20].map(formatCoordinate).join(" "),
  );
  genie.appendChild(submodel);
  return submodel;
}

function synchronizedExtensions(model: BayesianNetworkModel): string {
  const source = model.xdslMetadata?.extensionsXml
    ?? '<extensions><genie version="1.0" app="OpenPRA" name="Bayesian network"/></extensions>';
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.querySelector("parsererror") !== null || document.documentElement.tagName.toLowerCase() !== "extensions") {
    throw new Error("The preserved XDSL extensions are not valid XML.");
  }
  const extensions = document.documentElement;
  let genie = childElements(extensions, "genie")[0];
  if (genie === undefined) {
    genie = document.createElement("genie");
    genie.setAttribute("version", "1.0");
    genie.setAttribute("app", "OpenPRA");
    genie.setAttribute("name", model.name);
    extensions.appendChild(genie);
  }

  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const positionById = new Map(model.nodePositions.map((entry) => [entry.nodeId, entry.position]));
  const internalIdBySourceId = new Map(
    (model.xdslMetadata?.nodeIdentifiers ?? []).map(({ nodeId, sourceId }) => [sourceId, nodeId]),
  );
  const seen = new Set<string>();
  const moduleInstanceByNodeId = new Map(
    (model.moduleInstances ?? []).flatMap((instance) =>
      instance.nodeMappings.map((mapping) => [mapping.nodeId, instance] as const),
    ),
  );

  descendantElements(extensions, "node").forEach((extensionNode) => {
    const sourceId = extensionNode.getAttribute("id") ?? "";
    const internalId = internalIdBySourceId.get(sourceId)
      ?? model.nodes.find((candidate) => candidate.code === sourceId)?.id;
    if (internalId === undefined) return;
    const node = nodeById.get(internalId);
    if (node === undefined) {
      extensionNode.remove();
      return;
    }
    seen.add(node.id);
    extensionNode.setAttribute("id", node.code);
    ensureTextChild(extensionNode, "name", node.name);
    if (node.description !== "" || childElements(extensionNode, "comment").length > 0) {
      ensureTextChild(extensionNode, "comment", node.description);
    }
    const position = positionById.get(node.id);
    if (position === undefined) return;
    const original = (directText(extensionNode, "position") ?? "").split(/\s+/).map(Number);
    const width = original.length >= 4 && Number.isFinite(original[2]) && Number.isFinite(original[0])
      ? Math.max(1, original[2]! - original[0]!)
      : 180;
    const height = original.length >= 4 && Number.isFinite(original[3]) && Number.isFinite(original[1])
      ? Math.max(1, original[3]! - original[1]!)
      : 70;
    ensureTextChild(
      extensionNode,
      "position",
      [position.x, position.y, position.x + width, position.y + height].map(formatCoordinate).join(" "),
    );
  });

  model.nodes.forEach((node, index) => {
    if (seen.has(node.id)) return;
    const position = positionById.get(node.id) ?? {
      x: 44 + (index % 3) * 250,
      y: 44 + Math.floor(index / 3) * 140,
    };
    const instance = moduleInstanceByNodeId.get(node.id);
    const parent = instance === undefined ? genie! : ensureGenieModuleSubmodel(genie!, model, instance);
    createGenieNode(parent, node.code, node.name, position.x, position.y);
  });
  return serializeXml(extensions);
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
  const rootAttributes = {
    version: "1.0",
    ...(model.xdslMetadata?.rootAttributes ?? {}),
    id: model.code,
  };
  const attributes = Object.entries(rootAttributes)
    .map(([name, value]) => `${name}="${escapeXml(value)}"`)
    .join(" ");
  const extensions = synchronizedExtensions(model)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<smile ${attributes}>`,
    "  <nodes>",
    ...nodes,
    "  </nodes>",
    extensions,
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
  const extensionsElement = childElements(root, "extensions")[0];
  const extensionNodeByCode = new Map<string, Element>();
  if (extensionsElement !== undefined) {
    descendantElements(extensionsElement, "node").forEach((element) => {
      const id = element.getAttribute("id")?.trim();
      if (id !== undefined && id !== "" && !extensionNodeByCode.has(id)) extensionNodeByCode.set(id, element);
    });
  }
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
    const extensionNode = extensionNodeByCode.get(code);
    return {
      id: newId(),
      kind: "CHANCE_NODE",
      code,
      name: directText(extensionNode ?? element, "name") ?? code,
      description: directText(extensionNode ?? element, "comment") ?? "",
      states: states as BayesianNetworkNode["states"],
    };
  });
  const nodeByCode = new Map(nodes.map((node) => [node.code, node]));
  const importedPositions = nodes.map((node, index) => ({
    nodeId: node.id,
    position: parseGeniePosition(extensionNodeByCode.get(node.code)) ?? {
      x: 44 + (index % 3) * 250,
      y: 44 + Math.floor(index / 3) * 140,
    },
  }));
  const hasGeniePositions = nodes.some((node) => parseGeniePosition(extensionNodeByCode.get(node.code)) !== undefined);
  let model: BayesianNetworkModel = {
    ...(current ?? createEmptyBayesianNetwork(root.getAttribute("id") ?? "Imported Bayesian network")),
    code: root.getAttribute("id")?.trim() || current?.code || "BN-IMPORTED",
    nodes,
    edges: [],
    conditionalProbabilityTables: [],
    nodePositions: importedPositions,
    layout: {
      ...(current ?? createEmptyBayesianNetwork()).layout,
      mode: hasGeniePositions ? "MANUAL" : (current?.layout.mode ?? "AUTOMATIC"),
    },
    xdslMetadata: {
      rootAttributes: Object.fromEntries(
        [...root.attributes].map((attribute) => [attribute.name, attribute.value]),
      ),
      ...(extensionsElement === undefined ? {} : { extensionsXml: serializeXml(extensionsElement) }),
      nodeIdentifiers: nodes.map((node) => ({ nodeId: node.id, sourceId: node.code })),
    },
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
