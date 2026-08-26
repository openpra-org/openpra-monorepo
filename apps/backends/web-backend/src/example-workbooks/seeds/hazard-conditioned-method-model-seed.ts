import { randomUUID } from "crypto";
import type { EventSequence, EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
import { EndState } from "interfaces-mef-types/core/events";
import type { HazardConditionedMethodModels } from "interfaces-mef-types/hazard-conditioned-models";
import type {
  WorkbookBayesianNetwork,
  WorkbookFaultTree,
} from "interfaces-mef-types/modeling";

function createHazardConditionedMethodModels(
  hazardCode: string,
  hazardName: string,
): HazardConditionedMethodModels {
  const ftModelId = randomUUID();
  const topGateId = randomUUID();
  const hazardEventId = randomUUID();
  const mitigationEventId = randomUUID();
  const hazardLeafId = randomUUID();
  const mitigationLeafId = randomUUID();
  const faultTree: WorkbookFaultTree = {
    modelId: ftModelId,
    code: `${hazardCode}-IE-FT`,
    name: `${hazardName} initiating-event logic`,
    description: `Hazard-conditioned initiating-event logic for ${hazardName}.`,
    topGate: { gateId: topGateId },
    gates: [{ id: topGateId, kind: "GATE", gateType: "OR", code: `${hazardCode}-IE`, name: `${hazardName} plant challenge`, description: `Top event for the ${hazardName} initiating-event model.` }],
    leafNodes: [
      { id: hazardLeafId, kind: "BASIC_EVENT_REFERENCE", basicEventId: hazardEventId },
      { id: mitigationLeafId, kind: "BASIC_EVENT_REFERENCE", basicEventId: mitigationEventId },
    ],
    gateInputs: [
      { id: randomUUID(), gateId: topGateId, childId: hazardLeafId, order: 0 },
      { id: randomUUID(), gateId: topGateId, childId: mitigationLeafId, order: 1 },
    ],
    nodePositions: [
      { nodeId: topGateId, position: { x: 340, y: 40 } },
      { nodeId: hazardLeafId, position: { x: 230, y: 250 } },
      { nodeId: mitigationLeafId, position: { x: 450, y: 250 } },
    ],
    layout: { viewport: { x: 0, y: 0, zoom: 0.9 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
  };

  const eventTreeId = randomUUID();
  const functionalEventId = randomUUID();
  const branchId = randomUUID();
  const successSequenceId = randomUUID();
  const releaseSequenceId = randomUUID();
  const successEndStateId = randomUUID();
  const releaseEndStateId = randomUUID();
  const initiatingEventId = randomUUID();
  const eventTree: EventTree = {
    uuid: eventTreeId,
    name: `${hazardName} response event tree`,
    description: `Success and failure response paths conditioned on ${hazardName}.`,
    initiatingEventId,
    initiatingEventFrequency: { value: 1e-3 },
    endStateIds: {
      SUCCESSFUL_MITIGATION: successEndStateId,
      RADIONUCLIDE_RELEASE: releaseEndStateId,
    },
    functionalEvents: {
      [functionalEventId]: {
        uuid: functionalEventId,
        name: "Mitigation succeeds",
        label: `${hazardCode}-MIT`,
        order: 0,
      },
    },
    branches: {
      [branchId]: {
        uuid: branchId,
        name: "Mitigation response",
        functionalEventId,
        paths: [
          { state: "SUCCESS", target: successSequenceId, targetType: "SEQUENCE" },
          { state: "FAILURE", target: releaseSequenceId, targetType: "SEQUENCE" },
        ],
      },
    },
    sequences: {
      [successSequenceId]: { uuid: successSequenceId, name: `${hazardCode}-SAFE`, endState: EndState.SUCCESSFUL_MITIGATION },
      [releaseSequenceId]: { uuid: releaseSequenceId, name: `${hazardCode}-REL`, endState: EndState.RADIONUCLIDE_RELEASE },
    },
    initialState: { branchId },
    implementsSrs: [],
  };
  const eventSequences: EventSequence[] = [
    {
      uuid: successSequenceId,
      name: `${hazardName} safe response`,
      initiatingEventId,
      plantOperatingStateId: `${hazardCode}-POS`,
      eventTreeId,
      eventTreeSequenceId: successSequenceId,
      functionalEventStates: { [functionalEventId]: "SUCCESS" },
      endState: EndState.SUCCESSFUL_MITIGATION,
      meanFrequency: 9e-4,
      implementsSrs: [],
    },
    {
      uuid: releaseSequenceId,
      name: `${hazardName} release response`,
      initiatingEventId,
      plantOperatingStateId: `${hazardCode}-POS`,
      eventTreeId,
      eventTreeSequenceId: releaseSequenceId,
      functionalEventStates: { [functionalEventId]: "FAILURE" },
      endState: EndState.RADIONUCLIDE_RELEASE,
      meanFrequency: 1e-4,
      implementsSrs: [],
    },
  ];

  const hazardNodeId = randomUUID();
  const protectionNodeId = randomUUID();
  const hazardTrueId = randomUUID();
  const hazardFalseId = randomUUID();
  const protectionTrueId = randomUUID();
  const protectionFalseId = randomUUID();
  const bayesianNetwork: WorkbookBayesianNetwork = {
    modelId: randomUUID(),
    code: `${hazardCode}-DEP-BN`,
    name: `${hazardName} dependency network`,
    description: `Dependency treatment for hazard demand and protection availability under ${hazardName}.`,
    nodes: [
      {
        id: hazardNodeId,
        kind: "CHANCE_NODE",
        code: `${hazardCode}-DEMAND`,
        name: `${hazardName} demand present`,
        description: `Hazard-demand state for the ${hazardName} dependency model.`,
        states: [
          { id: hazardTrueId, code: "TRUE", name: "Present" },
          { id: hazardFalseId, code: "FALSE", name: "Absent" },
        ],
      },
      {
        id: protectionNodeId,
        kind: "CHANCE_NODE",
        code: `${hazardCode}-PROTECT`,
        name: "Protection unavailable",
        description: `Conditional availability of credited protection under ${hazardName}.`,
        states: [
          { id: protectionTrueId, code: "TRUE", name: "Unavailable" },
          { id: protectionFalseId, code: "FALSE", name: "Available" },
        ],
      },
    ],
    edges: [{ id: randomUUID(), parentNodeId: hazardNodeId, childNodeId: protectionNodeId }],
    conditionalProbabilityTables: [
      {
        nodeId: hazardNodeId,
        parents: [],
        rows: [{ id: randomUUID(), parentStates: [], values: [{ stateId: hazardTrueId, probability: 0.1 }, { stateId: hazardFalseId, probability: 0.9 }] }],
      },
      {
        nodeId: protectionNodeId,
        parents: [{ nodeId: hazardNodeId, order: 0 }],
        rows: [
          { id: randomUUID(), parentStates: [{ parentNodeId: hazardNodeId, stateId: hazardTrueId }], values: [{ stateId: protectionTrueId, probability: 0.2 }, { stateId: protectionFalseId, probability: 0.8 }] },
          { id: randomUUID(), parentStates: [{ parentNodeId: hazardNodeId, stateId: hazardFalseId }], values: [{ stateId: protectionTrueId, probability: 0.01 }, { stateId: protectionFalseId, probability: 0.99 }] },
        ],
      },
    ],
    nodePositions: [
      { nodeId: hazardNodeId, position: { x: 120, y: 150 } },
      { nodeId: protectionNodeId, position: { x: 440, y: 150 } },
    ],
    layout: { viewport: { x: 0, y: 0, zoom: 0.8 }, mode: "MANUAL", direction: "LEFT_TO_RIGHT" },
  };

  return {
    initiatingEventFaultTrees: [faultTree],
    faultTreeCatalogue: {
      basicEvents: [
        { id: hazardEventId, code: `${hazardCode}-HAZ`, name: `${hazardName} demand exceeds screening level`, description: `The ${hazardName} demand exceeds the retained screening level.`, probability: { value: 1e-3 } },
        { id: mitigationEventId, code: `${hazardCode}-MIT-F`, name: "Hazard mitigation unavailable", description: `Credited mitigation is unavailable during the ${hazardName} demand.`, probability: { value: 1e-2 } },
      ],
    },
    eventTrees: [eventTree],
    eventSequences,
    dependencyBayesianNetworks: [bayesianNetwork],
  };
}

export { createHazardConditionedMethodModels };
