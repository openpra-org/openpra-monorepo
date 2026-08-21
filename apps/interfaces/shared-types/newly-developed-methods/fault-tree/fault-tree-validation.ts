import {
  createAnalysisReadyValidationOutcome,
  createDraftValidationOutcome,
} from "../shared";
import type {
  AnalysisReadyValidationOutcome,
  DraftValidationOutcome,
  MethodEntityReference,
  ValidationIssue,
} from "../shared";
import type { FaultTreeBasicEventCatalogue, FaultTreeModel } from "./fault-tree-model";

interface FaultTreeValidationContext {
  basicEventCatalogue?: FaultTreeBasicEventCatalogue;
  availableTransferTargets?: MethodEntityReference[];
  faultTreeModels?: FaultTreeModel[];
}

const validateFaultTreeTopGate = (model: FaultTreeModel): ValidationIssue[] => {
  if (model.topGate === null) {
    return [
      {
        code: "FT_TOP_GATE_REQUIRED",
        severity: "ERROR",
        message: "The fault tree must define one top gate",
        entityId: model.id,
        fieldPath: ["topGate"],
      },
    ];
  }

  const topGateId = model.topGate.gateId;
  const matchingGates = model.gates.filter((gate) => gate.id === topGateId);
  if (matchingGates.length > 1) {
    return [
      {
        code: "FT_TOP_GATE_AMBIGUOUS",
        severity: "ERROR",
        message: "The top-gate reference must resolve to exactly one gate",
        entityId: topGateId,
        fieldPath: ["topGate", "gateId"],
      },
    ];
  }

  if (matchingGates.length === 1) return [];

  const referencesLeaf = model.leafNodes.some((leaf) => leaf.id === topGateId);
  return [
    {
      code: referencesLeaf ? "FT_TOP_GATE_MUST_REFERENCE_GATE" : "FT_TOP_GATE_NOT_FOUND",
      severity: "ERROR",
      message: referencesLeaf
        ? "The top-gate reference cannot target a leaf node"
        : "The top-gate reference does not resolve to a gate",
      entityId: topGateId,
      fieldPath: ["topGate", "gateId"],
    },
  ];
};

const validateFaultTreeIdentity = (model: FaultTreeModel): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const entityCodes = new Set<string>();

  const validateNode = (
    node: FaultTreeModel["gates"][number] | FaultTreeModel["leafNodes"][number],
    collection: "gates" | "leafNodes",
    index: number,
  ): void => {
    if (nodeIds.has(node.id)) {
      issues.push({
        code: "FT_DUPLICATE_NODE_ID",
        severity: "ERROR",
        message: "Fault-tree node ids must be unique",
        entityId: node.id,
        fieldPath: [collection, index, "id"],
      });
    }
    nodeIds.add(node.id);

    if (!("code" in node)) return;
    const normalizedCode = node.code.trim().toUpperCase();
    if (entityCodes.has(normalizedCode)) {
      issues.push({
        code: "FT_DUPLICATE_ENTITY_CODE",
        severity: "ERROR",
        message: "Fault-tree gate and local-event codes must be unique",
        entityId: node.id,
        fieldPath: [collection, index, "code"],
      });
    }
    entityCodes.add(normalizedCode);
  };

  model.gates.forEach((gate, index) => validateNode(gate, "gates", index));
  model.leafNodes.forEach((leaf, index) => validateNode(leaf, "leafNodes", index));

  const gateInputIds = new Set<string>();
  model.gateInputs.forEach((input, index) => {
    if (gateInputIds.has(input.id)) {
      issues.push({
        code: "FT_DUPLICATE_GATE_INPUT_ID",
        severity: "ERROR",
        message: "Fault-tree gate-input ids must be unique",
        entityId: input.id,
        fieldPath: ["gateInputs", index, "id"],
      });
    }
    gateInputIds.add(input.id);
  });

  const positionedNodeIds = new Set<string>();
  model.nodePositions.forEach((nodePosition, index) => {
    if (positionedNodeIds.has(nodePosition.nodeId)) {
      issues.push({
        code: "FT_DUPLICATE_NODE_POSITION",
        severity: "ERROR",
        message: "A fault-tree node can have only one saved canvas position",
        entityId: nodePosition.nodeId,
        fieldPath: ["nodePositions", index, "nodeId"],
      });
    }
    positionedNodeIds.add(nodePosition.nodeId);
  });

  return issues;
};

