import type {
  EsqBayesianNetwork,
  EsqHclConfiguration,
} from "interfaces-mef-types/esq/workbook-models";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type {
  EventSequenceAnalysis,
  EventTree,
} from "interfaces-mef-types/es/event-sequence-analysis";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { EndState } from "interfaces-mef-types/core/events";

const EXAMPLE_ESQ_WORKBOOK_ID = "example-esq-workbook";
const EXAMPLE_SY_WORKBOOK_ID = "example-sy-workbook";

const EXAMPLE_DEPENDENCY_IDS = {
  network: "71a2f76e-8751-4d74-91ba-3f0db3abf101",
  latentNode: "71a2f76e-8751-4d74-91ba-3f0db3abf102",
  latentNormal: "71a2f76e-8751-4d74-91ba-3f0db3abf103",
  latentDegraded: "71a2f76e-8751-4d74-91ba-3f0db3abf104",
  divisionANode: "71a2f76e-8751-4d74-91ba-3f0db3abf105",
  divisionAAvailable: "71a2f76e-8751-4d74-91ba-3f0db3abf106",
  divisionAFailed: "71a2f76e-8751-4d74-91ba-3f0db3abf107",
  divisionBNode: "71a2f76e-8751-4d74-91ba-3f0db3abf108",
  divisionBAvailable: "71a2f76e-8751-4d74-91ba-3f0db3abf109",
  divisionBFailed: "71a2f76e-8751-4d74-91ba-3f0db3abf10a",
  edgeA: "71a2f76e-8751-4d74-91ba-3f0db3abf10b",
  edgeB: "71a2f76e-8751-4d74-91ba-3f0db3abf10c",
  latentRow: "71a2f76e-8751-4d74-91ba-3f0db3abf10d",
  divisionANormalRow: "71a2f76e-8751-4d74-91ba-3f0db3abf10e",
  divisionADegradedRow: "71a2f76e-8751-4d74-91ba-3f0db3abf10f",
  divisionBNormalRow: "71a2f76e-8751-4d74-91ba-3f0db3abf110",
  divisionBDegradedRow: "71a2f76e-8751-4d74-91ba-3f0db3abf111",
  hclConfiguration: "71a2f76e-8751-4d74-91ba-3f0db3abf112",
  bindingA: "71a2f76e-8751-4d74-91ba-3f0db3abf113",
  bindingB: "71a2f76e-8751-4d74-91ba-3f0db3abf114",
  faultTreePlaceholder: "71a2f76e-8751-4d74-91ba-3f0db3abf115",
  basicEventAPlaceholder: "71a2f76e-8751-4d74-91ba-3f0db3abf116",
  basicEventBPlaceholder: "71a2f76e-8751-4d74-91ba-3f0db3abf117",
  eventTree: "71a2f76e-8751-4d74-91ba-3f0db3abf201",
  functionalEvent: "71a2f76e-8751-4d74-91ba-3f0db3abf202",
  branch: "71a2f76e-8751-4d74-91ba-3f0db3abf203",
  successSequence: "71a2f76e-8751-4d74-91ba-3f0db3abf204",
  failureSequence: "71a2f76e-8751-4d74-91ba-3f0db3abf205",
  successEndState: "71a2f76e-8751-4d74-91ba-3f0db3abf206",
  failureEndState: "71a2f76e-8751-4d74-91ba-3f0db3abf207",
  topGatePlaceholder: "71a2f76e-8751-4d74-91ba-3f0db3abf208",
} as const;

