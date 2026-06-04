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
    if (sourceNode.type === NOT_GATE) return;
    const nodesToAdd: Node<FaultTreeNodeProps>[] = [];
    const edgesToAdd: Edge<FaultTreeNodeProps>[] = [];
    const nextId = (): string => {
      const all = [...nodes, ...nodesToAdd];
      const nums = all.map((n: Node) => parseInt(n.id, 10)).filter((n: number) => !isNaN(n));
      return nums.length > 0 ? String(Math.max(...nums) + 1) : "2";
    };
    const newId = nextId();
    const newNode: Node<FaultTreeNodeProps> = {
      id: newId,
      data: {},
      position: { x: targetNode.position.x + 200, y: targetNode.position.y },
      type: nodeType,
    };
    nodesToAdd.push(newNode);
    edgesToAdd.push({
      id: `${edge.source}=>${newId}`,
      source: edge.source,
      target: newId,
      type: WORKFLOW,
      data: {},
      animated: false,
    } as Edge<FaultTreeNodeProps>);
    if (nodeType === NOT_GATE) {
      const child = getBasicEventNode([...nodes, ...nodesToAdd]);
      nodesToAdd.push(child);
      edgesToAdd.push(getWorkflowEdge(newId, child.id));
    } else if (!LEAF_NODE_TYPES.includes(nodeType)) {
      const child1 = getBasicEventNode([...nodes, ...nodesToAdd]);
      nodesToAdd.push(child1);
      edgesToAdd.push(getWorkflowEdge(newId, child1.id));
      const child2 = getBasicEventNode([...nodes, ...nodesToAdd]);
      nodesToAdd.push(child2);
      edgesToAdd.push(getWorkflowEdge(newId, child2.id));
    }
    takeSnapshot();
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
