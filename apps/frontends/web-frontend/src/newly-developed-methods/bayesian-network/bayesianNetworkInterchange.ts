import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { numberText, stringifyJson } from "interfaces-shared-types/json";
import { fromCanonicalBayesianNetwork, toCanonicalBayesianNetwork, validateInterchangeModel } from "./bayesianNetworkCanonical";

function serializeXml(element: Element): string {
  return new XMLSerializer().serializeToString(element);
}

function descendantElements(parent: Element, tagName: string): Element[] {
  return [...parent.getElementsByTagName("*")]
    .filter((child) => child.localName === tagName);
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
    child = parent.ownerDocument.createElementNS(parent.namespaceURI, tagName);
    parent.appendChild(child);
  }
  child.textContent = value;
  return child;
}

function createGenieNode(parent: Element, code: string, name: string, description: string, x: number, y: number): Element {
  const document = parent.ownerDocument;
  const node = document.createElement("node");
  node.setAttribute("id", code);
  ensureTextChild(node, "name", name);
  if (description !== "") ensureTextChild(node, "comment", description);
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
    (submodel) => isGenieElement(submodel, genie.namespaceURI) && submodel.getAttribute("id") === instance.code,
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

function parseExtensions(source: string): XMLDocument {
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.querySelector("parsererror") !== null || document.documentElement.localName !== "extensions") {
    throw new Error("The preserved XDSL extensions are not valid XML.");
  }
  return document;
}

function synchronizedExtensions(model: BayesianNetworkModel): string {
  const source = model.xdslMetadata?.extensionsXml
    ?? '<extensions/>';
  const document = parseExtensions(source);
  const extensions = document.documentElement;
  let genie = childElements(extensions, "genie")[0];
  if (genie === undefined) {
    genie = document.createElement("genie");
    genie.setAttribute("version", "1.0");
    genie.setAttribute("app", "OpenPRA");
    extensions.appendChild(genie);
  }

  genie.setAttribute("name", model.name);
  if (model.description !== "" || childElements(genie, "comment").length > 0) ensureTextChild(genie, "comment", model.description);

  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const idByCode = new Map(model.nodes.map((node) => [node.code, node.id]));
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

  genieNodes(genie).forEach((extensionNode) => {
    const sourceId = extensionNode.getAttribute("id")?.trim() ?? "";
    const internalId = internalIdBySourceId.get(sourceId)
      ?? idByCode.get(sourceId);
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
    createGenieNode(parent, node.code, node.name, node.description, position.x, position.y);
  });
  return serializeXml(extensions);
}

// Only GeNIe node/submodel records belong to the editor; vendor <node> data is opaque.
function isGenieElement(element: Element, namespace: string | null): boolean {
  return element.namespaceURI === null || element.namespaceURI === namespace;
}

function genieNodes(parent: Element, namespace: string | null = parent.namespaceURI): Element[] {
  return [
    ...childElements(parent, "node").filter((node) => isGenieElement(node, namespace)),
    ...childElements(parent, "submodel").filter((group) => isGenieElement(group, namespace))
      .flatMap((group) => genieNodes(group, namespace)),
  ];
}

function childElements(parent: Element, tagName: string): Element[] {
  return [...parent.children].filter((child) => child.localName === tagName);
}

/** Remove only known GeNIe records; keep unrelated vendor extensions. */
function removeBayesianNetworkXdslNodes(
  model: BayesianNetworkModel,
  removedNodeIds: ReadonlySet<string>,
  removedSubmodelIds: ReadonlySet<string>,
): BayesianNetworkModel["xdslMetadata"] {
  const metadata = model.xdslMetadata;
  if (metadata === undefined) return undefined;
  const sourceIds = new Set([
    ...metadata.nodeIdentifiers.filter((entry) => removedNodeIds.has(entry.nodeId)).map((entry) => entry.sourceId),
    ...model.nodes.filter((node) => removedNodeIds.has(node.id)).map((node) => node.code),
  ]);
  let extensionsXml = metadata.extensionsXml;
  if (extensionsXml !== undefined) {
    const document = parseExtensions(extensionsXml);
    const genie = childElements(document.documentElement, "genie")[0];
    if (genie !== undefined) {
      genieNodes(genie).filter((node) => sourceIds.has(node.getAttribute("id")?.trim() ?? ""))
        .forEach((node) => node.remove());
      const pruneGroups = (parent: Element): void => {
        childElements(parent, "submodel").filter((group) => isGenieElement(group, genie.namespaceURI)).forEach((group) => {
          pruneGroups(group);
          if (removedSubmodelIds.has(group.getAttribute("id") ?? "") && [...group.children].every((child) =>
            isGenieElement(child, genie.namespaceURI) && ["name", "interior", "outline", "font", "position"].includes(child.localName),
          )) group.remove();
        });
      };
      pruneGroups(genie);
    }
    extensionsXml = serializeXml(document.documentElement);
  }
  return {
    ...metadata,
    ...(extensionsXml === undefined ? {} : { extensionsXml }),
    nodeIdentifiers: metadata.nodeIdentifiers.filter((entry) => !removedNodeIds.has(entry.nodeId)),
  };
}

