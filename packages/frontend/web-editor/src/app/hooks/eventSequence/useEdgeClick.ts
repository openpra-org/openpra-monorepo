import { EdgeProps, useReactFlow } from "reactflow";
import { useParams } from "react-router-dom";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { EventSequenceGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { EventSequenceState, GenerateUUID } from "../../../utils/treeUtils";

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
 * const handleEdgeClick = useEdgeClick(uniqueEdgeId);
 * <Edge onClick={handleEdgeClick} />;
 * ```
 */
function UseEdgeClick(id: EdgeProps["id"]): () => void {
  const { setEdges, setNodes, getNode, getEdge, getEdges, getNodes } =
    useReactFlow();
  const { eventSequenceId } = useParams() as { eventSequenceId: string };

  return (): void => {
    // first we retrieve the edge object to get the source and target id
    const edge = getEdge(id);

    if (!edge) {
      return;
    }

    // we retrieve the target node to get its position
    const targetNode = getNode(edge.target);

    if (!targetNode) {
      return;
    }

    // create a unique id for newly added elements
    const insertNodeId = GenerateUUID();

    // this is the node object that will be added in between source and target node
    const insertNode = {
      id: insertNodeId,
      // we place the node at the current position of the target (prevents jumping)
      position: { x: targetNode.position.x, y: targetNode.position.y },
      data: {},
      type: "description",
    };

    // new connection from source to new node
    const sourceEdge = {
      id: `${edge.source}->${insertNodeId}`,
      source: edge.source,
      target: insertNodeId,
      type: edge.type,
      label: edge.label,
    };

    // new connection from new node to target
    const targetEdge = {
      id: `${insertNodeId}->${edge.target}`,
      source: insertNodeId,
      target: edge.target,
      type: "normal",
    };

    // remove the edge that was clicked as we have a new connection with a node in between
    const edges = getEdges()
      .filter((e) => e.id !== id)
      .concat([sourceEdge, targetEdge]);
    setEdges(edges);

    // insert the node between the source and target node in the react flow state
    const currentNodes = getNodes();
    const targetNodeIndex = currentNodes.findIndex(
      (node) => node.id === edge.target,
    );
    const nodes = [
      ...currentNodes.slice(0, targetNodeIndex),
      insertNode,
      ...currentNodes.slice(targetNodeIndex, currentNodes.length),
    ];
    setNodes(nodes);

    const eventSequenceCurrentState: EventSequenceGraph = EventSequenceState({
      eventSequenceId: eventSequenceId,
      nodes: nodes,
      edges: edges,
    });

    void GraphApiManager.storeEventSequence(eventSequenceCurrentState).then(
      (r: EventSequenceGraph) => {
        console.log(r);
      },
    );
  };
}

export default UseEdgeClick;
