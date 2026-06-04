import type { Edge, Node } from "reactflow";
import {
  FaultTreeNodeType,
  type FaultTreeDistribution,
  type FaultTreeNode,
  type FaultTreeNodeProbabilityType,
} from "mef-types/lib/systems-analysis/systems-analysis";
import type { FaultTreeNodeProps } from "../app/components/treeNodes/faultTreeNodes/faultTreeNodeType";
import type {
  DistributionParams,
  DistributionType,
  FaultTreeNodeQuantification,
} from "../app/types/faultTreeQuantification";
import {
  AND_GATE,
  ATLEAST_GATE,
  BASIC_EVENT,
  HOUSE_EVENT,
  NOT_GATE,
  OR_GATE,
  TRANSFER_GATE,
  WORKFLOW,
} from "./constants";
const RF_TO_MEF_TYPE: Record<string, FaultTreeNodeType> = {
  [OR_GATE]: FaultTreeNodeType.OR_GATE,
  [AND_GATE]: FaultTreeNodeType.AND_GATE,
  [NOT_GATE]: FaultTreeNodeType.INHIBIT_GATE,
  [ATLEAST_GATE]: FaultTreeNodeType.ATLEAST_GATE,
  [BASIC_EVENT]: FaultTreeNodeType.BASIC_EVENT,
  [HOUSE_EVENT]: FaultTreeNodeType.HOUSE_EVENT,
  [TRANSFER_GATE]: FaultTreeNodeType.TRANSFER_OUT,
};
const MEF_TO_RF_TYPE: Partial<Record<FaultTreeNodeType, string>> = {
  [FaultTreeNodeType.OR_GATE]: OR_GATE,
  [FaultTreeNodeType.AND_GATE]: AND_GATE,
  [FaultTreeNodeType.INHIBIT_GATE]: NOT_GATE,
  [FaultTreeNodeType.ATLEAST_GATE]: ATLEAST_GATE,
  [FaultTreeNodeType.BASIC_EVENT]: BASIC_EVENT,
  [FaultTreeNodeType.HOUSE_EVENT]: HOUSE_EVENT,
  [FaultTreeNodeType.TRANSFER_OUT]: TRANSFER_GATE,
  [FaultTreeNodeType.TRANSFER_IN]: TRANSFER_GATE,
};
function buildMEFDistribution(q: FaultTreeNodeQuantification): FaultTreeDistribution | undefined {
  if (q.probabilityType !== "distribution" || !q.distributionType || !q.distributionParams) return undefined;
  const p = q.distributionParams as unknown as Record<string, number>;
  if (q.distributionType === "lognormal" && q.eventType === "during_operation") {
    return { type: "lognormal_time", mean: p["mean"] ?? 0, stdDev: p["stdDev"] ?? 0 };
  }
  switch (q.distributionType as DistributionType) {
    case "lognormal":
      return { type: "lognormal", median: p["median"] ?? 0, errorFactor: p["errorFactor"] ?? 3 };
    case "beta":
      return { type: "beta", alpha: p["alpha"] ?? 1, betaParam: p["betaParam"] ?? 1 };
    case "normal":
      return { type: "normal", mean: p["mean"] ?? 0, stdDev: p["stdDev"] ?? 1 };
    case "uniform":
      return { type: "uniform", lower: p["lower"] ?? 0, upper: p["upper"] ?? 1 };
    case "exponential":
      return { type: "exponential", failureRate: p["failureRate"] ?? 0 };
    case "weibull":
      return { type: "weibull", scale: p["scale"] ?? 1, shape: p["shape"] ?? 1, location: p["location"] ?? 0 };
    case "gamma":
      return { type: "gamma", shape: p["shape"] ?? 1, rate: p["rate"] ?? 1 };
    default:
      return undefined;
  }
}
function parseMEFDistribution(dist: FaultTreeDistribution): {
  distributionType: DistributionType;
  distributionParams: DistributionParams;
  eventType: "on_demand" | "during_operation";
} {
  switch (dist.type) {
    case "lognormal":
      return {
        distributionType: "lognormal",
        distributionParams: { median: dist.median, errorFactor: dist.errorFactor } as DistributionParams,
        eventType: "on_demand",
      };
    case "lognormal_time":
      return {
        distributionType: "lognormal",
        distributionParams: { mean: dist.mean, stdDev: dist.stdDev } as DistributionParams,
        eventType: "during_operation",
      };
    case "beta":
      return {
        distributionType: "beta",
        distributionParams: { alpha: dist.alpha, betaParam: dist.betaParam } as DistributionParams,
        eventType: "on_demand",
      };
    case "normal":
      return {
        distributionType: "normal",
        distributionParams: { mean: dist.mean, stdDev: dist.stdDev } as DistributionParams,
        eventType: "on_demand",
      };
    case "uniform":
      return {
        distributionType: "uniform",
        distributionParams: { lower: dist.lower, upper: dist.upper } as DistributionParams,
        eventType: "on_demand",
      };
    case "exponential":
      return {
        distributionType: "exponential",
        distributionParams: { failureRate: dist.failureRate } as DistributionParams,
        eventType: "during_operation",
      };
    case "weibull":
      return {
        distributionType: "weibull",
        distributionParams: { scale: dist.scale, shape: dist.shape, location: dist.location } as DistributionParams,
        eventType: "during_operation",
      };
    case "gamma":
      return {
        distributionType: "gamma",
        distributionParams: { shape: dist.shape, rate: dist.rate } as DistributionParams,
        eventType: "during_operation",
      };
  }
}
function cloneDisplayId(parentDisplayId: string, childCanonicalId: string): string {
  return `${parentDisplayId.toLowerCase()}${childCanonicalId.toLowerCase()}`;
}
function deriveTopEventId(nodes: Node[], edges: Edge[]): string {
  const targets = new Set(edges.map((e) => e.target));
  const root = nodes.find((n) => !targets.has(n.id));
  return root?.id ?? nodes[0]?.id ?? "";
}
export function reactFlowToMEF(
  nodes: Node<FaultTreeNodeProps>[],
  edges: Edge[],
): {
  topEventId: string;
  nodes: Record<string, FaultTreeNode>;
} {
  const displayToCanonical = new Map<string, string>();
  for (const node of nodes) {
    displayToCanonical.set(node.id, node.data?.canonicalId ?? node.id);
  }
  const collapsedEdges: Edge[] = edges.map((e) => {
    const src = displayToCanonical.get(e.source) ?? e.source;
    const tgt = displayToCanonical.get(e.target) ?? e.target;
    return { ...e, source: src, target: tgt, id: `${src}=>${tgt}` };
  });
  const seenEdgeIds = new Set<string>();
  const dedupedEdges = collapsedEdges.filter((e) => {
    if (seenEdgeIds.has(e.id)) return false;
    seenEdgeIds.add(e.id);
    return true;
  });
  const canonicalNodes = nodes.map((n) => ({ ...n, id: displayToCanonical.get(n.id) ?? n.id }));
  const topEventId = deriveTopEventId(canonicalNodes, dedupedEdges);
  const mefNodes: Record<string, FaultTreeNode> = {};
  for (const node of nodes) {
    const cid = displayToCanonical.get(node.id) ?? node.id;
    if (mefNodes[cid]) continue;
    const q = node.data?.quantification;
    const nodeType: FaultTreeNodeType = RF_TO_MEF_TYPE[node.type ?? ""] ?? FaultTreeNodeType.BASIC_EVENT;
    const inputs = dedupedEdges.filter((e) => e.source === cid).map((e) => e.target);
    const mefNode: FaultTreeNode = {
      uuid: cid,
      nodeType,
      name: q?.name ?? "",
      ...(q?.description ? { description: q.description } : {}),
      ...(inputs.length > 0 ? { inputs } : {}),
      position: node.position,
    };
    if (q) {
      if (q.probabilityType) {
        mefNode.probabilityType = q.probabilityType as FaultTreeNodeProbabilityType;
      }
      if (q.probabilityType === "constant" && q.constantValue !== undefined) {
        mefNode.probability = q.constantValue;
      }
      if (q.probabilityType === "distribution") {
        mefNode.eventType = q.eventType;
        const dist = buildMEFDistribution(q);
        if (dist) mefNode.probabilityDistribution = dist;
      }
      if (q.probabilityType === "bayesian_network_link" && q.bayesianNetworkId !== undefined) {
        mefNode.bayesianNetworkRef = {
          networkId: q.bayesianNetworkId,
          ...(q.bayesianNetworkNodeId ? { nodeId: q.bayesianNetworkNodeId } : {}),
        };
      }
      if (q.houseEventState !== undefined) {
        mefNode.houseEventValue = q.houseEventState === "true";
      }
      if (q.targetFaultTreeId) {
        mefNode.transferTreeId = q.targetFaultTreeId;
      }
      if (q.kValue !== undefined) {
        mefNode.kValue = q.kValue;
      }
    }
    mefNodes[cid] = mefNode;
  }
  return { topEventId, nodes: mefNodes };
}
function buildQuantification(mefNode: FaultTreeNode): FaultTreeNodeQuantification {
  const q: FaultTreeNodeQuantification = {
    name: mefNode.name,
    description: mefNode.description ?? "",
    probabilityType: (mefNode.probabilityType as FaultTreeNodeQuantification["probabilityType"]) ?? "constant",
  };
  if (mefNode.probability !== undefined) q.constantValue = mefNode.probability;
  if (mefNode.probabilityDistribution) {
    const { distributionType, distributionParams, eventType } = parseMEFDistribution(mefNode.probabilityDistribution);
    q.distributionType = distributionType;
    q.distributionParams = distributionParams;
    q.eventType = mefNode.eventType ?? eventType;
  } else if (mefNode.eventType) {
    q.eventType = mefNode.eventType;
  }
  if (mefNode.bayesianNetworkRef) {
    q.bayesianNetworkId = mefNode.bayesianNetworkRef.networkId;
    q.bayesianNetworkNodeId = mefNode.bayesianNetworkRef.nodeId;
  }
  if (mefNode.houseEventValue !== undefined) {
    q.houseEventState = mefNode.houseEventValue ? "true" : "false";
  }
  if (mefNode.transferTreeId) q.targetFaultTreeId = mefNode.transferTreeId;
  if (mefNode.kValue !== undefined) q.kValue = mefNode.kValue;
  return q;
}
function expandNode(
  canonicalUuid: string,
  parentDisplayId: string | null,
  mefNodes: Record<string, FaultTreeNode>,
  visitedUnder: Map<string, string>,
  rfNodes: Node<FaultTreeNodeProps>[],
  rfEdges: Edge[],
): string {
  const mefNode = mefNodes[canonicalUuid];
  if (!mefNode) return canonicalUuid;
  const firstVisitDisplayId = visitedUnder.get(canonicalUuid);
  const isFirstVisit = firstVisitDisplayId === undefined;
  const displayId = isFirstVisit ? canonicalUuid : cloneDisplayId(parentDisplayId ?? canonicalUuid, canonicalUuid);
  if (isFirstVisit) visitedUnder.set(canonicalUuid, displayId);
  rfNodes.push({
    id: displayId,
    type: MEF_TO_RF_TYPE[mefNode.nodeType] ?? BASIC_EVENT,
    position: mefNode.position ?? { x: 0, y: 0 },
    data: { quantification: buildQuantification(mefNode), canonicalId: canonicalUuid },
  });
  for (const childCanonicalId of mefNode.inputs ?? []) {
    const childDisplayId = expandNode(childCanonicalId, displayId, mefNodes, visitedUnder, rfNodes, rfEdges);
    rfEdges.push({
      id: `${displayId}=>${childDisplayId}`,
      source: displayId,
      target: childDisplayId,
      type: WORKFLOW,
      animated: false,
      data: {},
    });
  }
  return displayId;
}
export function mefToReactFlow(mefNodes: Record<string, FaultTreeNode>): {
  nodes: Node<FaultTreeNodeProps>[];
  edges: Edge[];
} {
  const rfNodes: Node<FaultTreeNodeProps>[] = [];
  const rfEdges: Edge[] = [];
  const allInputs = new Set<string>();
  for (const n of Object.values(mefNodes)) {
    for (const i of n.inputs ?? []) allInputs.add(i);
  }
  const topId = Object.keys(mefNodes).find((id) => !allInputs.has(id));
  if (!topId) return { nodes: rfNodes, edges: rfEdges };
  const visitedUnder = new Map<string, string>();
  expandNode(topId, null, mefNodes, visitedUnder, rfNodes, rfEdges);
  return { nodes: rfNodes, edges: rfEdges };
}