function exportBayesianNetworkXdsl(model: BayesianNetworkModel): string {
  const canonical = toCanonicalBayesianNetwork(model);
  const document = new DOMParser().parseFromString("<smile/>", "application/xml");
  const root = document.documentElement;
  for (const [name, value] of Object.entries({ version: "1.0", ...model.xdslMetadata?.rootAttributes, id: model.code })) {
    root.setAttribute(name, value);
  }
  const nodes = document.createElement("nodes");
  root.appendChild(nodes);
  canonical.variables.forEach((variable) => {
    if (/\s/.test(variable.name)) throw new Error(`XDSL node id '${variable.name}' cannot contain whitespace.`);
    const cpt = document.createElement("cpt");
    cpt.setAttribute("id", variable.name);
    nodes.appendChild(cpt);
    variable.states.forEach((code) => {
      const state = document.createElement("state");
      state.setAttribute("id", code);
      cpt.appendChild(state);
    });
    if (variable.parents.length > 0) ensureTextChild(cpt, "parents", variable.parents.join(" "));
    ensureTextChild(cpt, "probabilities", variable.probabilities.map(numberText).join(" "));
  });
  const extensions = new DOMParser().parseFromString(synchronizedExtensions(model), "application/xml").documentElement;
  root.appendChild(document.importNode(extensions, true));
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + serializeXml(root);
}

function onlyChild(parent: Element, tagName: string, required = false): Element | undefined {
  const elements = childElements(parent, tagName);
  if (elements.length > 1) throw new Error(`XDSL contains duplicate <${tagName}> elements.`);
  if (required && elements.length === 0) throw new Error(`XDSL requires a <${tagName}> element.`);
  return elements[0];
}

function importBayesianNetworkXdsl(xml: string, current?: BayesianNetworkModel): BayesianNetworkModel {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror") !== null) throw new Error("The XDSL file is not valid XML.");
  const root = document.documentElement;
  if (root.localName !== "smile") throw new Error("The XDSL root element must be <smile>.");
  const nodesElement = onlyChild(root, "nodes", true)!;
  const unsupported = [...nodesElement.children].find((node) => node.localName !== "cpt");
  if (unsupported !== undefined) {
    throw new Error(`Unsupported XDSL node type '${unsupported.localName}'. Only discrete CPT nodes are supported.`);
  }
  const cptElements = childElements(nodesElement, "cpt");
  const model = fromCanonicalBayesianNetwork({
    id: root.getAttribute("id"),
    variables: cptElements.map((element) => {
      const code = element.getAttribute("id")?.trim() ?? "";
      if (code === "" || /\s/.test(code)) throw new Error("Every XDSL CPT node requires an id without whitespace.");
      const tokens = (onlyChild(element, "probabilities", true)!.textContent ?? "").trim().split(/\s+/).filter(Boolean);
      // Match Rust decimal float input; Number() would also accept hexadecimal.
      if (tokens.some((token) => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token))) {
        throw new Error(`XDSL node '${code}' contains an invalid probability.`);
      }
      return {
        name: code,
        states: childElements(element, "state").map((state) => state.getAttribute("id")?.trim() ?? ""),
        parents: (onlyChild(element, "parents")?.textContent ?? "").trim().split(/\s+/).filter(Boolean),
        probabilities: tokens.map(Number),
      };
    }),
  }, current);
  const extensions = onlyChild(root, "extensions");
  const genie = extensions === undefined ? undefined : onlyChild(extensions, "genie");
  const metadata = new Map((genie === undefined ? [] : genieNodes(genie)).map((node) => [node.getAttribute("id")?.trim(), node]));
  model.name = genie?.getAttribute("name")?.trim() || model.code;
  model.description = genie === undefined ? "" : directText(genie, "comment") ?? "";
  model.nodes = model.nodes.map((node, index) => {
    const extension = metadata.get(node.code);
    return {
      ...node,
      name: (extension === undefined ? undefined : directText(extension, "name")) ?? directText(cptElements[index]!, "name") ?? node.code,
      description: (extension === undefined ? undefined : directText(extension, "comment")) ?? directText(cptElements[index]!, "comment") ?? "",
    };
  });
  model.nodePositions = model.nodePositions.map((entry, index) => {
    const position = parseGeniePosition(metadata.get(model.nodes[index]!.code));
    if (position === undefined) return entry;
    model.layout.mode = "MANUAL";
    return { ...entry, position };
  });
  model.xdslMetadata = {
    rootAttributes: Object.fromEntries([...root.attributes].map((attribute) => [attribute.name, attribute.value])),
    ...(extensions === undefined ? {} : { extensionsXml: serializeXml(extensions) }),
    nodeIdentifiers: model.nodes.map((node) => ({ nodeId: node.id, sourceId: node.code })),
  };
  return validateInterchangeModel(model);
}

