import { createAnalysisReadyValidationOutcome, createDraftValidationOutcome } from "../shared";
import type {
  AnalysisReadyValidationOutcome,
  DraftValidationOutcome,
  MethodEntityReference,
  ValidationIssue,
  WorkbookModelSnapshotIdentity,
} from "../shared";
import type { EventTreeModel } from "./event-tree-model";

interface EventTreeValidationContext {
  availableInitiatingEvents?: MethodEntityReference[];
  availableFaultTreeTopGates?: MethodEntityReference[];
  eventTreeModels?: EventTreeModel[];
}

const validateEventTreeStartingNodeAndPaths = (
  model: EventTreeModel,
  context: EventTreeValidationContext = {},
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (model.initiatingEvent === null) {
    issues.push({
      code: "ET_INITIATING_EVENT_REQUIRED",
      severity: "ERROR",
      message: "The event tree must define an initiating event",
      entityId: model.modelId,
      fieldPath: ["initiatingEvent"],
    });
  } else if (context.availableInitiatingEvents !== undefined) {
    const { target } = model.initiatingEvent;
    const matches = context.availableInitiatingEvents.filter(
      (candidate) => candidate.modelId === target.modelId && candidate.entityId === target.entityId,
    );
    if (matches.length !== 1) {
      issues.push({
        code: matches.length === 0 ? "ET_INITIATING_EVENT_NOT_FOUND" : "ET_INITIATING_EVENT_AMBIGUOUS",
        severity: "ERROR",
        message:
          matches.length === 0
            ? "The initiating-event reference does not resolve to an available event"
            : "The initiating-event reference must resolve to exactly one available event",
        entityId: target.entityId,
        fieldPath: ["initiatingEvent", "target"],
      });
    }
  }

  if (model.functionalEvents.length === 0) {
    issues.push({
      code: "ET_FUNCTIONAL_EVENT_REQUIRED",
      severity: "ERROR",
      message: "The event tree must define at least one functional event",
      entityId: model.modelId,
      fieldPath: ["functionalEvents"],
    });
    return issues;
  }

  const orderedFunctionalEvents = [...model.functionalEvents].sort((left, right) => left.order - right.order);
  const orderIsValid = orderedFunctionalEvents.every((functionalEvent, index) => functionalEvent.order === index);
  if (!orderIsValid) {
    issues.push({
      code: "ET_FUNCTIONAL_EVENT_ORDER_INVALID",
      severity: "ERROR",
      message: "Functional-event order must be unique and contiguous from zero",
      entityId: model.modelId,
      fieldPath: ["functionalEvents"],
    });
    return issues;
  }

  const pathKeys = new Set<string>();
  model.sequences.forEach((sequence, sequenceIndex) => {
    const pathIsComplete =
      sequence.path.length === orderedFunctionalEvents.length &&
      sequence.path.every((step, stepIndex) => step.functionalEventId === orderedFunctionalEvents[stepIndex].id);
    if (!pathIsComplete) {
      issues.push({
        code: "ET_SEQUENCE_PATH_INCOMPLETE",
        severity: "ERROR",
        message: "Each sequence must select success, failure, or bypassed for every ordered functional event",
        entityId: sequence.id,
        fieldPath: ["sequences", sequenceIndex, "path"],
      });
      return;
    }

    const pathKey = sequence.path.map((step) => step.outcome).join("|");
    if (pathKeys.has(pathKey)) {
      issues.push({
        code: "ET_SEQUENCE_PATH_DUPLICATE",
        severity: "ERROR",
        message: "Each event-tree path can be defined only once",
        entityId: sequence.id,
        fieldPath: ["sequences", sequenceIndex, "path"],
      });
    }
    pathKeys.add(pathKey);
  });

  const completePaths = model.sequences.filter((sequence) => sequence.path.length === orderedFunctionalEvents.length);
  const hasCompleteCoverage = (depth: number, candidates: typeof completePaths): boolean => {
    if (depth === orderedFunctionalEvents.length) return candidates.length === 1;
    const states = new Set(candidates.map((sequence) => sequence.path[depth]?.outcome));
    const binary = states.size === 2 && states.has("SUCCESS") && states.has("FAILURE");
    const bypassed = states.size === 1 && states.has("BYPASSED");
    if (!binary && !bypassed) return false;
    return [...states].every((state) => hasCompleteCoverage(
      depth + 1,
      candidates.filter((sequence) => sequence.path[depth]?.outcome === state),
    ));
  };
  if (!hasCompleteCoverage(0, completePaths)) {
    issues.push({
      code: "ET_BRANCH_COVERAGE_INCOMPLETE",
      severity: "ERROR",
      message: "Every applicable functional event must define both success and failure; a bypassed event must define one bypass path",
      entityId: model.modelId,
      fieldPath: ["sequences"],
    });
  }

  return issues;
};