const validateFaultTreeGateInputs = (model: FaultTreeModel): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const gateCounts = new Map<string, number>();
  const nodeCounts = new Map<string, number>();

  model.gates.forEach((gate) => {
    gateCounts.set(gate.id, (gateCounts.get(gate.id) ?? 0) + 1);
    nodeCounts.set(gate.id, (nodeCounts.get(gate.id) ?? 0) + 1);
  });
  model.leafNodes.forEach((leaf) => {
    nodeCounts.set(leaf.id, (nodeCounts.get(leaf.id) ?? 0) + 1);
  });

  const ordersByGate = new Map<string, Set<number>>();
  const childrenByGate = new Map<string, Set<string>>();
  model.gateInputs.forEach((input, index) => {
    const gateCount = gateCounts.get(input.gateId) ?? 0;
    if (gateCount !== 1) {
      issues.push({
        code: gateCount === 0 ? "FT_GATE_INPUT_GATE_NOT_FOUND" : "FT_GATE_INPUT_GATE_AMBIGUOUS",
        severity: "ERROR",
        message:
          gateCount === 0
            ? "Gate input does not resolve to a parent gate"
            : "Gate input parent resolves to more than one gate",
        entityId: input.id,
        fieldPath: ["gateInputs", index, "gateId"],
      });
    }

    const childCount = nodeCounts.get(input.childId) ?? 0;
    if (childCount !== 1) {
      issues.push({
        code: childCount === 0 ? "FT_GATE_INPUT_CHILD_NOT_FOUND" : "FT_GATE_INPUT_CHILD_AMBIGUOUS",
        severity: "ERROR",
        message:
          childCount === 0
            ? "Gate input does not resolve to a child node"
            : "Gate input child resolves to more than one node",
        entityId: input.id,
        fieldPath: ["gateInputs", index, "childId"],
      });
    }

    const orders = ordersByGate.get(input.gateId) ?? new Set<number>();
    if (orders.has(input.order)) {
      issues.push({
        code: "FT_DUPLICATE_GATE_INPUT_ORDER",
        severity: "ERROR",
        message: "Input order must be unique within a gate",
        entityId: input.id,
        fieldPath: ["gateInputs", index, "order"],
      });
    }
    orders.add(input.order);
    ordersByGate.set(input.gateId, orders);

    const children = childrenByGate.get(input.gateId) ?? new Set<string>();
    if (children.has(input.childId)) {
      issues.push({
        code: "FT_DUPLICATE_GATE_INPUT_CHILD",
        severity: "ERROR",
        message: "A gate cannot reference the same child more than once",
        entityId: input.id,
        fieldPath: ["gateInputs", index, "childId"],
      });
    }
    children.add(input.childId);
    childrenByGate.set(input.gateId, children);
  });

  for (const [gateId, orders] of ordersByGate) {
    const sortedOrders = [...orders].sort((left, right) => left - right);
    sortedOrders.forEach((order, expectedOrder) => {
      if (order === expectedOrder) return;
      const inputIndex = model.gateInputs.findIndex((input) => input.gateId === gateId && input.order === order);
      const input = model.gateInputs[inputIndex];
      if (input === undefined) return;
      issues.push({
        code: "FT_GATE_INPUT_ORDER_GAP",
        severity: "ERROR",
        message: "Gate input order must be contiguous and start at zero",
        entityId: input.id,
        fieldPath: ["gateInputs", inputIndex, "order"],
      });
    });
  }

  model.gates.forEach((gate, gateIndex) => {
    if (gate.gateType !== "NOT") return;
    const childCount = model.gateInputs.filter((input) => input.gateId === gate.id).length;
    if (childCount === 1) return;
    issues.push({
      code: "FT_NOT_GATE_CHILD_COUNT",
      severity: "ERROR",
      message: "A NOT gate must have exactly one child",
      entityId: gate.id,
      fieldPath: ["gates", gateIndex, "gateType"],
    });
  });

  return issues;
};

