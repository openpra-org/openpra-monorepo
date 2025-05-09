import { Edge, NodeProps, Node, useReactFlow } from "reactflow";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { useParams } from "react-router-dom";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { EventTreeState, GenerateUUID } from "../../../utils/treeUtils";
import { UseToastContext } from "../../providers/toastProvider";

function useCreateColClick(clickedNodeId: NodeProps["id"]) {
  const { setNodes, setEdges, getNodes, getEdges, getNode } = useReactFlow();
  const { eventTreeId } = useParams() as { eventTreeId: string };
  const { addToast } = UseToastContext();

  const addCol = () => {
    // Get current nodes and edges
    const nodeData = getNodes();
    let edges = getEdges();
    const clickedNode = getNode(clickedNodeId);
    if (!clickedNode) return;

    const currentDepth = clickedNode.data.depth;

    // Check if there are any visible nodes in the clicked column
    const hasVisibleNodesInCurrentColumn = nodeData.some(
      (node) => node.type !== "columnNode" && node.type !== "invisibleNode" && node.data.depth === currentDepth,
    );

    // if (!hasVisibleNodesInCurrentColumn) {
    //   addToast({
    //     id: GenerateUUID(),
    //     title: "Warning",
    //     color: "warning",
    //     text: "At least one branch should exist in the current functional event to create a new one",
    //   });
    //   return;
    // }

    // Get nodes in the next column
    const nextColumnNodes = nodeData.filter(
      (node) => node.type !== "columnNode" && node.data.depth === currentDepth + 1,
    );

    // Check if next column has only invisible nodes (no output nodes)
    const hasOnlyInvisibleNodes =
      nextColumnNodes.length > 0 && nextColumnNodes.every((node) => node.type === "invisibleNode");

    if (hasOnlyInvisibleNodes) {
      addToast({
        id: GenerateUUID(),
        title: "Warning",
        color: "warning",
        text: "Cannot create a new functional event with an existing empty functional event",
      });
      return;
    }

    // splitting the nodeData into nodes and columns
    const nodes: Node[] = [];
    const cols: Node[] = [];

    nodeData.forEach((node) => {
      if (node.type === "columnNode") {
        cols.push(node);
      } else {
        nodes.push(node);
      }
    });

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    let lastIndexOfPrevDepth = -1;
    let indexOfPrevCol = -1;
    const clickedNodeEdge = edges.find((edge) => edge.source === clickedNodeId);

    const clickedDepth = clickedNode.data.depth;

    // Determine the last index of the nodes with the previous depth
    nodes.forEach((node, index) => {
      if (node.data.depth === clickedDepth) {
        lastIndexOfPrevDepth = index;
      } else if (node.data.depth > clickedDepth) {
        node.data.depth = node.data.depth + 1;
      }
    });

    // Create new nodes for each node at the clicked depth
    nodes.forEach((node, index) => {
      if (node.data.depth === clickedDepth) {
        const newNodeId = GenerateUUID();
        const nodeEdge = edges.find((edge) => edge.source === node.id)!;
        const newInvisibleNode: Node = {
          id: newNodeId,
          type: clickedNode.data.output ? "outputNode" : "invisibleNode",
          data: {
            label: "New Node",
            depth: clickedDepth + 1,
            width: node.data.width,
          },
          position: {
            x: node.position.x, // Adjust based on layout
            y: node.position.y,
          },
        };

        newNodes.push(newInvisibleNode);

        // Connect the original node to the new node
        // Create and add the new edge

        edges.forEach((edge) => {
          if (edge.source === node.id) {
            newEdges.push({
              id: `${newNodeId}-${edge.target}`,
              source: newNodeId,
              target: edge.target,
              type: "custom",
              animated: false,
            });
          }
        });
        newEdges.push({
          id: `${node.id}-${newNodeId}`,
          source: node.id,
          target: newNodeId,
          type: "custom",
          animated: false,
        });

        edges = edges.filter((e) => e.source !== node.id);
      }
    });

    // Create a new "columnNode" and determine its insertion point
    const newColNodeId = GenerateUUID();

    const newColNode: Node = {
      id: newColNodeId,
      type: "columnNode",
      data: {
        label: clickedNode.data.output ? `End State ` : `Functional Event `,
        depth: clickedDepth + 1,
        width: clickedNode.data.width,
        output: clickedNode.data.output,
        allowAdd: true,
        // allowDelete: !clickedNode.data.output && clickedDepth + 1 !== 1 && clickedDepth + 1 !== 2 && true,
        allowDelete: !clickedNode.data.output && clickedDepth + 1 !== 1,
      },
      position: {
        x: clickedNode ? clickedNode.position.x : 0,
        y: clickedNode ? clickedNode.position.y : 0,
      },
    };

    const newColEdges: Edge[] = [
      {
        id: `${clickedNodeId}-${newColNodeId}`,
        source: clickedNodeId,
        target: newColNodeId,
        type: "custom",
        animated: false,
        data: {
          hidden: true,
        },
      },
      {
        id: clickedNodeEdge ? `${newColNodeId}-${clickedNodeEdge.target}` : "",
        source: newColNodeId,
        target: clickedNodeEdge ? clickedNodeEdge.target : "",
        type: "custom",
        animated: false,
        data: {
          hidden: true,
        },
      },
    ];

    edges = edges.filter((e) => e.source !== clickedNodeId).concat([...newColEdges, ...newEdges]);

    // Determine the index of the col with the previous depth
    cols.forEach((node, index) => {
      if (node.data.depth === clickedDepth) {
        indexOfPrevCol = index;
      } else if (node.data.depth > clickedDepth) {
        node.data.depth = node.data.depth + 1;
      }
    });

    // Insert new nodes at the determined point
    nodes.splice(lastIndexOfPrevDepth + 1, 0, ...newNodes);
    cols.splice(indexOfPrevCol + 1, 0, newColNode);

    // Find the root node
    const rootNode = nodes.find((node) => node.data.depth === 1)!;
    if (clickedNode.data.output) {
      rootNode.data.outputDepth += 1;
    } else {
      rootNode.data.inputDepth += 1;
    }
    const updatedNodes = [...nodes, ...cols];
    // Update edges with new connection
    setNodes(updatedNodes);
    setEdges(edges);

    const eventTreeCurrentState: EventTreeGraph = EventTreeState({
      eventTreeId: eventTreeId,
      nodes: updatedNodes,
      edges: edges,
    });

    void GraphApiManager.storeEventTree(eventTreeCurrentState).then((r: EventTreeGraph) => {});
  };
  return addCol;
}

export default useCreateColClick;