const validateEventTreeEndStates = (model: EventTreeModel): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const endStateCounts = new Map<string, number>();
  model.endStates.forEach((endState) =>
    endStateCounts.set(endState.id, (endStateCounts.get(endState.id) ?? 0) + 1),
  );
  const reachableEndStateIds = new Set<string>();

  model.sequences.forEach((sequence, sequenceIndex) => {
    if (sequence.result.kind !== "END_STATE") return;
    const endStateCount = endStateCounts.get(sequence.result.endStateId) ?? 0;
    if (endStateCount !== 1) {
      issues.push({
        code: endStateCount === 0 ? "ET_END_STATE_NOT_FOUND" : "ET_END_STATE_AMBIGUOUS",
        severity: "ERROR",
        message:
          endStateCount === 0
            ? "The sequence end-state reference does not resolve to an end state"
            : "The sequence end-state reference must resolve to exactly one end state",
        entityId: sequence.result.endStateId,
        fieldPath: ["sequences", sequenceIndex, "result", "endStateId"],
      });
      return;
    }
    reachableEndStateIds.add(sequence.result.endStateId);
  });

  model.endStates.forEach((endState, endStateIndex) => {
    if (reachableEndStateIds.has(endState.id)) return;
    issues.push({
      code: "ET_END_STATE_UNREACHABLE",
      severity: "ERROR",
      message: "Each declared end state must be reached by at least one sequence",
      entityId: endState.id,
      fieldPath: ["endStates", endStateIndex],
    });
  });

  return issues;
};

const validateEventTreeFaultTreeLinksAndFrequency = (
  model: EventTreeModel,
  context: EventTreeValidationContext = {},
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (model.initiatingEventFrequency === null) {
    issues.push({
      code: "ET_INITIATING_EVENT_FREQUENCY_REQUIRED",
      severity: "ERROR",
      message: "The event tree must define an initiating-event frequency",
      entityId: model.modelId,
      fieldPath: ["initiatingEventFrequency"],
    });
  } else if (!Number.isFinite(model.initiatingEventFrequency.value) || model.initiatingEventFrequency.value < 0) {
    issues.push({
      code: "ET_INITIATING_EVENT_FREQUENCY_INVALID",
      severity: "ERROR",
      message: "The initiating-event frequency must be a finite, non-negative value",
      entityId: model.modelId,
      fieldPath: ["initiatingEventFrequency", "value"],
    });
  }

  const functionalEventCounts = new Map<string, number>();
  model.functionalEvents.forEach((functionalEvent) =>
    functionalEventCounts.set(functionalEvent.id, (functionalEventCounts.get(functionalEvent.id) ?? 0) + 1),
  );
  const linkedFunctionalEventIds = new Set<string>();

  model.functionalEventFaultTreeLinks.forEach((link, linkIndex) => {
    const functionalEventCount = functionalEventCounts.get(link.functionalEventId) ?? 0;
    if (functionalEventCount !== 1) {
      issues.push({
        code:
          functionalEventCount === 0
            ? "ET_FT_LINK_FUNCTIONAL_EVENT_NOT_FOUND"
            : "ET_FT_LINK_FUNCTIONAL_EVENT_AMBIGUOUS",
        severity: "ERROR",
        message:
          functionalEventCount === 0
            ? "The FT link does not resolve to a functional event"
            : "The FT link must resolve to exactly one functional event",
        entityId: link.functionalEventId,
        fieldPath: ["functionalEventFaultTreeLinks", linkIndex, "functionalEventId"],
      });
    } else if (linkedFunctionalEventIds.has(link.functionalEventId)) {
      issues.push({
        code: "ET_FT_LINK_DUPLICATE",
        severity: "ERROR",
        message: "A functional event can have only one FT top-gate link",
        entityId: link.functionalEventId,
        fieldPath: ["functionalEventFaultTreeLinks", linkIndex, "functionalEventId"],
      });
    }
    linkedFunctionalEventIds.add(link.functionalEventId);

    if (context.availableFaultTreeTopGates === undefined) return;
    const { faultTreeTopGate } = link;
    const targetMatches = context.availableFaultTreeTopGates.filter(
      (candidate) =>
        candidate.modelId === faultTreeTopGate.modelId && candidate.entityId === faultTreeTopGate.entityId,
    );
    if (targetMatches.length === 1) return;
    issues.push({
      code: targetMatches.length === 0 ? "ET_FT_TOP_GATE_NOT_FOUND" : "ET_FT_TOP_GATE_AMBIGUOUS",
      severity: "ERROR",
      message:
        targetMatches.length === 0
          ? "The functional-event FT top-gate reference does not resolve"
          : "The functional-event FT top-gate reference must resolve to exactly one gate",
      entityId: faultTreeTopGate.entityId,
      fieldPath: ["functionalEventFaultTreeLinks", linkIndex, "faultTreeTopGate"],
    });
  });

  model.functionalEvents.forEach((functionalEvent, functionalEventIndex) => {
    if (linkedFunctionalEventIds.has(functionalEvent.id)) return;
    const bypassedEverywhere =
      model.sequences.length > 0 &&
      model.sequences.every(
        (sequence) =>
          sequence.path.find((step) => step.functionalEventId === functionalEvent.id)?.outcome === "BYPASSED",
      );
    if (bypassedEverywhere) return;
    issues.push({
      code: "ET_FT_LINK_REQUIRED",
      severity: "ERROR",
      message: "Each functional event must link to a fault-tree top gate",
      entityId: functionalEvent.id,
      fieldPath: ["functionalEvents", functionalEventIndex],
    });
  });

  return issues;
};

