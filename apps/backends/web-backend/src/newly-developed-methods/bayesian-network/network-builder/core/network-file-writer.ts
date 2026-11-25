import { valueError } from "./errors";
import { cpdMap, nodeMap } from "./network-model";
import type { NetworkModel, NetworkNode } from "./network-model";
import {
  collapseUnderscores,
  compareText,
  formatGeneral,
  getValueOr,
  isIdentifier,
  replaceNonIdentifierRuns,
  sortedText,
  startsWithIdentifierStart,
  strip,
  stripCharacters,
  text,
  titleCase,
} from "./spec-values";

interface NetworkFileOptions {
  includeLayout: boolean;
  includeSubmodels: boolean;
  generatedAt: Date;
}

interface XmlElement {
  tag: string;
  attributes: [string, string][];
  content: string | null;
  children: XmlElement[];
}

type Rectangle = [number, number, number, number];

interface ColorStyle {
  interior: string;
  outline: string;
  font: string;
}

const element = (tag: string, attributes: [string, string][] = [], content: string | null = null): XmlElement => ({
  tag,
  attributes,
  content,
  children: [],
});

const append = (
  parent: XmlElement,
  tag: string,
  attributes: [string, string][] = [],
  content: string | null = null,
): XmlElement => {
  const child = element(tag, attributes, content);
  parent.children.push(child);
  return child;
};

const escapeContent = (source: string): string =>
  source.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;");

const escapeAttribute = (source: string): string =>
  escapeContent(source)
    .split('"')
    .join("&quot;")
    .split("\r")
    .join("&#13;")
    .split("\n")
    .join("&#10;")
    .split("\t")
    .join("&#09;");

