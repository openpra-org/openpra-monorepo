import type {
  BayesianNetworkDefinition,
  BayesianNetworkEvidenceConfiguration,
  HclEventBinding,
  HclEvidenceScenario,
} from "interfaces-mef-types/modeling";

interface HclBatchFaultTreeTarget {
  workbookId: string;
  modelId: string;
  topGateId: string | null;
  gates: readonly HclBatchFaultTreeGate[];
  leafNodes: readonly HclBatchFaultTreeLeaf[];
  gateInputs: readonly HclBatchFaultTreeGateInput[];
  constantBasicEventStates: Readonly<Record<string, boolean>>;
}

type HclBatchFaultTreeGate =
  | { id: string; gateType: "AND" | "OR" | "NOT" }
  | { id: string; gateType: "K_OF_N"; k: number };

type HclBatchFaultTreeLeaf =
  | { id: string; kind: "BASIC_EVENT_REFERENCE"; basicEventId: string }
  | { id: string; kind: "HOUSE_EVENT"; state: boolean }
  | { id: string; kind: "UNDEVELOPED_EVENT" }
  | {
    id: string;
    kind: "TRANSFER_REFERENCE";
    target: HclBatchTargetAddress & { entityId: string };
  };

interface HclBatchFaultTreeGateInput {
  gateId: string;
  childId: string;
  order: number;
}

interface HclBatchEventTreeTarget {
  workbookId: string;
  modelId: string;
  faultTrees: readonly HclBatchTargetAddress[];
  transferTargets: readonly HclBatchTargetAddress[];
}

interface HclBatchTargetAddress {
  workbookId: string;
  modelId: string;
}

interface HclBatchTargetRelevanceInput {
  bayesianNetwork: Pick<BayesianNetworkDefinition, "nodes" | "edges">;
  baseEvidence: BayesianNetworkEvidenceConfiguration;
  scenarios: readonly HclEvidenceScenario[];
  bindings: readonly HclEventBinding[];
  faultTrees: readonly HclBatchFaultTreeTarget[];
  eventTrees: readonly HclBatchEventTreeTarget[];
}

interface HclBatchTargetRelevance {
  varyingEvidenceNodeIds: string[];
  affectedBayesianNetworkNodeIds: string[];
  relevantBindingIds: string[];
  faultTreeKeys: string[];
  constantMaskedFaultTreeKeys: string[];
  eventTreeKeys: string[];
  faultTreeEvidenceNodeIds: Record<string, string[]>;
  eventTreeEvidenceNodeIds: Record<string, string[]>;
}

const UNOBSERVED = Symbol("UNOBSERVED");

function hclTargetKey(address: HclBatchTargetAddress): string {
  return `${address.workbookId}:${address.modelId}`;
}

function effectiveEvidence(
  base: BayesianNetworkEvidenceConfiguration,
  scenario: HclEvidenceScenario,
): Map<string, string> {
  const result = new Map(base.observations.map((observation) => [observation.nodeId, observation.stateId]));
  scenario.evidence.observations.forEach((observation) => result.set(observation.nodeId, observation.stateId));
  return result;
}

function varyingEvidenceNodes(evidence: readonly Map<string, string>[]): Set<string> {
  const nodeIds = new Set(evidence.flatMap((scenario) => [...scenario.keys()]));
  return new Set([...nodeIds].filter((nodeId) => {
    const values = new Set<string | typeof UNOBSERVED>(
      evidence.map((scenario) => scenario.get(nodeId) ?? UNOBSERVED),
    );
    return values.size > 1;
  }));
}

function addUndirectedEdge(graph: Map<string, Set<string>>, left: string, right: string): void {
  if (left === right) return;
  graph.get(left)?.add(right);
  graph.get(right)?.add(left);
}

function dConnected(
  source: string,
  target: string,
  conditioned: ReadonlySet<string>,
  nodeIds: ReadonlySet<string>,
  parents: ReadonlyMap<string, ReadonlySet<string>>,
  edges: BayesianNetworkDefinition["edges"],
): boolean {
  if (!nodeIds.has(source) || !nodeIds.has(target)) return false;
  if (source === target) return true;
  if (conditioned.has(source) || conditioned.has(target)) return false;

  const ancestors = new Set<string>([source, target, ...conditioned].filter((nodeId) => nodeIds.has(nodeId)));
  const pending = [...ancestors];
  while (pending.length > 0) {
    const nodeId = pending.pop()!;
    for (const parentId of parents.get(nodeId) ?? []) {
      if (ancestors.has(parentId)) continue;
      ancestors.add(parentId);
      pending.push(parentId);
    }
  }

  const moral = new Map([...ancestors].map((nodeId) => [nodeId, new Set<string>()]));
  edges.forEach((edge) => {
    if (ancestors.has(edge.parentNodeId) && ancestors.has(edge.childNodeId)) {
      addUndirectedEdge(moral, edge.parentNodeId, edge.childNodeId);
    }
  });
  for (const childId of ancestors) {
    const childParents = [...(parents.get(childId) ?? [])].filter((parentId) => ancestors.has(parentId));
    childParents.forEach((left, index) => {
      childParents.slice(index + 1).forEach((right) => addUndirectedEdge(moral, left, right));
    });
  }

  const visited = new Set<string>();
  const queue = [source];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (nodeId === target) return true;
    if (visited.has(nodeId) || conditioned.has(nodeId)) continue;
    visited.add(nodeId);
    for (const neighbor of moral.get(nodeId) ?? []) {
      if (!visited.has(neighbor) && !conditioned.has(neighbor)) queue.push(neighbor);
    }
  }
  return false;
}

