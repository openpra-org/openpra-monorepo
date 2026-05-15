import { useCallback, useRef } from "react";
import { Edge, getConnectedEdges, getIncomers, getOutgoers, Node, NodeProps, useReactFlow } from "reactflow";
import { useParams } from "react-router-dom";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { FaultTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import {
  FaultTreeState,
  getBasicEventNode,
  GetSubgraph,
  GetParentNode,
  getWorkflowEdge,
  grayOutSubgraph,
} from "../../../utils/treeUtils";
import {
  ATLEAST_TWO_CHILDREN,
  BASIC_EVENT,
  DELETE,
  DELETE_ROOT_NODE,
  FAULT_TREE_ROOT_NODE_ID,
  LEAF_NODE_TYPES,
  LOGICAL_GATES,
  NOT_GATE,
  NOT_GATE_CHILD,
  UPDATE_ROOT_NODE,
  WORKFLOW,
} from "../../../utils/constants";
import { useStore } from "../../store/faultTreeStore";
import { FaultTreeNodeProps } from "../../components/treeNodes/faultTreeNodes/faultTreeNodeType";
import { useUndoRedo } from "./useUndeRedo";
function UseFaultTreeContextMenuClick(id: NodeProps["id"]): {
  handleContextMenuClick: (updateNodeType: string) => Promise<void>;
  validateFaultTreeContextMenuClick: (id: string, type: string) => string | undefined;
} {
  const { fitView, getNode } = useReactFlow();
  const { nodes, edges, setFocusNodeId, setNodes, setEdges } = useStore();
  const { takeSnapshot } = useUndoRedo();
  const { faultTreeId } = useParams();
  const deleteNodeFocusRef = useRef(false);
  const clickedNode: Node<FaultTreeNodeProps> | undefined = getNode(id);
  const validateFaultTreeContextMenuClick = useCallback(
    (id: string, type: string): string | undefined => {
      if (!clickedNode) {
        return;
      }
      if (type.startsWith("delete")) {
        if (id === FAULT_TREE_ROOT_NODE_ID) {
          return DELETE_ROOT_NODE;
        } else if (LEAF_NODE_TYPES.includes(clickedNode.type)) {
          const incomers = getIncomers(clickedNode, nodes, edges);
          const outgoers = getOutgoers(incomers[0], nodes, edges);
          if (LOGICAL_GATES.includes(incomers[0].type) && outgoers.length === 2) {
            return ATLEAST_TWO_CHILDREN;
          }
          if (incomers[0].type === NOT_GATE && outgoers.length === 1) {
            return NOT_GATE_CHILD;
          }
        }
      } else if (id === FAULT_TREE_ROOT_NODE_ID && (LEAF_NODE_TYPES.includes(type) || type === NOT_GATE)) {
        return UPDATE_ROOT_NODE;
      }
    },
    [clickedNode, edges, nodes],
  );
  const handleContextMenuClick = useCallback(
    async (updateNodeType: string): Promise<void> => {
      let updateClickedNodeTo = "";
      if (!clickedNode) {
        return;
      }
      const nodesToAdd: Node<FaultTreeNodeProps>[] = [];
      const nodesToRemove: Node<FaultTreeNodeProps>[] = [];
      const edgesToRemove: Edge<FaultTreeNodeProps>[] = [];
      const edgesToAdd: Edge<FaultTreeNodeProps>[] = [];
      if (!updateNodeType.startsWith(DELETE)) {
        if (
          LEAF_NODE_TYPES.includes(clickedNode.type) &&
          !LEAF_NODE_TYPES.includes(updateNodeType) &&
          updateNodeType !== NOT_GATE
        ) {
          const childNode1 = getBasicEventNode([...nodes, ...nodesToAdd]);
          const childNode2 = getBasicEventNode([...nodes, ...nodesToAdd, childNode1]);
          const childEdge1 = getWorkflowEdge(clickedNode.id, childNode1.id);
          const childEdge2 = getWorkflowEdge(clickedNode.id, childNode2.id);
          nodesToAdd.push(childNode1, childNode2);
          edgesToAdd.push(childEdge1, childEdge2);
        } else if (LEAF_NODE_TYPES.includes(updateNodeType)) {
          const { nodes: subGraphNodes, edges: subGraphEdges } = GetSubgraph(clickedNode, nodes, edges);
          edgesToRemove.push(...subGraphEdges.filter((edge) => !(edge.target === clickedNode.id)));
          nodesToRemove.push(...subGraphNodes);
        } else if (clickedNode.type === NOT_GATE) {
          const childNode1 = getBasicEventNode([...nodes, ...nodesToAdd]);
          const childEdge1 = getWorkflowEdge(clickedNode.id, childNode1.id);
          nodesToAdd.push(childNode1);
          edgesToAdd.push(childEdge1);
        } else if (updateNodeType === NOT_GATE) {
          const { nodes: subGraphNodes, edges: subGraphEdges } = GetSubgraph(clickedNode, nodes, edges);
          edgesToRemove.push(...subGraphEdges.filter((edge) => !(edge.target === clickedNode.id)));
          nodesToRemove.push(...subGraphNodes);
          const childNode = getBasicEventNode([...nodes, ...nodesToAdd]);
          const childEdge = getWorkflowEdge(clickedNode.id, childNode.id);
          nodesToAdd.push(childNode);
          edgesToAdd.push(childEdge);
        }
        updateClickedNodeTo = updateNodeType;
      } else {
        if (updateNodeType === "deleteSubtree") {
          const { nodes: subGraphNodes, edges: subGraphEdges } = GetSubgraph(clickedNode, nodes, edges);
          edgesToRemove.push(...subGraphEdges.filter((edge) => !(edge.target === clickedNode.id)));
          nodesToRemove.push(...subGraphNodes);
          updateClickedNodeTo = BASIC_EVENT;
        } else if (updateNodeType === "deleteNode") {
          if (getOutgoers(clickedNode, nodes, edges).length === 0) {
            setFocusNodeId(GetParentNode(clickedNode, nodes, edges).id);
            deleteNodeFocusRef.current = true;
          }
          const parentOfClickedNode = getIncomers(clickedNode, nodes, edges)[0];
          if (LOGICAL_GATES.includes(clickedNode.type) && parentOfClickedNode.type === NOT_GATE) {
            const { grayedNodes, grayedEdges } = grayOutSubgraph(clickedNode, nodes, edges);
            setNodes(grayedNodes);
            setEdges(grayedEdges);
            return;
          } else {
            const incomers = getIncomers(clickedNode, nodes, edges);
            const outgoers = getOutgoers(clickedNode, nodes, edges);
            const connectedEdges = getConnectedEdges([clickedNode], edges);
            edgesToRemove.push(...connectedEdges);
            nodesToRemove.push(clickedNode);
            const createdEdges = incomers.flatMap(({ id: source }) =>
              outgoers.map(({ id: target }) => ({
                id: `${source}->${target}`,
                source,
                target,
                type: WORKFLOW,
              })),
            );
            edgesToAdd.push(...createdEdges);
          }
        }
      }
      takeSnapshot();
      const newNodes: Node[] = nodes
        .filter((node: Node) => !nodesToRemove.some((n) => n.id === node.id))
        .concat(nodesToAdd);
      if (updateClickedNodeTo) {
        nodes[nodes.findIndex((el: Node) => el.id === id)].type = updateClickedNodeTo;
      }
      setNodes(newNodes);
      const newEdges: Edge[] = edges
        .filter((edge: Edge) => !edgesToRemove.some((e) => e.id === edge.id))
        .concat(edgesToAdd);
      setEdges(newEdges);
      if (!deleteNodeFocusRef.current) {
        fitView({
          nodes: [{ id: clickedNode.id }],
          duration: 500,
          maxZoom: 1.6,
        });
      }
      deleteNodeFocusRef.current = false;
      await GraphApiManager.storeFaultTree(
        FaultTreeState({
          nodes: newNodes,
          edges: newEdges,
          faultTreeId: faultTreeId ?? "",
        }),
      ).then((_r: FaultTreeGraph): void => {});
    },
    [clickedNode, takeSnapshot, nodes, setNodes, edges, setEdges, faultTreeId, id, fitView, setFocusNodeId],
  );
  return { handleContextMenuClick, validateFaultTreeContextMenuClick };
}
export { UseFaultTreeContextMenuClick };