interface BayesianNetworkVisualSubmodel {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  nodeIds: string[];
  position?: { x: number; y: number };
}

function submodelDocument(model: BayesianNetworkModel) {
  const document = parseExtensions(synchronizedExtensions(model));
  const genie = childElements(document.documentElement, "genie")[0]!;
  const elements = new Map<string, Element>();
  const byCode = new Map(model.nodes.map((node) => [node.code, node.id]));
  const groups: BayesianNetworkVisualSubmodel[] = [];
  const membership = new Map<string, string>();
  function walk(parent: Element, parentId: string | null, parentPath: string, ancestors: string[] = []): void {
    childElements(parent, "submodel").filter((group) => isGenieElement(group, genie!.namespaceURI)).forEach((element, index) => {
      const name = directText(element, "name") ?? element.getAttribute("id") ?? "Submodel";
      const tokens = [...ancestors, `${index}:${element.getAttribute("id") ?? ""}`];
      const id = JSON.stringify(tokens);
      elements.set(id, element);
      const path = parentPath === "" ? name : `${parentPath} / ${name}`;
      const nodeIds = childElements(element, "node").filter((node) => isGenieElement(node, genie!.namespaceURI))
        .map((node) => byCode.get(node.getAttribute("id")?.trim() ?? ""))
        .filter((id): id is string => id !== undefined);
      groups.push({ id, name, path, parentId, nodeIds, position: parseGeniePosition(element) });
      nodeIds.forEach((nodeId) => membership.set(nodeId, id));
      walk(element, id, path, tokens);
    });
  }
  walk(genie, null, "");
  // Match the source's last-membership assignment when imported metadata repeats a node.
  return { document, genie, elements,
    groups: groups.map((group) => ({ ...group, nodeIds: [...new Set(group.nodeIds)].filter((id) => membership.get(id) === group.id) })),
  };
}

/** HCL_MH bn/model.py:163: read GeNIe hierarchy separately from BN calculation data. */
function readBayesianNetworkSubmodels(model: BayesianNetworkModel): BayesianNetworkVisualSubmodel[] {
  return submodelDocument(model).groups;
}

function withSubmodelDocument(model: BayesianNetworkModel, document: XMLDocument): BayesianNetworkModel {
  return { ...model, xdslMetadata: {
    rootAttributes: model.xdslMetadata?.rootAttributes ?? {},
    extensionsXml: serializeXml(document.documentElement),
    // Synchronization has rewritten the XML identifiers to the current node codes.
    nodeIdentifiers: model.nodes.map((node) => ({ nodeId: node.id, sourceId: node.code })),
  } };
}

function requireSubmodel(elements: Map<string, Element>, id: string): Element {
  const group = elements.get(id);
  if (group === undefined) throw new Error("That group no longer exists.");
  return group;
}

function moveSubmodelNodes(model: BayesianNetworkModel, genie: Element, target: Element, nodeIds: string[]): void {
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
  const codes = new Set(nodeIds.map((id) => {
    const node = nodesById.get(id);
    if (node === undefined) throw new Error("A selected node no longer exists.");
    return node.code;
  }));
  // Keep the source's last membership and preserve each node's presentation data.
  const records = new Map<string, Element>();
  for (const node of genieNodes(genie)) {
    const code = node.getAttribute("id") ?? "";
    if (!codes.has(code)) continue;
    records.get(code)?.remove();
    records.set(code, node);
  }
  records.forEach((node) => target.appendChild(node));
}

