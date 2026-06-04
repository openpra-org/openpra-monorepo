import { useCallback } from "react";
import { Edge, Node, getOutgoers, NodeProps, useReactFlow } from "reactflow";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { useParams } from "react-router-dom";
import { FaultTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { FaultTreeState, GenerateUUID } from "../../../utils/treeUtils";
import { BASIC_EVENT, LEAF_NODE_TYPES, NOT_GATE, WORKFLOW } from "../../../utils/constants";
import { useStore } from "../../store/faultTreeStore";
import { useUndoRedo } from "./useUndeRedo";
function UseNodeDoubleClick(id: NodeProps["id"]): {
  handleNodeDoubleClick: (nodeType: React.MouseEvent) => Promise<void>;
} {
  const { setEdges, setNodes, nodes, edges, setFocusNodeId } = useStore();
  const { getNode } = useReactFlow();
  const { takeSnapshot } = useUndoRedo();
  const { faultTreeId } = useParams();
  const handleNodeDoubleClick = useCallback(async () => {
    const parentNode = getNode(id);
    if (!parentNode || LEAF_NODE_TYPES.includes(parentNode.type) || parentNode.type === NOT_GATE) {
      return;
    }
    const childNodeId = GenerateUUID();
    const childNode = {
      id: childNodeId,
      position: { x: parentNode.position.x, y: parentNode.position.y + 150 },
      type: BASIC_EVENT,
      data: {},
    };
    const childEdge = {
      id: `${parentNode.id}=>${childNodeId}`,
      source: parentNode.id,
      target: childNodeId,
      type: WORKFLOW,
    };
    takeSnapshot();
    const existingChildren = getOutgoers(parentNode, nodes, edges)
      .filter((node) => node.type === "placeholder")
      .map((node) => node.id);
    const newNodes: Node[] = nodes.filter((node) => !existingChildren.includes(node.id)).concat([childNode]);
    setNodes(newNodes);
    const newEdges: Edge[] = edges.filter((edge) => !existingChildren.includes(edge.target)).concat([childEdge]);
    setEdges(newEdges);
    setFocusNodeId(parentNode.id);
    await GraphApiManager.storeFaultTree(
      FaultTreeState({
        nodes: newNodes,
        edges: newEdges,
        faultTreeId: faultTreeId ?? "",
      }),
    ).then((_r: FaultTreeGraph) => {});
  }, [getNode, id, takeSnapshot, nodes, edges, setNodes, setEdges, setFocusNodeId, faultTreeId]);
  return { handleNodeDoubleClick };
}
export { UseNodeDoubleClick };
