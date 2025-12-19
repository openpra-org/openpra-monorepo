import { Edge, Node, NodeProps, useReactFlow } from "reactflow";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { useParams } from "react-router-dom";
import { EventTreeState, GenerateUUID } from "../../../utils/treeUtils";
import { UseToastContext } from "../../providers/toastProvider";

interface EventTreeNodeData {
  depth?: number;
  isSequenceId?: boolean;
}

/**
 * Delete a visible node from the Event Tree while enforcing structural rules.
 *
 * - Prevents deletion if it would reduce the number of Sequence ID nodes below two.
 * - Prevents deletion when non-output/non-invisible child nodes exist.
 * - Converts a leaf to an invisible node when it has no siblings, otherwise removes it and rewires.
 * Persists the updated graph after mutations.
 *
 * @param clickedNodeId - The id of the node to delete.
 * @returns A function that performs the deletion when invoked.
 */
function useDeleteNodeClick(clickedNodeId: NodeProps["id"]): () => void {
  const { setEdges, setNodes, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as { eventTreeId: string };
  const { addToast } = UseToastContext();

  const deleteNode: () => void = () => {
    const nodes = getNodes() as Node<EventTreeNodeData>[];
    const edges = getEdges() as Edge[];

    // Get the node to be deleted
    const nodeToDelete = nodes.find((node) => node.id === clickedNodeId);
    if (!nodeToDelete) return;

    // Find the root node
    const rootNode = nodes.find((node) => node.data.depth === 1);
    if (!rootNode) return;

    // Helper function to check if a node is an output node or invisible node
    const isOutputOrInvisibleNode = (nodeId: string): boolean => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return false;
      return node.type === "outputNode" || node.type === "invisibleNode";
    };

    // Helper function to check if a node is a sequence ID node
    const isSequenceIdNode = (nodeId: string): boolean => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return false;
      return node.type === "outputNode" && node.data.isSequenceId === true;
    };

    // Count sequence ID nodes
    const sequenceIdNodes = nodes.filter((node) => node.type === "outputNode" && node.data.isSequenceId === true);

    // Check if the node we're trying to delete has sequence ID nodes connected to it
    const connectedOutputNodes: string[] = getConnectedOutputNodes(clickedNodeId);
    const connectedSequenceIdNodes: string[] = connectedOutputNodes.filter((nodeId) => isSequenceIdNode(nodeId));

    // If deleting would leave fewer than 2 sequence ID nodes, prevent deletion
    if (sequenceIdNodes.length - connectedSequenceIdNodes.length < 2) {
      addToast({
        id: GenerateUUID(),
        title: "Warning",
        color: "warning",
        text: "Cannot delete this node. At least two sequences must be maintained.",
      });
      return;
    }

    // Get all connected output nodes that need to be deleted
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
