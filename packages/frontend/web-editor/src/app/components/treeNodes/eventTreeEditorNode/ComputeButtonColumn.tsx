import { NodeProps } from "reactflow";
import React from "react";
import { EuiButton } from "@elastic/eui";
import { useReactFlow } from "reactflow";
import { ScientificNotation } from "../../../../utils/scientificNotation";

function ComputeButtonColumn({ data }: NodeProps) {
  const { getNodes, getEdges, setNodes } = useReactFlow();

  const computeFrequency = () => {
    const nodes = getNodes();
    const edges = getEdges();

    // Identify the root node (Initiating Event)
    const rootNode = nodes.find(
      (node) => node.type === "visibleNode" && !edges.some((edge) => edge.target === node.id),
    );

    if (!rootNode) {
      console.error("Root node not found!");
      return;
    }

    console.log("Root Node:", rootNode.id, "Probability:", rootNode.data.probability);

    // Ensure rootNode has a valid probability
    if (typeof rootNode.data.probability !== "number") {
      // If undefined default it to 1
      rootNode.data.probability = 1;
    }

    // Map sequence IDs to their corresponding frequency nodes
    const sequenceToFrequencyNode = new Map<string, string>();
    edges.forEach((edge) => {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);

      if (
        source?.type === "outputNode" &&
        source.data?.isSequenceId &&
        target?.type === "outputNode" &&
        target.data?.isFrequencyNode
      ) {
        sequenceToFrequencyNode.set(source.id, target.id);
      }
    });

    // Find all sequence ID nodes
    const sequenceIDNodes = nodes.filter((node) => node.type === "outputNode" && node.data?.isSequenceId);
    console.log(
      "Sequence ID Nodes:",
      sequenceIDNodes.map((n) => n.id),
    );

    // Identify the last visible node before each sequence ID
    const leafNodes = new Map<string, string>(); // { visible node ID → sequence ID }
    sequenceIDNodes.forEach((seqNode) => {
      let parent = edges.find((edge) => edge.target === seqNode.id)?.source;
      while (parent) {
        const parentNode = nodes.find((n) => n.id === parent);
        if (parentNode?.type === "visibleNode") {
          leafNodes.set(parentNode.id, seqNode.id);
          break;
        }
        parent = edges.find((edge) => edge.target === parent)?.source;
      }
    });

    // Compute frequencies for each sequence and update frequency nodes
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (node.type === "outputNode" && node.data.isFrequencyNode) {
          const sequenceId = [...sequenceToFrequencyNode.entries()].find(([_, freqId]) => freqId === node.id)?.[0];
          if (!sequenceId) return node;

          const leafNodeId = [...leafNodes.entries()].find(([_, seqId]) => seqId === sequenceId)?.[0];

          // Compute frequency correctly by multiplying probabilities along the path
          const frequency = leafNodeId
            ? calculatePathProbability(leafNodeId, nodes, edges, rootNode)
            : rootNode.data.probability ?? 1;

          return {
            ...node,
            data: {
              ...node.data,
              label: ScientificNotation.toScientific(frequency, 3),
              frequency: frequency, // Override default 0.0 with calculated frequency
            },
          };
        }
        return node;
      }),
    );
  };

  const calculatePathProbability = (leafNodeId: string, nodes: any[], edges: any[], rootNode: any): number => {
    let product = rootNode.data.probability; // Start with root probability
    let currentNodeId = leafNodeId;
    const visited = new Set<string>();

    console.log(`Computing probability for sequence starting at node: ${leafNodeId}`);

    while (currentNodeId && !visited.has(currentNodeId)) {
      visited.add(currentNodeId);

      const currentNode = nodes.find((node) => node.id === currentNodeId);
      if (!currentNode) break;

      if (currentNode.type === "visibleNode") {
        const probability = currentNode.data.probability ?? 0;
        product *= probability;
        console.log(`Node: ${currentNodeId}, Probability: ${probability}, Running Product: ${product}`);
      }

      currentNodeId = edges.find((edge) => edge.target === currentNodeId)?.source;
    }

    return product;
  };

  return (
    <div
      style={{
        width: data.width * 0.8,
        height: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        left: "60%",
        transform: "translateX(-50%) translateY(50%)",
      }}
    >
      <EuiButton
        size="s"
        onClick={computeFrequency}
        style={{
          fontSize: "0.75rem",
          padding: "4px 4px",
          minWidth: "120px",
        }}
      >
        Compute Frequency
      </EuiButton>
    </div>
  );
}

export default ComputeButtonColumn;
