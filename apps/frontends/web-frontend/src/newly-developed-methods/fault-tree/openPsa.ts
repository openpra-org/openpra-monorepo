import type {
  FaultTreeBasicEvent,
  FaultTreeGate,
  FaultTreeGateInput,
  FaultTreeLeafNode,
  FaultTreeNodePosition,
} from "interfaces-mef-types/modeling";
import {
  FaultTreeBasicEventCatalogueDefinitionSchema,
  FaultTreeModelSchema,
} from "interfaces-shared-types/newly-developed-methods/fault-tree";
import type {
  FaultTreeBasicEventPresentation,
  FaultTreeEditorCatalogue,
  FaultTreeEditorModel,
} from "./faultTreeTypes";

const EDITOR_SNAPSHOT_ATTRIBUTE = "openpra.editor-snapshot";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OpenPsaImportErrorCode =
  | "INVALID_XML"
  | "FAULT_TREE_NOT_FOUND"
  | "INVALID_EDITOR_SNAPSHOT"
  | "INVALID_MODEL"
  | "DUPLICATE_DEFINITION"
  | "UNSUPPORTED_FORMULA"
  | "UNRESOLVED_REFERENCE";

type OpenPsaExportErrorCode = "INVALID_MODEL" | "UNRESOLVED_REFERENCE" | "UNSUPPORTED_MODEL";

class OpenPsaImportError extends Error {
  readonly code: OpenPsaImportErrorCode;

  constructor(code: OpenPsaImportErrorCode, message: string) {
    super(message);
    this.name = "OpenPsaImportError";
    this.code = code;
  }
}

class OpenPsaExportError extends Error {
  readonly code: OpenPsaExportErrorCode;

  constructor(code: OpenPsaExportErrorCode, message: string) {
    super(message);
    this.name = "OpenPsaExportError";
    this.code = code;
  }
}

interface OpenPsaFaultTreeImport {
  model: FaultTreeEditorModel;
  catalogue: FaultTreeEditorCatalogue;
  warnings: string[];
}

interface OpenPsaExportOptions {
  includeEditorSnapshot?: boolean;
}

interface EditorSnapshot {
  schemaVersion: "1.0.0";
  model: FaultTreeEditorModel;
  catalogue: FaultTreeEditorCatalogue;
}

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/\r/g, "&#13;")
    .replace(/\n/g, "&#10;")
    .replace(/\t/g, "&#9;");
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function indentBlock(value: string, indentation: string): string {
  return value
    .split("\n")
    .map((line) => `${indentation}${line}`)
    .join("\n");
}

function metadataXml(values: Record<string, string | number | boolean | undefined>): string {
  const attributes = Object.entries(values).filter((entry): entry is [string, string | number | boolean] =>
    entry[1] !== undefined,
  );
  if (attributes.length === 0) return "";
  return [
    "<attributes>",
    ...attributes.map(
      ([name, value]) =>
        `  <attribute name="${escapeXmlAttribute(name)}" value="${escapeXmlAttribute(String(value))}"/>`,
    ),
    "</attributes>",
  ].join("\n");
}

function standardIdentifier(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const candidate = normalized === "" ? fallback : normalized;
  return /^[A-Za-z_]/.test(candidate) ? candidate : `_${candidate}`;
}

function uniqueNames(entries: readonly { id: string; code?: string }[]): Map<string, string> {
  const result = new Map<string, string>();
  const used = new Set<string>();
  for (const entry of entries) {
    const base = standardIdentifier(entry.code ?? "", `entity-${entry.id}`);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) candidate = `${base}-${suffix++}`;
    used.add(candidate);
    result.set(entry.id, candidate);
  }
  return result;
}

function editorModelSnapshot(model: FaultTreeEditorModel): FaultTreeEditorModel {
  return {
    modelId: model.modelId,
    code: model.code,
    name: model.name,
    description: model.description,
    topGate: model.topGate === null ? null : { ...model.topGate },
    gates: model.gates.map((gate) => ({ ...gate })),
    leafNodes: model.leafNodes.map((leaf) =>
      leaf.kind === "TRANSFER_REFERENCE" ? { ...leaf, target: { ...leaf.target } } : { ...leaf },
    ),
    gateInputs: model.gateInputs.map((input) => ({ ...input })),
    nodePositions: model.nodePositions.map(({ nodeId, position }) => ({
      nodeId,
      position: { ...position },
    })),
    layout: { ...model.layout, viewport: { ...model.layout.viewport } },
  };
}