function createExampleDependencyNetwork(): EsqBayesianNetwork {
  const id = EXAMPLE_DEPENDENCY_IDS;
  return {
    modelId: id.network,
    code: "BN-RPS-DEPENDENCY",
    name: "Protection division dependency",
    description: "A latent shared-condition model for the two reactor-protection divisions.",
    nodes: [
      {
        id: id.latentNode,
        kind: "CHANCE_NODE",
        code: "SHARED-CONDITION",
        name: "Shared protection condition",
        description: "A latent condition that represents shared environmental, calibration, and support-system stress.",
        states: [
          { id: id.latentNormal, code: "NORMAL", name: "Normal" },
          { id: id.latentDegraded, code: "DEGRADED", name: "Degraded" },
        ],
      },
      {
        id: id.divisionANode,
        kind: "CHANCE_NODE",
        code: "RPS-DIV-A",
        name: "Protection division A",
        description: "Conditional state of reactor-protection division A.",
        states: [
          { id: id.divisionAAvailable, code: "AVAILABLE", name: "Available" },
          { id: id.divisionAFailed, code: "FAILED", name: "Failed" },
        ],
      },
      {
        id: id.divisionBNode,
        kind: "CHANCE_NODE",
        code: "RPS-DIV-B",
        name: "Protection division B",
        description: "Conditional state of reactor-protection division B.",
        states: [
          { id: id.divisionBAvailable, code: "AVAILABLE", name: "Available" },
          { id: id.divisionBFailed, code: "FAILED", name: "Failed" },
        ],
      },
    ],
    edges: [
      { id: id.edgeA, parentNodeId: id.latentNode, childNodeId: id.divisionANode },
      { id: id.edgeB, parentNodeId: id.latentNode, childNodeId: id.divisionBNode },
    ],
    conditionalProbabilityTables: [
      {
        nodeId: id.latentNode,
        parents: [],
        rows: [{
          id: id.latentRow,
          parentStates: [],
          values: [
            { stateId: id.latentNormal, probability: 0.98 },
            { stateId: id.latentDegraded, probability: 0.02 },
          ],
        }],
      },
      {
        nodeId: id.divisionANode,
        parents: [{ nodeId: id.latentNode, order: 0 }],
        rows: [
          {
            id: id.divisionANormalRow,
            parentStates: [{ parentNodeId: id.latentNode, stateId: id.latentNormal }],
            values: [
              { stateId: id.divisionAAvailable, probability: 0.999 },
              { stateId: id.divisionAFailed, probability: 0.001 },
            ],
          },
          {
            id: id.divisionADegradedRow,
            parentStates: [{ parentNodeId: id.latentNode, stateId: id.latentDegraded }],
            values: [
              { stateId: id.divisionAAvailable, probability: 0.85 },
              { stateId: id.divisionAFailed, probability: 0.15 },
            ],
          },
        ],
      },
      {
        nodeId: id.divisionBNode,
        parents: [{ nodeId: id.latentNode, order: 0 }],
        rows: [
          {
            id: id.divisionBNormalRow,
            parentStates: [{ parentNodeId: id.latentNode, stateId: id.latentNormal }],
            values: [
              { stateId: id.divisionBAvailable, probability: 0.9985 },
              { stateId: id.divisionBFailed, probability: 0.0015 },
            ],
          },
          {
            id: id.divisionBDegradedRow,
            parentStates: [{ parentNodeId: id.latentNode, stateId: id.latentDegraded }],
            values: [
              { stateId: id.divisionBAvailable, probability: 0.8 },
              { stateId: id.divisionBFailed, probability: 0.2 },
            ],
          },
        ],
      },
    ],
    nodePositions: [
      { nodeId: id.latentNode, position: { x: 48, y: 108 } },
      { nodeId: id.divisionANode, position: { x: 328, y: 38 } },
      { nodeId: id.divisionBNode, position: { x: 328, y: 178 } },
    ],
    layout: {
      viewport: { x: 0, y: 0, zoom: 1 },
      mode: "MANUAL",
      direction: "LEFT_TO_RIGHT",
    },
  };
}

function createExampleHclConfiguration(): EsqHclConfiguration {
  const id = EXAMPLE_DEPENDENCY_IDS;
  return {
    modelId: id.hclConfiguration,
    code: "HCL-RPS-DEPENDENCY",
    name: "Protection dependency bindings",
    description: "Maps the correlated BN division failures into the reactor-protection fault tree.",
    bayesianNetwork: { workbookId: EXAMPLE_ESQ_WORKBOOK_ID, modelId: id.network },
    faultTrees: [{ workbookId: EXAMPLE_SY_WORKBOOK_ID, modelId: id.faultTreePlaceholder }],
    bindings: [
      {
        id: id.bindingA,
        faultTreeBasicEvent: {
          referenceType: "FAULT_TREE_BASIC_EVENT",
          workbookId: EXAMPLE_SY_WORKBOOK_ID,
          entityId: id.basicEventAPlaceholder,
        },
        bayesianNetworkNode: {
          referenceType: "BAYESIAN_NETWORK_NODE",
          workbookId: EXAMPLE_ESQ_WORKBOOK_ID,
          modelId: id.network,
          entityId: id.divisionANode,
        },
        trueStateIds: [id.divisionAFailed],
      },
      {
        id: id.bindingB,
        faultTreeBasicEvent: {
          referenceType: "FAULT_TREE_BASIC_EVENT",
          workbookId: EXAMPLE_SY_WORKBOOK_ID,
          entityId: id.basicEventBPlaceholder,
        },
        bayesianNetworkNode: {
          referenceType: "BAYESIAN_NETWORK_NODE",
          workbookId: EXAMPLE_ESQ_WORKBOOK_ID,
          modelId: id.network,
          entityId: id.divisionBNode,
        },
        trueStateIds: [id.divisionBFailed],
      },
    ],
    baseEvidence: { observations: [] },
    solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
  };
}

