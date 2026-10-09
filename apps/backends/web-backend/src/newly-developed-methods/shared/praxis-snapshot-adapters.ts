import {
  validateBayesianNetworkGraph,
  validateBayesianNetworkCpts,
  validateBayesianNetworkModules,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type { HclCalculationType } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type { LoadCapacityModelSnapshot } from "interfaces-shared-types/newly-developed-methods/load-capacity";
import { WorkbookHclUncertaintyConfigurationSchema } from "interfaces-mef-types/zod/modeling";
import { carriesUncertainExpression, type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import {
  ccfFactorExpressions,
  ccfFactorVector,
  expressionReferences,
  parameterReferenceKey,
  type AleatoryVariable,
  type CcfFactorModel,
  type UncertainExpression,
  type UncertainParameter,
  type UncertainVector,
  type UncertainVectorParameter,
} from "interfaces-mef-types/core/uncertainty";
import { legacyExpression } from "interfaces-mef-types/core/legacy-uncertainty-adapter";
import type {
  EventSequenceAnalysis,
  EventTree,
} from "interfaces-mef-types/es/event-sequence-analysis";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { WorkbookModelAddress } from "interfaces-shared-types/newly-developed-methods";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import type { FaultTreeControlledDataSourceReference } from "interfaces-mef-types/modeling/fault-tree";
import type { BayesianNetworkEvidenceConfiguration } from "interfaces-mef-types/modeling/bayesian-network";
import type { HclCptGenerator, HclSampler, HclUncertaintySettings } from "interfaces-mef-types/modeling/hybrid-causal-logic";
import type { WorkbookBayesianNetwork, WorkbookHclConfiguration } from "interfaces-mef-types/modeling/workbook-models";
import { createHash } from "crypto";

interface WorkbookMefSnapshot<TMef> {
  workbookId: string;
  workbookRevision: number;
  mef: TMef;
}

interface PraxisModelSnapshot extends Record<string, unknown> {
  id: string;
  methodType: "FAULT_TREE" | "BAYESIAN_NETWORK" | "EVENT_TREE" | "HYBRID_CAUSAL_LOGIC" | "LOAD_CAPACITY";
  revision: number;
}

interface CatalogueBasicEvent {
  id: string;
  expression: UncertainExpression;
}

interface CatalogueCcfGroup {
  id: string;
  members: string[];
  factors: CcfFactorModel;
  total: UncertainExpression;
}

interface UncertaintyTables {
  uncertaintyParameters: UncertainParameter[];
  uncertaintyVectors: UncertainVectorParameter[];
}

interface UncertaintyReferences {
  parameterReferences: WorkbookParameterReference[];
  vectorReferences: WorkbookParameterReference[];
}

interface UncertaintySources {
  parameters?: ReadonlyMap<string, UncertainParameter>;
  vectors?: ReadonlyMap<string, UncertainVectorParameter>;
}

interface FaultTreeBasicEventCatalogue extends UncertaintyTables {
  projectId: string;
  basicEvents: CatalogueBasicEvent[];
  commonCauseFailureGroups: CatalogueCcfGroup[];
}

interface AdaptedFaultTreeSnapshot extends UncertaintyReferences {
  modelSnapshot: PraxisModelSnapshot;
  basicEventCatalogue: FaultTreeBasicEventCatalogue;
  legacyReferences: FaultTreeControlledDataSourceReference[];
}

interface SyFaultTreeAdapterOptions extends UncertaintySources {
  legacyValues?: ReadonlyMap<string, number>;
  collectOnly?: boolean;
}

interface NativeEntityReference {
  modelId: string;
  entityId: string;
}

interface HclNativeUncertainty extends UncertaintyTables {
  sampleCount: number;
  seed: number;
  sampler: HclSampler;
  basicEvents: { faultTreeBasicEvent: { entityId: string }; expression: UncertainExpression }[];
  cptRows: { bayesianNetworkNode: NativeEntityReference; cptRowId: string; row: UncertainVector }[];
  cptGenerators: Array<HclCptGenerator & { bayesianNetworkNode: NativeEntityReference }>;
}

interface HclNativeSolverSettings {
  variableOrder: string[] | null;
  foldConstants: boolean;
  spliceNullGates: boolean;
  uncertainty?: HclNativeUncertainty;
}

interface LoadCapacitySnapshotInput {
  id: string;
  revision: number;
  load: AleatoryVariable;
  capacity: AleatoryVariable;
  unit?: string;
}

const NO_REFERENCES: UncertaintyReferences = { parameterReferences: [], vectorReferences: [] };

const legacyEdgeValue = (value: number): UncertainExpression => legacyExpression("PROBABILITY", value);

const uniqueReferences = (references: WorkbookParameterReference[]): WorkbookParameterReference[] => {
  const unique = new Map<string, WorkbookParameterReference>();
  for (const reference of references) {
    const key = parameterReferenceKey(reference);
    if (!unique.has(key)) unique.set(key, { ...reference });
  }
  return [...unique.values()];
};

const joinReferences = (...sets: UncertaintyReferences[]): UncertaintyReferences => ({
  parameterReferences: uniqueReferences(sets.flatMap((set) => set.parameterReferences)),
  vectorReferences: uniqueReferences(sets.flatMap((set) => set.vectorReferences)),
});

const referencesOf = (expressions: UncertainExpression[], vectors: UncertainVector[] = []): UncertaintyReferences => ({
  parameterReferences: uniqueReferences(expressions.flatMap(expressionReferences)),
  vectorReferences: uniqueReferences(vectors.flatMap((vector) => (vector.node === "PARAMETER" ? [vector.reference] : []))),
});

const ccfFactorReferences = (factors: CcfFactorModel): UncertaintyReferences => {
  const vector = ccfFactorVector(factors);
  return referencesOf(ccfFactorExpressions(factors), vector === undefined ? [] : [vector]);
};

const faultTreeControlledDataSourceKey = (
  reference: FaultTreeControlledDataSourceReference,
): string => JSON.stringify([
  reference.referenceType,
  reference.workbookId,
  reference.entityId,
  reference.referenceType === "HUMAN_FAILURE_EVENT" ? reference.quantificationId : null,
]);

type WorkbookPraxisAdapterErrorCode =
  | "WORKBOOK_PRAXIS_ADAPTER_ERROR"
  | "SY_BASIC_EVENT_VALUE_MISSING"
  | "SY_CCF_GROUP_TOO_SMALL"
  | "UNCERTAINTY_PARAMETER_UNRESOLVED"
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

const resolveUncertaintyTables = (
  references: UncertaintyReferences,
  sources: UncertaintySources,
): UncertaintyTables & UncertaintyReferences => {
  const parameters = new Map<string, UncertainParameter>();
  const reached = new Map<string, WorkbookParameterReference>();
  for (const reference of uniqueReferences(references.parameterReferences)) {
    reached.set(parameterReferenceKey(reference), reference);
  }
  const pending = [...reached.values()];
  for (let reference = pending.pop(); reference !== undefined; reference = pending.pop()) {
    const key = parameterReferenceKey(reference);
    if (parameters.has(key)) continue;
    const parameter = sources.parameters?.get(key);
    if (parameter === undefined) {
      throw new WorkbookPraxisAdapterError(
        `Parameter '${reference.workbookId}:${reference.entityId}' could not be resolved`,
        "UNCERTAINTY_PARAMETER_UNRESOLVED",
        { reference },
      );
    }
    parameters.set(key, parameter);
    for (const nested of expressionReferences(parameter.expression)) {
      const nestedKey = parameterReferenceKey(nested);
      if (!reached.has(nestedKey)) reached.set(nestedKey, { ...nested });
      pending.push(nested);
    }
  }
  const vectorReferences = uniqueReferences(references.vectorReferences);
  const uncertaintyVectors = vectorReferences.map((reference) => {
    const vector = sources.vectors?.get(parameterReferenceKey(reference));
    if (vector === undefined) {
      throw new WorkbookPraxisAdapterError(
        `Vector parameter '${reference.workbookId}:${reference.entityId}' could not be resolved`,
        "UNCERTAINTY_PARAMETER_UNRESOLVED",
        { reference },
      );
    }
    return vector;
  });
  return {
    uncertaintyParameters: [...parameters.values()],
    uncertaintyVectors,
    parameterReferences: [...reached.values()],
    vectorReferences,
  };
};

const adaptSyCcfGroup = (group: SystemsAnalysis["commonCauseFailureGroups"][number]): CatalogueCcfGroup[] => {
  const members = group.members?.basicEvents.map((event) => event.id) ?? [];
  if (members.length === 0) return [];
  if (members.length === 1) {
    throw new WorkbookPraxisAdapterError(
      `SY common cause group '${group.uuid}' needs two or more members`,
      "SY_CCF_GROUP_TOO_SMALL",
      { groupId: group.uuid },
    );
  }
  return [{ id: group.uuid, members, factors: group.factors, total: group.total }];
};

const ccfGroupReferences = (group: CatalogueCcfGroup): UncertaintyReferences =>
  joinReferences(ccfFactorReferences(group.factors), referencesOf([group.total]));

const adaptSyFaultTreeSnapshot = (
  source: WorkbookMefSnapshot<SystemsAnalysis>,
  modelId: string,
  options: SyFaultTreeAdapterOptions = {},
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

  interface GateFrame {
    model: SyFaultTreeModel;
    key: string;
    outputGateId: string;
    inputs: SyFaultTreeModel["gateInputs"];
    nextInput: number;
  }
  const frames: GateFrame[] = [];

  const enterGate = (
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
    frames.push({
      model: candidate,
      key,
      outputGateId,
      inputs: candidate.gateInputs.filter((entry) => entry.gateId === gate.id),
      nextInput: 0,
    });
  };

  modelGate(model, model.topGate.gateId, false);
  enterGate(model, model.topGate.gateId, false);

  while (frames.length > 0) {
    const frame = frames[frames.length - 1];
    if (frame.nextInput === frame.inputs.length) {
      frames.pop();
      visitStack.pop();
      visitState.set(frame.key, "VISITED");
    } else {
      const { model: candidate, outputGateId } = frame;
      const input = frame.inputs[frame.nextInput++];
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
        enterGate(childGate.model, childGate.gateId, childGate.viaTransfer);
      }
    }
  }

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

  const legacyReferences = new Map<string, FaultTreeControlledDataSourceReference>();
  const expressionOf = (basicEventId: string): UncertainExpression | undefined => {
    const event = findByUuid(source.mef.systemBasicEvents, basicEventId, "SY basic event");
    if (carriesUncertainExpression(event.failureMode)) {
      if (event.expression === undefined) {
        if (options.collectOnly === true) return undefined;
        throw new WorkbookPraxisAdapterError(
          `SY basic event '${event.code}' has no value`,
          "SY_BASIC_EVENT_VALUE_MISSING",
          { basicEventId },
        );
      }
      return event.expression;
    }
    const controlled = event.controlledDataSource;
    if (controlled !== undefined) {
      const key = faultTreeControlledDataSourceKey(controlled);
      legacyReferences.set(key, { ...controlled });
      if (options.collectOnly === true) return undefined;
      const value = options.legacyValues?.get(key);
      if (value === undefined) {
        throw new WorkbookPraxisAdapterError(
          `SY basic event '${event.code}' could not resolve controlled ${controlled.referenceType === "HUMAN_FAILURE_EVENT" ? "HRA quantification" : "DA parameter"} '${controlled.workbookId}:${controlled.entityId}'`,
        );
      }
      return legacyEdgeValue(value);
    }
    if (event.probability !== undefined && Number.isFinite(event.probability)) return legacyEdgeValue(event.probability);
    if (options.collectOnly === true) return undefined;
    throw new WorkbookPraxisAdapterError(
      `SY basic event '${event.code}' has no value`,
      "SY_BASIC_EVENT_VALUE_MISSING",
      { basicEventId },
    );
  };
  const basicEvents = [...referencedBasicEventIds].flatMap((basicEventId): CatalogueBasicEvent[] => {
    const expression = expressionOf(basicEventId);
    return expression === undefined ? [] : [{ id: basicEventId, expression }];
  });

  const commonCauseFailureGroups = (source.mef.commonCauseFailureGroups ?? []).flatMap((group) => {
    const members = group.members?.basicEvents.map((event) => event.id) ?? [];
    return members.some((id) => !referencedBasicEventIds.has(id)) ? [] : adaptSyCcfGroup(group);
  });

  const direct = joinReferences(
    referencesOf(basicEvents.map((event) => event.expression)),
    ...commonCauseFailureGroups.map(ccfGroupReferences),
  );
  const tables: UncertaintyTables & UncertaintyReferences = options.collectOnly === true
    ? { ...direct, uncertaintyParameters: [], uncertaintyVectors: [] }
    : resolveUncertaintyTables(direct, options);

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
      commonCauseFailureGroups,
      uncertaintyParameters: tables.uncertaintyParameters,
      uncertaintyVectors: tables.uncertaintyVectors,
    },
    parameterReferences: tables.parameterReferences,
    vectorReferences: tables.vectorReferences,
    legacyReferences: [...legacyReferences.values()],
  };
};

