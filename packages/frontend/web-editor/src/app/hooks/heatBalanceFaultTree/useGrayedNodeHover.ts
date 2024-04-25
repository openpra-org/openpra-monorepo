import { Edge, Node, NodeProps } from "reactflow";
import { useStore } from "../../store/heatBalanceFaultTreeStore";
import { HeatBalanceFaultTreeNodeProps } from "../../components/treeNodes/heatBalancefaultTreeNodes/heatBalanceFaultTreeNodeType";
import { isSubgraphGrayed } from "../../../utils/treeUtils";

/**
 * Hook for handling grayed node hover functionality.
 *
 * This hook provides two functions - `handleMouseEnter` and `handleMouseLeave` which are used to implement hover functionality.
 * When mouse is hovered over a grayed node, the entire branch of that node is solidified.
 * @param id - The unique identifier for each node.
 * @example
 * ```typescript
 * const { handleMouseEnter, handleMouseLeave } = UseGrayedNodeHover(id);
 * ```
 */
const UseGrayedNodeHover = (id: NodeProps["id"]) => {
  const { nodes, edges, setNodes, setEdges } = useStore();

  if (isSubgraphGrayed(nodes, edges)) {
    const handleMouseEnter = (branchId: string | undefined) => {
      if (branchId !== undefined) {
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

        const solidEdges: Edge<HeatBalanceFaultTreeNodeProps>[] = edges.map(
          (edge) => {
            if (
              edge.data &&
              edge.data.isGrayed === true &&
              edge.data.branchId === branchId
            ) {
              edge.data.isGrayed = false;
              edge.animated = false;
            }
            return edge;
          },
        );

        setNodes(solidNodes);
        setEdges(solidEdges);
      }
    };

    const handleMouseLeave = (branchId: string | undefined) => {
      if (branchId !== undefined) {
        const grayedNodes: Node<HeatBalanceFaultTreeNodeProps>[] = nodes.map(
          (node) => {
            if (
              node.data.isGrayed !== undefined &&
              !node.data.isGrayed &&
              node.data.branchId === branchId
            ) {
              node.data.isGrayed = true;
            }
            return node;
          },
        );

        const grayedEdges: Edge<HeatBalanceFaultTreeNodeProps>[] = edges.map(
          (edge) => {
            if (
              edge.data !== undefined &&
              edge.data.isGrayed === false &&
              edge.data.branchId === branchId
            ) {
              edge.data.isGrayed = true;
              edge.animated = true;
            }
            return edge;
          },
        );

        setNodes(grayedNodes);
        setEdges(grayedEdges);
      }
    };

    return { handleMouseEnter, handleMouseLeave };
  }

  return {
    handleMouseEnter: () => {},
    handleMouseLeave: () => {},
  };
};

export { UseGrayedNodeHover };
