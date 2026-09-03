import { createAnalysisReadyValidationOutcome, createDraftValidationOutcome } from "../shared";
import type {
  AnalysisReadyValidationOutcome,
  DraftValidationOutcome,
  ValidationIssue,
  WorkbookId,
  WorkbookModelSnapshotIdentity,
} from "../shared";
import type { HclEventBinding } from "../hybrid-causal-logic/hcl-bindings";
import type {
  BayesianNetworkConditionalProbabilityTable,
  BayesianNetworkEvidenceConfiguration,
  BayesianNetworkModel,
} from "./bayesian-network-model";

interface BayesianNetworkValidationContext {
  evidence?: BayesianNetworkEvidenceConfiguration;
  hclBindings?: HclEventBinding[];
  workbookId?: WorkbookId;
}

const validateBayesianNetworkIdentity = (model: BayesianNetworkModel): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const nodeCodes = new Set<string>();

  model.nodes.forEach((node, nodeIndex) => {
    if (nodeIds.has(node.id)) {
      issues.push({
        code: "BN_DUPLICATE_NODE_ID",
        severity: "ERROR",
        message: "Bayesian-network node ids must be unique",
        entityId: node.id,
        fieldPath: ["nodes", nodeIndex, "id"],
      });
    }
    nodeIds.add(node.id);

    const normalizedNodeCode = node.code.trim().toUpperCase();
    if (nodeCodes.has(normalizedNodeCode)) {
      issues.push({
        code: "BN_DUPLICATE_NODE_CODE",
        severity: "ERROR",
        message: "Bayesian-network node codes must be unique",
        entityId: node.id,
        fieldPath: ["nodes", nodeIndex, "code"],
      });
    }
    nodeCodes.add(normalizedNodeCode);

    const stateIds = new Set<string>();
    const stateCodes = new Set<string>();
    node.states.forEach((state, stateIndex) => {
      if (stateIds.has(state.id)) {
        issues.push({
          code: "BN_DUPLICATE_STATE_ID",
          severity: "ERROR",
          message: "State ids must be unique within a Bayesian-network node",
          entityId: state.id,
          fieldPath: ["nodes", nodeIndex, "states", stateIndex, "id"],
        });
      }
      stateIds.add(state.id);

      const normalizedStateCode = state.code.trim().toUpperCase();
      if (stateCodes.has(normalizedStateCode)) {
        issues.push({
          code: "BN_DUPLICATE_STATE_CODE",
          severity: "ERROR",
          message: "State codes must be unique within a Bayesian-network node",
          entityId: state.id,
          fieldPath: ["nodes", nodeIndex, "states", stateIndex, "code"],
        });
      }
      stateCodes.add(normalizedStateCode);
    });
  });

  return issues;
};

const validateBayesianNetworkNodeStateCount = (model: BayesianNetworkModel): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  model.nodes.forEach((node, nodeIndex) => {
    if (node.states.length >= 2) return;
    issues.push({
      code: "BN_NODE_STATES_MINIMUM",
      severity: "ERROR",
      message: "Each Bayesian-network node must define at least two states",
      entityId: node.id,
      fieldPath: ["nodes", nodeIndex, "states"],
    });
  });

  return issues;
};

