import { useReactFlow, Node, Edge } from "reactflow";
import { useParams } from "react-router-dom";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { EventTreeState } from "../../../utils/treeUtils";
import { UseToastContext } from "../../providers/toastProvider";
import { GenerateUUID } from "../../../utils/treeUtils";

function useDeleteColClick(clickedColumnId: string) {
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as { eventTreeId: string };
  const { addToast } = UseToastContext();

  const deleteColumn = () => {
    const nodes = getNodes();
    const edges = getEdges();
    const clickedColumn = nodes.find(node => node.id === clickedColumnId);

    if (!clickedColumn) return;
    const columnDepth = clickedColumn.data.depth;

    // 1. Validation
    const nodesInColumn = nodes.filter(node => node.data.depth === columnDepth);
    const hasVisibleNodes = nodesInColumn.some(node => node.type === 'visibleNode');

    if (hasVisibleNodes) {
      addToast({
        id: GenerateUUID(),
        title: "Warning",
        color: "warning",
        text: "Cannot delete a non-empty functional event"
      });      
      return;
    }

    let currentNodes = [...nodes];
    let currentEdges = [...edges];

    // 2. Iteratively remove invisible nodes and maintain connections
    const invisibleNodes = nodesInColumn.filter(node => node.type === 'invisibleNode');
    
    invisibleNodes.forEach(invisibleNode => {
      // Find incoming edges to this invisible node
      const incomingEdges = currentEdges.filter(edge => edge.target === invisibleNode.id);
      
      // Find outgoing edges from this invisible node
      const outgoingEdges = currentEdges.filter(edge => edge.source === invisibleNode.id);
      
      // Create direct connections between nodes before and after the invisible node
      incomingEdges.forEach(inEdge => {
        outgoingEdges.forEach(outEdge => {
          currentEdges.push({
            id: `${inEdge.source}-${outEdge.target}`,
            source: inEdge.source,
            target: outEdge.target,
            type: 'custom',
            animated: false
          });
        });
      });

      // Remove edges connected to this invisible node
      currentEdges = currentEdges.filter(edge => 
        edge.source !== invisibleNode.id && 
        edge.target !== invisibleNode.id
      );
    });

    // 3. Remove invisible nodes
    currentNodes = currentNodes.filter(node => 
      node.type !== 'invisibleNode' || 
      node.data.depth !== columnDepth
    );

    // 4. Handle column nodes
    const prevColumnNode = currentNodes.find(node => 
      node.type === 'columnNode' && 
      node.data.depth === columnDepth - 1
    );

    const nextColumnNode = currentNodes.find(node => 
      node.type === 'columnNode' && 
      node.data.depth === columnDepth + 1
    );

    // 5. Connect adjacent columns with hidden edge
    if (prevColumnNode && nextColumnNode) {
      currentEdges.push({
        id: `${prevColumnNode.id}-${nextColumnNode.id}`,
        source: prevColumnNode.id,
        target: nextColumnNode.id,
        type: 'custom',
        animated: false,
        hidden: true
      });
    }

    // 6. Remove column node
    currentNodes = currentNodes.filter(node => 
      node.data.depth !== columnDepth
    );

    // 7. Update root node counter
    const rootNode = currentNodes.find(node => node.data.depth === 1);
    if (rootNode) {
      rootNode.data.inputDepth -= 1;
    }

    // 8. Apply updates
    setNodes(currentNodes);
    setEdges(currentEdges);

    // 9. Store updated state
    void GraphApiManager.storeEventTree(
      EventTreeState({
        eventTreeId,
        nodes: currentNodes,
        edges: currentEdges,
      })
    );
  };

  return deleteColumn;
}

export default useDeleteColClick;