const collectSyFaultTreeReferences = (
  source: WorkbookMefSnapshot<SystemsAnalysis>,
  modelId: string,
): Pick<AdaptedFaultTreeSnapshot, "parameterReferences" | "vectorReferences" | "legacyReferences"> => {
  const { parameterReferences, vectorReferences, legacyReferences } = adaptSyFaultTreeSnapshot(source, modelId, { collectOnly: true });
  return { parameterReferences, vectorReferences, legacyReferences };
};

const adaptEsqBayesianNetworkSnapshot = (
  source: WorkbookMefSnapshot<EventSequenceQuantification>,
  modelId: string,
): PraxisModelSnapshot => {
  const model = source.mef.bayesianNetworks.find((candidate) => candidate.modelId === modelId);
  if (model === undefined) {
    throw new WorkbookPraxisAdapterError(`ESQ Bayesian network '${modelId}' was not found`);
  }
  return adaptBayesianNetworkModelSnapshot(source, model);
};

const adaptSyBayesianNetworkSnapshot = (
  source: WorkbookMefSnapshot<SystemsAnalysis>,
  modelId: string,
): PraxisModelSnapshot => {
  const model = (source.mef.dependencyBayesianNetworks ?? []).find(
    (candidate) => candidate.modelId === modelId,
  );
  if (model === undefined) {
    throw new WorkbookPraxisAdapterError(`SY Bayesian network '${modelId}' was not found`);
  }
  return adaptBayesianNetworkModelSnapshot(source, model);
};

