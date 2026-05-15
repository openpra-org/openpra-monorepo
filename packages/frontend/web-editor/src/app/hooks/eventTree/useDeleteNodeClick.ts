import { Edge, Node, NodeProps, useReactFlow } from "reactflow";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { useParams } from "react-router-dom";
import { EventTreeState, GenerateUUID } from "../../../utils/treeUtils";
import { UseToastContext } from "../../providers/toastProvider";
import { useEventTreeStore } from "./useEventTreeStore";
interface EventTreeNodeData {
  depth?: number;
  isSequenceId?: boolean;
}
function useDeleteNodeClick(clickedNodeId: NodeProps["id"]): () => void {
  const { setEdges, setNodes, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as {
    eventTreeId: string;
  };
  const { addToast } = UseToastContext();
  const functionalEvents = useEventTreeStore((s) => s.functionalEvents);
  const deleteNode: () => void = () => {
    const nodes = getNodes() as Node<EventTreeNodeData>[];
    const edges = getEdges() as Edge[];
    const nodeToDelete = nodes.find((node) => node.id === clickedNodeId);
    if (!nodeToDelete) return;
    const rootNode = nodes.find((node) => node.data.depth === 1);
    if (!rootNode) return;
    const isOutputOrInvisibleNode = (nodeId: string): boolean => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return false;
      return node.type === "outputNode" || node.type === "invisibleNode";
    };
    const isSequenceIdNode = (nodeId: string): boolean => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return false;
      return node.type === "outputNode" && node.data.isSequenceId === true;
    };
    const sequenceIdNodes = nodes.filter((node) => node.type === "outputNode" && node.data.isSequenceId === true);
    const connectedOutputNodes: string[] = getConnectedOutputNodes(clickedNodeId);
    const connectedSequenceIdNodes: string[] = connectedOutputNodes.filter((nodeId) => isSequenceIdNode(nodeId));
    if (sequenceIdNodes.length - connectedSequenceIdNodes.length < 2) {
      addToast({
        id: GenerateUUID(),
        title: "Warning",
        color: "warning",
        text: "Cannot delete this node. At least two sequences must be maintained.",
      });
      return;
    }
    function getConnectedOutputNodes(nodeId: string): string[] {
      const outputNodes: string[] = [];
      const stack = [nodeId];
      while (stack.length > 0) {
        const currentId = stack.pop();
        if (currentId === undefined) continue;
        const connectedNodes = edges
          .filter((edge) => edge.source === currentId && isOutputOrInvisibleNode(edge.target))
          .map((edge) => edge.target);
        outputNodes.push(...connectedNodes);
        stack.push(...connectedNodes);
      }
      return outputNodes;
    }
    const hasChildren = edges.some((edge) => edge.source === clickedNodeId && !isOutputOrInvisibleNode(edge.target));
    if (hasChildren) {
      addToast({
        id: GenerateUUID(),
        title: "Warning",
        color: "warning",
        text: "Cannot delete this node. Please delete all child nodes first.",
      });
      return;
    }
    const parentEdge = edges.find((edge) => edge.target === clickedNodeId);
    const parentId = parentEdge?.source;
    const siblingEdges =
      parentId ?
        edges.filter(
          (edge) => edge.source === parentId && edge.target !== clickedNodeId && !isOutputOrInvisibleNode(edge.target),
        )
      : [];
    if (siblingEdges.length === 0) {
      const updatedNodes = nodes.map((node) => {
        if (node.id === clickedNodeId) {
          return { ...node, type: "invisibleNode" };
        }
        return node;
      });
      const updatedEdges = edges.map((edge) => {
        if (edge.target === clickedNodeId || connectedOutputNodes.includes(edge.target)) {
          return { ...edge, animated: false };
        }
        return edge;
      });
      setNodes(updatedNodes);
      setEdges(updatedEdges);
    } else {
      const nodesToRemove = [clickedNodeId, ...connectedOutputNodes];
      const remainingNodes = nodes.filter((node) => !nodesToRemove.includes(node.id));
      const remainingEdges = edges.filter(
        (edge) => !nodesToRemove.includes(edge.source) && !nodesToRemove.includes(edge.target),
      );
      setNodes(remainingNodes);
      setEdges(remainingEdges);
    }
    void GraphApiManager.storeEventTree(
      EventTreeState({
        eventTreeId,
        nodes: getNodes(),
        edges: getEdges(),
        functionalEvents,
      }),
    );
  };
  return deleteNode;
}
export default useDeleteNodeClick;
