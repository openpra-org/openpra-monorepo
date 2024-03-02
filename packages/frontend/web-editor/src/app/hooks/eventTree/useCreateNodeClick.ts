import { Edge, NodeProps, Node, useReactFlow } from "reactflow";

function useCreateNodeClick(clickedNodeId: NodeProps["id"]) {
  const { setEdges, setNodes, getNodes, getEdges } = useReactFlow();

  const addNode = () => {
    // Get current nodes and edges
    const nodes = getNodes();
    const edges = getEdges();

    // Find the root node
    const rootNode = nodes.find((node) => node.id === "tree-1-1");

    // Handle potential undefined rootNode
    if (!rootNode) {
      // Handle the case where the root node is not found
      throw new Error("Root node with ID 'tree-1-1' not found");
    }

    // Extract the output depth from the root node
    const [outputLevels, inputLevels] = [
      rootNode.data?.outputDepth,
      rootNode.data?.inputDepth,
    ] as [number, number];

    const maxIndex = rootNode.data?.maxIndex + 1;
    rootNode.data.maxIndex = maxIndex;

    // Find the clicked node
    const clickedNode = nodes.find((node) => node.id === clickedNodeId);

    // Find the edge connecting clickedNode and its parent node
    const clickedNodeEdge = edges.find((edge) => edge.target === clickedNodeId);

    // Determine the depth of the new node
    const depth = parseInt(clickedNodeId.split("-")[1]);
    const index = parseInt(clickedNodeId.split("-")[2]);

    // Create the new node ID
    const newNodeId = `tree-${depth}-${maxIndex}`;

    // Create the new node
    const newNode: Node = {
      id: newNodeId,
      type: "hiddenNode",
      data: {
        label: `Node ${newNodeId}`,
        depth: depth,
        width: clickedNode && (clickedNode.data.width as number),
        output: false,
      },
      position: clickedNode?.position as { x: number; y: number },
    };

    // Create the edge from the clicked node to the new node
    const newEdge: Edge = {
      id: `${clickedNodeEdge?.source ?? "default-source"}-${newNodeId}`,
      source: clickedNodeEdge?.source ?? "default-source",
      target: newNodeId,
      type: "custom",
      animated: false,
    };

    // Create the group of output nodes and their edges
    const outputNodes: Node[] = [];
    const outputEdges: Edge[] = [];

    for (let i = 1; i <= outputLevels; i++) {
      const outputNodeId = `output-${i}-${maxIndex}`;
      outputNodes.push({
        id: outputNodeId,
        type: "hiddenNode",
        data: {
          label: `Output ${outputNodeId}`,
          depth: inputLevels + i,
          width: clickedNode?.data.width as number,
          output: true,
        },
        position: clickedNode?.position as { x: number; y: number },
      });

      if (i === 1) {
        outputEdges.push({
          id: `${newNodeId}-${outputNodeId}`,
          source: newNodeId,
          target: outputNodeId,
          type: "custom",
          animated: false,
        });
      } else {
        outputEdges.push({
          id: `output-${i - 1}-${maxIndex}-to-output-${i}-${maxIndex}`, // Correct the edge ID if necessary
          source: `output-${i - 1}-${maxIndex}`,
          target: `output-${i}-${maxIndex}`,
          type: "custom",
          animated: false,
        });
      }
    }

    // Set nodes and edges with the updated and new elements
    setNodes((prevNodes) => {
      const targetNodeIndex = nodes.findIndex(
        (node) => node.id === clickedNodeId,
      );
      const targetOutputIndex = nodes.findIndex(
        (node) => node.id === maxIndex?.id,
      );
      return [
        rootNode,
        ...nodes.slice(1, targetNodeIndex + 1),
        newNode,
        ...nodes.slice(targetNodeIndex + 1, nodes.length),
        ...outputNodes,
      ];
    });
    setEdges((prevEdges) => [...prevEdges, newEdge, ...outputEdges]);
  };

  return addNode;
}

export default useCreateNodeClick;
