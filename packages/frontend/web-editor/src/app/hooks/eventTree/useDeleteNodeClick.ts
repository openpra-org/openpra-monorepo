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
    const nodesToDelete = new Set();
    const immediateConnectedNodes = new Set(); // To keep track of immediate connected nodes

    const stack = [clickedNodeId];
    let parentNodeId: string | null = null;

    while (stack.length > 0) {
      const nodeId = stack.pop();
      edges.forEach((edge) => {
        if (nodeId === clickedNodeId && edge.target === nodeId) {
          parentNodeId = edge.source; // Find the parent node ID
        }
        if (edge.source === nodeId) {
          const targetNode = nodes.find((node) => node.id === edge.target);
          if (targetNode && targetNode.type === "visibleNode") {
            shouldDeleteSubtree = false;
          }
          if (!nodesToDelete.has(edge.target)) {
            // Check to prevent re-adding a node {
            stack.push(edge.target);
            nodesToDelete.add(edge.target);
            if (edge.source === clickedNodeId) {
              // If this is an immediate connection from the clicked node
              immediateConnectedNodes.add(edge.target);
            }
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
        edges: edges,
      });

      void GraphApiManager.storeEventTree(eventTreeCurrentState).then(
        (r: EventTreeGraph) => {
          console.log(r);
        },
      );
    } else {
      // Update nodes based on shouldDeleteSubtree and immediate deletion flags
      const updatedNodes = nodes.map((node) => {
        if (nodesToDelete.has(node.id)) {
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
        return node;
      });

      setNodes(updatedNodes);

      const eventTreeCurrentState: EventTreeGraph = EventTreeState({
        eventTreeId: eventTreeId,
        nodes: updatedNodes,
        edges: edges,
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