function editorCatalogueSnapshot(catalogue: FaultTreeEditorCatalogue): FaultTreeEditorCatalogue {
  return {
    basicEvents: catalogue.basicEvents.map((basicEvent) => ({
      ...basicEvent,
      probability: {
        ...basicEvent.probability,
        ...(basicEvent.probability.controlledDataSource === undefined
          ? {}
          : { controlledDataSource: { ...basicEvent.probability.controlledDataSource } }),
      },
    })),
    ...(catalogue.presentations === undefined
      ? {}
      : { presentations: catalogue.presentations.map((presentation) => ({ ...presentation })) }),
  };
}

function mergeOpenPsaImportCatalogue(
  current: FaultTreeEditorCatalogue,
  imported: FaultTreeEditorCatalogue,
): FaultTreeEditorCatalogue {
  const importedEvents = new Map(imported.basicEvents.map((event) => [event.id, event]));
  const currentIds = new Set(current.basicEvents.map((event) => event.id));
  const basicEvents = [
    ...current.basicEvents.map((event) => importedEvents.get(event.id) ?? event),
    ...imported.basicEvents.filter((event) => !currentIds.has(event.id)),
  ];

  const currentPresentations = current.presentations ?? [];
  const importedPresentations = new Map(
    (imported.presentations ?? []).map((presentation) => [presentation.basicEventId, presentation]),
  );
  const currentPresentationIds = new Set(
    currentPresentations.map((presentation) => presentation.basicEventId),
  );
  const presentations = [
    ...currentPresentations.map(
      (presentation) => importedPresentations.get(presentation.basicEventId) ?? presentation,
    ),
    ...(imported.presentations ?? []).filter(
      (presentation) => !currentPresentationIds.has(presentation.basicEventId),
    ),
  ];

  return {
    basicEvents,
    ...(presentations.length === 0 ? {} : { presentations }),
  };
}

function assertExportable(
  model: FaultTreeEditorModel,
  catalogue: FaultTreeEditorCatalogue,
): { model: FaultTreeEditorModel; catalogue: FaultTreeEditorCatalogue } {
  const snapshotModel = editorModelSnapshot(model);
  const snapshotCatalogue = editorCatalogueSnapshot(catalogue);
  const modelResult = FaultTreeModelSchema.safeParse(snapshotModel);
  const catalogueResult = FaultTreeBasicEventCatalogueDefinitionSchema.safeParse({
    basicEvents: snapshotCatalogue.basicEvents,
  });
  if (!modelResult.success || !catalogueResult.success) {
    const messages = [
      ...(modelResult.success ? [] : modelResult.error.issues.map(({ message }) => message)),
      ...(catalogueResult.success ? [] : catalogueResult.error.issues.map(({ message }) => message)),
    ];
    throw new OpenPsaExportError("INVALID_MODEL", messages.join("; "));
  }
  return { model: snapshotModel, catalogue: snapshotCatalogue };
}

function entityMetadata(
  entity: { id: string; code: string; name: string; description: string },
  position?: FaultTreeNodePosition["position"],
): Record<string, string | number | undefined> {
  return {
    "openpra.id": entity.id,
    "openpra.code": entity.code,
    "openpra.name": entity.name,
    "openpra.description": entity.description,
    "openpra.position-x": position?.x,
    "openpra.position-y": position?.y,
  };
}