function createExampleDependencyEventTree(): EventTree {
  const id = EXAMPLE_DEPENDENCY_IDS;
  return {
    uuid: id.eventTree,
    name: "Protection dependency demonstration",
    description: "A compact event tree that demonstrates independent and HCL-linked quantification of the reactor-protection top event.",
    initiatingEventId: "IEG-DEPENDENCY-DEMO",
    initiatingEventFrequency: { value: 0.01 },
    functionalEvents: {
      [id.functionalEvent]: {
        uuid: id.functionalEvent,
        name: "Reactor protection succeeds",
        label: "RPS",
        order: 0,
        description: "The success branch is the complement of the linked reactor-protection failure top event.",
        faultTreeTopEvent: {
          referenceType: "FAULT_TREE_TOP_EVENT",
          workbookId: EXAMPLE_SY_WORKBOOK_ID,
          modelId: id.faultTreePlaceholder,
          entityId: id.topGatePlaceholder,
        },
      },
    },
    sequences: {
      [id.successSequence]: {
        uuid: id.successSequence,
        name: "Protected response",
        endState: EndState.SUCCESSFUL_MITIGATION,
        functionalEventStates: { [id.functionalEvent]: "SUCCESS" },
      },
      [id.failureSequence]: {
        uuid: id.failureSequence,
        name: "Unprotected response",
        endState: EndState.RADIONUCLIDE_RELEASE,
        functionalEventStates: { [id.functionalEvent]: "FAILURE" },
      },
    },
    endStateIds: {
      SUCCESSFUL_MITIGATION: id.successEndState,
      RADIONUCLIDE_RELEASE: id.failureEndState,
    },
    branches: {
      [id.branch]: {
        uuid: id.branch,
        name: "Reactor protection succeeds",
        functionalEventId: id.functionalEvent,
        paths: [
          { state: "SUCCESS", target: id.successSequence, targetType: "SEQUENCE" },
          { state: "FAILURE", target: id.failureSequence, targetType: "SEQUENCE" },
        ],
      },
    },
    initialState: { branchId: id.branch },
    implementsSrs: [],
  };
}

function exampleRpsReferences(systems: SystemsAnalysis): {
  modelId: string;
  topGateId: string;
  divisionAEventId: string;
  divisionBEventId: string;
} {
  const model = systems.systemLogicModels.find((candidate) => candidate.systemReference === "SYS-RPS");
  const divisionA = systems.systemBasicEvents.find((event) => event.code === "RPS-DVA-FS");
  const divisionB = systems.systemBasicEvents.find((event) => event.code === "RPS-DVB-FS");
  if (model === undefined || model.topGate === null || divisionA === undefined || divisionB === undefined) {
    throw new Error("The example Systems Analysis workbook does not contain the required reactor-protection fault tree.");
  }
  return {
    modelId: model.uuid,
    topGateId: model.topGate.gateId,
    divisionAEventId: divisionA.uuid,
    divisionBEventId: divisionB.uuid,
  };
}

