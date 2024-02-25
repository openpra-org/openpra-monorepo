import { useCallback } from "react";
import {
  Node,
  Edge,
  NodeProps,
  useReactFlow,
  getConnectedEdges,
  getOutgoers,
} from "reactflow";
import { useParams } from "react-router-dom";
import { EventSequenceNodeProps } from "../../components/treeNodes/eventSequenceNodes/eventSequenceNodeType";
import {
  BuildAnEdge,
  GetIncomingEdge,
  GetParentNode,
  GetSubgraph,
  StoreEventSequenceDiagramCurrentState,
} from "../../../utils/treeUtils";

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
function UseNodeClick(
  id: NodeProps["id"],
  data: EventSequenceNodeProps,
): () => void {
  const { getNode, getNodes, getEdges, setNodes, setEdges } = useReactFlow();
  const { eventSequenceId } = useParams() as { eventSequenceId: string };

  return useCallback((): void => {
    const node: Node<EventSequenceNodeProps> | undefined = getNode(id);
    const currentNodes: Node<EventSequenceNodeProps>[] = getNodes();
    const currentEdges: Edge[] = getEdges();
    if (node === undefined) return;

    // a tentatively deleted node is clicked
    if (data.tentative) {
      // get parent node
      const functionalNode: Node<EventSequenceNodeProps> = GetParentNode(
        node,
        currentNodes,
        currentEdges,
      );
      // if the parent node is the one that was selected to be deleted
      if (functionalNode.data.isDeleted) {
        // the child node clicked will be retained, the other child node and its subgraph to be deleted
        const children: Node<EventSequenceNodeProps>[] = getOutgoers(
          functionalNode,
          currentNodes,
          currentEdges,
        );
        const connectedEdges: Edge[] = getConnectedEdges(
          [functionalNode],
          currentEdges,
        );

        let updatedNodes: Node[] = [];
        let updatedEdges: Edge[] = [];
        let deletedNodes: Node[] = [functionalNode];
        let deletedEdges: Edge[] = [...connectedEdges];

        // retain the child and its subgraph which was clicked, discard remaining children and their subgraph
        for (const child of children) {
          if (child.id === node.id) {
            // this is the selected child
            const { nodes, edges } = GetSubgraph(
              child,
              currentNodes,
              currentEdges,
            );
            const incomingEdgeOfParent = GetIncomingEdge(
              functionalNode,
              connectedEdges,
            );
            const parentNode = GetParentNode(
              functionalNode,
              currentNodes,
              currentEdges,
            );

            updatedNodes = [...nodes, child].map(
              (node: Node<EventSequenceNodeProps>) => ({ ...node, data: {} }),
            );
            updatedEdges = [
              ...edges,
              BuildAnEdge(
                parentNode,
                child,
                incomingEdgeOfParent.type,
                incomingEdgeOfParent.label,
              ),
            ].map((edge: Edge) => ({ ...edge, data: {} }));
          } else {
            // this child and its subgraph needs to be removed
            const { nodes, edges } = GetSubgraph(
              child,
              currentNodes,
              currentEdges,
            );
            deletedNodes = deletedNodes.concat(child, ...nodes);
            deletedEdges = deletedEdges.concat(...edges);
          }
        }

        const finalNodes = currentNodes
          .filter(
            (node) =>
              ![...deletedNodes, ...updatedNodes].some((n) => n.id === node.id),
          )
          .concat(...updatedNodes);
        const finalEdges = currentEdges
          .filter(
            (edge) =>
              ![...deletedEdges, ...updatedEdges].some((e) => e.id === edge.id),
          )
          .concat(...updatedEdges);
        setNodes(finalNodes);
        setEdges(finalEdges);

        StoreEventSequenceDiagramCurrentState(
          eventSequenceId,
          finalNodes,
          finalEdges,
        );
      }
    }
  }, [
    data.tentative,
    eventSequenceId,
    getEdges,
    getNode,
    getNodes,
    id,
    setEdges,
    setNodes,
  ]);
}

export { UseNodeClick };
