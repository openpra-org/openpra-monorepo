import { useEffect, useRef } from "react";
import { useReactFlow, useStore, Node, Edge, ReactFlowState } from "reactflow";
import { stratify, tree } from "d3-hierarchy";
import { timer } from "d3-timer";
import { FAULT_TREE_NODE_HEIGHT, FAULT_TREE_NODE_SEPARATION, FAULT_TREE_NODE_WIDTH } from "../../../utils/constants";
import { useStore as useFaultTreeStore } from "../../store/faultTreeStore";
const layout = tree<Node>()
  .nodeSize([FAULT_TREE_NODE_WIDTH, FAULT_TREE_NODE_HEIGHT])
  .separation(() => FAULT_TREE_NODE_SEPARATION);
const options = { duration: 300 };
function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) {
    return [];
  }
  const hierarchy = stratify<Node>()
    .id((d) => d.id)
    .parentId((d: Node) => edges.find((e: Edge) => e.target === d.id)?.source)(nodes);
  const root = layout(hierarchy);
  return root.descendants().map((d) => ({ ...d.data, position: { x: d.x, y: d.y } }));
}
const nodeCountSelector = (state: ReactFlowState): number => state.nodeInternals.size;
function UseLayout(enabled: boolean = true): void {
  const initial = useRef(true);
  const nodeCount = useStore(nodeCountSelector);
  const { getNodes, getNode, setNodes, getEdges, fitView } = useReactFlow();
  const { focusNodeId, resetFocusNodeId } = useFaultTreeStore();
  useEffect(() => {
    if (!enabled) return;
    const nodes = getNodes();
    const edges = getEdges();
    const targetNodes = layoutNodes(nodes, edges);
    const transitions = targetNodes.map((node) => ({
      id: node.id,
      from: getNode(node.id)?.position ?? node.position,
      to: node.position,
      node,
    }));
    const t = timer((elapsed: number) => {
      const s = elapsed / options.duration;
      const currNodes = transitions.map(({ node, from, to }) => ({
        id: node.id,
        position: {
          x: from.x + (to.x - from.x) * s,
          y: from.y + (to.y - from.y) * s,
        },
        data: { ...(node.data as object) },
        type: node.type,
      }));
      setNodes(currNodes);
      if (elapsed > options.duration) {
        const finalNodes = transitions.map(({ node, to }) => ({
          id: node.id,
          position: {
            x: to.x,
            y: to.y,
          },
          data: { ...(node.data as object) },
          type: node.type,
        }));
        setNodes(finalNodes);
        t.stop();
        if (focusNodeId !== undefined) {
          fitView({
            nodes: [{ id: focusNodeId }],
            duration: 500,
            maxZoom: 1.6,
          });
          resetFocusNodeId();
        }
        initial.current = false;
      }
    });
    return (): void => {
      t.stop();
    };
  }, [enabled, nodeCount, focusNodeId, resetFocusNodeId]);
}
export { UseLayout };
