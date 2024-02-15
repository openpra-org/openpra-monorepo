import { useCallback } from "react";
import { NodeProps, useReactFlow } from "reactflow";

/**
 * Hook for handling click events on nodes in a React Flow diagram.
 *
 * This hook provides a function, `onClick`, that can be used as an event handler for node click events.
 * It retrieves information about the clicked node using the `useReactFlow` hook.
 *
 * @param id - The unique identifier of the clicked node.
 * @returns A function (`onClick`) to be used as an event handler for node click events.
 */
function UseNodeClick(id: NodeProps["id"]): () => void {
  const { getNode } = useReactFlow();

  return useCallback(() => {
    const node = getNode(id);
    if (node !== undefined) {
      console.log(node.type);
    }
  }, [getNode, id]);
}

export { UseNodeClick };