const validateBayesianNetworkGraph = (model: BayesianNetworkModel): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const nodeCounts = new Map<string, number>();
  model.nodes.forEach((node) => nodeCounts.set(node.id, (nodeCounts.get(node.id) ?? 0) + 1));

  const validEdges: Array<{ edge: BayesianNetworkModel["edges"][number]; index: number }> = [];
  model.edges.forEach((edge, edgeIndex) => {
    const parentCount = nodeCounts.get(edge.parentNodeId) ?? 0;
    if (parentCount !== 1) {
      issues.push({
        code: parentCount === 0 ? "BN_EDGE_PARENT_NOT_FOUND" : "BN_EDGE_PARENT_AMBIGUOUS",
        severity: "ERROR",
        message:
          parentCount === 0
            ? "The edge parent reference does not resolve to a node"
            : "The edge parent reference must resolve to exactly one node",
        entityId: edge.parentNodeId,
        fieldPath: ["edges", edgeIndex, "parentNodeId"],
      });
    }

    const childCount = nodeCounts.get(edge.childNodeId) ?? 0;
    if (childCount !== 1) {
      issues.push({
        code: childCount === 0 ? "BN_EDGE_CHILD_NOT_FOUND" : "BN_EDGE_CHILD_AMBIGUOUS",
        severity: "ERROR",
        message:
          childCount === 0
            ? "The edge child reference does not resolve to a node"
            : "The edge child reference must resolve to exactly one node",
        entityId: edge.childNodeId,
        fieldPath: ["edges", edgeIndex, "childNodeId"],
      });
    }

    if (parentCount === 1 && childCount === 1) validEdges.push({ edge, index: edgeIndex });
  });

  model.conditionalProbabilityTables.forEach((table, tableIndex) => {
    table.parents.forEach((parent, parentIndex) => {
      const parentCount = nodeCounts.get(parent.nodeId) ?? 0;
      if (parentCount !== 1) {
        issues.push({
          code: parentCount === 0 ? "BN_CPT_PARENT_NOT_FOUND" : "BN_CPT_PARENT_AMBIGUOUS",
          severity: "ERROR",
          message:
            parentCount === 0
              ? "The CPT parent reference does not resolve to a node"
              : "The CPT parent reference must resolve to exactly one node",
          entityId: parent.nodeId,
          fieldPath: ["conditionalProbabilityTables", tableIndex, "parents", parentIndex, "nodeId"],
        });
        return;
      }

      const hasMatchingEdge = validEdges.some(
        ({ edge }) => edge.parentNodeId === parent.nodeId && edge.childNodeId === table.nodeId,
      );
      if (hasMatchingEdge) return;
      issues.push({
        code: "BN_CPT_PARENT_EDGE_REQUIRED",
        severity: "ERROR",
        message: "Each CPT parent reference must have a matching directed edge",
        entityId: parent.nodeId,
        fieldPath: ["conditionalProbabilityTables", tableIndex, "parents", parentIndex, "nodeId"],
      });
    });
  });

  const outgoingEdges = new Map<string, typeof validEdges>();
  validEdges.forEach((validEdge) => {
    const outgoing = outgoingEdges.get(validEdge.edge.parentNodeId) ?? [];
    outgoing.push(validEdge);
    outgoingEdges.set(validEdge.edge.parentNodeId, outgoing);
  });

  type VisitState = "VISITING" | "VISITED";
  const visitState = new Map<string, VisitState>();
  const nodeStack: string[] = [];
  const edgeStack: typeof validEdges = [];
  const reportedEdgeIndexes = new Set<number>();
  const reportCycleEdge = ({ edge, index }: (typeof validEdges)[number]): void => {
    if (reportedEdgeIndexes.has(index)) return;
    reportedEdgeIndexes.add(index);
    issues.push({
      code: "BN_DIRECTED_CYCLE",
      severity: "ERROR",
      message: "Bayesian-network edges cannot form a directed cycle",
      entityId: edge.id,
      fieldPath: ["edges", index],
    });
  };
  const visit = (nodeId: string): void => {
    visitState.set(nodeId, "VISITING");
    nodeStack.push(nodeId);
    for (const validEdge of outgoingEdges.get(nodeId) ?? []) {
      const childNodeId = validEdge.edge.childNodeId;
      const childState = visitState.get(childNodeId);
      if (childState === "VISITING") {
        const cycleStart = nodeStack.lastIndexOf(childNodeId);
        edgeStack.slice(cycleStart).forEach(reportCycleEdge);
        reportCycleEdge(validEdge);
        continue;
      }
      if (childState === "VISITED") continue;
      edgeStack.push(validEdge);
      visit(childNodeId);
      edgeStack.pop();
    }
    nodeStack.pop();
    visitState.set(nodeId, "VISITED");
  };

  model.nodes.forEach((node) => {
    if (!visitState.has(node.id) && nodeCounts.get(node.id) === 1) visit(node.id);
  });

  return issues;
};

