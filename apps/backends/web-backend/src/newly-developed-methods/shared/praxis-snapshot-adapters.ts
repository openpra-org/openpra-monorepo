import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { systemBasicEventToFaultTreeBasicEvent } from "interfaces-mef-types/sy/system-models";
import type {
  EventSequenceAnalysis,
  EventTree,
} from "interfaces-mef-types/es/event-sequence-analysis";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { WorkbookModelAddress } from "interfaces-shared-types/newly-developed-methods";
import { createHash } from "crypto";

interface WorkbookMefSnapshot<TMef> {
  workbookId: string;
  workbookRevision: number;
  mef: TMef;
}

interface PraxisModelSnapshot extends Record<string, unknown> {
  id: string;
  methodType: "FAULT_TREE" | "BAYESIAN_NETWORK" | "EVENT_TREE" | "HYBRID_CAUSAL_LOGIC";
  revision: number;
}

interface AdaptedFaultTreeSnapshot {
  modelSnapshot: PraxisModelSnapshot;
  basicEventCatalogue: Record<string, unknown>;
}

type WorkbookPraxisAdapterErrorCode =
  | "WORKBOOK_PRAXIS_ADAPTER_ERROR"
  | "SY_FAULT_TREE_GRAPH_CYCLE"
  | "SY_FAULT_TREE_GRAPH_REFERENCE_INVALID"
  | "SY_FAULT_TREE_GATE_INPUT_ID_COLLISION"
  | "SY_FAULT_TREE_NODE_ID_COLLISION"
  | "SY_FAULT_TREE_NODE_POSITION_COLLISION"
  | "SY_FAULT_TREE_TOP_GATE_AMBIGUOUS"
  | "SY_FAULT_TREE_TOP_GATE_NOT_FOUND"
  | "SY_FAULT_TREE_TRANSFER_CYCLE"
  | "SY_FAULT_TREE_TRANSFER_GATE_AMBIGUOUS"
  | "SY_FAULT_TREE_TRANSFER_GATE_NOT_FOUND"
  | "SY_FAULT_TREE_TRANSFER_MODEL_AMBIGUOUS"
  | "SY_FAULT_TREE_TRANSFER_MODEL_NOT_FOUND";

class WorkbookPraxisAdapterError extends Error {
  readonly code: WorkbookPraxisAdapterErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: WorkbookPraxisAdapterErrorCode = "WORKBOOK_PRAXIS_ADAPTER_ERROR",
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "WorkbookPraxisAdapterError";
    this.code = code;
    this.details = details;
  }
}

const findByUuid = <T extends { uuid: string }>(
  values: readonly T[],
  id: string,
  kind: string,
): T => {
  const matches = values.filter((value) => value.uuid === id);
  if (matches.length !== 1) {
    throw new WorkbookPraxisAdapterError(
      `${kind} '${id}' resolved ${matches.length} times; expected exactly once`,
    );
  }
  return matches[0];
};

