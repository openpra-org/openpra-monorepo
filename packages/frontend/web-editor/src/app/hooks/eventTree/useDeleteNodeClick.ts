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

    let shouldDeleteSubtree = true;
    const nodesToDelete = new Set([clickedNodeId]);
    const stack = [clickedNodeId];
    let parentNodeId: string | null = null;

    while (stack.length > 0 && shouldDeleteSubtree) {
      const nodeId = stack.pop();
      edges.forEach((edge) => {
        if (nodeId === clickedNodeId && edge.target === nodeId) {
          parentNodeId = edge.source; // Find the parent node ID
        }
        if (edge.source === nodeId) {
          const targetNode = nodes.find((node) => node.id === edge.target);
          if (targetNode && targetNode.type === "visibleNode") {
            shouldDeleteSubtree = false;
          } else {
            stack.push(edge.target);
            nodesToDelete.add(edge.target);
          }
        }
      });
    }

    if (shouldDeleteSubtree && parentNodeId) {
      // Identify sibling node by checking the parent node's edges
      const siblingEdges = edges.filter(
        (edge) => edge.source === parentNodeId && edge.target !== clickedNodeId,
      );
      if (siblingEdges.length === 1) {
        // Update the sibling node to invisibleNode if there's exactly one sibling
        const siblingNodeId = siblingEdges[0].target;
        nodes.forEach((node) => {
          if (node.id === siblingNodeId) {
            node.type = "invisibleNode"; // TypeScript will not show an error if 'type' is a valid property of Node
          }
        });
        edges.forEach((edge) => {
          if (edge.target === siblingNodeId) {
            edge.animated = true; // Animate edges connected to the sibling node
          }
        });
      }

      // Delete the node and its subtree
      const remainingNodes = nodes.filter(
        (node) => !nodesToDelete.has(node.id),
      );
      const remainingEdges = edges.filter(
        (edge) =>
          !nodesToDelete.has(edge.source) && !nodesToDelete.has(edge.target),
      );

      setNodes(remainingNodes);
      setEdges(remainingEdges);

      const eventTreeCurrentState: EventTreeGraph = EventTreeState({
        eventTreeId: eventTreeId,
        nodes: remainingNodes,
        edges: remainingEdges,
      });

      void GraphApiManager.storeEventTree(eventTreeCurrentState).then(
        (r: EventTreeGraph) => {
          console.log(r);
        },
      );
    } else {
      // Update clicked node to invisibleNode and animate edges
      const updatedNodes = nodes.map((node) => {
        if (node.id === clickedNodeId) {
          return { ...node, type: "invisibleNode" };
        }
        return node;
      });

      const updatedEdges = edges.map((edge) => {
        if (edge.target === clickedNodeId) {
          return { ...edge, animated: true };
        }
        return edge;
      });

      setNodes(updatedNodes);
      setEdges(updatedEdges);

      const eventTreeCurrentState: EventTreeGraph = EventTreeState({
        eventTreeId: eventTreeId,
        nodes: updatedNodes,
        edges: updatedEdges,
      });

      void GraphApiManager.storeEventTree(eventTreeCurrentState).then(
        (r: EventTreeGraph) => {
          console.log(r);
        },
      );
    }
  };

  return deleteNode;
}

export default useDeleteNodeClick;
