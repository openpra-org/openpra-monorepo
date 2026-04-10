/**
 * Serializer / deserializer between ReactFlow graph state and the OpenPRA MEF FaultTree node format.
 *
 * - `reactFlowToMEF`  — converts in-memory ReactFlow nodes + edges → MEF `Record<string, FaultTreeNode>`
 * - `mefToReactFlow`  — converts MEF nodes → ReactFlow `Node[]` + `Edge[]`
 *
 * Only the fields that the editor actually populates are mapped.
 * Fields that have no editor representation are left undefined (MEF optional fields).
 */

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

// ─── Type look-up tables ──────────────────────────────────────────────────────

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

// ─── Distribution helpers ─────────────────────────────────────────────────────

/**
 * Build a typed `FaultTreeDistribution` from the flat quantification fields.
 * Returns undefined when no distribution is fully specified.
 */
function buildMEFDistribution(q: FaultTreeNodeQuantification): FaultTreeDistribution | undefined {
  if (q.probabilityType !== "distribution" || !q.distributionType || !q.distributionParams) return undefined;

  const p = q.distributionParams as unknown as Record<string, number>;

  // lognormal during-operation uses log-mean/stdDev → stored as lognormal_time
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

/**
 * Reconstruct the flat `distributionType` + `distributionParams` fields from a MEF distribution.
 */
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

// ─── Derive top-event id ──────────────────────────────────────────────────────

/**
 * Returns the uuid of the root node (the node that is not a target of any edge).
 * Falls back to the first node's id if every node has an incoming edge (shouldn't happen in a valid tree).
 */
function deriveTopEventId(nodes: Node[], edges: Edge[]): string {
  const targets = new Set(edges.map((e) => e.target));
  const root = nodes.find((n) => !targets.has(n.id));
  return root?.id ?? nodes[0]?.id ?? "";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert the current ReactFlow graph state to a MEF node map.
 *
 * @param nodes  - ReactFlow nodes
 * @param edges  - ReactFlow edges
 * @returns MEF node record keyed by node uuid, plus the derived topEventId
 */
export function reactFlowToMEF(
  nodes: Node<FaultTreeNodeProps>[],
  edges: Edge[],
): { topEventId: string; nodes: Record<string, FaultTreeNode> } {
  const topEventId = deriveTopEventId(nodes, edges);
  const mefNodes: Record<string, FaultTreeNode> = {};

  for (const node of nodes) {
    const q = node.data?.quantification;
    const nodeType: FaultTreeNodeType = RF_TO_MEF_TYPE[node.type ?? ""] ?? FaultTreeNodeType.BASIC_EVENT;

    // Connectivity: children are all edges where this node is the source
    const inputs = edges.filter((e) => e.source === node.id).map((e) => e.target);

    const mefNode: FaultTreeNode = {
      uuid: node.id,
      nodeType,
      name: q?.name ?? "",
      ...(q?.description ? { description: q.description } : {}),
      ...(inputs.length > 0 ? { inputs } : {}),
      position: node.position,
    };

    if (q) {
      // Probability type
      if (q.probabilityType) {
        mefNode.probabilityType = q.probabilityType as FaultTreeNodeProbabilityType;
      }

      // Constant probability
      if (q.probabilityType === "constant" && q.constantValue !== undefined) {
        mefNode.probability = q.constantValue;
      }

      // Distribution
      if (q.probabilityType === "distribution") {
        mefNode.eventType = q.eventType;
        const dist = buildMEFDistribution(q);
        if (dist) mefNode.probabilityDistribution = dist;
      }

      // Bayesian network link
      if (q.probabilityType === "bayesian_network_link" && q.bayesianNetworkId !== undefined) {
        mefNode.bayesianNetworkRef = {
          networkId: q.bayesianNetworkId,
          ...(q.bayesianNetworkNodeId ? { nodeId: q.bayesianNetworkNodeId } : {}),
        };
      }

      // House event
      if (q.houseEventState !== undefined) {
        mefNode.houseEventValue = q.houseEventState === "true";
      }

      // Transfer gate target
      if (q.targetFaultTreeId) {
        mefNode.transferTreeId = q.targetFaultTreeId;
      }

      // ATLEAST gate K value
      if (q.kValue !== undefined) {
        mefNode.kValue = q.kValue;
      }
    }

    mefNodes[node.id] = mefNode;
  }

  return { topEventId, nodes: mefNodes };
}

/**
 * Convert a MEF node map to ReactFlow nodes and edges.
 *
 * @param mefNodes - MEF node record as returned by the API
 * @returns ReactFlow `nodes` array and `edges` array ready for the store
 */
export function mefToReactFlow(mefNodes: Record<string, FaultTreeNode>): {
  nodes: Node<FaultTreeNodeProps>[];
  edges: Edge[];
} {
  const rfNodes: Node<FaultTreeNodeProps>[] = [];
  const rfEdges: Edge[] = [];

  for (const [id, mefNode] of Object.entries(mefNodes)) {
    const q: FaultTreeNodeQuantification = {
      name: mefNode.name,
      description: mefNode.description ?? "",
      probabilityType: (mefNode.probabilityType as FaultTreeNodeQuantification["probabilityType"]) ?? "constant",
    };

    // Constant probability
    if (mefNode.probability !== undefined) {
      q.constantValue = mefNode.probability;
    }

    // Distribution
    if (mefNode.probabilityDistribution) {
      const { distributionType, distributionParams, eventType } = parseMEFDistribution(mefNode.probabilityDistribution);
      q.distributionType = distributionType;
      q.distributionParams = distributionParams;
      q.eventType = mefNode.eventType ?? eventType;
    } else if (mefNode.eventType) {
      q.eventType = mefNode.eventType;
    }

    // Bayesian network link
    if (mefNode.bayesianNetworkRef) {
      q.bayesianNetworkId = mefNode.bayesianNetworkRef.networkId;
      q.bayesianNetworkNodeId = mefNode.bayesianNetworkRef.nodeId;
    }

    // House event
    if (mefNode.houseEventValue !== undefined) {
      q.houseEventState = mefNode.houseEventValue ? "true" : "false";
    }

    // Transfer gate
    if (mefNode.transferTreeId) {
      q.targetFaultTreeId = mefNode.transferTreeId;
    }

    // ATLEAST gate
    if (mefNode.kValue !== undefined) {
      q.kValue = mefNode.kValue;
    }

    rfNodes.push({
      id,
      type: MEF_TO_RF_TYPE[mefNode.nodeType] ?? BASIC_EVENT,
      position: mefNode.position ?? { x: 0, y: 0 },
      data: { quantification: q },
    });

    // Edges: gate node → each child
    for (const inputId of mefNode.inputs ?? []) {
      rfEdges.push({
        id: `${id}=>${inputId}`,
        source: id,
        target: inputId,
        type: WORKFLOW,
        animated: false,
        data: {},
      });
    }
  }

  return { nodes: rfNodes, edges: rfEdges };
}