function mergeReasons(target: Set<string>, source: ReadonlySet<string> | undefined): boolean {
  const previousSize = target.size;
  source?.forEach((value) => target.add(value));
  return target.size !== previousSize;
}

function propagateTransferReasons<TTarget extends HclBatchTargetAddress & { transferTargets: readonly HclBatchTargetAddress[] }>(
  targets: readonly TTarget[],
  reasons: Map<string, Set<string>>,
): void {
  let changed = true;
  while (changed) {
    changed = false;
    targets.forEach((target) => {
      const targetReasons = reasons.get(hclTargetKey(target)) ?? new Set<string>();
      target.transferTargets.forEach((transfer) => {
        if (mergeReasons(targetReasons, reasons.get(hclTargetKey(transfer)))) changed = true;
      });
      if (targetReasons.size > 0) reasons.set(hclTargetKey(target), targetReasons);
    });
  }
}

interface BooleanInfluence {
  canBeFalse: boolean;
  canBeTrue: boolean;
  reasons: Set<string>;
}

const CONSTANT_FALSE: BooleanInfluence = {
  canBeFalse: true,
  canBeTrue: false,
  reasons: new Set(),
};
const CONSTANT_TRUE: BooleanInfluence = {
  canBeFalse: false,
  canBeTrue: true,
  reasons: new Set(),
};
const UNKNOWN: BooleanInfluence = {
  canBeFalse: true,
  canBeTrue: true,
  reasons: new Set(),
};

function combineGate(
  gate: HclBatchFaultTreeGate,
  children: readonly BooleanInfluence[],
): BooleanInfluence {
  if (gate.gateType === "NOT") {
    const child = children[0];
    return child === undefined
      ? { ...UNKNOWN, reasons: new Set() }
      : {
        canBeFalse: child.canBeTrue,
        canBeTrue: child.canBeFalse,
        reasons: new Set(child.reasons),
      };
  }

  if (gate.gateType === "AND") {
    const reasons = new Set<string>();
    children.forEach((child, index) => {
      if (children.every((candidate, candidateIndex) =>
        candidateIndex === index || candidate.canBeTrue)) {
        mergeReasons(reasons, child.reasons);
      }
    });
    return {
      canBeFalse: children.some((child) => child.canBeFalse),
      canBeTrue: children.every((child) => child.canBeTrue),
      reasons,
    };
  }

  if (gate.gateType === "OR") {
    const reasons = new Set<string>();
    children.forEach((child, index) => {
      if (children.every((candidate, candidateIndex) =>
        candidateIndex === index || candidate.canBeFalse)) {
        mergeReasons(reasons, child.reasons);
      }
    });
    return {
      canBeFalse: children.every((child) => child.canBeFalse),
      canBeTrue: children.some((child) => child.canBeTrue),
      reasons,
    };
  }

  if (gate.gateType !== "K_OF_N") return { ...UNKNOWN, reasons: new Set() };
  const fixedTrue = children.filter((child) => child.canBeTrue && !child.canBeFalse).length;
  const possibleTrue = children.filter((child) => child.canBeTrue).length;
  const reasons = new Set<string>();
  children.forEach((child, index) => {
    const others = children.filter((_candidate, candidateIndex) => candidateIndex !== index);
    const otherFixedTrue = others.filter((candidate) =>
      candidate.canBeTrue && !candidate.canBeFalse).length;
    const otherPossibleTrue = others.filter((candidate) => candidate.canBeTrue).length;
    if (otherFixedTrue <= gate.k - 1 && otherPossibleTrue >= gate.k - 1) {
      mergeReasons(reasons, child.reasons);
    }
  });
  return {
    canBeFalse: fixedTrue < gate.k,
    canBeTrue: possibleTrue >= gate.k,
    reasons,
  };
}

