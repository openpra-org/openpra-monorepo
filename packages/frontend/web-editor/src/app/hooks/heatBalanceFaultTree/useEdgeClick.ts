import { Node, EdgeProps, useReactFlow, Edge } from "reactflow";

import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { useParams } from "react-router-dom";
import {
  exitGrayedState,
  HeatBalanceFaultTreeState,
  GenerateUUID,
  isSubgraphGrayed,
} from "../../../utils/treeUtils";
import { NOT_GATE, WORKFLOW } from "../../../utils/constants";
import { useStore } from "../../store/heatBalanceFaultTreeStore";
import { HeatBalanceFaultTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";

/**
 * Hook for handling click events on edges in a React Flow diagram.
 *
 * This hook provides a function, `handleEdgeClick`, that can be used to perform actions when an edge is clicked.
 * It utilizes the React Flow library for managing nodes and edges in a flowchart-like UI.
 *
 * @param id - The unique identifier of the clicked edge.
 * @returns \{Function\} A function (`handleEdgeClick`) to be used as an event handler for edge click events.
 *
 * @example
 * ```typescript
 * const handleEdgeClick = useEdgeClick('uniqueEdgeId');
 * <Edge onClick={handleEdgeClick} />;
 * ```
 */
function UseEdgeClick(id: EdgeProps["id"]) {
  let { nodes, edges, setEdges, setNodes } = useStore();
  if (isSubgraphGrayed(nodes, edges)) {
    const { newNodes, newEdges } = exitGrayedState(nodes, edges);
    nodes = newNodes;
    edges = newEdges;
  }
  const { getNode, getEdge } = useReactFlow();

  const { heatBalanceFaultTreeId } = useParams();

  const handleEdgeClick = (): void => {
    // first we retrieve the edge object to get the source and target id
    const edge = getEdge(id);

    if (!edge) {
      return;
    }

    // we retrieve the target node to get its position
    const targetNode = getNode(edge.target);
    const sourceNode = getNode(edge.source);

    if (!targetNode || !sourceNode) {
      return;
    }

    if (targetNode.type === NOT_GATE || sourceNode.type === NOT_GATE) {
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
      type: NOT_GATE,
    };

    // new connection from source to new node
    const sourceEdge = {
      id: `${edge.source}->${insertNodeId}`,
      source: edge.source,
      target: insertNodeId,
      type: WORKFLOW,
    };

    // new connection from new node to target
    const targetEdge = {
      id: `${insertNodeId}->${edge.target}`,
      source: insertNodeId,
      target: edge.target,
      type: WORKFLOW,
    };

    // remove the edge that was clicked as we have a new connection with a node in between
    const newEdges = edges
      .filter((e: Edge) => e.id !== id)
      .concat([sourceEdge, targetEdge]);
    setEdges(newEdges);

    // insert the node between the source and target node in the React flow state
    const currentNodes = nodes;
    const targetNodeIndex = currentNodes.findIndex(
      (node: Node) => node.id === edge.target,
    );
    const newNodes = [
      ...currentNodes.slice(0, targetNodeIndex),
      insertNode,
      ...currentNodes.slice(targetNodeIndex, currentNodes.length),
    ];
    setNodes(newNodes);

    void GraphApiManager.storeHeatBalanceFaultTree(
      HeatBalanceFaultTreeState({
        heatBalanceFaultTreeId: heatBalanceFaultTreeId ?? "",
        nodes: newNodes,
        edges: newEdges,
      }),
    ).then((r: HeatBalanceFaultTreeGraph) => {
      // console.log(r);
    });
  };

  return handleEdgeClick;
}

export { UseEdgeClick };
