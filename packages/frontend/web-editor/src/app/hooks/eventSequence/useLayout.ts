import { useEffect } from "react";
import {
  useReactFlow,
  useStore,
  Node,
  Edge,
  ReactFlowState,
  Position,
  getConnectedEdges,
  FitViewOptions,
} from "reactflow";
import { HierarchyNode, stratify, tree } from "d3-hierarchy";
import { timer } from "d3-timer";
import { AreSiblings, GetIncomingEdge, GetParentNode } from "../../../utils/treeUtils";
import { UseFocusContext } from "../../providers/focusProvider";
const layout = tree<Node>()
  .nodeSize([100, 150])
  .separation(() => 1);
const nodeCountSelector = (state: ReactFlowState): number => state.nodeInternals.size;
const options = { duration: 200 };
function UseLayout(): void {
  const nodeCount = useStore(nodeCountSelector);
  const { getNodes, getNode, setNodes, setEdges, getEdges, fitView } = useReactFlow();
  const { focusNodeId, reset } = UseFocusContext();
  useEffect(() => {
    if (!nodeCount) return;
    const nodes: Node[] = getNodes();
    const edges: Edge[] = getEdges();
    const hierarchy = stratify<Node>()
      .id((d) => d.id)
      .parentId((d: Node) => edges.find((e: Edge) => e.target === d.id)?.source)(nodes);
    const root = layout(
      hierarchy.sort((node1: HierarchyNode<Node>, node2: HierarchyNode<Node>) => {
        const currentNodes = getNodes();
        const currentEdges = getEdges();
        if (
          GetParentNode(node1.data, currentNodes, currentEdges).type === "functional" &&
          AreSiblings(node1.data, node2.data, currentNodes, currentEdges)
        ) {
          const incomingEdge1 = GetIncomingEdge(node1.data, getConnectedEdges([node1.data], currentEdges));
          const incomingEdge2 = GetIncomingEdge(node2.data, getConnectedEdges([node2.data], currentEdges));
          return incomingEdge1.data?.order !== undefined && incomingEdge2.data?.order !== undefined ?
              incomingEdge1.data.order - incomingEdge2.data.order
            : 0;
        }
        return 0;
      }),
    );
    const targetNodes = nodes.map((node) => {
      const { x, y } = root.find((d) => d.id === node.id) ?? {
        x: node.position.x,
        y: node.position.y,
      };
      return {
        ...node,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        position: { x: y, y: x },
        style: { opacity: 1 },
      };
    });
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
        setEdges((edges) => edges.map((edge) => ({ ...edge, style: { opacity: 1 } })));
        t.stop();
        const fitViewOptions: FitViewOptions = {
          duration: 500,
          padding: 0.2,
        };
        if (focusNodeId !== undefined) {
          fitViewOptions.nodes = [{ id: focusNodeId }];
          fitViewOptions.maxZoom = 1.6;
          reset();
        }
        fitView(fitViewOptions);
      }
    });
  }, [nodeCount, getEdges, getNodes, getNode, setNodes, fitView, setEdges, focusNodeId, reset]);
}
export { UseLayout };