const validateBayesianNetworkCpts = (model: BayesianNetworkModel): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const nodeCounts = new Map<string, number>();
  model.nodes.forEach((node) => nodeCounts.set(node.id, (nodeCounts.get(node.id) ?? 0) + 1));

  model.nodes.forEach((node) => {
    const matchingTableIndexes = model.conditionalProbabilityTables.flatMap((table, tableIndex) =>
      table.nodeId === node.id ? [tableIndex] : [],
    );
    if (matchingTableIndexes.length === 0) {
      issues.push({
        code: "BN_CPT_REQUIRED",
        severity: "ERROR",
        message: "Each Bayesian-network node must define a conditional probability table",
        entityId: node.id,
        fieldPath: ["conditionalProbabilityTables"],
      });
      return;
    }
    matchingTableIndexes.slice(1).forEach((tableIndex) => {
      issues.push({
        code: "BN_CPT_DUPLICATE",
        severity: "ERROR",
        message: "Each Bayesian-network node can define only one conditional probability table",
        entityId: node.id,
        fieldPath: ["conditionalProbabilityTables", tableIndex, "nodeId"],
      });
    });
  });

  model.conditionalProbabilityTables.forEach((table, tableIndex) => {
    const targetNodes = model.nodes.filter((node) => node.id === table.nodeId);
    if (targetNodes.length !== 1) {
      issues.push({
        code: targetNodes.length === 0 ? "BN_CPT_NODE_NOT_FOUND" : "BN_CPT_NODE_AMBIGUOUS",
        severity: "ERROR",
        message:
          targetNodes.length === 0
            ? "The CPT node reference does not resolve to a node"
            : "The CPT node reference must resolve to exactly one node",
        entityId: table.nodeId,
        fieldPath: ["conditionalProbabilityTables", tableIndex, "nodeId"],
      });
      return;
    }
    const targetNode = targetNodes[0];

    const declaredParentIds = new Set<string>();
    const parentOrders = new Set<number>();
    let parentOrderValid = true;
    table.parents.forEach((parent, parentIndex) => {
      if (declaredParentIds.has(parent.nodeId)) {
        issues.push({
          code: "BN_CPT_DUPLICATE_PARENT",
          severity: "ERROR",
          message: "A CPT can declare each parent only once",
          entityId: parent.nodeId,
          fieldPath: ["conditionalProbabilityTables", tableIndex, "parents", parentIndex, "nodeId"],
        });
      }
      declaredParentIds.add(parent.nodeId);

      if (parent.order >= table.parents.length || parentOrders.has(parent.order)) parentOrderValid = false;
      parentOrders.add(parent.order);
    });
    if (!parentOrderValid || parentOrders.size !== table.parents.length) {
      issues.push({
        code: "BN_CPT_PARENT_ORDER_INVALID",
        severity: "ERROR",
        message: "CPT parent order must be unique and contiguous from zero",
        entityId: targetNode.id,
        fieldPath: ["conditionalProbabilityTables", tableIndex, "parents"],
      });
    }

    model.edges.forEach((edge) => {
      if (edge.childNodeId !== targetNode.id || nodeCounts.get(edge.parentNodeId) !== 1) return;
      if (declaredParentIds.has(edge.parentNodeId)) return;
      issues.push({
        code: "BN_CPT_PARENT_MISSING",
        severity: "ERROR",
        message: "The CPT must declare every parent represented by an incoming edge",
        entityId: edge.id,
        fieldPath: ["conditionalProbabilityTables", tableIndex, "parents"],
      });
    });

    const orderedParents = [...table.parents].sort((left, right) => left.order - right.order);
    const parentNodes = orderedParents.map((parent) => {
      const matchingNodes = model.nodes.filter((node) => node.id === parent.nodeId);
      return matchingNodes.length === 1 ? matchingNodes[0] : null;
    });
    const canValidateCombinations =
      parentOrderValid && declaredParentIds.size === table.parents.length && parentNodes.every((node) => node !== null);
    if (canValidateCombinations) {
      const expectedRowCount = parentNodes.reduce((count, parentNode) => count * parentNode!.states.length, 1);
      if (table.rows.length !== expectedRowCount) {
        issues.push({
          code: "BN_CPT_ROW_COUNT_MISMATCH",
          severity: "ERROR",
          message: `The CPT must define ${expectedRowCount} row${expectedRowCount === 1 ? "" : "s"} for its parent states`,
          entityId: targetNode.id,
          fieldPath: ["conditionalProbabilityTables", tableIndex, "rows"],
        });
      }
    }

    const parentCombinationKeys = new Set<string>();
    table.rows.forEach((row, rowIndex) => {
      const selectedStates = new Map<string, string>();
      let parentStatesValid = canValidateCombinations;
      row.parentStates.forEach((selection, selectionIndex) => {
        const declaredParent = table.parents.find((parent) => parent.nodeId === selection.parentNodeId);
        if (declaredParent === undefined || selectedStates.has(selection.parentNodeId)) {
          parentStatesValid = false;
          issues.push({
            code:
              declaredParent === undefined ? "BN_CPT_ROW_PARENT_UNEXPECTED" : "BN_CPT_ROW_PARENT_DUPLICATE",
            severity: "ERROR",
            message:
              declaredParent === undefined
                ? "A CPT row can select states only for declared parents"
                : "A CPT row can select only one state per parent",
            entityId: row.id,
            fieldPath: [
              "conditionalProbabilityTables",
              tableIndex,
              "rows",
              rowIndex,
              "parentStates",
              selectionIndex,
            ],
          });
          return;
        }

        const parentNode = model.nodes.find((node) => node.id === selection.parentNodeId);
        if (parentNode === undefined || !parentNode.states.some((state) => state.id === selection.stateId)) {
          parentStatesValid = false;
          issues.push({
            code: "BN_CPT_ROW_PARENT_STATE_INVALID",
            severity: "ERROR",
            message: "The selected parent state must belong to the referenced parent node",
            entityId: selection.stateId,
            fieldPath: [
              "conditionalProbabilityTables",
              tableIndex,
              "rows",
              rowIndex,
              "parentStates",
              selectionIndex,
              "stateId",
            ],
          });
        }
        selectedStates.set(selection.parentNodeId, selection.stateId);
      });

      if (selectedStates.size !== table.parents.length) {
        parentStatesValid = false;
        issues.push({
          code: "BN_CPT_ROW_PARENT_STATES_INCOMPLETE",
          severity: "ERROR",
          message: "A CPT row must select exactly one state for every declared parent",
          entityId: row.id,
          fieldPath: ["conditionalProbabilityTables", tableIndex, "rows", rowIndex, "parentStates"],
        });
      }

      if (parentStatesValid) {
        const combinationKey = orderedParents
          .map((parent) => `${parent.nodeId}:${selectedStates.get(parent.nodeId)}`)
          .join("|");
        if (parentCombinationKeys.has(combinationKey)) {
          issues.push({
            code: "BN_CPT_DUPLICATE_PARENT_COMBINATION",
            severity: "ERROR",
            message: "CPT rows must define each parent-state combination exactly once",
            entityId: row.id,
            fieldPath: ["conditionalProbabilityTables", tableIndex, "rows", rowIndex, "parentStates"],
          });
        }
        parentCombinationKeys.add(combinationKey);
      }

      const valueStateIds = new Set(row.values.map((value) => value.stateId));
      const valuesMatchTargetStates =
        valueStateIds.size === row.values.length &&
        row.values.length === targetNode.states.length &&
        targetNode.states.every((state) => valueStateIds.has(state.id));
      if (!valuesMatchTargetStates) {
        issues.push({
          code: "BN_CPT_VALUE_STATES_MISMATCH",
          severity: "ERROR",
          message: "Each CPT row must assign one probability to every state of its node",
          entityId: row.id,
          fieldPath: ["conditionalProbabilityTables", tableIndex, "rows", rowIndex, "values"],
        });
      }

      let probabilitiesValid = true;
      row.values.forEach((value, valueIndex) => {
        if (Number.isFinite(value.probability) && value.probability >= 0 && value.probability <= 1) return;
        probabilitiesValid = false;
        issues.push({
          code: "BN_CPT_PROBABILITY_INVALID",
          severity: "ERROR",
          message: "CPT probabilities must be finite values between zero and one",
          entityId: row.id,
          fieldPath: ["conditionalProbabilityTables", tableIndex, "rows", rowIndex, "values", valueIndex, "probability"],
        });
      });
      const probabilityTotal = row.values.reduce((sum, value) => sum + value.probability, 0);
      if (probabilitiesValid && Math.abs(probabilityTotal - 1) > 1e-9) {
        issues.push({
          code: "BN_CPT_ROW_NOT_NORMALIZED",
          severity: "ERROR",
          message: "Each CPT row must sum to one",
          entityId: row.id,
          fieldPath: ["conditionalProbabilityTables", tableIndex, "rows", rowIndex, "values"],
        });
      }
    });
  });

  return issues;
};