function faultTreeInfluence(
  targets: readonly HclBatchFaultTreeTarget[],
  bindingReasons: ReadonlyMap<string, ReadonlySet<string>>,
): {
    semantic: Map<string, BooleanInfluence>;
    structural: Map<string, Set<string>>;
  } {
  const byKey = new Map(targets.map((target) => [hclTargetKey(target), target]));
  const semanticNodeMemo = new Map<string, BooleanInfluence>();
  const structuralNodeMemo = new Map<string, Set<string>>();
  const activeSemantic = new Set<string>();
  const activeStructural = new Set<string>();

  const childrenByGate = (target: HclBatchFaultTreeTarget): Map<string, string[]> => {
    const result = new Map<string, Array<{ childId: string; order: number }>>();
    target.gateInputs.forEach((input) => {
      const current = result.get(input.gateId) ?? [];
      current.push({ childId: input.childId, order: input.order });
      result.set(input.gateId, current);
    });
    return new Map([...result].map(([gateId, children]) => [
      gateId,
      children.sort((left, right) => left.order - right.order).map(({ childId }) => childId),
    ]));
  };
  const childrenByTarget = new Map(targets.map((target) => [hclTargetKey(target), childrenByGate(target)]));

  const evaluateNode = (target: HclBatchFaultTreeTarget, nodeId: string): BooleanInfluence => {
    const memoKey = `${hclTargetKey(target)}:${nodeId}`;
    const memoized = semanticNodeMemo.get(memoKey);
    if (memoized !== undefined) return memoized;
    if (activeSemantic.has(memoKey)) return { ...UNKNOWN, reasons: new Set() };
    activeSemantic.add(memoKey);

    const gate = target.gates.find((candidate) => candidate.id === nodeId);
    let result: BooleanInfluence;
    if (gate !== undefined) {
      result = combineGate(
        gate,
        (childrenByTarget.get(hclTargetKey(target))?.get(gate.id) ?? [])
          .map((childId) => evaluateNode(target, childId)),
      );
    } else {
      const leaf = target.leafNodes.find((candidate) => candidate.id === nodeId);
      if (leaf?.kind === "BASIC_EVENT_REFERENCE") {
        const reasons = bindingReasons.get(`${target.workbookId}:${leaf.basicEventId}`) ?? new Set();
        const constant = target.constantBasicEventStates[leaf.basicEventId];
        result = reasons.size > 0
          ? { canBeFalse: true, canBeTrue: true, reasons: new Set(reasons) }
          : constant === true
            ? { ...CONSTANT_TRUE, reasons: new Set() }
            : constant === false
              ? { ...CONSTANT_FALSE, reasons: new Set() }
              : { ...UNKNOWN, reasons: new Set() };
      } else if (leaf?.kind === "HOUSE_EVENT") {
        result = leaf.state
          ? { ...CONSTANT_TRUE, reasons: new Set() }
          : { ...CONSTANT_FALSE, reasons: new Set() };
      } else if (leaf?.kind === "TRANSFER_REFERENCE") {
        const transferred = byKey.get(hclTargetKey(leaf.target));
        result = transferred === undefined
          ? { ...UNKNOWN, reasons: new Set() }
          : evaluateNode(transferred, leaf.target.entityId);
      } else {
        result = { ...UNKNOWN, reasons: new Set() };
      }
    }

    activeSemantic.delete(memoKey);
    semanticNodeMemo.set(memoKey, result);
    return result;
  };

  const collectStructural = (target: HclBatchFaultTreeTarget, nodeId: string): Set<string> => {
    const memoKey = `${hclTargetKey(target)}:${nodeId}`;
    const memoized = structuralNodeMemo.get(memoKey);
    if (memoized !== undefined) return memoized;
    if (activeStructural.has(memoKey)) return new Set();
    activeStructural.add(memoKey);

    const reasons = new Set<string>();
    const gate = target.gates.find((candidate) => candidate.id === nodeId);
    if (gate !== undefined) {
      (childrenByTarget.get(hclTargetKey(target))?.get(gate.id) ?? [])
        .forEach((childId) => mergeReasons(reasons, collectStructural(target, childId)));
    } else {
      const leaf = target.leafNodes.find((candidate) => candidate.id === nodeId);
      if (leaf?.kind === "BASIC_EVENT_REFERENCE") {
        mergeReasons(reasons, bindingReasons.get(`${target.workbookId}:${leaf.basicEventId}`));
      } else if (leaf?.kind === "TRANSFER_REFERENCE") {
        const transferred = byKey.get(hclTargetKey(leaf.target));
        if (transferred !== undefined) {
          mergeReasons(reasons, collectStructural(transferred, leaf.target.entityId));
        }
      }
    }

    activeStructural.delete(memoKey);
    structuralNodeMemo.set(memoKey, reasons);
    return reasons;
  };

  const semantic = new Map<string, BooleanInfluence>();
  const structural = new Map<string, Set<string>>();
  targets.forEach((target) => {
    if (target.topGateId === null) return;
    semantic.set(hclTargetKey(target), evaluateNode(target, target.topGateId));
    structural.set(hclTargetKey(target), collectStructural(target, target.topGateId));
  });
  return { semantic, structural };
}

