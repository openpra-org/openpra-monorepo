import { useCallback } from "react";
import { Node, Edge, NodeProps, useReactFlow, getConnectedEdges, getOutgoers } from "reactflow";
import { useParams } from "react-router-dom";
import { EventSequenceNodeProps } from "../../components/treeNodes/eventSequenceNodes/eventSequenceNodeType";
import {
  BuildAnEdge,
  GetESToast,
  GetIncomingEdge,
  GetParentNode,
  GetSubgraph,
  UpdateEventSequenceDiagram,
} from "../../../utils/treeUtils";
import { EventSequenceEdgeProps } from "../../components/treeEdges/eventSequenceEdges/eventSequenceEdgeType";
import { UseToastContext } from "../../providers/toastProvider";
import { UseFocusContext } from "../../providers/focusProvider";
function UseNodeClick(id: NodeProps["id"], data: EventSequenceNodeProps): () => void {
  const { getNode, getNodes, getEdges, setNodes, setEdges } = useReactFlow();
  const { eventSequenceId } = useParams() as {
    eventSequenceId: string;
  };
  const { addToast } = UseToastContext();
  const { setFocus } = UseFocusContext();
  return useCallback((): void => {
    const node: Node<EventSequenceNodeProps> | undefined = getNode(id);
    const currentNodes: Node<EventSequenceNodeProps>[] = getNodes();
    const currentEdges: Edge[] = getEdges();
    if (node === undefined) return;
    if (data.branchId !== undefined) {
      const functionalNode: Node<EventSequenceNodeProps> | undefined = currentNodes.find(
        (node) => node.data.branchId === undefined && node.data.tentative === true,
      );
      if (functionalNode === undefined) return;
      if (functionalNode.data.isDeleted === true || functionalNode.data.isUpdated === true) {
        const children: Node<EventSequenceNodeProps>[] = getOutgoers(functionalNode, currentNodes, currentEdges);
        const connectedEdges: Edge[] = getConnectedEdges([functionalNode], currentEdges);
        let updatedNodes: Node[] = [];
        let updatedEdges: Edge[] = [];
        let deletedNodes: Node[] = [];
        let deletedEdges: Edge[] = [];
        for (const child of children) {
          if (child.id === node.id) {
            const { nodes, edges } = GetSubgraph(child, currentNodes, currentEdges);
            const incomingEdgeOfParent = GetIncomingEdge(functionalNode, connectedEdges);
            const parentNode = GetParentNode(functionalNode, currentNodes, currentEdges);
            if (functionalNode.data.isUpdated) {
              updatedNodes = [...nodes, functionalNode, child].map((node: Node<EventSequenceNodeProps>) => ({
                ...node,
                data: { label: node.data.label },
              }));
              updatedEdges = [...edges, ...connectedEdges.filter((edge) => edge.target === node.id)].map(
                (edge: Edge<EventSequenceEdgeProps>) => {
                  if (edge.target === node.id) {
                    return {
                      ...edge,
                      type: "normal",
                      animated: false,
                      data: {
                        ...edge.data,
                        tentative: false,
                        label: undefined,
                        branchId: undefined,
                      },
                    };
                  }
                  return {
                    ...edge,
                    animated: false,
                    data: { ...edge.data, tentative: false, branchId: undefined },
                  };
                },
              );
              deletedEdges = connectedEdges.filter(
                (edge) => edge.source === functionalNode.id && edge.target !== node.id,
              );
            } else {
              updatedNodes = [...nodes, child].map((node: Node<EventSequenceNodeProps>) => ({
                ...node,
                animated: false,
                data: {
                  ...node.data,
                  tentative: false,
                  isDeleted: false,
                  isUpdated: false,
                  branchId: undefined,
                },
              }));
              updatedEdges = [
                ...edges,
                BuildAnEdge(parentNode, child, incomingEdgeOfParent.type, incomingEdgeOfParent.data),
              ].map((edge: Edge<EventSequenceEdgeProps>) => ({
                ...edge,
                animated: false,
                data: { ...edge.data, tentative: false, branchId: undefined },
              }));
              deletedNodes = deletedNodes.concat(functionalNode);
              deletedEdges = deletedEdges.concat(...connectedEdges);
            }
          } else {
            const { nodes, edges } = GetSubgraph(child, currentNodes, currentEdges);
            deletedNodes = deletedNodes.concat(child, ...nodes);
            deletedEdges = deletedEdges.concat(...edges);
          }
        }
        const finalNodes = currentNodes
          .filter((node) => ![...deletedNodes, ...updatedNodes].some((n) => n.id === node.id))
          .concat(...updatedNodes);
        const finalEdges = currentEdges
          .filter((edge) => ![...deletedEdges, ...updatedEdges].some((e) => e.id === edge.id))
          .concat(...updatedEdges);
        setNodes(finalNodes);
        setEdges(finalEdges);
        UpdateEventSequenceDiagram(
          eventSequenceId,
          { nodes: updatedNodes, edges: updatedEdges },
          { nodes: deletedNodes, edges: deletedEdges },
        )
          .then((r) => {
            if (!r) {
              addToast(GetESToast("danger", "Something went wrong"));
            }
          })
          .catch(() => {
            addToast(GetESToast("danger", "Something went wrong"));
          });
      }
      setFocus(node.id);
    }
  }, [addToast, data, eventSequenceId, getEdges, getNode, getNodes, id, setEdges, setFocus, setNodes]);
}
export { UseNodeClick };