const validateBayesianNetworkEvidence = (
  model: BayesianNetworkModel,
  evidence: BayesianNetworkEvidenceConfiguration,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const observedNodeIds = new Set<string>();

  evidence.observations.forEach((observation, observationIndex) => {
    if (observedNodeIds.has(observation.nodeId)) {
      issues.push({
        code: "BN_EVIDENCE_NODE_DUPLICATE",
        severity: "ERROR",
        message: "Evidence can select only one state per node",
        entityId: observation.nodeId,
        fieldPath: ["evidence", "observations", observationIndex, "nodeId"],
      });
    }
    observedNodeIds.add(observation.nodeId);

    const matchingNodes = model.nodes.filter((node) => node.id === observation.nodeId);
    if (matchingNodes.length !== 1) {
      issues.push({
        code: matchingNodes.length === 0 ? "BN_EVIDENCE_NODE_NOT_FOUND" : "BN_EVIDENCE_NODE_AMBIGUOUS",
        severity: "ERROR",
        message:
          matchingNodes.length === 0
            ? "The evidence node reference does not resolve to a node"
            : "The evidence node reference must resolve to exactly one node",
        entityId: observation.nodeId,
        fieldPath: ["evidence", "observations", observationIndex, "nodeId"],
      });
      return;
    }

    const matchingStates = matchingNodes[0].states.filter((state) => state.id === observation.stateId);
    if (matchingStates.length !== 1) {
      issues.push({
        code: matchingStates.length === 0 ? "BN_EVIDENCE_STATE_NOT_FOUND" : "BN_EVIDENCE_STATE_AMBIGUOUS",
        severity: "ERROR",
        message:
          matchingStates.length === 0
            ? "The evidence state does not belong to the referenced node"
            : "The evidence state must resolve to exactly one state within the referenced node",
        entityId: observation.stateId,
        fieldPath: ["evidence", "observations", observationIndex, "stateId"],
      });
    }
  });

  return issues;
};

