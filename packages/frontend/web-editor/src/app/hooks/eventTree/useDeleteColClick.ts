import { NodeProps, EdgeProps, useReactFlow } from "reactflow";
import { useParams } from "react-router-dom";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { EventTreeState } from "../../../utils/treeUtils";

function useDeleteColClick(clickedNodeId: NodeProps["id"]) {
  const { setNodes, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as { eventTreeId: string };

  const deleteNode = () => {
    const nodes = getNodes();
    const edges = getEdges();

    const immediateConnectedNodes = new Set(); // To keep track of immediate connected nodes

    const clickedNode = nodes.find((node) => node.id === clickedNodeId);

    if (!clickedNode || clickedNode.type !== "columnNode") return;

    const targetDepth = clickedNode.data.depth;
    const nodesToEvaluate = nodes.filter(
      (node) => node.data.depth === targetDepth && node.type !== "columnNode",
    );

    const nodesRelated = new Set();
    let shouldDeleteSubtree = true;
    nodesToEvaluate.forEach((node) => {
      const stack = [node.id];

      while (stack.length > 0) {
        const nodeId = stack.pop();
        edges.forEach((edge) => {
          if (edge.source === nodeId) {
            const targetNode = nodes.find((n) => n.id === edge.target);
            if (targetNode && targetNode.type === "visibleNode") {
              shouldDeleteSubtree = false;
            }
            if (!nodesRelated.has(edge.target)) {
              stack.push(edge.target);
              nodesRelated.add(edge.target);
              if (edge.source === node.id) {
                // If this is an immediate connection from the clicked node
                immediateConnectedNodes.add(edge.target);
              }
            }
          }
        });
      }
    });

    if (!shouldDeleteSubtree) {
      // Update nodes based on shouldDeleteSubtree and immediate deletion flags
      const updatedNodes = nodes.map((node) => {
        if (nodesRelated.has(node.id)) {
          // Mark subtree nodes as tentative if shouldDeleteSubtree is false
          const update = {
            ...node,
            data: { ...node.data, isTentative: !shouldDeleteSubtree },
          };
          if (immediateConnectedNodes.has(node.id)) {
            // Additionally, mark immediate nodes with isDelete = true
            update.data.isDelete = true;
          }
          return update;
        }
        if (node.type === "columnNode" && node.id === clickedNodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              isTentative: true,
              tentativeDeleteNodes: nodesToEvaluate.map((node) => node.id),
            },
          };
        }
        return node;
      });

      setNodes(updatedNodes);
    }
  };

  return deleteNode;
}

export default useDeleteColClick;
