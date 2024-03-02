import { Edge, NodeProps, Node, useReactFlow } from "reactflow";

function useCreateColClick(clickedNodeId: NodeProps["id"]) {
  const { setEdges, setNodes, getNodes, getEdges } = useReactFlow();

  const addCol = () => {
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

    // Find the clicked node
    const clickedNode = nodes.find((node) => node.id === clickedNodeId);

    // Find the edge connecting clickedNode and its parent node
    const clickedNodeEdge = edges.find((edge) => edge.source === clickedNodeId);

    const maxIndex = rootNode.data?.maxColIndex + 1;
    rootNode.data.maxColIndex = maxIndex;

    // Create the new node ID
    const newNodeId = `col-${maxIndex}`;

    // Create the new node
    const nodeData = {
      label: `Column ${maxIndex}`,
      width: rootNode.data.width,
      depth: maxIndex,
      output: clickedNode?.data.output, // Check if it's an output column
    };
    const newColNode: Node = {
      id: newNodeId,
      type: "columnNode",
      data: nodeData,
      position: clickedNode?.position as { x: number; y: number },
    };

    const newEdges: Edge[] = [];
    if (clickedNodeEdge) {
      // Create the edge from the clicked node to the new node
      newEdges.push({
        id: `${clickedNodeEdge.source}-${newNodeId}`,
        source: clickedNodeEdge.source,
        target: newNodeId,
        type: "custom",
        animated: false,
      });

      // Create the edge from the clicked node to the new node
      newEdges.push({
        id: `${newNodeId}-${clickedNodeEdge.target}`,
        source: newNodeId,
        target: clickedNodeEdge.target,
        type: "custom",
        animated: false,
      });
      // insert the node between the source and target node in the react flow state
      setNodes((nodes) => {
        const targetNodeIndex = nodes.findIndex(
          (node) => node.id === clickedNodeEdge.target,
        );

        return [
          ...nodes.slice(0, targetNodeIndex),
          newColNode,
          ...nodes.slice(targetNodeIndex, nodes.length),
        ];
      });
    } else {
      // Create the edge from the clicked node to the new node
      newEdges.push({
        id: `${newNodeId}-${clickedNodeId}`,
        source: newNodeId,
        target: clickedNodeId,
        type: "custom",
        animated: false,
      });
      // insert the node between the source and target node in the react flow state
      setNodes((nodes) => [...nodes, newColNode]);
    }

    // remove the edge that was clicked as we have a new connection with a node inbetween
    setEdges((edges) =>
      edges.filter((e) => e.id !== clickedNodeId).concat(newEdges),
    );
  };
  return addCol;
}

export default useCreateColClick;
