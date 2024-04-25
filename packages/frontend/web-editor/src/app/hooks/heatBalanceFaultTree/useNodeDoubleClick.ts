import { useCallback } from "react";
import { Edge, Node, getOutgoers, NodeProps, useReactFlow } from "reactflow";

import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { useParams } from "react-router-dom";
import { HeatBalanceFaultTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import {
  HeatBalanceFaultTreeState,
  GenerateUUID,
} from "../../../utils/treeUtils";
import {
  BASIC_EVENT,
  LEAF_NODE_TYPES,
  NOT_GATE,
  WORKFLOW,
} from "../../../utils/constants";

/**
 * This hook implements the double click event on a node.
 *
 * This hook provides a function, `handleNodeDoubleClick`, that can be used as an event handler for node click events.
 * It retrieves information about the clicked node using the `useReactFlow` hook.
 *
 * @param id - The unique identifier of the node clicked.
 * @returns A function (`handleNodeDoubleClick`) to be used as an event handler for node double click events.
 */
// this hook implements the logic for double click on any node
// on double click on node: create a new basic event child node or otherwise specified action
function UseNodeDoubleClick(id: NodeProps["id"]): {
  handleNodeDoubleClick: (nodeType: React.MouseEvent) => void;
} {
  const { setEdges, setNodes, getNodes, getEdges, getNode } = useReactFlow();
  const { heatBalanceFaultTreeId } = useParams();
  const handleNodeDoubleClick = useCallback(
    async (nodeType: React.MouseEvent) => {
      // we need the parent node object for positioning the new child node
      const parentNode = getNode(id);

      if (
        !parentNode ||
        LEAF_NODE_TYPES.includes(parentNode.type) ||
        parentNode.type === NOT_GATE
      ) {
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
        data: { label: "BasicEvent" },
      };

      // we need to create a connection from parent to child
      const childEdge = {
        id: `${parentNode.id}=>${childNodeId}`,
        source: parentNode.id,
        target: childNodeId,
        type: WORKFLOW,
      };

      // if the clicked node has had any placeholders as children, we remove them because it will get a child now
      const existingChildren = getOutgoers(parentNode, getNodes(), getEdges())
        .filter((node) => node.type === "placeholder")
        .map((node) => node.id);

      // add the new nodes (child and placeholder), filter out the existing placeholder nodes of the clicked node
      const nodes: Node[] = getNodes()
        .filter((node) => !existingChildren.includes(node.id))
        .concat([childNode]);
      setNodes(nodes);

      // add the new edges (node -> child, child -> placeholder), filter out any placeholder edges
      const edges: Edge[] = getEdges()
        .filter((edge) => !existingChildren.includes(edge.target))
        .concat([childEdge]);
      setEdges(edges);
      // console.log(nodes);
      // console.log(edges);
      await GraphApiManager.storeHeatBalanceFaultTree(
        HeatBalanceFaultTreeState({
          edges: edges,
          heatBalanceFaultTreeId: heatBalanceFaultTreeId ?? "",
          nodes: nodes,
        }),
      ).then((r: HeatBalanceFaultTreeGraph) => {
        // console.log(r);
      });
    },
    [
      heatBalanceFaultTreeId,
      getEdges,
      getNode,
      getNodes,
      id,
      setEdges,
      setNodes,
    ],
  );

  return { handleNodeDoubleClick };
}

export { UseNodeDoubleClick };
