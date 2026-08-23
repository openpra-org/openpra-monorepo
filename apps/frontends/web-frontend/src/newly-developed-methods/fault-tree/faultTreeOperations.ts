import type {
  CanvasLayoutDirection,
  FaultTreeBasicEvent,
  FaultTreeGate,
  FaultTreeGateInput,
  FaultTreeLeafNode,
  FaultTreeNodePosition,
} from "interfaces-mef-types/modeling";
import type {
  FaultTreeEditorCatalogue,
  FaultTreeEditorModel,
  FaultTreeOperation,
  FaultTreeOperationResult,
} from "./faultTreeTypes";

type FaultTreeOperationErrorCode =
  | "DUPLICATE_ID"
  | "ENTITY_NOT_FOUND"
  | "INVALID_BASIC_EVENT_REFERENCE"
  | "INVALID_CONNECTION"
  | "INVALID_GATE"
  | "INVALID_ORDER"
  | "REFERENCE_IN_USE";

class FaultTreeOperationError extends Error {
  readonly code: FaultTreeOperationErrorCode;
  readonly entityId?: string;

  constructor(code: FaultTreeOperationErrorCode, message: string, entityId?: string) {
    super(message);
    this.name = "FaultTreeOperationError";
    this.code = code;
    this.entityId = entityId;
  }
}

const UUID_COUNTER_PREFIX = "00000000-0000-4000-8000-";

function allIds(model: FaultTreeEditorModel, catalogue: FaultTreeEditorCatalogue): Set<string> {
  return new Set([
    model.modelId,
    ...model.gates.map(({ id }) => id),
    ...model.leafNodes.map(({ id }) => id),
    ...model.gateInputs.map(({ id }) => id),
    ...catalogue.basicEvents.map(({ id }) => id),
  ]);
}

/**
 * Allocates a deterministic UUID that does not collide with anything in the
 * supplied snapshot. Keeping allocation state-derived makes reducer replay and
 * undo/redo deterministic while still satisfying the MEF UUID contract.
 */
