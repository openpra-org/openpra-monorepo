import { Edge, getOutgoers, Node, NodeProps } from "reactflow";
import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { useStore } from "../../store/faultTreeStore";
import { FaultTreeState, GetParentNode, getWorkflowEdge } from "../../../utils/treeUtils";
import { FaultTreeNodeProps } from "../../components/treeNodes/faultTreeNodes/faultTreeNodeType";
const UseGrayedNodeClick = (
  id: NodeProps["id"],
): {
  handleGrayedNodeClick: (branchId: string | undefined) => Promise<void>;
} => {
  const { nodes, edges, setNodes, setEdges } = useStore();
  const { faultTreeId } = useParams();
  const handleGrayedNodeClick = useCallback(
    async (branchId: string | undefined): Promise<void> => {
      const parentNode = nodes.filter((node) => node.data?.branchId === undefined && node.data?.isGrayed === true);
      const notGateNode = GetParentNode(parentNode[0], nodes, edges);
      const solidifiedNodes = nodes.filter(
        (node) => node.data?.branchId === branchId || node.data?.branchId === undefined,
      );
      const solidifiedEdges = edges.filter(
        (edge) => edge.data?.branchId === branchId || edge.data?.branchId === undefined,
      );
      const branchRootNode = getOutgoers(parentNode[0], solidifiedNodes, solidifiedEdges);
      const finalNodes: Node<FaultTreeNodeProps>[] = solidifiedNodes
        .filter((node) => node.id !== parentNode[0].id)
        .map(({ data: _data, ...node }) => ({
          ...node,
          data: { isGrayed: undefined, branchId: undefined },
        }));
      const finalEdges: Edge<FaultTreeNodeProps>[] = solidifiedEdges
        .filter((edge) => {
          return edge.source !== notGateNode.id && edge.source !== parentNode[0].id;
        })
        .map(({ data: _data, animated: _animated, ...edge }) => ({
          ...edge,
          animated: false,
          data: { isGrayed: undefined, branchId: undefined },
        }));
      const childEdge: Edge<FaultTreeNodeProps> = getWorkflowEdge(notGateNode.id, branchRootNode[0].id);
      finalEdges.push(childEdge);
      setNodes(finalNodes);
      setEdges(finalEdges);
      await GraphApiManager.storeFaultTree(
        FaultTreeState({
          nodes: finalNodes,
          edges: finalEdges,
          faultTreeId: faultTreeId ?? "",
        }),
      );
    },
    [edges, faultTreeId, nodes, setEdges, setNodes],
  );
  return { handleGrayedNodeClick };
};
export { UseGrayedNodeClick };
