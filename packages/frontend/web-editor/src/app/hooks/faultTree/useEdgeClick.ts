import { Edge, Node, useReactFlow } from "reactflow";

import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { useParams } from "react-router-dom";
import { FaultTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import {
  exitGrayedState,
  FaultTreeState,
  getBasicEventNode,
  getWorkflowEdge,
  isSubgraphGrayed,
} from "../../../utils/treeUtils";
import { LEAF_NODE_TYPES, NOT_GATE, WORKFLOW } from "../../../utils/constants";
import { useStore } from "../../store/faultTreeStore";
import { useUndoRedo } from "./useUndeRedo";
import { FaultTreeNodeProps } from "../../components/treeNodes/faultTreeNodes/faultTreeNodeType";

/**
 * Hook that returns a function for inserting a new sibling node onto an edge.
 *
 * Clicking the + button on edge (source → target) adds a new node as a
 * NEW CHILD of source (i.e. a sibling of target). The existing edge is kept.
 *
 * If the chosen type is a gate, its required children are automatically added:
 *   - AND / OR / AT-LEAST: 2 new basic-event children
 *   - NOT gate          : 1 new basic-event child
 *   - Leaf types (BASIC_EVENT, HOUSE_EVENT, TRANSFER_GATE): no children
 *
 * All new nodes receive sequential integer IDs (max of current IDs + 1).
 *
 * @returns A function `(edgeId, nodeType) => void` that performs the insertion.
 */
function useEdgeInsert(): (edgeId: string, nodeType: string) => void {
  let { nodes, edges } = useStore();
  const { setNodes, setEdges, setFocusNodeId } = useStore();
  if (isSubgraphGrayed(nodes, edges)) {
    const { newNodes, newEdges } = exitGrayedState(nodes, edges);
    nodes = newNodes;
    edges = newEdges;
  }
  const { getNode, getEdge } = useReactFlow();
  const { takeSnapshot } = useUndoRedo();
  const { faultTreeId } = useParams();

  return (edgeId: string, nodeType: string): void => {
    const edge = getEdge(edgeId);
    if (!edge) return;

    const targetNode = getNode(edge.target);
    const sourceNode = getNode(edge.source);
    if (!targetNode || !sourceNode) return;

    // NOT gate already has its single required child — don't add siblings.
    if (sourceNode.type === NOT_GATE) return;

    const nodesToAdd: Node<FaultTreeNodeProps>[] = [];
    const edgesToAdd: Edge<FaultTreeNodeProps>[] = [];

    /** Next sequential ID, taking already-planned nodes into account. */
    const nextId = (): string => {
      const all = [...nodes, ...nodesToAdd];
      const nums = all.map((n: Node) => parseInt(n.id, 10)).filter((n: number) => !isNaN(n));
      return nums.length > 0 ? String(Math.max(...nums) + 1) : "2";
    };

    // ── Create the new sibling node ──────────────────────────────────────
    const newId = nextId();
    const newNode: Node<FaultTreeNodeProps> = {
      id: newId,
      data: {},
      // Initial position near the target; the layout pass will reposition it.
      position: { x: targetNode.position.x + 200, y: targetNode.position.y },
      type: nodeType,
    };
    nodesToAdd.push(newNode);

    // Edge: parent (source) → new sibling
    edgesToAdd.push({
      id: `${edge.source}=>${newId}`,
      source: edge.source,
      target: newId,
      type: WORKFLOW,
      data: {},
      animated: false,
    } as Edge<FaultTreeNodeProps>);

    // ── Auto-create children for gate types ─────────────────────────────
    if (nodeType === NOT_GATE) {
      // NOT gate gets exactly 1 basic-event child
      const child = getBasicEventNode([...nodes, ...nodesToAdd]);
      nodesToAdd.push(child);
      edgesToAdd.push(getWorkflowEdge(newId, child.id));
    } else if (!LEAF_NODE_TYPES.includes(nodeType)) {
      // AND / OR / AT-LEAST gates get 2 basic-event children
      const child1 = getBasicEventNode([...nodes, ...nodesToAdd]);
      nodesToAdd.push(child1);
      edgesToAdd.push(getWorkflowEdge(newId, child1.id));

      const child2 = getBasicEventNode([...nodes, ...nodesToAdd]);
      nodesToAdd.push(child2);
      edgesToAdd.push(getWorkflowEdge(newId, child2.id));
    }
    // LEAF_NODE_TYPES (BASIC_EVENT, HOUSE_EVENT, TRANSFER_GATE): no children.

    takeSnapshot();

    // Keep ALL existing nodes and edges — we are adding, not replacing.
    const newNodes = [...nodes, ...nodesToAdd];
    const newEdges = [...edges, ...edgesToAdd];

    setNodes(newNodes);
    setEdges(newEdges);
    setFocusNodeId(newId);

    void GraphApiManager.storeFaultTree(
      FaultTreeState({
        faultTreeId: faultTreeId ?? "",
        nodes: newNodes,
        edges: newEdges,
      }),
    ).then((_r: FaultTreeGraph) => {});
  };
}

export { useEdgeInsert };
