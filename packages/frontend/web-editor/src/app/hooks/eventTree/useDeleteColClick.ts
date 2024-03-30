import { NodeProps, EdgeProps, useReactFlow, Edge } from "reactflow";
import { useParams } from "react-router-dom";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { set } from "lodash";
import { EventTreeState, GenerateUUID } from "../../../utils/treeUtils";

function useDeleteColClick(clickedNodeId: NodeProps["id"]) {
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as { eventTreeId: string };

  const deleteNode = () => {
    const nodes = getNodes();
    const edges = getEdges();

    const immediateConnectedNodes = new Set(); // To keep track of immediate connected nodes

    const clickedNode = nodes.find((node) => node.id === clickedNodeId);

    if (!clickedNode || clickedNode.type !== "columnNode") return;

    const targetDepth = clickedNode.data.depth;
    const nodesToEvaluate = nodes.filter((node) => {
      if (node.data.depth === targetDepth && node.type !== "columnNode") {
        const edge = edges.filter((edge) => edge.source === node.id);
        return edge.length > 1;
      }
    });

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
    if (shouldDeleteSubtree) {
      const nodesToEvaluate = nodes.filter(
        (node) => node.data.depth === targetDepth && node.type !== "columnNode",
      );

      const newEdges: Edge[] = [];
      nodesToEvaluate.forEach((node) => {
        const leftEdge = edges.find((edge) => edge.target === node.id);
        const rightEdge = edges.find((edge) => edge.source === node.id);
        const newEdge: Edge[] = [
          {
            id: GenerateUUID(),
            source: leftEdge?.source ?? "",
            target: rightEdge?.target ?? "",
            type: "custom",
            animated: rightEdge?.animated,
          },
        ];
        newEdges.concat(newEdge);
      });
      console.log(nodesToEvaluate);
      const nodesToEvaluateId: string[] = nodesToEvaluate.map(
        (node) => node.id,
      );
      const updatedEdges = edges
        .filter(
          (edge) =>
            !nodesToEvaluateId.includes(edge.source) &&
            !nodesToEvaluateId.includes(edge.target),
        )
        .concat(newEdges); // Add the new edges to the updated edges list

      const updatedNodes = nodes.filter(
        (node) => !nodesToEvaluateId.includes(node.id),
      );
      setNodes(updatedNodes);
      setEdges(updatedEdges);
    } else {
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
