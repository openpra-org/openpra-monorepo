import {
  Edge,
  getConnectedEdges,
  getOutgoers,
  Node,
  NodeProps,
  useReactFlow,
} from "reactflow";
import { BaseSyntheticEvent, useCallback } from "react";
import _ from "lodash";
import { generateUUID } from "../../../utils/treeUtils";

/**
 * Generate a new End State Node
 * @returns node object of newly generate End State node
 */
function getEndStateNode() {
  return {
    id: generateUUID(),
    data: { label: "End State" },
    position: { x: 0, y: 0 },
    type: "end",
  };
}

/**
 * Generate a new End State edge
 * @returns edge object of newly generate edge
 */
function getEndStateEdge(
  parentNodeId: string,
  childNodeId: string,
  label = "",
) {
  const edge: Edge = {
    id: `${parentNodeId}->${childNodeId}`,
    source: parentNodeId,
    target: childNodeId,
    type: "normal",
  };
  if (label !== "") {
    edge.type = "functional";
    edge.label = label;
  }
  return edge;
}

/**
 * Hook for handling context menu clicks on event sequences.
 *
 * This hook provides a function, `useHandleContextMenuClick`, that can be used to update the state of the event sequence
 * based on the selected node type. It utilizes the React Flow library for managing nodes and edges in a flowchart-like UI.
 *
 * @param {string} id - The unique identifier of the node associated with the context menu.
 * @example
 * ```typescript
 * const { useHandleContextMenuClick } = useEventSequenceContextMenuClick('uniqueNodeId');
 * ```
 */
export function useEventSequenceContextMenuClick(id: NodeProps["id"]) {
  const { setEdges, setNodes, getNodes, getEdges, getNode } = useReactFlow();

  /**
   * Recursively retrieves all children nodes and edges of a given parent node.
   *
   * @param {Node} parentNode - The parent node for which to retrieve children.
   * @returns A dictionary containing arrays of child nodes and edges.
   * @private
   */
  function getAllChildren(parentNode: Node) {
    let childNodes: Node[] = [];
    let childEdges: Edge[] = [];

    // get out-goers of the current node
    const children = getOutgoers(parentNode, getNodes(), getEdges());
    childNodes.push(...children);

    // get connected edges from the current node to children nodes
    const childrenEdges = getConnectedEdges(
      [parentNode, ...children],
      getEdges(),
    ).filter((edge) => !(edge.target === parentNode.id));
    childEdges.push(...childrenEdges);

    // for each child, find children recursively
    children.forEach((child) => {
      const { nodes, edges } = getAllChildren(child);
      childNodes.push(...nodes);
      childEdges.push(...edges);
    });

    // make sure nodes and edges are unique
    childNodes = _.uniqBy(childNodes, "id");
    childEdges = _.uniqBy(childEdges, "id");

    return {
      nodes: childNodes,
      edges: childEdges,
    };
  }

  /**
   * Handles the context menu click by updating the state based on the selected node type.
   *
   * @param nodeType - The type of the node selected in the context menu.
   * @throws {Error} If the parentNode is not found.
   */
  const useHandleContextMenuClick = useCallback(
    (event: BaseSyntheticEvent) => {
      // we need the parent node object for positioning the new child node
      const parentNode = getNode(id);
      if (!parentNode) {
        return;
      }

      // change child nodes based on the updated type of node
      parentNode.type = event.currentTarget.id;

      const childNodes = getOutgoers(parentNode, getNodes(), getEdges());
      const nodesToAdd: Node[] = [];
      const edgesToAdd: Edge[] = [];
      const nodesToRemove: Node[] = [];
      const edgesToRemove: Edge[] = [];

      if (parentNode.type === "functional") {
        if (childNodes.length == 0) {
          // if no nodes present, add two end state nodes
          const child1 = getEndStateNode();
          const child2 = getEndStateNode();
          const edge1 = getEndStateEdge(parentNode.id, child1.id, "Yes");
          const edge2 = getEndStateEdge(parentNode.id, child2.id, "No");
          nodesToAdd.push(child1, child2);
          edgesToAdd.push(edge1, edge2);
        } else if (childNodes.length == 1) {
          // if 1 node present, update the existing node's label and add an end state node
          const existingEdge = getEdges().find(
            (edge) => edge.source === parentNode.id,
          )!;
          edgesToRemove.push(existingEdge);
          edgesToAdd.push({
            id: existingEdge.id,
            source: existingEdge.source,
            target: existingEdge.target,
            type: "functional",
            label: "Yes",
          });
          const child2 = getEndStateNode();
          const edge2 = getEndStateEdge(parentNode.id, child2.id, "No");
          nodesToAdd.push(child2);
          edgesToAdd.push(edge2);
        } else if (childNodes.length == 2) {
          // update the edge labels of existing connections
          const existingEdges = getEdges().filter(
            (edge) => edge.source === parentNode.id,
          );
          edgesToRemove.push(...existingEdges);
          edgesToAdd.push(
            {
              id: existingEdges[0].id,
              source: existingEdges[0].source,
              target: existingEdges[0].target,
              type: "functional",
              label: "Yes",
            },
            {
              id: existingEdges[1].id,
              source: existingEdges[1].source,
              target: existingEdges[1].target,
              type: "functional",
              label: "No",
            },
          );
        }
      } else if (
        parentNode.type === "description" ||
        parentNode.type === "intermediate"
      ) {
        if (childNodes.length == 0) {
          // if no child nodes present, add an end state node
          const child = getEndStateNode();
          const edge = getEndStateEdge(parentNode.id, child.id);
          nodesToAdd.push(child);
          edgesToAdd.push(edge);
        } else if (childNodes.length == 2) {
          // if more than 1 node present, remove the additional node, update the existing edge
          const existingEdges = getEdges().filter(
            (edge) => edge.source === parentNode.id,
          );
          const extraNodes = getOutgoers(
            parentNode,
            getNodes(),
            getEdges(),
          ).filter((node) => !(node.id === existingEdges[0].target));
          nodesToRemove.push(...extraNodes);
          edgesToRemove.push(...existingEdges);
          edgesToAdd.push({
            id: existingEdges[0].id,
            source: existingEdges[0].source,
            target: existingEdges[0].target,
            type: "normal",
          });
        }
      } else if (
        parentNode.type === "transfer" ||
        parentNode.type === "end" ||
        parentNode.type === "undeveloped"
      ) {
        // remove all child nodes present
        let { nodes, edges } = getAllChildren(parentNode);
        edges = edges.filter((edge) => !(edge.target === parentNode.id));
        nodesToRemove.push(...nodes);
        edgesToRemove.push(...edges);
      }

      setNodes(
        getNodes()
          .filter((node) => !nodesToRemove.some((n) => n.id === node.id))
          .concat(nodesToAdd),
      );
      setEdges(
        getEdges()
          .filter((edge) => !edgesToRemove.some((e) => e.id === edge.id))
          .concat(edgesToAdd),
      );
    },
    [getEdges, getNode, getNodes, id, setEdges, setNodes],
  );

  return { useHandleContextMenuClick };
}
