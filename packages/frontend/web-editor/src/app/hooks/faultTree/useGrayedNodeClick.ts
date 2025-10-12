import { Edge, getOutgoers, Node, NodeProps } from "reactflow";
import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { useStore } from "../../store/faultTreeStore";
import { FaultTreeState, GetParentNode, getWorkflowEdge } from "../../../utils/treeUtils";
import { FaultTreeNodeProps } from "../../components/treeNodes/faultTreeNodes/faultTreeNodeType";

/**
 * Hook handling click event on a grayed node.
 *
 * This hook provides a function `handleGrayedNodeClick` that is triggered when a grayed out node is clicked, and it solidifies
 * the entire branch in which this node belongs (re-colours the nodes and edges of the branch).
 *
 * @param id - The unique identifier for each node.
 * @example
 * ```
 * const { handleGrayedNodeClick } = UseGrayedNodeClick(id);
 * ```
 */
const UseGrayedNodeClick = (id: NodeProps["id"]) => {
  const { nodes, edges, setNodes, setEdges } = useStore();
  const { faultTreeId } = useParams();
  //Solidifies the branch of the clicked node, takes in the branchId of the clicked node as a parameter
  const handleGrayedNodeClick = useCallback(
    async (branchId: string | undefined) => {
      //loop through all nodes to find the parent (the node to be deleted)
      const parentNode = nodes.filter((node) => node.data?.branchId === undefined && node.data?.isGrayed === true);

      //get parent of parent node (the NOT gate)
      const notGateNode = GetParentNode(parentNode[0], nodes, edges);

      //filter out the unwanted branches
      const solidifiedNodes = nodes.filter(
        (node) => node.data?.branchId === branchId || node.data?.branchId === undefined,
      );
      const solidifiedEdges = edges.filter(
        (edge) => edge.data?.branchId === branchId || edge.data?.branchId === undefined,
      );

      //from the remaining nodes, find outgoer of parentNode (there should be only 1)
      //we need this to connect it as a child of the NOT gate
      const branchRootNode = getOutgoers(parentNode[0], solidifiedNodes, solidifiedEdges);

      //filter out the parentNode (deleting the node which we wanted)
      const finalNodes: Node<FaultTreeNodeProps>[] = solidifiedNodes
        .filter((node) => node.id !== parentNode[0].id)
        .map(({ data, ...node }) => ({
          ...node,
          data: { isGrayed: undefined, branchId: undefined },
        }));
      const finalEdges: Edge<FaultTreeNodeProps>[] = solidifiedEdges
        .filter((edge) => {
          return edge.source !== notGateNode.id && edge.source !== parentNode[0].id;
        })
        .map(({ data, animated, ...edge }) => ({
          ...edge,
          animated: false,
          data: { isGrayed: undefined, branchId: undefined },
        }));

      //create an edge from notGateNode to the branchRootNode
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
