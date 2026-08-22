import type {
  SystemFaultTreeNode,
  SystemsAnalysis,
} from "interfaces-mef-types/sy/systems-analysis";
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

class WorkbookPraxisAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkbookPraxisAdapterError";
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

const adaptSyFaultTreeSnapshot = (
  source: WorkbookMefSnapshot<SystemsAnalysis>,
  modelId: string,
): AdaptedFaultTreeSnapshot => {
  const model = findByUuid(source.mef.systemLogicModels, modelId, "SY fault tree");
  if (model.faultTree === undefined) {
    throw new WorkbookPraxisAdapterError(`SY model '${modelId}' has no fault-tree topology`);
  }
  if (model.faultTree.type !== "AND" && model.faultTree.type !== "OR" && model.faultTree.type !== "KN") {
    throw new WorkbookPraxisAdapterError(`SY model '${modelId}' must have a gate at its root`);
  }

  const gates: Array<Record<string, unknown>> = [];
  const leafNodes: Array<Record<string, unknown>> = [];
  const gateInputs: Array<Record<string, unknown>> = [];

  const visit = (node: SystemFaultTreeNode): void => {
    if (node.type === "BE") {
      leafNodes.push({ id: node.id, kind: "BASIC_EVENT_REFERENCE", basicEventId: node.basicEventId });
      return;
    }
    if (node.type === "TR") {
      leafNodes.push({
        id: node.id,
        code: node.id,
        name: node.name,
        description: `Transfer to ${node.transfer}`,
        kind: "TRANSFER_REFERENCE",
        target: { modelId: node.transfer, entityId: node.transfer },
      });
      return;
    }

    gates.push({
      id: node.id,
      code: node.id,
      name: node.name,
      description: node.name,
      kind: "GATE",
      gateType: node.type === "KN" ? "K_OF_N" : node.type,
      ...(node.type === "KN" ? { k: node.k } : {}),
    });
    node.children.forEach((child, order) => {
      visit(child);
      gateInputs.push({
        id: `${node.id}:${child.id}:${order}`,
        gateId: node.id,
        childId: child.id,
        order,
      });
    });
  };
  visit(model.faultTree);

  const referencedBasicEventIds = new Set(
    leafNodes
      .filter((leaf) => leaf["kind"] === "BASIC_EVENT_REFERENCE")
      .map((leaf) => leaf["basicEventId"] as string),
  );
  const basicEvents = [...referencedBasicEventIds].map((basicEventId) => {
    const event = findByUuid(source.mef.systemBasicEvents, basicEventId, "SY basic event");
    if (event.probability === undefined || !Number.isFinite(event.probability)) {
      throw new WorkbookPraxisAdapterError(`SY basic event '${basicEventId}' has no finite probability`);
    }
    return {
      id: event.uuid,
      code: event.uuid,
      name: event.name,
      description: event.description ?? "",
      probability: { value: event.probability },
    };
  });

  return {
    modelSnapshot: {
      id: model.uuid,
      projectId: source.workbookId,
      methodType: "FAULT_TREE",
      revision: source.workbookRevision,
      topGate: { gateId: model.faultTree.id },
      gates,
      leafNodes,
      gateInputs,
      nodePositions: [],
      layout: {
        viewport: { x: 0, y: 0, zoom: 1 },
        mode: "AUTOMATIC",
        direction: "TOP_TO_BOTTOM",
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

const stableUuid = (value: string): string => {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

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
    if (sequence.endState === undefined) {
      throw new WorkbookPraxisAdapterError(`ES sequence '${sequence.uuid}' has no end state`);
    }
    const endStateId =
      tree.endStateIds?.[sequence.endState] ??
      stableUuid(`${source.workbookId}:${tree.uuid}:end-state:${sequence.endState}`);
    endStateIds.add(endStateId);
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
      result: { kind: "END_STATE", endStateId },
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
