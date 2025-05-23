import { useParams } from "react-router-dom";
import { Edge, EdgeProps, Node, useReactFlow } from "reactflow";

import {
  BuildAnEdge,
  GenerateUUID,
  GetESToast,
  IsCurrentStateTentative,
  RevertTentativeState,
  UpdateEventSequenceDiagram,
} from "../../../utils/treeUtils";
import { EventSequenceEdgeProps } from "../../components/treeEdges/eventSequenceEdges/eventSequenceEdgeType";
import {
  EventSequenceNodeProps,
  EventSequenceNodeTypes,
} from "../../components/treeNodes/eventSequenceNodes/eventSequenceNodeType";
import { UseFocusContext } from "../../providers/focusProvider";
import { UseToastContext } from "../../providers/toastProvider";

/**
 * Hook for handling click events on edges in a React Flow diagram.
 *
 * This hook provides a function, `handleEdgeClick`, that can be used to perform actions when an edge is clicked.
 * It utilizes the React Flow library for managing nodes and edges in a flowchart-like UI.
 *
 * @param id - The unique identifier of the clicked edge.
 * @returns A function (`handleEdgeClick`) to be used as an event handler for edge click events.
 *
 * @example
 * ```
 * const handleEdgeClick = useEdgeClick(uniqueEdgeId, addToastHandler);
 * <Edge onClick={handleEdgeClick} />;
 * ```
 */
function UseEdgeClick(id: EdgeProps["id"]): () => void {
  const { setEdges, setNodes, getNode, getEdge, getEdges, getNodes } = useReactFlow();
  const { eventSequenceId } = useParams() as { eventSequenceId: string };
  const { addToast } = UseToastContext();
  const { setFocus } = UseFocusContext();

  return (): void => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();

    // if the current state is tentative, disallow creation of new node
    if (IsCurrentStateTentative(currentNodes, currentEdges)) {
      // show toast message
      addToast(GetESToast("primary", "Reverting the tentative state."));
      const { updatedState } = RevertTentativeState(currentNodes, currentEdges);
      setNodes(updatedState.nodes);
      setEdges(updatedState.edges);
    }

    // first we retrieve the edge object to get the source and target id
    const edge: Edge<EventSequenceEdgeProps> | undefined = getEdge(id);

    if (!edge) {
      return;
    }

    const sourceNode: Node<EventSequenceNodeProps> | undefined = getNode(edge.source);

    if (!sourceNode) {
      return;
    }

    // we retrieve the target node to get its position
    const targetNode: Node<EventSequenceNodeProps> | undefined = getNode(edge.target);

    if (!targetNode) {
      return;
    }

    // create a unique id for newly added elements
    const insertNodeId = GenerateUUID();

    // this is the node object that will be added in between source and target node
    const insertNode: Node<EventSequenceNodeProps, EventSequenceNodeTypes> = {
      id: insertNodeId,
      // we place the node at the current position of the target (prevents jumping)
      position: { x: targetNode.position.x, y: targetNode.position.y },
      data: {
        label: "Description",
      },
      type: "description",
    };

    // new connection from source to new node
    const sourceEdge: Edge = BuildAnEdge(sourceNode, insertNode, edge.type, edge.data);

    // new connection from new node to target
    const targetEdge: Edge = BuildAnEdge(insertNode, targetNode, "normal", {});

    // insert the node between the source and target node in the react-flow state
    const targetNodeIndex = currentNodes.findIndex((node) => node.id === edge.target);
    const nodes = [
      ...currentNodes.slice(0, targetNodeIndex),
      insertNode,
      ...currentNodes.slice(targetNodeIndex, currentNodes.length),
    ];

    // remove the edge that was clicked as we have a new connection with a node in between
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
