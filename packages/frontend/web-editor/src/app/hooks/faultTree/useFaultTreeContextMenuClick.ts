import {useCallback, useState} from 'react';
import {Edge, getConnectedEdges, getIncomers, getOutgoers, Node, NodeProps, useReactFlow} from 'reactflow';
import _ from 'lodash'
import {generateUUID, state} from '../../../utils/treeUtils';
import {useParams} from "react-router-dom";
import GraphApiManager from "shared-types/src/lib/api/GraphApiManager";


/**
 * Hook for handling context menu click event.
 *
 * This hook provides a function `handleContextMenuClick` that can be used to update the state of the fault tree
 * based on the selected node type. It utilizes the React Flow library for managing nodes and edges in a flowchart-like UI.
 *
 * @param id The unique identifier for each node.
 * @example
 * ```typescript
 * const { handleContextMenuClick } = useFaultTreeContextMenuClick('uniqueNodeId');
 * ```
 */
export function useFaultTreeContextMenuClick(id: NodeProps['id']) {
  const {setEdges, setNodes, getNodes, getEdges, getNode} = useReactFlow();
  const {faultTreeId} = useParams();
  // function to get all child nodes and edges
  function getAllChildren(parentNode: Node) {
    let childNodes: Node[] = []
    let childEdges: Edge[] = []
    let children = getOutgoers(parentNode, getNodes(), getEdges());
    childNodes.push(...children);
    let childrenEdges = getConnectedEdges([parentNode, ...children], getEdges())
      .filter((edge) => !(edge.target === parentNode.id));
    childEdges.push(...childrenEdges);
    children.forEach((child) => {
      let {nodes, edges} = getAllChildren(child);
      childNodes.push(...nodes);
      childEdges.push(...edges);
    });
    childNodes = _.uniqBy(childNodes, "id");
    childEdges = _.uniqBy(childEdges, "id");
    return {
      nodes: childNodes,
      edges: childEdges
    };
  }

  const handleContextMenuClick = useCallback((contextMenuClickEvent: React.MouseEvent) => {
    // we need the parent node object for positioning the new child node
    const parentNode = getNode(id);
    if (!parentNode) {
      return;
    }
    const nodesToAdd: Node[] = []
    const nodesToRemove: Node[] = []
    const edgesToRemove: Edge[] = []
    const edgesToAdd: Edge[] = []


    // get all children of the current node
    const existingChildren = getOutgoers(parentNode, getNodes(), getEdges())
      .map((node) => node.id);

    const leafNodeTypes: (string | undefined)[] = ['basicEvent', 'houseEvent', 'transferGate'];
    const nonLeafNodeTypes: (string | undefined)[] = ['andGate', 'orGate', 'atLeastGate', 'notGate']

    if ((leafNodeTypes.includes(parentNode.type)) && (!leafNodeTypes.includes(contextMenuClickEvent.currentTarget.id) && contextMenuClickEvent.currentTarget.id !== 'notGate')) {
      // case 1: current node is basic event (or any leaf event like house/transfer) and new node is and/or gate (not a leaf event)
      // add two basic events as children and update the current node to the type of new node

      // create a unique id for the child nodes
      const childNodeId1 = generateUUID();
      const childNodeId2 = generateUUID();

      // create the child nodes
      const childNode1 = {
        id: childNodeId1,
        // we try to place the child node close to the calculated position from the layout algorithm
        // 150 pixels below the parent node, this spacing can be adjusted in the useLayout hook
        position: {x: parentNode.position.x, y: parentNode.position.y + 150},
        type: 'basicEvent',
        data: {},
      };

      const childNode2 = {
        id: childNodeId2,
        // we try to place the child node close to the calculated position from the layout algorithm
        // 150 pixels below the parent node, this spacing can be adjusted in the useLayout hook
        position: {x: parentNode.position.x, y: parentNode.position.y + 150},
        type: 'basicEvent',
        data: {},
      };

      const childEdge1 = {
        id: `${parentNode.id}=>${childNodeId1}`,
        source: parentNode.id,
        target: childNodeId1,
        type: 'workflow',
      };

      const childEdge2 = {
        id: `${parentNode.id}=>${childNodeId2}`,
        source: parentNode.id,
        target: childNodeId2,
        type: 'workflow',
      };

      // add the child nodes and edges
      nodesToAdd.push(childNode1, childNode2);
      edgesToAdd.push(childEdge1, childEdge2);

    } else if (parentNode.type === 'notGate') {
      //case 2: current node is a NOT gate with single child and new node is a logic gate (and/or)
      // update current node to logic gate and add the existing children of not gate as 1 subtree
      // and a basic event as another subtree

      // create a unique id for the child nodes
      const childNodeId1 = generateUUID();

      // add a basic event as child
      const childNode1 = {
        id: childNodeId1,
        // we try to place the child node close to the calculated position from the layout algorithm
        // 150 pixels below the parent node, this spacing can be adjusted in the useLayout hook
        position: {x: parentNode.position.x, y: parentNode.position.y + 150},
        type: 'basicEvent',
        data: {},
      };

      const childEdge1 = {
        id: `${parentNode.id}=>${childNodeId1}`,
        source: parentNode.id,
        target: childNodeId1,
        type: 'workflow',
      };

      nodesToAdd.push(childNode1);
      edgesToAdd.push(childEdge1);
    } else if (leafNodeTypes.includes(contextMenuClickEvent.currentTarget.id)) {
      // case 3: current node is any type of node with children and new node is leaf node
      // delete all child nodes and edges

      let {nodes, edges} = getAllChildren(parentNode);
      edgesToRemove.push(...edges.filter((edge) => !(edge.target === parentNode.id)));
      nodesToRemove.push(...nodes);
    } else if (contextMenuClickEvent.currentTarget.id === 'notGate') {
      // case 4: current node is of any type and new node is a not gate
      // flush the entire subtree and add a notGate with a basic event as child

      let {nodes, edges} = getAllChildren(parentNode);
      edgesToRemove.push(...edges.filter((edge) => !(edge.target === parentNode.id)));
      nodesToRemove.push(...nodes);

      const childNodeId = generateUUID();

      // add a not gate node
      const childNode = {
        id: childNodeId,
        position: {x: parentNode.position.x, y: parentNode.position.y},
        type: 'basicEvent',
        data: {}
      }

      const childEdge = {
        id: `${parentNode.id}=>${childNodeId}`,
        source: parentNode.id,
        target: childNodeId,
        type: 'workflow'
      }
      // get id of parent node of the parentNode

      nodesToAdd.push(childNode);
      edgesToAdd.push(childEdge);
    }

    // case 5: when current node is a logic gate with 'n' children, and the new node is also a logic gate
    // we will simply replace the current node with the new node, without modifying the children

    // update current node to the selected type
    parentNode.type = contextMenuClickEvent.currentTarget.id;

    // add new nodes and remove unwanted nodes
    const nodes: Node[] = getNodes()
        .filter((node) => !nodesToRemove.some((n) => n.id === node.id))
        .concat(nodesToAdd);

    setNodes(nodes);

    // add new edges and remove unwanted edges
    const edges: Edge[] = getEdges()
        .filter((edge) => !edgesToRemove.some((e) => e.id === edge.id))
        .concat(edgesToAdd);

    setEdges(edges);

    GraphApiManager.storeFaultTree(
      state({
        faultTreeId: faultTreeId!,
        nodes: nodes,
        edges: edges
      })
    ).then((r: any) => {
      console.log(r);
    });
  }, [getEdges, getNode, getNodes, id, setEdges, setNodes]);

  return {handleContextMenuClick};
}

export default useFaultTreeContextMenuClick;