interface EventTreeTransferEdge {
  sourceKey: string;
  targetKey: string;
  sequenceId: string;
  sequenceIndex: number;
}

const validateEventTreeTransfers = (
  model: EventTreeModel,
  context: EventTreeValidationContext = {},
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const availableModels = [model, ...(context.eventTreeModels ?? [])];
  const modelsById = new Map<string, EventTreeModel[]>();
  availableModels.forEach((availableModel) => {
    const matches = modelsById.get(availableModel.modelId) ?? [];
    matches.push(availableModel);
    modelsById.set(availableModel.modelId, matches);
  });

  model.sequences.forEach((sequence, sequenceIndex) => {
    if (sequence.result.kind !== "TRANSFER") return;
    const { target } = sequence.result;
    const targetModels = modelsById.get(target.modelId) ?? [];
    if (targetModels.length !== 1) {
      issues.push({
        code: targetModels.length === 0 ? "ET_TRANSFER_MODEL_NOT_FOUND" : "ET_TRANSFER_MODEL_AMBIGUOUS",
        severity: "ERROR",
        message:
          targetModels.length === 0
            ? "The transfer target event tree does not resolve"
            : "The transfer target event tree must resolve to exactly one model",
        entityId: sequence.id,
        fieldPath: ["sequences", sequenceIndex, "result", "target"],
      });
      return;
    }

    const targetSequences = targetModels[0].sequences.filter((candidate) => candidate.id === target.entityId);
    if (targetSequences.length !== 1) {
      issues.push({
        code: targetSequences.length === 0 ? "ET_TRANSFER_SEQUENCE_NOT_FOUND" : "ET_TRANSFER_SEQUENCE_AMBIGUOUS",
        severity: "ERROR",
        message:
          targetSequences.length === 0
            ? "The transfer target sequence does not resolve"
            : "The transfer target must resolve to exactly one sequence",
        entityId: sequence.id,
        fieldPath: ["sequences", sequenceIndex, "result", "target", "entityId"],
      });
    }
  });

  const uniqueModels = [...modelsById.values()].flatMap((matches) => (matches.length === 1 ? matches : []));
  const transferEdges: EventTreeTransferEdge[] = [];
  uniqueModels.forEach((availableModel) => {
    availableModel.sequences.forEach((sequence, sequenceIndex) => {
      const { result } = sequence;
      if (result.kind !== "TRANSFER") return;
      const targetModels = modelsById.get(result.target.modelId) ?? [];
      if (targetModels.length !== 1) return;
      const targetSequences = targetModels[0].sequences.filter(
        (candidate) => candidate.id === result.target.entityId,
      );
      if (targetSequences.length !== 1) return;
      transferEdges.push({
        sourceKey: `${availableModel.modelId}:${sequence.id}`,
        targetKey: `${targetModels[0].modelId}:${targetSequences[0].id}`,
        sequenceId: sequence.id,
        sequenceIndex,
      });
    });
  });

  const outgoingBySequence = new Map<string, EventTreeTransferEdge[]>();
  transferEdges.forEach((edge) => {
    const outgoing = outgoingBySequence.get(edge.sourceKey) ?? [];
    outgoing.push(edge);
    outgoingBySequence.set(edge.sourceKey, outgoing);
  });

  type VisitState = "VISITING" | "VISITED";
  const visitState = new Map<string, VisitState>();
  const sequenceStack: string[] = [];
  const edgeStack: EventTreeTransferEdge[] = [];
  const reportCycleEdge = (edge: EventTreeTransferEdge): void => {
    issues.push({
      code: "ET_TRANSFER_LOOP",
      severity: "ERROR",
      message: "Event-tree transfers cannot form an uncontrolled loop",
      entityId: edge.sequenceId,
      fieldPath: ["sequences", edge.sequenceIndex, "result", "target"],
    });
  };
  const visit = (sequenceKey: string): void => {
    visitState.set(sequenceKey, "VISITING");
    sequenceStack.push(sequenceKey);
    for (const edge of outgoingBySequence.get(sequenceKey) ?? []) {
      const targetState = visitState.get(edge.targetKey);
      if (targetState === "VISITING") {
        const cycleStart = sequenceStack.lastIndexOf(edge.targetKey);
        edgeStack.slice(cycleStart).forEach(reportCycleEdge);
        reportCycleEdge(edge);
        continue;
      }
      if (targetState === "VISITED") continue;
      edgeStack.push(edge);
      visit(edge.targetKey);
      edgeStack.pop();
    }
    sequenceStack.pop();
    visitState.set(sequenceKey, "VISITED");
  };

  model.sequences.forEach((sequence) => {
    const sequenceKey = `${model.modelId}:${sequence.id}`;
    if (!visitState.has(sequenceKey)) visit(sequenceKey);
  });

  return issues;
};

