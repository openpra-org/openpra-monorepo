import { Edge, NodeProps, Node, useReactFlow } from "reactflow";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { useParams } from "react-router-dom";
import { EventTreeState, GenerateUUID } from "../../../utils/treeUtils";
import { createEndStates } from "./useTreeData";
import { useEventTreeStore } from "./useEventTreeStore";
interface EventTreeNodeData {
  depth: number;
  width: number;
  output?: boolean;
  isSequenceId?: boolean;
  inputDepth?: number;
  outputDepth?: number;
}
function useCreateNodeClick(clickedNodeId: NodeProps["id"]): () => void {
  const { setEdges, setNodes, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as {
    eventTreeId: string;
  };
  const functionalEvents = useEventTreeStore((s) => s.functionalEvents);
  const addNode: () => void = () => {
    let nodes = getNodes() as Node<EventTreeNodeData>[];
    const edges = getEdges();
    const rootNode = nodes.find((node) => node.data.depth === 1);
    if (!rootNode) {
      throw new Error("Root node with Level 1 not found");
    }
    const [outputLevels, inputLevels] = [rootNode.data.outputDepth ?? 0, rootNode.data.inputDepth ?? 0] as [
      number,
      number,
    ];
    const rightmostNodeIndices = findRightmostNodeIndicesAtEachLevel(
      clickedNodeId,
      nodes,
      edges,
      inputLevels,
      outputLevels,
    );
    const clickedNodeIndex = nodes.findIndex((node) => node.id === clickedNodeId);
    const clickedNode: Node<EventTreeNodeData> | null = clickedNodeIndex !== -1 ? nodes[clickedNodeIndex] : null;
    if (clickedNode?.type === "invisibleNode") {
      nodes[clickedNodeIndex].type = "visibleNode";
      const idx = edges.findIndex((edge) => edge.target === clickedNodeId);
      edges[idx].animated = false;
    }
    const clickedNodeEdge = edges.find((edge) => edge.target === clickedNodeId);
    const clickedNodeDepth = clickedNode?.data.depth ?? 0;
    const newEdges: Edge[] = [];
    let lastNodeId = clickedNodeEdge ? clickedNodeEdge.source : "";
    rightmostNodeIndices.forEach((rightmostNodeIndex, level) => {
      if (level > inputLevels - clickedNodeDepth) return;
      const newNodeId = GenerateUUID();
      const nodeType =
        level === 0 ? "visibleNode"
        : level <= inputLevels - clickedNodeDepth ? "invisibleNode"
        : "outputNode";
      const newNode: Node<EventTreeNodeData> = {
        id: newNodeId,
        type: nodeType,
        data: {
          depth: level + clickedNodeDepth,
          width: rootNode.data.width,
          output: false,
          isSequenceId: level >= inputLevels - clickedNodeDepth,
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
      const sourceNodeId = lastNodeId;
      lastNodeId = newNodeId;
      const targetDepth = level + clickedNodeDepth;
      const feColNode = nodes.find(
        (n) => n.type === "columnNode" && n.data.depth === targetDepth && n.data.output !== true,
      );
      const newEdge: Edge = {
        id: GenerateUUID(),
        source: sourceNodeId,
        target: newNodeId,
        type: "custom",
        animated: false,
        data: { branchState: "bypass", ...(feColNode ? { feId: feColNode.id } : {}) },
      };
      newEdges.push(newEdge);
      if (level >= inputLevels - clickedNodeDepth) {
        const { nodes: endNodes, edges: endEdges } = createEndStates(
          newNode as unknown as Node,
          rootNode.data.width,
          newNode.position,
        );
        nodes.push(...endNodes);
        const modifiedEndEdges = endEdges.map((edge) => {
          const sourceNode = endNodes.find((node) => node.id === edge.source);
          const targetNode = endNodes.find((node) => node.id === edge.target);
          if (sourceNode && targetNode) {
            return {
              ...edge,
              data: { hidden: true },
            };
          } else {
            return {
              ...edge,
              data: { hidden: false },
            };
          }
        });
        newEdges.push(...modifiedEndEdges);
      }
    });
    const updatedEdges = edges.concat(newEdges);
    setNodes(nodes);
    setEdges(updatedEdges);
    const eventTreeCurrentState: EventTreeGraph = EventTreeState({
      eventTreeId: eventTreeId,
      nodes,
      edges: updatedEdges,
      functionalEvents,
    });
    void GraphApiManager.storeEventTree(eventTreeCurrentState).then(() => {});
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
  const clickedNode = nodes.find((node) => node.id === clickedNodeId);
  if (!clickedNode) {
    return [];
  }
  const clickedNodeDepth = clickedNode.data.depth;
  const totalDepth = inputLevel + outputLevel - clickedNodeDepth + 1;
  const rightmostNodeIndices: number[] = Array.from({ length: totalDepth }, () => -1 as number);
  function dfs(nodeId: string, currentDepth: number): void {
    const node = nodes.find((node) => node.id === nodeId);
    if (!node) return;
    const relativeLevel = node.data.depth - clickedNodeDepth;
    if (relativeLevel >= 0 && relativeLevel < totalDepth) {
      const currentIndex = nodes.findIndex((n) => n.id === nodeId);
      if (
        rightmostNodeIndices[relativeLevel] === -1 ||
        node.position.y > nodes[rightmostNodeIndices[relativeLevel]].position.y
      ) {
        rightmostNodeIndices[relativeLevel] = currentIndex;
      }
    }
    const childrenEdges = edges.filter((e) => e.source === nodeId);
    childrenEdges.forEach((edge) => {
      dfs(edge.target, currentDepth + 1);
    });
  }
  dfs(clickedNodeId, clickedNodeDepth);
  return rightmostNodeIndices;
}
