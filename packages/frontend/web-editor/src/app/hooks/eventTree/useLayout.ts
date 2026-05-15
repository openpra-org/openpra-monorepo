import { useEffect, useRef } from "react";
import { useReactFlow, useStore, Node, Edge, ReactFlowState } from "reactflow";
import { cluster, stratify } from "d3-hierarchy";
import { timer } from "d3-timer";
interface EventTreeNodeData {
  width: number;
  depth: number;
  label: string;
  isSequenceId?: boolean;
}
const layout = cluster<Node<EventTreeNodeData>>()
  .nodeSize([140, 40])
  .separation(() => 0.45);
const options = { duration: 300 };
function layoutNodes(
  nodes: Node<EventTreeNodeData>[],
  cols: Node<EventTreeNodeData>[],
  edges: Edge[],
): Node<EventTreeNodeData>[] {
  if (nodes.length === 0) {
    return [];
  }
  const hierarchy = stratify<Node<EventTreeNodeData>>()
    .id((d) => d.id)
    .parentId((d: Node<EventTreeNodeData>) => edges.find((e: Edge) => e.target === d.id)?.source)(nodes);
  const root = layout(hierarchy);
  nodes = root.descendants().map((d) => ({
    ...d.data,
    position: {
      x: d.y,
      y: d.x,
    },
  }));
  const maxYLeaf = Math.min(...root.leaves().map((d) => d.x));
  cols.forEach((col, index) => {
    const xPosition = index * col.data.width;
    col.position = { x: xPosition, y: maxYLeaf - 75 };
  });
  nodes.forEach((node) => {
    const correspondingColNode = cols.find((col) => col.data.depth === node.data.depth);
    if (correspondingColNode) {
      node.position.x = correspondingColNode.position.x;
    }
  });
  const regularCols = cols.filter((col) => col.type === "columnNode");
  nodes.forEach((node) => {
    if (node.type === "outputNode") {
      if (node.data.isSequenceId) {
        const seqIdCol = regularCols.find((col) => col.data.label === "Sequence ID");
        if (seqIdCol) {
          node.position.x = seqIdCol.position.x;
        }
      } else if (node.data.label.includes("Category")) {
        const catCol = regularCols.find((col) => col.data.label === "Release Category");
        if (catCol) {
          node.position.x = catCol.position.x;
        }
      }
    }
  });
  return [...nodes, ...cols];
}
const nodeCountSelector = (state: ReactFlowState): number => state.nodeInternals.size;
function useLayout(_depth: number): void {
  const initial = useRef(true);
  const nodeCount = useStore(nodeCountSelector);
  const { getNodes, getNode, setNodes, setEdges, getEdges, fitView } = useReactFlow<EventTreeNodeData, unknown>();
  useEffect(() => {
    const nodeData = getNodes();
    const edges = getEdges();
    const nodes: Node<EventTreeNodeData>[] = [];
    const cols: Node<EventTreeNodeData>[] = [];
    nodeData.forEach((node) => {
      if (node.type === "columnNode" || node.type === "columnActionsNode") {
        cols.push(node);
      } else {
        nodes.push(node);
      }
    });
    const targetNodes = layoutNodes(nodes, cols, edges);
    const transitions = targetNodes.map((node) => ({
      id: node.id,
      from: getNode(node.id)?.position ?? node.position,
      to: node.position,
      node,
    }));
    const t = timer((elapsed: number) => {
      const s = elapsed / options.duration;
      const currNodes = transitions.map(({ node, from, to }) => {
        const live = getNode(node.id);
        return {
          id: node.id,
          position: {
            x: from.x + (to.x - from.x) * s,
            y: from.y + (to.y - from.y) * s,
          },
          data: live ? { ...live.data } : { ...node.data },
          type: live?.type ?? node.type,
        };
      });
      setNodes(currNodes);
      if (elapsed > options.duration) {
        const finalNodes = transitions.map(({ node, to }) => {
          const live = getNode(node.id);
          return {
            id: node.id,
            position: {
              x: to.x,
              y: to.y,
            },
            data: live ? { ...live.data } : { ...node.data },
            type: live?.type ?? node.type,
          };
        });
        setNodes(finalNodes);
        t.stop();
        if (!initial.current) {
          fitView({ duration: 200, padding: 0.2 });
        }
        initial.current = false;
      }
    });
    return (): void => {
      t.stop();
    };
  }, [nodeCount, getEdges, getNodes, getNode, setNodes, fitView, setEdges]);
}
export default useLayout;
