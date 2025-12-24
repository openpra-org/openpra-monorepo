import { Edge, Node } from 'reactflow';
import { GenerateUUID } from '../../../utils/treeUtils';
import { ScientificNotation } from '../../../utils/scientificNotation';
import { recalculateFrequencies } from '../../../utils/recalculateFrequencies';
import { useEventTreeStore } from './useEventTreeStore';

/**
 * Get uppercase initials from a phrase.
 *
 * @param str - The phrase to extract initials from.
 * @returns The concatenated uppercase initials (e.g., "Initiating Event" -> "IE").
 */
export const getInitials = (str: string): string => {
  return str
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase();
};
/**
 * Create default end-state nodes for a given leaf.
 *
 * Generates a Sequence ID node, a Frequency node, and a Release Category node,
 * connecting them in order and returning the new nodes and edges. Frequency is
 * initialized to 0.5 for default nodes and 0.0 otherwise.
 *
 * @param leafNode - The leaf node to attach the end-state chain to.
 * @param nodeWidth - The width to assign to generated nodes.
 * @param pos - The base position used for initial placement of generated nodes.
 * @param isDefaultNode - Whether to seed frequency with a default (0.5) value.
 * @returns An object containing the created nodes and edges.
 */
export const createEndStates = (
  leafNode: Node,
  nodeWidth: number,
  pos: { x: number; y: number },
  isDefaultNode = false, // Add new parameter to identify default nodes
): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Sequence ID Node
  const sequenceIdNode = GenerateUUID();
  nodes.push({
    id: sequenceIdNode,
    type: 'outputNode',
    data: { label: sequenceIdNode, width: nodeWidth, isSequenceId: true },
    position: pos,
  });
  edges.push({
    id: `${leafNode.id}-${sequenceIdNode}`,
    source: leafNode.id,
    target: sequenceIdNode,
    type: 'custom',
    animated: false,
  });

  // Frequency Node
  const frequencyNode = GenerateUUID();
  const frequencyValue = isDefaultNode ? 0.5 : 0.0;
  nodes.push({
    id: frequencyNode,
    type: 'outputNode',
    data: {
      label: ScientificNotation.toScientific(frequencyValue),
      frequency: frequencyValue,
      width: nodeWidth,
      isFrequencyNode: true,
      isDefaultNode: isDefaultNode,
    },
    position: pos,
  });
  edges.push({
    id: `${sequenceIdNode}-${frequencyNode}`,
    source: sequenceIdNode,
    target: frequencyNode,
    type: 'custom',
    animated: false,
    data: {
      hidden: true,
    },
  });

  // Release Category Node
  const releaseCategoryNode = GenerateUUID();
  nodes.push({
    id: releaseCategoryNode,
    type: 'outputNode',
    data: { label: `Category A`, width: nodeWidth },
    position: pos,
  });
  edges.push({
    id: `${frequencyNode}-${releaseCategoryNode}`,
    source: frequencyNode,
    target: releaseCategoryNode,
    type: 'custom',
    animated: false,
    data: {
      hidden: true,
    },
  });

  return { nodes, edges };
};

/**
 * Generate the initial Event Tree graph (nodes and edges).
 *
 * Builds a balanced binary tree of input levels with labelled edges and then
 * appends end-state chains for each leaf (Sequence ID, Frequency, Release Category).
 * Also generates the supporting column-nodes and hidden column edges.
 *
 * @param inputLevels - Number of functional-event levels to generate.
 * @param outputLevels - Number of end-state levels to generate.
 * @param nodeWidth - Node width used for layout and column positioning.
 * @returns The complete initial node and edge set for the Event Tree.
 */
const useTreeData = (
  inputLevels: number,
  outputLevels: number,
  nodeWidth: number,
): { nodes: Node[]; edges: Edge[] } => {
  // Access Zustand store state
  const { firstColumnLabel, setFirstColumnLabel } =
    useEventTreeStore.getState();

  if (!firstColumnLabel) {
    setFirstColumnLabel('Initiating Event'); // Default label if not set
  }

  const pos = { x: 0, y: 0 };
  const verticalLevels = inputLevels + outputLevels;

  // Function to generate tree nodes and edges
  const generateTreeNodesAndEdges = (): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Generate root node
    const rootId = GenerateUUID();
    const rootNode: Node = {
      id: rootId,
      type: 'visibleNode',
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
          type: 'visibleNode',
          data: {
            label: `Success`,
            probability: 0.5,
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
          type: 'visibleNode',
          data: {
            label: `Failure`,
            probability: 0.5,
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
          type: 'custom',
          animated: false,
        };
        const edgeRight: Edge = {
          id: `${parent.id}-${rightChildId}`,
          source: parent.id,
          target: rightChildId,
          type: 'custom',
          animated: false,
        };
        edges.push(edgeLeft);
        edges.push(edgeRight);
      }

      prevNodes = currentNodes; // Update previous nodes for the next depth
    }

    // Add end states for each leaf node
    prevNodes.forEach((leafNode) => {
      const { nodes: endNodes, edges: endEdges } = createEndStates(
        leafNode,
        nodeWidth,
        {
          x: leafNode.position.x,
          y: leafNode.position.y, // Automatically aligned relative to leaf node
        },
        true,
      );
      nodes.push(...endNodes);
      edges.push(...endEdges);
    });

    // Apply frequency calculation to all nodes
    const calculatedNodes = recalculateFrequencies(nodes, edges);
    return { nodes: calculatedNodes, edges };
  };

  // Function to generate column nodes and edges
  const generateColNodesAndEdges = (): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const firstColumnLabel = 'Initiating Event';
    setFirstColumnLabel(firstColumnLabel);

    const rootColNode = GenerateUUID();
    const node: Node = {
      id: rootColNode,
      type: 'columnNode',
      data: {
        label: firstColumnLabel,
        probability: 1.0,
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
      let nodeLabel = '';

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
        type: 'columnNode',
        data: {
          label: nodeLabel,
          width: nodeWidth,
          depth: column,
          output: column > inputLevels, // Columns after input levels are for end states
          allowAdd: column <= inputLevels,
          // Allow delete for all functional events, including the first one
          allowDelete: column <= inputLevels && column !== 1,
        },
        position: pos,
      };
      nodes.push(colNode);

      // Create the edge connecting the previous column to the current column
      const edge: Edge = {
        id: `${prevNode}--${nodeId}`,
        source: prevNode,
        target: nodeId,
        type: 'custom',
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
  const { nodes: generatedTreeNodes, edges: treeEdges } =
    generateTreeNodesAndEdges();

  // Generate column nodes and edges
  const { nodes: generatedColNodes, edges: colEdges } =
    generateColNodesAndEdges();

  const nodes = [...generatedTreeNodes, ...generatedColNodes];
  const edges = [...treeEdges, ...colEdges];

  return { nodes, edges };
};

export { useTreeData };