const stableUuid = (value: string): string => {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const adaptSyFaultTreeSnapshot = (
  source: WorkbookMefSnapshot<SystemsAnalysis>,
  modelId: string,
): AdaptedFaultTreeSnapshot => {
  const model = findByUuid(source.mef.systemLogicModels, modelId, "SY fault tree");
  if (model.topGate === null) {
    throw new WorkbookPraxisAdapterError(
      `SY model '${modelId}' has no fault-tree top gate`,
      "SY_FAULT_TREE_TOP_GATE_NOT_FOUND",
      { modelId },
    );
  }

  type SyFaultTreeModel = SystemsAnalysis["systemLogicModels"][number];
  type SyFaultTreeGate = SyFaultTreeModel["gates"][number];
  type SyFaultTreeLeaf = SyFaultTreeModel["leafNodes"][number];

  interface ClaimedId {
    modelId: string;
    kind: string;
    sourceId: string;
  }

  const modelGate = (
    candidate: SyFaultTreeModel,
    gateId: string,
    target: boolean,
  ): SyFaultTreeGate => {
    const matches = candidate.gates.filter((gate) => gate.id === gateId);
    if (matches.length !== 1) {
      const subject = target ? "transfer target gate" : "top gate";
      const code = target
        ? matches.length === 0
          ? "SY_FAULT_TREE_TRANSFER_GATE_NOT_FOUND"
          : "SY_FAULT_TREE_TRANSFER_GATE_AMBIGUOUS"
        : matches.length === 0
          ? "SY_FAULT_TREE_TOP_GATE_NOT_FOUND"
          : "SY_FAULT_TREE_TOP_GATE_AMBIGUOUS";
      throw new WorkbookPraxisAdapterError(
        `SY ${subject} '${candidate.uuid}:${gateId}' resolved ${matches.length} times; expected exactly once`,
        code,
        { modelId: candidate.uuid, gateId, matchCount: matches.length },
      );
    }
    return matches[0];
  };

  const transferModel = (sourceModelId: string, targetModelId: string): SyFaultTreeModel => {
    const matches = source.mef.systemLogicModels.filter(
      (candidate) => candidate.uuid === targetModelId,
    );
    if (matches.length !== 1) {
      throw new WorkbookPraxisAdapterError(
        `SY transfer target model '${targetModelId}' from '${sourceModelId}' resolved ${matches.length} times; expected exactly once`,
        matches.length === 0
          ? "SY_FAULT_TREE_TRANSFER_MODEL_NOT_FOUND"
          : "SY_FAULT_TREE_TRANSFER_MODEL_AMBIGUOUS",
        { sourceModelId, targetModelId, matchCount: matches.length },
      );
    }
    return matches[0];
  };

  const checkedModels = new Set<string>();
  const assertLocalIds = (candidate: SyFaultTreeModel): void => {
    if (checkedModels.has(candidate.uuid)) return;
    checkedModels.add(candidate.uuid);

    const nodeKinds = new Map<string, string>();
    for (const node of [...candidate.gates, ...candidate.leafNodes]) {
      const priorKind = nodeKinds.get(node.id);
      if (priorKind !== undefined) {
        throw new WorkbookPraxisAdapterError(
          `SY model '${candidate.uuid}' contains colliding node id '${node.id}'`,
          "SY_FAULT_TREE_NODE_ID_COLLISION",
          { modelId: candidate.uuid, id: node.id, kinds: [priorKind, node.kind] },
        );
      }
      nodeKinds.set(node.id, node.kind);
    }

    const inputIds = new Set<string>();
    for (const input of candidate.gateInputs) {
      if (inputIds.has(input.id)) {
        throw new WorkbookPraxisAdapterError(
          `SY model '${candidate.uuid}' contains colliding gate-input id '${input.id}'`,
          "SY_FAULT_TREE_GATE_INPUT_ID_COLLISION",
          { modelId: candidate.uuid, id: input.id },
        );
      }
      inputIds.add(input.id);
    }

    const positionedNodeIds = new Set<string>();
    for (const position of candidate.nodePositions) {
      if (positionedNodeIds.has(position.nodeId)) {
        throw new WorkbookPraxisAdapterError(
          `SY model '${candidate.uuid}' contains multiple positions for node '${position.nodeId}'`,
          "SY_FAULT_TREE_NODE_POSITION_COLLISION",
          { modelId: candidate.uuid, id: position.nodeId },
        );
      }
      positionedNodeIds.add(position.nodeId);
    }
  };

  const gates: Array<Record<string, unknown>> = [];
  const leafNodes: Array<Record<string, unknown>> = [];
  const gateInputs: Array<Record<string, unknown>> = [];
  const nodePositions: Array<Record<string, unknown>> = [];
  const referencedBasicEventIds = new Set<string>();
  const claimedNodeIds = new Map<string, ClaimedId>();
  const claimedInputIds = new Map<string, ClaimedId>();
  const visitState = new Map<string, "VISITING" | "VISITED">();
  const visitStack: string[] = [];

  const expandedId = (candidate: SyFaultTreeModel, sourceId: string): string =>
    candidate.uuid === model.uuid
      ? sourceId
      : stableUuid(JSON.stringify(["SY_FAULT_TREE_TRANSFER", candidate.uuid, sourceId]));

  const claimId = (
    claims: Map<string, ClaimedId>,
    id: string,
    claim: ClaimedId,
    collisionCode:
      | "SY_FAULT_TREE_NODE_ID_COLLISION"
      | "SY_FAULT_TREE_GATE_INPUT_ID_COLLISION",
  ): void => {
    const prior = claims.get(id);
    if (prior === undefined) {
      claims.set(id, claim);
      return;
    }
    if (
      prior.modelId === claim.modelId &&
      prior.kind === claim.kind &&
      prior.sourceId === claim.sourceId
    ) {
      return;
    }
    throw new WorkbookPraxisAdapterError(
      `SY fault-tree expansion found colliding ${collisionCode === "SY_FAULT_TREE_NODE_ID_COLLISION" ? "node" : "gate-input"} id '${id}' in models '${prior.modelId}' and '${claim.modelId}'`,
      collisionCode,
      { id, first: prior, second: claim },
    );
  };

  const copyPosition = (candidate: SyFaultTreeModel, nodeId: string): void => {
    const position = candidate.nodePositions.find((entry) => entry.nodeId === nodeId);
    if (position === undefined) return;
    nodePositions.push({
      ...position,
      nodeId: expandedId(candidate, nodeId),
      position: { ...position.position },
    });
  };

  const includeLeaf = (candidate: SyFaultTreeModel, leaf: SyFaultTreeLeaf): void => {
    const outputId = expandedId(candidate, leaf.id);
    const prior = claimedNodeIds.get(outputId);
    claimId(
      claimedNodeIds,
      outputId,
      { modelId: candidate.uuid, kind: leaf.kind, sourceId: leaf.id },
      "SY_FAULT_TREE_NODE_ID_COLLISION",
    );
    if (prior !== undefined) return;
    if (leaf.kind === "BASIC_EVENT_REFERENCE") referencedBasicEventIds.add(leaf.basicEventId);
    leafNodes.push({ ...leaf, id: outputId });
    copyPosition(candidate, leaf.id);
  };

  const gateKey = (candidate: SyFaultTreeModel, gateId: string): string =>
    JSON.stringify([candidate.uuid, gateId]);

  const expandGate = (
    candidate: SyFaultTreeModel,
    gateId: string,
    reachedByTransfer: boolean,
  ): void => {
    const key = gateKey(candidate, gateId);
    const state = visitState.get(key);
    if (state === "VISITED") return;
    if (state === "VISITING") {
      const cycleStart = visitStack.lastIndexOf(key);
      const cycle = [...visitStack.slice(Math.max(cycleStart, 0)), key].map((entry) =>
        JSON.parse(entry),
      ) as Array<[string, string]>;
      throw new WorkbookPraxisAdapterError(
        `SY fault-tree ${reachedByTransfer ? "transfer " : ""}cycle detected at '${candidate.uuid}:${gateId}'`,
        reachedByTransfer ? "SY_FAULT_TREE_TRANSFER_CYCLE" : "SY_FAULT_TREE_GRAPH_CYCLE",
        { cycle: cycle.map(([cycleModelId, cycleGateId]) => ({ modelId: cycleModelId, gateId: cycleGateId })) },
      );
    }

    const gate = modelGate(candidate, gateId, false);
    assertLocalIds(candidate);
    const outputGateId = expandedId(candidate, gate.id);
    claimId(
      claimedNodeIds,
      outputGateId,
      { modelId: candidate.uuid, kind: "GATE", sourceId: gate.id },
      "SY_FAULT_TREE_NODE_ID_COLLISION",
    );
    gates.push({ ...gate, id: outputGateId });
    copyPosition(candidate, gate.id);
    visitState.set(key, "VISITING");
    visitStack.push(key);

    for (const input of candidate.gateInputs.filter((entry) => entry.gateId === gate.id)) {
      const matchingGates = candidate.gates.filter((child) => child.id === input.childId);
      const matchingLeaves = candidate.leafNodes.filter((child) => child.id === input.childId);
      if (matchingGates.length + matchingLeaves.length !== 1) {
        throw new WorkbookPraxisAdapterError(
          `SY gate input '${input.id}' in model '${candidate.uuid}' resolves child '${input.childId}' ${matchingGates.length + matchingLeaves.length} times; expected exactly once`,
          "SY_FAULT_TREE_GRAPH_REFERENCE_INVALID",
          {
            modelId: candidate.uuid,
            gateInputId: input.id,
            childId: input.childId,
            matchCount: matchingGates.length + matchingLeaves.length,
          },
        );
      }

      let replacementChildId = expandedId(candidate, input.childId);
      let childGate: { model: SyFaultTreeModel; gateId: string; viaTransfer: boolean } | undefined;
      const child = matchingGates[0];
      if (child !== undefined) {
        childGate = { model: candidate, gateId: child.id, viaTransfer: false };
      } else {
        const leaf = matchingLeaves[0];
        if (leaf === undefined) continue;
        if (leaf.kind !== "TRANSFER_REFERENCE") {
          includeLeaf(candidate, leaf);
        } else {
          claimId(
            claimedNodeIds,
            expandedId(candidate, leaf.id),
            { modelId: candidate.uuid, kind: leaf.kind, sourceId: leaf.id },
            "SY_FAULT_TREE_NODE_ID_COLLISION",
          );
          const referencedModel = transferModel(candidate.uuid, leaf.target.modelId);
          const referencedGate = modelGate(referencedModel, leaf.target.entityId, true);
          replacementChildId = expandedId(referencedModel, referencedGate.id);
          childGate = {
            model: referencedModel,
            gateId: referencedGate.id,
            viaTransfer: true,
          };
        }
      }

      claimId(
        claimedInputIds,
        expandedId(candidate, input.id),
        { modelId: candidate.uuid, kind: "GATE_INPUT", sourceId: input.id },
        "SY_FAULT_TREE_GATE_INPUT_ID_COLLISION",
      );
      gateInputs.push({
        ...input,
        id: expandedId(candidate, input.id),
        gateId: outputGateId,
        childId: replacementChildId,
      });
      if (childGate !== undefined) {
        expandGate(childGate.model, childGate.gateId, childGate.viaTransfer);
      }
    }

    visitStack.pop();
    visitState.set(key, "VISITED");
  };

  modelGate(model, model.topGate.gateId, false);
  expandGate(model, model.topGate.gateId, false);

  for (const basicEventId of referencedBasicEventIds) {
    const nodeClaim = claimedNodeIds.get(basicEventId);
    if (nodeClaim !== undefined && nodeClaim.kind !== "BASIC_EVENT_REFERENCE") {
      throw new WorkbookPraxisAdapterError(
        `SY basic event '${basicEventId}' collides with ${nodeClaim.kind.toLowerCase()} id in model '${nodeClaim.modelId}'`,
        "SY_FAULT_TREE_NODE_ID_COLLISION",
        { id: basicEventId, node: nodeClaim, basicEventId },
      );
    }
  }

  const basicEvents = [...referencedBasicEventIds].map((basicEventId) => {
    const event = findByUuid(source.mef.systemBasicEvents, basicEventId, "SY basic event");
    if (event.probability === undefined || !Number.isFinite(event.probability)) {
      throw new WorkbookPraxisAdapterError(`SY basic event '${basicEventId}' has no finite probability`);
    }
    return systemBasicEventToFaultTreeBasicEvent(event);
  });

  return {
    modelSnapshot: {
      id: model.uuid,
      projectId: source.workbookId,
      methodType: "FAULT_TREE",
      revision: source.workbookRevision,
      topGate: { ...model.topGate },
      gates,
      leafNodes,
      gateInputs,
      nodePositions,
      layout: {
        ...model.layout,
        viewport: { ...model.layout.viewport },
      },
    },
    basicEventCatalogue: {
      projectId: source.workbookId,
      basicEvents,
    },
  };
};

const adaptEsqBayesianNetworkSnapshot = (
  source: WorkbookMefSnapshot<EventSequenceQuantification>,
  modelId: string,
): PraxisModelSnapshot => {
  const model = source.mef.bayesianNetworks.find((candidate) => candidate.modelId === modelId);
  if (model === undefined) {
    throw new WorkbookPraxisAdapterError(`ESQ Bayesian network '${modelId}' was not found`);
  }
  return {
    ...model,
    id: model.modelId,
    methodType: "BAYESIAN_NETWORK",
    revision: source.workbookRevision,
  };
};

const orderedFunctionalEvents = (tree: EventTree): EventTree["functionalEvents"][string][] =>
  Object.values(tree.functionalEvents).sort(
    (left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER),
  );

const adaptEsEventTreeSnapshot = (
  source: WorkbookMefSnapshot<EventSequenceAnalysis>,
  modelId: string,
  hclConfiguration?: WorkbookModelAddress,
): PraxisModelSnapshot => {
  const tree = findByUuid(source.mef.eventTrees ?? [], modelId, "ES event tree");
  if (tree.initiatingEventFrequency === undefined) {
    throw new WorkbookPraxisAdapterError(`ES event tree '${modelId}' has no initiating-event frequency`);
  }
  const functionalEvents = orderedFunctionalEvents(tree).map((event, order) => ({
    id: event.uuid,
    name: event.name,
    order,
  }));
  const links = orderedFunctionalEvents(tree).map((event) => {
    if (event.faultTreeTopEvent === undefined) {
      throw new WorkbookPraxisAdapterError(
        `ES functional event '${event.uuid}' has no typed fault-tree top-event reference`,
      );
    }
    return {
      functionalEventId: event.uuid,
      faultTreeTopGate: {
        modelId: event.faultTreeTopEvent.modelId,
        entityId: event.faultTreeTopEvent.entityId,
      },
    };
  });
  const endStateIds = new Set<string>();
  const sequences = Object.values(tree.sequences).map((sequence) => {
    const transfer = tree.transfers?.[sequence.uuid];
    if (transfer === undefined && sequence.endState === undefined) {
      throw new WorkbookPraxisAdapterError(`ES sequence '${sequence.uuid}' has no end state`);
    }
    if (transfer !== undefined && transfer.targetSequenceId === undefined) {
      throw new WorkbookPraxisAdapterError(
        `ES sequence '${sequence.uuid}' transfer has no target sequence`,
      );
    }
    const states = sequence.functionalEventStates;
    if (states === undefined) {
      throw new WorkbookPraxisAdapterError(
        `ES sequence '${sequence.uuid}' has no normalized functional-event states`,
      );
    }
    return {
      id: sequence.uuid,
      path: functionalEvents.map((event) => {
        const outcome = states[event.id];
        if (outcome !== "SUCCESS" && outcome !== "FAILURE") {
          throw new WorkbookPraxisAdapterError(
            `ES sequence '${sequence.uuid}' is missing outcome for '${event.id}'`,
          );
        }
        return { functionalEventId: event.id, outcome };
      }),
      result:
        transfer === undefined
          ? (() => {
              const endState = sequence.endState!;
              const endStateId =
                tree.endStateIds?.[endState] ??
                stableUuid(`${source.workbookId}:${tree.uuid}:end-state:${endState}`);
              endStateIds.add(endStateId);
              return { kind: "END_STATE" as const, endStateId };
            })()
          : {
              kind: "TRANSFER" as const,
              target: {
                modelId: transfer.targetEventTreeId,
                entityId: transfer.targetSequenceId!,
              },
            },
    };
  });

  return {
    id: tree.uuid,
    methodType: "EVENT_TREE",
    revision: source.workbookRevision,
    initiatingEvent: {
      target: { modelId: source.workbookId, entityId: tree.initiatingEventId },
    },
    initiatingEventFrequency: tree.initiatingEventFrequency,
    functionalEvents,
    functionalEventFaultTreeLinks: links,
    endStates: [...endStateIds].map((id) => ({ id })),
    sequences,
    hclConfiguration:
      hclConfiguration === undefined
        ? null
        : { configuration: { modelId: hclConfiguration.modelId } },
  };
};

const adaptEsqHclSnapshot = (
  source: WorkbookMefSnapshot<EventSequenceQuantification>,
  modelId: string,
): PraxisModelSnapshot => {
  const configuration = source.mef.hclConfigurations.find(
    (candidate) => candidate.modelId === modelId,
  );
  if (configuration === undefined) {
    throw new WorkbookPraxisAdapterError(`ESQ HCL configuration '${modelId}' was not found`);
  }

  const bindings = configuration.bindings.flatMap((binding) =>
    configuration.faultTrees
      .filter((faultTree) => faultTree.workbookId === binding.faultTreeBasicEvent.workbookId)
      .map((faultTree) => ({
        id: `${binding.id}:${faultTree.modelId}`,
        faultTreeBasicEvent: {
          modelId: faultTree.modelId,
          entityId: binding.faultTreeBasicEvent.entityId,
        },
        bayesianNetworkNode: {
          modelId: binding.bayesianNetworkNode.modelId,
          entityId: binding.bayesianNetworkNode.entityId,
        },
        trueStateIds: binding.trueStateIds,
      })),
  );

  return {
    id: configuration.modelId,
    methodType: "HYBRID_CAUSAL_LOGIC",
    revision: source.workbookRevision,
    bayesianNetwork: { modelId: configuration.bayesianNetwork.modelId },
    faultTrees: configuration.faultTrees.map((faultTree) => ({
      faultTree: { modelId: faultTree.modelId },
    })),
    bindings,
    baseEvidence: configuration.baseEvidence,
    solverSettings: configuration.solverSettings,
  };
};

export {
  WorkbookPraxisAdapterError,
  adaptSyFaultTreeSnapshot,
  adaptEsqBayesianNetworkSnapshot,
  adaptEsEventTreeSnapshot,
  adaptEsqHclSnapshot,
};
export type {
  WorkbookMefSnapshot,
  PraxisModelSnapshot,
  AdaptedFaultTreeSnapshot,
};
