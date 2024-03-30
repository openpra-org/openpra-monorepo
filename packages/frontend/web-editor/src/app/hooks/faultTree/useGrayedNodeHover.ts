import { Edge, Node, NodeProps } from "reactflow";
import { useCallback } from "react";
import { useStore } from "../../store/faultTreeStore";
import { FaultTreeNodeProps } from "../../components/treeNodes/faultTreeNodes/faultTreeNodeType";

const UseGrayedNodeHover = (id: NodeProps["id"]) => {
  const { nodes, edges, setNodes, setEdges } = useStore();

  const handleMouseEnter = useCallback(
    (branchId: string | undefined) => {
      const solidNodes = nodes.map((node) => {
        if (
          node.data.branchId !== undefined &&
          node.data.isGrayed === true &&
          node.data.branchId === branchId
        ) {
          node.data.isGrayed = false;
        }
        return node;
      });

      const solidEdges: Edge<FaultTreeNodeProps>[] = edges.map((edge) => {
        if (
          edge.data &&
          edge.data.isGrayed === true &&
          edge.data.branchId === branchId
        ) {
          edge.data.isGrayed = false;
          edge.animated = false;
        }
        return edge;
      });

      setNodes(solidNodes);
      setEdges(solidEdges);
    },
    [edges, nodes, setEdges, setNodes],
  );

  const handleMouseLeave = useCallback(
    (branchId: string | undefined) => {
      const grayedNodes: Node<FaultTreeNodeProps>[] = nodes.map((node) => {
        if (
          node.data.isGrayed !== undefined &&
          !node.data.isGrayed &&
          node.data.branchId === branchId
        ) {
          node.data.isGrayed = true;
        }
        return node;
      });

      const grayedEdges: Edge<FaultTreeNodeProps>[] = edges.map((edge) => {
        if (
          edge.data !== undefined &&
          edge.data.isGrayed === false &&
          edge.data.branchId === branchId
        ) {
          edge.data.isGrayed = true;
          edge.animated = true;
        }
        return edge;
      });

      setNodes(grayedNodes);
      setEdges(grayedEdges);
    },
    [edges, nodes, setEdges, setNodes],
  );

  return { handleMouseEnter, handleMouseLeave };
};

export { UseGrayedNodeHover };
