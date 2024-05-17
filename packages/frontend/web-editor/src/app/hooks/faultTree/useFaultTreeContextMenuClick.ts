import { useCallback } from "react";
import { Edge, getConnectedEdges, getIncomers, getOutgoers, Node, NodeProps, useReactFlow } from "reactflow";
import _ from "lodash";
import { useParams } from "react-router-dom";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { FaultTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { FaultTreeState, getBasicEventNode, getWorkflowEdge } from "../../../utils/treeUtils";
import {
  AND_GATE,
  ATLEAST_GATE,
  ATLEAST_TWO_CHILDREN,
  BASIC_EVENT,
  DELETE,
  DELETE_ROOT_NODE,
  FAULT_TREE_ROOT_NODE_ID,
  HOUSE_EVENT,
  NOT_GATE,
  NOT_GATE_CHILD,
  OR_GATE,
  TRANSFER_GATE,
  UPDATE_ROOT_NODE,
  WORKFLOW,
} from "../../../utils/constants";
import { useStore } from "../../store/faultTreeStore";

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
function UseFaultTreeContextMenuClick(id: NodeProps["id"]) {
  // const { setEdges, setNodes, getNodes, getEdges, getNode } = useReactFlow();
  const { getNode } = useReactFlow();
  const { nodes, edges, setNodes, setEdges } = useStore();
  const { faultTreeId } = useParams();

  // function to get all child nodes and edges
  function getAllChildren(parentNode: Node): { nodes: Node[]; edges: Edge[] } {
    let childNodes: Node[] = [];
    let childEdges: Edge[] = [];
    const children = getOutgoers(parentNode, nodes, edges);
    childNodes.push(...children);
    const childrenEdges = getConnectedEdges([parentNode, ...children], edges).filter(
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
  }

  const leafNodeTypes: (string | undefined)[] = [BASIC_EVENT, HOUSE_EVENT, TRANSFER_GATE];

  const logicalGates: (string | undefined)[] = [AND_GATE, OR_GATE, ATLEAST_GATE];

  const validateFaultTreeContextMenuClick = useCallback(
    (id: string, type: string) => {
      const currentNode = getNode(id);
      if (!currentNode) {
        return;
      }
      if (type.startsWith("delete")) {
        if (id === FAULT_TREE_ROOT_NODE_ID) {
          return DELETE_ROOT_NODE;
        } else if (leafNodeTypes.includes(currentNode.type)) {
          //check parent of current node
          const incomers = getIncomers(currentNode, nodes, edges);
          const outgoers = getOutgoers(incomers[0], nodes, edges);

          //if parent should have at least 2 children
          if (logicalGates.includes(incomers[0].type) && outgoers.length === 2) {
            return ATLEAST_TWO_CHILDREN;
          }
          //if parent is NOT gate, cannot delete only child (leaf event)
          if (incomers[0].type === NOT_GATE) {
            return NOT_GATE_CHILD;
          }
        }
      } else if (id === FAULT_TREE_ROOT_NODE_ID && (leafNodeTypes.includes(type) || type === NOT_GATE)) {
        return UPDATE_ROOT_NODE;
      }
    },
    [getNode],
  );

  const handleContextMenuClick = useCallback(
    async (updateNodeType: string) => {
      // we need the parent node object for positioning the new child node
      const parentNode = getNode(id);
      let updateParentNodeTo = "";

      if (!parentNode) {
        return;
      }
      const nodesToAdd: Node[] = [];
      const nodesToRemove: Node[] = [];
      const edgesToRemove: Edge[] = [];
      const edgesToAdd: Edge[] = [];

      if (!updateNodeType.startsWith(DELETE)) {
        if (
          leafNodeTypes.includes(parentNode.type) &&
          !leafNodeTypes.includes(updateNodeType) &&
          updateNodeType !== NOT_GATE
        ) {
          // case 1: current node is basic event (or any leaf event like house/transfer) and new node is and/or gate (not a leaf event)
          // add two basic events as children and update the current node to the type of new node
          const childNode1 = getBasicEventNode();
          const childNode2 = getBasicEventNode();
          const childEdge1 = getWorkflowEdge(parentNode.id, childNode1.id);
          const childEdge2 = getWorkflowEdge(parentNode.id, childNode2.id);

          // add the child nodes and edges
          nodesToAdd.push(childNode1, childNode2);
          edgesToAdd.push(childEdge1, childEdge2);
        } else if (leafNodeTypes.includes(updateNodeType)) {
          // case 2: current node is any type of node with children and new node is leaf node
          // delete all child nodes and edges
          const { nodes, edges } = getAllChildren(parentNode);
          edgesToRemove.push(...edges.filter((edge) => !(edge.target === parentNode.id)));
          nodesToRemove.push(...nodes);
        } else if (parentNode.type === NOT_GATE) {
          //case 3: current node is a NOT gate with single child and new node is a logic gate (and/or)
          // update current node to logic gate and add the existing children of not gate as 1 subtree
          // and a basic event as another subtree

          // add a basic event as child
          const childNode1 = getBasicEventNode();
          const childEdge1 = getWorkflowEdge(parentNode.id, childNode1.id);

          nodesToAdd.push(childNode1);
          edgesToAdd.push(childEdge1);
        } else if (updateNodeType === NOT_GATE) {
          // case 4: current node is of any type and new node is a not gate
          // flush the entire subtree and add a notGate with a basic event as child

          const { nodes, edges } = getAllChildren(parentNode);
          edgesToRemove.push(...edges.filter((edge) => !(edge.target === parentNode.id)));
          nodesToRemove.push(...nodes);

          // add a basic event as child to not gate
          const childNode = getBasicEventNode();
          const childEdge = getWorkflowEdge(parentNode.id, childNode.id);

          nodesToAdd.push(childNode);
          edgesToAdd.push(childEdge);
        }

        // case 5: when current node is a logic gate with 'n' children, and the new node is also a logic gate
        // we will simply replace the current node with the new node, without modifying the children

        // update current node to the selected type
        updateParentNodeTo = updateNodeType;
      } else {
        //if it is a delete function, there are 2 cases
        if (updateNodeType === "deleteSubtree") {
          //delete all children nodes and edges
          const { nodes, edges } = getAllChildren(parentNode);
          edgesToRemove.push(...edges.filter((edge) => !(edge.target === parentNode.id)));
          nodesToRemove.push(...nodes);
          //set parent node type to basic event
          updateParentNodeTo = BASIC_EVENT;
        } else if (updateNodeType === "deleteNode") {
          const incomers = getIncomers(parentNode, nodes, edges);
          const outgoers = getOutgoers(parentNode, nodes, edges);
          const connectedEdges = getConnectedEdges([parentNode], edges);

          // remove the node and the edges connected to it
          edgesToRemove.push(...connectedEdges);
          nodesToRemove.push(parentNode);

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

      // add new nodes and remove unwanted nodes
      const newNodes: Node[] = nodes
        .filter((node: Node) => !nodesToRemove.some((n) => n.id === node.id))
        .concat(nodesToAdd);

      // if we need to update parent node, find it and update it
      if (updateParentNodeTo) {
        nodes[nodes.findIndex((el: Node) => el.id === id)].type = updateParentNodeTo;
      }
      setNodes(newNodes);

      // add new edges and remove unwanted edges
      const newEdges: Edge[] = edges
        .filter((edge: Edge) => !edgesToRemove.some((e) => e.id === edge.id))
        .concat(edgesToAdd);
      setEdges(newEdges);

      await GraphApiManager.storeFaultTree(
        FaultTreeState({
          edges: edges,
          faultTreeId: faultTreeId ?? "", // Use empty string as default value,
          nodes: nodes,
        }),
      ).then((r: FaultTreeGraph): void => {
        //console.log(r);
      });
    },
    [getNode, id, nodes, setNodes, edges, setEdges, faultTreeId, leafNodeTypes, getAllChildren],
  );

  return { handleContextMenuClick, validateFaultTreeContextMenuClick };
}

export { UseFaultTreeContextMenuClick };
