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
import type { DataAnalysis, DataAnalysisParameter } from "interfaces-mef-types/da/data-analysis";
import type { HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
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

function reconcileExampleSyDataAnalysisReferences(
  analysis: SystemsAnalysis,
  dataAnalysis: DataAnalysis,
  daWorkbookId: string,
): SystemsAnalysis {
  const parametersByBasicEvent = new Map<string, DataAnalysisParameter>();
  for (const parameter of dataAnalysis.parameters) {
    if (parameter.basicEventRef === undefined) continue;
    if (parametersByBasicEvent.has(parameter.basicEventRef)) {
      throw new Error(`The example Data Analysis workbook defines more than one parameter for basic event '${parameter.basicEventRef}'.`);
    }
    parametersByBasicEvent.set(parameter.basicEventRef, parameter);
  }

  const supportedTypes = new Set(["PROBABILITY", "UNAVAILABILITY", "HUMAN_ERROR_PROBABILITY"]);
  let changed = false;
  const systemBasicEvents = analysis.systemBasicEvents.map((event) => {
    const parameter = parametersByBasicEvent.get(event.uuid) ?? parametersByBasicEvent.get(event.code);
    if (parameter === undefined) return event;
    if (!supportedTypes.has(parameter.parameterType)) {
      throw new Error(`DA parameter '${parameter.uuid}' cannot control the probability of example basic event '${event.code}'.`);
    }
    if (!Number.isFinite(parameter.value) || parameter.value < 0 || parameter.value > 1) {
      throw new Error(`DA parameter '${parameter.uuid}' must be finite and between zero and one.`);
    }
    const reference = event.controlledDataSource;
    if (
      event.probability === parameter.value &&
      reference?.workbookId === daWorkbookId &&
      reference.entityId === parameter.uuid
    ) return event;
    changed = true;
    return {
      ...event,
      probability: parameter.value,
      controlledDataSource: {
        referenceType: "WORKBOOK_PARAMETER" as const,
        workbookId: daWorkbookId,
        entityId: parameter.uuid,
      },
      dataAnalysisBasicEventRef: undefined,
    };
  });

  return changed ? { ...analysis, systemBasicEvents } : analysis;
}

function primaryHepQuantification(
  humanReliability: HumanReliabilityAnalysis,
  hfeId: string,
): HumanReliabilityAnalysis["hepQuantifications"][number] {
  const candidates = humanReliability.hepQuantifications.filter((entry) => entry.hfeId === hfeId);
  const conventional = candidates.filter((entry) => entry.uuid === `HEPQ-${hfeId}`);
  const nonRecoveryIds = new Set(
    (humanReliability.recoveryActions ?? []).map((action) => action.hepQuantificationId),
  );
  const nonRecovery = candidates.filter((entry) => !nonRecoveryIds.has(entry.uuid));
  const matches = conventional.length > 0
    ? conventional
    : nonRecovery.length > 0
      ? nonRecovery
      : candidates;
  if (matches.length !== 1) {
    throw new Error(
      `The example Human Reliability workbook resolves human-failure event '${hfeId}' to ${matches.length} primary HEP quantifications; expected exactly one.`,
    );
  }
  const quantification = matches[0]!;
  const value = quantification.meanHep ?? quantification.pointEstimateHep;
  if (value === undefined || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(
      `HRA HEP quantification '${quantification.uuid}' must provide a finite mean or point estimate between zero and one.`,
    );
  }
  return quantification;
}

function reconcileExampleSyHumanReliabilityReferences(
  analysis: SystemsAnalysis,
  humanReliability: HumanReliabilityAnalysis,
  hrWorkbookId: string,
): SystemsAnalysis {
  const humanFailureEvents = new Map(
    humanReliability.humanFailureEvents.map((event) => [event.uuid, event]),
  );
  const references = new Map<string, {
    quantificationId: string;
    value: number;
  }>();
  const resolve = (hfeId: string): { quantificationId: string; value: number } => {
    const cached = references.get(hfeId);
    if (cached !== undefined) return cached;
    if (!humanFailureEvents.has(hfeId)) {
      throw new Error(`The example Human Reliability workbook does not define human-failure event '${hfeId}'.`);
    }
    const quantification = primaryHepQuantification(humanReliability, hfeId);
    const resolved = {
      quantificationId: quantification.uuid,
      value: (quantification.meanHep ?? quantification.pointEstimateHep)!,
    };
    references.set(hfeId, resolved);
    return resolved;
  };

  let changed = false;
  const systemBasicEvents = analysis.systemBasicEvents.map((event) => {
    if (event.failureMode !== "HUMAN_ERROR") return event;
    const hfeId = event.attributes?.find((attribute) => attribute.name === "hfeReference")?.value;
    if (hfeId === undefined || hfeId.length === 0) return event;
    const resolved = resolve(hfeId);
    const source = event.controlledDataSource;
    if (
      event.probability === resolved.value &&
      source?.referenceType === "HUMAN_FAILURE_EVENT" &&
      source.workbookId === hrWorkbookId &&
      source.entityId === hfeId &&
      source.quantificationId === resolved.quantificationId
    ) return event;
    changed = true;
    return {
      ...event,
      probability: resolved.value,
      controlledDataSource: {
        referenceType: "HUMAN_FAILURE_EVENT" as const,
        workbookId: hrWorkbookId,
        entityId: hfeId,
        quantificationId: resolved.quantificationId,
      },
      dataAnalysisBasicEventRef: undefined,
    };
  });

  const humanFailureEventIntegrations = analysis.humanFailureEventIntegrations.map((integration) => {
    if (integration.hfeReference.length === 0) return integration;
    const resolved = resolve(integration.hfeReference);
    const source = integration.hfeSource;
    if (
      source?.workbookId === hrWorkbookId &&
      source.entityId === integration.hfeReference &&
      source.quantificationId === resolved.quantificationId
    ) return integration;
    changed = true;
    return {
      ...integration,
      hfeSource: {
        referenceType: "HUMAN_FAILURE_EVENT" as const,
        workbookId: hrWorkbookId,
        entityId: integration.hfeReference,
        quantificationId: resolved.quantificationId,
      },
    };
  });

  return changed
    ? { ...analysis, systemBasicEvents, humanFailureEventIntegrations }
    : analysis;
}

function frequencyValue(value: number | { value: number }): number {
  return typeof value === "number" ? value : value.value;
}

function consequenceMetricMatches(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a === b) return true;
  return [
    ["latent", "cancer"],
    ["early", "fatal"],
    ["boundary", "dose"],
    ["population", "dose"],
  ].some((tokens) => tokens.every((token) => a.includes(token) && b.includes(token)));
}

