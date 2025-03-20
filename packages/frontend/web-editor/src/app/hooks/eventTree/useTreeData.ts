import { Edge, Node } from "reactflow";
import { GenerateUUID } from "../../../utils/treeUtils";
import { setFirstColumnLabel } from "../../components/treeNodes/eventTreeEditorNode/outputNode";

/**
 * Helper function to get initials
 */

const getInitials = (str: string): string => {
  return str
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase();
};
/**
 * Utility function to create end states for a leaf node
 */
export const createEndStates = (
  leafNode: Node,
  nodeWidth: number,
  pos: { x: number; y: number },
): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Sequence ID Node
  const sequenceIdNode = GenerateUUID();
  nodes.push({
    id: sequenceIdNode,
    type: "outputNode",
    data: { label: sequenceIdNode, width: nodeWidth, isSequenceId: true },
    position: pos,
  });
  edges.push({
    id: `${leafNode.id}-${sequenceIdNode}`,
    source: leafNode.id,
    target: sequenceIdNode,
    type: "custom",
    animated: false,
  });

  // Frequency Node
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
    animated: false,
    data: {
      hidden: true,
    },
  });

  // Release Category Node
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
    animated: false,
    data: {
      hidden: true,
    },
  });

  return { nodes, edges };
};

/**
 *Main function for generating tree data
 */
const useTreeData = (
  inputLevels: number,
  outputLevels: number,
  nodeWidth: number,
): { nodes: Node[]; edges: Edge[] } => {
  const pos = { x: 0, y: 0 };
  const verticalLevels = inputLevels + outputLevels;

  // Reset counter at the start
  //resetSequenceCounter();

  // Function to generate tree nodes and edges
  const generateTreeNodesAndEdges = (): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const firstColumnLabel = "Initiating Event"; // Default
    setFirstColumnLabel(firstColumnLabel);

    // Generate root node
    const rootId = GenerateUUID();
    const rootNode: Node = {
      id: rootId,
      type: "visibleNode",
      data: {
        label: getInitials(firstColumnLabel),
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
            label: `Success`,
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
            label: `Failure`,
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

    // Add end states for each leaf node
    prevNodes.forEach((leafNode) => {
      const { nodes: endNodes, edges: endEdges } = createEndStates(leafNode, nodeWidth, {
        x: leafNode.position.x,
        y: leafNode.position.y, // Automatically aligned relative to leaf node
      });
      nodes.push(...endNodes);
      edges.push(...endEdges);
    });

    return { nodes, edges };
  };

  // Function to generate column nodes and edges
  const generateColNodesAndEdges = (): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const firstColumnLabel = "Initiating Event";
    setFirstColumnLabel(firstColumnLabel);

    const rootColNode = GenerateUUID();
    const node: Node = {
      id: rootColNode,
      type: "columnNode",
      data: {
        label: firstColumnLabel,
        width: nodeWidth,
        depth: 1,
        output: false,
        allowAdd: false,
      },
      position: pos,
    };
    nodes.push(node);
    let prevNode = rootColNode;

    // Use a for loop to generate columns dynamically
    for (let column = 2; column <= verticalLevels; column++) {
      const nodeId = GenerateUUID();
      let nodeLabel = "";

      // Determine the label for each column
      if (column <= inputLevels) {
        nodeLabel = `Functional Event`;
      } else {
        if (column === verticalLevels - 2) {
          nodeLabel = `Sequence ID`;
        } else if (column === verticalLevels - 1) {
          nodeLabel = `Frequency`;
        } else if (column === verticalLevels) {
          nodeLabel = `Release Category`;
        }
      }

      // Create the column node
      const colNode: Node = {
        id: nodeId,
        type: "columnNode",
        data: {
          label: nodeLabel,
          width: nodeWidth,
          depth: column,
          output: column > inputLevels, // Columns after input levels are for end states
          allowAdd: column <= inputLevels,
        },
        position: pos,
      };
      nodes.push(colNode);

      // Create the edge connecting the previous column to the current column
      const edge: Edge = {
        id: `${prevNode}--${nodeId}`,
        source: prevNode,
        target: nodeId,
        type: "custom",
        animated: false,
        data: {
          hidden: true,
        },
      };
      edges.push(edge);

      // Update the previous node to the current node
      prevNode = nodeId;
    }

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
