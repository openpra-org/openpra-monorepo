import { NodeProps, EdgeProps, useReactFlow, Edge } from "reactflow";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { useParams } from "react-router-dom";
import { EventTreeState } from "../../../utils/treeUtils";

function useDeleteNodeClick(clickedNodeId: NodeProps["id"]) {
  const { setEdges, setNodes, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as { eventTreeId: string };

  const deleteNode = () => {
    const nodes = getNodes();
    const edges = getEdges();

    let finalNodes = nodes;
    let finalEdges = edges;

    const stack = [clickedNodeId];
    const parentId = edges.find((edge) => edge.target === clickedNodeId)
      ?.source;
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

    setNodes(finalNodes);
    setEdges(finalEdges);
    const eventTreeCurrentState: EventTreeGraph = EventTreeState({
      eventTreeId: eventTreeId,
      nodes: finalNodes,
      edges: finalEdges,
    });

    void GraphApiManager.storeEventTree(eventTreeCurrentState).then(
      (r: EventTreeGraph) => {
        console.log(r ? "saved" : "error");
      },
    );
  };

  return deleteNode;
}

export default useDeleteNodeClick;
