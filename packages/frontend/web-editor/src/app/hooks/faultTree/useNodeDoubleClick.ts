import { useCallback } from "react";
import { Edge, Node, getOutgoers, NodeProps, useReactFlow } from "reactflow";

import { updateFaultTreeGraph } from "packages/shared-types/src/lib/api/NestedModelApiManager";
import { FaultTree } from "packages/shared-types/src/lib/api/NestedModelsAPI/FaultTreesApiManager";
import { useParams } from "react-router-dom";
import { GenerateUUID } from "../../../utils/treeUtils";
import { BASIC_EVENT, LEAF_NODE_TYPES, NOT_GATE, WORKFLOW } from "../../../utils/constants";
import { useStore } from "../../store/faultTreeStore";
import { useUndoRedo } from "./useUndeRedo";

/**
 * This hook implements the double click event on a node.
 *
 * This hook provides a function, `handleNodeDoubleClick`, that can be used as an event handler for node click events.
 * It retrieves information about the clicked node using the `useReactFlow` hook.
 *
 * @param id - The unique identifier of the node clicked.
 * @returns A function (`handleNodeDoubleClick`) to be used as an event handler for node double click events.
 */
// this hook implements the logic for double-click on any node
// on double-click on node: create a new basic event child node or otherwise specified action
function UseNodeDoubleClick(id: NodeProps["id"]): {
  handleNodeDoubleClick: (nodeType: React.MouseEvent) => Promise<void>;
} {
  const { setEdges, setNodes, nodes, edges, setFocusNodeId } = useStore();
  const { getNode } = useReactFlow();
  const { takeSnapshot } = useUndoRedo();
  const { faultTreeId } = useParams();
  const handleNodeDoubleClick = useCallback(async () => {
    // we need the parent node object for positioning the new child node
    const parentNode = getNode(id);

    if (!parentNode || LEAF_NODE_TYPES.includes(parentNode.type) || parentNode.type === NOT_GATE) {
      return;
    }

    // create a unique id for the child node
    const childNodeId = GenerateUUID();

    // create the child node
    const childNode = {
      id: childNodeId,
      // we try to place the child node close to the calculated position from the layout algorithm
      // 150 pixels below the parent node, this spacing can be adjusted in the useLayout hook
      position: { x: parentNode.position.x, y: parentNode.position.y + 150 },
      type: BASIC_EVENT,
      data: {},
    };

    // we need to create a connection from parent to child
    const childEdge = {
      id: `${parentNode.id}=>${childNodeId}`,
      source: parentNode.id,
      target: childNodeId,
      type: WORKFLOW,
    };

    //take snapshot for undo redo
    takeSnapshot();

    // if the clicked node has had any placeholders as children, we remove them because it will get a child now
    const existingChildren = getOutgoers(parentNode, nodes, edges)
      .filter((node) => node.type === "placeholder")
      .map((node) => node.id);

    // add the new nodes (child and placeholder), filter out the existing placeholder nodes of the clicked node
    const newNodes: Node[] = nodes.filter((node) => !existingChildren.includes(node.id)).concat([childNode]);
    setNodes(newNodes);

    // add the new edges (node -> child, child -> placeholder), filter out any placeholder edges
    const newEdges: Edge[] = edges.filter((edge) => !existingChildren.includes(edge.target)).concat([childEdge]);
    setEdges(newEdges);

    //set view
    setFocusNodeId(parentNode.id);

    await updateFaultTreeGraph(
      faultTreeId ?? "",
      {
        nodes: newNodes,
        edges: newEdges,
      },
    ).then((r: FaultTree) => {
      console.log(r);
    });
  }, [getNode, id, takeSnapshot, nodes, edges, setNodes, setEdges, setFocusNodeId, faultTreeId]);

  return { handleNodeDoubleClick };
}

export { UseNodeDoubleClick };
