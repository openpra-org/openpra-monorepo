import { Node, Edge } from "reactflow";

interface VisibleData {
  label?: string;
  probability?: number;
  depth?: number;
}
interface OutputData {
  isSequenceId?: boolean;
  isFrequencyNode?: boolean;
  frequency?: number;
}

function isVisibleNode(n?: Node): n is Node<VisibleData> {
  return Boolean(n && n.type === "visibleNode");
}

function isOutputNode(n?: Node): n is Node<OutputData> {
  return Boolean(n && n.type === "outputNode");
}

/**
 * Recalculate sequence frequencies by multiplying visible node probabilities along each path.
 *
 * @remarks
 * The root node probability is used as a base. For intermediate visible nodes, a default
 * probability is inferred when not provided: depth 1 -> 1.0; depth 2 labeled Success/Failure -> 0.5;
 * otherwise 0.0. The resulting frequency is written to frequency nodes connected to sequence IDs.
 *
 * @param nodes - Current graph nodes.
 * @param edges - Current graph edges.
 * @returns A new nodes array with frequency nodes updated; input nodes are not mutated.
 */
export function recalculateFrequencies(nodes: Node[], edges: Edge[]): Node[] {
  // Find the root node (Initiating Event)
  const rootNode = nodes.find(
    (node): node is Node<VisibleData> => isVisibleNode(node) && !edges.some((edge) => edge.target === node.id),
  );

  if (!rootNode) {
    // No root found; return nodes unchanged
    return nodes;
  }

  // Ensure rootNode has a valid probability (default to 1 if undefined)
  const rootProbability: number = typeof rootNode.data.probability === "number" ? rootNode.data.probability : 1;

  // Map sequence IDs to their corresponding frequency nodes
  const sequenceToFrequencyNode = new Map<string, string>();
  // Build a quick lookup for node by id
  const nodesById = new Map<string, Node>(nodes.map((n) => [n.id, n]));

  for (const edge of edges) {
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);

    if (
      isOutputNode(source) &&
      source.data.isSequenceId === true &&
      isOutputNode(target) &&
      target.data.isFrequencyNode === true
    ) {
      sequenceToFrequencyNode.set(source.id, target.id);
    }
  }

  // Find all sequence ID nodes
  const sequenceIDNodes = nodes.filter((node) => isOutputNode(node) && node.data.isSequenceId === true);

  // Build a node-to-children map for more efficient traversal
  const nodeToChildren = new Map<string, string[]>();
  const nodeToParent = new Map<string, string>();

  for (const edge of edges) {
    // Track children
    if (!nodeToChildren.has(edge.source)) {
      nodeToChildren.set(edge.source, []);
    }
    const children = nodeToChildren.get(edge.source);
    if (children) {
      children.push(edge.target);
    }

    // Track parent
    nodeToParent.set(edge.target, edge.source);
  }

  // Find the full path from root to each sequence ID
  const sequenceFullPaths = new Map<string, string[]>();

  // For each sequence ID, trace back its full path to the root node
  for (const seqNode of sequenceIDNodes) {
    // This will store all node IDs in the path from sequence to root
    const pathToRoot: string[] = [];

    // Start with the immediate parent of the sequence ID node
    let currentNodeId = nodeToParent.get(seqNode.id);

    // Traverse up to the root
    while (currentNodeId) {
      pathToRoot.push(currentNodeId);
      currentNodeId = nodeToParent.get(currentNodeId);
    }

    // Reverse the path so it goes from root to leaf
    pathToRoot.reverse();

    sequenceFullPaths.set(seqNode.id, pathToRoot);
  }

  // Get the default probability based on node depth and label
  const getDefaultProbability = (node: Node<VisibleData>): number => {
    const depth = node.data.depth;
    const label = node.data.label;
    if (depth === 1) return 1.0;
    if (depth === 2 && (label === "Success" || label === "Failure")) return 0.5;
    return typeof node.data.probability === "number" ? node.data.probability : 0.0;
  };

  // This function will find all nodes that are part of the path to a sequence
  const getAllNodesInSequencePath = (sequenceId: string): Node[] => {
    const seqPath = sequenceFullPaths.get(sequenceId) ?? [];
    const result: Node[] = [];

    // Add all nodes from the path
    for (const nodeId of seqPath) {
      const node = nodesById.get(nodeId);
      if (node) result.push(node);
    }

    // Ensure we include any nodes between the last visible node and the sequence ID
    let currentIdLocal = nodeToParent.get(sequenceId);
    while (currentIdLocal && !seqPath.includes(currentIdLocal)) {
      const node = nodesById.get(currentIdLocal);
      if (node) result.push(node);
      currentIdLocal = nodeToParent.get(currentIdLocal);
    }

    return result;
  };

  // Calculate path probability from root to sequence
  const calculatePathProbability = (sequenceId: string): number => {
    // Get all nodes in the path to this sequence
    const nodesInPath = getAllNodesInSequencePath(sequenceId);

    if (nodesInPath.length === 0) {
      // No path found for sequence
      return 0;
    }

    // Start with root probability
    let probability = rootProbability;

    // Multiply by each visible node probability in the path
    for (const node of nodesInPath) {
      if (isVisibleNode(node)) {
        const nodeProb =
          typeof node.data.probability === "number" ? node.data.probability : getDefaultProbability(node);

        probability *= nodeProb;

        // If any node has zero probability, the entire path probability becomes zero
        if (nodeProb === 0) {
          return 0;
        }
      }
    }

    return probability;
  };

  // Update frequency values in the nodes
  return nodes.map((node) => {
    if (isOutputNode(node) && node.data.isFrequencyNode === true) {
      // Find the corresponding sequence ID
      const sequenceIdEntry = Array.from(sequenceToFrequencyNode.entries()).find(([, freqId]) => freqId === node.id);
      const sequenceId = sequenceIdEntry ? sequenceIdEntry[0] : undefined;

      if (sequenceId) {
        // Calculate frequency for this sequence
        const frequency = calculatePathProbability(sequenceId);

        return {
          ...node,
          data: {
            ...node.data,
            frequency,
          },
        } as Node<OutputData>;
      }
    }
    return node;
  });
}
