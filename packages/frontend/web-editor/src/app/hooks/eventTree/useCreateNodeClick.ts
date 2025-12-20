import { Edge, NodeProps, Node, useReactFlow } from 'reactflow';
import { EventTreeGraph } from 'shared-types/src/lib/types/reactflowGraph/Graph';
import { GraphApiManager } from 'shared-sdk/lib/api/GraphApiManager';
import { useParams } from 'react-router-dom';
import { EventTreeState, GenerateUUID } from '../../../utils/treeUtils';
import { recalculateFrequencies } from '../../../utils/recalculateFrequencies';
import { createEndStates } from './useTreeData';

// Minimal data shape used in Event Tree reactflow nodes within this hook
interface EventTreeNodeData {
  label: string;
  depth: number;
  width: number;
  output?: boolean;
  isSequenceId?: boolean;
  sequenceId?: string | null;
  inputDepth?: number;
  outputDepth?: number;
}

/**
 * Create a branch of nodes starting from a clicked node in the Event Tree.
 *
 * Adds a chain of nodes and connecting edges to the right of the clicked node,
 * optionally generating end-state nodes (Sequence ID, Frequency, Release Category)
 * when the chain reaches or exceeds the input depth. The function updates the
 * React Flow state, recalculates frequencies, and persists the updated graph.
 *
 * @param clickedNodeId - The id of the node where the new branch should be inserted.
 * @returns A function that performs the mutation when invoked.
 */
function useCreateNodeClick(clickedNodeId: NodeProps['id']): () => void {
  const { setEdges, setNodes, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as { eventTreeId: string };

  const addNode: () => void = () => {
    // Get current nodes and edges
    let nodes = getNodes() as Node<EventTreeNodeData>[];
    const edges = getEdges();

    // Find the root node
    const rootNode = nodes.find((node) => node.data.depth === 1);

    // Handle potential undefined rootNode
    if (!rootNode) {
      // Handle the case where the root node is not found
      throw new Error('Root node with Level 1 not found');
    }

    // Extract the output depth from the root node
    const [outputLevels, inputLevels] = [
      rootNode.data.outputDepth ?? 0,
      rootNode.data.inputDepth ?? 0,
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
    const clickedNode: Node<EventTreeNodeData> | null =
      clickedNodeIndex !== -1 ? nodes[clickedNodeIndex] : null;

    // put the clicked node as activated (for an invisible node)
    if (clickedNode?.type === 'invisibleNode') {
      nodes[clickedNodeIndex].type = 'visibleNode';

      const idx = edges.findIndex((edge) => edge.target === clickedNodeId);
      edges[idx].animated = false;
    }

    // Find the edge connecting clickedNode and its parent node
    const clickedNodeEdge = edges.find((edge) => edge.target === clickedNodeId);

    // Determine the depth of the new node
    const clickedNodeDepth = clickedNode?.data.depth ?? 0;

    // Initialize placeholders for new nodes and edges

    const newEdges: Edge[] = [];
    let lastNodeId = clickedNodeEdge ? clickedNodeEdge.source : '';

    rightmostNodeIndices.forEach((rightmostNodeIndex, level) => {
      // Skip invalid levels
      if (level > inputLevels - clickedNodeDepth) return;

      // Generate a new node ID
      const newNodeId = GenerateUUID();

      // Decide the node type based on its level
      const nodeType =
        level === 0
          ? 'visibleNode'
          : level <= inputLevels - clickedNodeDepth
            ? 'invisibleNode'
            : 'outputNode';

      // Create the new node based on the level and type
      const newNode: Node<EventTreeNodeData> = {
        id: newNodeId,
        type: nodeType,
        data: {
          label: 'New Node',
          depth: level + clickedNodeDepth,
          width: rootNode.data.width,
          output: false,
          isSequenceId: level >= inputLevels - clickedNodeDepth,
          sequenceId: level >= inputLevels - clickedNodeDepth ? '' : null, // Set to null if its not a sequence
        },
        position: {
          x: clickedNode?.position.x ?? 0,
          y: clickedNode?.position.y ?? 0,
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
        type: 'custom',
        animated: false,
      };

      newEdges.push(newEdge);

      // Replace Output Node Logic with End States
      if (level >= inputLevels - clickedNodeDepth) {
        const { nodes: endNodes, edges: endEdges } = createEndStates(
          newNode as unknown as Node, // keep external helper signature unchanged
          rootNode.data.width,
          newNode.position,
        );

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

    // Then recalculate frequencies and update nodes
    const recalculatedNodes = recalculateFrequencies(
      nodes as unknown as Node[],
      updatedEdges,
    );
    setNodes(recalculatedNodes);

    const eventTreeCurrentState: EventTreeGraph = EventTreeState({
      eventTreeId: eventTreeId,
      nodes: recalculatedNodes,
      edges: updatedEdges,
    });

    void GraphApiManager.storeEventTree(eventTreeCurrentState).then(() => {
      // no-op: state persisted
    });
  };

  return addNode;
}

export default useCreateNodeClick;

function findRightmostNodeIndicesAtEachLevel(
  clickedNodeId: string,
  nodes: Node<EventTreeNodeData>[],
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
  const rightmostNodeIndices: number[] = Array.from(
    { length: totalDepth },
    () => -1 as number,
  );

  // DFS to find rightmost nodes
  function dfs(nodeId: string, currentDepth: number): void {
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
