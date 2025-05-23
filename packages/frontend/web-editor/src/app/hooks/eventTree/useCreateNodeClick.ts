import { useParams } from "react-router-dom";
import { Edge, Node, NodeProps, useReactFlow } from "reactflow";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";

import { EventTreeState, GenerateUUID } from "../../../utils/treeUtils";
import { createEndStates } from "./useTreeData";

function useCreateNodeClick(clickedNodeId: NodeProps["id"]) {
  const { setEdges, setNodes, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as { eventTreeId: string };

  const addNode = () => {
    // Get current nodes and edges
    let nodes = getNodes();
    const edges = getEdges();

    // Find the root node
    const rootNode = nodes.find((node) => node.data.depth === 1);

    // Handle potential undefined rootNode
    if (!rootNode) {
      // Handle the case where the root node is not found
      throw new Error("Root node with Level 1 not found");
    }

    // Extract the output depth from the root node
    const [outputLevels, inputLevels] = [rootNode.data?.outputDepth, rootNode.data?.inputDepth] as [number, number];

    const rightmostNodeIndices = findRightmostNodeIndicesAtEachLevel(
      clickedNodeId,
      nodes,
      edges,
      inputLevels,
      outputLevels,
    );

    // Find the clicked node
    const clickedNodeIndex = nodes.findIndex((node) => node.id === clickedNodeId);
    const clickedNode = clickedNodeIndex !== -1 ? nodes[clickedNodeIndex] : null;

    // put the clicked node as activated (for an invisible node)
    if (clickedNode?.type === "invisibleNode") {
      nodes[clickedNodeIndex].type = "visibleNode";

      const idx = edges.findIndex((edge) => edge.target === clickedNodeId);
      edges[idx].animated = false;
    }

    // Find the edge connecting clickedNode and its parent node
    const clickedNodeEdge = edges.find((edge) => edge.target === clickedNodeId);

    // Determine the depth of the new node
    const clickedNodeDepth = clickedNode?.data.depth;

    // Initialize placeholders for new nodes and edges

    const newEdges: Edge[] = [];
    let lastNodeId = clickedNodeEdge ? clickedNodeEdge.source : "";

    rightmostNodeIndices.forEach((rightmostNodeIndex, level) => {
      // Skip invalid levels
      if (level > inputLevels - clickedNodeDepth) return;

      // Generate a new node ID
      const newNodeId = GenerateUUID();

      // Decide the node type based on its level
      const nodeType =
        level === 0 ? "visibleNode"
        : level <= inputLevels - clickedNodeDepth ? "invisibleNode"
        : "outputNode";

      // Create the new node based on the level and type
      const newNode: Node = {
        id: newNodeId,
        type: nodeType,
        data: {
          label: `New Node(${level + clickedNodeDepth})`,
          depth: level + clickedNodeDepth,
          width: rootNode.data.width,
          output: false,
        },
        position: {
          x: clickedNode?.position.x!,
          y: clickedNode?.position.y!,
        },
      };

      nodes = [
        ...nodes.slice(0, rightmostNodeIndex + 1 + level),
        newNode,
        ...nodes.slice(rightmostNodeIndex + 1 + level, nodes.length),
      ];

      // Determine source node for the edge
      const sourceNodeId = lastNodeId;
      lastNodeId = newNodeId;

      // Create and add the new edge
      const newEdge: Edge = {
        id: GenerateUUID(),
        source: sourceNodeId,
        target: newNodeId,
        type: "custom",
        animated: false,
      };

      newEdges.push(newEdge);

      // Replace Output Node Logic with End States
      if (level >= inputLevels - clickedNodeDepth) {
        const { nodes: endNodes, edges: endEdges } = createEndStates(newNode, rootNode.data.width, newNode.position);

        nodes.push(...endNodes);

        // Modify the edges before adding them
        const modifiedEndEdges = endEdges.map((edge) => {
          // Check if both source and target are end states
          const sourceNode = endNodes.find((node) => node.id === edge.source);
          const targetNode = endNodes.find((node) => node.id === edge.target);

          if (sourceNode && targetNode) {
            // If both nodes are end states, make the edge hidden
            return {
              ...edge,
              data: { hidden: true },
            };
          } else {
            // If either node is not an end state (e.g., connection from leaf to first end state)
            return {
              ...edge,
              data: { hidden: false },
            };
          }
        });

        newEdges.push(...modifiedEndEdges);
      }
    });

    // Set nodes and edges with the updated and new elements
    const updatedEdges = edges.concat(newEdges);
    setNodes(nodes);
    setEdges(updatedEdges);

    const eventTreeCurrentState: EventTreeGraph = EventTreeState({
      eventTreeId: eventTreeId,
      nodes: nodes,
      edges: updatedEdges,
    });

    void GraphApiManager.storeEventTree(eventTreeCurrentState).then((r: EventTreeGraph) => {});
  };

  return addNode;
}

export default useCreateNodeClick;

function findRightmostNodeIndicesAtEachLevel(
  clickedNodeId: string,
  nodes: Node[],
  edges: Edge[],
  inputLevel: number,
  outputLevel: number,
): number[] {
  // Find the clicked node to get its depth
  const clickedNode = nodes.find((node) => node.id === clickedNodeId);
  if (!clickedNode) {
    return [];
  }
  const clickedNodeDepth = clickedNode.data.depth;

  // Calculate total depth to explore from the clicked node
  const totalDepth = inputLevel + outputLevel - clickedNodeDepth + 1;
  const rightmostNodeIndices: number[] = new Array(totalDepth).fill(-1);

  // DFS to find rightmost nodes
  function dfs(nodeId: string, currentDepth: number) {
    const node = nodes.find((node) => node.id === nodeId);
    if (!node) return;

    // Calculate the level relative to the clicked node
    const relativeLevel = node.data.depth - clickedNodeDepth;
    if (relativeLevel >= 0 && relativeLevel < totalDepth) {
      const currentIndex = nodes.findIndex((n) => n.id === nodeId); // Check if this node is the rightmost at its level
      if (
        rightmostNodeIndices[relativeLevel] === -1 ||
        node.position.y > nodes[rightmostNodeIndices[relativeLevel]].position.y
      ) {
        rightmostNodeIndices[relativeLevel] = currentIndex;
      }
    }

    // Recurse for children
    const childrenEdges = edges.filter((e) => e.source === nodeId);
    childrenEdges.forEach((edge) => {
      dfs(edge.target, currentDepth + 1);
    });
  }

  // Start DFS from the clicked node
  dfs(clickedNodeId, clickedNodeDepth);

  return rightmostNodeIndices;
}