const validateFaultTreeKOfN = (model: FaultTreeModel): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  model.gates.forEach((gate, gateIndex) => {
    if (gate.gateType !== "K_OF_N") return;
    const distinctChildCount = new Set(
      model.gateInputs.filter((input) => input.gateId === gate.id).map((input) => input.childId),
    ).size;
    if (gate.k <= distinctChildCount) return;

    issues.push({
      code: "FT_K_OF_N_THRESHOLD_EXCEEDS_INPUTS",
      severity: "ERROR",
      message: "K cannot exceed the number of distinct gate inputs",
      entityId: gate.id,
      fieldPath: ["gates", gateIndex, "k"],
    });
  });

  return issues;
};

const validateFaultTreeBooleanGraph = (model: FaultTreeModel): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const gateIds = new Set(model.gates.map((gate) => gate.id));
  const outgoingInputs = new Map<string, Array<{ childId: string; inputId: string; inputIndex: number }>>();

  model.gateInputs.forEach((input, inputIndex) => {
    if (!gateIds.has(input.gateId) || !gateIds.has(input.childId)) return;
    const outgoing = outgoingInputs.get(input.gateId) ?? [];
    outgoing.push({ childId: input.childId, inputId: input.id, inputIndex });
    outgoingInputs.set(input.gateId, outgoing);
  });

  const state = new Map<string, "VISITING" | "VISITED">();
  const visit = (gateId: string): void => {
    state.set(gateId, "VISITING");
    for (const input of outgoingInputs.get(gateId) ?? []) {
      const childState = state.get(input.childId);
      if (childState === "VISITING") {
        issues.push({
          code: "FT_BOOLEAN_CYCLE",
          severity: "ERROR",
          message: "Fault-tree Boolean logic cannot contain a cycle",
          entityId: input.inputId,
          fieldPath: ["gateInputs", input.inputIndex, "childId"],
        });
        continue;
      }
      if (childState !== "VISITED") visit(input.childId);
    }
    state.set(gateId, "VISITED");
  };

  for (const gateId of gateIds) {
    if (state.has(gateId)) continue;
    visit(gateId);
  }

  return issues;
};

