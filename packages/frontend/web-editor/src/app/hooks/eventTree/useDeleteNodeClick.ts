import { NodeProps, useReactFlow } from "reactflow";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { useParams } from "react-router-dom";
import { EventTreeState } from "../../../utils/treeUtils";

function useDeleteNodeClick(clickedNodeId: NodeProps["id"]) {
  const { setEdges, setNodes, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as { eventTreeId: string };

  const deleteNode = () => {
    const nodes = getNodes();
    const edges = getEdges();

    // Helper function to check if a node is an output node or invisible node
    const isOutputOrInvisibleNode = (nodeId: string): boolean => {
      const node = nodes.find(n => n.id === nodeId);
      return node?.type === 'outputNode' || node?.type === 'invisibleNode';
    };

    // Get all connected output nodes that need to be deleted
    const getConnectedOutputNodes = (nodeId: string): string[] => {
      const outputNodes: string[] = [];
      const stack = [nodeId];
      
      while (stack.length > 0) {
        const currentId = stack.pop()!;
        const connectedNodes = edges
          .filter(edge => edge.source === currentId && isOutputOrInvisibleNode(edge.target))
          .map(edge => edge.target);
        
        outputNodes.push(...connectedNodes);
        stack.push(...connectedNodes);
      }
      
      return outputNodes;
    };

    // Check if node has non-output, non-invisible children
    const hasChildren = edges.some(edge => 
      edge.source === clickedNodeId && 
      !isOutputOrInvisibleNode(edge.target)
    );

    if (hasChildren) {
      alert("Cannot delete this node. Please delete all child nodes first.");
      return;
    }

    // Find parent and check for siblings
    const parentEdge = edges.find(edge => 
      edge.target === clickedNodeId && 
      !isOutputOrInvisibleNode(edge.source)
    );

    if (!parentEdge) {
      alert("Cannot delete the root node");
      return;
    }

    const parentId = parentEdge.source;
    const siblingEdges = edges.filter(edge => 
      edge.source === parentId && 
      edge.target !== clickedNodeId &&
      !isOutputOrInvisibleNode(edge.target)
    );

    // Get all output nodes that need to be handled
    const connectedOutputNodes = getConnectedOutputNodes(clickedNodeId);

    if (siblingEdges.length === 0) {
      // No siblings - convert to invisible node
      const updatedNodes = nodes.map(node => {
        if (node.id === clickedNodeId) {
          return { ...node, type: "invisibleNode" };
        }
        return node;
      });

      const updatedEdges = edges.map(edge => {
        if (edge.target === clickedNodeId || connectedOutputNodes.includes(edge.target)) {
          return { ...edge, animated: true };
        }
        return edge;
      });

      setNodes(updatedNodes);
      setEdges(updatedEdges);
    } else {
      // Has siblings - remove node and its output nodes completely
      const nodesToRemove = [clickedNodeId, ...connectedOutputNodes];
      const remainingNodes = nodes.filter(node => !nodesToRemove.includes(node.id));
      const remainingEdges = edges.filter(edge => 
        !nodesToRemove.includes(edge.source) && !nodesToRemove.includes(edge.target)
      );

      setNodes(remainingNodes);
      setEdges(remainingEdges);
    }

    // Store the updated state
    void GraphApiManager.storeEventTree(
      EventTreeState({
        eventTreeId,
        nodes: getNodes(),
        edges: getEdges(),
      })
    );
  };

  return deleteNode;
}

export default useDeleteNodeClick;
