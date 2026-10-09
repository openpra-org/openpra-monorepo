import type {
  EsqBayesianNetwork,
  EsqHclConfiguration,
} from "interfaces-mef-types/esq/workbook-models";
import type { EsqCellSide, EsqFunctionTarget, EsqTopReference, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type {
  EventSequenceAnalysis,
  EventTree,
} from "interfaces-mef-types/es/event-sequence-analysis";
import { carriesUncertainExpression, type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { isComponentModel, type DataAnalysis, type DataAnalysisParameter } from "interfaces-mef-types/da/data-analysis";
import {
  ccfFactorExpressions,
  ccfFactorVector,
  expressionReferences,
  mapModelArguments,
  type CcfFactorModel,
  type UncertainExpression,
  type UncertainVector,
} from "interfaces-mef-types/core/uncertainty";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
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
    initiatingEventFrequency: { expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 0.01 } } } },
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

function reconcileExampleSyDependencyOwnership(
  analysis: SystemsAnalysis,
  syWorkbookId: string,
): SystemsAnalysis {
  const exampleReferences = (analysis.dependencyHclConfigurations ?? []).some(
    (configuration) => configuration.modelId === EXAMPLE_DEPENDENCY_IDS.hclConfiguration,
  ) ? exampleRpsReferences(analysis) : null;
  const localNetworkIds = new Set((analysis.dependencyBayesianNetworks ?? []).map((network) => network.modelId));
  const localFaultTreeIds = new Set(analysis.systemLogicModels.map((model) => model.uuid));
  const localBasicEventIds = new Set(analysis.systemBasicEvents.map((event) => event.uuid));
  return {
    ...analysis,
    dependencyHclConfigurations: (analysis.dependencyHclConfigurations ?? []).map((configuration) => {
      const owned = configuration.modelId === EXAMPLE_DEPENDENCY_IDS.hclConfiguration && exampleReferences !== null
        ? {
            ...configuration,
            bayesianNetwork: { workbookId: syWorkbookId, modelId: EXAMPLE_DEPENDENCY_IDS.network },
            faultTrees: [{ workbookId: syWorkbookId, modelId: exampleReferences.modelId }],
            bindings: configuration.bindings.map((binding) => ({
              ...binding,
              faultTreeBasicEvent: {
                ...binding.faultTreeBasicEvent,
                workbookId: syWorkbookId,
                entityId: binding.id === EXAMPLE_DEPENDENCY_IDS.bindingA
                  ? exampleReferences.divisionAEventId
                  : exampleReferences.divisionBEventId,
              },
              bayesianNetworkNode: {
                ...binding.bayesianNetworkNode,
                workbookId: syWorkbookId,
                modelId: EXAMPLE_DEPENDENCY_IDS.network,
              },
            })),
          }
        : configuration;
      return {
        ...owned,
        bayesianNetwork: localNetworkIds.has(owned.bayesianNetwork.modelId)
          ? { ...owned.bayesianNetwork, workbookId: syWorkbookId }
          : owned.bayesianNetwork,
        faultTrees: owned.faultTrees.map((faultTree) => localFaultTreeIds.has(faultTree.modelId)
          ? { ...faultTree, workbookId: syWorkbookId }
          : faultTree),
        bindings: owned.bindings.map((binding) => ({
          ...binding,
          faultTreeBasicEvent: localBasicEventIds.has(binding.faultTreeBasicEvent.entityId)
            ? { ...binding.faultTreeBasicEvent, workbookId: syWorkbookId }
            : binding.faultTreeBasicEvent,
          bayesianNetworkNode: localNetworkIds.has(binding.bayesianNetworkNode.modelId)
            ? { ...binding.bayesianNetworkNode, workbookId: syWorkbookId }
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

type ReferenceRewire = (reference: WorkbookParameterReference) => WorkbookParameterReference;

function rewiredExpression(expression: UncertainExpression, rewire: ReferenceRewire): UncertainExpression {
  switch (expression.node) {
    case "VALUE":
      return expression;
    case "PARAMETER":
      return { node: "PARAMETER", reference: rewire(expression.reference) };
    case "OPERATION":
      return { ...expression, operands: expression.operands.map((operand) => rewiredExpression(operand, rewire)) };
    case "MODEL":
      return { node: "MODEL", model: mapModelArguments(expression.model, (argument) => rewiredExpression(argument, rewire)) };
  }
}

function rewiredVector(vector: UncertainVector, rewire: ReferenceRewire): UncertainVector {
  return vector.node === "PARAMETER" ? { node: "PARAMETER", reference: rewire(vector.reference) } : vector;
}

function rewiredFactors(factors: CcfFactorModel, expressions: ReferenceRewire, vectors: ReferenceRewire): CcfFactorModel {
  switch (factors.model) {
    case "BETA_FACTOR":
      return { ...factors, beta: rewiredExpression(factors.beta, expressions) };
    case "MGL":
      return { ...factors, factors: factors.factors.map((factor) => rewiredExpression(factor, expressions)) };
    case "ALPHA_FACTOR":
      return { ...factors, alphas: rewiredVector(factors.alphas, vectors) };
    case "PHI_FACTOR":
      return { ...factors, phis: rewiredVector(factors.phis, vectors) };
  }
}

function heldIn(ids: ReadonlySet<string>, workbookId: string): ReferenceRewire {
  return (reference) => (ids.has(reference.entityId) ? { ...reference, workbookId } : reference);
}

function staleIn(ids: ReadonlySet<string>, workbookId: string): (reference: WorkbookParameterReference) => boolean {
  return (reference) => ids.has(reference.entityId) && reference.workbookId !== workbookId;
}

function relinkedExpression(expression: UncertainExpression, parameterIds: ReadonlySet<string>, workbookId: string): UncertainExpression {
  return rewiredExpression(expression, heldIn(parameterIds, workbookId));
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
  const parametersById = new Map(dataAnalysis.parameters.map((parameter) => [parameter.uuid, parameter]));
  const parameterIds = new Set(parametersById.keys());
  const estimateIds = new Set((dataAnalysis.ccfParameterEstimations ?? []).map((estimate) => estimate.uuid));
  const staleParameter = staleIn(parameterIds, daWorkbookId);
  const staleEstimate = staleIn(estimateIds, daWorkbookId);
  let changed = false;
  const systemBasicEvents = analysis.systemBasicEvents.map((event) => {
    if (carriesUncertainExpression(event.failureMode)) {
      const expression = event.expression;
      if (expression === undefined) return event;
      const stale = expressionReferences(expression).some(staleParameter);
      if (!stale) return event;
      changed = true;
      return { ...event, expression: relinkedExpression(expression, parameterIds, daWorkbookId) };
    }
    const named = parametersByBasicEvent.get(event.uuid) ?? parametersByBasicEvent.get(event.code);
    const legacy = event.dataAnalysisBasicEventRef === undefined ? undefined : parametersById.get(event.dataAnalysisBasicEventRef);
    if (named === undefined && (legacy === undefined || !supportedTypes.has(legacy.parameterType))) return event;
    const parameter = named ?? legacy;
    if (parameter === undefined) return event;
    if (!supportedTypes.has(parameter.parameterType) || isComponentModel(parameter.quantificationModel)) {
      throw new Error(`DA parameter '${parameter.uuid}' cannot control the probability of example basic event '${event.code}'.`);
    }
    const value = parameter.value;
    if (value === undefined || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`DA parameter '${parameter.uuid}' must be finite and between zero and one.`);
    }
    const reference = event.controlledDataSource;
    if (
      event.probability === value &&
      reference?.workbookId === daWorkbookId &&
      reference.entityId === parameter.uuid
    ) return event;
    changed = true;
    return {
      ...event,
      probability: value,
      controlledDataSource: {
        referenceType: "WORKBOOK_PARAMETER" as const,
        workbookId: daWorkbookId,
        entityId: parameter.uuid,
      },
      dataAnalysisBasicEventRef: undefined,
    };
  });

  const commonCauseFailureGroups = analysis.commonCauseFailureGroups.map((group) => {
    const vector = ccfFactorVector(group.factors);
    const stale = [group.total, ...ccfFactorExpressions(group.factors)].flatMap(expressionReferences).some(staleParameter)
      || (vector?.node === "PARAMETER" && staleEstimate(vector.reference));
    if (!stale) return group;
    changed = true;
    return {
      ...group,
      total: relinkedExpression(group.total, parameterIds, daWorkbookId),
      factors: rewiredFactors(group.factors, heldIn(parameterIds, daWorkbookId), heldIn(estimateIds, daWorkbookId)),
    };
  });

  return changed ? { ...analysis, systemBasicEvents, commonCauseFailureGroups } : analysis;
}

const EXAMPLE_SC_PREFIX = "example-sc-";

interface ExampleMissionTimeLink {
  ids: ReadonlySet<string>;
  workbookId: string;
  from?: string;
}

interface ProjectMissionTimeSource {
  sc: SuccessCriteriaDevelopment;
  workbookId: string;
}

type MissionTimeReconciler<T> = (mef: T, sc: SuccessCriteriaDevelopment, scWorkbookId: string, from?: string) => T;

function missionTimeIds(sc: SuccessCriteriaDevelopment): Set<string> {
  return new Set([...sc.missionTimes, ...(sc.componentMissionTimes ?? [])].map((entry) => entry.uuid));
}

function exampleMissionTimeLink(sc: SuccessCriteriaDevelopment, scWorkbookId: string, from?: string): ExampleMissionTimeLink {
  return { ids: missionTimeIds(sc), workbookId: scWorkbookId, ...(from === undefined ? {} : { from }) };
}

function linksExample(workbookId: string, link: ExampleMissionTimeLink): boolean {
  return link.from === undefined ? workbookId.startsWith(EXAMPLE_SC_PREFIX) : workbookId === link.from;
}

function relinkedMissionTime(expression: UncertainExpression, link: ExampleMissionTimeLink): UncertainExpression {
  return rewiredExpression(expression, (reference) => (linksExample(reference.workbookId, link) && link.ids.has(reference.entityId)
    ? { ...reference, workbookId: link.workbookId }
    : reference));
}

function relinkedOptional(expression: UncertainExpression | undefined, link: ExampleMissionTimeLink): UncertainExpression | undefined {
  return expression === undefined ? undefined : relinkedMissionTime(expression, link);
}

function relinkedScLink(id: string | undefined, link: ExampleMissionTimeLink): string | undefined {
  return id !== undefined && linksExample(id, link) ? link.workbookId : id;
}

function present(expression: UncertainExpression | undefined): UncertainExpression[] {
  return expression === undefined ? [] : [expression];
}

function syMissionTimeExpressions(analysis: SystemsAnalysis): UncertainExpression[] {
  return [
    ...analysis.systemDefinitions.flatMap((definition) => present(definition.missionTime)),
    ...analysis.systemBasicEvents.flatMap((event) => present(event.expression)),
    ...analysis.commonCauseFailureGroups.map((group) => group.total),
  ];
}

function daMissionTimeExpressions(dataAnalysis: DataAnalysis): UncertainExpression[] {
  const needs = dataAnalysis.dataNeeds;
  return [
    ...dataAnalysis.parameters.flatMap((parameter) => [...present(parameter.estimate), ...present(parameter.missionTime)]),
    ...(needs?.basicEvents ?? []).flatMap((need) => [...present(need.expression), ...present(need.importedMissionTime), ...present(need.missionTime)]),
    ...(needs?.ccfGroups ?? []).flatMap((group) => present(group.total)),
  ];
}

function esqMissionTimeExpressions(quantification: EventSequenceQuantification): UncertainExpression[] {
  const model = quantification.model;
  if (model === undefined) return [];
  return [
    ...model.trees.flatMap((tree) => present(tree.missionTime)),
    ...model.events.flatMap((event) => [...present(event.expression), ...present(event.missionTime)]),
    ...model.parameters.flatMap((parameter) => [...present(parameter.estimate), ...present(parameter.missionTime)]),
    ...model.ccfGroups.flatMap((group) => present(group.total)),
  ];
}

function exampleMissionTimeReferences(expressions: readonly UncertainExpression[]): Map<string, Set<string>> {
  const byExample = new Map<string, Set<string>>();
  for (const reference of expressions.flatMap(expressionReferences)) {
    if (!reference.workbookId.startsWith(EXAMPLE_SC_PREFIX)) continue;
    const ids = byExample.get(reference.workbookId) ?? new Set<string>();
    ids.add(reference.entityId);
    byExample.set(reference.workbookId, ids);
  }
  return byExample;
}

function holdsAll(source: ProjectMissionTimeSource, ids: ReadonlySet<string>): boolean {
  const held = missionTimeIds(source.sc);
  return [...ids].every((id) => held.has(id));
}

function projectMissionTimeSource(sources: readonly ProjectMissionTimeSource[], ids: ReadonlySet<string>): ProjectMissionTimeSource | undefined {
  return sources.find((source) => holdsAll(source, ids));
}

function relinkExampleMissionTimes<T>(mef: T, expressions: readonly UncertainExpression[], sources: readonly ProjectMissionTimeSource[], reconcile: MissionTimeReconciler<T>): T {
  let relinked = mef;
  for (const [from, ids] of exampleMissionTimeReferences(expressions)) {
    const target = projectMissionTimeSource(sources, ids);
    if (target !== undefined) relinked = reconcile(relinked, target.sc, target.workbookId, from);
  }
  return relinked;
}

function reconcileExampleSyMissionTimeReferences(analysis: SystemsAnalysis, sc: SuccessCriteriaDevelopment, scWorkbookId: string, from?: string): SystemsAnalysis {
  const link = exampleMissionTimeLink(sc, scWorkbookId, from);
  return {
    ...analysis,
    ...(analysis.linkedWorkbooks === undefined ? {} : { linkedWorkbooks: { ...analysis.linkedWorkbooks, SC: relinkedScLink(analysis.linkedWorkbooks.SC, link) } }),
    systemDefinitions: analysis.systemDefinitions.map((definition) => (definition.missionTime === undefined ? definition : { ...definition, missionTime: relinkedMissionTime(definition.missionTime, link) })),
    systemBasicEvents: analysis.systemBasicEvents.map((event) => (event.expression === undefined ? event : { ...event, expression: relinkedMissionTime(event.expression, link) })),
    commonCauseFailureGroups: analysis.commonCauseFailureGroups.map((group) => ({ ...group, total: relinkedMissionTime(group.total, link) })),
  };
}

function reconcileExampleDaMissionTimeReferences(dataAnalysis: DataAnalysis, sc: SuccessCriteriaDevelopment, scWorkbookId: string, from?: string): DataAnalysis {
  const link = exampleMissionTimeLink(sc, scWorkbookId, from);
  const needs = dataAnalysis.dataNeeds;
  return {
    ...dataAnalysis,
    ...(dataAnalysis.linkedWorkbooks === undefined ? {} : { linkedWorkbooks: { ...dataAnalysis.linkedWorkbooks, SC: relinkedScLink(dataAnalysis.linkedWorkbooks.SC, link) } }),
    parameters: dataAnalysis.parameters.map((parameter) => ({
      ...parameter,
      estimate: relinkedOptional(parameter.estimate, link),
      missionTime: relinkedOptional(parameter.missionTime, link),
    })),
    ...(needs === undefined ? {} : {
      dataNeeds: {
        ...needs,
        basicEvents: needs.basicEvents.map((need) => ({
          ...need,
          expression: relinkedOptional(need.expression, link),
          importedMissionTime: relinkedOptional(need.importedMissionTime, link),
          missionTime: relinkedOptional(need.missionTime, link),
        })),
        ccfGroups: needs.ccfGroups.map((group) => ({ ...group, total: relinkedOptional(group.total, link) })),
      },
    }),
  };
}

function reconcileExampleEsqMissionTimeReferences(quantification: EventSequenceQuantification, sc: SuccessCriteriaDevelopment, scWorkbookId: string, from?: string): EventSequenceQuantification {
  const link = exampleMissionTimeLink(sc, scWorkbookId, from);
  const model = quantification.model;
  return {
    ...quantification,
    ...(quantification.linkedWorkbooks === undefined ? {} : { linkedWorkbooks: { ...quantification.linkedWorkbooks, SC: relinkedScLink(quantification.linkedWorkbooks.SC, link) } }),
    ...(model === undefined ? {} : {
      model: {
        ...model,
        sources: model.sources.map((source) => (source.element === "SC" ? { ...source, workbookId: relinkedScLink(source.workbookId, link) ?? source.workbookId } : source)),
        trees: model.trees.map((tree) => ({ ...tree, missionTime: relinkedOptional(tree.missionTime, link) })),
        events: model.events.map((event) => ({ ...event, expression: relinkedOptional(event.expression, link), missionTime: relinkedOptional(event.missionTime, link) })),
        parameters: model.parameters.map((parameter) => ({ ...parameter, estimate: relinkedOptional(parameter.estimate, link), missionTime: relinkedOptional(parameter.missionTime, link) })),
        ccfGroups: model.ccfGroups.map((group) => ({ ...group, total: relinkedOptional(group.total, link) })),
      },
    }),
  };
}

const EXAMPLE_DA_PREFIX = "example-da-";
const EXAMPLE_SY_PREFIX = "example-sy-";

type DataAnalysisLinkKind = "PARAMETER" | "CCF_ESTIMATE" | "FAILURE_MODE" | "SOURCE" | "CASE";

type SystemsLinkKind = "MODEL" | "BASIC_EVENT";

interface ExampleLinkEntity<K extends string> {
  kind: K;
  id: string;
}

interface ExampleLink<K extends string> {
  workbookId: string;
  entity?: ExampleLinkEntity<K>;
}

interface ProjectDataAnalysisSource {
  da: DataAnalysis;
  workbookId: string;
}

interface ProjectSystemsSource {
  sy: SystemsAnalysis;
  workbookId: string;
}

interface KeptExampleLink {
  from: string;
  linkedValues: number;
}

interface ExampleRelink<T> {
  mef: T;
  kept: KeptExampleLink[];
}

type HeldIds<K extends string> = Record<K, ReadonlySet<string>>;

type ExampleLinkReconciler<T> = (mef: T, workbookId: string, from: string) => T;

function exampleLinkGroups<K extends string>(links: readonly ExampleLink<K>[], prefix: string): Map<string, Map<string, ExampleLinkEntity<K>>> {
  const groups = new Map<string, Map<string, ExampleLinkEntity<K>>>();
  for (const link of links) {
    if (!link.workbookId.startsWith(prefix)) continue;
    const entities = groups.get(link.workbookId) ?? new Map<string, ExampleLinkEntity<K>>();
    if (link.entity !== undefined) entities.set(`${link.entity.kind}:${link.entity.id}`, link.entity);
    groups.set(link.workbookId, entities);
  }
  return groups;
}

function relinkExampleLinks<T, S extends { workbookId: string }, K extends string>(
  mef: T,
  links: readonly ExampleLink<K>[],
  prefix: string,
  sources: readonly S[],
  held: (source: S) => HeldIds<K>,
  reconcile: ExampleLinkReconciler<T>,
): ExampleRelink<T> {
  const holdings = sources.map((source) => ({ workbookId: source.workbookId, ids: held(source) }));
  const kept: KeptExampleLink[] = [];
  let relinked = mef;
  for (const [from, group] of exampleLinkGroups(links, prefix)) {
    const entities = [...group.values()];
    const target = entities.length === 0
      ? undefined
      : holdings.find((holding) => entities.every((entity) => holding.ids[entity.kind].has(entity.id)));
    if (target === undefined) kept.push({ from, linkedValues: entities.length });
    else relinked = reconcile(relinked, target.workbookId, from);
  }
  return { mef: relinked, kept };
}

function dataAnalysisHeldIds(source: ProjectDataAnalysisSource): HeldIds<DataAnalysisLinkKind> {
  const da = source.da;
  return {
    PARAMETER: new Set(da.parameters.map((parameter) => parameter.uuid)),
    CCF_ESTIMATE: new Set((da.ccfParameterEstimations ?? []).map((estimate) => estimate.uuid)),
    FAILURE_MODE: new Set((da.failureModes ?? []).map((mode) => mode.uuid)),
    SOURCE: new Set((da.uncertaintyRegister ?? []).map((entry) => entry.id)),
    CASE: new Set((da.sensitivityCases ?? []).map((item) => item.id)),
  };
}

function systemsHeldIds(source: ProjectSystemsSource): HeldIds<SystemsLinkKind> {
  const sy = source.sy;
  return {
    MODEL: new Set([...sy.systemLogicModels.map((model) => model.uuid), ...(sy.dependencyBayesianNetworks ?? []).map((network) => network.modelId)]),
    BASIC_EVENT: new Set(sy.systemBasicEvents.map((event) => event.uuid)),
  };
}

function relinkExampleDataAnalysis<T>(
  mef: T,
  links: readonly ExampleLink<DataAnalysisLinkKind>[],
  sources: readonly ProjectDataAnalysisSource[],
  reconcile: ExampleLinkReconciler<T>,
): ExampleRelink<T> {
  return relinkExampleLinks(mef, links, EXAMPLE_DA_PREFIX, sources, dataAnalysisHeldIds, reconcile);
}

function relinkExampleSystems<T>(
  mef: T,
  links: readonly ExampleLink<SystemsLinkKind>[],
  sources: readonly ProjectSystemsSource[],
  reconcile: ExampleLinkReconciler<T>,
): ExampleRelink<T> {
  return relinkExampleLinks(mef, links, EXAMPLE_SY_PREFIX, sources, systemsHeldIds, reconcile);
}

function keptExampleLinkMessage(element: string, source: string, kept: KeptExampleLink): string {
  return kept.linkedValues === 0
    ? `${element} links to ${kept.from} stay on the example because they name no ${source} value to match.`
    : `${element} links to ${kept.from} stay on the example because no project ${source} workbook holds all ${String(kept.linkedValues)} linked values.`;
}

function workbookLinks<K extends string>(workbookId: string | undefined): ExampleLink<K>[] {
  return workbookId === undefined ? [] : [{ workbookId }];
}

function entityLink<K extends string>(workbookId: string, kind: K, id: string): ExampleLink<K> {
  return { workbookId, entity: { kind, id } };
}

function parameterLinks(expression: UncertainExpression | undefined): ExampleLink<DataAnalysisLinkKind>[] {
  return expression === undefined
    ? []
    : expressionReferences(expression).map((reference) => entityLink<DataAnalysisLinkKind>(reference.workbookId, "PARAMETER", reference.entityId));
}

function factorLinks(factors: CcfFactorModel | undefined): ExampleLink<DataAnalysisLinkKind>[] {
  if (factors === undefined) return [];
  const vector = ccfFactorVector(factors);
  return [
    ...ccfFactorExpressions(factors).flatMap((expression) => parameterLinks(expression)),
    ...(vector?.node === "PARAMETER" ? [entityLink<DataAnalysisLinkKind>(vector.reference.workbookId, "CCF_ESTIMATE", vector.reference.entityId)] : []),
  ];
}

function movedFrom(from: string, to: string): ReferenceRewire {
  return (reference) => (reference.workbookId === from ? { ...reference, workbookId: to } : reference);
}

function movedWorkbook(workbookId: string, from: string, to: string): string {
  return workbookId === from ? to : workbookId;
}

function linkedTo(current: string | undefined, from: string, to: string): string {
  return current === undefined ? to : movedWorkbook(current, from, to);
}

function syDataAnalysisLinks(analysis: SystemsAnalysis): ExampleLink<DataAnalysisLinkKind>[] {
  return [
    ...workbookLinks<DataAnalysisLinkKind>(analysis.linkedWorkbooks?.DA),
    ...analysis.systemDefinitions.flatMap((definition) => parameterLinks(definition.missionTime)),
    ...analysis.systemBasicEvents.flatMap((event) => {
      const controlled = event.controlledDataSource;
      const mode = event.failureModeSource;
      return [
        ...parameterLinks(event.expression),
        ...(controlled?.referenceType === "WORKBOOK_PARAMETER" ? [entityLink<DataAnalysisLinkKind>(controlled.workbookId, "PARAMETER", controlled.entityId)] : []),
        ...(mode === undefined ? [] : [entityLink<DataAnalysisLinkKind>(mode.workbookId, "FAILURE_MODE", mode.failureModeId)]),
      ];
    }),
    ...analysis.commonCauseFailureGroups.flatMap((group) => [...parameterLinks(group.total), ...factorLinks(group.factors)]),
  ];
}

function reconcileExampleSyDataAnalysisLinks(analysis: SystemsAnalysis, daWorkbookId: string, from: string): SystemsAnalysis {
  const move = movedFrom(from, daWorkbookId);
  return {
    ...analysis,
    linkedWorkbooks: { ...analysis.linkedWorkbooks, DA: linkedTo(analysis.linkedWorkbooks?.DA, from, daWorkbookId) },
    systemDefinitions: analysis.systemDefinitions.map((definition) => (definition.missionTime === undefined
      ? definition
      : { ...definition, missionTime: rewiredExpression(definition.missionTime, move) })),
    systemBasicEvents: analysis.systemBasicEvents.map((event) => {
      const controlled = event.controlledDataSource;
      const mode = event.failureModeSource;
      return {
        ...event,
        ...(event.expression === undefined ? {} : { expression: rewiredExpression(event.expression, move) }),
        ...(controlled?.referenceType === "WORKBOOK_PARAMETER" ? { controlledDataSource: move(controlled) } : {}),
        ...(mode === undefined ? {} : { failureModeSource: { ...mode, workbookId: movedWorkbook(mode.workbookId, from, daWorkbookId) } }),
      };
    }),
    commonCauseFailureGroups: analysis.commonCauseFailureGroups.map((group) => ({
      ...group,
      total: rewiredExpression(group.total, move),
      factors: rewiredFactors(group.factors, move, move),
    })),
  };
}

function cellSideLinks(side: EsqCellSide | undefined, held: (id: string) => ExampleLink<DataAnalysisLinkKind>[]): ExampleLink<DataAnalysisLinkKind>[] {
  if (side === undefined) return [];
  if (side.source === "DA") return held(side.parameterId);
  if (side.source === "TYPED") return side.variable.fields.flatMap((field) => parameterLinks(field.value));
  return [];
}

function esqDataAnalysisLinks(quantification: EventSequenceQuantification): ExampleLink<DataAnalysisLinkKind>[] {
  const linked = quantification.linkedWorkbooks?.DA;
  const held = (kind: DataAnalysisLinkKind, id: string | undefined): ExampleLink<DataAnalysisLinkKind>[] =>
    (linked === undefined || id === undefined ? [] : [entityLink(linked, kind, id)]);
  const heldParameter = (id: string): ExampleLink<DataAnalysisLinkKind>[] => held("PARAMETER", id);
  const model = quantification.model;
  const decisions = quantification.modelDecisions;
  return [
    ...workbookLinks<DataAnalysisLinkKind>(linked),
    ...(model?.sources ?? []).flatMap((source) => (source.element === "DA" ? workbookLinks<DataAnalysisLinkKind>(source.workbookId) : [])),
    ...(model?.trees ?? []).flatMap((tree) => parameterLinks(tree.missionTime)),
    ...(model?.events ?? []).flatMap((event) => [
      ...parameterLinks(event.expression),
      ...parameterLinks(event.missionTime),
      ...(event.heldBy === "DA" ? held("PARAMETER", event.holderId) : []),
    ]),
    ...(model?.parameters ?? []).flatMap((parameter) => [...parameterLinks(parameter.estimate), ...parameterLinks(parameter.missionTime)]),
    ...(model?.ccfGroups ?? []).flatMap((group) => [...parameterLinks(group.total), ...factorLinks(group.factors), ...held("CCF_ESTIMATE", group.estimateRef)]),
    ...(model?.initiators ?? []).flatMap((initiator) => [
      ...parameterLinks(initiator.frequency?.expression),
      ...(initiator.heldBy === "DA" ? held("PARAMETER", initiator.holderId) : []),
    ]),
    ...(decisions?.initiatorChoices ?? []).flatMap((choice) => [
      ...parameterLinks(choice.expression),
      ...(choice.source === "DA" ? held("PARAMETER", choice.parameterId) : []),
    ]),
    ...(decisions?.valueBindings ?? []).flatMap((binding) => (binding.heldBy === "DA" ? held("PARAMETER", binding.holderId) : [])),
    ...(quantification.barrierWork?.cells ?? []).flatMap((cell) => [
      ...cellSideLinks(cell.load, heldParameter),
      ...cellSideLinks(cell.capacity, heldParameter),
      ...parameterLinks(cell.typed?.expression),
    ]),
    ...quantification.uncertaintyPropagation.parameterUncertainties.flatMap((entry) => parameterLinks(entry.estimate)),
    ...(quantification.modelUncertaintySourceAssessments ?? []).flatMap((assessment) => {
      const reference = assessment.dataAnalysisSourceRef;
      return reference === undefined ? [] : [entityLink<DataAnalysisLinkKind>(reference.workbookId, "SOURCE", reference.sourceId)];
    }),
    ...(quantification.sensitivityStudies ?? []).flatMap((study) => {
      const reference = study.dataAnalysisCaseRef;
      return reference === undefined ? [] : [entityLink<DataAnalysisLinkKind>(reference.workbookId, "CASE", reference.caseId)];
    }),
    ...(quantification.sensitivityWork?.cases ?? []).flatMap((item) => {
      const reference = item.daCaseRef;
      return reference === undefined ? [] : [entityLink<DataAnalysisLinkKind>(reference.workbookId, "CASE", reference.caseId)];
    }),
  ];
}

function rewiredSide(side: EsqCellSide, rewire: ReferenceRewire): EsqCellSide {
  return side.source === "TYPED"
    ? { ...side, variable: { ...side.variable, fields: side.variable.fields.map((field) => ({ ...field, value: rewiredExpression(field.value, rewire) })) } }
    : side;
}

function reconcileExampleEsqDataAnalysisLinks(quantification: EventSequenceQuantification, daWorkbookId: string, from: string): EventSequenceQuantification {
  const move = movedFrom(from, daWorkbookId);
  const moveId = (workbookId: string): string => movedWorkbook(workbookId, from, daWorkbookId);
  const moved = (expression: UncertainExpression): UncertainExpression => rewiredExpression(expression, move);
  const model = quantification.model;
  const decisions = quantification.modelDecisions;
  const choices = decisions?.initiatorChoices;
  const barrierWork = quantification.barrierWork;
  const cells = barrierWork?.cells;
  const assessments = quantification.modelUncertaintySourceAssessments;
  const studies = quantification.sensitivityStudies;
  const sensitivityWork = quantification.sensitivityWork;
  const cases = sensitivityWork?.cases;
  return {
    ...quantification,
    linkedWorkbooks: { ...quantification.linkedWorkbooks, DA: linkedTo(quantification.linkedWorkbooks?.DA, from, daWorkbookId) },
    ...(model === undefined ? {} : {
      model: {
        ...model,
        sources: model.sources.map((source) => (source.element === "DA" ? { ...source, workbookId: moveId(source.workbookId) } : source)),
        trees: model.trees.map((tree) => (tree.missionTime === undefined ? tree : { ...tree, missionTime: moved(tree.missionTime) })),
        events: model.events.map((event) => ({
          ...event,
          ...(event.expression === undefined ? {} : { expression: moved(event.expression) }),
          ...(event.missionTime === undefined ? {} : { missionTime: moved(event.missionTime) }),
        })),
        parameters: model.parameters.map((parameter) => ({
          ...parameter,
          ...(parameter.estimate === undefined ? {} : { estimate: moved(parameter.estimate) }),
          ...(parameter.missionTime === undefined ? {} : { missionTime: moved(parameter.missionTime) }),
        })),
        ccfGroups: model.ccfGroups.map((group) => ({
          ...group,
          ...(group.total === undefined ? {} : { total: moved(group.total) }),
          ...(group.factors === undefined ? {} : { factors: rewiredFactors(group.factors, move, move) }),
        })),
        initiators: model.initiators.map((initiator) => (initiator.frequency === undefined
          ? initiator
          : { ...initiator, frequency: { ...initiator.frequency, expression: moved(initiator.frequency.expression) } })),
      },
    }),
    ...(choices === undefined ? {} : {
      modelDecisions: { ...decisions, initiatorChoices: choices.map((choice) => (choice.expression === undefined ? choice : { ...choice, expression: moved(choice.expression) })) },
    }),
    ...(cells === undefined ? {} : {
      barrierWork: {
        ...barrierWork,
        cells: cells.map((cell) => ({
          ...cell,
          ...(cell.load === undefined ? {} : { load: rewiredSide(cell.load, move) }),
          ...(cell.capacity === undefined ? {} : { capacity: rewiredSide(cell.capacity, move) }),
          ...(cell.typed === undefined ? {} : { typed: { ...cell.typed, expression: moved(cell.typed.expression) } }),
        })),
      },
    }),
    uncertaintyPropagation: {
      ...quantification.uncertaintyPropagation,
      parameterUncertainties: quantification.uncertaintyPropagation.parameterUncertainties.map((entry) => (entry.estimate === undefined
        ? entry
        : { ...entry, estimate: moved(entry.estimate) })),
    },
    ...(assessments === undefined ? {} : {
      modelUncertaintySourceAssessments: assessments.map((assessment) => (assessment.dataAnalysisSourceRef === undefined
        ? assessment
        : { ...assessment, dataAnalysisSourceRef: { ...assessment.dataAnalysisSourceRef, workbookId: moveId(assessment.dataAnalysisSourceRef.workbookId) } })),
    }),
    ...(studies === undefined ? {} : {
      sensitivityStudies: studies.map((study) => (study.dataAnalysisCaseRef === undefined
        ? study
        : { ...study, dataAnalysisCaseRef: { ...study.dataAnalysisCaseRef, workbookId: moveId(study.dataAnalysisCaseRef.workbookId) } })),
    }),
    ...(cases === undefined ? {} : {
      sensitivityWork: {
        ...sensitivityWork,
        cases: cases.map((item) => (item.daCaseRef === undefined ? item : { ...item, daCaseRef: { ...item.daCaseRef, workbookId: moveId(item.daCaseRef.workbookId) } })),
      },
    }),
  };
}

function topLinks(top: EsqTopReference): ExampleLink<SystemsLinkKind>[] {
  return [entityLink<SystemsLinkKind>(top.workbookId, "MODEL", top.modelId)];
}

function targetLinks(target: EsqFunctionTarget | undefined): ExampleLink<SystemsLinkKind>[] {
  return target?.kind === "FAULT_TREE" ? topLinks(target.top) : [];
}

function esqSystemsLinks(quantification: EventSequenceQuantification): ExampleLink<SystemsLinkKind>[] {
  const linked = quantification.linkedWorkbooks?.SY;
  const held = (kind: SystemsLinkKind, id: string | undefined): ExampleLink<SystemsLinkKind>[] =>
    (linked === undefined || id === undefined ? [] : [entityLink(linked, kind, id)]);
  const model = quantification.model;
  return [
    ...workbookLinks<SystemsLinkKind>(linked),
    ...(model?.sources ?? []).flatMap((source) => (source.element === "SY" ? workbookLinks<SystemsLinkKind>(source.workbookId) : [])),
    ...(model?.functions ?? []).flatMap((record) => record.esLinks.flatMap((link) => topLinks(link.top))),
    ...(model?.tops ?? []).flatMap((top) => held("MODEL", top.modelId)),
    ...(model?.events ?? []).flatMap((event) => held("BASIC_EVENT", event.id)),
    ...(quantification.modelDecisions?.functionLinks ?? []).flatMap((link) => [
      ...targetLinks(link.target),
      ...(link.rules ?? []).flatMap((rule) => targetLinks(rule.target)),
    ]),
    ...(quantification.logic?.flags ?? []).flatMap((flag) => [
      ...held("MODEL", flag.target?.modelId),
      ...(flag.target?.kind === "EVENT" ? held("BASIC_EVENT", flag.target.id) : []),
    ]),
    ...(quantification.logic?.exclusions ?? []).flatMap((exclusion) => exclusion.eventIds.flatMap((id) => held("BASIC_EVENT", id))),
    ...quantification.hclConfigurations.flatMap((configuration) => [
      entityLink<SystemsLinkKind>(configuration.bayesianNetwork.workbookId, "MODEL", configuration.bayesianNetwork.modelId),
      ...configuration.faultTrees.map((faultTree) => entityLink<SystemsLinkKind>(faultTree.workbookId, "MODEL", faultTree.modelId)),
      ...configuration.bindings.flatMap((binding) => [
        entityLink<SystemsLinkKind>(binding.faultTreeBasicEvent.workbookId, "BASIC_EVENT", binding.faultTreeBasicEvent.entityId),
        entityLink<SystemsLinkKind>(binding.bayesianNetworkNode.workbookId, "MODEL", binding.bayesianNetworkNode.modelId),
      ]),
    ]),
  ];
}

function reconcileExampleEsqSystemsLinks(quantification: EventSequenceQuantification, syWorkbookId: string, from: string): EventSequenceQuantification {
  const moveId = (workbookId: string): string => movedWorkbook(workbookId, from, syWorkbookId);
  const movedTarget = (target: EsqFunctionTarget): EsqFunctionTarget => (target.kind === "FAULT_TREE"
    ? { ...target, top: { ...target.top, workbookId: moveId(target.top.workbookId) } }
    : target);
  const model = quantification.model;
  const decisions = quantification.modelDecisions;
  const functionLinks = decisions?.functionLinks;
  return {
    ...quantification,
    linkedWorkbooks: { ...quantification.linkedWorkbooks, SY: linkedTo(quantification.linkedWorkbooks?.SY, from, syWorkbookId) },
    ...(model === undefined ? {} : {
      model: {
        ...model,
        sources: model.sources.map((source) => (source.element === "SY" ? { ...source, workbookId: moveId(source.workbookId) } : source)),
        functions: model.functions.map((record) => ({
          ...record,
          esLinks: record.esLinks.map((link) => ({ ...link, top: { ...link.top, workbookId: moveId(link.top.workbookId) } })),
        })),
      },
    }),
    ...(functionLinks === undefined ? {} : {
      modelDecisions: {
        ...decisions,
        functionLinks: functionLinks.map((link) => ({
          ...link,
          ...(link.target === undefined ? {} : { target: movedTarget(link.target) }),
          ...(link.rules === undefined ? {} : { rules: link.rules.map((rule) => ({ ...rule, target: movedTarget(rule.target) })) }),
        })),
      },
    }),
    hclConfigurations: quantification.hclConfigurations.map((configuration) => ({
      ...configuration,
      bayesianNetwork: { ...configuration.bayesianNetwork, workbookId: moveId(configuration.bayesianNetwork.workbookId) },
      faultTrees: configuration.faultTrees.map((faultTree) => ({ ...faultTree, workbookId: moveId(faultTree.workbookId) })),
      bindings: configuration.bindings.map((binding) => ({
        ...binding,
        faultTreeBasicEvent: { ...binding.faultTreeBasicEvent, workbookId: moveId(binding.faultTreeBasicEvent.workbookId) },
        bayesianNetworkNode: { ...binding.bayesianNetworkNode, workbookId: moveId(binding.bayesianNetworkNode.workbookId) },
      })),
    })),
  };
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
  reconcileExampleSyDependencyOwnership,
  reconcileExampleEventTreeDependencyReferences,
  reconcileExampleDaMissionTimeReferences,
  reconcileExampleEsqMissionTimeReferences,
  reconcileExampleSyMissionTimeReferences,
  relinkExampleMissionTimes,
  daMissionTimeExpressions,
  esqMissionTimeExpressions,
  syMissionTimeExpressions,
  esqDataAnalysisLinks,
  esqSystemsLinks,
  keptExampleLinkMessage,
  reconcileExampleEsqDataAnalysisLinks,
  reconcileExampleEsqSystemsLinks,
  reconcileExampleSyDataAnalysisLinks,
  relinkExampleDataAnalysis,
  relinkExampleSystems,
  syDataAnalysisLinks,
  type ExampleRelink,
  type KeptExampleLink,
  type ProjectDataAnalysisSource,
  type ProjectMissionTimeSource,
  type ProjectSystemsSource,
};