function nextFaultTreeId(
  model: FaultTreeEditorModel,
  catalogue: FaultTreeEditorCatalogue,
  additionalIds: Iterable<string> = [],
): string {
  const used = allIds(model, catalogue);
  for (const id of additionalIds) used.add(id);

  for (let counter = 1; counter <= 0xffffffffffff; counter += 1) {
    const candidate = `${UUID_COUNTER_PREFIX}${counter.toString(16).padStart(12, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new FaultTreeOperationError("DUPLICATE_ID", "No unused fault-tree UUID is available");
}

function cloneGate(gate: FaultTreeGate): FaultTreeGate {
  return { ...gate };
}

function cloneLeaf(leaf: FaultTreeLeafNode): FaultTreeLeafNode {
  return leaf.kind === "TRANSFER_REFERENCE"
    ? { ...leaf, target: { ...leaf.target } }
    : { ...leaf };
}

function cloneBasicEvent(basicEvent: FaultTreeBasicEvent): FaultTreeBasicEvent {
  return {
    ...basicEvent,
    probability: {
      ...basicEvent.probability,
      ...(basicEvent.probability.controlledDataSource === undefined
        ? {}
        : { controlledDataSource: { ...basicEvent.probability.controlledDataSource } }),
    },
  };
}

function cloneModel(model: FaultTreeEditorModel): FaultTreeEditorModel {
  return {
    ...model,
    topGate: model.topGate === null ? null : { ...model.topGate },
    gates: model.gates.map(cloneGate),
    leafNodes: model.leafNodes.map(cloneLeaf),
    gateInputs: model.gateInputs.map((input) => ({ ...input })),
    nodePositions: model.nodePositions.map(({ nodeId, position }) => ({
      nodeId,
      position: { ...position },
    })),
    layout: { ...model.layout, viewport: { ...model.layout.viewport } },
  };
}

function cloneCatalogue(catalogue: FaultTreeEditorCatalogue): FaultTreeEditorCatalogue {
  return {
    basicEvents: catalogue.basicEvents.map(cloneBasicEvent),
    ...(catalogue.presentations === undefined
      ? {}
      : { presentations: catalogue.presentations.map((presentation) => ({ ...presentation })) }),
  };
}

function hasNode(model: FaultTreeEditorModel, nodeId: string): boolean {
  return model.gates.some(({ id }) => id === nodeId) || model.leafNodes.some(({ id }) => id === nodeId);
}

function requireGate(model: FaultTreeEditorModel, gateId: string): FaultTreeGate {
  const gate = model.gates.find(({ id }) => id === gateId);
  if (gate === undefined) {
    throw new FaultTreeOperationError("ENTITY_NOT_FOUND", `Gate ${gateId} was not found`, gateId);
  }
  return gate;
}

function requireLeaf(model: FaultTreeEditorModel, leafId: string): FaultTreeLeafNode {
  const leaf = model.leafNodes.find(({ id }) => id === leafId);
  if (leaf === undefined) {
    throw new FaultTreeOperationError("ENTITY_NOT_FOUND", `Leaf ${leafId} was not found`, leafId);
  }
  return leaf;
}

function requireBasicEvent(
  catalogue: FaultTreeEditorCatalogue,
  basicEventId: string,
): FaultTreeBasicEvent {
  const basicEvent = catalogue.basicEvents.find(({ id }) => id === basicEventId);
  if (basicEvent === undefined) {
    throw new FaultTreeOperationError(
      "ENTITY_NOT_FOUND",
      `Basic event ${basicEventId} was not found`,
      basicEventId,
    );
  }
  return basicEvent;
}

function assertUnusedNodeId(model: FaultTreeEditorModel, nodeId: string): void {
  if (hasNode(model, nodeId)) {
    throw new FaultTreeOperationError("DUPLICATE_ID", `Node id ${nodeId} is already in use`, nodeId);
  }
}

function assertValidGate(gate: FaultTreeGate): void {
  if (gate.gateType === "K_OF_N" && (!Number.isInteger(gate.k) || gate.k < 1)) {
    throw new FaultTreeOperationError(
      "INVALID_GATE",
      "A K-of-N gate must use a positive integer for K",
      gate.id,
    );
  }
}

function assertValidLeaf(leaf: FaultTreeLeafNode, catalogue: FaultTreeEditorCatalogue): void {
  if (leaf.kind === "BASIC_EVENT_REFERENCE") {
    if (!catalogue.basicEvents.some(({ id }) => id === leaf.basicEventId)) {
      throw new FaultTreeOperationError(
        "INVALID_BASIC_EVENT_REFERENCE",
        `Basic-event reference ${leaf.id} targets missing event ${leaf.basicEventId}`,
        leaf.id,
      );
    }
  }
}

function assertOrder(order: number | undefined): void {
  if (order !== undefined && (!Number.isInteger(order) || order < 0)) {
    throw new FaultTreeOperationError("INVALID_ORDER", "Input order must be a non-negative integer");
  }
}

function normalizeGateInputOrders(inputs: FaultTreeGateInput[], gateId: string): FaultTreeGateInput[] {
  const siblings = inputs
    .filter((input) => input.gateId === gateId)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((input, order) => ({ ...input, order }));
  const byId = new Map(siblings.map((input) => [input.id, input]));
  return inputs.map((input) => byId.get(input.id) ?? input);
}

function childGateCanReach(
  model: FaultTreeEditorModel,
  startGateId: string,
  targetGateId: string,
  inputs: readonly FaultTreeGateInput[] = model.gateInputs,
): boolean {
  const gateIds = new Set(model.gates.map(({ id }) => id));
  const children = new Map<string, string[]>();
  for (const input of inputs) {
    if (!gateIds.has(input.childId)) continue;
    const current = children.get(input.gateId) ?? [];
    current.push(input.childId);
    children.set(input.gateId, current);
  }

  const pending = [startGateId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const gateId = pending.pop() as string;
    if (gateId === targetGateId) return true;
    if (visited.has(gateId)) continue;
    visited.add(gateId);
    pending.push(...(children.get(gateId) ?? []));
  }
  return false;
}

function assertConnection(
  model: FaultTreeEditorModel,
  gateId: string,
  childId: string,
  inputs: readonly FaultTreeGateInput[] = model.gateInputs,
): void {
  const gate = requireGate(model, gateId);
  if (!hasNode(model, childId)) {
    throw new FaultTreeOperationError(
      "ENTITY_NOT_FOUND",
      `Child node ${childId} was not found`,
      childId,
    );
  }
  if (gateId === childId) {
    throw new FaultTreeOperationError(
      "INVALID_CONNECTION",
      "A gate cannot be its own input",
      childId,
    );
  }
  if (inputs.some((input) => input.gateId === gateId && input.childId === childId)) {
    throw new FaultTreeOperationError(
      "INVALID_CONNECTION",
      "The child is already connected to this gate",
      childId,
    );
  }
  if (gate.gateType === "NOT" && inputs.some((input) => input.gateId === gateId)) {
    throw new FaultTreeOperationError(
      "INVALID_CONNECTION",
      "A NOT gate can have only one input",
      gateId,
    );
  }
  if (
    model.gates.some(({ id }) => id === childId) &&
    childGateCanReach(model, childId, gateId, inputs)
  ) {
    throw new FaultTreeOperationError(
      "INVALID_CONNECTION",
      "The connection would introduce a fault-tree cycle",
      childId,
    );
  }
}

function connect(
  model: FaultTreeEditorModel,
  catalogue: FaultTreeEditorCatalogue,
  gateId: string,
  childId: string,
  inputId: string | undefined,
  order: number | undefined,
): { model: FaultTreeEditorModel; inputId: string } {
  assertOrder(order);
  assertConnection(model, gateId, childId);

  const allocatedInputId = inputId ?? nextFaultTreeId(model, catalogue);
  if (model.gateInputs.some(({ id }) => id === allocatedInputId)) {
    throw new FaultTreeOperationError(
      "DUPLICATE_ID",
      `Gate-input id ${allocatedInputId} is already in use`,
      allocatedInputId,
    );
  }

  const siblings = model.gateInputs
    .filter((input) => input.gateId === gateId)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const insertionOrder = Math.min(order ?? siblings.length, siblings.length);
  siblings.splice(insertionOrder, 0, {
    id: allocatedInputId,
    gateId,
    childId,
    order: insertionOrder,
  });
  const siblingIds = new Set(siblings.map(({ id }) => id));
  const otherInputs = model.gateInputs.filter(({ id }) => !siblingIds.has(id));
  return {
    model: {
      ...model,
      gateInputs: [...otherInputs, ...siblings.map((input, siblingOrder) => ({
        ...input,
        order: siblingOrder,
      }))],
    },
    inputId: allocatedInputId,
  };
}

function deletionClosure(
  model: FaultTreeEditorModel,
  initialNodeIds: Iterable<string>,
): Set<string> {
  const deleted = new Set(initialNodeIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const input of model.gateInputs) {
      if (!deleted.has(input.gateId) || deleted.has(input.childId)) continue;
      const hasSurvivingParent = model.gateInputs.some(
        (candidate) => candidate.childId === input.childId && !deleted.has(candidate.gateId),
      );
      const isProtectedTopGate = model.topGate?.gateId === input.childId;
      if (!hasSurvivingParent && !isProtectedTopGate) {
        deleted.add(input.childId);
        changed = true;
      }
    }
  }
  return deleted;
}

function deleteNodes(
  model: FaultTreeEditorModel,
  nodeIds: ReadonlySet<string>,
): FaultTreeEditorModel {
  const affectedGateIds = new Set(
    model.gateInputs
      .filter((input) => nodeIds.has(input.childId) || nodeIds.has(input.gateId))
      .map(({ gateId }) => gateId),
  );
  let inputs = model.gateInputs.filter(
    (input) => !nodeIds.has(input.gateId) && !nodeIds.has(input.childId),
  );
  for (const gateId of affectedGateIds) inputs = normalizeGateInputOrders(inputs, gateId);

  return {
    ...model,
    topGate:
      model.topGate !== null && nodeIds.has(model.topGate.gateId) ? null : model.topGate,
    gates: model.gates.filter(({ id }) => !nodeIds.has(id)),
    leafNodes: model.leafNodes.filter(({ id }) => !nodeIds.has(id)),
    gateInputs: inputs,
    nodePositions: model.nodePositions.filter(({ nodeId }) => !nodeIds.has(nodeId)),
  };
}

function deleteNode(
  model: FaultTreeEditorModel,
  nodeId: string,
  subtree: boolean,
): FaultTreeEditorModel {
  if (!hasNode(model, nodeId)) {
    throw new FaultTreeOperationError("ENTITY_NOT_FOUND", `Node ${nodeId} was not found`, nodeId);
  }
  const nodeIds = subtree ? deletionClosure(model, [nodeId]) : new Set([nodeId]);
  return deleteNodes(model, nodeIds);
}

function applyFaultTreeOperation(
  currentModel: FaultTreeEditorModel,
  currentCatalogue: FaultTreeEditorCatalogue,
  operation: FaultTreeOperation,
): FaultTreeOperationResult {
  let model = cloneModel(currentModel);
  let catalogue = cloneCatalogue(currentCatalogue);

  switch (operation.type) {
    case "UPDATE_MODEL":
      return { model: { ...model, ...operation.patch }, catalogue, affectedId: model.modelId };

    case "ADD_GATE": {
      const gateId = operation.gate.id ?? nextFaultTreeId(model, catalogue);
      assertUnusedNodeId(model, gateId);
      const gate = { ...operation.gate, id: gateId } as FaultTreeGate;
      assertValidGate(gate);
      model = { ...model, gates: [...model.gates, cloneGate(gate)] };
      if (operation.parentGateId !== undefined) {
        model = connect(
          model,
          catalogue,
          operation.parentGateId,
          gateId,
          undefined,
          operation.order,
        ).model;
      }
      if (operation.setAsTopGate === true || model.topGate === null) {
        model = { ...model, topGate: { gateId } };
      }
      return { model, catalogue, affectedId: gateId };
    }

    case "UPDATE_GATE": {
      requireGate(model, operation.gateId);
      if (operation.gate.id !== operation.gateId) {
        throw new FaultTreeOperationError(
          "INVALID_GATE",
          "Updating a gate cannot change its identity",
          operation.gateId,
        );
      }
      assertValidGate(operation.gate);
      const childCount = model.gateInputs.filter(({ gateId }) => gateId === operation.gateId).length;
      if (operation.gate.gateType === "NOT" && childCount > 1) {
        throw new FaultTreeOperationError(
          "INVALID_GATE",
          "A NOT gate cannot retain more than one input",
          operation.gateId,
        );
      }
      model = {
        ...model,
        gates: model.gates.map((gate) =>
          gate.id === operation.gateId ? cloneGate(operation.gate) : gate,
        ),
      };
      return { model, catalogue, affectedId: operation.gateId };
    }

    case "DELETE_GATE":
      requireGate(model, operation.gateId);
      model = deleteNode(model, operation.gateId, operation.subtree === true);
      return { model, catalogue, affectedId: operation.gateId };

    case "ADD_LEAF": {
      const leafId = operation.leaf.id ?? nextFaultTreeId(model, catalogue);
      assertUnusedNodeId(model, leafId);
      const leaf = { ...operation.leaf, id: leafId } as FaultTreeLeafNode;
      assertValidLeaf(leaf, catalogue);
      model = { ...model, leafNodes: [...model.leafNodes, cloneLeaf(leaf)] };
      if (operation.parentGateId !== undefined) {
        model = connect(
          model,
          catalogue,
          operation.parentGateId,
          leafId,
          undefined,
          operation.order,
        ).model;
      }
      return { model, catalogue, affectedId: leafId };
    }

    case "UPDATE_LEAF":
      requireLeaf(model, operation.leafId);
      if (operation.leaf.id !== operation.leafId) {
        throw new FaultTreeOperationError(
          "INVALID_CONNECTION",
          "Updating a leaf cannot change its identity",
          operation.leafId,
        );
      }
      assertValidLeaf(operation.leaf, catalogue);
      model = {
        ...model,
        leafNodes: model.leafNodes.map((leaf) =>
          leaf.id === operation.leafId ? cloneLeaf(operation.leaf) : leaf,
        ),
      };
      return { model, catalogue, affectedId: operation.leafId };

    case "DELETE_LEAF":
      requireLeaf(model, operation.leafId);
      model = deleteNode(model, operation.leafId, operation.subtree === true);
      return { model, catalogue, affectedId: operation.leafId };

    case "ADD_BASIC_EVENT": {
      const basicEventId = operation.basicEvent.id ?? nextFaultTreeId(model, catalogue);
      if (catalogue.basicEvents.some(({ id }) => id === basicEventId)) {
        throw new FaultTreeOperationError(
          "DUPLICATE_ID",
          `Basic-event id ${basicEventId} is already in use`,
          basicEventId,
        );
      }
      const basicEvent = { ...operation.basicEvent, id: basicEventId } as FaultTreeBasicEvent;
      catalogue = {
        ...catalogue,
        basicEvents: [...catalogue.basicEvents, cloneBasicEvent(basicEvent)],
      };
      if (operation.parentGateId !== undefined) {
        const leafId = nextFaultTreeId(model, catalogue);
        model = {
          ...model,
          leafNodes: [
            ...model.leafNodes,
            { id: leafId, kind: "BASIC_EVENT_REFERENCE", basicEventId },
          ],
        };
        model = connect(
          model,
          catalogue,
          operation.parentGateId,
          leafId,
          undefined,
          operation.order,
        ).model;
      }
      return { model, catalogue, affectedId: basicEventId };
    }

    case "UPDATE_BASIC_EVENT":
      requireBasicEvent(catalogue, operation.basicEventId);
      if (operation.basicEvent.id !== operation.basicEventId) {
        throw new FaultTreeOperationError(
          "INVALID_BASIC_EVENT_REFERENCE",
          "Updating a basic event cannot change its identity",
          operation.basicEventId,
        );
      }
      catalogue = {
        ...catalogue,
        basicEvents: catalogue.basicEvents.map((basicEvent) =>
          basicEvent.id === operation.basicEventId
            ? cloneBasicEvent(operation.basicEvent)
            : basicEvent,
        ),
      };
      return { model, catalogue, affectedId: operation.basicEventId };

    case "DELETE_BASIC_EVENT":
      requireBasicEvent(catalogue, operation.basicEventId);
      if (
        model.leafNodes.some(
          (leaf) =>
            leaf.kind === "BASIC_EVENT_REFERENCE" && leaf.basicEventId === operation.basicEventId,
        )
      ) {
        throw new FaultTreeOperationError(
          "REFERENCE_IN_USE",
          "A referenced basic event cannot be deleted",
          operation.basicEventId,
        );
      }
      catalogue = {
        ...catalogue,
        basicEvents: catalogue.basicEvents.filter(({ id }) => id !== operation.basicEventId),
        ...(catalogue.presentations === undefined
          ? {}
          : {
              presentations: catalogue.presentations.filter(
                ({ basicEventId }) => basicEventId !== operation.basicEventId,
              ),
            }),
      };
      return { model, catalogue, affectedId: operation.basicEventId };

    case "CONNECT": {
      const result = connect(
        model,
        catalogue,
        operation.gateId,
        operation.childId,
        operation.inputId,
        operation.order,
      );
      return { model: result.model, catalogue, affectedId: result.inputId };
    }

    case "DISCONNECT": {
      const input = model.gateInputs.find(({ id }) => id === operation.inputId);
      if (input === undefined) {
        throw new FaultTreeOperationError(
          "ENTITY_NOT_FOUND",
          `Gate input ${operation.inputId} was not found`,
          operation.inputId,
        );
      }
      model = {
        ...model,
        gateInputs: normalizeGateInputOrders(
          model.gateInputs.filter(({ id }) => id !== operation.inputId),
          input.gateId,
        ),
      };
      if (
        operation.subtree === true &&
        model.topGate?.gateId !== input.childId &&
        !model.gateInputs.some(({ childId }) => childId === input.childId)
      ) {
        model = deleteNodes(model, deletionClosure(model, [input.childId]));
      }
      return { model, catalogue, affectedId: operation.inputId };
    }

    case "REPARENT": {
      assertOrder(operation.order);
      const input = model.gateInputs.find(({ id }) => id === operation.inputId);
      if (input === undefined) {
        throw new FaultTreeOperationError(
          "ENTITY_NOT_FOUND",
          `Gate input ${operation.inputId} was not found`,
          operation.inputId,
        );
      }
      const withoutInput = normalizeGateInputOrders(
        model.gateInputs.filter(({ id }) => id !== input.id),
        input.gateId,
      );
      const base = { ...model, gateInputs: withoutInput };
      assertConnection(base, operation.gateId, input.childId, withoutInput);
      const result = connect(
        base,
        catalogue,
        operation.gateId,
        input.childId,
        input.id,
        operation.order,
      );
      return { model: result.model, catalogue, affectedId: input.id };
    }

    case "SET_TOP_GATE":
      if (operation.gateId !== null) requireGate(model, operation.gateId);
      model = {
        ...model,
        topGate: operation.gateId === null ? null : { gateId: operation.gateId },
      };
      return { model, catalogue, affectedId: operation.gateId ?? model.modelId };

    case "SET_NODE_POSITION": {
      if (!hasNode(model, operation.nodeId)) {
        throw new FaultTreeOperationError(
          "ENTITY_NOT_FOUND",
          `Node ${operation.nodeId} was not found`,
          operation.nodeId,
        );
      }
      const exists = model.nodePositions.some(({ nodeId }) => nodeId === operation.nodeId);
      model = {
        ...model,
        nodePositions: exists
          ? model.nodePositions.map((nodePosition) =>
              nodePosition.nodeId === operation.nodeId
                ? { nodeId: operation.nodeId, position: { ...operation.position } }
                : nodePosition,
            )
          : [
              ...model.nodePositions,
              { nodeId: operation.nodeId, position: { ...operation.position } },
            ],
        layout: { ...model.layout, mode: "MANUAL" },
      };
      return { model, catalogue, affectedId: operation.nodeId };
    }

    case "SET_LAYOUT": {
      if (operation.nodePositions !== undefined) {
        const seen = new Set<string>();
        for (const { nodeId } of operation.nodePositions) {
          if (!hasNode(model, nodeId)) {
            throw new FaultTreeOperationError(
              "ENTITY_NOT_FOUND",
              `Cannot position missing node ${nodeId}`,
              nodeId,
            );
          }
          if (seen.has(nodeId)) {
            throw new FaultTreeOperationError(
              "DUPLICATE_ID",
              `Node ${nodeId} has more than one position`,
              nodeId,
            );
          }
          seen.add(nodeId);
        }
      }
      model = {
        ...model,
        layout: { ...operation.layout, viewport: { ...operation.layout.viewport } },
        nodePositions:
          operation.nodePositions === undefined
            ? model.nodePositions
            : operation.nodePositions.map(({ nodeId, position }) => ({
                nodeId,
                position: { ...position },
              })),
      };
      return { model, catalogue, affectedId: model.modelId };
    }

    case "REPLACE_SNAPSHOT":
      return {
        model: cloneModel(operation.model),
        catalogue: cloneCatalogue(operation.catalogue),
        affectedId: operation.model.modelId,
      };
  }
}

interface FaultTreeAutoLayoutOptions {
  direction?: CanvasLayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalGap?: number;
  verticalGap?: number;
  origin?: { x: number; y: number };
}

function computeFaultTreeAutoLayout(
  model: FaultTreeEditorModel,
  options: FaultTreeAutoLayoutOptions = {},
): FaultTreeNodePosition[] {
  const direction = options.direction ?? model.layout.direction;
  const nodeWidth = options.nodeWidth ?? 184;
  const nodeHeight = options.nodeHeight ?? 66;
  const horizontalGap = options.horizontalGap ?? 24;
  const verticalGap = options.verticalGap ?? 84;
  const origin = options.origin ?? { x: 0, y: 0 };
  const nodeIds = [...model.gates.map(({ id }) => id), ...model.leafNodes.map(({ id }) => id)];
  const nodeIdSet = new Set(nodeIds);
  const stableIndex = new Map(nodeIds.map((id, index) => [id, index]));
  const outgoing = new Map<string, FaultTreeGateInput[]>();
  const indegree = new Map(nodeIds.map((id) => [id, 0]));

  for (const input of model.gateInputs) {
    if (!nodeIdSet.has(input.gateId) || !nodeIdSet.has(input.childId)) continue;
    const current = outgoing.get(input.gateId) ?? [];
    current.push(input);
    outgoing.set(input.gateId, current);
    indegree.set(input.childId, (indegree.get(input.childId) ?? 0) + 1);
  }
  for (const inputs of outgoing.values()) {
    inputs.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  const compareStable = (left: string, right: string): number => {
    if (left === model.topGate?.gateId) return -1;
    if (right === model.topGate?.gateId) return 1;
    return (stableIndex.get(left) ?? 0) - (stableIndex.get(right) ?? 0);
  };
  const pending = nodeIds.filter((id) => (indegree.get(id) ?? 0) === 0).sort(compareStable);
  const depths = new Map(nodeIds.map((id) => [id, 0]));
  const visited = new Set<string>();

  while (pending.length > 0) {
    const nodeId = pending.shift() as string;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    for (const input of outgoing.get(nodeId) ?? []) {
      depths.set(input.childId, Math.max(depths.get(input.childId) ?? 0, (depths.get(nodeId) ?? 0) + 1));
      const nextIndegree = (indegree.get(input.childId) ?? 1) - 1;
      indegree.set(input.childId, nextIndegree);
      if (nextIndegree === 0) {
        pending.push(input.childId);
        pending.sort(compareStable);
      }
    }
  }

  // Invalid cyclic drafts still receive stable positions instead of disappearing.
  let fallbackDepth = Math.max(0, ...depths.values());
  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) depths.set(nodeId, ++fallbackDepth);
  }

  const layers = new Map<number, string[]>();
  for (const nodeId of nodeIds) {
    const depth = depths.get(nodeId) ?? 0;
    const layer = layers.get(depth) ?? [];
    layer.push(nodeId);
    layers.set(depth, layer);
  }

  const columnStep = nodeWidth + horizontalGap;
  const rowStep = nodeHeight + verticalGap;
  const positions: FaultTreeNodePosition[] = [];
  for (const [depth, layer] of [...layers.entries()].sort(([left], [right]) => left - right)) {
    layer.sort(compareStable);
    layer.forEach((nodeId, index) => {
      const crossAxis = (index - (layer.length - 1) / 2) * columnStep;
      const depthAxis = depth * rowStep;
      positions.push({
        nodeId,
        position:
          direction === "TOP_TO_BOTTOM"
            ? { x: origin.x + crossAxis, y: origin.y + depthAxis }
            : { x: origin.x + depthAxis, y: origin.y + crossAxis },
      });
    });
  }
  return positions;
}

function createFaultTreeAutoLayoutOperation(
  model: FaultTreeEditorModel,
  options: FaultTreeAutoLayoutOptions = {},
): Extract<FaultTreeOperation, { type: "SET_LAYOUT" }> {
  const direction = options.direction ?? model.layout.direction;
  return {
    type: "SET_LAYOUT",
    layout: {
      ...model.layout,
      mode: "AUTOMATIC",
      direction,
      viewport: { ...model.layout.viewport },
    },
    nodePositions: computeFaultTreeAutoLayout(model, { ...options, direction }),
  };
}

export {
  FaultTreeOperationError,
  applyFaultTreeOperation,
  nextFaultTreeId,
  computeFaultTreeAutoLayout,
  createFaultTreeAutoLayoutOperation,
};
export type { FaultTreeOperationErrorCode, FaultTreeAutoLayoutOptions };