const validateBayesianNetworkHclBindings = (
  model: BayesianNetworkModel,
  bindings: HclEventBinding[],
  workbookId?: WorkbookId,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  bindings.forEach((binding, bindingIndex) => {
    if (
      binding.bayesianNetworkNode.modelId !== model.modelId ||
      (workbookId !== undefined && binding.bayesianNetworkNode.workbookId !== workbookId)
    ) {
      issues.push({
        code: "BN_HCL_MODEL_MISMATCH",
        severity: "ERROR",
        message: "The HCL binding must reference this Bayesian-network model",
        entityId: binding.id,
        fieldPath: ["bindings", bindingIndex, "bayesianNetworkNode", "modelId"],
      });
      return;
    }

    const matchingNodes = model.nodes.filter((node) => node.id === binding.bayesianNetworkNode.entityId);
    if (matchingNodes.length !== 1) {
      issues.push({
        code: matchingNodes.length === 0 ? "BN_HCL_NODE_NOT_FOUND" : "BN_HCL_NODE_AMBIGUOUS",
        severity: "ERROR",
        message:
          matchingNodes.length === 0
            ? "The HCL binding node reference does not resolve to a node"
            : "The HCL binding node reference must resolve to exactly one node",
        entityId: binding.bayesianNetworkNode.entityId,
        fieldPath: ["bindings", bindingIndex, "bayesianNetworkNode", "entityId"],
      });
      return;
    }
    const node = matchingNodes[0];

    if (binding.trueStateIds.length === 0) {
      issues.push({
        code: "BN_HCL_TRUE_STATES_REQUIRED",
        severity: "ERROR",
        message: "An HCL binding must select at least one true state",
        entityId: binding.id,
        fieldPath: ["bindings", bindingIndex, "trueStateIds"],
      });
    }

    const selectedStateIds = new Set<string>();
    const resolvedStateIds = new Set<string>();
    binding.trueStateIds.forEach((stateId, stateIndex) => {
      if (selectedStateIds.has(stateId)) {
        issues.push({
          code: "BN_HCL_TRUE_STATE_DUPLICATE",
          severity: "ERROR",
          message: "An HCL true-state selection cannot contain duplicate states",
          entityId: binding.id,
          fieldPath: ["bindings", bindingIndex, "trueStateIds", stateIndex],
        });
      }
      selectedStateIds.add(stateId);

      const matchingStates = node.states.filter((state) => state.id === stateId);
      if (matchingStates.length !== 1) {
        issues.push({
          code: matchingStates.length === 0 ? "BN_HCL_TRUE_STATE_NOT_FOUND" : "BN_HCL_TRUE_STATE_AMBIGUOUS",
          severity: "ERROR",
          message:
            matchingStates.length === 0
              ? "The HCL true state does not belong to the bound node"
              : "The HCL true state must resolve to exactly one state within the bound node",
          entityId: stateId,
          fieldPath: ["bindings", bindingIndex, "trueStateIds", stateIndex],
        });
        return;
      }
      resolvedStateIds.add(stateId);
    });

    const nodeStateIds = new Set(node.states.map((state) => state.id));
    if (resolvedStateIds.size > 0 && nodeStateIds.size === resolvedStateIds.size) {
      issues.push({
        code: "BN_HCL_TRUE_STATES_CANNOT_INCLUDE_ALL",
        severity: "ERROR",
        message: "An HCL true-state selection cannot contain every state of the bound node",
        entityId: binding.id,
        fieldPath: ["bindings", bindingIndex, "trueStateIds"],
      });
    }
  });

  return issues;
};

