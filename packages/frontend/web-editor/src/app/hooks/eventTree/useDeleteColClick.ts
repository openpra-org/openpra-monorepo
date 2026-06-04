import { useReactFlow, Node, Edge } from "reactflow";
import { useParams } from "react-router-dom";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { EventTreeState } from "../../../utils/treeUtils";
import { UseToastContext } from "../../providers/toastProvider";
import { GenerateUUID } from "../../../utils/treeUtils";
import { useEventTreeStore } from "./useEventTreeStore";
function useDeleteColClick(clickedColumnId: string): () => void {
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as {
    eventTreeId: string;
  };
  const { addToast } = UseToastContext();
  const functionalEvents = useEventTreeStore((s) => s.functionalEvents);
  interface EventTreeNodeData {
    depth: number;
    inputDepth?: number;
  }
  const deleteColumn = (): void => {
    const nodes = getNodes() as Node<EventTreeNodeData>[];
    const edges = getEdges();
    const clickedColumn = nodes.find((node) => node.id === clickedColumnId);
    if (!clickedColumn) return;
    const columnDepth = clickedColumn.data.depth;
    const nodesInColumn = nodes.filter((node) => node.data.depth === columnDepth);
    const hasVisibleNodes = nodesInColumn.some((node) => node.type === "visibleNode");
    if (hasVisibleNodes) {
      addToast({
        id: GenerateUUID(),
        title: "Warning",
        color: "warning",
        text: "Cannot delete a non-empty functional event",
      });
      return;
    }
    let currentNodes: Node<EventTreeNodeData>[] = [...nodes];
    let currentEdges: Edge[] = [...edges];
    const invisibleNodes = nodesInColumn.filter((node) => node.type === "invisibleNode");
    invisibleNodes.forEach((invisibleNode) => {
      const incomingEdges = currentEdges.filter((edge) => edge.target === invisibleNode.id);
      const outgoingEdges = currentEdges.filter((edge) => edge.source === invisibleNode.id);
      incomingEdges.forEach((inEdge) => {
        outgoingEdges.forEach((outEdge) => {
          currentEdges.push({
            id: `${inEdge.source}-${outEdge.target}`,
            source: inEdge.source,
            target: outEdge.target,
            type: "custom",
            animated: false,
          });
        });
      });
      currentEdges = currentEdges.filter(
        (edge) => edge.source !== invisibleNode.id && edge.target !== invisibleNode.id,
      );
    });
    currentNodes = currentNodes.filter((node) => node.type !== "invisibleNode" || node.data.depth !== columnDepth);
    const prevColumnNode = currentNodes.find(
      (node) => node.type === "columnNode" && node.data.depth === columnDepth - 1,
    );
    const chainEdge = currentEdges.find(
      (e) =>
        e.source === clickedColumnId &&
        currentNodes.find((n) => n.id === e.target && (n.type === "columnNode" || n.type === "columnActionsNode")),
    );
    const nextColumnNode = chainEdge ? currentNodes.find((n) => n.id === chainEdge.target) : undefined;
    if (prevColumnNode && nextColumnNode) {
      currentEdges.push({
        id: `${prevColumnNode.id}-${nextColumnNode.id}`,
        source: prevColumnNode.id,
        target: nextColumnNode.id,
        type: "custom",
        animated: false,
        data: { hidden: true },
      });
    }
    currentNodes = currentNodes.filter((node) => node.data.depth !== columnDepth);
    currentEdges = currentEdges.filter((edge) => edge.source !== clickedColumnId && edge.target !== clickedColumnId);
    currentNodes = currentNodes.map((node) => {
      if (node.data.depth > columnDepth) {
        return { ...node, data: { ...node.data, depth: node.data.depth - 1 } };
      }
      return node;
    });
    const rootNode = currentNodes.find((node) => node.data.depth === 1);
    if (rootNode && typeof rootNode.data.inputDepth === "number") {
      rootNode.data.inputDepth -= 1;
    }
    setNodes(currentNodes);
    setEdges(currentEdges);
    void GraphApiManager.storeEventTree(
      EventTreeState({
        eventTreeId,
        nodes: currentNodes,
        edges: currentEdges,
        functionalEvents,
      }),
    );
  };
  return deleteColumn;
}
export default useDeleteColClick;