const validateEventTreeSequenceIdentity = (model: EventTreeModel): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const sequenceIds = new Set<string>();
  const sequenceCodes = new Set<string>();

  model.sequences.forEach((sequence, sequenceIndex) => {
    if (sequenceIds.has(sequence.id)) {
      issues.push({
        code: "ET_DUPLICATE_SEQUENCE_ID",
        severity: "ERROR",
        message: "Event-tree sequence ids must be unique",
        entityId: sequence.id,
        fieldPath: ["sequences", sequenceIndex, "id"],
      });
    }
    sequenceIds.add(sequence.id);

    const normalizedCode = sequence.code.trim().toUpperCase();
    if (sequenceCodes.has(normalizedCode)) {
      issues.push({
        code: "ET_DUPLICATE_SEQUENCE_CODE",
        severity: "ERROR",
        message: "Event-tree sequence codes must be unique",
        entityId: sequence.id,
        fieldPath: ["sequences", sequenceIndex, "code"],
      });
    }
    sequenceCodes.add(normalizedCode);
  });

  return issues;
};

const validateEventTreeModel = (
  model: EventTreeModel,
  context: EventTreeValidationContext = {},
): ValidationIssue[] => [
  ...validateEventTreeStartingNodeAndPaths(model, context),
  ...validateEventTreeEndStates(model),
  ...validateEventTreeFaultTreeLinksAndFrequency(model, context),
  ...validateEventTreeTransfers(model, context),
  ...validateEventTreeSequenceIdentity(model),
];

const validateEventTreeDraft = (
  model: EventTreeModel,
  owner: WorkbookModelSnapshotIdentity,
  validatedAt: string,
  context: EventTreeValidationContext = {},
): DraftValidationOutcome =>
  createDraftValidationOutcome({
    owner,
    issues: validateEventTreeModel(model, context),
    validatedAt,
  });

const validateEventTreeAnalysisReady = (
  model: EventTreeModel,
  owner: WorkbookModelSnapshotIdentity,
  validatedAt: string,
  context: EventTreeValidationContext = {},
): AnalysisReadyValidationOutcome =>
  createAnalysisReadyValidationOutcome({
    owner,
    issues: validateEventTreeModel(model, context),
    validatedAt,
  });

export {
  validateEventTreeStartingNodeAndPaths,
  validateEventTreeEndStates,
  validateEventTreeFaultTreeLinksAndFrequency,
  validateEventTreeTransfers,
  validateEventTreeSequenceIdentity,
  validateEventTreeModel,
  validateEventTreeDraft,
  validateEventTreeAnalysisReady,
};
export type { EventTreeValidationContext };