interface ReconciledExampleRiskWorkbooks {
  eventSequenceQuantification: EventSequenceQuantification;
  radiologicalConsequence: RadiologicalConsequenceAnalysis;
  riskIntegration: RiskIntegration;
}

/**
 * Resolves the complete ES -> ESQ/RC -> RI chain after generated workbooks have
 * real project-local ids. The legacy display fields remain populated for old
 * workbooks, while the typed references are the durable source of identity.
 */
function reconcileExampleRiskResultReferences(
  eventSequences: EventSequenceAnalysis,
  esWorkbookId: string,
  eventSequenceQuantification: EventSequenceQuantification,
  esqWorkbookId: string,
  radiologicalConsequence: RadiologicalConsequenceAnalysis,
  rcWorkbookId: string,
  riskIntegration: RiskIntegration,
  riWorkbookId: string,
): ReconciledExampleRiskWorkbooks {
  const families = new Map(eventSequences.eventSequenceFamilies.map((family) => [family.uuid, family]));
  const familyReference = (entityId: string) => ({
    referenceType: "EVENT_SEQUENCE_FAMILY" as const,
    workbookId: esWorkbookId,
    entityId,
  });
  const familyQuantifications = eventSequenceQuantification.familyQuantifications.map((quantification) =>
    families.has(quantification.eventSequenceFamilyRef)
      ? { ...quantification, eventSequenceFamilyReference: familyReference(quantification.eventSequenceFamilyRef) }
      : quantification);

  const consequenceRecords = radiologicalConsequence.consequenceQuantification.eventSequenceConsequences.map(
    (record) => {
      const family = families.get(record.eventSequenceFamily);
      if (family === undefined) return record;
      return {
        ...record,
        uuid: record.uuid ?? `RCQ-${record.eventSequenceFamily}`,
        eventSequenceFamilyReference: familyReference(family.uuid),
      };
    },
  );
  const consequenceByFamily = new Map(consequenceRecords.map((record) => [record.eventSequenceFamily, record]));

  const releaseCategoryInputs = radiologicalConsequence.releaseCategoryToConsequence.releaseCategoryInputs.map(
    (input) => ({
      ...input,
      eventSequenceFamilyReferences: eventSequences.eventSequenceFamilies
        .filter((family) => family.releaseCategoryIds?.includes(input.releaseCategory) === true)
        .map((family) => familyReference(family.uuid)),
    }),
  );

  const compiledRiskInputs = riskIntegration.compiledRiskInputs.map((input) => {
    const family = families.get(input.eventSequenceFamilyRef);
    if (family === undefined) return input;
    const quantifications = familyQuantifications.filter(
      (quantification) => quantification.eventSequenceFamilyRef === family.uuid,
    );
    const consequence = consequenceByFamily.get(family.uuid);
    const consequences = consequence === undefined
      ? input.consequences
      : riskIntegration.scopeDefinition.consequenceMeasures.flatMap((measure) => {
        const result = consequence.consequenceResults.find((candidate) =>
          consequenceMetricMatches(candidate.metric, measure.name));
        return result === undefined ? [] : [{
          metric: measure.name,
          meanValue: result.meanValue,
          unit: result.unit,
          distribution: result.uncertaintyDistribution,
        }];
      });
    const resolvedConsequences = consequences.length > 0 ? consequences : input.consequences;
    return {
      ...input,
      eventSequenceFamilyReference: familyReference(family.uuid),
      frequency: quantifications.length > 0
        ? quantifications.reduce((sum, quantification) => sum + frequencyValue(quantification.meanFrequency), 0)
        : input.frequency,
      esqFamilyQuantificationRef: quantifications.length > 0
        ? quantifications.map((quantification) => quantification.uuid).join(" + ")
        : input.esqFamilyQuantificationRef,
      familyQuantificationReferences: quantifications.map((quantification) => ({
        referenceType: "EVENT_SEQUENCE_FAMILY_QUANTIFICATION" as const,
        workbookId: esqWorkbookId,
        entityId: quantification.uuid,
      })),
      consequences: resolvedConsequences,
      rcqRecordRef: consequence?.uuid ?? input.rcqRecordRef,
      consequenceResultReference: consequence?.uuid === undefined ? input.consequenceResultReference : {
        referenceType: "RADIOLOGICAL_CONSEQUENCE_RESULT" as const,
        workbookId: rcWorkbookId,
        entityId: consequence.uuid,
      },
      consistentWithEventSequenceAnalysis: true,
    };
  });

  const metrics = riskIntegration.integratedRiskResults.metrics.map((metric) => {
    if (metric.consequenceMeasureRef === undefined || metric.consequenceMeasureRef.length === 0) return metric;
    const value = compiledRiskInputs.reduce((sum, input) => {
      const consequence = input.consequences.find((entry) =>
        consequenceMetricMatches(entry.metric, metric.consequenceMeasureRef!));
      return sum + input.frequency * (consequence?.meanValue ?? 0);
    }, 0);
    return { ...metric, value };
  });

  const integratedResultReference = {
    referenceType: "INTEGRATED_RISK_RESULT" as const,
    workbookId: riWorkbookId,
    entityId: riskIntegration.integratedRiskResults.uuid,
  };
  return {
    eventSequenceQuantification: {
      ...eventSequenceQuantification,
      familyQuantifications,
    },
    radiologicalConsequence: {
      ...radiologicalConsequence,
      releaseCategoryToConsequence: {
        ...radiologicalConsequence.releaseCategoryToConsequence,
        releaseCategoryInputs,
      },
      consequenceQuantification: {
        ...radiologicalConsequence.consequenceQuantification,
        eventSequenceConsequences: consequenceRecords,
      },
      riskIntegrationFeedback: radiologicalConsequence.riskIntegrationFeedback === undefined
        ? undefined
        : {
          ...radiologicalConsequence.riskIntegrationFeedback,
          analysisRef: riskIntegration.integratedRiskResults.uuid,
          integratedRiskResultReference: integratedResultReference,
        },
    },
    riskIntegration: {
      ...riskIntegration,
      scopeDefinition: {
        ...riskIntegration.scopeDefinition,
        eventSequenceFamilyRefs: compiledRiskInputs.map((input) => input.eventSequenceFamilyRef),
      },
      compiledRiskInputs,
      integratedRiskResults: {
        ...riskIntegration.integratedRiskResults,
        metrics,
      },
    },
  };
}

export {
  EXAMPLE_DEPENDENCY_IDS,
  EXAMPLE_ESQ_WORKBOOK_ID,
  EXAMPLE_SY_WORKBOOK_ID,
  createExampleDependencyNetwork,
  createExampleHclConfiguration,
  createExampleDependencyEventTree,
  reconcileExampleSyDataAnalysisReferences,
  reconcileExampleSyHumanReliabilityReferences,
  reconcileExampleRiskResultReferences,
  reconcileExampleEsqDependencyReferences,
  reconcileExampleEventTreeDependencyReferences,
};