const adaptBayesianNetworkModelSnapshot = (
  source: Pick<WorkbookMefSnapshot<unknown>, "workbookRevision">,
  model: WorkbookBayesianNetwork,
): PraxisModelSnapshot => {
  const errors = [
    ...validateBayesianNetworkGraph(model),
    ...validateBayesianNetworkCpts(model),
    ...validateBayesianNetworkModules(model),
  ].filter((issue) => issue.severity === "ERROR");
  if (errors.length > 0) throw new WorkbookPraxisAdapterError(errors.map((issue) => issue.message).join("; "));
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
  const frequency = tree.initiatingEventFrequency;
  if (frequency === undefined) {
    throw new WorkbookPraxisAdapterError(`ES event tree '${modelId}' has no initiating-event frequency`);
  }
  const functionalEvents = orderedFunctionalEvents(tree).map((event, order) => ({
    id: event.uuid,
    name: event.name,
    order,
  }));
  const treeSequences = Object.values(tree.sequences);
  const links = orderedFunctionalEvents(tree).flatMap((event) => {
    if (event.faultTreeTopEvent === undefined) {
      const bypassedEverywhere =
        treeSequences.length > 0 &&
        treeSequences.every((sequence) => sequence.functionalEventStates?.[event.uuid] === "BYPASSED");
      if (bypassedEverywhere) return [];
      throw new WorkbookPraxisAdapterError(
        `ES functional event '${event.uuid}' has no typed fault-tree top-event reference`,
      );
    }
    return [{
      functionalEventId: event.uuid,
      faultTreeTopGate: {
        modelId: event.faultTreeTopEvent.modelId,
        entityId: event.faultTreeTopEvent.entityId,
      },
    }];
  });
  const endStateIds = new Set<string>();
  const sequences = Object.values(tree.sequences).map((sequence) => {
    const transfer = tree.transfers?.[sequence.uuid];
    if (transfer === undefined && sequence.endState === undefined) {
      throw new WorkbookPraxisAdapterError(`ES sequence '${sequence.uuid}' has no end state`);
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
        if (outcome !== "SUCCESS" && outcome !== "FAILURE" && outcome !== "BYPASSED") {
          throw new WorkbookPraxisAdapterError(
            `ES sequence '${sequence.uuid}' is missing a success, failure, or bypassed outcome for '${event.id}'`,
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
    initiatingEventFrequency: {
      expression: frequency.expression,
      ...(frequency.annualization === undefined ? {} : { annualization: { ...frequency.annualization } }),
    },
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

const collectEsEventTreeReferences = (
  source: WorkbookMefSnapshot<EventSequenceAnalysis>,
  modelIds: string[],
): UncertaintyReferences =>
  referencesOf(modelIds.flatMap((modelId) => {
    const frequency = findByUuid(source.mef.eventTrees ?? [], modelId, "ES event tree").initiatingEventFrequency;
    return frequency === undefined ? [] : [frequency.expression];
  }));

const missingHclUncertainty = (): WorkbookPraxisAdapterError =>
  new WorkbookPraxisAdapterError("Uncertainty execution requires saved uncertainty settings.");

const hclUncertaintySettings = (
  configuration: WorkbookHclConfiguration,
  calculationType: HclCalculationType,
): HclUncertaintySettings | undefined => {
  if (calculationType !== "UNCERTAINTY") return undefined;
  if (configuration.solverSettings.uncertainty === undefined) throw missingHclUncertainty();
  const parsed = WorkbookHclUncertaintyConfigurationSchema.safeParse(configuration);
  if (!parsed.success) {
    throw new WorkbookPraxisAdapterError(`Invalid uncertainty settings: ${parsed.error.message}`);
  }
  const settings = parsed.data.solverSettings.uncertainty;
  if (settings === undefined) throw missingHclUncertainty();
  return settings;
};

const hclGeneratorExpressions = (generator: HclCptGenerator): UncertainExpression[] =>
  generator.kind === "SEISMIC_FRAGILITY"
    ? [generator.median, generator.randomness]
    : [generator.missionTime, ...generator.bins.map((bin) => bin.frequency)];

const hclSettingsReferences = (settings: HclUncertaintySettings): UncertaintyReferences =>
  referencesOf(
    [
      ...settings.basicEvents.map((entry) => entry.expression),
      ...settings.cptGenerators.flatMap((entry) => hclGeneratorExpressions(entry.generator)),
    ],
    settings.cptRows.map((entry) => entry.row),
  );

const collectHclUncertaintyReferences = (
  configuration: WorkbookHclConfiguration,
  calculationType: HclCalculationType,
): UncertaintyReferences => {
  const settings = hclUncertaintySettings(configuration, calculationType);
  return settings === undefined ? NO_REFERENCES : hclSettingsReferences(settings);
};

const adaptHclSolverSettings = (
  configuration: WorkbookHclConfiguration,
  calculationType: HclCalculationType,
  sources: UncertaintySources,
): HclNativeSolverSettings => {
  const point = {
    variableOrder: configuration.solverSettings.variableOrder,
    foldConstants: configuration.solverSettings.foldConstants,
    spliceNullGates: configuration.solverSettings.spliceNullGates,
  };
  const settings = hclUncertaintySettings(configuration, calculationType);
  if (settings === undefined) return point;
  const tables = resolveUncertaintyTables(hclSettingsReferences(settings), sources);
  return {
    ...point,
    uncertainty: {
      sampleCount: settings.sampleCount,
      seed: settings.seed,
      sampler: settings.sampler,
      basicEvents: settings.basicEvents.map((entry) => ({
        faultTreeBasicEvent: { entityId: entry.faultTreeBasicEvent.entityId },
        expression: entry.expression,
      })),
      cptRows: settings.cptRows.map((entry) => ({
        bayesianNetworkNode: {
          modelId: entry.bayesianNetworkNode.modelId,
          entityId: entry.bayesianNetworkNode.entityId,
        },
        cptRowId: entry.cptRowId,
        row: entry.row,
      })),
      cptGenerators: settings.cptGenerators.map((entry) => ({
        ...entry.generator,
        bayesianNetworkNode: {
          modelId: entry.bayesianNetworkNode.modelId,
          entityId: entry.bayesianNetworkNode.entityId,
        },
      })),
      uncertaintyParameters: tables.uncertaintyParameters,
      uncertaintyVectors: tables.uncertaintyVectors,
    },
  };
};

const adaptEsqHclSnapshot = (
  source: WorkbookMefSnapshot<EventSequenceQuantification>,
  modelId: string,
  calculationType: HclCalculationType = "PROBABILITY",
  faultTreeBasicEventIdsByModel?: ReadonlyMap<string, ReadonlySet<string>>,
  baseEvidenceOverride?: BayesianNetworkEvidenceConfiguration,
  sources: UncertaintySources = {},
): PraxisModelSnapshot => {
  const configuration = source.mef.hclConfigurations.find(
    (candidate) => candidate.modelId === modelId,
  );
  if (configuration === undefined) {
    throw new WorkbookPraxisAdapterError(`ESQ HCL configuration '${modelId}' was not found`);
  }

  return adaptHclConfigurationSnapshot(
    source, configuration, calculationType, faultTreeBasicEventIdsByModel, baseEvidenceOverride, configuration.faultTrees, sources,
  );
};

const adaptHclConfigurationSnapshot = (
  source: Pick<WorkbookMefSnapshot<unknown>, "workbookRevision">,
  configuration: WorkbookHclConfiguration,
  calculationType: HclCalculationType,
  faultTreeBasicEventIdsByModel?: ReadonlyMap<string, ReadonlySet<string>>,
  baseEvidenceOverride?: BayesianNetworkEvidenceConfiguration,
  effectiveFaultTrees = configuration.faultTrees,
  sources: UncertaintySources = {},
): PraxisModelSnapshot => {
  const bindings = configuration.bindings.flatMap((binding) =>
    effectiveFaultTrees
      .filter((faultTree) => faultTree.workbookId === binding.faultTreeBasicEvent.workbookId)
      .filter((faultTree) =>
        faultTreeBasicEventIdsByModel === undefined ||
        faultTreeBasicEventIdsByModel
          .get(faultTree.modelId)
          ?.has(binding.faultTreeBasicEvent.entityId) === true
      )
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
    faultTrees: effectiveFaultTrees.map((faultTree) => ({
      faultTree: { modelId: faultTree.modelId },
    })),
    bindings,
    baseEvidence: baseEvidenceOverride ?? configuration.baseEvidence,
    solverSettings: adaptHclSolverSettings(configuration, calculationType, sources),
  };
};

const adaptSyHclSnapshot = (
  source: WorkbookMefSnapshot<SystemsAnalysis>,
  modelId: string,
  calculationType: HclCalculationType = "PROBABILITY",
  faultTreeBasicEventIdsByModel?: ReadonlyMap<string, ReadonlySet<string>>,
  baseEvidenceOverride?: BayesianNetworkEvidenceConfiguration,
  effectiveFaultTrees?: WorkbookModelAddress[],
  sources: UncertaintySources = {},
): PraxisModelSnapshot => {
  const configuration = (source.mef.dependencyHclConfigurations ?? []).find(
    (candidate) => candidate.modelId === modelId,
  );
  if (configuration === undefined) {
    throw new WorkbookPraxisAdapterError(`SY HCL configuration '${modelId}' was not found`);
  }
  return adaptHclConfigurationSnapshot(
    source,
    configuration,
    calculationType,
    faultTreeBasicEventIdsByModel,
    baseEvidenceOverride,
    effectiveFaultTrees,
    sources,
  );
};

const collectLoadCapacityReferences = (
  input: Pick<LoadCapacitySnapshotInput, "load" | "capacity">,
): UncertaintyReferences =>
  referencesOf([...input.load.fields, ...input.capacity.fields].map((entry) => entry.value));

const adaptLoadCapacitySnapshot = (
  input: LoadCapacitySnapshotInput,
  sources: UncertaintySources = {},
): LoadCapacityModelSnapshot & PraxisModelSnapshot => {
  const tables = resolveUncertaintyTables(collectLoadCapacityReferences(input), sources);
  return {
    id: input.id,
    methodType: "LOAD_CAPACITY",
    revision: input.revision,
    load: input.load,
    capacity: input.capacity,
    ...(input.unit === undefined ? {} : { unit: input.unit }),
    uncertaintyParameters: tables.uncertaintyParameters,
    uncertaintyVectors: tables.uncertaintyVectors,
  };
};

export {
  WorkbookPraxisAdapterError,
  collectSyFaultTreeReferences,
  collectEsEventTreeReferences,
  collectHclUncertaintyReferences,
  collectLoadCapacityReferences,
  faultTreeControlledDataSourceKey,
  resolveUncertaintyTables,
  adaptSyFaultTreeSnapshot,
  adaptSyCcfGroup,
  adaptLoadCapacitySnapshot,
  adaptEsqBayesianNetworkSnapshot,
  adaptSyBayesianNetworkSnapshot,
  adaptEsEventTreeSnapshot,
  adaptEsqHclSnapshot,
  adaptSyHclSnapshot,
  adaptBayesianNetworkModelSnapshot,
  adaptHclConfigurationSnapshot,
};
export type {
  WorkbookMefSnapshot,
  PraxisModelSnapshot,
  AdaptedFaultTreeSnapshot,
  CatalogueBasicEvent,
  CatalogueCcfGroup,
  FaultTreeBasicEventCatalogue,
  LoadCapacitySnapshotInput,
  SyFaultTreeAdapterOptions,
  UncertaintyReferences,
  UncertaintySources,
  UncertaintyTables,
};
