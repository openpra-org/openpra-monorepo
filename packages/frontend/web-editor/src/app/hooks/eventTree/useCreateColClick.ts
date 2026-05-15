import { Edge, NodeProps, Node, useReactFlow } from "reactflow";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { useParams } from "react-router-dom";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { EventTreeState, GenerateUUID } from "../../../utils/treeUtils";
import { UseToastContext } from "../../providers/toastProvider";
import { useEventTreeStore } from "./useEventTreeStore";
interface EventTreeNodeData {
  label?: string;
  depth: number;
  width: number;
  output?: boolean;
  allowAdd?: boolean;
  allowDelete?: boolean;
  inputDepth?: number;
  outputDepth?: number;
  isSequenceId?: boolean;
}
function useCreateColClick(clickedNodeId: NodeProps["id"]): () => void {
  const { setNodes, setEdges, getNodes, getEdges, getNode } = useReactFlow();
  const { eventTreeId } = useParams() as {
    eventTreeId: string;
  };
  const { addToast } = UseToastContext();
  const functionalEvents = useEventTreeStore((s) => s.functionalEvents);
  const addCol: () => void = () => {
    const nodeData = getNodes() as Node<EventTreeNodeData>[];
    let edges = getEdges();
    const clickedNode = getNode(clickedNodeId) as Node<EventTreeNodeData> | undefined;
    if (!clickedNode) return;
    const currentDepth = clickedNode.data.depth;
    const nextColumnNodes = nodeData.filter(
      (node) => node.type !== "columnNode" && node.data.depth === currentDepth + 1,
    );
    const hasOnlyInvisibleNodes =
      nextColumnNodes.length > 0 && nextColumnNodes.every((node) => node.type === "invisibleNode");
    if (hasOnlyInvisibleNodes) {
      addToast({
        id: GenerateUUID(),
        title: "Warning",
        color: "warning",
        text: "Cannot create a new functional event with an existing empty functional event",
      });
      return;
    }
    const nodes: Node<EventTreeNodeData>[] = [];
    const cols: Node<EventTreeNodeData>[] = [];
    nodeData.forEach((node) => {
      if (node.type === "columnNode" || node.type === "columnActionsNode") {
        cols.push(node);
      } else {
        nodes.push(node);
      }
    });
    const newNodes: Node<EventTreeNodeData>[] = [];
    const newEdges: Edge[] = [];
    let lastIndexOfPrevDepth = -1;
    let indexOfPrevCol = -1;
    const clickedNodeEdge = edges.find((edge) => edge.source === clickedNodeId);
    const clickedDepth = clickedNode.data.depth;
    const newColNodeId = GenerateUUID();
    nodes.forEach((node, index) => {
      if (node.data.depth === clickedDepth) {
        lastIndexOfPrevDepth = index;
      } else if (node.data.depth > clickedDepth) {
        node.data.depth = node.data.depth + 1;
        if (node.type === "visibleNode" && node.data.isSequenceId) {
          node.data.isSequenceId = false;
        }
      }
    });
    nodes.forEach((node) => {
      if (node.data.depth === clickedDepth) {
        const newNodeId = GenerateUUID();
        const newInvisibleNode: Node<EventTreeNodeData> = {
          id: newNodeId,
          type: clickedNode.data.output ? "outputNode" : "invisibleNode",
          data: {
            depth: clickedDepth + 1,
            width: node.data.width,
          },
          position: {
            x: node.position.x,
            y: node.position.y,
          },
        };
        newNodes.push(newInvisibleNode);
        edges.forEach((edge) => {
          if (edge.source === node.id) {
            const oldData = edge.data as
              | {
                  branchState?: string;
                  feId?: string;
                }
              | undefined;
            newEdges.push({
              id: `${newNodeId}-${edge.target}`,
              source: newNodeId,
              target: edge.target,
              type: "custom",
              animated: false,
              data: { branchState: oldData?.branchState ?? "bypass", feId: oldData?.feId },
            });
          }
        });
        newEdges.push({
          id: `${node.id}-${newNodeId}`,
          source: node.id,
          target: newNodeId,
          type: "custom",
          animated: false,
          data: { branchState: "bypass", feId: newColNodeId },
        });
        edges = edges.filter((e) => e.source !== node.id);
      }
    });
    const newColNode: Node<EventTreeNodeData> = {
      id: newColNodeId,
      type: "columnNode",
      data: {
        label: clickedNode.data.output ? `End State ` : `Functional Event `,
        depth: clickedDepth + 1,
        width: clickedNode.data.width,
        output: clickedNode.data.output,
        allowAdd: true,
        allowDelete: !clickedNode.data.output && clickedDepth + 1 !== 1,
      },
      position: {
        x: clickedNode.position.x,
        y: clickedNode.position.y,
      },
    };
    const newColEdges: Edge[] = [
      {
        id: `${clickedNodeId}-${newColNodeId}`,
        source: clickedNodeId,
        target: newColNodeId,
        type: "custom",
        animated: false,
        data: {
          hidden: true,
        },
      },
      {
        id: clickedNodeEdge ? `${newColNodeId}-${clickedNodeEdge.target}` : "",
        source: newColNodeId,
        target: clickedNodeEdge ? clickedNodeEdge.target : "",
        type: "custom",
        animated: false,
        data: {
          hidden: true,
        },
      },
    ];
    edges = edges.filter((e) => e.source !== clickedNodeId).concat([...newColEdges, ...newEdges]);
    cols.forEach((node, index) => {
      if (node.data.depth === clickedDepth) {
        indexOfPrevCol = index;
      } else if (node.data.depth > clickedDepth) {
        node.data.depth = node.data.depth + 1;
      }
    });
    nodes.splice(lastIndexOfPrevDepth + 1, 0, ...newNodes);
    cols.splice(indexOfPrevCol + 1, 0, newColNode);
    const rootNode = nodes.find((node) => node.data.depth === 1);
    if (!rootNode) {
      return;
    }
    if (clickedNode.data.output === true) {
      rootNode.data.outputDepth = (rootNode.data.outputDepth ?? 0) + 1;
    } else {
      rootNode.data.inputDepth = (rootNode.data.inputDepth ?? 0) + 1;
    }
    const updatedNodes = [...nodes, ...cols];
    setNodes(updatedNodes);
    setEdges(edges);
    const eventTreeCurrentState: EventTreeGraph = EventTreeState({
      eventTreeId: eventTreeId,
      nodes: updatedNodes,
      edges: edges,
      functionalEvents,
    });
    void GraphApiManager.storeEventTree(eventTreeCurrentState).then(() => {});
  };
  return addCol;
}
export default useCreateColClick;