function reconcileExampleEsqDependencyReferences(
  analysis: EventSequenceQuantification,
  esqWorkbookId: string,
  systems: SystemsAnalysis,
  syWorkbookId: string,
): EventSequenceQuantification {
  const references = analysis.hclConfigurations.some((configuration) => configuration.modelId === EXAMPLE_DEPENDENCY_IDS.hclConfiguration)
    ? exampleRpsReferences(systems)
    : null;
  const localNetworkIds = new Set(analysis.bayesianNetworks.map((network) => network.modelId));
  const systemModelIds = new Set(systems.systemLogicModels.map((model) => model.uuid));
  const systemBasicEventIds = new Set(systems.systemBasicEvents.map((event) => event.uuid));
  return {
    ...analysis,
    hclConfigurations: analysis.hclConfigurations.map((configuration) => {
      const reconciled = configuration.modelId === EXAMPLE_DEPENDENCY_IDS.hclConfiguration && references !== null
        ? {
          ...configuration,
          bayesianNetwork: { workbookId: esqWorkbookId, modelId: EXAMPLE_DEPENDENCY_IDS.network },
          faultTrees: [{ workbookId: syWorkbookId, modelId: references.modelId }],
          bindings: configuration.bindings.map((binding) => ({
            ...binding,
            faultTreeBasicEvent: {
              ...binding.faultTreeBasicEvent,
              workbookId: syWorkbookId,
              entityId: binding.id === EXAMPLE_DEPENDENCY_IDS.bindingA
                ? references.divisionAEventId
                : references.divisionBEventId,
            },
            bayesianNetworkNode: {
              ...binding.bayesianNetworkNode,
              workbookId: esqWorkbookId,
              modelId: EXAMPLE_DEPENDENCY_IDS.network,
            },
          })),
        }
        : configuration;
      return {
        ...reconciled,
        bayesianNetwork: localNetworkIds.has(reconciled.bayesianNetwork.modelId)
          ? { ...reconciled.bayesianNetwork, workbookId: esqWorkbookId }
          : reconciled.bayesianNetwork,
        faultTrees: reconciled.faultTrees.map((faultTree) => systemModelIds.has(faultTree.modelId)
          ? { ...faultTree, workbookId: syWorkbookId }
          : faultTree),
        bindings: reconciled.bindings.map((binding) => ({
          ...binding,
          faultTreeBasicEvent: systemBasicEventIds.has(binding.faultTreeBasicEvent.entityId)
            ? { ...binding.faultTreeBasicEvent, workbookId: syWorkbookId }
            : binding.faultTreeBasicEvent,
          bayesianNetworkNode: localNetworkIds.has(binding.bayesianNetworkNode.modelId)
            ? { ...binding.bayesianNetworkNode, workbookId: esqWorkbookId }
            : binding.bayesianNetworkNode,
        })),
      };
    }),
  };
}

function reconcileExampleEventTreeDependencyReferences(
  analysis: EventSequenceAnalysis,
  systems: SystemsAnalysis,
  syWorkbookId: string,
): EventSequenceAnalysis {
  const references = analysis.eventTrees?.some((tree) => tree.uuid === EXAMPLE_DEPENDENCY_IDS.eventTree) === true
    ? exampleRpsReferences(systems)
    : null;
  const systemModels = new Map(systems.systemLogicModels.map((model) => [model.uuid, model]));
  return {
    ...analysis,
    eventTrees: analysis.eventTrees?.map((tree) => {
      let functionalEvents = tree.functionalEvents;
      if (tree.uuid === EXAMPLE_DEPENDENCY_IDS.eventTree && references !== null) {
        const functionalEvent = tree.functionalEvents[EXAMPLE_DEPENDENCY_IDS.functionalEvent];
        if (functionalEvent !== undefined) {
          functionalEvents = {
            ...functionalEvents,
            [functionalEvent.uuid]: {
              ...functionalEvent,
              faultTreeTopEvent: {
                referenceType: "FAULT_TREE_TOP_EVENT",
                workbookId: syWorkbookId,
                modelId: references.modelId,
                entityId: references.topGateId,
              },
            },
          };
        }
      }
      return {
        ...tree,
        functionalEvents: Object.fromEntries(Object.entries(functionalEvents).map(([eventId, functionalEvent]) => {
          const reference = functionalEvent.faultTreeTopEvent;
          const model = reference === undefined ? undefined : systemModels.get(reference.modelId);
          return model === undefined || model.topGate === null
            ? [eventId, functionalEvent]
            : [eventId, {
              ...functionalEvent,
              faultTreeTopEvent: {
                ...reference,
                workbookId: syWorkbookId,
                entityId: model.topGate.gateId,
              },
            }];
        })),
      };
    }),
  };
}

export {
  EXAMPLE_DEPENDENCY_IDS,
  EXAMPLE_ESQ_WORKBOOK_ID,
  EXAMPLE_SY_WORKBOOK_ID,
  createExampleDependencyNetwork,
  createExampleHclConfiguration,
  createExampleDependencyEventTree,
  reconcileExampleEsqDependencyReferences,
  reconcileExampleEventTreeDependencyReferences,
};