/** Visual grouping edits only GeNIe extensions; node identities, edges and CPTs stay intact. */
function assignBayesianNetworkNodesToSubmodel(model: BayesianNetworkModel, nodeIds: string[], groupId: string | null): BayesianNetworkModel {
  const { document, genie, elements } = submodelDocument(model);
  moveSubmodelNodes(model, genie, groupId === null ? genie : requireSubmodel(elements, groupId), nodeIds);
  return withSubmodelDocument(model, document);
}

function saveBayesianNetworkSubmodel(model: BayesianNetworkModel, draft: {
  id?: string; name: string; parentId: string | null; nodeIds: string[];
}): BayesianNetworkModel {
  const { document, genie, elements, groups } = submodelDocument(model);
  const name = draft.name.trim();
  if (name === "") throw new Error("Group name is required.");
  const parent = draft.parentId === null ? genie : requireSubmodel(elements, draft.parentId);
  const group = draft.id === undefined ? document.createElementNS(genie.namespaceURI, "submodel") : requireSubmodel(elements, draft.id);
  if (group === parent || group.contains(parent)) throw new Error("A group cannot be placed inside itself or its descendants.");
  if (groups.some((entry) => entry.id !== draft.id && entry.parentId === draft.parentId && entry.name === name)) {
    throw new Error("A group with that name already exists at this level.");
  }
  if (draft.id === undefined) group.setAttribute("id", `group_${crypto.randomUUID().replace(/-/g, "")}`);
  ensureTextChild(group, "name", name);
  // Unchecked direct members return to the group's parent. Nested groups stay intact.
  const previous = groups.find((entry) => entry.id === draft.id);
  moveSubmodelNodes(model, genie, parent, previous?.nodeIds.filter((id) => !draft.nodeIds.includes(id)) ?? []);
  if (group.parentElement !== parent) parent.appendChild(group);
  moveSubmodelNodes(model, genie, group, draft.nodeIds);
  return withSubmodelDocument(model, document);
}

function removeBayesianNetworkSubmodel(model: BayesianNetworkModel, groupId: string): BayesianNetworkModel {
  const { document, elements } = submodelDocument(model);
  const group = requireSubmodel(elements, groupId);
  const parent = group.parentElement!;
  // Dissolve the group, retaining nodes, nested groups and opaque vendor extensions.
  for (const child of [...group.children]) {
    if (!isGenieElement(child, group.namespaceURI) || !["name", "position", "interior", "outline", "font"].includes(child.localName)) parent.appendChild(child);
  }
  group.remove();
  return withSubmodelDocument(model, document);
}

function positionBayesianNetworkSubmodels(model: BayesianNetworkModel, positions: ReadonlyMap<string, { x: number; y: number }>): BayesianNetworkModel {
  const { document, elements } = submodelDocument(model);
  positions.forEach(({ x, y }, id) => ensureTextChild(requireSubmodel(elements, id), "position", [x, y, x + 180, y + 84].map(formatCoordinate).join(" ")));
  return withSubmodelDocument(model, document);
}

function exportBayesianNetworkJson(model: BayesianNetworkModel): string {
  return stringifyJson(validateInterchangeModel(model), 2)!;
}

function exportCanonicalBayesianNetworkJson(model: BayesianNetworkModel): string {
  return stringifyJson(toCanonicalBayesianNetwork(model), 2)!;
}

function importBayesianNetworkJson(json: string, current?: BayesianNetworkModel): BayesianNetworkModel {
  const input: unknown = JSON.parse(json);
  if (input !== null && typeof input === "object" && "variables" in input) {
    return fromCanonicalBayesianNetwork(input, current);
  }
  return validateInterchangeModel(input);
}

export {
  assignBayesianNetworkNodesToSubmodel,
  saveBayesianNetworkSubmodel,
  removeBayesianNetworkSubmodel,
  positionBayesianNetworkSubmodels,
  removeBayesianNetworkXdslNodes,
  readBayesianNetworkSubmodels,
  exportBayesianNetworkJson,
  exportCanonicalBayesianNetworkJson,
  exportBayesianNetworkXdsl,
  importBayesianNetworkJson,
  importBayesianNetworkXdsl,
};

export type { BayesianNetworkVisualSubmodel };
