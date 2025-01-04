import { Edge, Node } from "reactflow";
import { GenerateUUID } from "../../../utils/treeUtils";

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
    hidden: true,
    animated: false,
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
    hidden: true,
    animated: false,
  });

  return { nodes, edges };
};

/**
 * Main function for generating tree data
 */
const useTreeData = (
  inputLevels: number,
  outputLevels: number,
  nodeWidth: number,
): { nodes: Node[]; edges: Edge[] } => {
  const pos = { x: 0, y: 0 };
  const verticalLevels = inputLevels + 3;

  /**
   * Generate tree nodes and edges
   */
  const generateTreeNodesAndEdges = (): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const rootId = GenerateUUID();
    const rootNode: Node = {
      id: rootId,
      type: "visibleNode",
      data: {
        label: "Root",
        inputDepth: inputLevels,
        outputDepth: outputLevels,
        width: nodeWidth,
        depth: 1,
      },
      position: pos,
    };
    nodes.push(rootNode);

    let prevNodes = [rootNode];
    let currentNodes: Node[] = [];

    for (let depth = 2; depth <= inputLevels; depth++) {
      currentNodes = [];

      for (const parent of prevNodes) {
        // YES Node
        const yesNodeId = GenerateUUID();
        const yesNode: Node = {
          id: yesNodeId,
          type: "visibleNode",
          data: { label: `Yes`, depth: depth, width: nodeWidth, output: false },
          position: { x: parent.position.x + 200, y: parent.position.y + 100 },
        };
        nodes.push(yesNode);
        currentNodes.push(yesNode);

        // NO Node
        const noNodeId = GenerateUUID();
        const noNode: Node = {
          id: noNodeId,
          type: "visibleNode",
          data: { label: `No`, depth: depth, width: nodeWidth, output: false },
          position: { x: parent.position.x + 400, y: parent.position.y + 100 },
        };
        nodes.push(noNode);
        currentNodes.push(noNode);

        // Edges
        edges.push({
          id: `${parent.id}-${yesNodeId}`,
          source: parent.id,
          target: yesNodeId,
          type: "custom",
          animated: false,
        });
        edges.push({
          id: `${parent.id}-${noNodeId}`,
          source: parent.id,
          target: noNodeId,
          type: "custom",
          animated: false,
        });
      }
      prevNodes = currentNodes;
    }

    // Add end states only for leaf nodes
    prevNodes.forEach((leafNode) => {
      const hasChildren = nodes.some((node) =>
        edges.some((edge) => edge.source === leafNode.id && edge.target === node.id),
      );

      // Create end states only if the node has NO children
      if (!hasChildren) {
        const { nodes: endNodes, edges: endEdges } = createEndStates(leafNode, nodeWidth, pos);
        nodes.push(...endNodes);
        edges.push(...endEdges);
      }
    });

    return { nodes, edges };
  };

  /**
   * Generate column nodes
   */
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

    createColumn("Initiating Event", 1);
    createColumn("Functional Event", 2);
    createColumn("Sequence ID", verticalLevels - 2, false);
    createColumn("Frequency", verticalLevels - 1, false);
    createColumn("Release Category", verticalLevels, false);

    return { nodes, edges };
  };

  const { nodes: treeNodes, edges: treeEdges } = generateTreeNodesAndEdges();
  const { nodes: colNodes, edges: colEdges } = generateColNodesAndEdges();

  return { nodes: [...treeNodes, ...colNodes], edges: [...treeEdges, ...colEdges] };
};

export default useTreeData;
