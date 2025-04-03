import { Node, Edge } from "reactflow";

export function recalculateFrequencies(nodes: Node[], edges: Edge[]): Node[] {
  // Find the root node (Initiating Event)
  const rootNode = nodes.find((node) => node.type === "visibleNode" && !edges.some((edge) => edge.target === node.id));

  if (!rootNode) {
    console.error("Root node not found!");
    return nodes;
  }

  // Ensure rootNode has a valid probability (default to 1 if undefined)
  const rootProbability = typeof rootNode.data?.probability === "number" ? rootNode.data.probability : 1;

  console.log("Root node probability:", rootProbability);

  // Map sequence IDs to their corresponding frequency nodes
  const sequenceToFrequencyNode = new Map<string, string>();
  edges.forEach((edge) => {
    const source = nodes.find((n) => n.id === edge.source);
    const target = nodes.find((n) => n.id === edge.target);

    if (
      source?.type === "outputNode" &&
      source.data?.isSequenceId === true &&
      target?.type === "outputNode" &&
      target.data?.isFrequencyNode === true
    ) {
      sequenceToFrequencyNode.set(source.id, target.id);
    }
  });

  // Find all sequence ID nodes
  const sequenceIDNodes = nodes.filter((node) => node.type === "outputNode" && node.data?.isSequenceId === true);

  // Build a node-to-children map for more efficient traversal
  const nodeToChildren = new Map<string, string[]>();
  const nodeToParent = new Map<string, string>();

  edges.forEach((edge) => {
    // Track children
    if (!nodeToChildren.has(edge.source)) {
      nodeToChildren.set(edge.source, []);
    }
    nodeToChildren.get(edge.source)?.push(edge.target);

    // Track parent
    nodeToParent.set(edge.target, edge.source);
  });

  // Find the full path from root to each sequence ID
  const sequenceFullPaths = new Map<string, string[]>();

  // For each sequence ID, trace back its full path to the root node
  sequenceIDNodes.forEach((seqNode) => {
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
  });

  // Get the default probability based on node depth and label
  const getDefaultProbability = (node: Node): number => {
    if (node.data?.depth === 1) return 1.0;
    if (node.data?.depth === 2 && (node.data?.label === "Success" || node.data?.label === "Failure")) return 0.5;
    return node.data?.probability ?? 0.0;
  };

  // This function will find all nodes that are part of the path to a sequence
  const getAllNodesInSequencePath = (sequenceId: string): Node[] => {
    const seqPath = sequenceFullPaths.get(sequenceId) || [];
    const result: Node[] = [];

    // Add all nodes from the path
    for (const nodeId of seqPath) {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) result.push(node);
    }

    // Ensure we include any "New Node" or other nodes that might be
    // between the last visible node and the sequence ID
    let currentId = nodeToParent.get(sequenceId);
    while (currentId && !seqPath.includes(currentId)) {
      const node = nodes.find((n) => n.id === currentId);
      if (node) result.push(node);
      currentId = nodeToParent.get(currentId);
    }

    return result;
  };

  // Calculate path probability from root to sequence
  const calculatePathProbability = (sequenceId: string): number => {
    // Get all nodes in the path to this sequence
    const nodesInPath = getAllNodesInSequencePath(sequenceId);

    if (nodesInPath.length === 0) {
      console.warn(`No path found for sequence ${sequenceId}`);
      return 0;
    }

    // Start with root probability
    let probability = rootProbability;

    // Multiply by each visible node probability in the path
    for (const node of nodesInPath) {
      if (node.type === "visibleNode") {
        const nodeProb =
          typeof node.data?.probability === "number" ? node.data.probability : getDefaultProbability(node);

        console.log(`Node ${node.data?.label} (${node.id}) probability: ${nodeProb}`);
        probability *= nodeProb;

        // If any node has zero probability, the entire path probability becomes zero
        if (nodeProb === 0) {
          console.log(`Zero probability found in path to sequence ${sequenceId}`);
          return 0;
        }
      }
    }

    console.log(`Final path probability for sequence ${sequenceId}: ${probability}`);
    return probability;
  };

  // Update frequency values in the nodes
  return nodes.map((node) => {
    if (node.type === "outputNode" && node.data?.isFrequencyNode === true) {
      // Find the corresponding sequence ID
      const sequenceIdEntry = Array.from(sequenceToFrequencyNode.entries()).find(([_, freqId]) => freqId === node.id);

      const sequenceId = sequenceIdEntry ? sequenceIdEntry[0] : undefined;

      if (sequenceId) {
        // Calculate frequency for this sequence
        const frequency = calculatePathProbability(sequenceId);

        return {
          ...node,
          data: {
            ...node.data,
            frequency: frequency,
          },
        };
      }
    }
    return node;
  });
}