const validateBayesianNetworkModules = (model: BayesianNetworkModel): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const templates = model.moduleTemplates ?? [];
  const instances = model.moduleInstances ?? [];
  const templateIds = new Set<string>();
  const templateCodes = new Set<string>();

  templates.forEach((template, templateIndex) => {
    const templatePath = ["moduleTemplates", templateIndex] as Array<string | number>;
    if (templateIds.has(template.id)) {
      issues.push({
        code: "BN_MODULE_TEMPLATE_ID_DUPLICATE",
        severity: "ERROR",
        message: "Reusable module template ids must be unique",
        entityId: template.id,
        fieldPath: [...templatePath, "id"],
      });
    }
    templateIds.add(template.id);
    const normalizedTemplateCode = template.code.trim().toUpperCase();
    if (templateCodes.has(normalizedTemplateCode)) {
      issues.push({
        code: "BN_MODULE_TEMPLATE_CODE_DUPLICATE",
        severity: "ERROR",
        message: "Reusable module template codes must be unique",
        entityId: template.id,
        fieldPath: [...templatePath, "code"],
      });
    }
    templateCodes.add(normalizedTemplateCode);

    const portIds = new Set<string>();
    const interfaceNodeIds = new Set<string>();
    template.inputPorts.forEach((port, portIndex) => {
      if (portIds.has(port.id)) {
        issues.push({
          code: "BN_MODULE_INPUT_PORT_DUPLICATE",
          severity: "ERROR",
          message: "Module input port ids must be unique",
          entityId: port.id,
          fieldPath: [...templatePath, "inputPorts", portIndex, "id"],
        });
      }
      portIds.add(port.id);
      if (interfaceNodeIds.has(port.node.id) || template.nodes.some((node) => node.id === port.node.id)) {
        issues.push({
          code: "BN_MODULE_INPUT_NODE_DUPLICATE",
          severity: "ERROR",
          message: "Each module input must have a unique virtual node",
          entityId: port.node.id,
          fieldPath: [...templatePath, "inputPorts", portIndex, "node", "id"],
        });
      }
      interfaceNodeIds.add(port.node.id);
      if (template.edges.some((edge) => edge.childNodeId === port.node.id)) {
        issues.push({
          code: "BN_MODULE_INPUT_MUST_BE_ROOT",
          severity: "ERROR",
          message: "A module input port can only be an upstream parent",
          entityId: port.id,
          fieldPath: [...templatePath, "inputPorts", portIndex],
        });
      }
    });

    const internalNodeIds = new Set(template.nodes.map((node) => node.id));
    template.outputPorts.forEach((port, portIndex) => {
      if (!internalNodeIds.has(port.nodeId)) {
        issues.push({
          code: "BN_MODULE_OUTPUT_NODE_NOT_FOUND",
          severity: "ERROR",
          message: "A module output port must reference an internal module node",
          entityId: port.id,
          fieldPath: [...templatePath, "outputPorts", portIndex, "nodeId"],
        });
      }
    });

    const uniformPortTables: BayesianNetworkConditionalProbabilityTable[] = template.inputPorts.map((port) => ({
      nodeId: port.node.id,
      parents: [],
      rows: [{
        id: `validation-${port.id}`,
        parentStates: [],
        values: port.node.states.map((state) => ({
          stateId: state.id,
          probability: 1 / port.node.states.length,
        })) as BayesianNetworkConditionalProbabilityTable["rows"][number]["values"],
      }],
    }));
    const templateModel: BayesianNetworkModel = {
      modelId: template.id,
      code: template.code,
      name: template.name,
      description: template.description,
      nodes: [...template.inputPorts.map((port) => port.node), ...template.nodes],
      edges: template.edges,
      conditionalProbabilityTables: [...uniformPortTables, ...template.conditionalProbabilityTables],
      nodePositions: template.nodePositions,
      layout: {
        viewport: { x: 0, y: 0, zoom: 1 },
        mode: "MANUAL",
        direction: "LEFT_TO_RIGHT",
      },
    };
    [
      ...validateBayesianNetworkIdentity(templateModel),
      ...validateBayesianNetworkNodeStateCount(templateModel),
      ...validateBayesianNetworkGraph(templateModel),
      ...validateBayesianNetworkCpts(templateModel),
    ].forEach((issue) => {
      issues.push({
        ...issue,
        code: `BN_MODULE_${issue.code.replace(/^BN_/, "")}`,
        message: `Module ${template.code}: ${issue.message}`,
        fieldPath: [...templatePath, ...issue.fieldPath],
      });
    });
  });

  const instanceIds = new Set<string>();
  const instanceCodes = new Set<string>();
  const claimedNodeIds = new Set<string>();
  instances.forEach((instance, instanceIndex) => {
    const instancePath = ["moduleInstances", instanceIndex] as Array<string | number>;
    if (instanceIds.has(instance.id)) {
      issues.push({
        code: "BN_MODULE_INSTANCE_ID_DUPLICATE",
        severity: "ERROR",
        message: "Module instance ids must be unique",
        entityId: instance.id,
        fieldPath: [...instancePath, "id"],
      });
    }
    instanceIds.add(instance.id);
    const normalizedInstanceCode = instance.code.trim().toUpperCase();
    if (instanceCodes.has(normalizedInstanceCode)) {
      issues.push({
        code: "BN_MODULE_INSTANCE_CODE_DUPLICATE",
        severity: "ERROR",
        message: "Module instance codes must be unique",
        entityId: instance.id,
        fieldPath: [...instancePath, "code"],
      });
    }
    instanceCodes.add(normalizedInstanceCode);
    const template = templates.find((candidate) => candidate.id === instance.templateId);
    if (template === undefined) {
      issues.push({
        code: "BN_MODULE_INSTANCE_TEMPLATE_NOT_FOUND",
        severity: "ERROR",
        message: "A module instance must reference an existing template",
        entityId: instance.id,
        fieldPath: [...instancePath, "templateId"],
      });
      return;
    }

    const bindingByPortId = new Map(instance.inputBindings.map((binding) => [binding.portId, binding]));
    if (bindingByPortId.size !== instance.inputBindings.length) {
      issues.push({
        code: "BN_MODULE_INPUT_BINDING_DUPLICATE",
        severity: "ERROR",
        message: "Each module input port must be bound exactly once",
        entityId: instance.id,
        fieldPath: [...instancePath, "inputBindings"],
      });
    }
    template.inputPorts.forEach((port) => {
      const binding = bindingByPortId.get(port.id);
      const boundNode = model.nodes.find((node) => node.id === binding?.nodeId);
      if (binding === undefined || boundNode === undefined) {
        issues.push({
          code: "BN_MODULE_INPUT_BINDING_NOT_FOUND",
          severity: "ERROR",
          message: `Module input ${port.code} must reference an existing network node`,
          entityId: instance.id,
          fieldPath: [...instancePath, "inputBindings"],
        });
        return;
      }
      const expectedStateCodes = new Set(port.node.states.map((state) => state.code.trim().toUpperCase()));
      const actualStateCodes = new Set(boundNode.states.map((state) => state.code.trim().toUpperCase()));
      if (
        expectedStateCodes.size !== actualStateCodes.size
        || [...expectedStateCodes].some((code) => !actualStateCodes.has(code))
      ) {
        issues.push({
          code: "BN_MODULE_INPUT_STATES_INCOMPATIBLE",
          severity: "ERROR",
          message: `Module input ${port.code} has incompatible states`,
          entityId: boundNode.id,
          fieldPath: [...instancePath, "inputBindings"],
        });
      }
    });
    if (bindingByPortId.size !== template.inputPorts.length) {
      issues.push({
        code: "BN_MODULE_INPUT_BINDING_COUNT_MISMATCH",
        severity: "ERROR",
        message: "Module input bindings must match the template interface",
        entityId: instance.id,
        fieldPath: [...instancePath, "inputBindings"],
      });
    }

    const mappingByTemplateNodeId = new Map(
      instance.nodeMappings.map((mapping) => [mapping.templateNodeId, mapping]),
    );
    if (
      mappingByTemplateNodeId.size !== instance.nodeMappings.length
      || mappingByTemplateNodeId.size !== template.nodes.length
    ) {
      issues.push({
        code: "BN_MODULE_NODE_MAPPING_COUNT_MISMATCH",
        severity: "ERROR",
        message: "Module node mappings must match the template nodes exactly",
        entityId: instance.id,
        fieldPath: [...instancePath, "nodeMappings"],
      });
    }
    template.nodes.forEach((templateNode) => {
      const mapping = mappingByTemplateNodeId.get(templateNode.id);
      const materializedNode = model.nodes.find((node) => node.id === mapping?.nodeId);
      if (mapping === undefined || materializedNode === undefined) {
        issues.push({
          code: "BN_MODULE_NODE_MAPPING_NOT_FOUND",
          severity: "ERROR",
          message: `Module node ${templateNode.code} must resolve to a materialized network node`,
          entityId: instance.id,
          fieldPath: [...instancePath, "nodeMappings"],
        });
        return;
      }
      if (claimedNodeIds.has(materializedNode.id)) {
        issues.push({
          code: "BN_MODULE_NODE_OWNERSHIP_DUPLICATE",
          severity: "ERROR",
          message: "A materialized node can belong to only one module instance",
          entityId: materializedNode.id,
          fieldPath: [...instancePath, "nodeMappings"],
        });
      }
      claimedNodeIds.add(materializedNode.id);
      const mappedTemplateStateIds = new Set(mapping.stateMappings.map((state) => state.templateStateId));
      const mappedStateIds = new Set(mapping.stateMappings.map((state) => state.stateId));
      if (
        mappedTemplateStateIds.size !== templateNode.states.length
        || mappedStateIds.size !== materializedNode.states.length
        || templateNode.states.some((state) => !mappedTemplateStateIds.has(state.id))
        || materializedNode.states.some((state) => !mappedStateIds.has(state.id))
      ) {
        issues.push({
          code: "BN_MODULE_STATE_MAPPING_MISMATCH",
          severity: "ERROR",
          message: `Module node ${templateNode.code} has stale state mappings`,
          entityId: materializedNode.id,
          fieldPath: [...instancePath, "nodeMappings"],
        });
      }
    });

    const outputByPortId = new Map(instance.outputBindings.map((binding) => [binding.portId, binding.nodeId]));
    if (outputByPortId.size !== template.outputPorts.length) {
      issues.push({
        code: "BN_MODULE_OUTPUT_BINDING_COUNT_MISMATCH",
        severity: "ERROR",
        message: "Module output bindings must match the template outputs exactly",
        entityId: instance.id,
        fieldPath: [...instancePath, "outputBindings"],
      });
    }
    template.outputPorts.forEach((port) => {
      const expectedNodeId = mappingByTemplateNodeId.get(port.nodeId)?.nodeId;
      if (expectedNodeId === undefined || outputByPortId.get(port.id) !== expectedNodeId) {
        issues.push({
          code: "BN_MODULE_OUTPUT_BINDING_INVALID",
          severity: "ERROR",
          message: `Module output ${port.code} does not resolve to its materialized node`,
          entityId: instance.id,
          fieldPath: [...instancePath, "outputBindings"],
        });
      }
    });
  });

  return issues;
};

