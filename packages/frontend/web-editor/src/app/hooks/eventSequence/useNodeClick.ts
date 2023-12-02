import { useCallback } from "react";
import { NodeProps, useReactFlow } from "reactflow";

/**
 * Hook for handling click events on nodes in a React Flow diagram.
 *
 * This hook provides a function, `onClick`, that can be used as an event handler for node click events.
 * It retrieves information about the clicked node using the `useReactFlow` hook.
 *
 * @param {string} id - The unique identifier of the clicked node.
 * @returns A function (`onClick`) to be used as an event handler for node click events.
 */
export function useNodeClick(id: NodeProps["id"]): () => void {
  const { getNode } = useReactFlow();

  /**
   * Handles the click event on a node by logging the type of the clicked node.
   */
  const onClick = useCallback(() => {
    const node = getNode(id)!;
    console.log(node.type);
  }, [getNode, id]);

  return onClick;
}

export default useNodeClick;