const serialize = (node: XmlElement, level: number, parts: string[]): void => {
  const attributes = node.attributes.map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`).join("");
  if (node.children.length === 0) {
    if (node.content === null || node.content.length === 0) {
      parts.push(`<${node.tag}${attributes} />`);
      return;
    }
    parts.push(`<${node.tag}${attributes}>${escapeContent(node.content)}</${node.tag}>`);
    return;
  }
  const childIndent = `\n${"  ".repeat(level + 1)}`;
  const closingIndent = `\n${"  ".repeat(level)}`;
  parts.push(`<${node.tag}${attributes}>`);
  parts.push(node.content !== null && strip(node.content).length > 0 ? escapeContent(node.content) : childIndent);
  node.children.forEach((child, index) => {
    serialize(child, level + 1, parts);
    parts.push(index === node.children.length - 1 ? closingIndent : childIndent);
  });
  parts.push(`</${node.tag}>`);
};

const formatProbabilities = (values: readonly number[]): string =>
  values.map((value) => formatGeneral(value, 17)).join(" ");

const sanitizeStateId = (rawState: string, usedIds: Set<string>): string => {
  let token = stripCharacters(collapseUnderscores(replaceNonIdentifierRuns(strip(rawState), "_")), "_");
  if (token.length === 0) token = "state";
  if (!startsWithIdentifierStart(token)) token = `S_${token}`;
  let output = token;
  let suffix = 2;
  while (usedIds.has(output)) {
    output = `${token}_${suffix}`;
    suffix += 1;
  }
  usedIds.add(output);
  return output;
};

const requiresStateNormalization = (rawState: string): boolean => !isIdentifier(strip(rawState));

const normalizeStateIds = (states: readonly string[]): string[] => {
  const normalizeAll = states.some((state) => requiresStateNormalization(state));
  const usedStateIds = new Set<string>();
  const output: string[] = [];
  for (const rawState of states) {
    let stateId = sanitizeStateId(rawState, new Set<string>());
    if (normalizeAll && stateId !== "False" && stateId !== "True" && stateId !== "None") {
      if (!stateId.startsWith("S_")) stateId = `S_${stateId}`;
    }
    let uniqueStateId = stateId;
    let suffix = 2;
    while (usedStateIds.has(uniqueStateId)) {
      uniqueStateId = `${stateId}_${suffix}`;
      suffix += 1;
    }
    usedStateIds.add(uniqueStateId);
    output.push(uniqueStateId);
  }
  return output;
};

const metadataText = (node: NetworkNode, key: string): string => strip(text(getValueOr(node.metadata, key, "")));

const inferDomain = (node: NetworkNode): string => {
  const builder = metadataText(node, "builder").toLowerCase();
  const key = metadataText(node, "canonical_key").toLowerCase();
  if (builder === "seismic") return "seismic";
  if (builder === "flood" || builder === "flood_buildings") return "flood";
  if (builder === "internal_flood") return "internal_flood";
  if (builder === "fire") return "fire";
  if (builder === "flex") return "flex";
  if (builder === "hra") return "hra";
  if (key.startsWith("hazard.seismic.") || key.startsWith("seismic.")) return "seismic";
  if (key.startsWith("hazard.flood.") || key.startsWith("flood.")) return "flood";
  if (key.startsWith("internal_flood.")) return "internal_flood";
  if (key.startsWith("fire.")) return "fire";
  if (key.startsWith("flex.")) return "flex";
  if (key.startsWith("hra.")) return "hra";
  return "default";
};

const inferFlexComponentGroup = (node: NetworkNode): string => {
  const explicit = metadataText(node, "component_group").toLowerCase();
  if (explicit.length > 0) return explicit;
  const joined = ["canonical_key", "strategy_id", "equipment_id", "hookup_id", "hfe_id", "context_id"]
    .map((key) => metadataText(node, key).toLowerCase())
    .filter((token) => token.length > 0)
    .join(" ");
  if (joined.includes("pump")) return "pump";
  if (joined.includes("dg") || joined.includes("diesel") || joined.includes("generator")) return "dg";
  return "";
};

const domainStyle = (node: NetworkNode): ColorStyle => {
  const domain = inferDomain(node);
  if (domain === "seismic") return { interior: "e2e8f0", outline: "334155", font: "000000" };
  if (domain === "flood") return { interior: "dbeafe", outline: "1d4ed8", font: "000000" };
  if (domain === "internal_flood") return { interior: "cffafe", outline: "0e7490", font: "000000" };
  if (domain === "fire") return { interior: "fee2e2", outline: "b91c1c", font: "000000" };
  if (domain === "flex") {
    if (inferFlexComponentGroup(node) === "pump") return { interior: "e0f2fe", outline: "0369a1", font: "000000" };
    return { interior: "dcfce7", outline: "15803d", font: "000000" };
  }
  if (domain === "hra") return { interior: "fef3c7", outline: "92400e", font: "000000" };
  return { interior: "e5f6f7", outline: "000080", font: "000000" };
};

const sanitizeTokenForId = (raw: string, fallback = "X"): string => {
  let token = stripCharacters(collapseUnderscores(replaceNonIdentifierRuns(strip(raw), "_")), "_");
  if (token.length === 0) token = fallback;
  if (!startsWithIdentifierStart(token)) token = `N_${token}`;
  return token;
};

const layoutIconRectangles = (
  count: number,
  width: number,
  height: number,
  startX: number,
  startY: number,
  maxColumns: number,
  gapX: number,
  gapY: number,
): Rectangle[] => {
  const rectangles: Rectangle[] = [];
  const columns = Math.max(1, Math.trunc(maxColumns));
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x1 = startX + column * (width + gapX);
    const y1 = startY + row * (height + gapY);
    rectangles.push([x1, y1, x1 + width, y1 + height]);
  }
  return rectangles;
};

const layerBucket = (node: NetworkNode): string | null => {
  const builder = metadataText(node, "builder").toLowerCase();
  if (builder === "seismic") return "SEISMIC";
  if (builder === "flood" || builder === "flood_buildings") return "FLOOD";
  if (builder === "internal_flood") return "INTERNAL_FLOOD";
  if (builder === "fire") return "FIRE";
  if (builder === "flex") return "FLEX";
  if (builder === "recovery") return "RECOVERY";
  if (builder === "hra") return "HRA";
  return null;
};

const isGlobalHazardNode = (node: NetworkNode): boolean => {
  const kind = metadataText(node, "kind").toLowerCase();
  const key = metadataText(node, "canonical_key").toLowerCase();
  if (kind === "hazard_im" || kind === "hazard_wave") return true;
  if (key === "hazard.seismic.pga" || key === "hazard.flood.wave_height") return true;
  return key.startsWith("hazard.");
};

const layerSubmodelStyle = (layer: string): [string, string] => {
  if (layer === "SEISMIC") return ["e2e8f0", "334155"];
  if (layer === "FLOOD") return ["dbeafe", "1d4ed8"];
  if (layer === "INTERNAL_FLOOD") return ["cffafe", "0e7490"];
  if (layer === "FIRE") return ["fee2e2", "b91c1c"];
  if (layer === "FLEX") return ["dcfce7", "15803d"];
  if (layer === "RECOVERY") return ["e0f2fe", "0369a1"];
  if (layer === "HRA") return ["fffbeb", "92400e"];
  return ["e5f6f7", "000080"];
};

const rectangleText = (rectangle: Rectangle): string => rectangle.join(" ");

const addNodeMetadata = (parent: XmlElement, node: NetworkNode, rectangle: Rectangle): XmlElement => {
  const style = domainStyle(node);
  const displayName = metadataText(node, "display_name");
  const nodeElement = append(parent, "node", [["id", node.nodeId]]);
  append(nodeElement, "name", [], displayName.length > 0 ? displayName : node.nodeId);
  append(nodeElement, "interior", [["color", style.interior]]);
  append(nodeElement, "outline", [["color", style.outline]]);
  append(nodeElement, "font", [
    ["color", style.font],
    ["name", "Arial"],
    ["size", "10"],
  ]);
  append(nodeElement, "position", [], rectangleText(rectangle));
  return nodeElement;
};

const addSubmodel = (
  parent: XmlElement,
  submodelId: string,
  name: string,
  rectangle: Rectangle,
  interior: string,
  outline: string,
): XmlElement => {
  const submodel = append(parent, "submodel", [["id", submodelId]]);
  append(submodel, "name", [], name);
  append(submodel, "interior", [["color", interior]]);
  append(submodel, "outline", [["color", outline]]);
  append(submodel, "font", [
    ["color", "000000"],
    ["name", "Arial"],
    ["size", "10"],
  ]);
  append(submodel, "position", [], rectangleText(rectangle));
  return submodel;
};

const LAYER_ORDER = ["SEISMIC", "FLOOD", "INTERNAL_FLOOD", "FIRE", "FLEX", "RECOVERY", "HRA"];

const emitLayoutNodes = (
  layout: XmlElement,
  model: NetworkModel,
  orderedNodeIds: readonly string[],
  rectangles: Map<string, Rectangle>,
  includeSubmodels: boolean,
): void => {
  const nodes = nodeMap(model);
  const emit = (parent: XmlElement, nodeId: string): void => {
    const node = nodes.get(nodeId);
    const rectangle = rectangles.get(nodeId);
    if (node !== undefined && rectangle !== undefined) addNodeMetadata(parent, node, rectangle);
  };
  if (!includeSubmodels) {
    for (const nodeId of orderedNodeIds) emit(layout, nodeId);
    return;
  }
  const outsideNodeIds: string[] = [];
  const layerNodes = new Map<string, string[]>();
  const unscopedHumanNodeIds: string[] = [];
  const humanNodesByEvent = new Map<string, string[]>();
  const eventOrder: string[] = [];
  for (const nodeId of orderedNodeIds) {
    const node = nodes.get(nodeId);
    if (node === undefined) continue;
    const kind = metadataText(node, "kind").toLowerCase();
    const key = metadataText(node, "canonical_key").toLowerCase();
    if (isGlobalHazardNode(node)) {
      outsideNodeIds.push(nodeId);
      continue;
    }
    const layer = layerBucket(node);
    if (layer === null) {
      outsideNodeIds.push(nodeId);
      continue;
    }
    if (layer !== "HRA") {
      const members = layerNodes.get(layer);
      if (members === undefined) layerNodes.set(layer, [nodeId]);
      else members.push(nodeId);
      continue;
    }
    if (kind === "hazard_context_shared" || key.startsWith("hra.context.")) {
      outsideNodeIds.push(nodeId);
      continue;
    }
    let eventId = metadataText(node, "hfe_id");
    if (eventId.length === 0) {
      const rawKey = metadataText(node, "canonical_key");
      if (rawKey.startsWith("hra.hfe.")) {
        const parts = rawKey.split(".");
        if (parts.length >= 3) eventId = parts[2];
      }
    }
    if (eventId.length === 0) {
      unscopedHumanNodeIds.push(nodeId);
      continue;
    }
    const members = humanNodesByEvent.get(eventId);
    if (members === undefined) {
      humanNodesByEvent.set(eventId, [nodeId]);
      eventOrder.push(eventId);
    } else members.push(nodeId);
  }
  for (const nodeId of outsideNodeIds) emit(layout, nodeId);

  const presentLayers: string[] = [];
  for (const layer of LAYER_ORDER) {
    if (layer === "HRA") {
      if (unscopedHumanNodeIds.length > 0 || eventOrder.length > 0) presentLayers.push(layer);
    } else if ((layerNodes.get(layer) ?? []).length > 0) presentLayers.push(layer);
  }
  for (const layer of sortedText(Array.from(layerNodes.keys()).filter((name) => !LAYER_ORDER.includes(name)))) {
    if ((layerNodes.get(layer) ?? []).length > 0) presentLayers.push(layer);
  }
  if (presentLayers.length === 0) return;

  const layerRectangles = layoutIconRectangles(presentLayers.length, 210, 74, 24, 24, 4, 18, 14);
  presentLayers.forEach((layer, layerIndex) => {
    const [interior, outline] = layerSubmodelStyle(layer);
    const parentSubmodel = addSubmodel(
      layout,
      layer === "HRA" ? "SUBMODEL_HRA" : `SUBMODEL_${layer}`,
      titleCase(layer),
      layerRectangles[layerIndex],
      interior,
      outline,
    );
    if (layer !== "HRA") {
      for (const nodeId of layerNodes.get(layer) ?? []) emit(parentSubmodel, nodeId);
      return;
    }
    for (const nodeId of unscopedHumanNodeIds) emit(parentSubmodel, nodeId);
    if (eventOrder.length === 0) return;
    const childRectangles = layoutIconRectangles(eventOrder.length, 168, 62, 16, 52, 2, 12, 10);
    eventOrder.forEach((eventId, eventIndex) => {
      const child = addSubmodel(
        parentSubmodel,
        `SUBMODEL_HRA_${sanitizeTokenForId(eventId).toUpperCase()}`,
        `HFE_${eventId}`,
        childRectangles[eventIndex],
        "fef3c7",
        "92400e",
      );
      for (const nodeId of humanNodesByEvent.get(eventId) ?? []) emit(child, nodeId);
    });
  });
};

const topologicalNodeOrder = (model: NetworkModel): string[] => {
  const nodeIds = model.nodes.map((node) => node.nodeId);
  const known = new Set(nodeIds);
  const indegree = new Map<string, number>(nodeIds.map((nodeId) => [nodeId, 0]));
  const children = new Map<string, string[]>();
  for (const edge of model.edges) {
    if (!known.has(edge.parent) || !known.has(edge.child)) continue;
    const members = children.get(edge.parent);
    if (members === undefined) children.set(edge.parent, [edge.child]);
    else members.push(edge.child);
    indegree.set(edge.child, (indegree.get(edge.child) ?? 0) + 1);
  }
  const available = nodeIds.filter((nodeId) => indegree.get(nodeId) === 0).sort(compareText);
  const output: string[] = [];
  while (available.length > 0) {
    const current = available.shift();
    if (current === undefined) break;
    output.push(current);
    for (const child of sortedText(children.get(current) ?? [])) {
      const degree = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, degree);
      if (degree === 0) {
        let position = 0;
        while (position < available.length && compareText(available[position], child) <= 0) position += 1;
        available.splice(position, 0, child);
      }
    }
  }
  if (output.length !== nodeIds.length) return nodeIds;
  return output;
};

const nodeWidth = (nodeId: string): number => Math.max(120, Math.min(72 + 7 * Array.from(nodeId).length, 320));

const layoutRectangles = (model: NetworkModel, orderedNodeIds: readonly string[]): Map<string, Rectangle> => {
  const known = new Set(orderedNodeIds);
  const parentsByChild = new Map<string, string[]>(orderedNodeIds.map((nodeId) => [nodeId, []]));
  for (const edge of model.edges) {
    if (known.has(edge.parent) && known.has(edge.child)) parentsByChild.get(edge.child)?.push(edge.parent);
  }
  const depthByNode = new Map<string, number>();
  for (const nodeId of orderedNodeIds) {
    const parents = parentsByChild.get(nodeId) ?? [];
    if (parents.length === 0) depthByNode.set(nodeId, 0);
    else depthByNode.set(nodeId, Math.max(...parents.map((parent) => depthByNode.get(parent) ?? 0)) + 1);
  }
  const layers = new Map<number, string[]>();
  const maxWidthByDepth = new Map<number, number>();
  for (const nodeId of orderedNodeIds) {
    const depth = depthByNode.get(nodeId) ?? 0;
    const members = layers.get(depth);
    if (members === undefined) layers.set(depth, [nodeId]);
    else members.push(nodeId);
    const width = nodeWidth(nodeId);
    if (width > (maxWidthByDepth.get(depth) ?? 120)) maxWidthByDepth.set(depth, width);
  }
  const depths = Array.from(layers.keys()).sort((left, right) => left - right);
  const startByDepth = new Map<number, number>();
  let currentX = 40;
  for (const depth of depths) {
    startByDepth.set(depth, currentX);
    currentX += (maxWidthByDepth.get(depth) ?? 120) + 90;
  }
  const rectangles = new Map<string, Rectangle>();
  for (const depth of depths) {
    sortedText(layers.get(depth) ?? []).forEach((nodeId, rowIndex) => {
      const x1 = startByDepth.get(depth) ?? 40;
      const y1 = 40 + rowIndex * (52 + 34);
      rectangles.set(nodeId, [x1, y1, x1 + nodeWidth(nodeId), y1 + 52]);
    });
  }
  return rectangles;
};

const timestampText = (moment: Date): string => `${moment.toISOString().slice(0, 19)}+00:00`;

const writeNetworkFile = (model: NetworkModel, options: NetworkFileOptions): string => {
  if (options.includeSubmodels && !options.includeLayout) {
    throw valueError("include_genie_submodels=True requires include_genie_extension=True.");
  }
  const cpds = cpdMap(model);
  const nodes = nodeMap(model);
  const orderedNodeIds = topologicalNodeOrder(model);
  const root = element("smile", [
    ["version", "1.0"],
    ["id", model.modelId],
    ["numsamples", "1000"],
    ["discsamples", "1000"],
  ]);
  const nodesElement = append(root, "nodes");
  for (const nodeId of orderedNodeIds) {
    const node = nodes.get(nodeId);
    const cpd = cpds.get(nodeId);
    if (node === undefined || cpd === undefined) continue;
    if (node.kind !== "chance_cpt") {
      throw valueError(`Unsupported node kind '${node.kind}' for Step 0 XDSL export.`);
    }
    const cptElement = append(nodesElement, "cpt", [["id", node.nodeId]]);
    for (const stateId of normalizeStateIds(node.states)) append(cptElement, "state", [["id", stateId]]);
    if (cpd.parents.length > 0) append(cptElement, "parents", [], cpd.parents.join(" "));
    append(cptElement, "probabilities", [], formatProbabilities(cpd.table));
  }
  if (options.includeLayout) {
    const extensions = append(root, "extensions");
    const layout = append(extensions, "genie", [
      ["version", "1.0"],
      ["app", "Network Builder"],
      ["name", model.modelId],
    ]);
    append(layout, "comment", [], `Generated by the network builder at ${timestampText(options.generatedAt)}`);
    emitLayoutNodes(layout, model, orderedNodeIds, layoutRectangles(model, orderedNodeIds), options.includeSubmodels);
  }
  const parts: string[] = ["<?xml version='1.0' encoding='UTF-8'?>\n"];
  serialize(root, 0, parts);
  return parts.join("");
};

export type { NetworkFileOptions };
export { writeNetworkFile };