const validateBayesianNetworkModel = (
  model: BayesianNetworkModel,
  context: BayesianNetworkValidationContext = {},
): ValidationIssue[] => [
  ...validateBayesianNetworkIdentity(model),
  ...validateBayesianNetworkNodeStateCount(model),
  ...validateBayesianNetworkGraph(model),
  ...validateBayesianNetworkCpts(model),
  ...validateBayesianNetworkModules(model),
  ...(context.evidence === undefined ? [] : validateBayesianNetworkEvidence(model, context.evidence)),
  ...(context.hclBindings === undefined
    ? []
    : validateBayesianNetworkHclBindings(model, context.hclBindings, context.workbookId)),
];

const validateBayesianNetworkDraft = (
  model: BayesianNetworkModel,
  owner: WorkbookModelSnapshotIdentity,
  validatedAt: string,
  context: BayesianNetworkValidationContext = {},
): DraftValidationOutcome =>
  createDraftValidationOutcome({
    owner,
    issues: validateBayesianNetworkModel(model, { ...context, workbookId: owner.workbookId }),
    validatedAt,
  });

const validateBayesianNetworkAnalysisReady = (
  model: BayesianNetworkModel,
  owner: WorkbookModelSnapshotIdentity,
  validatedAt: string,
  context: BayesianNetworkValidationContext = {},
): AnalysisReadyValidationOutcome =>
  createAnalysisReadyValidationOutcome({
    owner,
    issues: validateBayesianNetworkModel(model, { ...context, workbookId: owner.workbookId }),
    validatedAt,
  });

export {
  validateBayesianNetworkIdentity,
  validateBayesianNetworkNodeStateCount,
  validateBayesianNetworkGraph,
  validateBayesianNetworkCpts,
  validateBayesianNetworkEvidence,
  validateBayesianNetworkHclBindings,
  validateBayesianNetworkModules,
  validateBayesianNetworkModel,
  validateBayesianNetworkDraft,
  validateBayesianNetworkAnalysisReady,
};
export type { BayesianNetworkValidationContext };
