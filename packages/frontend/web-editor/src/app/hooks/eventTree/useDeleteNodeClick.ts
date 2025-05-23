import { useParams } from "react-router-dom";
import { NodeProps, useReactFlow } from "reactflow";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";

import { EventTreeState, GenerateUUID } from "../../../utils/treeUtils";
import { UseToastContext } from "../../providers/toastProvider";

function useDeleteNodeClick(clickedNodeId: NodeProps["id"]) {
  const { setEdges, setNodes, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as { eventTreeId: string };
  const { addToast } = UseToastContext();

  const deleteNode = () => {
    const nodes = getNodes();
    const edges = getEdges();

    // Get the node to be deleted
    const nodeToDelete = nodes.find((node) => node.id === clickedNodeId);
    if (!nodeToDelete) return;

    // Find the root node
    const rootNode = nodes.find((node) => node.data.depth === 1);
    if (!rootNode) return;

    // Find the first two nodes that were connected to root
    // We can use edges to determine this as the first two edges from root
    // would have been to Success and Failure nodes
    const rootEdges = edges
      .filter((edge) => edge.source === rootNode.id)
      .sort((a, b) => {
        // Sort by creation time if you have it in edge data
        // or by edge ID which might preserve creation order
        return a.id.localeCompare(b.id);
      });

    // Get the first two target node IDs (original Success/Failure nodes)
    const originalNodeIds = rootEdges.slice(0, 2).map((edge) => edge.target);

    // Check if the node to delete is one of the original nodes
    if (originalNodeIds.includes(clickedNodeId)) {
      addToast({
        id: GenerateUUID(),
        title: "Warning",
        color: "warning",
        text: "Cannot delete the original nodes of the first functional event.",
      });
      return;
    }

    // Helper function to check if a node is an output node or invisible node
    const isOutputOrInvisibleNode = (nodeId: string): boolean => {
      const node = nodes.find((n) => n.id === nodeId);
      return node?.type === "outputNode" || node?.type === "invisibleNode";
    };

    // Get all connected output nodes that need to be deleted
    const getConnectedOutputNodes = (nodeId: string): string[] => {
      const outputNodes: string[] = [];
      const stack = [nodeId];

      while (stack.length > 0) {
        const currentId = stack.pop()!;
        const connectedNodes = edges
          .filter((edge) => edge.source === currentId && isOutputOrInvisibleNode(edge.target))
          .map((edge) => edge.target);

        outputNodes.push(...connectedNodes);
        stack.push(...connectedNodes);
      }

      return outputNodes;
    };

    // Check if node has non-output, non-invisible children
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

    // Get all output nodes that need to be handled
    const connectedOutputNodes = getConnectedOutputNodes(clickedNodeId);

    // Find siblings (if any)
    const parentEdge = edges.find((edge) => edge.target === clickedNodeId);
    const parentId = parentEdge?.source;
    const siblingEdges =
      parentId ?
        edges.filter(
          (edge) => edge.source === parentId && edge.target !== clickedNodeId && !isOutputOrInvisibleNode(edge.target),
        )
      : [];

    if (siblingEdges.length === 0) {
      // No siblings - convert to invisible node
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
      // Has siblings - remove node and its output nodes completely
      const nodesToRemove = [clickedNodeId, ...connectedOutputNodes];
      const remainingNodes = nodes.filter((node) => !nodesToRemove.includes(node.id));
      const remainingEdges = edges.filter(
        (edge) => !nodesToRemove.includes(edge.source) && !nodesToRemove.includes(edge.target),
      );

      setNodes(remainingNodes);
      setEdges(remainingEdges);
    }

    // Store the updated state
    void GraphApiManager.storeEventTree(
      EventTreeState({
        eventTreeId,
        nodes: getNodes(),
        edges: getEdges(),
      }),
    );
  };

  return deleteNode;
}

export default useDeleteNodeClick;
