import { Edge, Node, NodeProps, useReactFlow } from "reactflow";
import { useParams } from "react-router-dom";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { EventTreeData } from "shared-types/src/lib/types/reactflowGraph/graphData/EventTreeData";
import { checkAndCleanWithSemver } from "@nx/devkit/src/utils/semver";
import { update } from "lodash";
import { EventTreeState } from "../../../utils/treeUtils";

function useOnNodeClick(clickedNodeId: NodeProps["id"]) {
  const { setEdges, setNodes, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as { eventTreeId: string };

  const deleteNode = () => {
    const nodes: Node<EventTreeData>[] = getNodes();
    const edges = getEdges();

    // Identify edges for animation
    const edgeToAnimateIds = new Set();

    const clickedNode = nodes.find((node) => node.id === clickedNodeId);
    if (clickedNode && !clickedNode.data.isDelete) {
      return;
    }
    const columnNode: Node<EventTreeData> | undefined = nodes.find(
      (node) =>
        clickedNode &&
        node.data.depth === clickedNode.data.depth - 1 &&
        node.type === "columnNode",
    );

    const parentId = edges.find((edge) => edge.target === clickedNodeId)
      ?.source;

    if (columnNode?.data.isTentative) {
      if (
        !columnNode.data.tentativeDeleteNodes?.find((node) => node === parentId)
      ) {
        return;
      }
      const tentativeNodes = columnNode.data.tentativeDeleteNodes.filter(
        (node) => node !== parentId,
      );

      // Use a Set to keep track of all nodes in the clicked node's subtree
      const nodesToRetain = new Set();

      // Perform DFS from the parent node, if it exists

      const stack = [clickedNodeId];
      while (stack.length > 0) {
        const nodeId = stack.pop();

        if (nodeId && !nodesToRetain.has(nodeId)) {
          nodesToRetain.add(nodeId);
          edges.forEach((edge) => {
            if (edge.source === nodeId) {
              stack.push(edge.target);
            }
          });
        }
      }

      let updatedNodes = nodes.map((node: Node<EventTreeData>) => {
        if (nodesToRetain.has(node.id)) {
          if (node.id === clickedNodeId) {
            return {
              ...node,
              type: "invisibleNode",
              data: { ...node.data, isTentative: false },
            };
          }
          return { ...node, data: { ...node.data, isTentative: false } }; // Outside the subtree
        }

        if (node.id === columnNode.id) {
          return {
            ...node,
            data: {
              ...node.data,
              tentativeDeleteNodes: tentativeNodes,
            },
          };
        }
        return node;
      });
      let updatedEdges = edges.map((edge) => {
        // Check if the edge needs to be animated and is not marked for deletion
        if (edge.target === clickedNodeId) {
          // Return a new edge object with animated set to true
          return { ...edge, animated: true };
        }
        // Return the edge as-is if it doesn't need to be animated
        return edge;
      });

      if (tentativeNodes && tentativeNodes.length === 0) {
        // Find all nodes that are marked as tentative
        const nodesToRemove = updatedNodes.filter(
          (node) => node.data.isTentative === true,
        );

        const nodeIdsToRemove = new Set(nodesToRemove.map((node) => node.id));

        const colTreeNodes = updatedNodes.filter(
          (node) =>
            node.type !== "columnNode" &&
            node.data.depth === columnNode.data.depth,
        );
        const colTreeNodeIds = new Set(colTreeNodes.map((n) => n.id));

        // Remove these nodes from the nodes array
        updatedNodes = updatedNodes.filter(
          (node) => !nodeIdsToRemove.has(node.id),
          // && !colTreeNodeIds.has(node.id),
        );

        // const tempUpdatedEdges = [...updatedEdges]; // Create a shallow copy to accumulate updates

        // colTreeNodes.forEach((node) => {
        //   tempUpdatedEdges = tempUpdatedEdges
        //     .map((edge) => {
        //       if (edge.target === node.id) {
        //         // Update the target of the edge to be clickedNodeId
        //         console.log(colTreeNodes);
        //         return {
        //           ...edge,
        //           target:
        //             updatedEdges.find((edge) => edge.source === node.id)
        //               ?.target ?? "",
        //         };
        //       }
        //       return edge; // No change for this edge
        //     })
        //     .filter((edge) => edge.source !== node.id);
        // });

        // Now tempUpdatedEdges holds the updated edges
        // updatedEdges = tempUpdatedEdges;
        updatedEdges = updatedEdges.filter(
          (edge) =>
            // Now, filter out the edges connected to nodes marked for deletion
            !nodeIdsToRemove.has(edge.source) &&
            !nodeIdsToRemove.has(edge.target),
        );

        console.log(updatedEdges);
        // Update the React Flow state with the modifications
        setNodes(updatedNodes);
        setEdges(updatedEdges);
      } else {
        setNodes(updatedNodes);
        setEdges(updatedEdges);
      }

      // // Optionally, save the updated tree state
      // const eventTreeCurrentState: EventTreeGraph = EventTreeState({
      //   eventTreeId: eventTreeId,
      //   nodes: updatedNodes,
      //   edges: updatedEdges,
      // });
      //
      // void GraphApiManager.storeEventTree(eventTreeCurrentState).then(
      //   (r: EventTreeGraph) => {
      //     console.log("Updated Event Tree:", r);
      //   },
      // );
    }
  };

  return deleteNode;
}

function deleteSubtree(nodes: Node[], edges: Edge[], clickedNodeId: string) {
  let parentNodeId = "";
  // Identify edges for animation
  const edgeToAnimateIds = new Set();

  // Find the parent of the clicked node and edges to animate
  edges.forEach((edge) => {
    if (edge.target === clickedNodeId) {
      parentNodeId = edge.source; // Find the parent node ID
      edgeToAnimateIds.add(edge.id); // Add the connecting edge for animation
    }
    if (edge.source === parentNodeId) {
      edgeToAnimateIds.add(edge.id); // Add edges originating from the parent node
    }
  });

  // Use a Set to keep track of all nodes in the clicked node's subtree
  const nodesToRetain = new Set([clickedNodeId]);
  const nodesToDelete = new Set();
  // Perform DFS from the parent node, if it exists

  const stack = [parentNodeId];
  while (stack.length > 0) {
    const nodeId = stack.pop();
    if (nodeId && nodeId !== clickedNodeId && !nodesToRetain.has(nodeId)) {
      // Exclude clicked node and its subtree
      if (nodeId !== parentNodeId) {
        nodesToDelete.add(nodeId);
      }
      edges.forEach((edge) => {
        if (edge.source === nodeId) {
          stack.push(edge.target);
        }
      });
    }
  }

  // Filter nodes to retain only the clicked node's subtree and set visibility
  const updatedNodes = nodes
    .map((node) => {
      if (node.id === clickedNodeId || node.id === parentNodeId) {
        return {
          ...node,
          type: "invisibleNode",
          data: { ...node.data, isTentative: false },
        }; // Set clicked and parent node to invisible
      } else if (!nodesToDelete.has(node.id)) {
        return { ...node, data: { ...node.data, isTentative: false } }; // Outside the subtree
      }
      return null; // Prepare to filter out
    })
    .filter((node) => node !== null) as Node[];

  const updatedEdges = edges
    .map((edge) => {
      // Check if the edge needs to be animated and is not marked for deletion
      if (edgeToAnimateIds.has(edge.id)) {
        // Return a new edge object with animated set to true
        return { ...edge, animated: true };
      }
      // Return the edge as-is if it doesn't need to be animated
      return edge;
    })
    .filter(
      (edge) =>
        // Now, filter out the edges connected to nodes marked for deletion
        !nodesToDelete.has(edge.source) && !nodesToDelete.has(edge.target),
    );

  return { updatedNodes, updatedEdges };
}

export default useOnNodeClick;