function reasonRecord(reasons: ReadonlyMap<string, ReadonlySet<string>>): Record<string, string[]> {
  return Object.fromEntries(
    [...reasons.entries()]
      .filter(([, values]) => values.size > 0)
      .map(([key, values]) => [key, [...values].sort()]),
  );
}

function resolveHclBatchTargetRelevance(input: HclBatchTargetRelevanceInput): HclBatchTargetRelevance {
  const scenarioEvidence = input.scenarios.map((scenario) => effectiveEvidence(input.baseEvidence, scenario));
  const varying = varyingEvidenceNodes(scenarioEvidence);
  const nodeIds = new Set(input.bayesianNetwork.nodes.map((node) => node.id));
  const parents = new Map<string, Set<string>>(input.bayesianNetwork.nodes.map((node) => [node.id, new Set()]));
  input.bayesianNetwork.edges.forEach((edge) => parents.get(edge.childNodeId)?.add(edge.parentNodeId));

  const affectedByNode = new Map<string, Set<string>>();
  for (const candidateId of nodeIds) {
    const sources = new Set<string>();
    for (const sourceId of varying) {
      if (candidateId === sourceId) {
        sources.add(sourceId);
        continue;
      }
      const connected = scenarioEvidence.some((evidence) => {
        const conditioned = new Set(evidence.keys());
        conditioned.delete(sourceId);
        return dConnected(
          sourceId,
          candidateId,
          conditioned,
          nodeIds,
          parents,
          input.bayesianNetwork.edges,
        );
      });
      if (connected) sources.add(sourceId);
    }
    if (sources.size > 0) affectedByNode.set(candidateId, sources);
  }

  const relevantBindings = input.bindings.filter((binding) =>
    affectedByNode.has(binding.bayesianNetworkNode.entityId),
  );
  const bindingReasons = new Map<string, Set<string>>();
  relevantBindings.forEach((binding) => {
    const key = `${binding.faultTreeBasicEvent.workbookId}:${binding.faultTreeBasicEvent.entityId}`;
    const reasons = bindingReasons.get(key) ?? new Set<string>();
    mergeReasons(reasons, affectedByNode.get(binding.bayesianNetworkNode.entityId));
    bindingReasons.set(key, reasons);
  });
  const influence = faultTreeInfluence(input.faultTrees, bindingReasons);
  const faultTreeReasons = new Map(
    [...influence.semantic.entries()]
      .filter(([, value]) => value.reasons.size > 0)
      .map(([key, value]) => [key, value.reasons]),
  );
  const constantMaskedFaultTreeKeys = [...influence.structural.entries()]
    .filter(([key, reasons]) => {
      const value = influence.semantic.get(key);
      return reasons.size > 0
        && value !== undefined
        && value.reasons.size === 0
        && value.canBeFalse !== value.canBeTrue;
    })
    .map(([key]) => key)
    .sort();

  const eventTreeReasons = new Map<string, Set<string>>();
  input.eventTrees.forEach((eventTree) => {
    const reasons = new Set<string>();
    eventTree.faultTrees.forEach((faultTree) => mergeReasons(reasons, faultTreeReasons.get(hclTargetKey(faultTree))));
    if (reasons.size > 0) eventTreeReasons.set(hclTargetKey(eventTree), reasons);
  });
  propagateTransferReasons(input.eventTrees, eventTreeReasons);

  return {
    varyingEvidenceNodeIds: [...varying].sort(),
    affectedBayesianNetworkNodeIds: [...affectedByNode.keys()].sort(),
    relevantBindingIds: relevantBindings.map((binding) => binding.id).sort(),
    faultTreeKeys: [...faultTreeReasons.keys()].sort(),
    constantMaskedFaultTreeKeys,
    eventTreeKeys: [...eventTreeReasons.keys()].sort(),
    faultTreeEvidenceNodeIds: reasonRecord(faultTreeReasons),
    eventTreeEvidenceNodeIds: reasonRecord(eventTreeReasons),
  };
}

export { hclTargetKey, resolveHclBatchTargetRelevance };
export type {
  HclBatchEventTreeTarget,
  HclBatchFaultTreeGate,
  HclBatchFaultTreeGateInput,
  HclBatchFaultTreeLeaf,
  HclBatchFaultTreeTarget,
  HclBatchTargetAddress,
  HclBatchTargetRelevance,
  HclBatchTargetRelevanceInput,
};
