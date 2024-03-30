import { Edge, Node, NodeProps, useReactFlow } from "reactflow";
import { useParams } from "react-router-dom";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { EventTreeData } from "shared-types/src/lib/types/reactflowGraph/graphData/EventTreeData";
import { checkAndCleanWithSemver } from "@nx/devkit/src/utils/semver";
import { update } from "lodash";
import { EventTreeState, GenerateUUID } from "../../../utils/treeUtils";

function useOnNodeClick(clickedNodeId: NodeProps["id"]) {
  const { setEdges, setNodes, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as { eventTreeId: string };

  const deleteNode = () => {
    const nodes: Node<EventTreeData>[] = getNodes();
    const edges = getEdges();
    let finalNodes;
    let finalEdges;

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

    if (columnNode?.data.isTentative) {
      if (
        !columnNode.data.tentativeDeleteNodes?.find((node) => node === parentId)
      ) {
        return;
      }
      const tentativeNodes = columnNode.data.tentativeDeleteNodes.filter(
        (node) => node !== parentId,
      );

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

        const colIdsToRemove: string[] = [];
        // If the column node exists, add its ID and the IDs of all corresponding tree nodes at the same depth
        if (columnNode) {
          colIdsToRemove.push(columnNode.id);

          // Find and add all tree nodes at the same depth as the column node
          updatedNodes.forEach((node) => {
            if (
              node.data.depth === columnNode.data.depth &&
              node.type !== "columnNode"
            ) {
              colIdsToRemove.push(node.id);
            }
          });
        }

        // Initialize an array to store new edges
        const newEdges: Edge[] = [];

        // Step 1: Create new edges bypassing nodes in colIdsToRemove
        colIdsToRemove.forEach((colId) => {
          // Find the parent node ID for the current node
          const parentNodeId = updatedEdges.find(
            (edge) => edge.target === colId,
          )?.source;
          if (!parentNodeId) return; // Skip if no parent found

          // Identify the single child node directly connected and not in nodeIdsToRemove
          const childNode = updatedEdges.find(
            (edge) =>
              edge.source === colId && !nodeIdsToRemove.has(edge.target),
          );

          // If a valid child node is found, create a new edge from the parent to this child
          if (childNode) {
            const newEdge = {
              id: GenerateUUID(),
              source: parentNodeId,
              target: childNode.target,
              type: "custom",
              animated: true,
            }; // Assuming these new edges should be animated
            newEdges.push(newEdge);
          }
        });

        // Step 2: Remove edges that are connected to nodes in colIdsToRemove and nodeIdsToRemove
        updatedEdges = updatedEdges
          .filter(
            (edge) =>
              !colIdsToRemove.includes(edge.source) &&
              !colIdsToRemove.includes(edge.target) &&
              !nodeIdsToRemove.has(edge.source) &&
              !nodeIdsToRemove.has(edge.target),
          )
          .concat(newEdges); // Add the new edges to the updated edges list

        // Step 3: Remove nodes in colIdsToRemove and nodeIdsToRemove from updatedNodes
        updatedNodes = updatedNodes.filter(
          (node) =>
            !colIdsToRemove.includes(node.id) && !nodeIdsToRemove.has(node.id),
        );

        // // IMP STEP check if there are multiple animated links
        // Filter parent nodes as per your existing logic
        // const parentNodes = updatedNodes.filter(
        //   (node) =>
        //     clickedNode &&
        //     node.data.depth === clickedNode.data.depth - 2 &&
        //     node.type !== "columnNode",
        // );
        //
        // parentNodes.forEach((parentNode) => {
        //   // Find edges leading from the parent to invisible nodes
        //   const edgesToInvisibleNodes = updatedEdges.filter((edge) =>
        //     updatedNodes.find(
        //       (node) =>
        //         node.id === edge.target && node.type === "invisibleNode",
        //     ),
        //   );
        //
        //   if (edgesToInvisibleNodes.length > 1) {
        //     // Create a new consolidated invisible node
        //     const newNodeId = GenerateUUID();
        //     const newNode = {
        //       id: newNodeId,
        //       type: "invisibleNode",
        //       data: {
        //         label: `Node ${newNodeId}`,
        //         depth: parentNode.data.depth + 1, // Assuming depth is relevant here
        //         output: false,
        //         width: 140,
        //         // Additional properties as needed
        //       },
        //       position: {
        //         x: parentNode.position.x + 100,
        //         y: parentNode.position.y,
        //       }, // Example positioning
        //     };
        //     updatedNodes.push(newNode);
        //
        //     // Create a new edge from the parent node to the new invisible node
        //     const newEdgeToNewNode = {
        //       id: GenerateUUID(),
        //       source: parentNode.id,
        //       target: newNodeId,
        //       animated: true,
        //       type: "custom",
        //     };
        //     updatedEdges.push(newEdgeToNewNode);
        //
        //     // For each old invisible node, redirect its daughter nodes to the new invisible node
        //     edgesToInvisibleNodes.forEach((edge) => {
        //       const daughterEdges = updatedEdges.filter(
        //         (e) => e.source === edge.target,
        //       );
        //
        //       daughterEdges.forEach((daughterEdge) => {
        //         // Create a new edge from the new invisible node to the daughter node
        //         const newEdge = {
        //           id: GenerateUUID(),
        //           source: newNodeId,
        //           target: daughterEdge.target,
        //           animated: true,
        //           type: "custom",
        //         };
        //         updatedEdges.push(newEdge);
        //       });
        //
        //       // Remove the old edge from parent to the invisible node
        //       updatedEdges = updatedEdges.filter((e) => e.id !== edge.id);
        //       // Remove edges from the invisible node to its daughters
        //       updatedEdges = updatedEdges.filter(
        //         (e) => e.source !== edge.target,
        //       );
        //     });
        //
        //     // Remove the old invisible nodes
        //     updatedNodes = updatedNodes.filter(
        //       (node) =>
        //         !edgesToInvisibleNodes.find((edge) => edge.target === node.id),
        //     );
        //   }
        // });
        finalNodes = updatedNodes;
        finalEdges = updatedEdges;
        // Update the React Flow state with the modifications
        setNodes(updatedNodes);
        setEdges(updatedEdges);
      } else {
        finalNodes = updatedNodes;
        finalEdges = updatedEdges;
        setNodes(updatedNodes);
        setEdges(updatedEdges);
      }
    } else {
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
        return node;
      });
      // Find all nodes that are marked as tentative
      const nodesToRemove = updatedNodes.filter(
        (node) => node.data.isTentative === true,
      );

      const nodeIdsToRemove = new Set(nodesToRemove.map((node) => node.id));
      updatedNodes = updatedNodes.filter(
        (node) => !nodeIdsToRemove.has(node.id),
      );

      const updatedEdges = edges
        .filter(
          (edge) =>
            !nodeIdsToRemove.has(edge.source) &&
            !nodeIdsToRemove.has(edge.target),
        )
        .map((edge) => {
          if (edge.target === clickedNodeId) {
            return { ...edge, animated: true };
          }
          return edge;
        });

      finalNodes = updatedNodes;
      finalEdges = updatedEdges;
      // Update the React Flow state with the modifications
      setNodes(updatedNodes);
      setEdges(updatedEdges);
    }
    // Optionally, save the updated tree state
    const eventTreeCurrentState: EventTreeGraph = EventTreeState({
      eventTreeId: eventTreeId,
      nodes: finalNodes,
      edges: finalEdges,
    });

    void GraphApiManager.storeEventTree(eventTreeCurrentState).then(
      (r: EventTreeGraph) => {
        console.log("Updated Event Tree:", r);
      },
    );
  };

  return deleteNode;
}

export default useOnNodeClick;
