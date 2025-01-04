import { Edge, NodeProps, Node, useReactFlow } from "reactflow";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { useParams } from "react-router-dom";
import { EventTreeState, GenerateUUID } from "../../../utils/treeUtils";
import { createEndStates } from "./useTreeData";

function useCreateNodeClick(clickedNodeId: NodeProps["id"]) {
  const { setEdges, setNodes, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as { eventTreeId: string };

  const addNode = () => {
    const pos = { x: 0, y: 0 };
    const nodes = getNodes();
    const edges = getEdges();

    // Find the parent node
    const parentNode = nodes.find((node) => node.id === clickedNodeId);
    if (!parentNode) throw new Error("Parent node not found!");

    const rootNode = nodes.find((node) => node.data.depth === 1);
    if (!rootNode) throw new Error("Root node not found!");

    const { width } = rootNode.data;
    const newDepth = parentNode.data.depth + 1;

    // Create YES Node
    const yesNodeId = GenerateUUID();
    const yesNode: Node = {
      id: yesNodeId,
      type: "visibleNode",
      data: { label: "Yes", depth: newDepth, width, output: false },
      position: { x: parentNode.position.x + 200, y: parentNode.position.y + 100 },
    };
    nodes.push(yesNode);

    // Create NO Node
    const noNodeId = GenerateUUID();
    const noNode: Node = {
      id: noNodeId,
      type: "visibleNode",
      data: { label: "No", depth: newDepth, width, output: false },
      position: { x: parentNode.position.x + 400, y: parentNode.position.y + 100 },
    };
    nodes.push(noNode);

    // Create Edges
    const newEdges: Edge[] = [
      {
        id: GenerateUUID(),
        source: parentNode.id,
        target: yesNodeId,
        type: "custom",
        animated: false,
      },
      {
        id: GenerateUUID(),
        source: parentNode.id,
        target: noNodeId,
        type: "custom",
        animated: false,
      },
    ];

    // Add End States for YES Node
    const { nodes: yesEndStates, edges: yesEndEdges } = createEndStates(yesNode, width, pos);
    nodes.push(...yesEndStates);
    newEdges.push(...yesEndEdges);

    // Add End States for NO Node
    const { nodes: noEndStates, edges: noEndEdges } = createEndStates(noNode, width, pos);
    nodes.push(...noEndStates);
    newEdges.push(...noEndEdges);

    // Update ReactFlow
    setNodes(nodes);
    setEdges(edges.concat(newEdges));

    const eventTreeCurrentState: EventTreeGraph = EventTreeState({
      eventTreeId: eventTreeId,
      nodes,
      edges,
    });

    void GraphApiManager.storeEventTree(eventTreeCurrentState);
  };

  return addNode;
}

export default useCreateNodeClick;
