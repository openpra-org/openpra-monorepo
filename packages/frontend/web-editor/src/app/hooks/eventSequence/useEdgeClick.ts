import { EdgeProps, useReactFlow } from "reactflow";

import { generateUUID } from "../../../utils/treeUtils";

/**
 * Hook for handling click events on edges in a React Flow diagram.
 *
 * This hook provides a function, `handleEdgeClick`, that can be used to perform actions when an edge is clicked.
 * It utilizes the React Flow library for managing nodes and edges in a flowchart-like UI.
 *
 * @param {string} id - The unique identifier of the clicked edge.
 * @returns {Function} A function (`handleEdgeClick`) to be used as an event handler for edge click events.
 *
 * @example
 * ```typescript
 * const handleEdgeClick = useEdgeClick('uniqueEdgeId');
 * <Edge onClick={handleEdgeClick} />;
 * ```
 */
function useEdgeClick(id: EdgeProps["id"]) {
  const { setEdges, setNodes, getNode, getEdge } = useReactFlow();

  /**
   * Handles the click event on an edge by inserting a new Description node between the source and target nodes.
   *
   * @throws {Error} If either the edge or the target node is not found.
   *
   * @example
   * ```typescript
   * const handleEdgeClick = useEdgeClick('uniqueEdgeId');
   * handleEdgeClick();
   * ```
   */
  const handleEdgeClick = () => {
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
    const insertNodeId = generateUUID();

    // this is the node object that will be added in between source and target node
    const insertNode = {
      id: insertNodeId,
      // we place the node at the current position of the target (prevents jumping)
      position: { x: targetNode.position.x, y: targetNode.position.y },
      data: { label: "Description" },
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
    setEdges((edges) =>
      edges.filter((e) => e.id !== id).concat([sourceEdge, targetEdge]),
    );

    // insert the node between the source and target node in the react flow state
    setNodes((nodes) => {
      const targetNodeIndex = nodes.findIndex(
        (node) => node.id === edge.target,
      );

      return [
        ...nodes.slice(0, targetNodeIndex),
        insertNode,
        ...nodes.slice(targetNodeIndex, nodes.length),
      ];
    });
  };

  return handleEdgeClick;
}

export default useEdgeClick;