import { NodeProps, EdgeProps, useReactFlow, Edge } from "reactflow";
import { useParams } from "react-router-dom";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { set } from "lodash";
import { EventTreeState, GenerateUUID } from "../../../utils/treeUtils";

function useDeleteColClick(clickedNodeId: NodeProps["id"]) {
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();
  const { eventTreeId } = useParams() as { eventTreeId: string };

  const deleteNode = () => {
    const nodes = getNodes();
    const edges = getEdges();

    const clickedNode = nodes.find((node) => node.id === clickedNodeId);

    if (!clickedNode || clickedNode.type !== "columnNode") return;

    const targetDepth = clickedNode.data.depth;

    const rootNode = nodes.find((node) => node.data.depth === 1)!;
    const isFirstOutputColumn = targetDepth === rootNode.data.inputDepth + 1;

    const nodesToEvaluate = nodes.filter(
      (node) => node.data.depth === targetDepth && node.type !== "columnNode",
    );

    const nodesToEvaluateId = nodesToEvaluate.map((node) => node.id);
    nodesToEvaluateId.push(clickedNodeId);

    // Determine the last index of the nodes with the previous depth
    nodes.forEach((node, index) => {
      if (node.data.depth > clickedNode.data.depth) {
        node.data.depth = node.data.depth - 1;
      }
    });

    let newEdges: Edge[] = [];
    const nodesToDelete = nodesToEvaluateId;
    let lastNodeId = "";
    nodesToEvaluateId.forEach((nodeId, index) => {
      const leftEdge = edges.find((edge) => edge.target === nodeId);
      const rightEdge = edges.filter((edge) => edge.source === nodeId);

      if (lastNodeId === leftEdge?.source && index != 0) {
        nodesToDelete.push(nodeId);
        const stack = [nodeId];
        while (stack.length > 0) {
          const nodeId = stack.pop();
          edges.forEach((edge) => {
            if (edge.source === nodeId) {
              stack.push(edge.target);
              nodesToDelete.push(edge.target);
            }
          });
        }
      }
      lastNodeId = leftEdge?.source!;
      rightEdge.forEach((edge) => {
        if (!nodesToDelete.includes(edge.target)) {
          const newEdge: Edge[] = [
            {
              id: GenerateUUID(),
              source: leftEdge?.source ?? "",
              target: edge.target ?? "",
              type: "custom",
              hidden: nodeId === clickedNodeId,
              animated: isFirstOutputColumn ? true : edge.animated,
            },
          ];
          newEdges = newEdges.concat(newEdge);
        }
      });
    });

    if (clickedNode.data.output) {
      rootNode.data.outputDepth -= 1;
    } else {
      rootNode.data.inputDepth -= 1;
    }

    const updatedEdges = edges
      .filter(
        (edge) =>
          !nodesToDelete.includes(edge.target) &&
          !nodesToDelete.includes(edge.source),
      )
      .concat(newEdges); // Add the new edges to the updated edges list

    const updatedNodes = nodes.filter(
      (node) => !nodesToDelete.includes(node.id),
    );

    setNodes(updatedNodes);
    setEdges(updatedEdges);

    const eventTreeCurrentState: EventTreeGraph = EventTreeState({
      eventTreeId: eventTreeId,
      nodes: updatedNodes,
      edges: updatedEdges,
    });

    void GraphApiManager.storeEventTree(eventTreeCurrentState).then(
      (r: EventTreeGraph) => {
        console.log(r ? "saved" : "error");
      },
    );
  };

  return deleteNode;
}

export default useDeleteColClick;
