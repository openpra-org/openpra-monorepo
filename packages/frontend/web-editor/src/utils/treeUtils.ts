import { EventSequenceGraph, EventTreeGraph, FaultTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import type { FunctionalEvent, EventTreeSequence } from "mef-types/lib/event-sequence-analysis/event-sequence-analysis";
import { reactFlowToMEF } from "./faultTreeMEFSerializer";
import { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";
import { GraphEdge } from "shared-types/src/lib/types/reactflowGraph/GraphEdge";
import { Edge, getConnectedEdges, getIncomers, getOutgoers, Node } from "reactflow";
import _ from "lodash";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { Toast } from "@elastic/eui/src/components/toast/global_toast_list";
import { EuiToastProps } from "@elastic/eui/src/components/toast/toast";
import {
  EventSequenceNodeProps,
  EventSequenceNodeTypes,
} from "../app/components/treeNodes/eventSequenceNodes/eventSequenceNodeType";
import { EventSequenceEdgeProps } from "../app/components/treeEdges/eventSequenceEdges/eventSequenceEdgeType";
import { FaultTreeNodeProps } from "../app/components/treeNodes/faultTreeNodes/faultTreeNodeType";
import { BASIC_EVENT, WORKFLOW } from "./constants";
import type { ColumnNodeData } from "../app/components/treeNodes/eventTreeEditorNode/columnNode";
import type { VisibleNodeData } from "../app/components/treeNodes/eventTreeEditorNode/visibleNode";
import type { OutputNodeData } from "../app/components/treeNodes/eventTreeEditorNode/outputNode";
import type { EventTreeEdgeData } from "../app/components/treeEdges/eventTreeEditorEdges/eventTreeEdgeType";
export const GenerateUUID = (): string => new Date().getTime().toString(36) + Math.random().toString(36).slice(2);
export type EventSequenceStateType = {
  eventSequenceId: string;
} & BaseGraphState;
export type FaultTreeStateType = {
  faultTreeId: string;
} & BaseGraphState;
export type EventTreeStateType = {
  eventTreeId: string;
  functionalEvents?: Record<string, FunctionalEvent>;
} & BaseGraphState;
export interface BaseGraphState {
  nodes: Node[];
  edges: Edge[];
}
export interface OnUpdateOrDeleteGraphState {
  syncState?: boolean;
  updatedState: BaseGraphState;
  updatedSubgraph: BaseGraphState;
  deletedSubgraph: BaseGraphState;
}
export interface OnGrayedState {
  grayedNodes: Node<FaultTreeNodeProps>[];
  grayedEdges: Edge<FaultTreeNodeProps>[];
}
export type GrayedNodeData = Node<FaultTreeNodeProps> | Edge<FaultTreeNodeProps>;
export const EventSequenceState = ({ eventSequenceId, nodes, edges }: EventSequenceStateType): EventSequenceGraph => ({
  eventSequenceId: eventSequenceId,
  nodes: getNodes<EventSequenceNodeProps>(nodes),
  edges: getEdges<EventSequenceEdgeProps>(edges),
});
export const FaultTreeState = ({ faultTreeId, nodes, edges }: FaultTreeStateType): FaultTreeGraph => {
  const { topEventId, nodes: mefNodes } = reactFlowToMEF(nodes, edges);
  return { faultTreeId, topEventId, nodes: mefNodes };
};
export const EventTreeState = ({ eventTreeId, nodes, edges, functionalEvents }: EventTreeStateType): EventTreeGraph => {
  const recomputedEdges = recomputeBranchStates(nodes, edges);
  const sanitizedNodes = nodes.map((n) => {
    if (n.type !== "outputNode") return n;
    const { sequenceId: _sq, ...rest } = n.data as VisibleNodeData & {
      sequenceId?: string;
    };
    return { ...n, data: rest };
  });
  const derivedFunctionalEvents: Record<string, FunctionalEvent> = {};
  nodes.forEach((n) => {
    if (n.type !== "columnNode") return;
    const d = n.data as ColumnNodeData;
    if (!d.allowAdd || d.output) return;
    derivedFunctionalEvents[n.id] = {
      uuid: n.id,
      name: d.label ?? n.id,
      order: d.depth,
      ...(d.faultTreeId ? { faultTreeId: d.faultTreeId } : {}),
      ...(functionalEvents?.[n.id] ? functionalEvents[n.id] : {}),
    };
  });
  let initiatingEventId: string | undefined;
  let initiatingEventFrequency: number | undefined;
  nodes.forEach((n) => {
    if (n.type !== "columnNode") return;
    const d = n.data as ColumnNodeData;
    if (d.depth === 1 && !d.allowAdd) {
      initiatingEventId = n.id;
      if (typeof d.frequency === "number" && isFinite(d.frequency) && d.frequency > 0) {
        initiatingEventFrequency = d.frequency;
      }
    }
  });
  const sequences = enumerateMefSequences(nodes, recomputedEdges);
  return {
    eventTreeId,
    ...(initiatingEventId ? { initiatingEventId } : {}),
    ...(initiatingEventFrequency !== undefined ? { initiatingEventFrequency } : {}),
    nodes: getNodes(sanitizedNodes),
    edges: getEdges(recomputedEdges),
    ...(Object.keys(derivedFunctionalEvents).length > 0 ? { functionalEvents: derivedFunctionalEvents } : {}),
    ...(Object.keys(sequences).length > 0 ? { sequences } : {}),
  };
};
function recomputeBranchStates(nodes: Node[], edges: Edge[]): Edge[] {
  const depthToCol: Record<
    number,
    {
      id: string;
      ftLinked: boolean;
    }
  > = {};
  nodes.forEach((n) => {
    if (n.type !== "columnNode") return;
    const d = n.data as ColumnNodeData;
    if (d.depth && d.allowAdd && !d.output) depthToCol[d.depth] = { id: n.id, ftLinked: Boolean(d.faultTreeId) };
  });
  const nodeInfo: Record<
    string,
    {
      depth: number;
      y: number;
    }
  > = {};
  nodes.forEach((n) => {
    if (n.type === "columnNode") return;
    const depth = (n.data as VisibleNodeData).depth;
    if (depth) nodeInfo[n.id] = { depth, y: n.position.y };
  });
  const groups: Record<
    string,
    {
      edgeId: string;
      targetY: number;
    }[]
  > = {};
  edges.forEach((e) => {
    const tgt = nodeInfo[e.target];
    if (!nodeInfo[e.source] || !tgt) return;
    if (
      (
        e.data as
          | {
              branchState?: string;
            }
          | undefined
      )?.branchState === "bypass"
    )
      return;
    const key = `${e.source}:${tgt.depth}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ edgeId: e.id, targetY: tgt.y });
  });
  const updates: Record<
    string,
    {
      branchState: string;
      feId?: string;
    }
  > = {};
  Object.entries(groups).forEach(([key, list]) => {
    const targetDepth = Number(key.split(":")[1]);
    const col = depthToCol[targetDepth];
    if (list.length !== 2) return;
    const sorted = [...list].sort((a, b) => a.targetY - b.targetY);
    sorted.forEach(({ edgeId }, idx) => {
      updates[edgeId] = {
        branchState:
          !col?.ftLinked ? "bypass"
          : idx === 0 ? "success"
          : "failure",
        ...(col ? { feId: col.id } : {}),
      };
    });
  });
  const bypassLeafEdges = new Set<string>();
  edges.forEach((e) => {
    if (nodeInfo[e.source] && !nodeInfo[e.target] && !updates[e.id]) {
      const existingBranch = (
        e.data as
          | {
              branchState?: string;
            }
          | undefined
      )?.branchState;
      if (existingBranch !== "success" && existingBranch !== "failure") {
        bypassLeafEdges.add(e.id);
      }
    }
  });
  return edges.map((e) => {
    const u = updates[e.id];
    if (u) return { ...e, data: { ...(e.data as object), ...u } };
    if (bypassLeafEdges.has(e.id)) return { ...e, data: { branchState: "bypass" } };
    return e;
  });
}
function enumerateMefSequences(nodes: Node[], edges: Edge[]): Record<string, EventTreeSequence> {
  const nodeMap: Record<string, Node> = {};
  nodes.forEach((n) => {
    nodeMap[n.id] = n;
  });
  type AdjEntry = {
    targetId: string;
    branchState?: string;
    feId?: string;
    hidden?: boolean;
  };
  const adjacency: Record<string, AdjEntry[]> = {};
  edges.forEach((e) => {
    if (!adjacency[e.source]) adjacency[e.source] = [];
    const d: EventTreeEdgeData = (e.data as EventTreeEdgeData) ?? {};
    adjacency[e.source].push({
      targetId: e.target,
      branchState: d.branchState as string | undefined,
      feId: d.feId as string | undefined,
      hidden: d.hidden as boolean | undefined,
    });
  });
  const root = nodes.find(
    (n) => (n.type === "visibleNode" || n.type === "invisibleNode") && (n.data as VisibleNodeData).depth === 1,
  );
  if (!root) return {};
  const sequences: Record<string, EventTreeSequence> = {};
  function dfs(nodeId: string, fes: Record<string, "SUCCESS" | "FAILURE">): void {
    for (const child of adjacency[nodeId] ?? []) {
      if (child.hidden) continue;
      const target = nodeMap[child.targetId];
      if (!target) continue;
      if (target.type === "outputNode") {
        const td = target.data as OutputNodeData;
        if (td.isSequenceId) {
          const finalFes = { ...fes };
          if (child.feId && (child.branchState === "success" || child.branchState === "failure")) {
            finalFes[child.feId] = child.branchState === "success" ? "SUCCESS" : "FAILURE";
          }
          let endState = "SUCCESSFUL_MITIGATION";
          for (const next of adjacency[child.targetId] ?? []) {
            const nextNode = nodeMap[next.targetId];
            if (nextNode && next.hidden) {
              const label = (nextNode.data as OutputNodeData).label;
              if (label) endState = String(label);
              break;
            }
          }
          sequences[child.targetId] = {
            uuid: child.targetId,
            name: String((td.label as string) ?? child.targetId),
            functionalEventStates: finalFes,
            endState,
          };
        }
        continue;
      }
      const nextFes = { ...fes };
      if (child.feId && (child.branchState === "success" || child.branchState === "failure")) {
        nextFes[child.feId] = child.branchState === "success" ? "SUCCESS" : "FAILURE";
      }
      dfs(child.targetId, nextFes);
    }
  }
  dfs(root.id, {});
  return sequences;
}
function getNodes<T>(nodes: Node[]): GraphNode<T>[] {
  return nodes.map(
    (node: Node<T>) =>
      ({
        id: node.id,
        data: node.data,
        position: node.position,
        type: node.type,
      }) as GraphNode<T>,
  );
}
function getEdges<T>(edges: Edge[]): GraphEdge<T>[] {
  return edges.map(
    (edge: Edge<T>) =>
      ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        data: edge.data,
        animated: edge.animated,
      }) as GraphEdge<T>,
  );
}
export const getBasicEventNode = (currentNodes: Node[] = []): Node => {
  const numericIds = currentNodes.map((n) => parseInt(n.id, 10)).filter((n) => !isNaN(n));
  const nextId = numericIds.length > 0 ? String(Math.max(...numericIds) + 1) : "2";
  return {
    id: nextId,
    data: {},
    position: { x: 0, y: 0 },
    type: BASIC_EVENT,
  };
};
export const getWorkflowEdge = (parentNodeId: string, childNodeId: string, _label = ""): Edge<FaultTreeNodeProps> => ({
  id: `${parentNodeId}=>${childNodeId}`,
  source: parentNodeId,
  target: childNodeId,
  type: WORKFLOW,
  animated: false,
  data: {},
});
export const filterDuplicateData = (currentData: GrayedNodeData[]): GrayedNodeData[] => {
  return currentData.reduce((acc: GrayedNodeData[], curr: GrayedNodeData) => {
    const existingItem: GrayedNodeData | undefined = acc.find((item: GrayedNodeData): boolean => item.id === curr.id);
    if (existingItem) {
      if (curr.data?.branchId) {
        return acc.map((item) => (item.id === curr.id ? curr : item));
      } else {
        return acc;
      }
    } else {
      return [...acc, curr];
    }
  }, []);
};
export const grayOutSubgraph = (
  node: Node<FaultTreeNodeProps>,
  currentNodes: Node[],
  currentEdges: Edge[],
): OnGrayedState => {
  const grayedNodes: Node[] = [...currentNodes];
  const grayedEdges: Edge[] = [...currentEdges];
  if (node.data) node.data.isGrayed = true;
  grayedNodes.push(node);
  const { nodes, edges } = GetSubgraph(node, currentNodes, currentEdges);
  const outgoers: Node[] = getOutgoers(node, currentNodes, currentEdges);
  const branchRootNodes: Node<FaultTreeNodeProps>[] = [];
  nodes.forEach((node, index) => {
    if (outgoers.includes(node)) {
      node.data = {
        isGrayed: true,
        branchId: `branch-${String(index)}`,
      };
      branchRootNodes.push(node);
    }
  });
  grayedNodes.push(...branchRootNodes);
  const childEdges = getConnectedEdges([node, ...nodes], currentEdges).filter((edge) => !(edge.target === node.id));
  const grayedChildEdges: Edge<FaultTreeNodeProps>[] = childEdges.map((childEdge: Edge<FaultTreeNodeProps>) => {
    const targetNode: Node<FaultTreeNodeProps> = getNodeFromId(childEdge.target, nodes);
    return {
      ...childEdge,
      animated: true,
      data: {
        branchId: targetNode.data?.branchId,
        isGrayed: true,
      },
    };
  });
  grayedEdges.push(...grayedChildEdges);
  branchRootNodes.forEach((branchRootNode: Node<FaultTreeNodeProps>) => {
    const { grayedNodes: grayedBranchNodes, grayedEdges: grayedBranchEdges } = grayOutBranch(
      branchRootNode,
      branchRootNode.data?.branchId,
      nodes,
      edges,
    );
    grayedNodes.push(...grayedBranchNodes);
    grayedEdges.push(...grayedBranchEdges);
  });
  const finalNodes = filterDuplicateData(grayedNodes);
  const finalEdges = filterDuplicateData(grayedEdges);
  return {
    grayedNodes: finalNodes as Node<FaultTreeNodeProps>[],
    grayedEdges: finalEdges as Edge<FaultTreeNodeProps>[],
  };
};
export const grayOutBranch = (
  branchRootNode: Node<FaultTreeNodeProps>,
  branchId: string | undefined,
  currentNodes: Node<FaultTreeNodeProps>[],
  currentEdges: Edge<FaultTreeNodeProps>[],
): OnGrayedState => {
  const { nodes, edges } = GetSubgraph(branchRootNode, currentNodes, currentEdges);
  const branchChildNodes = nodes.map((branchChildNode: Node<FaultTreeNodeProps>) => ({
    ...branchChildNode,
    data: {
      isGrayed: true,
      branchId: branchId,
    },
  }));
  const branchChildEdges = edges.map((branchChildEdge) => ({
    ...branchChildEdge,
    animated: true,
    data: {
      isGrayed: true,
      branchId: branchId,
    },
  }));
  return { grayedNodes: branchChildNodes, grayedEdges: branchChildEdges };
};
export const isSubgraphGrayed = (nodes: Node[], edges: Edge[]): boolean => {
  return !(
    nodes.findIndex((n: Node<FaultTreeNodeProps>) => n.data?.isGrayed === true) === -1 &&
    edges.findIndex((e: Edge<FaultTreeNodeProps>) => e.data?.isGrayed === true) === -1
  );
};
export const exitGrayedState = (
  nodes: Node[],
  edges: Edge[],
): {
  newNodes: Node[];
  newEdges: Edge[];
} => {
  const newNodes: Node[] = nodes.map(({ data: _data, ...node }) => ({
    ...node,
    data: {
      isGrayed: false,
    },
  }));
  const newEdges: Edge[] = edges.map(({ data: _data, ...edge }) => ({
    ...edge,
    animated: false,
    data: {
      isGrayed: false,
    },
  }));
  return { newNodes, newEdges };
};
export const getNodeFromId = (id: string, currentNodes: Node<FaultTreeNodeProps>[]): Node<FaultTreeNodeProps> => {
  return currentNodes.filter((node: Node) => node.id === id)[0];
};
export function IsNodeDeletable(nodeType?: string): boolean {
  switch (nodeType) {
    case "initiating":
    case "end":
    case "transfer":
    case "undeveloped":
      return false;
    case "functional":
    case "description":
    case "intermediate":
      return true;
    default:
      return false;
  }
}
export function GetSubgraph(node: Node, currentNodes: Node[], currentEdges: Edge[]): BaseGraphState {
  let childNodes: Node[] = [];
  let childEdges: Edge[] = [];
  const children = getOutgoers(node, currentNodes, currentEdges);
  childNodes.push(...children);
  const childrenEdges = getConnectedEdges([node, ...children], currentEdges).filter(
    (edge) => !(edge.target === node.id),
  );
  childEdges.push(...childrenEdges);
  children.forEach((child) => {
    const { nodes, edges } = GetSubgraph(child, currentNodes, currentEdges);
    childNodes.push(...nodes);
    childEdges.push(...edges);
  });
  childNodes = _.uniqBy(childNodes, "id");
  childEdges = _.uniqBy(childEdges, "id");
  return {
    nodes: childNodes,
    edges: childEdges,
  } as BaseGraphState;
}
export function GetParentNode(node: Node, currentNodes: Node[], currentEdges: Edge[]): Node {
  const incomingNodes = getIncomers(node, currentNodes, currentEdges);
  if (incomingNodes.length !== 1) {
    throw Error("Invalid node");
  }
  return incomingNodes[0];
}
export function GetIncomingEdge(node: Node, connectedEdges: Edge[]): Edge<EventSequenceEdgeProps> {
  const incomingEdge: Edge | undefined = connectedEdges.find((edge) => edge.target === node.id);
  if (incomingEdge === undefined) {
    throw Error("No incoming edge found");
  }
  return incomingEdge;
}
export function BuildAnEdge(
  fromNode: Node,
  toNode: Node,
  edgeType: string | undefined,
  data: EventSequenceEdgeProps | undefined,
): Edge<EventSequenceEdgeProps> {
  return {
    id: `${fromNode.id}->${toNode.id}`,
    source: fromNode.id,
    target: toNode.id,
    type: edgeType,
    data: data,
    animated: false,
  };
}
export function UpdateEventSequenceDiagram(
  eventSequenceId: string,
  updatedSubgraph: BaseGraphState,
  deletedSubgraph: BaseGraphState,
): Promise<boolean> {
  const updatedSubgraphState: EventSequenceGraph = EventSequenceState({
    eventSequenceId: eventSequenceId,
    nodes: updatedSubgraph.nodes,
    edges: updatedSubgraph.edges,
  });
  const deletedSubgraphState: EventSequenceGraph = EventSequenceState({
    eventSequenceId: eventSequenceId,
    nodes: deletedSubgraph.nodes,
    edges: deletedSubgraph.edges,
  });
  return GraphApiManager.updateESSubgraph(eventSequenceId, updatedSubgraphState, deletedSubgraphState);
}
export function DeleteEventSequenceNode(
  selectedNode: Node<EventSequenceNodeProps, EventSequenceNodeTypes>,
  currentNodes: Node[],
  currentEdges: Edge[],
): OnUpdateOrDeleteGraphState | undefined {
  if (selectedNode.data.isDeleted === true || selectedNode.data.tentative === true) return;
  const parentNode: Node = GetParentNode(selectedNode, currentNodes, currentEdges);
  const connectedEdges: Edge[] = getConnectedEdges([selectedNode], currentEdges);
  if (selectedNode.type === "functional") {
    return GenerateTentativeState("delete", selectedNode, currentNodes, currentEdges);
  }
  if (selectedNode.type === "description" || selectedNode.type === "intermediate") {
    const incomingEdge: Edge<EventSequenceEdgeProps> = GetIncomingEdge(selectedNode, connectedEdges);
    const outgoingEdges: Node[] = getOutgoers(selectedNode, currentNodes, currentEdges);
    if (outgoingEdges.length < 1) {
      throw Error("Outgoing edge(s) not found");
    }
    const newEdge: Edge<EventSequenceEdgeProps> = BuildAnEdge(
      parentNode,
      outgoingEdges[0],
      incomingEdge.type,
      incomingEdge.data,
    );
    const newNodes: Node[] = currentNodes.filter((n: Node) => !(n.id === selectedNode.id));
    const newEdges: Edge[] = currentEdges
      .filter((edge) => !connectedEdges.some((e) => e.id === edge.id))
      .concat([newEdge]);
    return {
      updatedState: {
        nodes: newNodes,
        edges: newEdges,
      },
      updatedSubgraph: {
        nodes: [],
        edges: [newEdge],
      },
      deletedSubgraph: {
        nodes: [selectedNode],
        edges: connectedEdges,
      },
      syncState: true,
    } as OnUpdateOrDeleteGraphState;
  }
  return;
}
function GenerateTentativeState(
  mode: "update" | "delete",
  selectedNode: Node<EventSequenceNodeProps>,
  currentNodes: Node<EventSequenceNodeProps>[],
  currentEdges: Edge<EventSequenceEdgeProps>[],
): OnUpdateOrDeleteGraphState {
  const isUpdated = mode === "update";
  const isDeleted = mode === "delete";
  const outgoingEdges = getConnectedEdges([selectedNode], currentEdges).filter(
    (edge) => edge.source === selectedNode.id,
  );
  const children = currentNodes.filter((node) => outgoingEdges.some((edge) => edge.target === node.id));
  const newNodes: Node<EventSequenceNodeProps>[] = [
    {
      ...selectedNode,
      data: { ...selectedNode.data, tentative: true, isUpdated, isDeleted },
    },
  ];
  const newEdges: Edge<EventSequenceEdgeProps>[] = [
    ...outgoingEdges.map((edge: Edge<EventSequenceEdgeProps>, index) => ({
      ...edge,
      data: {
        ...edge.data,
        tentative: true,
        branchId: `branch-${edge.target}-${String(index)}`,
      },
      animated: true,
    })),
  ];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const { nodes, edges } = GetSubgraph(child, currentNodes, currentEdges);
    const childNodes = [child, ...nodes].map((innerNode: Node<EventSequenceNodeProps>) => ({
      ...innerNode,
      data: {
        ...innerNode.data,
        tentative: true,
        branchId: `branch-${child.id}-${String(i)}`,
      },
    }));
    const childEdges = edges.map((innerEdge: Edge<EventSequenceEdgeProps>) => ({
      ...innerEdge,
      animated: true,
      data: {
        ...innerEdge.data,
        tentative: true,
        branchId: `branch-${child.id}-${String(i)}`,
      },
    }));
    newNodes.push(...childNodes);
    newEdges.push(...childEdges);
  }
  newNodes.push(...currentNodes.filter((node) => !newNodes.some((n) => n.id === node.id)));
  newEdges.push(...currentEdges.filter((edge) => !newEdges.some((e) => e.id === edge.id)));
  return {
    updatedState: {
      nodes: newNodes,
      edges: newEdges,
    },
    syncState: false,
  } as OnUpdateOrDeleteGraphState;
}
export function RevertTentativeState(
  currentNodes: Node<EventSequenceNodeProps>[],
  currentEdges: Edge<EventSequenceEdgeProps>[],
): OnUpdateOrDeleteGraphState {
  const newNodes = currentNodes.map((node: Node<EventSequenceNodeProps>): Node<EventSequenceNodeProps> => {
    if (node.data.tentative === true) {
      node.data = {
        ...node.data,
        tentative: false,
        isUpdated: false,
        isDeleted: false,
        branchId: undefined,
      };
    }
    return node;
  });
  const newEdges: Edge[] = currentEdges.map((edge: Edge<EventSequenceEdgeProps>) => {
    if (edge.data?.tentative === true) {
      edge.data = {
        ...edge.data,
        tentative: false,
        branchId: undefined,
      };
      edge.animated = false;
    }
    return edge;
  });
  return {
    updatedState: {
      nodes: newNodes,
      edges: newEdges,
    },
    syncState: false,
  } as OnUpdateOrDeleteGraphState;
}
function GetEndStateNode(): Node<EventSequenceNodeProps, EventSequenceNodeTypes> {
  return {
    id: GenerateUUID(),
    data: {
      label: "End State",
    },
    position: { x: 0, y: 0 },
    type: "end",
  };
}
function GetEndStateEdge(
  parentNodeId: string,
  childNodeId: string,
  label = "",
  order: number | undefined = undefined,
): Edge<EventSequenceEdgeProps> {
  const edge: Edge<EventSequenceEdgeProps> = {
    id: `${parentNodeId}->${childNodeId}`,
    source: parentNodeId,
    target: childNodeId,
    type: "normal",
  };
  if (label !== "") {
    edge.type = "functional";
    edge.data = { label: label, order: order };
  }
  return edge;
}
export function UpdateEventSequenceNode(
  selectedNode: Node<EventSequenceNodeProps, EventSequenceNodeTypes>,
  currentNodes: Node[],
  currentEdges: Edge[],
): OnUpdateOrDeleteGraphState | undefined {
  const childNodes = getOutgoers(selectedNode, currentNodes, currentEdges);
  const nodesToAdd: Node[] = [];
  const edgesToAdd: Edge[] = [];
  const nodesToRemove: Node[] = [];
  const edgesToRemove: Edge[] = [];
  if (selectedNode.type === "functional") {
    if (childNodes.length === 0) {
      const child1 = GetEndStateNode();
      const child2 = GetEndStateNode();
      const edge1 = GetEndStateEdge(selectedNode.id, child1.id, "Yes", 1);
      const edge2 = GetEndStateEdge(selectedNode.id, child2.id, "No", 2);
      nodesToAdd.push(child1, child2);
      edgesToAdd.push(edge1, edge2);
    } else if (childNodes.length === 1) {
      const existingEdge: Edge | undefined = currentEdges.find((edge) => edge.source === selectedNode.id);
      if (existingEdge) {
        edgesToRemove.push(existingEdge);
        edgesToAdd.push({
          id: existingEdge.id,
          source: existingEdge.source,
          target: existingEdge.target,
          type: "functional",
          data: { label: "Yes", order: 1 },
        });
      }
      const child2 = GetEndStateNode();
      const edge2 = GetEndStateEdge(selectedNode.id, child2.id, "No", 2);
      nodesToAdd.push(child2);
      edgesToAdd.push(edge2);
    } else if (childNodes.length === 2) {
      const existingEdges = currentEdges.filter((edge) => edge.source === selectedNode.id);
      edgesToRemove.push(...existingEdges);
      edgesToAdd.push(
        {
          id: existingEdges[0].id,
          source: existingEdges[0].source,
          target: existingEdges[0].target,
          type: "functional",
          data: { label: "Yes", order: 1 },
        },
        {
          id: existingEdges[1].id,
          source: existingEdges[1].source,
          target: existingEdges[1].target,
          type: "functional",
          data: { label: "No", order: 2 },
        },
      );
    }
  } else if (selectedNode.type === "description" || selectedNode.type === "intermediate") {
    if (childNodes.length === 0) {
      const child = GetEndStateNode();
      const edge = GetEndStateEdge(selectedNode.id, child.id);
      nodesToAdd.push(child);
      edgesToAdd.push(edge);
    } else if (childNodes.length === 2) {
      return GenerateTentativeState("update", selectedNode, currentNodes, currentEdges);
    }
  } else if (selectedNode.type === "transfer" || selectedNode.type === "end" || selectedNode.type === "undeveloped") {
    const { nodes, edges } = GetSubgraph(selectedNode, currentNodes, currentEdges);
    nodesToRemove.push(...nodes);
    edgesToRemove.push(...edges.filter((edge) => !(edge.target === selectedNode.id)));
  }
  const updatedNodes: Node[] = currentNodes
    .filter((node) => !nodesToRemove.some((n) => n.id === node.id))
    .concat(nodesToAdd);
  const updatedEdges: Edge[] = currentEdges
    .filter((edge) => !edgesToRemove.some((e) => e.id === edge.id))
    .concat(edgesToAdd);
  return {
    updatedState: {
      nodes: updatedNodes.map((n) => {
        if (n.id === selectedNode.id) {
          n.type = selectedNode.type;
        }
        return n;
      }),
      edges: updatedEdges,
    },
    updatedSubgraph: {
      nodes: [...nodesToAdd, selectedNode],
      edges: edgesToAdd,
    },
    deletedSubgraph: {
      nodes: nodesToRemove,
      edges: edgesToRemove,
    },
    syncState: true,
  } as OnUpdateOrDeleteGraphState;
}
export function AreSiblings(node1: Node, node2: Node, nodes: Node[], edges: Edge[]): boolean {
  const parentOfNode1: Node = GetParentNode(node1, nodes, edges);
  const parentOfNode2: Node = GetParentNode(node2, nodes, edges);
  return parentOfNode1.id === parentOfNode2.id;
}
export function GetDefaultLabelOfNode(nodeType: EventSequenceNodeTypes): string {
  switch (nodeType) {
    case "initiating":
      return "Initiating Event";
    case "end":
      return "End State";
    case "transfer":
      return "Transfer State";
    case "undeveloped":
      return "Undeveloped";
    case "functional":
      return "Functional";
    case "description":
      return "Description";
    case "intermediate":
      return "Intermediate";
    default:
      return "Invalid Node";
  }
}
export function IsCurrentStateTentative(nodes: Node[], edges: Edge[]): boolean {
  return !(
    nodes.findIndex((n: Node<EventSequenceNodeProps>) => n.data.tentative === true) === -1 &&
    edges.findIndex((e: Edge<EventSequenceEdgeProps>) => e.data?.tentative === true) === -1
  );
}
export function GetESToast(type: EuiToastProps["color"], message: string): Toast {
  return {
    id: GenerateUUID(),
    color: type,
    text: message,
  } as Toast;
}
export function GetChildCount(type: EventSequenceNodeTypes): number {
  switch (type) {
    case "functional":
      return 2;
    case "description":
    case "intermediate":
    case "initiating":
      return 1;
    case "end":
    case "transfer":
    case "undeveloped":
      return 0;
    default:
      throw Error("Node type not valid");
  }
}
