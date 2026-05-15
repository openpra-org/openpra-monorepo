import { useCallback } from "react";
import { Edge, getConnectedEdges, getOutgoers, Node, NodeProps, useReactFlow } from "reactflow";
import _ from "lodash";
import { useParams } from "react-router-dom";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { GenerateUUID, FaultTreeState } from "../../../utils/treeUtils";
export function useEventTreeContextMenuClick(id: NodeProps["id"]): {
  handleContextMenuClick: (contextMenuClickEvent: React.MouseEvent) => void;
} {
  const { setEdges, setNodes, getNodes, getEdges, getNode } = useReactFlow();
  const { faultTreeId } = useParams();
  const getAllChildren = useCallback(
    (
      parentNode: Node,
    ): {
      nodes: Node[];
      edges: Edge[];
    } => {
      let childNodes: Node[] = [];
      let childEdges: Edge[] = [];
      const children = getOutgoers(parentNode, getNodes(), getEdges());
      childNodes.push(...children);
      const childrenEdges = getConnectedEdges([parentNode, ...children], getEdges()).filter(
        (edge) => !(edge.target === parentNode.id),
      );
      childEdges.push(...childrenEdges);
      children.forEach((child) => {
        const { nodes, edges } = getAllChildren(child);
        childNodes.push(...nodes);
        childEdges.push(...edges);
      });
      childNodes = _.uniqBy(childNodes, "id");
      childEdges = _.uniqBy(childEdges, "id");
      return {
        nodes: childNodes,
        edges: childEdges,
      };
    },
    [getEdges, getNodes],
  );
  const handleContextMenuClick = useCallback(
    (contextMenuClickEvent: React.MouseEvent): void => {
      const parentNode = getNode(id);
      if (!parentNode) {
        return;
      }
      const nodesToAdd: Node[] = [];
      const nodesToRemove: Node[] = [];
      const edgesToRemove: Edge[] = [];
      const edgesToAdd: Edge[] = [];
      const leafNodeTypes: (string | undefined)[] = ["basicEvent", "houseEvent", "transferGate"];
      if (
        leafNodeTypes.includes(parentNode.type) &&
        !leafNodeTypes.includes(contextMenuClickEvent.currentTarget.id) &&
        contextMenuClickEvent.currentTarget.id !== "notGate"
      ) {
        const childNodeId1 = GenerateUUID();
        const childNodeId2 = GenerateUUID();
        const childNode1 = {
          id: childNodeId1,
          position: {
            x: parentNode.position.x,
            y: parentNode.position.y + 150,
          },
          type: "basicEvent",
          data: {},
        };
        const childNode2 = {
          id: childNodeId2,
          position: {
            x: parentNode.position.x,
            y: parentNode.position.y + 150,
          },
          type: "basicEvent",
          data: {},
        };
        const childEdge1 = {
          id: `${parentNode.id}=>${childNodeId1}`,
          source: parentNode.id,
          target: childNodeId1,
          type: "workflow",
        };
        const childEdge2 = {
          id: `${parentNode.id}=>${childNodeId2}`,
          source: parentNode.id,
          target: childNodeId2,
          type: "workflow",
        };
        nodesToAdd.push(childNode1, childNode2);
        edgesToAdd.push(childEdge1, childEdge2);
      } else if (parentNode.type === "notGate") {
        const childNodeId1 = GenerateUUID();
        const childNode1 = {
          id: childNodeId1,
          position: {
            x: parentNode.position.x,
            y: parentNode.position.y + 150,
          },
          type: "basicEvent",
          data: {},
        };
        const childEdge1 = {
          id: `${parentNode.id}=>${childNodeId1}`,
          source: parentNode.id,
          target: childNodeId1,
          type: "workflow",
        };
        nodesToAdd.push(childNode1);
        edgesToAdd.push(childEdge1);
      } else if (leafNodeTypes.includes(contextMenuClickEvent.currentTarget.id)) {
        const { nodes, edges } = getAllChildren(parentNode);
        edgesToRemove.push(...edges.filter((edge) => !(edge.target === parentNode.id)));
        nodesToRemove.push(...nodes);
      } else if (contextMenuClickEvent.currentTarget.id === "notGate") {
        const { nodes, edges } = getAllChildren(parentNode);
        edgesToRemove.push(...edges.filter((edge) => !(edge.target === parentNode.id)));
        nodesToRemove.push(...nodes);
        const childNodeId = GenerateUUID();
        const childNode = {
          id: childNodeId,
          position: { x: parentNode.position.x, y: parentNode.position.y },
          type: "basicEvent",
          data: {},
        };
        const childEdge = {
          id: `${parentNode.id}=>${childNodeId}`,
          source: parentNode.id,
          target: childNodeId,
          type: "workflow",
        };
        nodesToAdd.push(childNode);
        edgesToAdd.push(childEdge);
      }
      parentNode.type = contextMenuClickEvent.currentTarget.id;
      const nodes: Node[] = getNodes()
        .filter((node) => !nodesToRemove.some((n) => n.id === node.id))
        .concat(nodesToAdd);
      setNodes(nodes);
      const edges: Edge[] = getEdges()
        .filter((edge) => !edgesToRemove.some((e) => e.id === edge.id))
        .concat(edgesToAdd);
      setEdges(edges);
      if (!faultTreeId) {
        return;
      }
      void GraphApiManager.storeFaultTree(
        FaultTreeState({
          faultTreeId: faultTreeId,
          nodes: nodes,
          edges: edges,
        }),
      ).then(() => {});
    },
    [faultTreeId, getAllChildren, getEdges, getNode, getNodes, id, setEdges, setNodes],
  );
  return { handleContextMenuClick };
}
export default useEventTreeContextMenuClick;
