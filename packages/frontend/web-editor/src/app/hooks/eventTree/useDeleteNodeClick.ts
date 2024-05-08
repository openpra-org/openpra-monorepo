import { Edge, Node, NodeProps, useReactFlow } from "reactflow";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { useParams } from "react-router-dom";
import { EventTreeState } from "../../../utils/treeUtils";
import { UseGlobalStore } from "../../zustand/Store";

/**
 * Custom hook for handling the deletion of a node and its descendants in a React Flow graph.
 * @param clickedNodeId The ID of the node that was clicked for deletion.
 * @returns A function that performs the deletion when called.
 */
function useDeleteNodeClick(
  clickedNodeId: NodeProps["id"],
  nodes: Node[],
  edges: Edge[],
) {
  let finalNodes = nodes;
  let finalEdges = edges;

  const stack = [clickedNodeId];
  const parentId = edges.find((edge) => edge.target === clickedNodeId)?.source;
  const parentEdges = edges.filter(
    (edge) => edge.source === parentId && edge.target !== clickedNodeId,
  );
  const siblingNodes = parentEdges.map((edge) => edge.target);
  const nodesToDelete = new Set([clickedNodeId]);
  while (stack.length > 0) {
    const nodeId = stack.pop();
    edges.forEach((edge) => {
      if (edge.source === nodeId) {
        stack.push(edge.target);
        nodesToDelete.add(edge.target);
      }
    });
  }

  finalEdges = edges.filter(
    (edge) =>
      !nodesToDelete.has(edge.source) && !nodesToDelete.has(edge.target),
  );

  finalNodes = nodes.filter((node) => !nodesToDelete.has(node.id));
  if (siblingNodes.length === 1) {
    finalNodes = finalNodes.map((node) => {
      if (siblingNodes.includes(node.id)) {
        return { ...node, type: "invisibleNode" };
      }
      return node;
    });
    finalEdges = finalEdges.map((edge) => {
      if (edge.source === parentId) {
        return { ...edge, animated: true };
      }
      return edge;
    });
  }

  return { newNodes: finalNodes, newEdges: finalEdges };
}

export default useDeleteNodeClick;