const validateFaultTreeProbabilitiesAndTransfers = (
  model: FaultTreeModel,
  context: FaultTreeValidationContext = {},
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  model.leafNodes.forEach((leaf, leafIndex) => {
    if (leaf.kind === "BASIC_EVENT_REFERENCE") {
      const catalogue = context.basicEventCatalogue;
      const matches = catalogue?.basicEvents.filter((event) => event.id === leaf.basicEventId) ?? [];
      if (matches.length !== 1) {
        issues.push({
          code: matches.length === 0 ? "FT_BASIC_EVENT_NOT_FOUND" : "FT_BASIC_EVENT_AMBIGUOUS",
          severity: "ERROR",
          message:
            matches.length === 0
              ? "Basic-event reference does not resolve in the project catalogue"
              : "Basic-event reference resolves to more than one catalogue entry",
          entityId: leaf.id,
          fieldPath: ["leafNodes", leafIndex, "basicEventId"],
        });
        return;
      }

      if (catalogue?.projectId !== model.projectId) {
        issues.push({
          code: "FT_BASIC_EVENT_CATALOGUE_PROJECT_MISMATCH",
          severity: "ERROR",
          message: "Basic-event catalogue must belong to the same project as the fault tree",
          entityId: leaf.id,
          fieldPath: ["leafNodes", leafIndex, "basicEventId"],
        });
      }

      const basicEvent = matches[0];
      if (
        basicEvent !== undefined &&
        (!Number.isFinite(basicEvent.probability.value) ||
          basicEvent.probability.value < 0 ||
          basicEvent.probability.value > 1)
      ) {
        issues.push({
          code: "FT_BASIC_EVENT_PROBABILITY_INVALID",
          severity: "ERROR",
          message: "Basic-event probability must be finite and between zero and one",
          entityId: basicEvent.id,
          fieldPath: ["basicEvents", catalogue?.basicEvents.indexOf(basicEvent) ?? 0, "probability", "value"],
        });
      }
      return;
    }

    if (leaf.kind !== "TRANSFER_REFERENCE") return;
    const matches = (context.availableTransferTargets ?? []).filter(
      (target) => target.modelId === leaf.target.modelId && target.entityId === leaf.target.entityId,
    );
    if (matches.length === 1) return;
    issues.push({
      code: matches.length === 0 ? "FT_TRANSFER_TARGET_NOT_FOUND" : "FT_TRANSFER_TARGET_AMBIGUOUS",
      severity: "ERROR",
      message:
        matches.length === 0
          ? "Transfer reference does not resolve to an available fault-tree gate"
          : "Transfer reference resolves to more than one fault-tree gate",
      entityId: leaf.id,
      fieldPath: ["leafNodes", leafIndex, "target"],
    });
  });

  return issues;
};

interface FaultTreeTransferEdge {
  sourceModelId: string;
  targetModelId: string;
  transferId: string;
  leafIndex: number;
}

const validateFaultTreeTransferCycles = (
  model: FaultTreeModel,
  context: FaultTreeValidationContext = {},
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const issueTransferIds = new Set<string>();
  const modelsById = new Map<string, FaultTreeModel>();
  for (const availableModel of context.faultTreeModels ?? []) {
    modelsById.set(availableModel.id, availableModel);
  }
  modelsById.set(model.id, model);

  const outgoingByModel = new Map<string, FaultTreeTransferEdge[]>();
  for (const availableModel of modelsById.values()) {
    availableModel.leafNodes.forEach((leaf, leafIndex) => {
      if (leaf.kind !== "TRANSFER_REFERENCE" || !modelsById.has(leaf.target.modelId)) return;
      const edges = outgoingByModel.get(availableModel.id) ?? [];
      edges.push({
        sourceModelId: availableModel.id,
        targetModelId: leaf.target.modelId,
        transferId: leaf.id,
        leafIndex,
      });
      outgoingByModel.set(availableModel.id, edges);
    });
  }

  const state = new Map<string, "VISITING" | "VISITED">();
  const modelStack: string[] = [];
  const edgeStack: FaultTreeTransferEdge[] = [];
  const reportCycleEdge = (edge: FaultTreeTransferEdge): void => {
    if (issueTransferIds.has(edge.transferId)) return;
    issueTransferIds.add(edge.transferId);
    issues.push({
      code: "FT_TRANSFER_CYCLE",
      severity: "ERROR",
      message: "Fault-tree transfers cannot form a dependency cycle",
      entityId: edge.transferId,
      fieldPath: ["leafNodes", edge.leafIndex, "target"],
    });
  };
  const visit = (modelId: string): void => {
    state.set(modelId, "VISITING");
    modelStack.push(modelId);
    for (const edge of outgoingByModel.get(modelId) ?? []) {
      const targetState = state.get(edge.targetModelId);
      if (targetState === "VISITING") {
        const cycleStart = modelStack.lastIndexOf(edge.targetModelId);
        for (const cycleEdge of edgeStack.slice(cycleStart)) reportCycleEdge(cycleEdge);
        reportCycleEdge(edge);
        continue;
      }
      if (targetState === "VISITED") continue;
      edgeStack.push(edge);
      visit(edge.targetModelId);
      edgeStack.pop();
    }
    modelStack.pop();
    state.set(modelId, "VISITED");
  };

  visit(model.id);
  return issues;
};

