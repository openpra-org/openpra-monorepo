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
      ...(basicEvent.probability.quantificationBasis === undefined
        ? {}
        : { quantificationBasis: structuredClone(basicEvent.probability.quantificationBasis) }),
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

  const columnStep = nodeWidth + horizontalGap;
  const rowStep = nodeHeight + verticalGap;
  const gateIds = new Set(model.gates.map(({ id }) => id));

  if (direction === "TOP_TO_BOTTOM") {
    interface LayoutBlock {
      positions: Map<string, FaultTreeNodePosition["position"]>;
      width: number;
      height: number;
    }
    const nodeById = new Map<string, FaultTreeGate | FaultTreeLeafNode>([
      ...model.gates.map((gate) => [gate.id, gate] as const),
      ...model.leafNodes.map((leaf) => [leaf.id, leaf] as const),
    ]);
    const incomingByChild = new Map<string, FaultTreeGateInput[]>();
    for (const input of model.gateInputs) {
      if (!nodeById.has(input.childId) || !gateIds.has(input.gateId)) continue;
      const incoming = incomingByChild.get(input.childId) ?? [];
      incoming.push(input);
      incomingByChild.set(input.childId, incoming);
    }
    const primaryInputByChild = new Map<string, FaultTreeGateInput>();
    for (const [childId, incoming] of incomingByChild) {
      const primary = [...incoming].sort((left, right) => {
        const depthDifference = (depths.get(right.gateId) ?? 0) - (depths.get(left.gateId) ?? 0);
        return depthDifference
          || compareStable(left.gateId, right.gateId)
          || left.order - right.order
          || left.id.localeCompare(right.id);
      })[0];
      if (primary !== undefined) primaryInputByChild.set(childId, primary);
    }

    const leafStackStep = rowStep;
    const blockGap = horizontalGap + 48;
    const visitingGates = new Set<string>();
    const blockByGate = new Map<string, LayoutBlock>();
    const terminalBlock = (nodeId: string): LayoutBlock => ({
      positions: new Map([[nodeId, { x: 0, y: 0 }]]),
      width: nodeWidth,
      height: nodeHeight,
    });
    const basicEventBlock = (nodeIds: string[]): LayoutBlock => {
      const railSpace = 16;
      return {
        positions: new Map(nodeIds.map((nodeId, index) => [
          nodeId,
          { x: railSpace, y: index * leafStackStep },
        ])),
        width: railSpace + nodeWidth,
        height: nodeHeight + Math.max(0, nodeIds.length - 1) * leafStackStep,
      };
    };
    const gateBlock = (gateId: string): LayoutBlock => {
      const cached = blockByGate.get(gateId);
      if (cached !== undefined) return cached;
      if (visitingGates.has(gateId)) return terminalBlock(gateId);
      visitingGates.add(gateId);

      const ownedChildren = (outgoing.get(gateId) ?? []).flatMap((input) => {
        const child = nodeById.get(input.childId);
        return child !== undefined && primaryInputByChild.get(child.id)?.id === input.id ? [child] : [];
      });
      const basicEvents = ownedChildren.filter(({ kind }) => kind === "BASIC_EVENT_REFERENCE");
      const childGates = ownedChildren.filter(({ kind }) => kind === "GATE");
      const otherEvents = ownedChildren.filter(({ kind }) =>
        kind !== "BASIC_EVENT_REFERENCE" && kind !== "GATE" && kind !== "TRANSFER_REFERENCE");
      const transfers = ownedChildren.filter(({ kind }) => kind === "TRANSFER_REFERENCE");
      const childBlocks: LayoutBlock[] = [
        ...(basicEvents.length === 0 ? [] : [basicEventBlock(basicEvents.map(({ id }) => id))]),
        ...otherEvents.map(({ id }) => terminalBlock(id)),
        ...childGates.flatMap(({ id }) => visitingGates.has(id) ? [] : [gateBlock(id)]),
        ...transfers.map(({ id }) => terminalBlock(id)),
      ];

      const contentWidth = childBlocks.reduce((total, block) => total + block.width, 0)
        + Math.max(0, childBlocks.length - 1) * blockGap;
      const width = Math.max(nodeWidth, contentWidth);
      const positionsInBlock = new Map<string, FaultTreeNodePosition["position"]>([
        [gateId, { x: (width - nodeWidth) / 2, y: 0 }],
      ]);
      let cursorX = (width - contentWidth) / 2;
      let childHeight = 0;
      childBlocks.forEach((block) => {
        block.positions.forEach((position, nodeId) => {
          positionsInBlock.set(nodeId, {
            x: cursorX + position.x,
            y: rowStep + position.y,
          });
        });
        childHeight = Math.max(childHeight, block.height);
        cursorX += block.width + blockGap;
      });
      visitingGates.delete(gateId);
      const block = {
        positions: positionsInBlock,
        width,
        height: childBlocks.length === 0 ? nodeHeight : rowStep + childHeight,
      };
      blockByGate.set(gateId, block);
      return block;
    };

    const positioned = new Map<string, FaultTreeNodePosition["position"]>();
    let forestX = origin.x;
    let forestHeight = 0;
    const placeBlock = (block: LayoutBlock): void => {
      block.positions.forEach((position, nodeId) => {
        if (!positioned.has(nodeId)) {
          positioned.set(nodeId, { x: forestX + position.x, y: origin.y + position.y });
        }
      });
      forestX += block.width + blockGap;
      forestHeight = Math.max(forestHeight, block.height);
    };

    if (model.topGate !== null && gateIds.has(model.topGate.gateId)) {
      placeBlock(gateBlock(model.topGate.gateId));
    }
    model.gates.map(({ id }) => id).sort(compareStable).forEach((gateId) => {
      if (!positioned.has(gateId)) placeBlock(gateBlock(gateId));
    });

    const unpositionedLeaves = model.leafNodes.filter(({ id }) => !positioned.has(id));
    const orphanY = origin.y + forestHeight + rowStep;
    let orphanX = origin.x;
    unpositionedLeaves.forEach(({ id }) => {
      positioned.set(id, { x: orphanX, y: orphanY });
      orphanX += columnStep;
    });

    return nodeIds.map((nodeId) => ({
      nodeId,
      position: positioned.get(nodeId) ?? { x: origin.x, y: origin.y },
    }));
  }

  const nodeById = new Map<string, FaultTreeGate | FaultTreeLeafNode>([
    ...model.gates.map((gate) => [gate.id, gate] as const),
    ...model.leafNodes.map((leaf) => [leaf.id, leaf] as const),
  ]);
  const transferIds = new Set(
    model.leafNodes.flatMap((leaf) => leaf.kind === "TRANSFER_REFERENCE" ? [leaf.id] : []),
  );
  const terminalOrder: string[] = [];
  const orderedTerminals = new Set<string>();
  const visitedGates = new Set<string>();
  const visitingGates = new Set<string>();
  const addTerminal = (nodeId: string): void => {
    if (orderedTerminals.has(nodeId) || transferIds.has(nodeId)) return;
    orderedTerminals.add(nodeId);
    terminalOrder.push(nodeId);
  };
  const visitGate = (gateId: string): void => {
    if (visitedGates.has(gateId) || visitingGates.has(gateId)) return;
    visitingGates.add(gateId);
    for (const input of outgoing.get(gateId) ?? []) {
      const child = nodeById.get(input.childId);
      if (child?.kind === "GATE") visitGate(child.id);
      else if (child !== undefined) addTerminal(child.id);
    }
    visitingGates.delete(gateId);
    visitedGates.add(gateId);
  };

  if (model.topGate !== null) visitGate(model.topGate.gateId);
  model.gates.map(({ id }) => id).sort(compareStable).forEach(visitGate);
  model.leafNodes.map(({ id }) => id).sort(compareStable).forEach(addTerminal);

  const laneStep = rowStep + 48;
  const positionById = new Map<string, FaultTreeNodePosition["position"]>();
  const basicEventIds = new Set(
    model.leafNodes.flatMap((leaf) => leaf.kind === "BASIC_EVENT_REFERENCE" ? [leaf.id] : []),
  );
  const stackedBasicEvents = terminalOrder.filter((nodeId) => basicEventIds.has(nodeId));
  const horizontalTerminals = terminalOrder.filter((nodeId) => !basicEventIds.has(nodeId));
  stackedBasicEvents.forEach((nodeId, index) => {
    positionById.set(nodeId, { x: origin.x, y: origin.y + index * laneStep });
  });
  const horizontalTerminalY = origin.y + stackedBasicEvents.length * laneStep;
  horizontalTerminals.forEach((nodeId, index) => {
    positionById.set(nodeId, { x: origin.x + index * columnStep, y: horizontalTerminalY });
  });

  const deepestGateDepth = Math.max(0, ...model.gates.map(({ id }) => depths.get(id) ?? 0));
  const inputBandColumns = Math.max(1, horizontalTerminals.length);
  const gateLayers = new Map<number, string[]>();
  for (const gate of model.gates) {
    const depth = depths.get(gate.id) ?? 0;
    const layer = gateLayers.get(depth) ?? [];
    layer.push(gate.id);
    gateLayers.set(depth, layer);
  }
  const desiredGateY = (gateId: string): number => {
    const childYs = (outgoing.get(gateId) ?? [])
      .filter(({ childId }) => !transferIds.has(childId))
      .flatMap(({ childId }) => {
        const position = positionById.get(childId);
        return position === undefined ? [] : [position.y];
      });
    if (childYs.length === 0) return origin.y + (stableIndex.get(gateId) ?? 0) * laneStep;
    return (Math.min(...childYs) + Math.max(...childYs)) / 2;
  };

  for (const [depth, gateLayer] of [...gateLayers.entries()].sort(([left], [right]) => right - left)) {
    const ranked = gateLayer
      .map((nodeId) => ({ nodeId, desiredY: desiredGateY(nodeId) }))
      .sort((left, right) => left.desiredY - right.desiredY || compareStable(left.nodeId, right.nodeId));
    let previousY = Number.NEGATIVE_INFINITY;
    for (const { nodeId, desiredY } of ranked) {
      const y = Math.max(desiredY, previousY + laneStep);
      positionById.set(nodeId, {
        x: origin.x + (inputBandColumns + deepestGateDepth - depth) * columnStep,
        y,
      });
      previousY = y;
    }
  }

  const incomingByChild = new Map<string, FaultTreeGateInput[]>();
  for (const input of model.gateInputs) {
    const incoming = incomingByChild.get(input.childId) ?? [];
    incoming.push(input);
    incomingByChild.set(input.childId, incoming);
  }
  const transferX = origin.x + (inputBandColumns + deepestGateDepth + 1) * columnStep;
  const rankedTransfers = model.leafNodes
    .filter((leaf) => leaf.kind === "TRANSFER_REFERENCE")
    .map((leaf) => {
      const parentYs = (incomingByChild.get(leaf.id) ?? []).flatMap(({ gateId }) => {
        const position = positionById.get(gateId);
        return position === undefined ? [] : [position.y];
      });
      return {
        nodeId: leaf.id,
        desiredY: parentYs.length === 0
          ? origin.y + (stableIndex.get(leaf.id) ?? 0) * laneStep
          : parentYs.reduce((total, y) => total + y, 0) / parentYs.length,
      };
    })
    .sort((left, right) => left.desiredY - right.desiredY || compareStable(left.nodeId, right.nodeId));
  let previousTransferY = Number.NEGATIVE_INFINITY;
  for (const { nodeId, desiredY } of rankedTransfers) {
    const y = Math.max(desiredY, previousTransferY + laneStep);
    positionById.set(nodeId, { x: transferX, y });
    previousTransferY = y;
  }

  return nodeIds.map((nodeId) => ({
    nodeId,
    position: positionById.get(nodeId) ?? { x: origin.x, y: origin.y },
  }));
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