function exportOpenPsaFaultTree(
  inputModel: FaultTreeEditorModel,
  inputCatalogue: FaultTreeEditorCatalogue,
  options: OpenPsaExportOptions = {},
): string {
  const { model, catalogue } = assertExportable(inputModel, inputCatalogue);
  const allNamedEntities = [
    ...model.gates,
    ...model.leafNodes.filter(
      (leaf): leaf is Exclude<FaultTreeLeafNode, { kind: "BASIC_EVENT_REFERENCE" }> =>
        leaf.kind !== "BASIC_EVENT_REFERENCE",
    ),
    ...catalogue.basicEvents,
  ];
  const names = uniqueNames(allNamedEntities);
  const basicEvents = new Map(catalogue.basicEvents.map((basicEvent) => [basicEvent.id, basicEvent]));
  const gates = new Map(model.gates.map((gate) => [gate.id, gate]));
  const leaves = new Map(model.leafNodes.map((leaf) => [leaf.id, leaf]));
  const positions = new Map(model.nodePositions.map(({ nodeId, position }) => [nodeId, position]));
  const inputsByGate = new Map<string, FaultTreeGateInput[]>();
  for (const input of model.gateInputs) {
    const inputs = inputsByGate.get(input.gateId) ?? [];
    inputs.push(input);
    inputsByGate.set(input.gateId, inputs);
  }
  for (const inputs of inputsByGate.values()) {
    inputs.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  }

  const referenceXml = (input: FaultTreeGateInput): string => {
    const gate = gates.get(input.childId);
    if (gate !== undefined) {
      return `<gate name="${escapeXmlAttribute(names.get(gate.id) as string)}"/>`;
    }
    const leaf = leaves.get(input.childId);
    if (leaf === undefined) {
      throw new OpenPsaExportError(
        "UNRESOLVED_REFERENCE",
        `Gate input ${input.id} targets missing node ${input.childId}`,
      );
    }
    if (leaf.kind === "BASIC_EVENT_REFERENCE") {
      const basicEvent = basicEvents.get(leaf.basicEventId);
      if (basicEvent === undefined) {
        throw new OpenPsaExportError(
          "UNRESOLVED_REFERENCE",
          `Leaf ${leaf.id} targets missing basic event ${leaf.basicEventId}`,
        );
      }
      return `<basic-event name="${escapeXmlAttribute(names.get(basicEvent.id) as string)}"/>`;
    }
    const tag = leaf.kind === "HOUSE_EVENT" ? "house-event" : "basic-event";
    return `<${tag} name="${escapeXmlAttribute(names.get(leaf.id) as string)}"/>`;
  };

  const gateDefinitions = model.gates.map((gate) => {
    const inputs = inputsByGate.get(gate.id) ?? [];
    if (inputs.length === 0) {
      throw new OpenPsaExportError(
        "UNSUPPORTED_MODEL",
        `Gate ${gate.code} has no inputs and cannot be represented by OpenPSA MEF`,
      );
    }
    if (gate.gateType === "NOT" && inputs.length !== 1) {
      throw new OpenPsaExportError(
        "UNSUPPORTED_MODEL",
        `NOT gate ${gate.code} must have exactly one input`,
      );
    }
    const operator =
      gate.gateType === "K_OF_N" ? "atleast" : gate.gateType.toLocaleLowerCase("en-US");
    const operatorAttribute = gate.gateType === "K_OF_N" ? ` min="${gate.k}"` : "";
    const formula = [
      `<${operator}${operatorAttribute}>`,
      ...inputs.map((input) => `  ${referenceXml(input)}`),
      `</${operator}>`,
    ].join("\n");
    return [
      `<define-gate name="${escapeXmlAttribute(names.get(gate.id) as string)}">`,
      `  <label>${escapeXmlText(gate.name)}</label>`,
      indentBlock(metadataXml(entityMetadata(gate, positions.get(gate.id))), "  "),
      indentBlock(formula, "  "),
      "</define-gate>",
    ].join("\n");
  });

  const houseDefinitions = model.leafNodes
    .filter((leaf): leaf is Extract<FaultTreeLeafNode, { kind: "HOUSE_EVENT" }> =>
      leaf.kind === "HOUSE_EVENT",
    )
    .map((leaf) =>
      [
        `<define-house-event name="${escapeXmlAttribute(names.get(leaf.id) as string)}">`,
        `  <label>${escapeXmlText(leaf.name)}</label>`,
        indentBlock(metadataXml(entityMetadata(leaf, positions.get(leaf.id))), "  "),
        `  <constant value="${leaf.state ? "true" : "false"}"/>`,
        "</define-house-event>",
      ].join("\n"),
    );

  const localLeafDefinitions = model.leafNodes
    .filter(
      (
        leaf,
      ): leaf is Extract<FaultTreeLeafNode, { kind: "UNDEVELOPED_EVENT" | "TRANSFER_REFERENCE" }> =>
        leaf.kind === "UNDEVELOPED_EVENT" || leaf.kind === "TRANSFER_REFERENCE",
    )
    .map((leaf) => {
      const metadata = {
        ...entityMetadata(leaf, positions.get(leaf.id)),
        "openpra.kind": leaf.kind,
        "openpra.target-model-id":
          leaf.kind === "TRANSFER_REFERENCE" ? leaf.target.modelId : undefined,
        "openpra.target-entity-id":
          leaf.kind === "TRANSFER_REFERENCE" ? leaf.target.entityId : undefined,
      };
      return [
        `<define-basic-event name="${escapeXmlAttribute(names.get(leaf.id) as string)}">`,
        `  <label>${escapeXmlText(leaf.name)}</label>`,
        indentBlock(metadataXml(metadata), "  "),
        "</define-basic-event>",
      ].join("\n");
    });

  const basicEventDefinitions = catalogue.basicEvents.map((basicEvent) => {
    const controlled = basicEvent.probability.controlledDataSource;
    return [
      `<define-basic-event name="${escapeXmlAttribute(names.get(basicEvent.id) as string)}">`,
      `  <label>${escapeXmlText(basicEvent.name)}</label>`,
      indentBlock(
        metadataXml({
          ...entityMetadata(basicEvent),
          "openpra.kind": "BASIC_EVENT",
          "openpra.controlled-workbook-id": controlled?.workbookId,
          "openpra.controlled-entity-id": controlled?.entityId,
        }),
        "  ",
      ),
      `  <float value="${basicEvent.probability.value}"/>`,
      "</define-basic-event>",
    ].join("\n");
  });

  const snapshot: EditorSnapshot = {
    schemaVersion: "1.0.0",
    model,
    catalogue,
  };
  const treeMetadata = metadataXml({
    "openpra.model-id": model.modelId,
    "openpra.code": model.code,
    "openpra.name": model.name,
    "openpra.description": model.description,
    "openpra.top-gate-id": model.topGate?.gateId,
    "openpra.layout-mode": model.layout.mode,
    "openpra.layout-direction": model.layout.direction,
    "openpra.viewport-x": model.layout.viewport.x,
    "openpra.viewport-y": model.layout.viewport.y,
    "openpra.viewport-zoom": model.layout.viewport.zoom,
    ...(options.includeEditorSnapshot === false
      ? {}
      : { [EDITOR_SNAPSHOT_ATTRIBUTE]: JSON.stringify(snapshot) }),
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!DOCTYPE opsa-mef>",
    "<opsa-mef>",
    `  <define-fault-tree name="${escapeXmlAttribute(standardIdentifier(model.code, model.modelId))}">`,
    `    <label>${escapeXmlText(model.name)}</label>`,
    indentBlock(treeMetadata, "    "),
    ...[...gateDefinitions, ...houseDefinitions, ...localLeafDefinitions, ...basicEventDefinitions].map(
      (definition) => indentBlock(definition, "    "),
    ),
    "  </define-fault-tree>",
    "</opsa-mef>",
    "",
  ].join("\n");
}

function elementName(element: Element): string {
  return (element.localName || element.tagName).toLocaleLowerCase("en-US");
}

function directChildren(element: Element, name?: string): Element[] {
  const children = Array.from(element.children);
  return name === undefined ? children : children.filter((child) => elementName(child) === name);
}

function firstDirectChild(element: Element, name: string): Element | undefined {
  return directChildren(element, name)[0];
}

function definitionMetadata(element: Element): Map<string, string> {
  const result = new Map<string, string>();
  const attributesElement = firstDirectChild(element, "attributes");
  if (attributesElement === undefined) return result;
  for (const attribute of directChildren(attributesElement, "attribute")) {
    const name = attribute.getAttribute("name");
    const value = attribute.getAttribute("value");
    if (name !== null && value !== null) result.set(name, value);
  }
  return result;
}

function definitionLabel(element: Element): string | undefined {
  const label = firstDirectChild(element, "label")?.textContent?.trim();
  return label === "" ? undefined : label;
}

function validPresentations(value: unknown): value is FaultTreeBasicEventPresentation[] {
  return (
    Array.isArray(value) &&
    value.every(
      (presentation) =>
        typeof presentation === "object" &&
        presentation !== null &&
        typeof (presentation as { basicEventId?: unknown }).basicEventId === "string" &&
        ["failureModeLabel", "failureModeShort"].every(
          (key) =>
            (presentation as Record<string, unknown>)[key] === undefined ||
            typeof (presentation as Record<string, unknown>)[key] === "string",
        ) &&
        ["commonCause", "repairCredited"].every(
          (key) =>
            (presentation as Record<string, unknown>)[key] === undefined ||
            typeof (presentation as Record<string, unknown>)[key] === "boolean",
        ),
    )
  );
}

function importEditorSnapshot(value: string): OpenPsaFaultTreeImport {
  let candidate: unknown;
  try {
    candidate = JSON.parse(value);
  } catch {
    throw new OpenPsaImportError(
      "INVALID_EDITOR_SNAPSHOT",
      "The embedded OpenPRA editor snapshot is not valid JSON",
    );
  }
  if (typeof candidate !== "object" || candidate === null) {
    throw new OpenPsaImportError("INVALID_EDITOR_SNAPSHOT", "The editor snapshot must be an object");
  }
  const snapshot = candidate as Partial<EditorSnapshot>;
  if (snapshot.schemaVersion !== "1.0.0") {
    throw new OpenPsaImportError(
      "INVALID_EDITOR_SNAPSHOT",
      `Unsupported editor snapshot version ${String(snapshot.schemaVersion)}`,
    );
  }
  const modelResult = FaultTreeModelSchema.safeParse(snapshot.model);
  const catalogueCandidate = snapshot.catalogue as FaultTreeEditorCatalogue | undefined;
  const catalogueResult = FaultTreeBasicEventCatalogueDefinitionSchema.safeParse({
    basicEvents: catalogueCandidate?.basicEvents,
  });
  if (!modelResult.success || !catalogueResult.success) {
    const messages = [
      ...(modelResult.success ? [] : modelResult.error.issues.map(({ message }) => message)),
      ...(catalogueResult.success ? [] : catalogueResult.error.issues.map(({ message }) => message)),
    ];
    throw new OpenPsaImportError("INVALID_EDITOR_SNAPSHOT", messages.join("; "));
  }
  if (
    catalogueCandidate?.presentations !== undefined &&
    !validPresentations(catalogueCandidate.presentations)
  ) {
    throw new OpenPsaImportError(
      "INVALID_EDITOR_SNAPSHOT",
      "Basic-event presentation metadata is malformed",
    );
  }
  return {
    model: editorModelSnapshot(modelResult.data),
    catalogue: editorCatalogueSnapshot({
      basicEvents: catalogueResult.data.basicEvents,
      ...(catalogueCandidate?.presentations === undefined
        ? {}
        : { presentations: catalogueCandidate.presentations }),
    }),
    warnings: [],
  };
}

function allocateUuid(used: Set<string>): string {
  for (let counter = 1; counter <= 0xffffffffffff; counter += 1) {
    const candidate = `00000000-0000-4000-8000-${counter.toString(16).padStart(12, "0")}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  throw new OpenPsaImportError("INVALID_MODEL", "No unused UUID is available");
}

function importedId(candidate: string | undefined, used: Set<string>): string {
  if (candidate !== undefined && UUID_PATTERN.test(candidate) && !used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  return allocateUuid(used);
}

function bounded(value: string | undefined, fallback: string, maximum: number): string {
  const selected = value?.trim() || fallback;
  return selected.slice(0, maximum);
}

function finiteNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

interface StandardImportState {
  usedIds: Set<string>;
  gates: FaultTreeGate[];
  leaves: FaultTreeLeafNode[];
  basicEvents: FaultTreeBasicEvent[];
  inputs: FaultTreeGateInput[];
  positions: FaultTreeNodePosition[];
  gateIdsByName: Map<string, string>;
  leafIdsByName: Map<string, string>;
  basicEventIdsByName: Map<string, string>;
  basicReferenceIdsByKey: Map<string, string>;
  inputIds: Set<string>;
  warnings: string[];
}

function recordPosition(
  state: StandardImportState,
  nodeId: string,
  metadata: ReadonlyMap<string, string>,
): void {
  const x = metadata.get("openpra.position-x");
  const y = metadata.get("openpra.position-y");
  if (x === undefined || y === undefined || state.positions.some((position) => position.nodeId === nodeId)) {
    return;
  }
  const parsedX = Number(x);
  const parsedY = Number(y);
  if (Number.isFinite(parsedX) && Number.isFinite(parsedY)) {
    state.positions.push({ nodeId, position: { x: parsedX, y: parsedY } });
  }
}

function addDefinitionName(map: Map<string, string>, name: string, id: string): void {
  if (map.has(name)) {
    throw new OpenPsaImportError("DUPLICATE_DEFINITION", `Duplicate OpenPSA definition ${name}`);
  }
  map.set(name, id);
}

function referenceNode(
  element: Element,
  state: StandardImportState,
): string {
  const rawTag = elementName(element);
  const tag =
    rawTag === "event"
      ? (element.getAttribute("type")?.toLocaleLowerCase("en-US") ?? "basic-event")
      : rawTag;
  const name = element.getAttribute("name")?.trim();
  if (name === undefined || name === "") {
    throw new OpenPsaImportError("UNRESOLVED_REFERENCE", `${tag} reference is missing a name`);
  }
  if (tag === "gate") {
    const gateId = state.gateIdsByName.get(name);
    if (gateId !== undefined) return gateId;
    const existingTransferId = state.leafIdsByName.get(name);
    if (existingTransferId !== undefined) return existingTransferId;
    const leafId = importedId(element.getAttribute("openpra-node-id") ?? undefined, state.usedIds);
    state.leaves.push({
      id: leafId,
      kind: "TRANSFER_REFERENCE",
      code: bounded(name, "TRANSFER", 64),
      name: bounded(name, "Transfer", 200),
      description: "Imported external OpenPSA gate reference",
      target: { modelId: allocateUuid(state.usedIds), entityId: allocateUuid(state.usedIds) },
    });
    state.leafIdsByName.set(name, leafId);
    state.warnings.push(`External gate reference ${name} was imported as a transfer reference`);
    return leafId;
  }
  if (tag === "house-event") {
    const leafId = state.leafIdsByName.get(name);
    if (leafId !== undefined) return leafId;
    throw new OpenPsaImportError("UNRESOLVED_REFERENCE", `House event ${name} is not defined`);
  }
  if (tag !== "basic-event") {
    throw new OpenPsaImportError("UNSUPPORTED_FORMULA", `Unsupported event reference <${tag}>`);
  }

  const specialLeafId = state.leafIdsByName.get(name);
  if (specialLeafId !== undefined) return specialLeafId;
  let basicEventId = state.basicEventIdsByName.get(name);
  if (basicEventId === undefined) {
    basicEventId = allocateUuid(state.usedIds);
    state.basicEventIdsByName.set(name, basicEventId);
    state.basicEvents.push({
      id: basicEventId,
      code: bounded(name, "BASIC", 64),
      name: bounded(name, "Basic event", 200),
      description: "Imported undeclared OpenPSA basic event",
      probability: { value: 0 },
    });
    state.warnings.push(`Undeclared basic event ${name} was added to the catalogue with probability 0`);
  }

  const rawNodeId = element.getAttribute("openpra-node-id") ?? undefined;
  const referenceKey = rawNodeId ?? `basic-event:${name}`;
  const existing = state.basicReferenceIdsByKey.get(referenceKey);
  if (existing !== undefined) return existing;
  const leafId = importedId(rawNodeId, state.usedIds);
  state.basicReferenceIdsByKey.set(referenceKey, leafId);
  state.leaves.push({ id: leafId, kind: "BASIC_EVENT_REFERENCE", basicEventId });
  return leafId;
}

function addInput(
  state: StandardImportState,
  parentGateId: string,
  childId: string,
  element: Element,
  fallbackOrder: number,
): void {
  const rawInputId = element.getAttribute("openpra-input-id") ?? undefined;
  let inputId = rawInputId;
  if (inputId === undefined || !UUID_PATTERN.test(inputId) || state.inputIds.has(inputId)) {
    inputId = allocateUuid(state.usedIds);
  } else {
    state.usedIds.add(inputId);
  }
  state.inputIds.add(inputId);
  const rawOrder = element.getAttribute("openpra-order");
  const requestedOrder = rawOrder === null ? Number.NaN : Number(rawOrder);
  state.inputs.push({
    id: inputId,
    gateId: parentGateId,
    childId,
    order: Number.isInteger(requestedOrder) && requestedOrder >= 0 ? requestedOrder : fallbackOrder,
  });
}

function gateFromOperator(
  base: Omit<FaultTreeGate, "gateType">,
  operator: string,
  element: Element,
): FaultTreeGate {
  switch (operator) {
    case "and":
      return { ...base, gateType: "AND" };
    case "or":
      return { ...base, gateType: "OR" };
    case "not":
      return { ...base, gateType: "NOT" };
    case "atleast": {
      const k = Number(element.getAttribute("min"));
      if (!Number.isInteger(k) || k < 1) {
        throw new OpenPsaImportError("UNSUPPORTED_FORMULA", "An atleast formula requires a positive min");
      }
      return { ...base, gateType: "K_OF_N", k };
    }
    default:
      throw new OpenPsaImportError(
        "UNSUPPORTED_FORMULA",
        `Boolean operator <${operator}> is not supported by the fault-tree editor`,
      );
  }
}

function importFormulaChildren(
  operatorElement: Element,
  parentGateId: string,
  state: StandardImportState,
): void {
  const terms = directChildren(operatorElement);
  terms.forEach((term, order) => {
    const tag = elementName(term);
    if (["gate", "house-event", "basic-event", "event"].includes(tag)) {
      addInput(state, parentGateId, referenceNode(term, state), term, order);
      return;
    }
    if (tag === "constant") {
      const leafId = importedId(undefined, state.usedIds);
      const value = term.getAttribute("value")?.toLocaleLowerCase("en-US");
      if (value !== "true" && value !== "false") {
        throw new OpenPsaImportError("UNSUPPORTED_FORMULA", "A Boolean constant must be true or false");
      }
      state.leaves.push({
        id: leafId,
        kind: "HOUSE_EVENT",
        code: `CONSTANT_${state.leaves.length + 1}`,
        name: `Constant ${value}`,
        description: "Imported inline OpenPSA constant",
        state: value === "true",
      });
      addInput(state, parentGateId, leafId, term, order);
      return;
    }
    if (["and", "or", "not", "atleast"].includes(tag)) {
      const nestedId = importedId(undefined, state.usedIds);
      const nestedBase = {
        id: nestedId,
        kind: "GATE" as const,
        code: `EXPR_${state.gates.length + 1}`,
        name: "Imported nested expression",
        description: "Materialized from a nested OpenPSA Boolean expression",
      };
      state.gates.push(gateFromOperator(nestedBase, tag, term));
      addInput(state, parentGateId, nestedId, term, order);
      importFormulaChildren(term, nestedId, state);
      return;
    }
    throw new OpenPsaImportError("UNSUPPORTED_FORMULA", `Unsupported formula element <${tag}>`);
  });
}

function importStandardFaultTree(tree: Element): OpenPsaFaultTreeImport {
  const usedIds = new Set<string>();
  const treeMetadata = definitionMetadata(tree);
  const state: StandardImportState = {
    usedIds,
    gates: [],
    leaves: [],
    basicEvents: [],
    inputs: [],
    positions: [],
    gateIdsByName: new Map(),
    leafIdsByName: new Map(),
    basicEventIdsByName: new Map(),
    basicReferenceIdsByKey: new Map(),
    inputIds: new Set(),
    warnings: [],
  };
  const definitions = Array.from(tree.getElementsByTagName("*"));
  const gateElements = definitions.filter((element) => elementName(element) === "define-gate");
  const houseElements = definitions.filter(
    (element) => elementName(element) === "define-house-event",
  );
  const basicElements = definitions.filter(
    (element) => elementName(element) === "define-basic-event",
  );

  for (const element of houseElements) {
    const name = element.getAttribute("name")?.trim();
    if (!name) throw new OpenPsaImportError("INVALID_MODEL", "A house-event definition needs a name");
    const metadata = definitionMetadata(element);
    const id = importedId(metadata.get("openpra.id"), usedIds);
    const constant = firstDirectChild(element, "constant")?.getAttribute("value")?.toLocaleLowerCase("en-US");
    if (constant !== undefined && constant !== "true" && constant !== "false") {
      throw new OpenPsaImportError("INVALID_MODEL", `House event ${name} has an invalid constant`);
    }
    state.leaves.push({
      id,
      kind: "HOUSE_EVENT",
      code: bounded(metadata.get("openpra.code"), name, 64),
      name: bounded(metadata.get("openpra.name"), definitionLabel(element) ?? name, 200),
      description: (metadata.get("openpra.description") ?? "").slice(0, 10_000),
      state: constant === "true",
    });
    addDefinitionName(state.leafIdsByName, name, id);
    recordPosition(state, id, metadata);
  }

  for (const element of basicElements) {
    const name = element.getAttribute("name")?.trim();
    if (!name) throw new OpenPsaImportError("INVALID_MODEL", "A basic-event definition needs a name");
    const metadata = definitionMetadata(element);
    const kind = metadata.get("openpra.kind");
    if (kind === "UNDEVELOPED_EVENT" || kind === "TRANSFER_REFERENCE") {
      const id = importedId(metadata.get("openpra.id"), usedIds);
      const identity = {
        id,
        code: bounded(metadata.get("openpra.code"), name, 64),
        name: bounded(metadata.get("openpra.name"), definitionLabel(element) ?? name, 200),
        description: (metadata.get("openpra.description") ?? "").slice(0, 10_000),
      };
      if (kind === "TRANSFER_REFERENCE") {
        state.leaves.push({
          ...identity,
          kind,
          target: {
            modelId: importedId(metadata.get("openpra.target-model-id"), usedIds),
            entityId: importedId(metadata.get("openpra.target-entity-id"), usedIds),
          },
        });
      } else {
        state.leaves.push({ ...identity, kind });
      }
      addDefinitionName(state.leafIdsByName, name, id);
      recordPosition(state, id, metadata);
      continue;
    }

    const id = importedId(metadata.get("openpra.id"), usedIds);
    const float = firstDirectChild(element, "float")?.getAttribute("value");
    const probability = finiteNumber(float ?? undefined, 0);
    if (probability < 0 || probability > 1) {
      throw new OpenPsaImportError(
        "INVALID_MODEL",
        `Basic event ${name} probability must be between 0 and 1`,
      );
    }
    state.basicEvents.push({
      id,
      code: bounded(metadata.get("openpra.code"), name, 64),
      name: bounded(metadata.get("openpra.name"), definitionLabel(element) ?? name, 200),
      description: (metadata.get("openpra.description") ?? "").slice(0, 10_000),
      probability: { value: probability },
    });
    addDefinitionName(state.basicEventIdsByName, name, id);
  }

  const formulas = new Map<string, Element>();
  for (const element of gateElements) {
    const name = element.getAttribute("name")?.trim();
    if (!name) throw new OpenPsaImportError("INVALID_MODEL", "A gate definition needs a name");
    const metadata = definitionMetadata(element);
    const id = importedId(metadata.get("openpra.id"), usedIds);
    const formula = directChildren(element).find(
      (child) => !["label", "attributes"].includes(elementName(child)),
    );
    if (formula === undefined) {
      throw new OpenPsaImportError("INVALID_MODEL", `Gate ${name} is missing a Boolean formula`);
    }
    const base = {
      id,
      kind: "GATE" as const,
      code: bounded(metadata.get("openpra.code"), name, 64),
      name: bounded(metadata.get("openpra.name"), definitionLabel(element) ?? name, 200),
      description: (metadata.get("openpra.description") ?? "").slice(0, 10_000),
    };
    const formulaTag = elementName(formula);
    state.gates.push(
      ["and", "or", "not", "atleast"].includes(formulaTag)
        ? gateFromOperator(base, formulaTag, formula)
        : { ...base, gateType: "OR" },
    );
    addDefinitionName(state.gateIdsByName, name, id);
    formulas.set(id, formula);
    recordPosition(state, id, metadata);
  }

  for (const [gateId, formula] of formulas) {
    const formulaTag = elementName(formula);
    if (["and", "or", "not", "atleast"].includes(formulaTag)) {
      importFormulaChildren(formula, gateId, state);
    } else {
      importFormulaChildren(
        {
          children: [formula],
        } as unknown as Element,
        gateId,
        state,
      );
    }
  }

  const referencedGates = new Set(
    state.inputs
      .filter((input) => state.gates.some(({ id }) => id === input.childId))
      .map(({ childId }) => childId),
  );
  const requestedTopGateId = treeMetadata.get("openpra.top-gate-id");
  const topGateId =
    requestedTopGateId !== undefined && state.gates.some(({ id }) => id === requestedTopGateId)
      ? requestedTopGateId
      : state.gates.find(({ id }) => !referencedGates.has(id))?.id ?? state.gates[0]?.id;
  const treeName = tree.getAttribute("name")?.trim() || "Imported_Fault_Tree";
  const model: FaultTreeEditorModel = {
    modelId: importedId(treeMetadata.get("openpra.model-id"), usedIds),
    code: bounded(treeMetadata.get("openpra.code"), treeName, 64),
    name: bounded(treeMetadata.get("openpra.name"), definitionLabel(tree) ?? treeName, 200),
    description: (treeMetadata.get("openpra.description") ?? "").slice(0, 10_000),
    topGate: topGateId === undefined ? null : { gateId: topGateId },
    gates: state.gates,
    leafNodes: state.leaves,
    gateInputs: state.inputs,
    nodePositions: state.positions,
    layout: {
      mode: treeMetadata.get("openpra.layout-mode") === "MANUAL" ? "MANUAL" : "AUTOMATIC",
      direction:
        treeMetadata.get("openpra.layout-direction") === "LEFT_TO_RIGHT"
          ? "LEFT_TO_RIGHT"
          : "TOP_TO_BOTTOM",
      viewport: {
        x: finiteNumber(treeMetadata.get("openpra.viewport-x"), 0),
        y: finiteNumber(treeMetadata.get("openpra.viewport-y"), 0),
        zoom: finiteNumber(treeMetadata.get("openpra.viewport-zoom"), 1),
      },
    },
  };
  const modelResult = FaultTreeModelSchema.safeParse(model);
  const catalogueResult = FaultTreeBasicEventCatalogueDefinitionSchema.safeParse({
    basicEvents: state.basicEvents,
  });
  if (!modelResult.success || !catalogueResult.success) {
    const messages = [
      ...(modelResult.success ? [] : modelResult.error.issues.map(({ message }) => message)),
      ...(catalogueResult.success ? [] : catalogueResult.error.issues.map(({ message }) => message)),
    ];
    throw new OpenPsaImportError("INVALID_MODEL", messages.join("; "));
  }
  return {
    model: modelResult.data,
    catalogue: { basicEvents: catalogueResult.data.basicEvents },
    warnings: state.warnings,
  };
}

function importOpenPsaFaultTree(xml: string): OpenPsaFaultTreeImport {
  if (typeof DOMParser === "undefined") {
    throw new OpenPsaImportError(
      "INVALID_XML",
      "OpenPSA import requires a browser-compatible DOMParser",
    );
  }
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new OpenPsaImportError("INVALID_XML", "The OpenPSA document is not well-formed XML");
  }
  const tree = Array.from(document.getElementsByTagName("*")).find(
    (element) => elementName(element) === "define-fault-tree",
  );
  if (tree === undefined) {
    throw new OpenPsaImportError(
      "FAULT_TREE_NOT_FOUND",
      "The OpenPSA document does not contain a fault-tree definition",
    );
  }
  const embeddedSnapshot = definitionMetadata(tree).get(EDITOR_SNAPSHOT_ATTRIBUTE);
  return embeddedSnapshot === undefined
    ? importStandardFaultTree(tree)
    : importEditorSnapshot(embeddedSnapshot);
}

export {
  OpenPsaImportError,
  OpenPsaExportError,
  exportOpenPsaFaultTree,
  importOpenPsaFaultTree,
  mergeOpenPsaImportCatalogue,
};
export type {
  OpenPsaImportErrorCode,
  OpenPsaExportErrorCode,
  OpenPsaFaultTreeImport,
  OpenPsaExportOptions,
};