const validateFaultTreeReachability = (model: FaultTreeModel): ValidationIssue[] => {
  if (model.topGate === null) return [];
  const matchingTopGates = model.gates.filter((gate) => gate.id === model.topGate?.gateId);
  if (matchingTopGates.length !== 1) return [];

  const nodeIds = new Set([...model.gates.map((gate) => gate.id), ...model.leafNodes.map((leaf) => leaf.id)]);
  const childIdsByGate = new Map<string, string[]>();
  model.gateInputs.forEach((input) => {
    if (!nodeIds.has(input.childId)) return;
    const childIds = childIdsByGate.get(input.gateId) ?? [];
    childIds.push(input.childId);
    childIdsByGate.set(input.gateId, childIds);
  });

  const reachableNodeIds = new Set<string>();
  const visit = (nodeId: string): void => {
    if (reachableNodeIds.has(nodeId)) return;
    reachableNodeIds.add(nodeId);
    for (const childId of childIdsByGate.get(nodeId) ?? []) visit(childId);
  };
  visit(model.topGate.gateId);

  const issues: ValidationIssue[] = [];
  const reportUnreachable = (
    node: FaultTreeModel["gates"][number] | FaultTreeModel["leafNodes"][number],
    collection: "gates" | "leafNodes",
    index: number,
  ): void => {
    if (reachableNodeIds.has(node.id)) return;
    issues.push({
      code: "FT_NODE_UNREACHABLE",
      severity: "ERROR",
      message: "Analysis nodes must be reachable from the top gate",
      entityId: node.id,
      fieldPath: [collection, index],
    });
  };
  model.gates.forEach((gate, index) => reportUnreachable(gate, "gates", index));
  model.leafNodes.forEach((leaf, index) => reportUnreachable(leaf, "leafNodes", index));

  return issues;
};

const validateFaultTreeModel = (
  model: FaultTreeModel,
  context: FaultTreeValidationContext = {},
): ValidationIssue[] => [
  ...validateFaultTreeTopGate(model),
  ...validateFaultTreeIdentity(model),
  ...validateFaultTreeGateInputs(model),
  ...validateFaultTreeKOfN(model),
  ...validateFaultTreeBooleanGraph(model),
  ...validateFaultTreeProbabilitiesAndTransfers(model, context),
  ...validateFaultTreeTransferCycles(model, context),
  ...validateFaultTreeReachability(model),
];

const validateFaultTreeDraft = (
  model: FaultTreeModel,
  validatedAt: string,
  context: FaultTreeValidationContext = {},
): DraftValidationOutcome =>
  createDraftValidationOutcome({
    modelId: model.id,
    revision: model.revision,
    issues: validateFaultTreeModel(model, context),
    validatedAt,
  });

const validateFaultTreeAnalysisReady = (
  model: FaultTreeModel,
  validatedAt: string,
  context: FaultTreeValidationContext = {},
): AnalysisReadyValidationOutcome =>
  createAnalysisReadyValidationOutcome({
    modelId: model.id,
    revision: model.revision,
    issues: validateFaultTreeModel(model, context),
    validatedAt,
  });

export {
  validateFaultTreeTopGate,
  validateFaultTreeIdentity,
  validateFaultTreeGateInputs,
  validateFaultTreeKOfN,
  validateFaultTreeBooleanGraph,
  validateFaultTreeProbabilitiesAndTransfers,
  validateFaultTreeTransferCycles,
  validateFaultTreeReachability,
  validateFaultTreeModel,
  validateFaultTreeDraft,
  validateFaultTreeAnalysisReady,
};
export type { FaultTreeValidationContext };
