import { useCallback } from "react";
import {
  Edge,
  getConnectedEdges,
  getIncomers,
  getOutgoers,
  Node,
  NodeProps,
  useReactFlow,
} from "reactflow";
import { useParams } from "react-router-dom";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { HeatBalanceFaultTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import {
  HeatBalanceFaultTreeState,
  getBasicEventNode,
  GetSubgraph,
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
import { useStore } from "../../store/heatBalanceFaultTreeStore";
import { HeatBalanceFaultTreeNodeProps } from "../../components/treeNodes/heatBalancefaultTreeNodes/heatBalanceFaultTreeNodeType";

/**
 * Hook for handling context menu click event.
 *
 * This hook provides a function `handleContextMenuClick` that can be used to update the state of the fault tree
 * based on the selected node type. It utilizes the React Flow library for managing nodes and edges in a flowchart-like UI.
 *
 * @param id - The unique identifier for each node.
 * @example
 * ```typescript
 * const { handleContextMenuClick } = useFaultTreeContextMenuClick('uniqueNodeId');
 * ```
 */
function UseHeatBalanceFaultTreeContextMenuClick(id: NodeProps["id"]) {
  // const { setEdges, setNodes, getNodes, getEdges, getNode } = useReactFlow();
  const { getNode } = useReactFlow();
  const { nodes, edges, setNodes, setEdges } = useStore();
  const { heatBalanceFaultTreeId } = useParams();

  // we need the parent node object for positioning the new child node
  const clickedNode: Node<HeatBalanceFaultTreeNodeProps> | undefined = getNode(id);

  const validateFaultTreeContextMenuClick = useCallback(
    (id: string, type: string) => {
      if (!clickedNode) {
        return;
      }
      if (type.startsWith("delete")) {
        if (id === FAULT_TREE_ROOT_NODE_ID) {
          return DELETE_ROOT_NODE;
        } else if (LEAF_NODE_TYPES.includes(clickedNode.type)) {
          //check parent of current node
          const incomers = getIncomers(clickedNode, nodes, edges);
          //children of parent node
          const outgoers = getOutgoers(incomers[0], nodes, edges);

          //if parent should have at least 2 children
          if (
            LOGICAL_GATES.includes(incomers[0].type) &&
            outgoers.length === 2
          ) {
            return ATLEAST_TWO_CHILDREN;
          }
          //if parent is NOT gate, cannot delete only child (leaf event)
          if (incomers[0].type === NOT_GATE && outgoers.length === 1) {
            return NOT_GATE_CHILD;
          }
        }
      } else if (
        id === FAULT_TREE_ROOT_NODE_ID &&
        (LEAF_NODE_TYPES.includes(type) || type === NOT_GATE)
      ) {
        return UPDATE_ROOT_NODE;
      }
    },
    [getNode],
  );

  const handleContextMenuClick = useCallback(
    async (updateNodeType: string) => {
      let updateClickedNodeTo = "";

      if (!clickedNode) {
        return;
      }
      const nodesToAdd: Node<HeatBalanceFaultTreeNodeProps>[] = [];
      const nodesToRemove: Node<HeatBalanceFaultTreeNodeProps>[] = [];
      const edgesToRemove: Edge<HeatBalanceFaultTreeNodeProps>[] = [];
      const edgesToAdd: Edge<HeatBalanceFaultTreeNodeProps>[] = [];

      if (!updateNodeType.startsWith(DELETE)) {
        if (
          LEAF_NODE_TYPES.includes(clickedNode.type) &&
          !LEAF_NODE_TYPES.includes(updateNodeType) &&
          updateNodeType !== NOT_GATE
        ) {
          // case 1: current node is basic event (or any leaf event like house/transfer) and new node is and/or gate (not a leaf event)
          // add two basic events as children and update the current node to the type of new node
          const childNode1 = getBasicEventNode();
          const childNode2 = getBasicEventNode();
          const childEdge1 = getWorkflowEdge(clickedNode.id, childNode1.id);
          const childEdge2 = getWorkflowEdge(clickedNode.id, childNode2.id);

          // add the child nodes and edges
          nodesToAdd.push(childNode1, childNode2);
          edgesToAdd.push(childEdge1, childEdge2);
        } else if (LEAF_NODE_TYPES.includes(updateNodeType)) {
          // case 2: current node is any type of node with children and new node is leaf node
          // delete all child nodes and edges
          const { nodes: subGraphNodes, edges: subGraphEdges } = GetSubgraph(
            clickedNode,
            nodes,
            edges,
          );
          edgesToRemove.push(
            ...subGraphEdges.filter(
              (edge) => !(edge.target === clickedNode.id),
            ),
          );
          nodesToRemove.push(...subGraphNodes);
        } else if (clickedNode.type === NOT_GATE) {
          //case 3: current node is a NOT gate with single child and new node is a logic gate (and/or)
          // update current node to logic gate and add the existing children of not gate as 1 subtree
          // and a basic event as another subtree

          // add a basic event as child
          const childNode1 = getBasicEventNode();
          const childEdge1 = getWorkflowEdge(clickedNode.id, childNode1.id);

          nodesToAdd.push(childNode1);
          edgesToAdd.push(childEdge1);
        } else if (updateNodeType === NOT_GATE) {
          // case 4: current node is of any type and new node is a not gate
          // flush the entire subtree and add a notGate with a basic event as child

          const { nodes: subGraphNodes, edges: subGraphEdges } = GetSubgraph(
            clickedNode,
            nodes,
            edges,
          );
          edgesToRemove.push(
            ...subGraphEdges.filter(
              (edge) => !(edge.target === clickedNode.id),
            ),
          );
          nodesToRemove.push(...subGraphNodes);

          // add a basic event as child to not gate
          const childNode = getBasicEventNode();
          const childEdge = getWorkflowEdge(clickedNode.id, childNode.id);

          nodesToAdd.push(childNode);
          edgesToAdd.push(childEdge);
        }

        // case 5: when current node is a logic gate with 'n' children, and the new node is also a logic gate
        // we will simply replace the current node with the new node, without modifying the children

        // update current node to the selected type
        updateClickedNodeTo = updateNodeType;
      } else {
        //if it is a delete function, there are 2 cases
        if (updateNodeType === "deleteSubtree") {
          //case1: delete entire subtree - delete all children nodes and edges
          const { nodes: subGraphNodes, edges: subGraphEdges } = GetSubgraph(
            clickedNode,
            nodes,
            edges,
          );
          edgesToRemove.push(
            ...subGraphEdges.filter(
              (edge) => !(edge.target === clickedNode.id),
            ),
          );
          nodesToRemove.push(...subGraphNodes);
          //set parent node type to basic event
          updateClickedNodeTo = BASIC_EVENT;
        } else if (updateNodeType === "deleteNode") {
          //case 2: delete intermediate node

          //if parent of intermediate node is NOT gate, handle separately
          const parentOfClickedNode = getIncomers(clickedNode, nodes, edges)[0];
          if (
            LOGICAL_GATES.includes(clickedNode.type) &&
            parentOfClickedNode.type === NOT_GATE
          ) {
            //gray out the subgraph
            const { grayedNodes, grayedEdges } = grayOutSubgraph(
              clickedNode,
              nodes,
              edges,
            );

            setNodes(grayedNodes);
            setEdges(grayedEdges);
            return;
          } else {
            const incomers = getIncomers(clickedNode, nodes, edges);
            const outgoers = getOutgoers(clickedNode, nodes, edges);
            const connectedEdges = getConnectedEdges([clickedNode], edges);

            // remove the node and the edges connected to it
            edgesToRemove.push(...connectedEdges);
            nodesToRemove.push(clickedNode);

            // connect the child edges to the parent node of the current node
            const createdEdges = incomers.flatMap(({ id: source }) =>
              outgoers.map(({ id: target }) => ({
                id: `${source}->${target}`,
                source,
                target,
                type: WORKFLOW,
              })),
            );

            // add the created edges
            edgesToAdd.push(...createdEdges);
          }
        }
      }

      // add new nodes and remove unwanted nodes
      const newNodes: Node[] = nodes
        .filter((node: Node) => !nodesToRemove.some((n) => n.id === node.id))
        .concat(nodesToAdd);

      // if we need to update parent node, find it and update it
      if (updateClickedNodeTo) {
        nodes[nodes.findIndex((el: Node) => el.id === id)].type =
          updateClickedNodeTo;
      }
      setNodes(newNodes);

      // add new edges and remove unwanted edges
      const newEdges: Edge[] = edges
        .filter((edge: Edge) => !edgesToRemove.some((e) => e.id === edge.id))
        .concat(edgesToAdd);
      setEdges(newEdges);
      // console.log(nodes);
      await GraphApiManager.storeHeatBalanceFaultTree(
        HeatBalanceFaultTreeState({
          nodes: nodes,
          edges: edges,
          heatBalanceFaultTreeId: heatBalanceFaultTreeId ?? "", // Use empty string as default value,
        }),
      ).then((r: HeatBalanceFaultTreeGraph): void => {
        // console.log(r);
      });
    },
    [clickedNode, nodes, setNodes, edges, setEdges, heatBalanceFaultTreeId, id],
  );

  return { handleContextMenuClick, validateFaultTreeContextMenuClick };
}

export { UseHeatBalanceFaultTreeContextMenuClick };
