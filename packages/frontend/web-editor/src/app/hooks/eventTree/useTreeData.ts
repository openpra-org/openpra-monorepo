import { Edge, Node } from "reactflow";

const useTreeData = (
  inputLevels: number,
  outputLevels: number,
  nodeWidth: number,
): { nodes: Node[]; edges: Edge[] } => {
  const pos = { x: 0, y: 0 };
  const verticalLevels = inputLevels + outputLevels;

  // Function to generate tree nodes and edges
  const generateTreeNodesAndEdges = (): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Generate root node
    const rootId = `tree-1-1`;
    const rootNode: Node = {
      id: rootId,
      type: "hiddenNode",
      data: { label: "Root Node", depth: 1, width: nodeWidth },
      position: pos,
    };
    nodes.push(rootNode);

    let prevNodes = [rootNode]; // Track previous nodes
    let currentNodes: Node[] = [];

    for (let depth = 2; depth <= inputLevels; depth++) {
      currentNodes = [];

      for (let i = 0; i < prevNodes.length; i++) {
        const parent = prevNodes[i];

        // Create two child nodes for each parent node
        const leftChildId = `tree-${depth}-${2 * i + 1}`;
        const leftChildNode: Node = {
          id: leftChildId,
          type: "hiddenNode",
          data: {
            label: `Node ${leftChildId}`,
            depth: depth,
            width: nodeWidth,
            output: false,
          },
          position: pos,
        };
        nodes.push(leftChildNode);
        currentNodes.push(leftChildNode);

        const rightChildId = `tree-${depth}-${2 * i + 2}`;
        const rightChildNode: Node = {
          id: rightChildId,
          type: "hiddenNode",
          data: {
            label: `Node ${rightChildId}`,
            depth: depth,
            width: nodeWidth,
            output: false,
          },
          position: pos,
        };
        nodes.push(rightChildNode);
        currentNodes.push(rightChildNode);

        // Create edges between parent and child nodes
        const edgeLeft: Edge = {
          id: `${parent.id}-${leftChildId}`,
          source: parent.id,
          target: leftChildId,
          type: "custom",
          animated: false,
        };
        const edgeRight: Edge = {
          id: `${parent.id}-${rightChildId}`,
          source: parent.id,
          target: rightChildId,
          type: "custom",
          animated: false,
        };
        edges.push(edgeLeft);
        edges.push(edgeRight);
      }

      prevNodes = currentNodes; // Update previous nodes for the next depth
    }

    // Connect each leaf node of input to its own sequence of output nodes
    const outputStartDepth = inputLevels + 1; // Depth of the first output level
    let prevNodeId = "";

    for (let i = 0; i < currentNodes.length; i++) {
      const inputLeafNode = currentNodes[i];

      for (let j = 0; j < outputLevels; j++) {
        const outputNodeId = `output-${i}-${j + 1}`;
        const outputNode: Node = {
          id: outputNodeId,
          type: "hiddenNode",
          data: {
            label: `Output ${outputNodeId}`,
            depth: outputStartDepth + j,
            width: nodeWidth,
            output: true,
          },
          position: pos,
        };
        nodes.push(outputNode);

        let edge: Edge;
        if (j == 0) {
          edge = {
            id: `${inputLeafNode.id}-${outputNodeId}`,
            source: inputLeafNode.id,
            target: outputNodeId,
            type: "custom",
            animated: false,
          };
        } else {
          edge = {
            id: `${prevNodeId}-${outputNodeId}`,
            source: prevNodeId,
            target: outputNodeId,
            type: "custom",
            animated: false,
          };
        }

        edges.push(edge);
        prevNodeId = outputNodeId;
      }
    }

    return { nodes, edges };
  };

  // Function to generate column nodes and edges
  const generateColNodesAndEdges = (): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    for (let column = 1; column <= verticalLevels; column++) {
      const nodeId = `col-${column}`;
      const nodeData = {
        label: `Column ${column}`,
        width: nodeWidth,
        depth: column,
        output: column > inputLevels, // Check if it's an output column
      };
      const node: Node = {
        id: nodeId,
        type: "columnNode",
        data: nodeData,
        position: pos,
      };
      nodes.push(node);

      if (column < verticalLevels) {
        // Create edges between column nodes
        const edge: Edge = {
          id: `col-${column}-to-col-${column + 1}`,
          source: `col-${column}`,
          target: `col-${column + 1}`,
          type: "custom",
          hidden: true,
          animated: false,
        };
        edges.push(edge);
      }
    }

    return { nodes, edges };
  };

  // Generate tree nodes and edges
  const { nodes: generatedTreeNodes, edges: treeEdges } =
    generateTreeNodesAndEdges();
  // Generate column nodes and edges
  const { nodes: generatedColNodes, edges: colEdges } =
    generateColNodesAndEdges();

  const nodes = [...generatedTreeNodes, ...generatedColNodes];
  const edges = [...treeEdges, ...colEdges];

  return { nodes, edges };
};

export default useTreeData;
