import { Edge, NodeProps, Node, useReactFlow } from "reactflow";
import { last } from "lodash";
import { GenerateUUID } from "../../../utils/treeUtils";

function useCreateNodeClick(clickedNodeId: NodeProps["id"]) {
  const { setEdges, setNodes, getNodes, getEdges } = useReactFlow();

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
    const [outputLevels, inputLevels] = [
      rootNode.data?.outputDepth,
      rootNode.data?.inputDepth,
    ] as [number, number];

    const rightmostNodeIndices = findRightmostNodeIndicesAtEachLevel(
      clickedNodeId,
      nodes,
      edges,
      inputLevels,
      outputLevels,
    );

    // Find the clicked node
    const clickedNodeIndex = nodes.findIndex(
      (node) => node.id === clickedNodeId,
    );
    const clickedNode =
      clickedNodeIndex !== -1 ? nodes[clickedNodeIndex] : null;

    // put the clicked node as activated (for a dangling node)
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
      // Generate a new node ID
      const newNodeId = GenerateUUID();

      // Decide the node type based on its level
      const nodeType =
        level === 0
          ? "visibleNode"
          : level <= inputLevels - clickedNodeDepth
          ? "invisibleNode"
          : "outputNode";

      // Create the new node based on the level and type
      const newNode: Node = {
        id: newNodeId,
        type: nodeType,
        data: {
          label: `node at ${level + clickedNodeDepth}`,
          depth: level + clickedNodeDepth,
          width: rootNode.data.width,
          output: nodeType === "outputNode",
        },
        position: {
          x: clickedNode?.position.x!, // This should be calculated based on your layout logic
          y: clickedNode?.position.y!, // This should be calculated based on your layout logic
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
        animated:
          nodeType === "invisibleNode" ||
          level === inputLevels - clickedNodeDepth + 1
            ? true
            : false,
      };

      newEdges.push(newEdge);
    });

    // Set nodes and edges with the updated and new elements
    setNodes(nodes);
    setEdges(edges.concat(newEdges));
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
    console.error("Clicked node not found");
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
