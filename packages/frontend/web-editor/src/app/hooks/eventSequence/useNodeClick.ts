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

/**
 * Hook for handling click events on nodes in a React Flow diagram.
 *
 * This hook provides a function, `onClick`, that can be used as an event handler for node click events.
 * It retrieves information about the clicked node using the `useReactFlow` hook.
 *
 * @param id - The unique identifier of the clicked node.
 * @param data - data and attributes of the node.
 * @returns A function (`onClick`) to be used as an event handler for node click events.
 */
function UseNodeClick(id: NodeProps["id"], data: EventSequenceNodeProps): () => void {
  const { getNode, getNodes, getEdges, setNodes, setEdges } = useReactFlow();
  const { eventSequenceId } = useParams() as { eventSequenceId: string };
  const { addToast } = UseToastContext();
  const { setFocus } = UseFocusContext();

  return useCallback((): void => {
    const node: Node<EventSequenceNodeProps> | undefined = getNode(id);
    const currentNodes: Node<EventSequenceNodeProps>[] = getNodes();
    const currentEdges: Edge[] = getEdges();
    if (node === undefined) return;

    // a tentatively updated/deleted node is clicked
    if (data.branchId !== undefined) {
      // get parent node
      const functionalNode: Node<EventSequenceNodeProps> | undefined = currentNodes.find(
        (node) => node.data.branchId === undefined && node.data.tentative === true,
      );
      if (functionalNode === undefined) return;

      // if the parent node is the one that was selected to be updated/deleted
      if (functionalNode.data.isDeleted === true || functionalNode.data.isUpdated === true) {
        // the child node clicked will be retained, the other child node and its subgraph to be deleted
        const children: Node<EventSequenceNodeProps>[] = getOutgoers(functionalNode, currentNodes, currentEdges);
        const connectedEdges: Edge[] = getConnectedEdges([functionalNode], currentEdges);

        let updatedNodes: Node[] = [];
        let updatedEdges: Edge[] = [];
        let deletedNodes: Node[] = [];
        let deletedEdges: Edge[] = [];

        // retain the child and its subgraph which was clicked, discard remaining children and their subgraph
        for (const child of children) {
          if (child.id === node.id) {
            // this is the selected child
            const { nodes, edges } = GetSubgraph(child, currentNodes, currentEdges);
            const incomingEdgeOfParent = GetIncomingEdge(functionalNode, connectedEdges);
            const parentNode = GetParentNode(functionalNode, currentNodes, currentEdges);

            // function node was updated
            if (functionalNode.data.isUpdated) {
              // keep the functional node and the current child and its subgraph, reset the tentative flags
              updatedNodes = [...nodes, functionalNode, child].map((node: Node<EventSequenceNodeProps>) => ({
                ...node,
                data: { label: node.data.label },
              }));
              // keep the current child subgraph's edges and the edge connecting the functional node to current child
              // update this edge to a normal edge since the node is not a functional node anymore
              // reset the tentative flags of all subgraph edges
              updatedEdges = [...edges, ...connectedEdges.filter((edge) => edge.target === node.id)].map(
                (edge: Edge<EventSequenceEdgeProps>) => {
                  if (edge.target === node.id) {
                    // this edge connects the functional node to the selected child node, make it a normal edge
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
              // remove the edge(s) sourced from the functional node
              // which are not targeted for the selected child node
              deletedEdges = connectedEdges.filter(
                (edge) => edge.source === functionalNode.id && edge.target !== node.id,
              );
            } else {
              // functional node was deleted
              // update the tentative flags for the child node and its subgraph
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
              // update the tentative flags for the child node subgraph's edges
              // also build an edge directly from the functional node's parent to the selected child node
              updatedEdges = [
                ...edges,
                BuildAnEdge(parentNode, child, incomingEdgeOfParent.type, incomingEdgeOfParent.data),
              ].map((edge: Edge<EventSequenceEdgeProps>) => ({
                ...edge,
                animated: false,
                data: { ...edge.data, tentative: false, branchId: undefined },
              }));
              // delete the functional node
              deletedNodes = deletedNodes.concat(functionalNode);
              // delete the connected edges from the functional node
              deletedEdges = deletedEdges.concat(...connectedEdges);
            }
          } else {
            // this child and its subgraph needs to be removed
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
  }, [
    addToast,
    data.branchId,
    data.tentative,
    eventSequenceId,
    getEdges,
    getNode,
    getNodes,
    id,
    setEdges,
    setFocus,
    setNodes,
  ]);
}

export { UseNodeClick };
