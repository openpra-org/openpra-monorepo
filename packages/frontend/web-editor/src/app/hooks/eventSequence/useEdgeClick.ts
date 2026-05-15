import { Node, EdgeProps, useReactFlow, Edge } from "reactflow";
import { useParams } from "react-router-dom";
import {
  BuildAnEdge,
  GenerateUUID,
  GetESToast,
  IsCurrentStateTentative,
  RevertTentativeState,
  UpdateEventSequenceDiagram,
} from "../../../utils/treeUtils";
import {
  EventSequenceNodeProps,
  EventSequenceNodeTypes,
} from "../../components/treeNodes/eventSequenceNodes/eventSequenceNodeType";
import { EventSequenceEdgeProps } from "../../components/treeEdges/eventSequenceEdges/eventSequenceEdgeType";
import { UseToastContext } from "../../providers/toastProvider";
import { UseFocusContext } from "../../providers/focusProvider";
function UseEdgeClick(id: EdgeProps["id"]): () => void {
  const { setEdges, setNodes, getNode, getEdge, getEdges, getNodes } = useReactFlow();
  const { eventSequenceId } = useParams() as {
    eventSequenceId: string;
  };
  const { addToast } = UseToastContext();
  const { setFocus } = UseFocusContext();
  return (): void => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    if (IsCurrentStateTentative(currentNodes, currentEdges)) {
      addToast(GetESToast("primary", "Reverting the tentative state."));
      const { updatedState } = RevertTentativeState(currentNodes, currentEdges);
      setNodes(updatedState.nodes);
      setEdges(updatedState.edges);
    }
    const edge: Edge<EventSequenceEdgeProps> | undefined = getEdge(id);
    if (!edge) {
      return;
    }
    const sourceNode: Node<EventSequenceNodeProps> | undefined = getNode(edge.source);
    if (!sourceNode) {
      return;
    }
    const targetNode: Node<EventSequenceNodeProps> | undefined = getNode(edge.target);
    if (!targetNode) {
      return;
    }
    const insertNodeId = GenerateUUID();
    const insertNode: Node<EventSequenceNodeProps, EventSequenceNodeTypes> = {
      id: insertNodeId,
      position: { x: targetNode.position.x, y: targetNode.position.y },
      data: {
        label: "Description",
      },
      type: "description",
    };
    const sourceEdge: Edge = BuildAnEdge(sourceNode, insertNode, edge.type, edge.data);
    const targetEdge: Edge = BuildAnEdge(insertNode, targetNode, "normal", {});
    const targetNodeIndex = currentNodes.findIndex((node) => node.id === edge.target);
    const nodes = [
      ...currentNodes.slice(0, targetNodeIndex),
      insertNode,
      ...currentNodes.slice(targetNodeIndex, currentNodes.length),
    ];
    const edges = currentEdges.filter((e) => e.id !== id).concat([sourceEdge, targetEdge]);
    setFocus(insertNode.id);
    setNodes(nodes);
    setEdges(edges);
    UpdateEventSequenceDiagram(
      eventSequenceId,
      { nodes: [insertNode], edges: [sourceEdge, targetEdge] },
      { nodes: [], edges: [edge] },
    )
      .then((r) => {
        if (!r) {
          addToast(GetESToast("danger", "Something went wrong"));
        }
      })
      .catch(() => {
        addToast(GetESToast("danger", "Something went wrong"));
      });
  };
}
export { UseEdgeClick };
