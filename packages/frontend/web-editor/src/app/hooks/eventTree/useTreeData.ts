import { Edge, Node } from "reactflow";
import { GenerateUUID } from "../../../utils/treeUtils";

const useTreeData = (
  inputLevels: number,
  outputLevels: number,
  nodeWidth: number,
): { nodes: Node[]; edges: Edge[] } => {
  const pos = { x: 0, y: 0 };
  // const verticalLevels = inputLevels + outputLevels;
  const verticalLevels = inputLevels + 3; // 3 columns for Sequence ID, Frequency, and Release Category

  // Function to generate tree nodes and edges
  const generateTreeNodesAndEdges = (): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Generate root node
    const rootId = GenerateUUID();
    const rootNode: Node = {
      id: rootId,
      type: "visibleNode",
      data: {
        label: "Root Node",
        inputDepth: inputLevels,
        outputDepth: outputLevels,
        width: nodeWidth,
        depth: 1,
        index: 1,
      },
      position: pos,
    };
    nodes.push(rootNode);

    let prevNodes = [rootNode]; // Track previous nodes
    let currentNodes: Node[] = [];

    for (let depth = 2; depth <= inputLevels; depth++) {
      currentNodes = [];

      for (const parent of prevNodes) {
        // Create two child nodes for each parent node
        const leftChildId = GenerateUUID();
        const leftChildNode: Node = {
          id: leftChildId,
          type: "visibleNode",
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

        const rightChildId = GenerateUUID();
        const rightChildNode: Node = {
          id: rightChildId,
          type: "visibleNode",
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

    // Connect leaf nodes to end states
    currentNodes.forEach((leafNode) => {
      // Connect Sequence ID
      const sequenceIdNode = GenerateUUID();
      nodes.push({
        id: sequenceIdNode,
        type: "outputNode",
        data: { label: sequenceIdNode, width: nodeWidth },
        position: pos,
      });
      edges.push({
        id: `${leafNode.id}-${sequenceIdNode}`,
        source: leafNode.id,
        target: sequenceIdNode,
        type: "custom",
        animated: false,
      });

      // Connect Frequency
      const frequencyNode = GenerateUUID();
      nodes.push({
        id: frequencyNode,
        type: "outputNode",
        data: { label: "0.55", width: nodeWidth },
        position: pos,
      });
      edges.push({
        id: `${sequenceIdNode}-${frequencyNode}`,
        source: sequenceIdNode,
        target: frequencyNode,
        type: "custom",
        hidden: true,
        animated: false,
      });

      // Connect Release Category
      const releaseCategoryNode = GenerateUUID();
      nodes.push({
        id: releaseCategoryNode,
        type: "outputNode",
        data: { label: `Category A`, width: nodeWidth },
        position: pos,
      });
      edges.push({
        id: `${frequencyNode}-${releaseCategoryNode}`,
        source: frequencyNode,
        target: releaseCategoryNode,
        type: "custom",
        hidden: true,
        animated: false,
      });
    });

    return { nodes, edges };
  };

  const generateColNodesAndEdges = (): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const createColumn = (label: string, depth: number, allowAdd = true) => {
      const id = GenerateUUID();
      nodes.push({
        id,
        type: "columnNode",
        data: { label, width: nodeWidth, depth, allowAdd },
        position: pos,
      });
      return id;
    };

    const col1 = createColumn("Initiating Event", 1);
    const col2 = createColumn("Functional Event", 2);
    const col3 = createColumn("Sequence ID", verticalLevels - 2, false);
    const col4 = createColumn("Frequency", verticalLevels - 1, false);
    const col5 = createColumn("Release Category", verticalLevels, false);

    return { nodes, edges };
  };

  // Generate tree nodes and edges
  const { nodes: generatedTreeNodes, edges: treeEdges } = generateTreeNodesAndEdges();

  // Generate column nodes and edges
  const { nodes: generatedColNodes, edges: colEdges } = generateColNodesAndEdges();

  const nodes = [...generatedTreeNodes, ...generatedColNodes];
  const edges = [...treeEdges, ...colEdges];

  return { nodes, edges };
};

export default useTreeData;
